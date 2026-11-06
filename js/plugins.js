/* Plugin system.
 *   registerPlugin({ id, name, description, icon, defaultEnabled, gameplay, onInit, onEnable, onDisable,
 *                    onExpeditionStart, onRoundStart, onRoundEnd, onMatchEnd, onSpawn, onAimStart, onShot, onHit,
 *                    onSubdue, onCatch, onMiss, onUpdate, onRenderBack, onRenderFront, panel,
 *                    modifySpawnWeight, modifyXp, modifyStone })
 * Hooks receive (payload, api). Reducers (modify*) receive (value, payload, api) and return a new value.
 * `gameplay: true` plugins are synchronised in VS matches: the host's settings apply to both players.
 */
(function () {
  const list = [];
  const byId = {};
  let api = null;

  function register(p) {
    if (!p || !p.id) throw new Error('Plugin needs an id');
    if (byId[p.id]) { console.warn('Plugin already registered:', p.id); return byId[p.id]; }
    p.name = p.name || p.id; p.description = p.description || '';
    list.push(p); byId[p.id] = p;
    if (api) init(p);
    return p;
  }
  function init(p) {
    const prof = Core.profile;
    if (prof.plugins[p.id] === undefined) prof.plugins[p.id] = p.defaultEnabled !== false;
    safe(p, 'onInit', null);
    if (prof.plugins[p.id]) safe(p, 'onEnable', null);
  }
  function setup(a) { api = a; list.forEach(init); }
  function enabled(id) { return !!Core.profile.plugins[id]; }
  // Active = what applies to the current game. In VS, gameplay plugins follow the host's rules.
  function active(id) {
    const p = byId[id]; if (!p) return false;
    const g = api && api.game;
    if (p.gameplay && g && g.mode === 'vs' && g.rules) return !!g.rules[id];
    return enabled(id);
  }
  function setEnabled(id, on) {
    const p = byId[id]; if (!p) return;
    const was = enabled(id); Core.profile.plugins[id] = !!on; Core.save();
    if (on && !was) safe(p, 'onEnable', null); if (!on && was) safe(p, 'onDisable', null);
  }
  function safe(p, hook, payload) {
    try { return p[hook] && p[hook](payload, api); } catch (e) { console.error('[plugin ' + p.id + '] ' + hook, e); }
  }
  function emit(hook, payload) { for (const p of list) if (p[hook] && active(p.id)) safe(p, hook, payload); }
  function reduce(hook, value, payload) {
    for (const p of list) if (p[hook] && active(p.id)) {
      try { const v = p[hook](value, payload, api); if (v !== undefined) value = v; } catch (e) { console.error('[plugin ' + p.id + '] ' + hook, e); }
    }
    return value;
  }
  function data(id) { const d = Core.profile.pluginData; return d[id] || (d[id] = {}); }
  function gameplayRules() { const r = {}; list.forEach(p => { if (p.gameplay) r[p.id] = enabled(p.id); }); return r; }

  window.Plugins = { register, setup, enabled, active, setEnabled, emit, reduce, data, list, byId, gameplayRules };
  window.registerPlugin = register;
})();
