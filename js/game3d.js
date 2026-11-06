/* Slingshot Safari — first-person 3D engine (Three.js). Keeps the public interface the UI/VS layers use. */
(function () {
  const T = THREE, DB = SpeciesDB, TAU = Math.PI * 2;
  const GRAV = 9.8, EYE = 1.65, EYE_CROUCH = 1.0, WALK = 3.6, SNEAK = 1.6;
  const FLOCK = new Set(['common_myna', 'javan_myna', 'rr_parakeet', 'pn_green_pigeon', 'bt_bee_eater', 'mallard']);
  const V = () => new T.Vector3();

  function genSpawn(rng, pool, opts) {
    opts = opts || {};
    let sp;
    if (opts.favour && opts.favour.length && rng() < (opts.favourP || 0.4)) sp = Core.pick(rng, opts.favour);
    else sp = Core.weightedPick(rng, pool, s => (opts.weightFn ? opts.weightFn(s) : DB.RARITY[s.rarity].weight));
    const ind = DB.makeIndividual(sp, rng);
    return { sp, ind, fromLeft: rng() < 0.5, lane: rng(), yFrac: rng(), speedMul: 0.85 + rng() * 0.3, ph: rng() * TAU, seed: Math.floor(rng() * 4294967296) };
  }

  class Game {
    constructor(canvas) {
      this.is3d = true; this.c = canvas;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: Core.profile.settings.quality !== 'low', powerPreference: 'high-performance' });
      this.overlay = document.getElementById('overlay'); this.octx = this.overlay.getContext('2d');
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(72, 1, 0.05, 900); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
      this.mode = 'ambient'; this.paused = false; this.live = false; this.listeners = {};
      this.animals = []; this.pebbles = []; this.floaters = []; this.piles = []; this.parts = [];
      this.t = 0; this.clock = 0; this.duration = 0; this.region = DB.region('meadow');
      this.wind = 0; this.windDir = 0; this.rain = 0; this.night = false; this.rules = null;
      this.loadout = Core.loadoutStats(Core.profile.upgrades);
      this.pouch = 24; this.loaded = true; this.reloadT = 0; this.reloadDur = 0.6;
      this.player = { pos: new T.Vector3(0, 0, 0), vel: new T.Vector3(), yaw: 0, pitch: 0, crouch: false, crouchHold: false, eye: EYE, step: 0, moving: false };
      this.keys = new Set(); this.touchMove = { x: 0, y: 0 }; this.draw = null; this.steady = false; this.locked = false;
      this.spawnIdx = 0; this.spawnT = 0;
      this.buildViewmodel(); this.buildStars();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.bindInput();
      this.last = performance.now();
      const loop = now => { const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; try { this.frame(dt); } catch (e) { console.error(e); } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    fire(ev, d) { (this.listeners[ev] || []).forEach(f => f(d)); }

    resize() {
      const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(1.75, window.devicePixelRatio || 1) * (Core.profile.settings.quality === 'low' ? 0.6 : 1);
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const od = Math.min(2, window.devicePixelRatio || 1);
      this.overlay.width = w * od; this.overlay.height = h * od; this.octx.setTransform(od, 0, 0, od, 0, 0);
      this.W = w; this.H = h; this.anchor = { x: w / 2, y: h - 120 };
    }

    // ---------------- world ----------------
    ensureWorld(regionId) {
      const id = regionId || this.region.id;
      if (this.world && this.world.id === id && this.world.night === this.night) return;
      this.clearAnimals();
      if (this.world) this.world.dispose();
      this.region = DB.region(id); this.world = new World3D(this.scene, id, this.night); this.ambSpot = null;
      this.setupNightFx();
    }
    set bg(v) { /* 2D compatibility: plugin toggles request a scenery rebuild */ if (v === null && this.world) { const n = this.world.night; if (n !== this.night) this.ensureWorld(); } }
    setupNightFx() {
      if (this.torch) { this.camera.remove(this.torch); this.camera.remove(this.torch.target); this.torch = null; }
      if (this.flies) { this.scene.remove(this.flies); this.flies.geometry.dispose(); this.flies = null; }
      if (!this.night) return;
      this.torch = new T.SpotLight(0xffe8c0, 1.4, 40, 0.42, 0.6, 1.2); this.torch.position.set(0.2, -0.1, 0); this.torch.target.position.set(0, -0.6, -5);
      this.camera.add(this.torch); this.camera.add(this.torch.target);
      const n = 220, g = new T.BufferGeometry(), p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 120; p[i * 3 + 1] = Math.random() * 4; p[i * 3 + 2] = (Math.random() - 0.5) * 120; }
      g.setAttribute('position', new T.BufferAttribute(p, 3));
      this.flies = new T.Points(g, new T.PointsMaterial({ color: 0xd8f08a, size: 0.12, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
      this.scene.add(this.flies);
    }
    h(x, z) { return this.world ? this.world.h(x, z) : 0; }
    groundAt(x, z) { const y = this.h(x, z); return this.world && this.world.st.water ? Math.max(y, -0.45) : y; }

    // ---------------- viewmodel (first-person slingshot) ----------------
    buildViewmodel() {
      const vm = new T.Group(), M = Models3D.M, G = Models3D.G;
      const mk = (geo, c, pos, sc, rot) => { const m = new T.Mesh(geo, M(c)); m.position.set(...pos); m.scale.set(...sc); if (rot) m.rotation.set(...rot); vm.add(m); return m; };
      this.vmWood = [];
      this.vmWood.push(mk(G.cyl, '#7a5a3a', [0, -0.02, 0], [0.018, 0.2, 0.018]));
      const armL = mk(G.cyl, '#7a5a3a', [0, 0, 0], [0.014, 0.11, 0.014], [0, 0, 2.6]); const armR = mk(G.cyl, '#7a5a3a', [0, 0, 0], [0.014, 0.11, 0.014], [0, 0, -2.6]);
      this.vmWood.push(armL, armR);
      for (let i = 0; i < 5; i++) mk(G.cyl, '#2a2420', [0, -0.07 - i * 0.022, 0], [0.021, 0.012, 0.021]);
      this.tipL = new T.Vector3(-0.056, 0.09, 0); this.tipR = new T.Vector3(0.056, 0.09, 0);
      this.bandL = mk(G.cyl, '#2e2824', [0, 0, 0], [0.005, 1, 0.005]); this.bandR = mk(G.cyl, '#2e2824', [0, 0, 0], [0.005, 1, 0.005]);
      this.pouchM = mk(G.box, '#3a2c22', [0, 0.09, 0.02], [0.03, 0.018, 0.022]);
      this.vmPebble = new T.Mesh(new T.IcosahedronGeometry(0.012, 0), M('#9a958a')); vm.add(this.vmPebble);
      vm.scale.setScalar(0.8); vm.position.set(0.16, -0.2, -0.42); vm.rotation.set(0.1, -0.15, 0);
      vm.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.fog = false; o.renderOrder = 10; } });
      this.vm = vm; this.camera.add(vm);
      this.pebbleGeo = new T.IcosahedronGeometry(0.03, 0); this.pebbleMat = M('#8e897e');
    }
    setSeg(mesh, a, b) {
      const d = new T.Vector3().subVectors(b, a), len = d.length();
      mesh.position.copy(a); mesh.scale.y = len;
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), d.normalize());
    }
    updateViewmodel(dt) {
      const vm = this.vm, show = (this.mode === 'solo' || this.mode === 'vs');
      vm.visible = show; if (!show) return;
      const tier = this.loadout.tier, wood = ['#7a5a3a', '#8a5e36', '#2b2d30', '#9aa0a6', '#1b1a1d'][tier] || '#7a5a3a';
      this.vmWood.forEach(m => m.material.color.set(wood));
      const pow = this.draw ? this.drawPower() : 0;
      // aim pose: raise toward centre while drawing / steadying
      const aimK = this.draw || this.steady ? 1 : 0;
      this.vmK = (this.vmK || 0) + (aimK - (this.vmK || 0)) * Math.min(1, dt * 8);
      const k = this.vmK, bob = this.player.moving ? Math.sin(this.player.step * 2) * 0.008 : 0;
      vm.position.set(0.16 - 0.13 * k, -0.2 + 0.07 * k + bob, -0.42 + 0.02 * k);
      vm.rotation.set(0.1 - 0.06 * k, -0.15 + 0.15 * k, 0);
      // fatigue tremor when held at full draw without steadying
      if (this.draw && this.draw.hold > 2 && !this.steady) { vm.position.x += Math.sin(this.t * 13) * 0.003; vm.position.y += Math.cos(this.t * 11) * 0.003; }
      const pouch = new T.Vector3(0, 0.09 - pow * 0.02, 0.02 + pow * 0.24);
      if (this.snapT > 0) { this.snapT -= dt; pouch.z = 0.02 - Math.sin(this.snapT * 40) * 0.02 * this.snapT * 6; }
      this.pouchM.position.copy(pouch);
      this.setSeg(this.bandL, this.tipL, pouch); this.setSeg(this.bandR, this.tipR, pouch);
      this.bandL.scale.x = this.bandL.scale.z = this.bandR.scale.x = this.bandR.scale.z = 0.005 * (1 - pow * 0.4);
      if (this.loaded) { this.vmPebble.visible = true; this.vmPebble.position.copy(pouch).add(new T.Vector3(0, 0.008, 0)); }
      else if (this.reloadT > 0) {
        const e = 1 - this.reloadT / this.reloadDur, s = e * e * (3 - 2 * e);
        this.vmPebble.visible = true; this.vmPebble.position.set(0.12 * (1 - s), -0.2 * (1 - s) + pouch.y * s + Math.sin(Math.PI * s) * 0.06, 0.05 * (1 - s) + pouch.z * s);
      } else this.vmPebble.visible = false;
    }
    buildStars() {
      this.starGeo = new T.OctahedronGeometry(0.05, 0);
      this.starMat = new T.MeshBasicMaterial({ color: 0xe9cf86, fog: false });
      this.ringGeo = new T.TorusGeometry(1, 0.03, 6, 32); this.ringMat = new T.MeshBasicMaterial({ color: 0xc8a25a, transparent: true, opacity: 0.9, fog: false });
    }

    // ---------------- input ----------------
    bindInput() {
      const c = this.c;
      document.addEventListener('pointerlockchange', () => {
        const was = this.locked; this.locked = document.pointerLockElement === c;
        if (!this.locked) { this.keys.clear(); if (this.draw && this.draw.src === 'mouse') this.draw = null; this.steady = false; }
        if (was && !this.locked) this.fire('unlock', {});
      });
      document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
      c.addEventListener('mousedown', e => {
        if (!this.canShoot()) return;
        if (!this.locked && !this.touchMode) { this.lock(); return; }
        if (e.button === 0) this.startDraw('mouse');
        if (e.button === 2) this.steady = true;
      });
      window.addEventListener('mouseup', e => {
        if (e.button === 0 && this.draw && this.draw.src === 'mouse') this.releaseDraw();
        if (e.button === 2) this.steady = false;
      });
      c.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('mousemove', e => { if (this.locked && Math.abs(e.movementX) < 300 && Math.abs(e.movementY) < 300) this.look(e.movementX, e.movementY); }); // ignore Chromium's occasional spurious jump right after locking
      // touch: drag on the canvas to look
      c.addEventListener('touchstart', e => { this.touchMode = true; for (const t of e.changedTouches) if (!this.lookTouch) this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; e.preventDefault(); }, { passive: false });
      c.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (this.lookTouch && t.identifier === this.lookTouch.id) { this.look((t.clientX - this.lookTouch.x) * 2.2, (t.clientY - this.lookTouch.y) * 2.2); this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY; } e.preventDefault(); }, { passive: false });
      const tend = e => { for (const t of e.changedTouches) if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null; };
      c.addEventListener('touchend', tend); c.addEventListener('touchcancel', tend);
      window.addEventListener('keydown', e => {
        const tag = (e.target && e.target.tagName) || ''; if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
        if (!this.canShoot() || e.ctrlKey || e.metaKey || e.altKey) return;
        this.keys.add(e.code);
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.startDraw('key'); }
        else if (e.code === 'KeyR') { e.preventDefault(); this.startReload(); }
        else if (e.code === 'KeyE') { e.preventDefault(); this.interact(); }
        else if (e.code === 'KeyC' && !e.repeat) this.player.crouch = !this.player.crouch;
        else if (/Arrow|Key[WASD]/.test(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', e => {
        this.keys.delete(e.code);
        if (e.code === 'Space' && this.draw && this.draw.src === 'key') { e.preventDefault(); this.releaseDraw(); }
      });
      window.addEventListener('blur', () => { this.keys.clear(); if (this.draw) this.draw = null; this.steady = false; });
    }
    lock() { if (this.touchMode) return; try { const p = this.c.requestPointerLock(); if (p && p.catch) p.catch(() => { this.lockFailed = true; }); } catch (e) { this.lockFailed = true; } }
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
    look(dx, dy) {
      if (!this.live || this.paused) return;
      const s = 0.0022 * (this.steady ? 0.55 : 1) * (Core.profile.settings.sensitivity || 1);
      this.player.yaw -= dx * s; this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * s));
    }
    canShoot() { return (this.mode === 'solo' || this.mode === 'vs') && this.live && !this.paused; }

    // ---------------- draw / fire / reload ----------------
    drawPower() { return Math.min(1, 0.15 + this.draw.hold / 1.0); }
    startDraw(src) {
      if (!this.canShoot() || this.draw) return;
      if (!this.loaded) { this.dryFire(); return; }
      this.draw = { src, hold: 0 }; Plugins.emit('onAimStart', {});
    }
    releaseDraw() {
      const d = this.draw; this.draw = null;
      if (!d || !this.canShoot() || d.hold < 0.06) return;
      this.release(Math.min(1, 0.15 + d.hold / 1.0));
    }
    aimDir() { const d = new T.Vector3(); this.camera.getWorldDirection(d); return d; }
    release(power) {
      if (!this.loaded) { this.dryFire(); return; }
      const dir = this.aimDir(), n = this.loadout.pellets;
      const spd = (14 + 32 * power) * (this.loadout.speed / 1120);
      const origin = this.camera.getWorldPosition(V()).add(dir.clone().multiplyScalar(0.45));
      const right = new T.Vector3().crossVectors(dir, new T.Vector3(0, 1, 0)).normalize();
      for (let i = 0; i < n; i++) {
        const spread = this.loadout.spread * (this.steady ? 0.35 : 1) + (this.draw && this.draw.hold > 2 ? 0.01 : 0);
        const d = dir.clone().add(right.clone().multiplyScalar((i - (n - 1) / 2) * 0.035 + (Math.random() - 0.5) * spread)).add(new T.Vector3(0, (Math.random() - 0.5) * spread, 0)).normalize();
        const mesh = new T.Mesh(this.pebbleGeo, this.pebbleMat); mesh.position.copy(origin); this.scene.add(mesh);
        const st = { pos: origin.clone(), vel: d.multiplyScalar(spd), mesh, life: 0, dmg: this.loadout.damage, dead: false };
        Plugins.reduce('modifyStone', st, { game: this });
        this.pebbles.push(st);
      }
      this.loaded = false; this.snapT = 0.15; this.session.shots++; Core.profile.stats.shots++;
      if (Core.profile.settings.autoReload) setTimeout(() => this.startReload(), 150);
      Plugins.emit('onShot', { power, game: this });
    }
    dryFire() {
      if (this.reloadT > 0) return;
      this.toastHud(this.pouch > 0 ? 'Sling empty — press R to reload' : 'Pouch empty — gather stones (E)');
      Plugins.emit('onDryFire', { game: this });
    }
    toastHud(text) { this.fire('hint', text); }
    startReload() {
      if (!this.canShoot() || this.loaded || this.reloadT > 0) return false;
      if (this.pouch <= 0) { this.dryFire(); return false; }
      this.reloadT = this.reloadDur = this.loadout.cooldown; Plugins.emit('onReload', { game: this }); return true;
    }
    updateReload(dt) { if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.reloadT = 0; this.loaded = true; this.pouch--; } } }

    // ---------------- piles / interaction ----------------
    resetAmmo(n) {
      this.pouch = n; this.loaded = true; this.reloadT = 0; this.draw = null;
      this.piles.forEach(p => this.scene.remove(p.mesh)); this.piles = [];
      (this.world.pileSpots || []).forEach(s => this.addPile(s.x, s.z, s.n, false));
    }
    addPile(x, z, n, dropped) {
      const g = new T.Group(), M = Models3D.M('#9a958a');
      for (let i = 0; i < Math.min(n, 4); i++) { const m = new T.Mesh(this.pebbleGeo, M); m.scale.setScalar(dropped ? 1 : 1.6); m.position.set((i % 2) * 0.08 - 0.04, 0.03 + (i > 1 ? 0.04 : 0), Math.floor(i / 2) * 0.08 - 0.04); g.add(m); }
      g.position.set(x, this.groundAt(x, z), z); this.scene.add(g);
      const p = { x, z, n, mesh: g, dropped, t: 0 }; this.piles.push(p);
      if (dropped) { const d = this.piles.filter(q => q.dropped); if (d.length > 30) this.removePile(d[0]); }
      return p;
    }
    removePile(p) { this.scene.remove(p.mesh); this.piles = this.piles.filter(q => q !== p); }
    nearest(list, r) { const P = this.player.pos; let best = null, bd = r; for (const o of list) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = o; } } return best; }
    stunnedNear() { const P = this.player.pos; let best = null, bd = 3.4; for (const a of this.animals) if (a.state === 'stunned') { const d = Math.hypot(a.pos.x - P.x, a.pos.z - P.z); if (d < bd) { bd = d; best = a; } } return best; }
    interact() {
      if (!this.canShoot()) return;
      const a = this.stunnedNear(); if (a) { this.tag(a); return; }
      this.gather();
    }
    gather(pile) {
      if (!this.canShoot()) return;
      pile = pile || this.nearest(this.piles, 2.6);
      if (!pile) { this.toastHud('Nothing to gather here — look for stone piles near rocks'); return; }
      this.removePile(pile); this.pouch += pile.n;
      this.floater(new T.Vector3(pile.x, this.groundAt(pile.x, pile.z) + 0.6, pile.z), '+' + pile.n + ' stone' + (pile.n > 1 ? 's' : ''), '#e9d8a6');
      Plugins.emit('onGather', { n: pile.n, game: this });
    }
    tag(a) {
      if (a.state !== 'stunned') return;
      a.state = 'tagging'; a.stateT = 0;
      a.ring = new T.Mesh(this.ringGeo, this.ringMat); a.ring.rotation.x = Math.PI / 2; a.ring.position.copy(a.pos).add(new T.Vector3(0, 0.1, 0)); this.scene.add(a.ring);
    }

    // ---------------- modes ----------------
    resetEnv() { this.wind = 0; this.rain = 0; this.windDir = 0; this.night = false; }
    clearAnimals() { this.animals.forEach(a => this.removeAnimal(a, true)); this.animals = []; this.pebbles.forEach(p => this.scene.remove(p.mesh)); this.pebbles = []; this.floaters = []; this.parts = []; }
    clearWorld() { this.clearAnimals(); this.draw = null; }
    setRegion(id) { this.region = DB.region(id) || DB.region('meadow'); }
    dryNear(x, z) {
      if (!this.world || !this.world.st.water) return [x, z];
      for (let r = 0; r < 60; r += 2) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (this.h(px, pz) > 0.25) return [px, pz]; }
      return [x, z];
    }
    placePlayer(x, z, yaw, dry) { if (dry) [x, z] = this.dryNear(x, z); const p = this.player; p.pos.set(x, this.groundAt(x, z), z); p.yaw = yaw || 0; p.pitch = 0; p.crouch = false; p.eye = EYE; p.vel.set(0, 0, 0); }
    idle(regionId) {
      this.mode = 'idle'; this.live = false; this.paused = false; this.draw = null;
      if (regionId) this.setRegion(regionId);
      this.ensureWorld(this.region.id); this.clearWorld(); this.removeAvatar();
    }
    ambient(regionId) {
      this.mode = 'ambient'; this.live = false; this.paused = false; this.rules = null; this.draw = null; this.unlock();
      this.setRegion(regionId || this.region.id); this.resetEnv(); this.envRng = Math.random;
      Plugins.emit('onExpeditionStart', { ambient: true, game: this });
      this.ensureWorld(this.region.id); this.clearWorld(); this.removeAvatar();
      this.pool = DB.inRegion(this.region.id); this.weightFn = null; this.spawnT = 0;
      for (let i = 0; i < 10; i++) this.spawnSolo(18, 45);
    }
    startSolo(regionId, duration) {
      const prof = Core.profile;
      this.mode = 'solo'; this.live = true; this.paused = false; this.rules = null;
      this.setRegion(regionId); this.loadout = Core.loadoutStats(prof.upgrades);
      const lvl = Core.levelFromXp(prof.xp).level;
      this.pool = DB.inRegion(regionId); this.envRng = Math.random;
      this.spawnIdx = 0; this.spawnT = 0; this.clock = 0; this.duration = duration || 240;
      this.session = { score: 0, catches: [], shots: 0, hits: 0, streak: 0, bestStreak: 0, region: regionId, level: lvl };
      this.weightFn = s => {
        let w = DB.RARITY[s.rarity].weight;
        if (s.rarity === 'rare') w *= 1 + lvl * 0.06; if (s.rarity === 'legendary') w *= 1 + lvl * 0.12;
        return Plugins.reduce('modifySpawnWeight', w, { sp: s, game: this });
      };
      this.resetEnv(); Plugins.emit('onExpeditionStart', { game: this, region: regionId });
      this.ensureWorld(regionId); this.clearWorld(); this.removeAvatar();
      this.placePlayer(0, 0, Math.random() * TAU, true); this.resetAmmo(24);
      for (let i = 0; i < 14; i++) this.spawnSolo(25, 90);
    }
    startVsRound(cfg) {
      this.mode = 'vs'; this.live = true; this.paused = false; this.rules = cfg.rules || {};
      this.setRegion(cfg.region); this.loadout = Core.loadoutStats(Core.VS_LOADOUT);
      this.pool = DB.inRegion(cfg.region); this.vs = cfg;
      this.envRng = Core.mulberry32(Core.hash(cfg.seed, cfg.round, 77));
      this.spawnIdx = 0; this.spawnT = 0; this.clock = 0; this.duration = cfg.duration || 150;
      this.session = { score: 0, catches: [], shots: 0, hits: 0, streak: 0, bestStreak: 0 };
      this.weightFn = s => Plugins.reduce('modifySpawnWeight', DB.RARITY[s.rarity].weight + 8, { sp: s, game: this });
      this.resetEnv(); Plugins.emit('onRoundStart', { game: this, round: cfg.round, target: cfg.target });
      this.ensureWorld(cfg.region); this.clearWorld();
      this.placePlayer(cfg.isHost ? -3 : 3, 0, 0, true); this.resetAmmo(20);
      for (let i = 0; i < 22; i++) { this.spawnFrom(this.vsSpawnAt(this.spawnIdx), this.spawnIdx); this.spawnIdx++; }
    }
    vsSpawnAt(idx) {
      const r = Core.mulberry32(Core.hash(this.vs.seed, this.vs.round * 7919 + 1, idx * 104729 + 3));
      return genSpawn(r, this.pool, { favour: this.vs.favour, favourP: 0.36, weightFn: this.weightFn });
    }
    endLive() { this.live = false; this.draw = null; this.steady = false; }

    // ---------------- spawning ----------------
    spawnSolo(rMin, rMax) {
      const s = genSpawn(Math.random, this.pool, { weightFn: this.weightFn || (sp => DB.RARITY[sp.rarity].weight) });
      const P = this.mode === 'ambient' ? new T.Vector3() : this.player.pos;
      const a = Math.random() * TAU, d = rMin + Math.random() * (rMax - rMin);
      const x = clampR(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d);
      const lead = this.spawnFrom(s, this.spawnIdx++, x);
      if (lead && FLOCK.has(s.sp.id) && this.mode !== 'vs') {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const f = this.spawnFrom({ sp: s.sp, ind: DB.makeIndividual(s.sp, Math.random), seed: Math.floor(Math.random() * 4e9) }, this.spawnIdx++, [x[0] + (Math.random() - 0.5) * 6, x[1] + (Math.random() - 0.5) * 6]);
          f.leader = lead; f.offset = new T.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 4);
        }
      }
    }
    // xz: [x,z] position or null for deterministic placement from the spawn seed (VS)
    spawnFrom(s, idx, xz) {
      const sp = s.sp, m = Models3D.build(sp, s.ind.gender);
      const r = Core.mulberry32((s.seed ^ 0x9e3779b9) >>> 0);
      if (!xz) { const a = r() * TAU, d = 18 + r() * 95; xz = clampR(Math.cos(a) * d, Math.sin(a) * d); }
      const a = { sp, ind: s.ind, idx, model: m, pos: new T.Vector3(xz[0], 0, xz[1]), yaw: r() * TAU, state: 'wander', stateT: 0, t: r() * 10, hp: sp.hp, maxHp: sp.hp,
        rng: r, flyer: m.flyer, home: new T.Vector3(xz[0], 0, xz[1]), target: null, vy: 0, alarm: 0, speedNow: 0 };
      const sc = 1;
      a.run = Math.max(1.6, sp.speed / 100 * 3.1); a.walk = a.run * 0.3; a.flySpd = Math.max(5, sp.speed / 100 * 4.2);
      if (a.flyer) {
        if (sp.move === 'soar' || sp.move === 'dive') { a.state = 'soar'; a.center = a.pos.clone(); a.radius = 18 + r() * 25; a.alt = 22 + r() * 14; a.ang = r() * TAU; }
        else { const p = this.perchNear(a.pos, 30, r); a.perch = p; a.state = 'perch'; a.pos.copy(p); a.stateT = -r() * 6; }
      }
      if (!a.flyer) a.pos.y = this.groundAt(a.pos.x, a.pos.z);
      m.root.position.copy(a.pos); m.root.scale.setScalar(sc); this.scene.add(m.root);
      this.animals.push(a);
      Plugins.emit('onSpawn', { animal: a, game: this });
      return a;
    }
    perchNear(pos, rad, r) {
      const ps = this.world.perches; let best = null, bd = Infinity;
      for (let i = 0; i < 24; i++) { const p = ps[Math.floor((r ? r() : Math.random()) * ps.length)]; const d = Math.abs(Math.hypot(p.x - pos.x, p.z - pos.z) - rad * 0.5); if (d < bd) { bd = d; best = p; } }
      return best ? best.clone() : new T.Vector3(pos.x, this.h(pos.x, pos.z) + 6, pos.z);
    }
    removeAnimal(a, silent) {
      this.scene.remove(a.model.root); if (a.stars) this.scene.remove(a.stars); if (a.ring) this.scene.remove(a.ring);
      a.removed = true;
      if (!silent) this.animals = this.animals.filter(x => x !== a);
    }
    updateSpawns(dt) {
      if (this.mode === 'idle') return;
      this.spawnT -= dt;
      if (this.mode === 'vs') {
        if (!this.live) return;
        while (this.clock >= 22 * 0 + (this.spawnIdx - 21) * 5) { if (this.animals.length < 34) this.spawnFrom(this.vsSpawnAt(this.spawnIdx), this.spawnIdx); this.spawnIdx++; }
        return;
      }
      const cap = this.mode === 'ambient' ? 12 : 18;
      if (this.spawnT <= 0) { this.spawnT = 1.6; if (this.animals.filter(a => a.state !== 'stunned').length < cap) this.spawnSolo(this.mode === 'ambient' ? 15 : 45, this.mode === 'ambient' ? 45 : 100); }
      // despawn far animals
      if (this.mode === 'solo') for (const a of this.animals) if (a.state !== 'stunned' && a.pos.distanceTo(this.player.pos) > 150) this.removeAnimal(a, true);
      this.animals = this.animals.filter(a => !a.removed);
    }

    // ---------------- animal AI ----------------
    detectRadius(a) {
      const P = this.player;
      let r = a.flyer ? 15 : 19;
      r *= { common: 0.85, uncommon: 1, rare: 1.15, legendary: 1.25 }[a.sp.rarity];
      if (P.crouch || P.crouchHold) r *= 0.42; else if (!P.moving) r *= 0.7;
      if (this.night) r *= 0.75;
      if (a.state === 'graze') r *= 0.8;
      return r;
    }
    flee(a, from) {
      if (a.state === 'stunned' || a.state === 'tagging') return;
      const away = new T.Vector3().subVectors(a.pos, from); away.y = 0; if (away.lengthSq() < 0.01) away.set(1, 0, 0); away.normalize();
      away.applyAxisAngle(new T.Vector3(0, 1, 0), (a.rng() - 0.5) * 0.8);
      if (a.flyer) {
        a.state = 'fly'; a.leader = null;
        const tx = clampR(a.pos.x + away.x * 60, a.pos.z + away.z * 60);
        a.perch = this.perchNear(new T.Vector3(tx[0], 0, tx[1]), 20, a.rng); a.target = a.perch; a.fleeing = true;
      } else { a.state = 'flee'; a.stateT = 0; a.fleeDir = away; a.fleeFor = 5 + a.rng() * 4; }
    }
    updateAnimals(dt) {
      const P = this.player.pos, live = this.live, up = new T.Vector3(0, 1, 0);
      for (const a of this.animals) {
        if (a.removed) continue;
        a.t += dt; a.stateT += dt;
        const m = a.model, sp = a.sp;
        const dist = live ? Math.hypot(a.pos.x - P.x, a.pos.z - P.z) : 999;
        const vert = live ? Math.abs(a.pos.y - P.y) : 0;
        if (live && (this.mode !== 'ambient') && ['wander', 'graze', 'perch', 'soar'].includes(a.state)) {
          if (Math.hypot(dist, vert * 0.5) < this.detectRadius(a)) this.flee(a, P);
          else if (this.avatar && this.avatarTarget && !this.avatarTarget.c && Math.hypot(a.pos.x - this.avatar.position.x, a.pos.z - this.avatar.position.z) < (a.flyer ? 11 : 13)) this.flee(a, this.avatar.position);
        }
        let mode = 'idle', speed = 0;
        if (a.flyer && a.state !== 'stunned' && a.state !== 'tagging') {
          if (a.leader && !a.leader.removed && a.leader.state !== 'stunned' && a.leader.state !== 'tagging' && ['perch', 'fly'].includes(a.state)) {
            // flocking: follow the leader with an offset
            const L = a.leader; const tgt = L.pos.clone().add(a.offset); if (L.state === 'perch') tgt.y = L.pos.y + Math.abs(a.offset.y) * 0.3;
            const d = tgt.clone().sub(a.pos); const len = d.length();
            if (len > 0.3) { const v = Math.min(len, a.flySpd * 1.2 * dt); a.pos.add(d.multiplyScalar(v / len)); a.yaw = lerpAngle(a.yaw, Math.atan2(d.x, d.z), dt * 5); mode = 'fly'; a.state = 'fly'; }
            else { mode = L.state === 'perch' ? 'perch' : 'fly'; a.state = L.state === 'perch' ? 'perch' : 'fly'; a.yaw = lerpAngle(a.yaw, L.yaw, dt * 2); }
          } else if (a.state === 'perch') {
            mode = 'perch';
            if (a.stateT > 6 + a.rng() * 10) { a.state = 'fly'; a.perch = this.perchNear(a.pos, 40, a.rng); a.target = a.perch; a.fleeing = false; }
          } else if (a.state === 'fly') {
            mode = 'fly';
            const tgt = a.target || a.pos, d = tgt.clone().sub(a.pos), hd = Math.hypot(d.x, d.z);
            const cruise = Math.max(tgt.y, this.h(a.pos.x, a.pos.z) + (a.fleeing ? 16 : 9));
            const want = new T.Vector3(d.x, (hd > 8 ? cruise - a.pos.y : d.y), d.z);
            const len = want.length();
            if (len < 0.4) { a.state = 'perch'; a.stateT = 0; a.pos.copy(tgt); a.fleeing = false; }
            else { const v = Math.min(len, a.flySpd * (a.fleeing ? 1.4 : 1) * dt); a.pos.add(want.multiplyScalar(v / len)); a.yaw = lerpAngle(a.yaw, Math.atan2(d.x, d.z), dt * 4); }
          } else if (a.state === 'soar') {
            mode = 'glide';
            a.ang += (a.flySpd * 0.6 / a.radius) * dt;
            let alt = a.alt; if (sp.move === 'dive') alt -= Math.pow(Math.max(0, Math.sin(a.t * 0.5)), 8) * (a.alt - 6);
            const nx = a.center.x + Math.cos(a.ang) * a.radius, nz = a.center.z + Math.sin(a.ang) * a.radius;
            const ny = this.h(nx, nz) + alt;
            a.yaw = Math.atan2(nx - a.pos.x, nz - a.pos.z); a.pos.set(nx, a.pos.y + (ny - a.pos.y) * Math.min(1, dt * 1.5), nz);
            if (Math.sin(a.t * 0.4) > 0.97) mode = 'fly';
          }
          if (a.state === 'fly' && a.fleeing && a.pos.distanceTo(P) > 60 && sp.move === 'soar') { a.state = 'soar'; a.center = a.pos.clone(); }
          if (a.state === 'fly' && (sp.move === 'soar' || sp.move === 'dive') && !a.fleeing) { a.state = 'soar'; a.center = a.pos.clone(); }
        } else if (a.state === 'wander' || a.state === 'graze') {
          if (a.state === 'graze') { mode = 'graze'; if (a.stateT > a.grazeFor) { a.state = 'wander'; a.stateT = 0; a.target = null; } }
          else {
            if (!a.target) { const ang = a.rng() * TAU, d = 4 + a.rng() * 18; const xz = clampR(a.home.x + Math.cos(ang) * d, a.home.z + Math.sin(ang) * d); a.target = new T.Vector3(xz[0], 0, xz[1]); }
            const d = a.target.clone().sub(a.pos); d.y = 0; const len = d.length();
            if (len < 0.6) { a.target = null; if (a.rng() < 0.6) { a.state = 'graze'; a.stateT = 0; a.grazeFor = 2 + a.rng() * 5; } }
            else { speed = a.walk * (sp.move === 'scurry' ? 1.6 : 1); this.stepGround(a, d.normalize(), speed, dt); mode = 'walk'; }
          }
        } else if (a.state === 'flee') {
          speed = a.run * (a.hp < a.maxHp ? 1.15 : 1); this.stepGround(a, a.fleeDir, speed, dt); mode = 'run';
          if (a.stateT > a.fleeFor) { a.state = 'wander'; a.stateT = 0; a.home.copy(a.pos); a.target = null; }
        } else if (a.state === 'stunned') {
          if (a.flyer) { const gy = this.groundAt(a.pos.x, a.pos.z) + 0.08; if (a.pos.y > gy) { a.vy -= GRAV * dt; a.pos.y = Math.max(gy, a.pos.y + a.vy * dt); } }
          m.root.rotation.z += ((a.flyer ? 0.4 : 1.45) - m.root.rotation.z) * Math.min(1, dt * 6);
          if (!a.stars) { a.stars = new T.Group(); for (let i = 0; i < 3; i++) { const s = new T.Mesh(this.starGeo, this.starMat); a.stars.add(s); } this.scene.add(a.stars); }
          const top = a.pos.y + (a.flyer ? 0.35 : Math.max(0.35, m.height * 0.6));
          a.stars.position.set(a.pos.x, top, a.pos.z);
          a.stars.children.forEach((s, i) => { const ang = a.t * 3 + i * TAU / 3; s.position.set(Math.cos(ang) * 0.32, Math.sin(a.t * 5 + i) * 0.04, Math.sin(ang) * 0.32); s.rotation.y = a.t * 4; });
          if (a.stateT > 45) { a.state = 'flee'; a.stateT = 0; a.hp = Math.ceil(a.maxHp / 2); m.root.rotation.z = 0; this.scene.remove(a.stars); a.stars = null; a.fleeDir = new T.Vector3(1, 0, 0); a.fleeFor = 6; if (a.flyer) this.flee(a, P); }
        } else if (a.state === 'tagging') {
          const k = a.stateT / 0.6; a.ring.scale.setScalar(0.3 + k * 0.9); a.ring.material.opacity = 1 - k * 0.5;
          if (a.stateT > 0.6 && !a.caught) { a.caught = true; this.removeAnimal(a, true); this.caughtAnimal(a); }
          continue;
        }
        // perched/ground-walking birds' feet on the perch; ground animals on terrain
        if (!a.flyer && a.state !== 'stunned') {
          let y = this.groundAt(a.pos.x, a.pos.z);
          if ((sp.move === 'hop' || sp.move === 'roo') && mode === 'run') y += Math.abs(Math.sin(a.t * (sp.move === 'roo' ? 5 : 8))) * (sp.move === 'roo' ? 0.7 : 0.25);
          if ((sp.move === 'hop' || sp.move === 'roo') && mode === 'walk') y += Math.abs(Math.sin(a.t * 6)) * 0.12;
          a.pos.y = y;
        }
        m.root.position.copy(a.pos); m.root.rotation.y = a.yaw;
        if (a.state !== 'stunned') Models3D.animate(m, mode, a.t, speed);
        else Models3D.animate(m, a.flyer ? 'perch' : 'idle', 0, 0);
        if (a.hitFlash > 0) a.hitFlash -= dt;
      }
      this.animals = this.animals.filter(a => !a.removed);
    }
    stepGround(a, dir, speed, dt) {
      const nx = a.pos.x + dir.x * speed * dt, nz = a.pos.z + dir.z * speed * dt;
      const xz = clampR(nx, nz);
      if (xz[0] !== nx || xz[1] !== nz) { dir.multiplyScalar(-1); a.target = null; }
      if (this.world.st.water && this.h(xz[0], xz[1]) < -0.8 && a.sp.id !== 'sc_otter' && a.sp.id !== 'water_monitor') { dir.applyAxisAngle(new T.Vector3(0, 1, 0), 1.6); a.target = null; return; }
      a.pos.x = xz[0]; a.pos.z = xz[1];
      for (const t of this.world.trunksNear(a.pos.x, a.pos.z)) { const dx = a.pos.x - t.x, dz = a.pos.z - t.z, d = Math.hypot(dx, dz), min = t.r + 0.3; if (d < min && d > 0.001) { a.pos.x = t.x + dx / d * min; a.pos.z = t.z + dz / d * min; } }
      a.yaw = lerpAngle(a.yaw, Math.atan2(dir.x, dir.z), dt * 6);
    }
    hit(a, dmg, head) {
      if (typeof dmg === 'object') dmg = dmg.dmg; // legacy signature
      if (a.state === 'stunned' || a.state === 'tagging') return;
      const d = dmg * (head ? 1.6 : 1);
      a.hp -= d; a.hitFlash = 0.2;
      if (this.session) { this.session.hits++; this.session.streak++; this.session.bestStreak = Math.max(this.session.bestStreak, this.session.streak); }
      Core.profile.stats.hits++;
      const top = a.pos.clone().add(new T.Vector3(0, a.model.height + 0.3, 0));
      Plugins.emit('onHit', { animal: a, game: this, streak: this.session ? this.session.streak : 0, head });
      if (a.hp <= 0) {
        a.state = 'stunned'; a.stateT = 0; a.vy = 0; a.leader = null;
        this.floater(top, head ? 'Head shot · Subdued' : 'Subdued', '#e9d8a6');
        Plugins.emit('onSubdue', { animal: a, game: this });
        this.animals.forEach(o => { if (o.leader === a) o.leader = null; });
        this.fire('stun', a);
      } else {
        this.floater(top, (head ? 'Head · ' : '') + '−' + (Math.round(d * 10) / 10), '#d8cfb8');
        this.flee(a, this.player.pos);
      }
    }
    remoteStun(idx, x, z) {
      const a = this.animals.find(o => o.idx === idx); if (!a || a.state === 'stunned' || a.state === 'tagging') return;
      a.pos.x = x; a.pos.z = z; a.hp = 0; a.state = 'stunned'; a.stateT = 0; a.vy = 0; a.leader = null; a.remote = true;
    }
    remoteRemove(idx) {
      const a = this.animals.find(o => o.idx === idx); if (!a) return;
      this.floater(a.pos.clone().add(new T.Vector3(0, a.model.height + 0.3, 0)), 'Tagged by rival', '#d08a66');
      this.removeAnimal(a);
    }
    caughtAnimal(a) { if (this.mode === 'ambient') return; this.fire('catch', { sp: a.sp, ind: a.ind, idx: a.idx, region: this.region.id, at: Date.now(), mode: this.mode }); }

    // ---------------- pebbles ----------------
    windVec() { return new T.Vector3(Math.cos(this.windDir), 0, Math.sin(this.windDir)).multiplyScalar(this.wind * 1.6); }
    updatePebbles(dt) {
      const wv = this.windVec(), drag = this.rain * 0.12, tmp = V(), prev = V();
      for (const s of this.pebbles) {
        if (s.dead) continue;
        const steps = 3, h = dt / steps;
        for (let k = 0; k < steps && !s.dead; k++) {
          prev.copy(s.pos);
          s.vel.addScaledVector(wv, h); s.vel.y -= GRAV * h; if (drag) s.vel.multiplyScalar(1 - drag * h);
          s.pos.addScaledVector(s.vel, h); s.life += h;
          // animals
          for (const a of this.animals) {
            if (a.state === 'stunned' || a.state === 'tagging' || a.removed) continue;
            if (a.pos.distanceToSquared(s.pos) > 36) continue;
            a.model.root.updateMatrixWorld(true);
            for (const hs of a.model.hit) {
              tmp.copy(hs.c).applyMatrix4(a.model.root.matrixWorld);
              if (segSphere(prev, s.pos, tmp, hs.r * 1.12 + 0.03)) { this.hit(a, s.dmg, hs.head); s.dead = true; this.puff(s.pos, a.flyer); break; }
            }
            if (s.dead) break;
          }
          if (s.dead) break;
          // trunks
          for (const t of this.world.trunksNear(s.pos.x, s.pos.z)) {
            if (Math.hypot(s.pos.x - t.x, s.pos.z - t.z) < t.r && s.pos.y < this.h(t.x, t.z) + t.h) { s.dead = true; this.miss(s.pos); this.addPile(s.pos.x - (s.vel.x > 0 ? 0.6 : -0.6), s.pos.z, 1, true); break; }
          }
          if (s.dead) break;
          const gy = this.groundAt(s.pos.x, s.pos.z);
          if (s.pos.y <= gy) { s.dead = true; s.pos.y = gy; this.miss(s.pos); if (Math.hypot(s.pos.x, s.pos.z) < World3D.EDGE) this.addPile(s.pos.x, s.pos.z, 1, true); }
          if (s.life > 7) s.dead = true;
        }
        s.mesh.position.copy(s.pos);
      }
      this.pebbles = this.pebbles.filter(s => { if (s.dead) this.scene.remove(s.mesh); return !s.dead; });
    }
    miss(pos) {
      if (this.session) this.session.streak = 0;
      Plugins.emit('onMiss', { game: this });
      // a stone clattering nearby spooks animals
      for (const a of this.animals) if (a.pos.distanceTo(pos) < 6) this.flee(a, pos);
      this.puff(pos, false);
    }
    puff(pos, feathers) { for (let i = 0; i < 6; i++) this.parts.push({ p: pos.clone(), v: new T.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), t: 0, life: 0.6, col: feathers ? 'rgba(235,228,210,0.9)' : 'rgba(190,170,130,0.8)' }); }
    floater(pos, text, col) { this.floaters.push({ pos: pos.clone(), text, col, t: 0 }); }

    // ---------------- player ----------------
    updatePlayer(dt) {
      const P = this.player, k = this.keys;
      P.crouchHold = k.has('ShiftLeft') || k.has('ShiftRight');
      const crouch = P.crouch || P.crouchHold;
      let fx = 0, fz = 0;
      if (k.has('KeyW') || k.has('ArrowUp')) fz += 1; if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) fx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
      fx += this.touchMove.x; fz += this.touchMove.y;
      const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
      const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
      // camera forward = (-sin yaw, 0, -cos yaw), right = (cos yaw, 0, -sin yaw)
      let spd = (crouch ? SNEAK : WALK) * (this.draw ? 0.55 : 1) * (this.steady ? 0.6 : 1);
      const wy = this.h(P.pos.x, P.pos.z); if (this.world.st.water && wy < -0.2) spd *= 0.6;
      const tx = (-sy * fz + cy * fx) * spd, tz = (-cy * fz - sy * fx) * spd;
      P.vel.x += (tx - P.vel.x) * Math.min(1, dt * 10); P.vel.z += (tz - P.vel.z) * Math.min(1, dt * 10);
      let nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
      for (const t of this.world.trunksNear(nx, nz)) { const dx = nx - t.x, dz = nz - t.z, d = Math.hypot(dx, dz), min = t.r + 0.35; if (d < min && d > 0.0001) { nx = t.x + dx / d * min; nz = t.z + dz / d * min; } }
      const c = clampR(nx, nz, 158); P.pos.x = c[0]; P.pos.z = c[1];
      P.pos.y = this.groundAt(P.pos.x, P.pos.z);
      const v = Math.hypot(P.vel.x, P.vel.z); P.moving = v > 0.4;
      if (P.moving) { const before = Math.floor(P.step / Math.PI); P.step += dt * v * 2.4; if (Math.floor(P.step / Math.PI) !== before) Plugins.emit('onStep', { crouch, game: this }); }
      P.eye += ((crouch ? EYE_CROUCH : EYE) - P.eye) * Math.min(1, dt * 8);
      const bob = P.moving && !Core.profile.settings.reducedMotion ? Math.sin(P.step * 2) * (crouch ? 0.015 : 0.035) : 0;
      this.camera.position.set(P.pos.x, P.pos.y + P.eye + bob, P.pos.z);
      let sway = 0, swayY = 0;
      if (this.draw && this.draw.hold > 2 && !this.steady) { const f = Math.min(1, (this.draw.hold - 2) / 2); sway = Math.sin(this.t * 1.7) * 0.006 * f; swayY = Math.sin(this.t * 2.3) * 0.005 * f; }
      this.camera.rotation.set(P.pitch + swayY, P.yaw + sway, 0);
      const fov = this.steady ? 40 : 72;
      if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 10); this.camera.updateProjectionMatrix(); }
    }
    ambientCamera(dt) {
      // slow panorama from a clearing at the centre of the forest
      if (!this.ambSpot) this.ambSpot = this.dryNear(0, 0);
      const [x, z] = this.ambSpot;
      this.camera.position.set(x, this.groundAt(x, z) + 2.1, z);
      this.camera.rotation.set(0.02 + Math.sin(this.t * 0.07) * 0.03, -this.t * 0.035, 0);
      if (this.camera.fov !== 72) { this.camera.fov = 72; this.camera.updateProjectionMatrix(); }
    }
    playerState() { const P = this.player; return { x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), y: +P.pos.y.toFixed(2), yaw: +P.yaw.toFixed(3), c: (P.crouch || P.crouchHold) ? 1 : 0, d: this.draw ? 1 : 0 }; }
    setOpponent(p, name, color) {
      if (this.mode !== 'vs') return;
      if (!this.avatar) {
        this.avatar = Models3D.ranger(color || '#a8643f'); this.scene.add(this.avatar);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
        x.fillStyle = 'rgba(10,12,10,0.65)'; x.fillRect(0, 8, 256, 48); x.font = '600 30px Inter, sans-serif'; x.fillStyle = '#e8d3c0'; x.textAlign = 'center'; x.fillText(String(name || 'Opponent').slice(0, 16), 128, 43);
        const spr = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, fog: false })); spr.scale.set(1.6, 0.4, 1); spr.position.y = 2.45; this.avatar.add(spr);
        this.avatar.position.set(p.x, p.y, p.z); this.avatarTarget = {};
      }
      Object.assign(this.avatarTarget, p);
    }
    removeAvatar() { if (this.avatar) { this.scene.remove(this.avatar); this.avatar = null; } }
    updateAvatar(dt) {
      if (!this.avatar || !this.avatarTarget) return;
      const A = this.avatar, p = this.avatarTarget, k = Math.min(1, dt * 8);
      A.position.x += (p.x - A.position.x) * k; A.position.z += (p.z - A.position.z) * k; A.position.y = this.groundAt(A.position.x, A.position.z);
      A.rotation.y = lerpAngle(A.rotation.y, p.yaw + Math.PI, k);
      A.scale.y += ((p.c ? 0.7 : 1) - A.scale.y) * k;
      if (A.userData.arm) A.userData.arm.rotation.x = p.d ? -0.5 : 0.6;
    }

    // ---------------- frame ----------------
    frame(dt) {
      if (!this.world) this.ensureWorld('meadow');
      if (!this.paused) {
        this.t += dt;
        if (this.live) {
          this.clock += dt;
          if (this.draw) this.draw.hold += dt;
          this.updatePlayer(dt); this.updateReload(dt);
        } else if (this.mode === 'ambient') this.ambientCamera(dt);
        this.updateSpawns(dt); this.updateAnimals(dt); this.updatePebbles(dt); this.updateAvatar(dt);
        for (const p of this.parts) { p.t += dt; p.v.y -= 4 * dt; p.p.addScaledVector(p.v, dt); }
        this.parts = this.parts.filter(p => p.t < p.life);
        for (const f of this.floaters) { f.t += dt; f.pos.y += 0.5 * dt; }
        this.floaters = this.floaters.filter(f => f.t < 1.4);
        if (this.flies) { this.flies.position.set(this.camera.position.x, this.h(this.camera.position.x, this.camera.position.z), this.camera.position.z); this.flies.material.opacity = 0.5 + 0.4 * Math.sin(this.t * 2); }
        Plugins.emit('onUpdate', { dt, game: this });
        if (this.live && this.duration && this.clock >= this.duration) { this.endLive(); this.fire('timeup', {}); }
      }
      this.updateViewmodel(dt);
      if (this.world.sky) this.world.sky.position.copy(this.camera.position);
      this.renderer.render(this.scene, this.camera);
      this.renderOverlay();
    }
    project(v) { const p = v.clone().project(this.camera); if (p.z > 1 || p.z < -1) return null; return { x: (p.x + 1) / 2 * this.W, y: (1 - p.y) / 2 * this.H }; }
    renderOverlay() {
      const ctx = this.octx; ctx.clearRect(0, 0, this.W, this.H);
      Plugins.emit('onRenderBack', { ctx, game: this });
      // trajectory preview
      if (this.draw && this.live && Core.profile.settings.trajectory) {
        const pow = this.drawPower(), dir = this.aimDir(), spd = (14 + 32 * pow) * (this.loadout.speed / 1120);
        const p = this.camera.getWorldPosition(V()).add(dir.clone().multiplyScalar(0.45)), v = dir.multiplyScalar(spd), wv = this.windVec();
        const steps = Math.round(this.loadout.preview * 60 * 1.6);
        for (let i = 0; i < steps; i++) {
          const h = 1 / 60; v.addScaledVector(wv, h); v.y -= GRAV * h; if (this.rain) v.multiplyScalar(1 - this.rain * 0.12 * h); p.addScaledVector(v, h);
          if (i % 4 === 3 && i > 6) { const s = this.project(p); if (s) { ctx.fillStyle = `rgba(233,222,190,${0.7 * (1 - i / steps)})`; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, TAU); ctx.fill(); } }
          if (p.y < this.groundAt(p.x, p.z)) break;
        }
      }
      for (const q of this.parts) { const s = this.project(q.p); if (!s) continue; ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.col; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
      ctx.globalAlpha = 1;
      ctx.font = '600 14px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const f of this.floaters) { const s = this.project(f.pos); if (!s) continue; ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(f.text, s.x + 1, s.y + 1); ctx.fillStyle = f.col; ctx.fillText(f.text, s.x, s.y); }
      ctx.globalAlpha = 1;
      Plugins.emit('onRenderFront', { ctx, game: this });
    }
    // info for HUD
    hudInfo() {
      const P = this.player, st = this.stunnedNear(), pile = st ? null : this.nearest(this.piles, 2.6);
      let aimed = false;
      if (this.live) {
        const ray = new T.Ray(this.camera.position.clone(), this.aimDir()), c = V();
        for (const a of this.animals) { if (a.state === 'stunned' || a.pos.distanceTo(P.pos) > 70) continue; a.model.root.updateMatrixWorld(); for (const hs of a.model.hit) { c.copy(hs.c).applyMatrix4(a.model.root.matrixWorld); if (ray.distanceSqToPoint(c) < hs.r * hs.r * 1.5) { aimed = true; break; } } if (aimed) break; }
      }
      return { prompt: st ? 'Tag the subdued animal' : pile ? `Gather ${pile.n} stone${pile.n > 1 ? 's' : ''}` : null, nearPile: !!pile, nearStunned: !!st, aimed, power: this.draw ? this.drawPower() : 0, crouch: P.crouch || P.crouchHold };
    }
  }
  function clampR(x, z, R) { R = R || 160; const d = Math.hypot(x, z); return d > R ? [x / d * R, z / d * R] : [x, z]; }
  function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * Math.min(1, k); }
  function segSphere(a, b, c, r) {
    const ab = new T.Vector3().subVectors(b, a), ac = new T.Vector3().subVectors(c, a);
    const t = Math.max(0, Math.min(1, ac.dot(ab) / (ab.lengthSq() || 1e-9)));
    return a.clone().addScaledVector(ab, t).distanceToSquared(c) <= r * r;
  }
  window.Game = Game; window.genSpawn = genSpawn;
})();
