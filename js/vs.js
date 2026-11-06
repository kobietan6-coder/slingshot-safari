/* VS mode — peer-to-peer over WebRTC via PeerJS (public PeerJS cloud broker for signalling).
 * The host is authoritative: it generates round targets, judges every catch, and keeps the score.
 * Both players share a match seed, so spawns (species, sex, weight, timing) are identical on both screens.
 */
(function () {
  const DB = SpeciesDB;
  const PREFIX = 'slingshot-safari-v1-';
  const ROUND_TIME = 240;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  // ---------- targets ----------
  const plural = { Bird: 'birds', Mammal: 'mammals', Reptile: 'reptiles' };
  function couldMatch(t, sp) {
    const [lo, hi] = DB.overallRange(sp);
    switch (t.kind) {
      case 'species': case 'speciesGender': return sp.id === t.sp;
      case 'classWeight': return sp.cls === t.cls && hi > t.kg;
      case 'classCount': return sp.cls === t.cls;
      case 'family': return sp.family === t.family;
      case 'threatened': return DB.THREATENED.includes(sp.status);
      case 'weightUnder': return lo < t.kg;
    }
    return false;
  }
  function matches(t, sp, ind) {
    switch (t.kind) {
      case 'species': return sp.id === t.sp;
      case 'speciesGender': return sp.id === t.sp && ind.gender === t.gender;
      case 'classWeight': return sp.cls === t.cls && ind.weight > t.kg;
      case 'classCount': return sp.cls === t.cls;
      case 'family': return sp.family === t.family;
      case 'threatened': return DB.THREATENED.includes(sp.status);
      case 'weightUnder': return ind.weight < t.kg;
    }
    return false;
  }
  function describe(t) {
    const sp = t.sp && DB.byId[t.sp];
    const n = t.count || 1;
    switch (t.kind) {
      case 'species': return { title: `Catch a ${sp.name}`, sub: sp.sci + ' · ' + sp.cls };
      case 'speciesGender': return { title: `Catch a ${t.gender} ${sp.name}`, sub: sp.sci + ' · check the sex on the record' };
      case 'classWeight': return { title: `Catch ${n} ${plural[t.cls]} heavier than ${DB.fmtWeight(t.kg)}`, sub: 'Individual weight counts, not the species average' };
      case 'classCount': return { title: `Catch ${n} ${plural[t.cls]}`, sub: 'Any species of the class' };
      case 'family': return { title: `Catch any one of the ${t.familyCommon.toLowerCase()}`, sub: 'Family ' + t.family + ' · any species counts' };
      case 'threatened': return { title: 'Catch a threatened species', sub: 'IUCN Vulnerable, Endangered or Critically Endangered' };
      case 'weightUnder': return { title: `Catch any animal lighter than ${DB.fmtWeight(t.kg)}`, sub: 'Individual weight counts' };
    }
    return { title: '?', sub: '' };
  }
  function makeTarget(seed, round) {
    const r = Core.mulberry32(Core.hash(seed, round, 4242));
    const region = Core.pick(r, DB.REGIONS).id;
    const pool = DB.inRegion(region);
    const kinds = [['species', 2], ['speciesGender', 3], ['classWeight', 2], ['classCount', 1], ['family', 1], ['threatened', 1], ['weightUnder', 1]];
    for (let attempt = 0; attempt < 20; attempt++) {
      const kind = Core.weightedPick(r, kinds, k => k[1])[0];
      let t = null;
      if (kind === 'species' || kind === 'speciesGender') {
        const sp = Core.weightedPick(r, pool, s => ({ common: 4, uncommon: 3, rare: 2, legendary: 1 }[s.rarity]));
        t = { kind, sp: sp.id, count: 1 }; if (kind === 'speciesGender') t.gender = r() < 0.5 ? 'male' : 'female';
      } else if (kind === 'classWeight') {
        const classes = [...new Set(pool.map(s => s.cls))].filter(c => pool.filter(s => s.cls === c).length >= 2);
        if (!classes.length) continue;
        const cls = Core.pick(r, classes), members = pool.filter(s => s.cls === cls);
        const ths = [0.05, 0.1, 0.5, 1, 2, 5, 10, 50, 100].filter(kg => members.filter(s => DB.overallRange(s)[1] > kg).length >= 2 && members.some(s => DB.overallRange(s)[0] < kg));
        if (!ths.length) continue;
        t = { kind, cls, kg: Core.pick(r, ths), count: 2 };
      } else if (kind === 'classCount') {
        const classes = [...new Set(pool.map(s => s.cls))].filter(c => pool.filter(s => s.cls === c).length >= 3);
        if (!classes.length) continue;
        t = { kind, cls: Core.pick(r, classes), count: 3 };
      } else if (kind === 'family') {
        const fams = [...new Set(pool.map(s => s.family))].filter(f => pool.filter(s => s.family === f).length >= 2);
        if (!fams.length) continue;
        const f = Core.pick(r, fams); t = { kind, family: f, familyCommon: pool.find(s => s.family === f).familyCommon, count: 1 };
      } else if (kind === 'threatened') {
        if (pool.filter(s => DB.THREATENED.includes(s.status)).length < 2) continue;
        t = { kind, count: 1 };
      } else if (kind === 'weightUnder') {
        const ths = [0.05, 0.1, 0.2, 0.5, 1, 2].filter(kg => pool.filter(s => DB.overallRange(s)[0] < kg).length >= 2 && pool.filter(s => DB.overallRange(s)[0] >= kg).length >= 2);
        if (!ths.length) continue;
        t = { kind, kg: Core.pick(r, ths), count: 1 };
      }
      if (t) { t.region = region; return t; }
    }
    const sp = Core.pick(r, pool); return { kind: 'species', sp: sp.id, count: 1, region };
  }

  // ---------- networking ----------
  const VS = {
    peer: null, conn: null, isHost: false, code: null, oppName: null, oppLevel: 1, rounds: 5, rules: {},
    match: null, handlers: {}, ping: null,
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
    emit(ev, d) { (this.handlers[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); },
    available() { return typeof window.Peer === 'function'; },
    me() { return this.isHost ? 'host' : 'guest'; }, them() { return this.isHost ? 'guest' : 'host'; },

    newCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; },
    host(opts) {
      this.leave(true);
      if (!this.available()) return this.emit('error', 'Networking library failed to load (PeerJS). Check your connection and reload.');
      this.isHost = true; this.rounds = opts.rounds || 5; this.rules = opts.rules || {};
      const tryOpen = (n) => {
        this.code = this.newCode();
        this.emit('status', 'Opening room…');
        const p = new Peer(PREFIX + this.code, { debug: 1 });
        this.peer = p;
        p.on('open', () => { this.emit('hosted', { code: this.code }); this.emit('status', 'Room open. Waiting for an opponent…'); });
        p.on('connection', c => {
          if (this.conn && this.conn.open) { c.on('open', () => { c.send({ type: 'full' }); setTimeout(() => c.close(), 300); }); return; }
          this.bind(c);
        });
        p.on('error', err => {
          if (err.type === 'unavailable-id' && n < 4) { p.destroy(); tryOpen(n + 1); return; }
          this.emit('error', netMsg(err));
        });
        p.on('disconnected', () => { if (this.peer === p && !p.destroyed) { try { p.reconnect(); } catch (e) { } } });
      };
      tryOpen(0);
    },
    join(code, name) {
      this.leave(true);
      if (!this.available()) return this.emit('error', 'Networking library failed to load (PeerJS). Check your connection and reload.');
      this.isHost = false; this.code = code.toUpperCase().trim();
      this.emit('status', 'Connecting to room ' + this.code + '…');
      const p = new Peer({ debug: 1 }); this.peer = p;
      p.on('open', () => {
        const c = p.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
        this.bind(c);
        setTimeout(() => { if (this.conn === c && !c.open) this.emit('error', 'Could not reach room ' + this.code + '. Check the code, or the host may be behind a strict firewall.'); }, 15000);
      });
      p.on('error', err => this.emit('error', err.type === 'peer-unavailable' ? 'Room ' + this.code + ' not found. Check the code and that the host still has the lobby open.' : netMsg(err)));
    },
    bind(c) {
      this.conn = c;
      c.on('open', () => {
        this.emit('status', 'Connected.');
        this.send({ type: 'hello', name: Core.profile.name, level: Core.levelFromXp(Core.profile.xp).level, v: 1 });
        clearInterval(this.ping); this.lastSeen = Date.now();
        this.ping = setInterval(() => {
          this.send({ type: 'ping', t: performance.now() });
          if (Date.now() - this.lastSeen > 10000 && this.conn === c) { this.emit('status', 'Opponent timed out.'); this.dropped(c); }
        }, 2500);
      });
      c.on('data', d => { this.lastSeen = Date.now(); this.recv(d); });
      c.on('close', () => this.dropped(c));
      c.on('error', e => this.emit('error', 'Connection error: ' + (e && e.message || e)));
    },
    dropped(c) {
      if (this.conn !== c) return;
      clearInterval(this.ping); this.conn = null; this.oppName = null;
      try { c.close(); } catch (e) { }
      this.abortMatch(); this.emit('disconnect', {});
    },
    send(m) { if (this.conn && this.conn.open) { try { this.conn.send(m); } catch (e) { console.warn(e); } } },
    leave(silent) {
      this.abortMatch(); clearInterval(this.ping);
      try { this.conn && this.conn.close(); } catch (e) { }
      try { this.peer && this.peer.destroy(); } catch (e) { }
      this.conn = null; this.peer = null; this.oppName = null; this.match = null;
      if (!silent) this.emit('left', {});
    },
    abortMatch() { if (this.match) { clearTimeout(this.match.timer); clearTimeout(this.match.next); this.match.over = true; } },

    recv(m) {
      if (!m || !m.type) return;
      switch (m.type) {
        case 'hello':
          this.oppName = String(m.name || 'Opponent').slice(0, 24); this.oppLevel = m.level | 0;
          if (this.isHost) this.send({ type: 'welcome', name: Core.profile.name, level: Core.levelFromXp(Core.profile.xp).level, rounds: this.rounds, rules: this.rules });
          this.emit('lobby', { opp: this.oppName, level: this.oppLevel });
          break;
        case 'welcome': this.oppName = String(m.name).slice(0, 24); this.rounds = m.rounds; this.rules = m.rules; this.emit('lobby', { opp: this.oppName, level: m.level, rounds: m.rounds, rules: m.rules }); break;
        case 'settings': if (!this.isHost) { this.rounds = m.rounds; this.rules = m.rules; this.emit('lobby', { opp: this.oppName, rounds: m.rounds, rules: m.rules }); } break;
        case 'full': this.emit('error', 'That room already has two players.'); break;
        case 'ping': this.send({ type: 'pong', t: m.t }); break;
        case 'pong': this.emit('latency', Math.round(performance.now() - m.t)); break;
        case 'start': if (!this.isHost) this.beginMatch(m); break;
        case 'round': if (!this.isHost) this.beginRound(m); break;
        case 'catch': if (this.isHost) this.judge('guest', m.r, m.idx); break;
        case 'score': if (!this.isHost) { this.match.scores = m.scores; this.emit('score', { scores: m.scores, event: m.event }); } break;
        case 'roundEnd': if (!this.isHost) this.finishRound(m); break;
        case 'matchEnd': if (!this.isHost) this.finishMatch(m); break;
        case 'rematch': if (!this.isHost) this.emit('status', 'Host is starting a rematch…'); break;
        case 'bye': this.dropped(this.conn); break;
        case 'pos': this.emit('pos', m.p); break;
        case 'stun': this.emit('oppStun', m); break;
        case 'tagged': this.emit('oppTagged', m); break;
        case 'chat': this.emit('chat', String(m.text || '').slice(0, 80)); break;
      }
    },
    updateSettings(rounds, rules) { this.rounds = rounds; this.rules = rules; this.send({ type: 'settings', rounds, rules }); },

    // ---------- host match control ----------
    startMatch() {
      if (!this.isHost || !this.conn || !this.conn.open) return;
      const m = { type: 'start', seed: (Math.random() * 4294967296) >>> 0, rounds: this.rounds, rules: this.rules, names: { host: Core.profile.name, guest: this.oppName } };
      this.send(m); this.beginMatch(m);
      this.match.next = setTimeout(() => this.nextRound(), 1200);
    },
    beginMatch(m) {
      this.abortMatch();
      const z = () => ({ pts: 0, wins: 0, prog: 0, wrong: 0 });
      this.match = { seed: m.seed, rounds: m.rounds, rules: m.rules, names: m.names, round: 0, scores: { host: z(), guest: z() }, active: false, over: false };
      this.emit('matchStart', this.match);
    },
    nextRound() {
      const M = this.match; if (!M || M.over) return;
      const need = Math.floor(M.rounds / 2) + 1;
      if (M.round >= M.rounds || M.scores.host.wins >= need || M.scores.guest.wins >= need) return this.endMatch();
      const r = M.round + 1, target = makeTarget(M.seed, r);
      const msg = { type: 'round', r, target, region: target.region, delay: 3200, duration: ROUND_TIME };
      this.send(msg); this.beginRound(msg);
      M.timer = setTimeout(() => this.endRound(null, 'time'), msg.delay + ROUND_TIME * 1000 + 400);
    },
    beginRound(m) {
      const M = this.match; if (!M) return;
      M.round = m.r; M.target = m.target; M.active = true; M.region = m.region;
      M.scores.host.prog = 0; M.scores.guest.prog = 0; M.claimed = {};
      const favour = DB.inRegion(m.region).filter(sp => couldMatch(m.target, sp));
      this.emit('roundStart', { round: m.r, rounds: M.rounds, target: m.target, desc: describe(m.target), region: m.region, delay: m.delay, duration: m.duration,
        cfg: { seed: M.seed, round: m.r, region: m.region, favour, rules: M.rules, target: m.target, duration: m.duration, isHost: this.isHost } });
    },
    reportCatch(rec) {
      const M = this.match; if (!M || !M.active) return;
      this.send({ type: 'tagged', r: M.round, idx: rec.idx });
      if (this.isHost) this.judge('host', M.round, rec.idx);
      else this.send({ type: 'catch', r: M.round, idx: rec.idx });
    },
    judge(who, r, idx) {
      const M = this.match; if (!M || !M.active || r !== M.round || M.over) return;
      const g = window.App && App.game; if (!g || !g.vs || g.vs.round !== r) return;
      if (M.claimed[idx]) return; // the other ranger already tagged this individual
      M.claimed[idx] = who;
      const s = g.vsSpawnAt(idx); // regenerate authoritative traits
      const ok = matches(M.target, s.sp, s.ind);
      const sc = M.scores[who];
      if (ok) sc.prog++; else { sc.pts -= 1; sc.wrong++; }
      const event = { who, sp: s.sp.id, gender: s.ind.gender, weight: s.ind.weight, ok };
      this.send({ type: 'score', scores: M.scores, event }); this.emit('score', { scores: M.scores, event });
      if (ok && sc.prog >= (M.target.count || 1)) this.endRound(who, 'target');
    },
    endRound(winner, reason) {
      const M = this.match; if (!M || !M.active) return;
      clearTimeout(M.timer);
      if (winner) { M.scores[winner].pts += 3; M.scores[winner].wins++; }
      const msg = { type: 'roundEnd', r: M.round, winner, reason, scores: M.scores };
      this.send(msg); this.finishRound(msg);
      M.next = setTimeout(() => this.nextRound(), 4800);
    },
    finishRound(m) { const M = this.match; if (!M) return; M.active = false; M.scores = m.scores; this.emit('roundEnd', m); },
    endMatch() {
      const M = this.match; if (!M) return;
      const h = M.scores.host, g = M.scores.guest;
      let winner = null;
      if (h.wins !== g.wins) winner = h.wins > g.wins ? 'host' : 'guest'; else if (h.pts !== g.pts) winner = h.pts > g.pts ? 'host' : 'guest';
      const msg = { type: 'matchEnd', winner, scores: M.scores };
      this.send(msg); this.finishMatch(msg);
    },
    finishMatch(m) { const M = this.match; if (!M) return; M.over = true; M.active = false; M.scores = m.scores; this.emit('matchEnd', m); },
    rematch() { if (this.isHost) { this.send({ type: 'rematch' }); this.startMatch(); } },
  };
  function netMsg(err) {
    const t = err && err.type;
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the matchmaking server (PeerJS cloud). Your network may block it — try another network or reload.';
    if (t === 'browser-incompatible') return 'This browser does not support WebRTC.';
    return 'Network error: ' + (err && (err.message || err.type) || err);
  }

  window.addEventListener('pagehide', () => { if (VS.conn && VS.conn.open) { try { VS.conn.send({ type: 'bye' }); } catch (e) { } } });
  window.VS = VS; window.VSTargets = { makeTarget, matches, describe, couldMatch };
})();
