/* Core utilities: seeded RNG, profile persistence, levels, Wikipedia lookup. */
(function () {
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(...nums) {
    let h = 2166136261 >>> 0;
    for (const n of nums) { h ^= (n >>> 0); h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; }
    return h >>> 0;
  }
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  function weightedPick(rng, items, wf) {
    const ws = items.map(wf); const tot = ws.reduce((a, b) => a + b, 0);
    let r = rng() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  // ---------- Levels ----------
  const MAX_LEVEL = 30;
  const xpToNext = L => 60 + 45 * L;
  function levelFromXp(xp) {
    let L = 1, need = xpToNext(1), rem = xp;
    while (rem >= need && L < MAX_LEVEL) { rem -= need; L++; need = xpToNext(L); }
    return { level: L, into: rem, need };
  }

  // ---------- Upgrades ----------
  const UPGRADES = {
    power: { name: 'Draw Weight', desc: 'Faster, heavier shots. Each tier adds launch speed and impact.', tiers: [
      { cost: 0, lvl: 1, label: 'Ash Fork' }, { cost: 60, lvl: 2, label: 'Hickory Recurve' }, { cost: 140, lvl: 4, label: 'Carbon Recurve' },
      { cost: 260, lvl: 7, label: 'Titanium Ridge' }, { cost: 420, lvl: 11, label: 'Obsidian Pro' }] },
    multi: { name: 'Multi-shot', desc: 'Load extra pellets per release, fanned slightly apart.', tiers: [
      { cost: 0, lvl: 1, label: 'Single' }, { cost: 220, lvl: 4, label: 'Twin pellet' }, { cost: 520, lvl: 9, label: 'Triple spread' }] },
    accuracy: { name: 'Sighting', desc: 'Longer trajectory preview and tighter grouping.', tiers: [
      { cost: 0, lvl: 1, label: 'Open sight' }, { cost: 80, lvl: 2, label: 'Fibre pin' }, { cost: 170, lvl: 5, label: 'Ranging pin' }, { cost: 320, lvl: 8, label: 'Laser rangefinder' }] },
    reload: { name: 'Reload', desc: 'Faster stone loading (R). Base 0.6 s.', tiers: [
      { cost: 0, lvl: 1, label: 'Loose pouch' }, { cost: 90, lvl: 3, label: 'Pellet clip' }, { cost: 190, lvl: 6, label: 'Speed pouch' }, { cost: 340, lvl: 10, label: 'Magazine bands' }] },
  };
  function loadoutStats(u) {
    return {
      speed: 1120 + u.power * 95,
      damage: 1 + u.power * 0.35,
      pellets: 1 + u.multi,
      preview: 0.32 + u.accuracy * 0.3,
      spread: [3.2, 2.2, 1.2, 0.4][u.accuracy] * Math.PI / 180,
      cooldown: [0.6, 0.5, 0.42, 0.34][u.reload],
      tier: u.power,
    };
  }
  const VS_LOADOUT = { power: 2, multi: 0, accuracy: 2, reload: 1 };

  // ---------- Profile ----------
  const KEY = 'slingshotSafari.profile.v1';
  function defaults() {
    return {
      name: 'Ranger' + Math.floor(100 + Math.random() * 900), xp: 0, coins: 0,
      upgrades: { power: 0, multi: 0, accuracy: 0, reload: 0 },
      journal: {}, records: 0, stats: { shots: 0, hits: 0, catches: 0, expeditions: 0, vsWins: 0, vsMatches: 0 },
      settings: { volume: 0.6, trajectory: true, autoReload: false, reducedMotion: false, quality: 'high', units: 'metric' },
      plugins: {}, pluginData: {}, lastRegion: 'meadow',
    };
  }
  let profile;
  function load() {
    try { profile = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { profile = defaults(); }
    const d = defaults();
    profile.upgrades = Object.assign(d.upgrades, profile.upgrades);
    profile.stats = Object.assign(d.stats, profile.stats);
    profile.settings = Object.assign(d.settings, profile.settings);
    return profile;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* storage full / private */ } }
  function reset() { localStorage.removeItem(KEY); load(); save(); }

  // ---------- Wikipedia ----------
  const WCACHE = 'slingshotSafari.wiki.v1';
  let wikiMem = {};
  try { wikiMem = JSON.parse(localStorage.getItem(WCACHE) || '{}'); } catch (e) { wikiMem = {}; }
  function wikiUrl(title) { return 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')); }
  async function wiki(sp) {
    const title = sp.wiki;
    const fb = (window.WIKI_FALLBACK || {})[title] || {};
    const base = { title, intro: fb.intro || '', thumb: fb.thumb || null, url: wikiUrl(title), live: false };
    const cached = wikiMem[title];
    if (cached && Date.now() - cached.at < 7 * 864e5) return Object.assign(base, cached.d, { live: true, cached: true });
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 4500);
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const d = { intro: trimExtract(j.extract) || base.intro, thumb: (j.thumbnail && j.thumbnail.source) || base.thumb, url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || base.url, desc: j.description };
      wikiMem[title] = { at: Date.now(), d };
      try { localStorage.setItem(WCACHE, JSON.stringify(wikiMem)); } catch (e) { }
      return Object.assign(base, d, { live: true });
    } catch (e) { return base; }
  }
  function trimExtract(t) {
    if (!t) return '';
    const parts = t.split(/(?<=[a-z\)]\.)\s+/);
    let out = parts.slice(0, 3).join(' ');
    if (out.length > 520) out = parts.slice(0, 2).join(' ');
    return out;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function sgTime(d) {
    try { return (d || new Date()).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' SGT'; }
    catch (e) { return (d || new Date()).toISOString(); }
  }
  function todayKey() {
    try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }); } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  window.Core = { mulberry32, hash, hashStr, pick, weightedPick, levelFromXp, xpToNext, MAX_LEVEL, UPGRADES, loadoutStats, VS_LOADOUT,
    load, save, reset, get profile() { return profile; }, wiki, wikiUrl, escapeHtml, sgTime, todayKey };
})();
