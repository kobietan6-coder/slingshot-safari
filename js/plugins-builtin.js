/* Built-in plugins. Each one only uses the public plugin API (see README). */
(function () {
  const DB = SpeciesDB;

  // ---------------------------------------------------------------- Weather
  registerPlugin({
    id: 'weather', name: 'Field Weather', icon: '☂', gameplay: true, defaultEnabled: true,
    description: 'Crosswind and rain. Wind pushes pellets sideways; rain adds drag and shortens range. Synced in VS matches.',
    _start(game) {
      const r = game.envRng || Math.random;
      this.base = (r() * 2 - 1) * 0.75; this.gustPh = r() * 6; game.windDir = r() * Math.PI * 2;
      game.rain = r() < 0.35 ? 0.45 + r() * 0.5 : 0;
      this.drops = Array.from({ length: 160 }, () => ({ x: Math.random() * 1800, y: Math.random() * 720, l: 10 + Math.random() * 12 }));
    },
    onExpeditionStart(p) { this._start(p.game); }, onRoundStart(p) { this._start(p.game); },
    onUpdate({ game, dt }, api) {
      if (this.base === undefined) this._start(game);
      game.wind = this.base + Math.sin(game.clock * 0.35 + this.gustPh) * 0.2;
      if (game.is3d && (game.mode === 'solo' || game.mode === 'vs') && (this._hudT = (this._hudT || 0) - dt) <= 0) {
        this._hudT = 0.2;
        // direction the wind blows toward, relative to where the player faces
        const yawDeg = -game.player.yaw * 180 / Math.PI, toward = 90 + game.windDir * 180 / Math.PI + (game.wind < 0 ? 180 : 0);
        const rel = ((toward - yawDeg) % 360 + 360) % 360, arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
        const from = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((toward + 180) % 360) / 45)) % 8];
        api.hud.set('weather', `Wind ${(Math.abs(game.wind) * 9).toFixed(1)} m/s ${arrows[Math.round(rel / 45) % 8]} from ${from}${game.rain ? ' · Rain' : ''}`);
      }
      if (game.rain) for (const d of this.drops) { d.y += 900 * dt; d.x += game.wind * 80 * dt - 60 * dt; if (d.y > 720) { d.y = -20; d.x = Math.random() * (game.W + 200); } }
    },
    onRenderFront({ ctx, game }) {
      if (game.rain && this.drops) {
        ctx.strokeStyle = 'rgba(200,215,225,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
        for (const d of this.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3 + game.wind * 4, d.y + d.l); }
        ctx.stroke(); ctx.fillStyle = 'rgba(30,40,50,0.12)'; ctx.fillRect(0, 0, game.W, game.H);
      }
      if (!game.is3d && (game.mode === 'solo' || game.mode === 'vs')) {
        // wind gauge above the slingshot
        const x = game.anchor.x + 180, y = game.H - 30, w = game.wind;
        ctx.fillStyle = 'rgba(12,15,13,0.55)'; ctx.fillRect(x - 70, y - 11, 140, 22);
        ctx.strokeStyle = 'rgba(233,222,190,0.25)'; ctx.strokeRect(x - 70, y - 11, 140, 22);
        ctx.fillStyle = '#c8a25a'; const len = w * 50; ctx.fillRect(Math.min(x, x + len), y - 2, Math.abs(len), 4);
        ctx.beginPath(); ctx.moveTo(x + len + Math.sign(len) * 7, y); ctx.lineTo(x + len, y - 6); ctx.lineTo(x + len, y + 6); ctx.fill();
        ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(233,222,190,0.7)';
        ctx.fillText('WIND ' + (Math.abs(w) * 9).toFixed(1) + ' m/s' + (game.rain ? ' · RAIN' : ''), x - 66, y - 15);
      }
    },
    onDisable(p, api) { if (api.game) { api.game.wind = 0; api.game.rain = 0; } this.base = 0; },
  });

  // ---------------------------------------------------------------- Night
  registerPlugin({
    id: 'night', name: 'Night Survey', icon: '☾', gameplay: true, defaultEnabled: false,
    description: 'Moonlit scenes. Nocturnal species (civets, tapir, pangolin, owls) appear three times as often; +15% XP.',
    onExpeditionStart({ game }) { game.night = true; this.flies = null; },
    onRoundStart({ game }) { game.night = true; this.flies = null; },
    modifySpawnWeight(w, { sp }) { return sp.nocturnal ? w * 3 : w; },
    modifyXp(xp) { return Math.round(xp * 1.15); },
    onRenderFront({ ctx, game }) {
      if (!game.night || game.is3d) return; // the 3D engine renders moonlight, a head torch and fireflies itself
      if (!this.flies) this.flies = Array.from({ length: 26 }, () => ({ x: Math.random() * game.W, y: game.groundY - Math.random() * 200, p: Math.random() * 6 }));
      const t = game.t;
      for (const f of this.flies) {
        const a = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2 + f.p));
        const x = f.x + Math.sin(t * 0.5 + f.p) * 30, y = f.y + Math.cos(t * 0.7 + f.p) * 14;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(220,240,150,${a * 0.9})`); g.addColorStop(1, 'rgba(220,240,150,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
      }
      ctx.fillStyle = 'rgba(5,10,25,0.22)'; ctx.fillRect(0, 0, game.W, game.H);
    },
  });

  // ---------------------------------------------------------------- Daily assignment
  registerPlugin({
    id: 'daily', name: 'Daily Field Assignment', icon: '✦', defaultEnabled: true,
    description: 'One species per day (Singapore date) for everyone. Document it in a solo expedition for +100 XP.',
    target() {
      const day = Core.todayKey();
      const r = Core.mulberry32(Core.hashStr('daily-' + day));
      const pool = SPECIES.filter(s => s.rarity !== 'legendary');
      return { day, sp: pool[Math.floor(r() * pool.length)] };
    },
    onInit(_, api) { this.refresh(api); },
    onEnable(_, api) { this.refresh(api); },
    onDisable(_, api) { api.ui.menuNote('daily', null); },
    refresh(api) {
      const { day, sp } = this.target(), done = api.data('daily').done === day;
      const reg = DB.region(sp.region);
      api.ui.menuNote('daily', `<span class="note-k">Daily assignment</span><b>${sp.name}</b> <i>${sp.sci}</i> · ${reg.name} ${done ? '<span class="ok">✓ complete</span>' : '<span class="muted">+100 XP</span>'}`);
    },
    modifyXp(xp, { rec, game }) {
      const { day, sp } = this.target();
      if (game && game.mode === 'solo' && rec.sp.id === sp.id && Plugins.data('daily').done !== day) { this._pending = true; return xp + 100; }
      return xp;
    },
    onCatch(p, api) {
      if (this._pending) { this._pending = false; api.data('daily').done = Core.todayKey(); api.save(); api.ui.toast('Daily assignment complete · +100 XP', 'gold'); this.refresh(api); }
    },
    panel() {
      const { day, sp } = this.target(), done = Plugins.data('daily').done === day;
      return `<p>Today (${day}, SGT): <b>${sp.name}</b> — <i>${sp.sci}</i>, found in ${DB.region(sp.region).name}. ${done ? 'Completed.' : 'Not yet documented.'}</p>`;
    },
  });

  // ---------------------------------------------------------------- Achievements
  const BADGES = [
    { id: 'first', name: 'First Record', desc: 'Document your first animal.', test: s => s.catches >= 1 },
    { id: 'ten', name: 'Field Hand', desc: 'Document 10 animals.', test: s => s.catches >= 10 },
    { id: 'fifty', name: 'Seasoned Surveyor', desc: 'Document 50 animals.', test: s => s.catches >= 50 },
    { id: 'species10', name: 'Taxonomist', desc: 'Document 10 different species.', test: s => s.species >= 10 },
    { id: 'all', name: 'Complete Survey', desc: 'Document every species in the catalogue.', test: s => s.species >= SPECIES.length },
    { id: 'streak5', name: 'Marksman', desc: 'Land 5 hits in a row.', test: s => s.streak >= 5 },
    { id: 'feather', name: 'Featherweight', desc: 'Document an individual under 40 g.', test: s => s.lastW !== undefined && s.lastW < 0.04 },
    { id: 'heavy', name: 'Heavyweight', desc: 'Document an individual over 100 kg.', test: s => s.lastW > 100 },
    { id: 'threat', name: 'Conservation Record', desc: 'Document and release a threatened species.', test: s => s.lastThreat },
    { id: 'excep', name: 'Exceptional Find', desc: 'Document an exceptional-rarity species.', test: s => s.lastRarity === 'legendary' },
    { id: 'night', name: 'Night Shift', desc: 'Document a nocturnal species during a Night Survey.', test: s => s.nightNoct },
    { id: 'vswin', name: 'Head-to-Head', desc: 'Win a VS match.', test: s => s.vsWins >= 1 },
    { id: 'lvl10', name: 'Expedition Lead', desc: 'Reach level 10.', test: s => s.level >= 10 },
  ];
  registerPlugin({
    id: 'achievements', name: 'Achievements', icon: '◆', defaultEnabled: true,
    description: 'Thirteen field badges for milestones, marksmanship and rare finds.',
    check(api, extra) {
      const prof = Core.profile, d = api.data('achievements'); d.got = d.got || {};
      const s = Object.assign({ catches: prof.stats.catches, species: Object.keys(prof.journal).length, vsWins: prof.stats.vsWins, level: Core.levelFromXp(prof.xp).level }, extra || {});
      for (const b of BADGES) if (!d.got[b.id] && b.test(s)) { d.got[b.id] = Date.now(); api.ui.toast('Badge earned · ' + b.name, 'gold'); api.emit('onBadge', b); }
      api.save();
    },
    onCatch({ rec, game }, api) {
      this.check(api, { lastW: rec.ind.weight, lastThreat: DB.THREATENED.includes(rec.sp.status), lastRarity: rec.sp.rarity, nightNoct: !!(game && game.night && rec.sp.nocturnal) });
    },
    onHit({ streak }, api) { if (streak >= 5) this.check(api, { streak }); },
    onMatchEnd(p, api) { this.check(api); },
    panel() {
      const got = (Plugins.data('achievements').got) || {};
      return '<div class="badges">' + BADGES.map(b => `<div class="badge ${got[b.id] ? 'on' : ''}"><span class="bi">◆</span><div><b>${b.name}</b><small>${b.desc}</small></div></div>`).join('') + '</div>';
    },
  });

  // ---------------------------------------------------------------- Sound
  registerPlugin({
    id: 'sfx', name: 'Sound Design', icon: '♪', defaultEnabled: true,
    description: 'Synthesised Web Audio effects: band stretch, release, impact, tagging chime and match cues. No audio files.',
    ctx() {
      if (!this.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ac = new AC(); this.master = this.ac.createGain(); this.master.connect(this.ac.destination); }
      if (this.ac.state === 'suspended') this.ac.resume();
      this.master.gain.value = Core.profile.settings.volume * 0.7;
      return this.ac;
    },
    tone(f0, f1, dur, type, vol, delay) {
      const ac = this.ctx(); if (!ac) return; const t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, freq, vol, q) {
      const ac = this.ctx(); if (!ac) return; const t = ac.currentTime;
      const b = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    },
    onShot({ power }) { this.tone(180 + power * 120, 60, 0.18, 'triangle', 0.25); this.noise(0.08, 2400, 0.2, 0.8); },
    onHit() { this.tone(140, 70, 0.12, 'sine', 0.35); this.noise(0.06, 900, 0.25, 1.5); },
    onSubdue() { this.tone(660, 660, 0.18, 'sine', 0.12); this.tone(990, 990, 0.3, 'sine', 0.1, 0.12); },
    onCatch() { this.tone(523, 523, 0.25, 'triangle', 0.1); this.tone(784, 784, 0.4, 'triangle', 0.08, 0.1); },
    onRoundStart() { this.tone(220, 220, 0.5, 'sawtooth', 0.05); this.tone(330, 330, 0.6, 'sine', 0.08, 0.05); },
    onRoundEnd({ won }) { if (won) { this.tone(440, 440, 0.2, 'triangle', 0.12); this.tone(660, 660, 0.4, 'triangle', 0.1, 0.15); } else this.tone(300, 180, 0.5, 'sine', 0.1); },
    onReload() { this.noise(0.12, 1800, 0.12, 2); this.tone(1200, 900, 0.04, 'square', 0.03, 0.5); },
    onDryFire() { this.tone(1500, 1400, 0.03, 'square', 0.05); },
    onGather() { this.noise(0.18, 1200, 0.2, 1.2); this.noise(0.1, 2200, 0.12, 2); },
    onWrong() { this.tone(200, 120, 0.25, 'square', 0.05); },
    onUi() { this.tone(900, 700, 0.05, 'sine', 0.04); this.ambient(); },
    onStep({ crouch }) { this.ambient(); this.noise(crouch ? 0.07 : 0.1, 380 + Math.random() * 300, crouch ? 0.05 : 0.11, 0.9); },
    onAimStart() { this.ambient(); this.noise(0.25, 600, 0.12, 4); },
    // forest ambience: a filtered-noise wind bed plus occasional birdsong (day) or crickets (night)
    ambient() {
      const ac = this.ctx(); if (!ac || this.bed) return;
      const len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ac.createGain(); g.gain.value = 0.0; src.connect(f); f.connect(g); g.connect(this.master); src.start();
      this.bed = { src, g, f };
      this.amb = setInterval(() => {
        const game = window.App && App.game; if (!game || !Plugins.enabled('sfx')) { g.gain.value = 0; return; }
        const on = game.is3d && !game.paused && game.mode !== 'idle';
        g.gain.setTargetAtTime(on ? 0.05 + Math.abs(game.wind || 0) * 0.08 + (game.rain ? 0.05 : 0) : 0, ac.currentTime, 0.5);
        f.frequency.setTargetAtTime(game.rain ? 1400 : 500, ac.currentTime, 0.5);
        if (!on) return;
        if (game.night) { if (Math.random() < 0.5) for (let i = 0; i < 3; i++) this.tone(4200, 4100, 0.03, 'sine', 0.012, i * 0.06); }
        else if (Math.random() < 0.22) { const f0 = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) this.tone(f0 * (1 + (i % 2) * 0.12), f0 * 0.8, 0.08, 'sine', 0.02, i * 0.11); }
      }, 700);
    },
  });

  // ---------------------------------------------------------------- Leaderboard
  registerPlugin({
    id: 'leaderboard', name: 'Local Leaderboard', icon: '≡', defaultEnabled: true,
    description: 'Best expedition scores and recent VS results on this device.',
    onExpeditionEnd({ summary }, api) {
      const d = api.data('leaderboard'); d.solo = d.solo || [];
      d.solo.push({ name: Core.profile.name, score: summary.score, catches: summary.catches.length, region: summary.region, at: Date.now() });
      d.solo.sort((a, b) => b.score - a.score); d.solo = d.solo.slice(0, 10); api.save();
      summary.rank = d.solo.findIndex(e => e.score === summary.score && e.catches === summary.catches.length) + 1;
    },
    onMatchEnd({ result }, api) {
      const d = api.data('leaderboard'); d.vs = d.vs || [];
      d.vs.unshift({ me: result.me, opp: result.opp, myPts: result.myPts, oppPts: result.oppPts, outcome: result.outcome, at: Date.now() });
      d.vs = d.vs.slice(0, 10); api.save();
    },
    panel() {
      const d = Plugins.data('leaderboard'), esc = Core.escapeHtml;
      const solo = (d.solo || []).map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.catches}</td><td>${DB.region(e.region) ? DB.region(e.region).name : ''}</td></tr>`).join('') || '<tr><td colspan=5 class="muted">No expeditions yet</td></tr>';
      const vs = (d.vs || []).map(e => `<tr><td class="${e.outcome}">${e.outcome.toUpperCase()}</td><td>${esc(e.me)} ${e.myPts} – ${e.oppPts} ${esc(e.opp)}</td><td>${Core.sgTime(new Date(e.at))}</td></tr>`).join('') || '<tr><td colspan=3 class="muted">No matches yet</td></tr>';
      return `<h4>Expeditions</h4><table class="tbl"><tr><th>#</th><th>Ranger</th><th>Score</th><th>Records</th><th>Region</th></tr>${solo}</table><h4>VS history</h4><table class="tbl">${vs}</table>`;
    },
  });

  // ---------------------------------------------------------------- Marksman streak
  registerPlugin({
    id: 'streak', name: 'Marksman Streak', icon: '➶', defaultEnabled: true,
    description: 'Consecutive hits build a streak; solo catches earn +10% XP per streak step (max +50%). A miss resets it.',
    onHit({ streak }, api) { api.hud.set('streak', streak >= 2 ? `Streak ×${streak}` : null); },
    onMiss(p, api) { api.hud.set('streak', null); },
    onExpeditionStart(p, api) { api.hud.set('streak', null); },
    modifyXp(xp, { game }) { if (!game || game.mode !== 'solo' || !game.session) return xp; const k = Math.min(5, Math.max(0, game.session.streak - 1)); return Math.round(xp * (1 + k * 0.1)); },
  });
})();
