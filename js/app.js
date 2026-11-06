/* Slingshot Safari — UI controller. */
(function () {
  const DB = SpeciesDB, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = Core.escapeHtml;
  Core.load();

  const App = window.App = {
    game: null, screen: 'menu', journalFilter: 'all', curCard: null, lastVsTarget: null,
  };

  // ---------------- plugin API ----------------
  const api = {
    get game() { return App.game; }, get profile() { return Core.profile; },
    save: () => Core.save(), data: id => Plugins.data(id), emit: (h, p) => Plugins.emit(h, p),
    ui: { toast, menuNote },
    hud: {
      set(id, text) {
        let el = document.getElementById('chip-' + id);
        if (!text) { el && el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.className = 'hchip'; el.id = 'chip-' + id; $('#chips').appendChild(el); }
        el.textContent = text;
      },
    },
  };

  function toast(msg, kind) {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 400); }, 3200);
  }
  function menuNote(id, html) {
    let el = document.getElementById('note-' + id);
    if (!html) { el && el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'note'; el.id = 'note-' + id; $('#menu-notes').appendChild(el); }
    el.innerHTML = html;
  }
  const levelInfo = () => Core.levelFromXp(Core.profile.xp);
  const unlocked = r => levelInfo().level >= r.unlock;
  function ui(kind) { Plugins.emit('onUi', { kind: kind || 'click' }); }

  // ---------------- screens ----------------
  function go(name) {
    App.screen = name;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
    $('#ui').style.display = '';
    const renders = { menu: renderMenu, regions: renderRegions, journal: renderJournal, outfitter: renderOutfitter, plugins: renderPlugins, settings: renderSettings, vs: renderVsLobby };
    renders[name] && renders[name]();
  }
  function showHud(mode) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $('#hud').className = mode; $('#hud').classList.remove('hidden');
    $('#ui').style.display = 'none'; document.body.classList.add('playing');
    $('#touch').classList.toggle('hidden', !isTouch()); document.body.classList.toggle('touchui', isTouch());
  }
  const isTouch = () => (App.game && App.game.touchMode) || matchMedia('(pointer: coarse)').matches;
  function hideHud() { App.game && App.game.unlock(); $('#touch').classList.add('hidden'); $('#hud').classList.add('hidden'); $('#ui').style.display = ''; document.body.classList.remove('playing'); $('#target').classList.add('hidden'); $('#feed').innerHTML = ''; $('#chips').innerHTML = ''; }
  function toMenu() {
    hideHud(); centerMsg(null); $('#mini-card').classList.add('hidden');
    App.game.ambient(Core.profile.lastRegion || 'meadow'); go('menu');
  }

  function renderMenu() {
    const p = Core.profile, L = levelInfo();
    $('#profile-strip').innerHTML = `<div class="av">${esc(p.name[0] || 'R').toUpperCase()}</div>
      <div class="pi"><b>${esc(p.name)}</b><span class="k">Level ${L.level} · ${L.into}/${L.need} XP</span><div class="xpbar"><i style="width:${L.level >= Core.MAX_LEVEL ? 100 : (100 * L.into / L.need)}%"></i></div></div>
      <span class="coins">${p.coins}</span>`;
    $('#journal-count').textContent = Object.keys(p.journal).length + ' / ' + SPECIES.length + ' species documented';
  }

  function regionBg(r) { return `linear-gradient(180deg, ${r.sky[0]} 0%, ${r.sky[1]} 45%, ${r.sky[2]} 62%, ${r.hills[1]} 63%, ${r.hills[2]} 80%, ${r.ground[0]} 81%, ${r.ground[1]} 100%)`; }
  function renderRegions() {
    const L = levelInfo().level;
    $('#region-list').innerHTML = DB.REGIONS.map(r => {
      const sp = DB.inRegion(r.id), found = sp.filter(s => Core.profile.journal[s.id]).length, ok = L >= r.unlock;
      return `<button class="region ${ok ? '' : 'locked'}" data-region="${r.id}" ${ok ? '' : 'disabled'}>
        <div class="rimg" style="background:${regionBg(r)}"></div>
        <div class="rb"><b>${r.name}</b><small>${r.blurb}</small>
        <div class="rm"><span>${ok ? found + ' / ' + sp.length + ' species' : '🔒 Level ' + r.unlock}</span><span>${ok ? 'Survey →' : ''}</span></div></div></button>`;
    }).join('');
    $$('#region-list .region').forEach(b => b.onclick = () => { if (!b.disabled) { ui(); startSolo(b.dataset.region); } });
  }

  // ---------------- journal ----------------
  function renderJournal() {
    const J = Core.profile.journal, f = App.journalFilter;
    const filters = [['all', 'All'], ['Bird', 'Birds'], ['Mammal', 'Mammals'], ['Reptile', 'Reptiles'], ...DB.REGIONS.map(r => [r.id, r.name]), ['threat', 'Threatened']];
    $('#journal-filters').innerHTML = filters.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
    $$('#journal-filters .chip').forEach(c => c.onclick = () => { App.journalFilter = c.dataset.f; renderJournal(); });
    const list = SPECIES.filter(s => f === 'all' || s.cls === f || s.region === f || (f === 'threat' && DB.THREATENED.includes(s.status)));
    $('#journal-progress').textContent = Object.keys(J).length + ' / ' + SPECIES.length + ' documented · ' + Core.profile.stats.catches + ' records';
    $('#journal-grid').innerHTML = list.map(s => {
      const e = J[s.id];
      return `<button class="jt ${e ? '' : 'unk'}" data-id="${s.id}"><img alt="" src="${Art.portrait(s, e ? { w: 240 } : { w: 240, sil: '#283028' })}">
        <div class="jb"><b>${e ? s.name : 'Undocumented'}</b><i>${e ? s.sci : DB.region(s.region).name}</i><div class="jc">${e ? e.count + ' record' + (e.count > 1 ? 's' : '') : (DB.RARITY[s.rarity].label)}</div></div></button>`;
    }).join('');
    $$('#journal-grid .jt').forEach(b => b.onclick = () => {
      const sp = DB.byId[b.dataset.id], e = J[sp.id];
      if (!e) { toast(`Not yet documented. Found in ${DB.region(sp.region).name}${unlocked(DB.region(sp.region)) ? '' : ' (unlocks at level ' + DB.region(sp.region).unlock + ')'}.`); return; }
      ui(); showCard({ sp, ind: e.last[0] }, { journal: true });
    });
  }

  // ---------------- outfitter ----------------
  function renderOutfitter() {
    const p = Core.profile, L = levelInfo().level, st = Core.loadoutStats(p.upgrades);
    $('#of-coins').textContent = p.coins;
    let html = `<div class="stats"><div class="stat"><span class="k">Launch</span><b>${Math.round(46 * st.speed / 1120)} m/s</b></div><div class="stat"><span class="k">Impact</span><b>${st.damage.toFixed(2)}</b></div><div class="stat"><span class="k">Pellets</span><b>${st.pellets}</b></div><div class="stat"><span class="k">Reload</span><b>${st.cooldown.toFixed(2)} s</b></div></div>`;
    for (const [key, u] of Object.entries(Core.UPGRADES)) {
      const cur = p.upgrades[key], next = u.tiers[cur + 1];
      const btn = next ? (L < next.lvl ? `<button class="btn" disabled>Level ${next.lvl}</button>` : `<button class="btn ${p.coins >= next.cost ? 'primary' : ''}" data-up="${key}" ${p.coins >= next.cost ? '' : 'disabled'}>◈ ${next.cost}</button>`) : `<span class="muted small">Max tier</span>`;
      html += `<div class="up"><div><b>${u.name}</b> · <span class="cur">${u.tiers[cur].label}</span><br><small>${u.desc}${next ? ' Next: ' + next.label + '.' : ''}</small>
        <div class="ut">${u.tiers.map((t, i) => `<i class="${i <= cur ? 'on' : ''}"></i>`).join('')}</div></div><div>${btn}</div></div>`;
    }
    $('#of-list').innerHTML = html;
    $$('#of-list [data-up]').forEach(b => b.onclick = () => {
      const k = b.dataset.up, t = Core.UPGRADES[k].tiers[p.upgrades[k] + 1];
      if (p.coins < t.cost) return; p.coins -= t.cost; p.upgrades[k]++; Core.save(); ui(); toast(Core.UPGRADES[k].name + ' upgraded · ' + t.label, 'gold'); renderOutfitter();
    });
  }

  // ---------------- plugins ----------------
  function renderPlugins() {
    $('#plugin-list').innerHTML = Plugins.list.map(p => {
      const on = Plugins.enabled(p.id), panel = on && p.panel ? safePanel(p) : '';
      return `<div class="plug"><div class="pt"><div class="pic">${p.icon || '•'}</div><div class="pd"><b>${esc(p.name)}</b> ${p.gameplay ? '<span class="tag">synced</span>' : ''}<small>${esc(p.description)}</small></div>
        <label class="switch"><input type="checkbox" data-plug="${p.id}" ${on ? 'checked' : ''}><span></span></label></div>${panel ? `<div class="pp">${panel}</div>` : ''}</div>`;
    }).join('') + `<h4>Write your own</h4><pre class="code">registerPlugin({
  id: 'bounty', name: 'Bounty Board', icon: '$',
  description: 'Double credits for kingfishers.',
  onCatch({ rec }, api) {
    if (rec.sp.family === 'Alcedinidae') {
      api.profile.coins += 10; api.save();
      api.ui.toast('Bounty paid · +10 credits', 'gold');
    }
  },
});</pre><p class="muted small">Drop the file in <code>js/plugins/</code> and add a &lt;script&gt; tag after <code>plugins-builtin.js</code>. Full hook list in README.md.</p>`;
    $$('#plugin-list [data-plug]').forEach(i => i.onchange = () => { Plugins.setEnabled(i.dataset.plug, i.checked); ui(); renderPlugins(); App.game.bg = null; });
  }
  function safePanel(p) { try { return p.panel(api) || ''; } catch (e) { console.error(e); return ''; } }

  // ---------------- settings ----------------
  function renderSettings() {
    const s = Core.profile.settings;
    $('#set-name').value = Core.profile.name; $('#set-vol').value = s.volume; $('#set-traj').checked = s.trajectory; $('#set-auto').checked = !!s.autoReload; $('#set-motion').checked = s.reducedMotion; $('#set-quality').value = s.quality; $('#set-sens').value = s.sensitivity || 1;
  }
  function bindSettings() {
    $('#set-name').onchange = e => { Core.profile.name = (e.target.value.trim() || 'Ranger').slice(0, 20); Core.save(); };
    $('#set-vol').oninput = e => { Core.profile.settings.volume = +e.target.value; Core.save(); };
    $('#set-vol').onchange = () => ui();
    $('#set-traj').onchange = e => { Core.profile.settings.trajectory = e.target.checked; Core.save(); };
    $('#set-auto').onchange = e => { Core.profile.settings.autoReload = e.target.checked; Core.save(); };
    $('#set-sens').oninput = e => { Core.profile.settings.sensitivity = +e.target.value; Core.save(); };
    $('#set-motion').onchange = e => { Core.profile.settings.reducedMotion = e.target.checked; Core.save(); };
    $('#set-quality').onchange = e => { Core.profile.settings.quality = e.target.value; Core.save(); App.game.resize(); };
    $('#set-reset').onclick = () => { if (confirm('Erase all progress, journal entries, badges and settings on this device?')) { Core.reset(); location.reload(); } };
  }

  // ---------------- center messages ----------------
  function centerMsg(html, dim) {
    const el = $('#center-msg');
    if (!html) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML = html; el.classList.toggle('dim', !!dim); el.classList.remove('hidden');
  }

  // ---------------- solo ----------------
  function startSolo(regionId) {
    const r = DB.region(regionId); Core.profile.lastRegion = regionId; Core.save();
    App.game.idle(regionId);
    showHud('solo'); $('#h-region').textContent = r.name;
    updateSoloHud();
    centerMsg(`<div class="cm-k">Expedition</div><div class="cm-t">${r.name}</div><div class="cm-s">Eight minutes in the forest. Stalk, subdue and tag as many animals as you can.<br><span class="muted">WASD move · mouse look · hold Space to draw · C crouch</span></div>`);
    const dailyP = Plugins.byId.daily;
    if (Plugins.enabled('daily') && dailyP) { const d = dailyP.target(); if (d.sp.region === regionId && Plugins.data('daily').done !== d.day) { $('#target').classList.remove('hidden'); $('#t-title').textContent = 'Daily: ' + d.sp.name; $('#t-sub').textContent = d.sp.sci + ' · +100 XP'; } }
    setTimeout(() => { centerMsg(null); App.game.startSolo(regionId, 480); }, 1800);
  }
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateSoloHud() {
    const g = App.game, L = levelInfo();
    $('#h-time').textContent = fmtTime(g.mode === 'solo' ? g.duration - g.clock : 480);
    $('#h-catches').textContent = g.session ? g.session.catches.length : 0;
    $('#h-score').textContent = g.session ? g.session.score : 0;
    $('#h-lvl').textContent = L.level; $('#h-xp').style.width = (100 * L.into / L.need) + '%';
  }
  function pause(on) {
    const g = App.game; if (g.mode !== 'solo' || !g.live) return;
    if (on && App.curCard) return;
    g.paused = on; $('#pause').classList.toggle('hidden', !on);
    if (on) g.unlock(); else g.lock();
  }
  function endExpedition() {
    const g = App.game, s = g.session; g.endLive();
    Core.profile.stats.expeditions++; Core.save();
    const summary = { score: s.score, catches: s.catches, region: s.region, shots: s.shots, hits: s.hits, bestStreak: s.bestStreak };
    Plugins.emit('onExpeditionEnd', { summary, game: g });
    hideHud(); g.ambient(s.region); go('summary');
    const acc = s.shots ? Math.round(100 * s.hits / s.shots) : 0;
    $('#summary-body').innerHTML = `<div class="k">Expedition report · ${esc(DB.region(s.region).name)}</div><h2 class="sum-h">${s.catches.length} animal${s.catches.length === 1 ? '' : 's'} documented</h2>
      <div class="stats"><div class="stat"><span class="k">Score</span><b>${s.score}</b></div><div class="stat"><span class="k">Accuracy</span><b>${acc}%</b></div><div class="stat"><span class="k">Best streak</span><b>${s.bestStreak}</b></div><div class="stat"><span class="k">Rank</span><b>${summary.rank ? '#' + summary.rank : '—'}</b></div></div>
      <div class="sumlist">${s.catches.map(c => `<div class="si"><img src="${Art.portrait(c.sp, { w: 120, gender: c.ind.gender })}" alt=""><span>${esc(c.sp.name)} · ${c.ind.gender === 'male' ? '♂' : '♀'} ${DB.fmtWeight(c.ind.weight)}</span></div>`).join('') || '<span class="muted">No records this time. Lead moving targets and mind the wind.</span>'}</div>
      <div class="btnrow"><button class="btn primary" id="sum-again">Survey again</button><button class="btn" id="sum-journal">Field Journal</button><button class="btn ghost" id="sum-menu">Main menu</button></div>`;
    $('#sum-again').onclick = () => { ui(); startSolo(s.region); };
    $('#sum-journal').onclick = () => { ui(); App.game.ambient(s.region); go('journal'); };
    $('#sum-menu').onclick = () => { ui(); toMenu(); };
  }

  // ---------------- catches ----------------
  function recordCatch(rec) {
    const p = Core.profile, g = App.game, sp = rec.sp;
    const before = levelInfo().level;
    const isNew = !p.journal[sp.id];
    let xp = DB.RARITY[sp.rarity].xp; if (isNew) xp = Math.round(xp * 1.5);
    if (g.mode === 'vs') xp = Math.round(xp * 0.5);
    xp = Plugins.reduce('modifyXp', xp, { rec, game: g });
    const coins = DB.RARITY[sp.rarity].coins;
    p.xp += xp; p.coins += coins; p.stats.catches++; p.records = (p.records || 0) + 1;
    const e = p.journal[sp.id] || (p.journal[sp.id] = { count: 0, first: Date.now(), males: 0, females: 0, heaviest: 0, lightest: Infinity, last: [] });
    e.count++; e[rec.ind.gender === 'male' ? 'males' : 'females']++;
    e.heaviest = Math.max(e.heaviest, rec.ind.weight); e.lightest = Math.min(e.lightest, rec.ind.weight);
    e.last.unshift({ gender: rec.ind.gender, weight: rec.ind.weight, at: rec.at, region: rec.region }); e.last = e.last.slice(0, 8);
    Core.save();
    if (g.session) { g.session.score += xp; g.session.catches.push(rec); }
    Plugins.emit('onCatch', { rec, xp, isNew, entry: e, game: g });
    const after = levelInfo().level;
    if (after > before) {
      const reg = DB.REGIONS.find(r => r.unlock > before && r.unlock <= after);
      toast('Level ' + after + ' reached' + (reg ? ' · ' + reg.name + ' unlocked' : ''), 'gold');
    }
    return { xp, coins, isNew, recordNo: p.records, levelUp: after > before };
  }

  function onCatch(rec) {
    const g = App.game;
    const res = recordCatch(rec);
    if (g.mode === 'solo') { g.paused = true; g.unlock(); showCard(rec, res); updateSoloHud(); }
    else if (g.mode === 'vs') { miniCard(rec); VS.reportCatch(rec); }
  }

  function statusBadge(code) { const s = DB.STATUS[code]; return `<span class="iucn"><i style="background:${s.color}">${code}</i>${s.label}</span>`; }
  function showCard(rec, opts) {
    const sp = rec.sp, ind = rec.ind, reg = DB.region(sp.region), journal = opts.journal, e = Core.profile.journal[sp.id];
    App.curCard = rec;
    const port = Art.portrait(sp, { gender: ind.gender, w: 520 });
    const fb = (window.WIKI_FALLBACK || {})[sp.wiki] || {};
    const sex = ind.gender === 'male' ? '♂ Male' : '♀ Female';
    const L = levelInfo();
    $('#card').innerHTML = `
      <div class="ch"><span class="rec">${journal ? 'FIELD JOURNAL ENTRY' : 'FIELD RECORD Nº ' + String(opts.recordNo || 0).padStart(4, '0')}</span><span>${esc(DB.region(rec.region || sp.region).name)} · ${Core.sgTime(new Date(ind.at || rec.at || Date.now()))}</span></div>
      <div class="cbody">
        <div class="cimg"><img id="card-img" alt="${esc(sp.name)}" src="${port}"><span class="cap" id="card-cap">Field illustration</span>
          ${journal ? '' : `<span class="stamp ${opts.isNew ? 'new' : ''}">${opts.isNew ? 'NEW SPECIES' : 'TAGGED · RELEASED'}</span>`}</div>
        <div class="cinfo">
          <h3 class="cname">${esc(sp.name)}</h3><div class="csci">${esc(sp.sci)}</div>
          <div class="cgrid">
            <div><span class="k">Class</span><b>${sp.cls === 'Bird' ? 'Aves (bird)' : sp.cls === 'Mammal' ? 'Mammalia (mammal)' : 'Reptilia (reptile)'}</b></div>
            <div><span class="k">Family</span><b>${esc(sp.family)}</b><br><small class="muted">${esc(sp.familyCommon)}</small></div>
            ${journal ? `<div><span class="k">Records</span><b>${e.count} · ♂ ${e.males} / ♀ ${e.females}</b></div><div><span class="k">Heaviest / lightest</span><b>${DB.fmtWeight(e.heaviest)} / ${DB.fmtWeight(e.lightest)}</b></div>`
              : `<div><span class="k">Sex</span><b>${sex}</b></div><div><span class="k">Weight · this individual</span><b class="mono">${DB.fmtWeight(ind.weight)}</b></div>`}
            <div class="span2"><span class="k">Adult weight range (species)</span><b>${DB.fmtRange(sp)}</b></div>
            <div><span class="k">Conservation (IUCN)</span><b>${statusBadge(sp.status)}</b></div>
            <div><span class="k">Rarity in game</span><b><span class="rbar" style="background:${DB.RARITY[sp.rarity].color}"></span>${DB.RARITY[sp.rarity].label}</b></div>
            <div class="span2"><span class="k">Habitat & range</span><b style="font-weight:500">${esc(sp.habitat)}</b></div>
          </div>
          <p class="cintro" id="card-intro">${esc(fb.intro || '')}</p>
          <div class="csrc">Source: <a id="card-src" href="${Core.wikiUrl(sp.wiki)}" target="_blank" rel="noopener">Wikipedia — ${esc(sp.wiki)}</a><span id="card-live" class="muted">· loading live entry…</span></div>
        </div>
      </div>
      <div class="cfoot">
        <div class="reward">${journal ? `First documented ${Core.sgTime(new Date(e.first))}` : `+${opts.xp} XP &nbsp;◈ +${opts.coins}<span>Level ${L.level} · ${L.into}/${L.need}</span>`}</div>
        <div class="btnrow" style="margin:0"><button class="btn primary" id="card-close">${journal ? 'Close' : 'Release & continue'}</button></div>
      </div>`;
    $('#card-wrap').classList.remove('hidden');
    $('#card-close').onclick = closeCard; $('#card-close').focus({ preventScroll: true });
    Core.wiki(sp).then(w => {
      if (App.curCard !== rec) return;
      if (w.intro) $('#card-intro').textContent = w.intro;
      $('#card-src').href = w.url;
      $('#card-live').textContent = w.live ? (w.cached ? '· live entry (cached)' : '· live entry') : '· offline copy';
      if (w.thumb) {
        const im = new Image(); im.referrerPolicy = 'no-referrer';
        im.onload = () => { if (App.curCard !== rec) return; $('#card-img').src = w.thumb; $('#card-cap').textContent = 'Photo: Wikipedia / Wikimedia Commons'; };
        im.src = w.thumb;
      }
    });
  }
  function closeCard() {
    ui(); App.curCard = null; $('#card-wrap').classList.add('hidden');
    const g = App.game; if (g.mode === 'solo' && g.live && !App.toJournalAfter) { g.paused = false; g.lock(); }
  }
  function miniCard(rec) {
    const t = VS.match && VS.match.target, ok = t ? VSTargets.matches(t, rec.sp, rec.ind) : false;
    const el = $('#mini-card');
    el.innerHTML = `<img src="${Art.portrait(rec.sp, { w: 200, gender: rec.ind.gender })}" alt=""><div class="mb"><b>${esc(rec.sp.name)}</b><i class="muted">${esc(rec.sp.sci)}</i><br>${rec.ind.gender === 'male' ? '♂ Male' : '♀ Female'} · <span class="mono">${DB.fmtWeight(rec.ind.weight)}</span> · ${rec.sp.cls}<div class="verdict ${ok ? 'ok' : ''}" style="color:${ok ? 'var(--sage)' : '#e59a85'}">${ok ? '✓ Matches objective' : '✗ Not the objective · −1'}</div></div>`;
    el.classList.remove('hidden'); clearTimeout(App.miniT); App.miniT = setTimeout(() => el.classList.add('hidden'), 3400);
  }

  // ---------------- VS lobby ----------------
  function renderVsLobby() {
    $('#lb-me').textContent = Core.profile.name; $('#lb-me-l').textContent = 'Lv ' + levelInfo().level + (VS.peer ? (VS.isHost ? ' · host' : ' · guest') : '');
    const rules = Plugins.gameplayRules();
    $('#vs-rules').innerHTML = 'Synced plugins for this match: ' + Object.entries(rules).map(([k, v]) => `${esc(Plugins.byId[k].name)} <b>${v ? 'on' : 'off'}</b>`).join(' · ') + '. Change them in Plugins.';
    lobbyPlayers();
  }
  function lobbyPlayers() {
    const connected = VS.conn && VS.conn.open && VS.oppName;
    $('#lb-opp').textContent = connected ? VS.oppName : 'Waiting…'; $('#lb-opp').classList.toggle('muted', !connected);
    $('#lb-opp-l').textContent = connected ? 'Lv ' + VS.oppLevel : '';
    $('#vs-start').classList.toggle('hidden', !(connected && VS.isHost));
  }
  function setStatus(t, err) { const el = $('#vs-status'); el.textContent = t; el.classList.toggle('err', !!err); }
  function shareLink(code) { return location.origin + location.pathname + '#join=' + code; }
  function bindVs() {
    $$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('on', x === t)); $('#vs-host').classList.toggle('hidden', t.dataset.tab !== 'host'); $('#vs-join').classList.toggle('hidden', t.dataset.tab !== 'join'); });
    $('#vs-back').onclick = () => { ui(); VS.leave(); $('#vs-room').classList.add('hidden'); setStatus('Not connected.'); go('menu'); };
    $('#vs-create').onclick = () => { ui(); VS.host({ rounds: +$('#vs-rounds').value, rules: Plugins.gameplayRules() }); };
    $('#vs-rounds').onchange = () => { if (VS.isHost && VS.peer) VS.updateSettings(+$('#vs-rounds').value, Plugins.gameplayRules()); };
    $('#vs-joinbtn').onclick = () => { const c = $('#vs-joincode').value.trim().toUpperCase(); if (c.length < 4) return setStatus('Enter the 5-character room code.', true); ui(); VS.join(c); };
    $('#vs-joincode').onkeydown = e => { if (e.key === 'Enter') $('#vs-joinbtn').click(); };
    $('#vs-copy').onclick = async () => { const l = shareLink(VS.code); try { await navigator.clipboard.writeText(l); toast('Challenge link copied'); } catch (e) { $('#vs-link').select(); document.execCommand('copy'); toast('Challenge link copied'); } };
    $('#vs-share').onclick = async () => { const l = shareLink(VS.code); if (navigator.share) { try { await navigator.share({ title: 'Slingshot Safari challenge', text: `${Core.profile.name} challenges you to a Slingshot Safari match. Room ${VS.code}.`, url: l }); } catch (e) { } } else $('#vs-copy').click(); };
    $('#vs-start').onclick = () => { ui(); VS.updateSettings(+$('#vs-rounds').value, Plugins.gameplayRules()); VS.startMatch(); };

    VS.on('status', t => setStatus(t));
    VS.on('error', t => { setStatus(t, true); toast(t, 'err'); });
    VS.on('hosted', ({ code }) => { $('#vs-room').classList.remove('hidden'); $('#vs-code').textContent = code; $('#vs-link').value = shareLink(code); renderVsLobby(); });
    VS.on('lobby', d => { lobbyPlayers(); setStatus(VS.isHost ? `${VS.oppName} joined. Start when ready.` : `Joined ${VS.oppName}'s room · best of ${VS.rounds}. Waiting for the host to start…`); if (VS.isHost) toast(VS.oppName + ' joined your room'); renderVsLobby(); });
    VS.on('latency', ms => { $('#v-ping').textContent = ms + ' ms'; });
    VS.on('disconnect', () => {
      setStatus('Opponent disconnected.', true); lobbyPlayers();
      if (App.game.mode === 'vs' || (VS.match && !VS.match.over)) { App.game.endLive(); centerMsg(`<div class="cm-k">Connection lost</div><div class="cm-t">Opponent left</div><div class="cm-btns"><button class="btn primary" id="cm-menu">Back to menu</button></div>`, true); $('#cm-menu').onclick = () => { VS.leave(); toMenu(); }; }
    });
    VS.on('matchStart', M => {
      go('vs'); showHud('vs'); App.game.idle(App.game.region.id);
      $('#v-me').textContent = Core.profile.name; $('#v-opp').textContent = VS.oppName || 'Opponent';
      updateVsHud(); $('#feed').innerHTML = '';
      centerMsg(`<div class="cm-k">Match</div><div class="cm-t">${esc(Core.profile.name)} <span class="muted">vs</span> ${esc(VS.oppName || '')}</div><div class="cm-s">Best of ${M.rounds}. Same wildlife on both screens — read the objective and be first.</div>`);
    });
    VS.on('roundStart', d => {
      App.lastVsTarget = d.target; App.game.idle(d.region);
      App.game.removeAvatar();
      $('#target').classList.remove('hidden'); $('#t-title').textContent = d.desc.title; $('#t-sub').textContent = d.desc.sub + ' · ' + DB.region(d.region).name;
      updateVsHud(); $('#v-round').textContent = `Round ${d.round} / ${d.rounds}`; $('#v-time').textContent = fmtTime(d.duration);
      const t0 = performance.now();
      const tick = () => {
        const left = d.delay - (performance.now() - t0);
        if (left <= 0) { centerMsg(null); App.game.startVsRound(d.cfg); return; }
        centerMsg(`<div class="cm-k">Round ${d.round} of ${d.rounds} · ${esc(DB.region(d.region).name)}</div><div class="cm-t">${esc(d.desc.title)}</div><div class="cm-s">${esc(d.desc.sub)}</div><div class="cm-n">${Math.ceil(left / 1000)}</div>`);
        App.cdT = setTimeout(tick, 100);
      };
      clearTimeout(App.cdT); tick();
    });
    VS.on('pos', p => { if (p && App.game.mode === 'vs' && App.game.live) App.game.setOpponent(p, VS.oppName); });
    VS.on('oppStun', m => { if (App.game.vs && App.game.vs.round === m.r) App.game.remoteStun(m.idx, m.x, m.z); });
    VS.on('oppTagged', m => { if (App.game.vs && App.game.vs.round === m.r) App.game.remoteRemove(m.idx); });
    VS.on('score', ({ event }) => {
      updateVsHud();
      if (event) {
        const mine = event.who === VS.me(), sp = DB.byId[event.sp];
        const f = document.createElement('div'); f.className = 'fe ' + (mine ? 'me' : 'opp');
        f.innerHTML = `${esc(mine ? 'You' : VS.oppName)}: ${esc(sp.name)} ${event.gender === 'male' ? '♂' : '♀'} ${DB.fmtWeight(event.weight)} <span class="${event.ok ? 'good' : 'bad'}">${event.ok ? '✓' : '−1'}</span>`;
        $('#feed').prepend(f); while ($('#feed').children.length > 5) $('#feed').lastChild.remove();
        const plate = $(mine ? '.plate.me' : '.plate.opp'); plate.classList.remove('flash'); void plate.offsetWidth; plate.classList.add('flash');
        if (!event.ok && mine) Plugins.emit('onWrong', {});
      }
    });
    VS.on('roundEnd', m => {
      App.game.endLive(); clearTimeout(App.cdT); updateVsHud();
      const won = m.winner === VS.me(), lost = m.winner && !won;
      Plugins.emit('onRoundEnd', { won, winner: m.winner, round: m.r });
      centerMsg(`<div class="cm-k">Round ${m.r} · ${m.reason === 'time' ? 'Time' : 'Objective complete'}</div><div class="cm-t">${won ? 'Round won' : lost ? esc(VS.oppName) + ' takes it' : 'No winner'}</div><div class="cm-s">${scoreLine()}</div>`, true);
    });
    VS.on('matchEnd', m => {
      App.game.endLive(); updateVsHud();
      const me = VS.me(), won = m.winner === me, draw = !m.winner, s = m.scores;
      Core.profile.stats.vsMatches++; if (won) Core.profile.stats.vsWins++; Core.save();
      Plugins.emit('onMatchEnd', { result: { me: Core.profile.name, opp: VS.oppName, myPts: s[me].pts, oppPts: s[VS.them()].pts, outcome: won ? 'win' : draw ? 'draw' : 'loss' } });
      centerMsg(`<div class="cm-k">Match complete</div><div class="cm-t">${won ? 'Victory' : draw ? 'Draw' : 'Defeat'}</div><div class="cm-s">${scoreLine()}</div>
        <div class="cm-btns">${VS.isHost ? '<button class="btn primary" id="cm-rematch">Rematch</button>' : '<span class="muted small">Waiting for host to offer a rematch…</span>'}<button class="btn" id="cm-leave">Leave</button></div>`, true);
      const rb = $('#cm-rematch'); if (rb) rb.onclick = () => { ui(); centerMsg(null); VS.rematch(); };
      $('#cm-leave').onclick = () => { ui(); VS.leave(); toMenu(); };
    });
  }
  function scoreLine() {
    const M = VS.match; if (!M) return ''; const a = M.scores[VS.me()], b = M.scores[VS.them()];
    return `You ${a.pts} pts (${a.wins} rd${a.wins === 1 ? '' : 's'}) · ${esc(VS.oppName || 'Opponent')} ${b.pts} pts (${b.wins} rd${b.wins === 1 ? '' : 's'})`;
  }
  function updateVsHud() {
    const M = VS.match; if (!M) return;
    const a = M.scores[VS.me()], b = M.scores[VS.them()], n = (M.target && M.target.count) || 1;
    $('#v-me-pts').textContent = a.pts; $('#v-me-wins').textContent = a.wins; $('#v-opp-pts').textContent = b.pts; $('#v-opp-wins').textContent = b.wins;
    $('#v-me-prog').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < a.prog ? 'on' : ''}"></i>`).join('');
    $('#v-opp-prog').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < b.prog ? 'on' : ''}"></i>`).join('');
  }

  function updateAmmo() {
    const g = App.game, st = $('#am-state');
    const state = g.reloadT > 0 ? 'Reloading…' : g.loaded ? 'Loaded' : 'Empty';
    if (st.textContent !== state) { st.textContent = state; st.className = g.loaded ? 'ok' : g.reloadT > 0 ? '' : 'bad'; }
    const n = g.pouch || 0; $('#am-count').textContent = n;
    const pips = Math.min(n, 24); const el = $('#am-pips');
    if (+el.dataset.n !== pips) { el.dataset.n = pips; el.innerHTML = '<i></i>'.repeat(pips); }
    $('#btn-reload').classList.toggle('hot', !g.loaded && g.reloadT <= 0 && n > 0);
    const info = App.hudInfo || {};
    $('#btn-gather').classList.toggle('hot', !!(info.nearPile || info.nearStunned));
    $('#btn-gather span').textContent = info.nearStunned ? 'Tag' : 'Gather';
    $('#ammo').classList.toggle('low', n <= 3);
  }

  // ---------------- first-person HUD: crosshair, prompt, compass, minimap ----------------
  let hintT = 0;
  function hint(t) { const now = performance.now(); if (now - hintT < 900) return; hintT = now; toast(t); }
  const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function hudLoop() {
    requestAnimationFrame(hudLoop);
    const g = App.game; if (!(g.mode === 'solo' || g.mode === 'vs') || $('#hud').classList.contains('hidden')) return;
    const info = App.hudInfo = g.hudInfo();
    const ch = $('#crosshair'); ch.classList.toggle('aimed', info.aimed); ch.classList.toggle('drawing', !!g.draw); ch.classList.toggle('zoom', g.steady);
    $('#ch-ring').style.strokeDashoffset = String(113 * (1 - info.power));
    const pr = $('#prompt'); pr.classList.toggle('hidden', !info.prompt || !g.live); if (info.prompt) $('#prompt-t').textContent = info.prompt;
    $('#stance').classList.toggle('hidden', !info.crouch || !g.live);
    $('#lockhint').classList.toggle('hidden', !(g.live && !g.paused && !g.locked && !isTouch() && !App.curCard));
    drawCompass(g); drawMinimap(g);
  }
  function headingDeg(yaw) { return ((-yaw * 180 / Math.PI) % 360 + 360) % 360; } // 0 = north (−Z)
  function drawCompass(g) {
    const c = $('#compass-c'), x = c.getContext('2d'), W = c.width, H = c.height, hd = headingDeg(g.player.yaw);
    x.clearRect(0, 0, W, H); x.textAlign = 'center'; x.textBaseline = 'middle';
    const ppd = W / 120; // 120° visible
    for (let d = Math.floor((hd - 62) / 5) * 5; d <= hd + 62; d += 5) {
      const px = W / 2 + (d - hd) * ppd, dd = ((d % 360) + 360) % 360;
      if (dd % 45 === 0) { x.fillStyle = dd === 0 ? '#e0b866' : '#e8e4d8'; x.font = '600 13px Inter, sans-serif'; x.fillText(CARD[dd / 45], px, H / 2 + 1); }
      else { x.fillStyle = 'rgba(232,228,216,0.45)'; x.fillRect(px - 0.5, dd % 15 === 0 ? 9 : 13, 1, dd % 15 === 0 ? 16 : 8); }
    }
    // markers: opponent and subdued animals
    const mark = (wx, wz, col) => { const b = (Math.atan2(wx - g.player.pos.x, -(wz - g.player.pos.z)) * 180 / Math.PI + 360) % 360; let d = b - hd; d = ((d + 540) % 360) - 180; if (Math.abs(d) > 60) return; x.fillStyle = col; x.beginPath(); x.arc(W / 2 + d * ppd, 4, 3, 0, 7); x.fill(); };
    g.animals.forEach(a => { if (a.state === 'stunned') mark(a.pos.x, a.pos.z, '#e9cf86'); });
    if (g.avatar) mark(g.avatar.position.x, g.avatar.position.z, '#d08a66');
  }
  function drawMinimap(g) {
    const c = $('#minimap-c'), x = c.getContext('2d'), S = c.width, R = S / 2, scale = R / 60, P = g.player;
    x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(R, R, R - 1, 0, 7); x.clip();
    x.fillStyle = 'rgba(14,20,16,0.72)'; x.fillRect(0, 0, S, S);
    x.translate(R, R); x.rotate(P.yaw); // forward is always up
    const pt = (wx, wz) => [(wx - P.pos.x) * scale, (wz - P.pos.z) * scale];
    x.strokeStyle = 'rgba(200,162,90,0.35)'; x.lineWidth = 1.5; x.beginPath(); const [ex, ez] = pt(0, 0); x.arc(ex, ez, 158 * scale, 0, 7); x.stroke();
    for (const p of g.piles) { const [a, b] = pt(p.x, p.z); if (a * a + b * b > R * R) continue; x.fillStyle = p.dropped ? 'rgba(170,165,150,0.6)' : '#b9b3a2'; x.fillRect(a - 1.5, b - 1.5, 3, 3); }
    for (const an of g.animals) {
      if (an.state !== 'stunned' && an.state !== 'tagging') continue;
      const [a, b] = pt(an.pos.x, an.pos.z); x.fillStyle = '#e9cf86'; x.beginPath(); x.arc(a, b, 3.5, 0, 7); x.fill();
    }
    if (g.avatar) { const [a, b] = pt(g.avatar.position.x, g.avatar.position.z); x.fillStyle = '#d08a66'; x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); }
    x.restore();
    x.fillStyle = '#7fb0c4'; x.beginPath(); x.moveTo(R, R - 7); x.lineTo(R - 5, R + 5); x.lineTo(R + 5, R + 5); x.closePath(); x.fill();
    x.fillStyle = '#e0b866'; x.font = '600 11px Inter, sans-serif'; x.textAlign = 'center';
    x.fillText('N', R + (R - 10) * Math.sin(P.yaw), R - (R - 10) * Math.cos(P.yaw) + 4);
  }
  function bindTouch() {
    const g = () => App.game, joy = $('#joy'), knob = $('#joy-k');
    let jid = null, jc = null;
    joy.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; move(e); });
    const move = e => { if (e.pointerId !== jid) return; let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const d = Math.hypot(dx, dy); if (d > jc.r) { dx *= jc.r / d; dy *= jc.r / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; g().touchMove.x = dx / jc.r; g().touchMove.y = -dy / jc.r; };
    joy.addEventListener('pointermove', move);
    const end = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; g().touchMove.x = 0; g().touchMove.y = 0; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    const fire = $('#t-fire');
    fire.addEventListener('pointerdown', e => { e.preventDefault(); g().touchMode = true; g().startDraw('touch'); fire.classList.add('on'); });
    const rel = e => { fire.classList.remove('on'); if (g().draw && g().draw.src === 'touch') g().releaseDraw(); };
    fire.addEventListener('pointerup', rel); fire.addEventListener('pointercancel', rel); fire.addEventListener('pointerleave', rel);
    $('#t-aim').addEventListener('pointerdown', e => { e.preventDefault(); g().steady = !g().steady; $('#t-aim').classList.toggle('on', g().steady); });
    $('#t-reload').addEventListener('pointerdown', e => { e.preventDefault(); g().startReload(); });
    $('#t-use').addEventListener('pointerdown', e => { e.preventDefault(); g().interact(); });
    $('#t-crouch').addEventListener('pointerdown', e => { e.preventDefault(); g().player.crouch = !g().player.crouch; $('#t-crouch').classList.toggle('on', g().player.crouch); });
  }

  // ---------------- boot ----------------
  function init() {
    const canvas = $('#stage');
    App.game = new Game(canvas);
    Plugins.setup(api);
    App.game.on('catch', onCatch);
    App.game.on('hint', t => hint(t));
    App.game.on('unlock', () => { const g = App.game; if (g.mode === 'solo' && g.live && !g.paused && !App.curCard) pause(true); });
    App.game.on('stun', a => { if (App.game.mode === 'vs' && VS.match) VS.send({ type: 'stun', r: VS.match.round, idx: a.idx, x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2) }); });
    App.game.on('timeup', () => { if (App.game.mode === 'solo') endExpedition(); });
    App.game.ambient(Core.profile.lastRegion || 'meadow');
    $$('[data-go]').forEach(b => b.addEventListener('click', () => {
      ui();
      if (b.dataset.go === 'resume') { b.dataset.go = 'menu'; App.toJournalAfter = false; $('#ui').style.display = 'none'; $$('.screen').forEach(s => s.classList.remove('on')); App.game.paused = false; return; }
      go(b.dataset.go);
    }));
    $('#btn-pause').onclick = () => {
      ui();
      if (App.game.mode === 'vs') { if (confirm('Leave this match?')) { VS.leave(); toMenu(); } return; }
      pause(true);
    };
    $('#p-resume').onclick = () => { ui(); pause(false); };
    $('#p-quit').onclick = () => { ui(); $('#pause').classList.add('hidden'); App.game.paused = false; endExpedition(); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (!$('#card-wrap').classList.contains('hidden')) { if (e.key === 'Escape') closeCard(); return; }
        if (App.game.mode === 'solo' && App.game.live && App.screen !== 'journal') pause(!App.game.paused);
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
    bindSettings(); bindVs();
    $('#btn-reload').addEventListener('pointerdown', e => { e.preventDefault(); App.game.startReload(); });
    $('#btn-gather').addEventListener('pointerdown', e => { e.preventDefault(); App.game.interact(); });
    bindTouch(); requestAnimationFrame(hudLoop);
    setInterval(() => {
      const g = App.game;
      if (g.mode === 'solo' || g.mode === 'vs') updateAmmo();
      if (g.mode === 'solo') updateSoloHud();
      if (g.mode === 'vs') $('#v-time').textContent = fmtTime(g.duration - g.clock);
      if (g.mode === 'vs' && g.live) VS.send({ type: 'pos', p: g.playerState() });
    }, 100);
    go('menu');
    // Challenge link: #join=CODE
    const m = location.hash.match(/join=([A-Za-z0-9]{4,8})/);
    if (m) {
      go('vs'); $$('.tab')[1].click(); $('#vs-joincode').value = m[1].toUpperCase();
      setStatus('Challenge link detected for room ' + m[1].toUpperCase() + '. Set your name in Settings if you like, then press Join.');
      history.replaceState(null, '', location.pathname);
      if (/autojoin/.test(location.search)) VS.join(m[1]);
    }
  }
  init();
})();
