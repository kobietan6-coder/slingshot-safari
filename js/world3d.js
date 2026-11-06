/* Procedural low-poly forest: terrain, sky, vegetation, rocks, water, stone piles. Deterministic per region. */
(function () {
  const T = THREE;
  const SIZE = 360, SEG = 120, EDGE = 150;
  const STYLE = {
    meadow: { amp: 5, off: 0, fog: [28, 200], trees: 320, groves: 10, bushes: 520, grass: 9000, rocks: 120, tree: 'broad', grassCol: '#5d6b3c' },
    rainforest: { amp: 7, off: 0, fog: [10, 105], trees: 1000, groves: 0, bushes: 1100, grass: 6000, rocks: 90, tree: 'tropical', grassCol: '#2f4a2a', ferns: true },
    mangrove: { amp: 2.4, off: 0.2, fog: [18, 150], trees: 620, groves: 0, bushes: 380, grass: 5000, rocks: 60, tree: 'mangrove', grassCol: '#4b5a3a', water: true },
    highlands: { amp: 13, off: 0, fog: [30, 230], trees: 460, groves: 0, bushes: 360, grass: 7000, rocks: 320, tree: 'pine', grassCol: '#7a6a3e' },
  };
  const col = (h, v) => { const c = new T.Color(h); if (v) c.offsetHSL(0, 0, v); return c; };

  class World {
    constructor(scene, regionId, night) {
      this.scene = scene; this.region = SpeciesDB.region(regionId); this.id = this.region.id; this.st = STYLE[this.id];
      this.night = !!night; this.root = new T.Group(); scene.add(this.root);
      const r = Core.mulberry32(Core.hashStr('forest-' + this.id));
      this.p = [r() * 6, r() * 6, r() * 6, r() * 6, r() * 6];
      this.trunkGrid = new Map(); this.perches = []; this.rocks = [];
      this.buildSky(); this.buildTerrain(r); this.buildVegetation(r); this.buildPiles(r); this.buildLights();
    }
    h(x, z) {
      const p = this.p, a = this.st.amp;
      let y = a * (0.55 * Math.sin(x * 0.021 + p[0]) * Math.cos(z * 0.018 + p[1]) + 0.3 * Math.sin((x + z) * 0.043 + p[2]) + 0.15 * Math.sin(x * 0.11 + p[3]) * Math.cos(z * 0.09 + p[4]));
      y += a * 0.06 * Math.sin(x * 0.31 + z * 0.27);
      if (this.st.water) y = y - this.st.off + 0.8 * Math.sin(x * 0.05 + p[1]) * Math.sin(z * 0.06);
      const rr = Math.hypot(x, z); if (rr > EDGE) y += (rr - EDGE) * (rr - EDGE) * 0.03;
      return y;
    }
    palette() {
      const R = this.region;
      if (!this.night) return { skyTop: R.sky[0], skyMid: R.sky[1], horizon: R.sky[2], ground: R.ground, hills: R.hills };
      return { skyTop: '#03060b', skyMid: '#0b131c', horizon: '#18222b', ground: R.ground.map(c => Art.shade(c, -0.5)), hills: R.hills.map(c => Art.shade(c, -0.55)) };
    }
    buildSky() {
      const P = this.palette();
      const g = new T.SphereGeometry(500, 24, 14), cs = [], top = col(P.skyTop), mid = col(P.skyMid), hor = col(P.horizon);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 500; const c = new T.Color();
        if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6)); else c.copy(hor).lerp(mid, Math.max(0, (y + 0.05) / 0.3));
        cs.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(cs, 3));
      this.sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
      this.sky.renderOrder = -1; this.root.add(this.sky);
      // sun / moon disc
      const disc = new T.Mesh(new T.CircleGeometry(this.night ? 10 : 16, 24), new T.MeshBasicMaterial({ color: this.night ? 0xdfe4e6 : 0xffeec8, fog: false, transparent: true, opacity: 0.9 }));
      disc.position.set(-260, this.night ? 230 : 150, -300); disc.lookAt(0, 0, 0); this.root.add(disc); this.disc = disc;
      // far ridges
      const ridgeMat = new T.MeshBasicMaterial({ color: col(P.hills[0]).lerp(hor, 0.45), fog: false });
      const r = Core.mulberry32(Core.hashStr('ridge-' + this.id));
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * Math.PI * 2 + r() * 0.2, d = 330 + r() * 60, hgt = (this.id === 'highlands' ? 90 : 45) + r() * 60;
        const m = new T.Mesh(new T.ConeGeometry(60 + r() * 50, hgt, 5), ridgeMat);
        m.position.set(Math.cos(a) * d, hgt / 2 - 12, Math.sin(a) * d); m.rotation.y = r() * 3; this.root.add(m);
      }
      this.scene.background = col(P.horizon);
      const f = this.st.fog; this.scene.fog = new T.Fog(col(P.horizon), this.night ? f[0] * 0.6 : f[0], this.night ? f[1] * 0.7 : f[1]);
    }
    buildTerrain(r) {
      const g = new T.PlaneGeometry(SIZE + 120, SIZE + 120, SEG, SEG); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, P = this.palette();
      const g0 = col(P.ground[0]), g1 = col(P.ground[1]), rock = col(this.id === 'highlands' ? '#6b5b48' : '#555a4c'), mud = col('#4a4433');
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, this.h(x, z)); }
      const tg = g.toNonIndexed(); tg.computeVertexNormals();
      const p2 = tg.attributes.position, n2 = tg.attributes.normal, cs = [];
      for (let i = 0; i < p2.count; i += 3) {
        const y = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3, slope = 1 - n2.getY(i);
        const c = g0.clone().lerp(g1, 0.5 + 0.5 * Math.sin(p2.getX(i) * 0.05 + p2.getZ(i) * 0.04));
        c.lerp(rock, Math.min(1, slope * 3.5));
        if (this.st.water && y < 0.4) c.lerp(mud, 0.7);
        if (this.night) c.multiplyScalar(0.55);
        const v = (r() - 0.5) * 0.05; c.offsetHSL(0, 0, v);
        for (let k = 0; k < 3; k++) cs.push(c.r, c.g, c.b);
      }
      tg.setAttribute('color', new T.Float32BufferAttribute(cs, 3));
      this.terrain = new T.Mesh(tg, new T.MeshLambertMaterial({ vertexColors: true }));
      this.root.add(this.terrain);
      if (this.st.water) {
        const w = new T.Mesh(new T.PlaneGeometry(SIZE + 120, SIZE + 120), new T.MeshLambertMaterial({ color: this.night ? 0x10202a : 0x40606a, transparent: true, opacity: 0.82 }));
        w.rotation.x = -Math.PI / 2; w.position.y = 0; this.root.add(w); this.water = w;
      }
    }
    okSpot(x, z, clear) {
      const rr = Math.hypot(x, z); if (rr > EDGE - 4) return false;
      if (clear && rr < 9) return false;
      if (this.st.water && this.h(x, z) < (this.st.tree === 'mangrove' ? -0.6 : 0.2)) return false;
      return true;
    }
    addTrunk(x, z, rad, hgt) {
      const k = Math.floor(x / 10) + ',' + Math.floor(z / 10);
      if (!this.trunkGrid.has(k)) this.trunkGrid.set(k, []);
      this.trunkGrid.get(k).push({ x, z, r: rad, h: hgt });
    }
    trunksNear(x, z) {
      const out = [], cx = Math.floor(x / 10), cz = Math.floor(z / 10);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.trunkGrid.get((cx + i) + ',' + (cz + j)); if (a) out.push(...a); }
      return out;
    }
    buildVegetation(r) {
      const st = this.st, P = this.palette(), dark = this.night ? -0.28 : 0;
      const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), e = new T.Euler();
      const place = (inst, i, x, y, z, sx, sy, sz, ry, rx, rz) => { e.set(rx || 0, ry || 0, rz || 0); q.setFromEuler(e); m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); inst.setMatrixAt(i, m4); };
      const N = st.trees;
      const trunkG = new T.CylinderGeometry(0.7, 1, 1, 6); trunkG.translate(0, 0.5, 0);
      const crownG = new T.IcosahedronGeometry(1, 0), coneG = new T.ConeGeometry(1, 1, 7); coneG.translate(0, 0.5, 0);
      const trunkM = new T.MeshLambertMaterial({ color: col(st.tree === 'pine' ? '#4a3a2c' : st.tree === 'tropical' ? '#5a5244' : '#4d3d2e', dark), flatShading: true });
      const leafM = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
      const crownsPer = st.tree === 'pine' ? 3 : st.tree === 'tropical' ? 3 : 2;
      const trunks = new T.InstancedMesh(trunkG, trunkM, N * (st.tree === 'mangrove' ? 4 : 1));
      const crowns = new T.InstancedMesh(st.tree === 'pine' ? coneG : crownG, leafM, N * crownsPer);
      const leafBase = { broad: '#3f5a32', tropical: '#2a4a2a', mangrove: '#34503a', pine: '#2f4232' }[st.tree];
      let ti = 0, ci = 0, placed = 0, tries = 0;
      const groves = Array.from({ length: st.groves }, () => [(r() - 0.5) * 260, (r() - 0.5) * 260]);
      while (placed < N && tries < N * 6) {
        tries++;
        let x, z;
        if (groves.length && r() < 0.6) { const g = groves[Math.floor(r() * groves.length)]; x = g[0] + (r() - 0.5) * 40; z = g[1] + (r() - 0.5) * 40; }
        else { x = (r() - 0.5) * 2 * EDGE; z = (r() - 0.5) * 2 * EDGE; }
        if (!this.okSpot(x, z, true)) continue;
        const y = this.h(x, z); placed++;
        const c = col(leafBase); c.offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08 + dark);
        if (st.tree === 'pine') {
          const H = 9 + r() * 10, R = 2 + r() * 1.5;
          place(trunks, ti++, x, y - 0.3, z, 0.35, H * 0.5, 0.35, r() * 3);
          for (let k = 0; k < 3; k++) { place(crowns, ci, x, y + H * (0.22 + k * 0.22), z, R * (1 - k * 0.25), H * 0.42, R * (1 - k * 0.25), r() * 3); crowns.setColorAt(ci++, c); }
          this.addTrunk(x, z, 0.45, H); this.perches.push(new T.Vector3(x, y + H * 0.95, z));
        } else if (st.tree === 'tropical') {
          const emergent = r() < 0.22, H = emergent ? 20 + r() * 10 : 8 + r() * 7, R = emergent ? 6 + r() * 3 : 3 + r() * 2, tw = emergent ? 0.7 : 0.4;
          place(trunks, ti++, x, y - 0.3, z, tw, H, tw, r() * 3);
          for (let k = 0; k < 3; k++) { const a = r() * 6.28, d = R * 0.4; place(crowns, ci, x + Math.cos(a) * d, y + H - R * 0.2 + (r() - 0.5) * 1.5, z + Math.sin(a) * d, R * (0.7 + r() * 0.3), R * 0.38, R * (0.7 + r() * 0.3), r() * 3); crowns.setColorAt(ci++, c); }
          this.addTrunk(x, z, tw * 1.05, H); this.perches.push(new T.Vector3(x, y + H + R * 0.2, z));
        } else if (st.tree === 'mangrove') {
          const H = 4 + r() * 4, R = 2.2 + r() * 1.6;
          for (let k = 0; k < 4; k++) { const a = k * 1.57 + r() * 0.5; place(trunks, ti++, x + Math.cos(a) * 0.9, y - 0.4, z + Math.sin(a) * 0.9, 0.12, H * 0.55, 0.12, 0, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); }
          place(crowns, ci, x, y + H, z, R, R * 0.75, R, r() * 3); crowns.setColorAt(ci++, c);
          place(crowns, ci, x + (r() - 0.5) * 2, y + H + 0.6, z + (r() - 0.5) * 2, R * 0.7, R * 0.6, R * 0.7, r() * 3); crowns.setColorAt(ci++, c);
          this.addTrunk(x, z, 1.0, H); this.perches.push(new T.Vector3(x, y + H + R * 0.7, z));
        } else {
          const H = 5 + r() * 6, R = 2.4 + r() * 2;
          place(trunks, ti++, x, y - 0.3, z, 0.35, H, 0.35, r() * 3);
          place(crowns, ci, x, y + H, z, R, R * 0.85, R, r() * 3); crowns.setColorAt(ci++, c);
          place(crowns, ci, x + (r() - 0.5) * R, y + H - R * 0.4, z + (r() - 0.5) * R, R * 0.7, R * 0.6, R * 0.7, r() * 3); crowns.setColorAt(ci++, c);
          this.addTrunk(x, z, 0.45, H); this.perches.push(new T.Vector3(x, y + H + R * 0.8, z));
        }
      }
      trunks.count = ti; crowns.count = ci; crowns.instanceColor.needsUpdate = true;
      this.root.add(trunks, crowns);
      // bushes
      const bushes = new T.InstancedMesh(crownG, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), st.bushes);
      let bi = 0;
      for (let i = 0; i < st.bushes; i++) {
        const x = (r() - 0.5) * 2 * EDGE, z = (r() - 0.5) * 2 * EDGE; if (!this.okSpot(x, z, false) || Math.hypot(x, z) < 4) continue;
        const sc = 0.6 + r() * 1.3; place(bushes, bi, x, this.h(x, z) + sc * 0.3, z, sc * (1 + r() * 0.5), sc * 0.7, sc, r() * 3);
        const c = col(st.ferns ? '#2e4f2c' : '#3a4f2e'); c.offsetHSL(0, 0, (r() - 0.5) * 0.08 + dark); bushes.setColorAt(bi++, c);
      }
      bushes.count = bi; bushes.instanceColor.needsUpdate = true; this.root.add(bushes);
      // grass / ferns: crossed blades
      const blade = new T.BufferGeometry();
      const v = []; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, cx = Math.cos(a) * 0.12, cz = Math.sin(a) * 0.12; v.push(-cx, 0, -cz, cx, 0, cz, 0, 1, 0); }
      blade.setAttribute('position', new T.Float32BufferAttribute(v, 3)); blade.computeVertexNormals();
      const grass = new T.InstancedMesh(blade, new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide }), st.grass);
      let gi = 0;
      for (let i = 0; i < st.grass; i++) {
        const rad = Math.sqrt(r()) * EDGE, a = r() * 6.28, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        const y = this.h(x, z); if (this.st.water && y < 0.1) continue;
        const sc = 0.35 + r() * 0.6; place(grass, gi, x, y - 0.02, z, sc * 1.8, sc, sc * 1.8, r() * 3, (r() - 0.5) * 0.3);
        const c = col(st.grassCol); c.offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12 + dark); grass.setColorAt(gi++, c);
      }
      grass.count = gi; grass.instanceColor.needsUpdate = true; this.root.add(grass);
      // rocks
      const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), st.rocks);
      let ri = 0;
      for (let i = 0; i < st.rocks; i++) {
        const x = (r() - 0.5) * 2 * EDGE, z = (r() - 0.5) * 2 * EDGE; if (!this.okSpot(x, z, true)) continue;
        const sc = 0.4 + r() * r() * 2.2; place(rocks, ri, x, this.h(x, z) + sc * 0.2, z, sc * (1 + r() * 0.6), sc * 0.7, sc, r() * 3, r(), r());
        const c = col(this.id === 'highlands' ? '#7a6a58' : '#6a6c62'); c.offsetHSL(0, 0, (r() - 0.5) * 0.1 + dark); rocks.setColorAt(ri++, c);
        this.rocks.push({ x, z, r: sc });
        if (sc > 0.9) this.addTrunk(x, z, sc * 0.9, sc * 1.2);
      }
      rocks.count = ri; rocks.instanceColor.needsUpdate = true; this.root.add(rocks);
    }
    buildPiles(r) {
      this.pileSpots = [];
      for (let i = 0; i < 40; i++) {
        const base = this.rocks.length && r() < 0.6 ? this.rocks[Math.floor(r() * this.rocks.length)] : { x: (r() - 0.5) * 260, z: (r() - 0.5) * 260, r: 0 };
        const a = r() * 6.28, x = base.x + Math.cos(a) * (base.r + 1.2), z = base.z + Math.sin(a) * (base.r + 1.2);
        if (Math.hypot(x, z) > EDGE - 6 || (this.st.water && this.h(x, z) < 0.05)) continue;
        this.pileSpots.push({ x, z, n: 2 + Math.floor(r() * 3) });
      }
      // a guaranteed pile near the start
      this.pileSpots.unshift({ x: 3.2, z: -4.5, n: 4 });
    }
    buildLights() {
      const n = this.night;
      this.hemi = new T.HemisphereLight(n ? 0x6a7fa0 : 0xdfe6d6, n ? 0x10130f : 0x3a3326, n ? 0.38 : 0.95);
      this.sun = new T.DirectionalLight(n ? 0x9fb4d8 : 0xffe9c8, n ? 0.35 : 0.85);
      this.sun.position.set(-120, 160, -140);
      this.root.add(this.hemi, this.sun);
    }
    dispose() {
      this.scene.remove(this.root);
      this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    }
  }
  World.EDGE = EDGE;
  window.World3D = World;
})();
