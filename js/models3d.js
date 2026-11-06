/* Procedural low-poly 3D animal models built from primitives. Models face +Z, up +Y, units = metres. */
(function () {
  const T = THREE;
  const mats = {}, geos = {};
  const M = (hex, opts) => { const k = hex + (opts ? JSON.stringify(opts) : ''); return mats[k] || (mats[k] = new T.MeshLambertMaterial(Object.assign({ color: new T.Color(hex) }, opts || {}))); };
  function wingShape() {
    const s = new T.Shape();
    s.moveTo(0, 0.04);
    s.bezierCurveTo(0.2, 0.2, 0.55, 0.2, 1, 0.02);
    s.bezierCurveTo(1.04, -0.02, 0.78, -0.16, 0.46, -0.2);
    s.bezierCurveTo(0.18, -0.14, 0.02, -0.04, 0, 0.04);
    const g = new T.ShapeGeometry(s, 8);
    g.rotateX(Math.PI / 2); g.computeVertexNormals(); return g;
  }
  function featherShape() {
    const s = new T.Shape();
    s.moveTo(0, 0.18);
    s.quadraticCurveTo(0.42, 0.22, 1, 0);
    s.quadraticCurveTo(0.42, -0.22, 0, -0.18);
    const g = new T.ShapeGeometry(s, 3);
    g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2); g.computeVertexNormals(); return g;
  }
  const G = {
    get sph() { return geos.sph || (geos.sph = new T.SphereGeometry(1, 12, 10)); },
    get egg() { return geos.egg || (geos.egg = new T.SphereGeometry(1, 16, 12)); },
    get cone() { return geos.cone || (geos.cone = (() => { const g = new T.ConeGeometry(1, 1, 8); g.rotateX(Math.PI / 2); return g; })()); }, // tip toward +Z, centered
    get cyl() { return geos.cyl || (geos.cyl = (() => { const g = new T.CylinderGeometry(1, 1, 1, 7); g.translate(0, -0.5, 0); return g; })()); }, // hangs down from origin
    get box() { return geos.box || (geos.box = new T.BoxGeometry(1, 1, 1)); },
    get oct() { return geos.oct || (geos.oct = new T.OctahedronGeometry(1, 0)); },
    get wing() { return geos.wing || (geos.wing = wingShape()); },
    get feather() { return geos.feather || (geos.feather = featherShape()); },
  };
  const SHEET = { side: T.DoubleSide };
  function part(parent, geo, color, pos, scale, rot, matOpts) {
    const m = new T.Mesh(geo, typeof color === 'string' ? M(color, matOpts) : color);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m); return m;
  }
  function pivot(parent, pos) { const g = new T.Group(); g.position.set(pos[0], pos[1], pos[2]); parent.add(g); return g; }
  const colors = (sp, gender) => Object.assign({}, sp.art, gender === 'female' && sp.artF ? sp.artF : {});

  function bird(sp, gender) {
    const a = colors(sp, gender), raptor = a.t === 'raptor', owl = a.t === 'owl';
    const L = Math.max(0.32, sp.size / 100 * 0.85);
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const back = a.back || '#555', belly = a.belly || back, head = a.head || back, wing = a.wing || back;
    const slim = !!(a.heron || a.streamer);
    const bw = L * (owl ? 0.2 : a.duck ? 0.17 : slim ? 0.11 : raptor ? 0.15 : 0.145);
    const bh = L * (owl ? 0.18 : a.duck ? 0.12 : slim ? 0.09 : 0.13);
    const bl = L * (a.duck ? 0.32 : slim ? 0.3 : raptor ? 0.28 : 0.26);
    part(body, G.egg, back, [0, bh * 0.02, 0], [bw, bh, bl]);
    part(body, G.egg, belly, [0, -bh * 0.32, bl * 0.04], [bw * 0.88, bh * 0.7, bl * 0.78]);
    if (a.vent) part(body, G.egg, a.vent, [0, -bh * 0.28, -bl * 0.5], [bw * 0.42, bh * 0.32, bl * 0.26]);
    if (raptor && a.under) part(body, G.egg, a.under, [0, -bh * 0.05, bl * 0.1], [bw * 1.02, bh * 0.55, bl * 0.5]);
    const neck = (a.neck || 0) * L + (a.duck ? L * 0.05 : 0);
    const hr = L * (owl ? 0.15 : raptor ? 0.095 : a.heron ? 0.062 : a.slowFlap ? 0.1 : slim ? 0.085 : 0.105);
    const hz = bl * 0.78 + neck * (a.heron ? 0.4 : a.duck ? 0.55 : 0.9);
    const hy = bh * 0.35 + neck * (a.heron ? 1.2 : a.duck ? 0.2 : 0.5);
    if (neck > 0.02) part(body, G.egg, a.throat || head, [0, (bh * 0.3 + hy) / 2, (bl * 0.5 + hz) / 2], [hr * 0.48, Math.max(hr * 0.4, Math.abs(hy) * 0.45), hr * 0.48]);
    const hd = pivot(body, [0, hy, hz]);
    part(hd, G.egg, head, [0, 0, 0], [hr * 0.92, hr * 0.98, hr * (a.slowFlap ? 1.12 : 1.02)]);
    if (a.throat && !a.duck) part(hd, G.egg, a.throat, [0, -hr * 0.32, hr * 0.15], [hr * 0.7, hr * 0.5, hr * 0.6]);
    if (a.collar2) part(hd, G.egg, a.collar2, [0, -hr * 0.62, -hr * 0.05], [hr * 1.02, hr * 0.26, hr * 0.85]);
    if (owl) {
      part(hd, G.egg, a.disc || '#c4a574', [0, -hr * 0.02, hr * 0.45], [hr * 0.9, hr, hr * 0.32]);
      part(hd, G.cone, head, [-hr * 0.42, hr * 0.7, -hr * 0.05], [hr * 0.14, hr * 0.12, hr * 0.5], [-0.6, 0, 0.25]);
      part(hd, G.cone, head, [hr * 0.42, hr * 0.7, -hr * 0.05], [hr * 0.14, hr * 0.12, hr * 0.5], [-0.6, 0, -0.25]);
    }
    if (a.mask) part(hd, G.egg, a.mask, [0, hr * 0.02, hr * 0.5], [hr * 1.02, hr * 0.28, hr * 0.38]);
    const blen = L * (a.beakL || 0.22) * (raptor || owl ? 0.28 : 0.4);
    part(hd, G.cone, a.beak || '#2c261e', [0, a.flat ? -hr * 0.02 : -hr * 0.08, hr * 0.72 + blen * 0.35], [hr * (a.flat ? 0.38 : a.beakDeep || a.hook || raptor ? 0.26 : 0.18), hr * (a.flat ? 0.14 : a.beakDeep ? 0.3 : 0.16), blen], [(a.curve || 0) * 0.7 + (a.hook || raptor ? 0.4 : 0), 0, 0]);
    if (a.hook || raptor) part(hd, G.cone, Art.shade(a.beak || '#2c261e', -0.15), [0, -hr * 0.28, hr * 0.7 + blen * 0.9], [hr * 0.08, hr * 0.06, blen * 0.4], [1.15, 0, 0]);
    if (a.casque) {
      const up = a.casqueUp ? 0.9 : a.casqueFlat ? 0.32 : 0.48;
      part(hd, G.egg, a.casque, [0, hr * (0.28 + up * 0.4), hr * 0.55 + blen * 0.2], [hr * (a.casqueFlat ? 0.5 : 0.3), hr * up, blen * 0.75]);
      if (a.casqueMark) part(hd, G.egg, a.casqueMark, [0, hr * 0.55, hr * 0.7 + blen * 0.35], [hr * 0.1, hr * 0.16, blen * 0.18]);
    }
    if (a.crestBig) {
      for (let i = 0; i < 5; i++) part(hd, G.cone, i >= 3 ? (a.crestTip || a.crest) : a.crest, [0, hr * 0.45, -hr * 0.1], [hr * 0.055, hr * 0.04, hr * (0.5 + i * 0.07)], [-0.35 + i * 0.3, 0, 0]);
    } else if (a.crest) {
      part(hd, G.cone, a.crest, [0, hr * 0.75, -hr * 0.1], [hr * 0.1, hr * 0.07, hr * 0.42], [-0.9, 0, 0]);
      if (a.crestTip) part(hd, G.egg, a.crestTip, [0, hr * 1.05, -hr * 0.28], [hr * 0.07, hr * 0.07, hr * 0.08]);
    }
    const eye = hr * (owl ? 0.26 : 0.13);
    for (const sx of [-1, 1]) {
      part(hd, G.egg, owl ? (a.eye || '#e6b23a') : '#f3f0e8', [sx * hr * 0.48, hr * 0.16, hr * 0.55], [eye, eye, eye * 0.65]);
      part(hd, G.egg, '#14120f', [sx * hr * 0.55, hr * 0.16, hr * 0.72], [eye * 0.45, eye * 0.45, eye * 0.28]);
    }
    const tl = L * (a.tailL || 0.34);
    const tail = pivot(body, [0, bh * 0.02, -bl * 0.72]);
    const nFeather = a.streamer ? 2 : a.duck ? 6 : raptor || owl ? 6 : 5;
    const spread = a.streamer ? 0.06 : raptor ? 0.14 : 0.11;
    for (let i = 0; i < nFeather; i++) {
      const k = i - (nFeather - 1) / 2;
      const band = a.tailBand && Math.abs(k) <= spread;
      const colr = band ? a.tailBand : (a.tail || back);
      const f = part(tail, G.feather, colr, [0, 0, 0], [L * (a.streamer ? 0.07 : 0.2), 1, tl * (a.streamer ? 1.45 : 1)], null, SHEET);
      f.rotation.y = k * spread; f.rotation.x = a.duck ? -0.35 : -0.12;
    }
    if (a.tailTip) {
      const tip = part(tail, G.feather, a.tailTip, [0, 0.004, -tl * 0.35], [L * 0.16, 1, tl * 0.4], null, SHEET);
      tip.rotation.x = -0.12;
    }
    const span = L * (raptor ? (a.narrow ? 0.9 : 1.2) : a.heron ? 1.05 : owl ? 0.9 : a.slowFlap ? 0.85 : a.streamer ? 0.7 : 0.75);
    const chord = L * (raptor ? 0.46 : owl ? 0.4 : a.duck ? 0.3 : a.heron ? 0.34 : 0.28);
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = pivot(body, [sx * bw * 0.9, bh * 0.2, bl * 0.02]);
      part(w, G.wing, wing, [0, 0, 0], [sx * span, 1, chord / 0.4], null, SHEET);
      const tip = pivot(w, [sx * span * 0.58, 0, -chord * 0.08]);
      part(tip, G.wing, a.wingTip || Art.shade(wing, -0.2), [0, 0, 0], [sx * span * 0.55, 1, chord * 0.85 / 0.4], null, SHEET);
      if (raptor) for (let f = 0; f < 3; f++) {
        const pf = part(tip, G.feather, a.wingTip || Art.shade(wing, -0.28), [sx * span * 0.2, 0, 0], [L * 0.045, 1, chord * (0.7 + f * 0.12)], null, SHEET);
        pf.rotation.y = sx * (0.25 + f * 0.22);
      }
      if (a.patch) part(w, G.egg, a.patch, [sx * span * 0.32, 0.01, -chord * 0.08], [span * 0.14, L * 0.015, chord * 0.28]);
      w.userData.tip = tip; w.userData.side = sx; wings.push(w);
    }
    const legs = new T.Group(); body.add(legs);
    const legC = a.legsTrail || '#b7a48c';
    const legH = L * (a.heron ? 0.52 : a.duck ? 0.07 : 0.15);
    for (const sx of [-1, 1]) {
      part(legs, G.cyl, legC, [sx * bw * 0.45, -bh * 0.45, a.duck ? bl * 0.2 : bl * 0.02], [L * (a.heron ? 0.01 : 0.014), legH, L * 0.014]);
      part(legs, G.egg, legC, [sx * bw * 0.45, -bh * 0.45 - legH, L * 0.045], [L * 0.035, L * 0.01, L * (a.heron ? 0.07 : 0.045)]);
    }
    let flapHz = 12;
    if (a.slowFlap) flapHz = 3.2;
    else if (raptor) flapHz = a.narrow ? 7 : 2.7;
    else if (owl) flapHz = 4.4;
    else if (a.heron) flapHz = 2.5;
    else if (a.duck) flapHz = 8;
    else if (a.streamer) flapHz = 15;
    else if (sp.move === 'flit') flapHz = 16;
    else if (sp.move === 'soar') flapHz = 2.3;
    const hit = [{ c: new T.Vector3(0, 0, 0), r: Math.max(bw, bl) * 1.2 }, { c: new T.Vector3(0, hy, hz), r: hr * 1.45, head: true }];
    return { root, body, wings, legs, tail, head: hd, hit, height: hy + hr * 2, L, flyer: true, kind: 'bird', flapHz };
  }

  function quad(sp, gender) {
    const a = colors(sp, gender), L = sp.size / 100;
    const bodyL = a.bodyL * L, bodyH = a.bodyH * L, legL = a.legL * L, legW = (a.legW || 0.045) * L;
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const fur = a.fur, backC = a.back || fur, bellyC = a.belly || fur, legsC = a.legs || Art.shade(fur, -0.15);
    const by = legL + bodyH * 0.45, bw = bodyH * 0.42;
    part(body, G.sph, backC, [0, by + bodyH * 0.05, 0], [bw, bodyH * 0.5, bodyL * 0.55]);
    part(body, G.sph, bellyC, [0, by - bodyH * 0.12, 0], [bw * 0.95, bodyH * 0.4, bodyL * 0.5]);
    if (a.hump) part(body, G.sph, backC, [0, by + bodyH * 0.35, bodyL * 0.22], [bw * 0.8, bodyH * 0.35, bodyL * 0.25]);
    if (a.saddle) part(body, G.sph, a.saddle, [0, by + bodyH * 0.02, -bodyL * 0.08], [bw * 1.04, bodyH * 0.53, bodyL * 0.24]);
    if (a.stripe) part(body, G.sph, a.stripe, [0, by, 0], [bw * 1.03, bodyH * 0.08, bodyL * 0.45]);
    if (a.spots || a.scales || a.bristle) {
      const r = Core.mulberry32(sp.index + 7), c = a.scales ? Art.shade(a.back, 0.12) : a.bristle ? Art.shade(backC, -0.3) : a.spots;
      for (let i = 0; i < (a.scales ? 18 : 10); i++) { const z = (r() - 0.5) * bodyL * 0.9, sx = (r() < 0.5 ? -1 : 1); part(body, a.scales ? G.cone : G.sph, c, [sx * bw * (a.bristle ? 0.1 : 0.7) * r(), by + bodyH * (0.25 + r() * 0.2), z], a.scales ? [bw * 0.35, bodyH * 0.12, bodyL * 0.12] : [bw * 0.15, bodyH * 0.1, bodyL * 0.06], a.scales ? [-0.4, 0, 0] : null); }
    }
    if (a.frost) part(body, G.sph, a.frost, [0, by + bodyH * 0.25, 0], [bw * 0.7, bodyH * 0.15, bodyL * 0.45]);
    // neck + head
    const neck = (a.neck || 0) * L, hl = a.headL * L, hh = hl * (a.primate ? 0.72 : 0.5);
    const hz = bodyL * 0.5 + hl * 0.25, hy = by + bodyH * 0.25 + neck + (a.primate ? bodyH * 0.1 : 0);
    part(body, G.sph, backC, [0, (by + hy) / 2 + bodyH * 0.1, bodyL * 0.42], [bw * 0.6, bodyH * 0.35 + neck * 0.5, hl * 0.35], [-0.5, 0, 0]);
    const hd = pivot(body, [0, hy, hz]);
    part(hd, G.sph, a.head || backC, [0, 0, 0], [hh * 0.62, hh * 0.6, hl * 0.42]);
    const sn = (a.snout || 0.08) * L;
    part(hd, G.cone, a.face || fur, [0, -hh * 0.12, hl * 0.3 + sn * 0.5], [hh * 0.38, hh * 0.32, sn + hl * 0.1]);
    if (a.trunk) part(hd, G.cyl, fur, [0, -hh * 0.15, hl * 0.4 + sn], [hh * 0.15, hh * 0.9, hh * 0.15], [0.5, 0, 0]);
    if (a.pig) part(hd, G.cyl, '#5a4842', [0, -hh * 0.12, hl * 0.32 + sn * 1.05], [hh * 0.2, sn * 0.05, hh * 0.2], [Math.PI / 2, 0, 0]);
    if (a.pig && gender === 'male') for (const sx of [-1, 1]) part(hd, G.cone, '#e8e0cc', [sx * hh * 0.25, -hh * 0.1, hl * 0.3 + sn * 0.6], [hh * 0.05, hh * 0.05, hh * 0.35], [-1.2, 0, 0]);
    if (a.mask) part(hd, G.sph, '#1a1816', [0, hh * 0.05, hl * 0.2], [hh * 0.64, hh * 0.25, hl * 0.25]);
    if (a.throat) part(hd, G.sph, '#efe6d4', [0, -hh * 0.45, 0], [hh * 0.3, hh * 0.15, hl * 0.3]);
    for (const sx of [-1, 1]) {
      part(hd, G.sph, '#0b0b0b', [sx * hh * 0.45, hh * 0.18, hl * 0.22], [hh * 0.08, hh * 0.08, hh * 0.06]);
      const es = (a.earS || 0.08) * L, ec = a.earC || Art.shade(fur, -0.1);
      if (a.ear === 'point' || a.ear === 'tuft') part(hd, G.cone, ec, [sx * hh * 0.35, hh * 0.5 + es * 0.4, -hl * 0.1], [es * 0.35, es * 0.2, es * 1.0], [-Math.PI / 2 + 0.2, 0, sx * 0.2]);
      else if (a.ear === 'long') part(hd, G.sph, ec, [sx * hh * 0.25, hh * 0.4 + es * 0.5, -hl * 0.2], [es * 0.12, es * 0.55, es * 0.2], [-0.35, 0, sx * 0.15]);
      else if (a.ear === 'round') part(hd, G.sph, a.earRim || ec, [sx * hh * 0.5, hh * 0.5, -hl * 0.1], [es * 0.5, es * 0.5, es * 0.2]);
    }
    if (a.antlers && gender === 'male') for (const sx of [-1, 1]) { const ant = pivot(hd, [sx * hh * 0.25, hh * 0.5, -hl * 0.05]); part(ant, G.cyl, '#8a7558', [0, 0, 0], [L * 0.012, L * 0.35, L * 0.012], [Math.PI, 0, sx * 0.35]); part(ant, G.cyl, '#8a7558', [sx * L * 0.06, L * 0.18, 0], [L * 0.01, L * 0.16, L * 0.01], [Math.PI, 0, -sx * 0.4]); }
    // legs
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const lp = pivot(body, [sx * bw * 0.6, legL + bodyH * 0.15, sz * bodyL * 0.3]);
      part(lp, G.cyl, legsC, [0, 0, 0], [legW * (sz < 0 ? 0.8 : 0.65), legL + bodyH * 0.15, legW * (sz < 0 ? 0.8 : 0.65)]);
      lp.userData.ph = (sx * sz > 0 ? 0 : Math.PI); legs.push(lp);
    }
    // tail
    const tail = pivot(body, [0, by + bodyH * 0.15, -bodyL * 0.52]);
    const tl = (a.tailL || 0.3) * L, tc = a.tailC || fur;
    if (a.tail === 'bushy') { part(tail, G.sph, tc, [0, a.tailUp ? tl * 0.45 : -tl * 0.15, -tl * (a.tailUp ? 0.25 : 0.45)], [(a.tailThick || 0.09) * L, a.tailUp ? tl * 0.5 : (a.tailThick || 0.09) * L * 1.2, a.tailUp ? (a.tailThick || 0.09) * L * 1.3 : tl * 0.55], a.tailUp ? null : [0.4, 0, 0]); if (a.tailTip) part(tail, G.sph, a.tailTip, [0, -tl * 0.4, -tl * 0.92], [L * 0.05, L * 0.05, L * 0.08]); }
    else if (a.tail === 'thin') part(tail, G.cyl, tc, [0, 0, 0], [(a.tailThick || 0.025) * L, tl, (a.tailThick || 0.025) * L], [a.tailUp ? -2.2 : -0.6, 0, 0]);
    else if (a.tail === 'thick') part(tail, G.cone, tc, [0, -bodyH * 0.25, -tl * 0.45], [bodyH * 0.3, bodyH * 0.2, tl], [Math.PI + 0.25, 0, 0]);
    else if (a.tail === 'puff') part(tail, G.sph, tc, [0, 0, 0], [L * 0.06, L * 0.06, L * 0.06]);
    else if (a.tail === 'stub') part(tail, G.sph, tc, [0, 0, 0], [L * 0.025, L * 0.03, L * 0.03]);
    const hit = [{ c: new T.Vector3(0, by, bodyL * 0.2), r: Math.max(bw, bodyH * 0.55) * 1.3 }, { c: new T.Vector3(0, by, -bodyL * 0.2), r: Math.max(bw, bodyH * 0.55) * 1.3 }, { c: new T.Vector3(0, hy, hz), r: hh * 0.75, head: true }];
    return { root, body, legs, tail, head: hd, hit, height: hy + hh, L, flyer: false, kind: 'quad' };
  }

  function roo(sp, gender) {
    const a = colors(sp, gender), L = sp.size / 100 * 1.1;
    const root = new T.Group(), body = new T.Group(); root.add(body);
    part(body, G.sph, a.fur, [0, L * 0.55, 0.0], [L * 0.16, L * 0.27, L * 0.15], [0.35, 0, 0]);
    part(body, G.sph, a.belly, [0, L * 0.5, L * 0.07], [L * 0.12, L * 0.2, L * 0.08], [0.35, 0, 0]);
    const legs = [];
    for (const sx of [-1, 1]) {
      const lp = pivot(body, [sx * L * 0.1, L * 0.3, -L * 0.05]);
      part(lp, G.sph, a.back || a.fur, [0, 0, 0], [L * 0.08, L * 0.15, L * 0.14]);
      part(lp, G.sph, Art.shade(a.fur, -0.15), [0, -L * 0.26, L * 0.1], [L * 0.04, L * 0.025, L * 0.28]);
      lp.userData.ph = 0; legs.push(lp);
      part(body, G.cyl, a.fur, [sx * L * 0.08, L * 0.68, L * 0.17], [L * 0.02, L * 0.16, L * 0.02], [-0.6, 0, 0]);
    }
    const tail = pivot(body, [0, L * 0.32, -L * 0.12]);
    part(tail, G.cone, a.fur, [0, -L * 0.12, -L * 0.3], [L * 0.06, L * 0.06, L * 0.6], [Math.PI + 0.35, 0, 0]);
    const hd = pivot(body, [0, L * 0.86, L * 0.1]);
    part(hd, G.sph, a.fur, [0, 0, 0], [L * 0.06, L * 0.06, L * 0.08]);
    part(hd, G.cone, a.muzzle || a.belly, [0, -L * 0.015, L * 0.09], [L * 0.04, L * 0.035, L * 0.08]);
    for (const sx of [-1, 1]) { part(hd, G.sph, Art.shade(a.fur, -0.15), [sx * L * 0.035, L * 0.08, -L * 0.02], [L * 0.015, L * 0.06, L * 0.025]); part(hd, G.sph, '#0b0b0b', [sx * L * 0.045, L * 0.015, L * 0.04], [L * 0.01, L * 0.01, L * 0.01]); }
    const hit = [{ c: new T.Vector3(0, L * 0.55, 0), r: L * 0.25 }, { c: new T.Vector3(0, L * 0.3, -L * 0.05), r: L * 0.2 }, { c: new T.Vector3(0, L * 0.86, L * 0.12), r: L * 0.09, head: true }];
    return { root, body, legs, tail, head: hd, hit, height: L * 0.95, L, flyer: false, kind: 'roo' };
  }

  function lizard(sp, gender) {
    const a = colors(sp, gender), L = sp.size / 100;
    const root = new T.Group(), body = new T.Group(); root.add(body);
    part(body, G.sph, a.back, [0, L * 0.07, 0], [L * 0.075, L * 0.055, L * 0.2]);
    part(body, G.sph, a.belly, [0, L * 0.05, 0], [L * 0.07, L * 0.04, L * 0.19]);
    const r = Core.mulberry32(3); for (let i = 0; i < 10; i++) part(body, G.sph, a.spots, [(r() - 0.5) * L * 0.1, L * 0.115, (r() - 0.5) * L * 0.35], [L * 0.012, L * 0.006, L * 0.012]);
    const hd = pivot(body, [0, L * 0.08, L * 0.24]);
    part(hd, G.cone, a.back, [0, 0, L * 0.05], [L * 0.045, L * 0.03, L * 0.14]);
    for (const sx of [-1, 1]) part(hd, G.sph, '#0b0b0b', [sx * L * 0.025, L * 0.012, L * 0.02], [L * 0.007, L * 0.007, L * 0.007]);
    const tail = pivot(body, [0, L * 0.07, -L * 0.18]);
    part(tail, G.cone, a.fur, [0, -L * 0.02, -L * 0.28], [L * 0.05, L * 0.035, L * 0.6], [Math.PI, 0, 0]);
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lp = pivot(body, [sx * L * 0.07, L * 0.07, sz * L * 0.11]); part(lp, G.cyl, a.fur, [0, 0, 0], [L * 0.014, L * 0.1, L * 0.014], [0, 0, sx * 0.7]); lp.userData.ph = sx * sz > 0 ? 0 : Math.PI; legs.push(lp); }
    const hit = [{ c: new T.Vector3(0, L * 0.07, L * 0.05), r: L * 0.12 }, { c: new T.Vector3(0, L * 0.06, -L * 0.25), r: L * 0.08 }, { c: new T.Vector3(0, L * 0.08, L * 0.3), r: L * 0.06, head: true }];
    return { root, body, legs, tail, head: hd, hit, height: L * 0.16, L, flyer: false, kind: 'lizard' };
  }

  function fowl(sp, gender) {
    const a = colors(sp, gender), L = sp.size / 100 * (a.small ? 0.85 : 1);
    const root = new T.Group(), body = new T.Group(); root.add(body);
    part(body, G.sph, a.body, [0, L * 0.32, 0], [L * 0.13, L * 0.14, L * 0.22]);
    part(body, G.sph, a.wing, [0, L * 0.34, -L * 0.02], [L * 0.135, L * 0.09, L * 0.16]);
    part(body, G.sph, a.hackle, [0, L * 0.45, L * 0.14], [L * 0.08, L * 0.12, L * 0.08], [0.4, 0, 0]);
    const hd = pivot(body, [0, L * 0.56, L * 0.2]);
    part(hd, G.sph, a.hackle, [0, 0, 0], [L * 0.055, L * 0.055, L * 0.06]);
    part(hd, G.cone, a.comb, [0, L * (a.small ? 0.045 : 0.06), L * 0.01], [L * 0.018, L * 0.012, L * (a.small ? 0.04 : 0.07)], [-1.15, 0, 0]);
    part(hd, G.cone, '#b9a37a', [0, -L * 0.005, L * 0.07], [L * 0.02, L * 0.015, L * 0.05]);
    for (const sx of [-1, 1]) part(hd, G.sph, '#0b0b0b', [sx * L * 0.04, L * 0.01, L * 0.025], [L * 0.008, L * 0.008, L * 0.008]);
    const tail = pivot(body, [0, L * 0.38, -L * 0.18]);
    const nTail = a.small ? 3 : 5;
    for (let i = 0; i < nTail; i++) {
      const f = part(tail, G.feather, a.tail, [0, 0, 0], [L * 0.06, 1, L * (a.small ? 0.22 : 0.42)], null, SHEET);
      f.rotation.y = (i - (nTail - 1) / 2) * 0.2;
      f.rotation.x = -1.05 + i * 0.08;
    }
    const legs = [];
    for (const sx of [-1, 1]) { const lp = pivot(body, [sx * L * 0.05, L * 0.22, 0]); part(lp, G.cyl, a.legs || '#666', [0, 0, 0], [L * 0.012, L * 0.22, L * 0.012]); lp.userData.ph = sx > 0 ? 0 : Math.PI; legs.push(lp); }
    const hit = [{ c: new T.Vector3(0, L * 0.33, 0), r: L * 0.24 }, { c: new T.Vector3(0, L * 0.56, L * 0.2), r: L * 0.08, head: true }];
    return { root, body, legs, tail, head: hd, hit, height: L * 0.65, L, flyer: false, kind: 'fowl' };
  }

  function build(sp, gender) {
    const t = sp.art.t;
    const m = (t === 'bird' || t === 'raptor' || t === 'owl') ? bird(sp, gender) : t === 'roo' ? roo(sp, gender) : t === 'lizard' ? lizard(sp, gender) : t === 'fowl' ? fowl(sp, gender) : quad(sp, gender);
    m.root.traverse(o => { if (o.isMesh) o.userData.animal = true; });
    return m;
  }

  // Animate: mode = 'fly' | 'glide' | 'perch' | 'walk' | 'run' | 'idle' | 'graze' | 'stunned'
  function animate(m, mode, t, speed) {
    if (m.flyer) {
      const hz = m.flapHz || 12;
      m.wings.forEach(w => {
        const s = w.userData.side, tip = w.userData.tip;
        if (mode === 'fly') {
          const flap = Math.sin(t * hz), up = Math.max(0, flap);
          w.rotation.set(flap * 0.35, s * flap * -0.1, s * flap * 1.05);
          tip.rotation.set(0, s * up * -0.12, s * (0.15 - up * 0.85));
        } else if (mode === 'glide') {
          const beat = Math.sin(t * 1.3) * 0.04;
          w.rotation.set(-0.1, s * -0.06, s * (0.2 + beat));
          tip.rotation.set(-0.04, 0, s * -0.22);
        } else {
          w.rotation.set(0.3, s * 1.05, s * -0.15);
          tip.rotation.set(0.1, s * 0.5, s * 0.35);
        }
      });
      m.legs.visible = mode !== 'fly' && mode !== 'glide';
      m.head.rotation.x = mode === 'perch' ? Math.sin(t * 0.7) * 0.16 : (mode === 'fly' ? -0.18 : -0.04);
      m.head.rotation.y = mode === 'perch' ? Math.sin(t * 0.5) * 0.4 : 0;
      m.tail.rotation.x = mode === 'fly' ? -0.18 + Math.sin(t * hz) * 0.1 : (mode === 'glide' ? -0.04 : -0.35 + Math.sin(t * 1.2) * 0.06);
      return;
    }
    const moving = mode === 'walk' || mode === 'run';
    const f = mode === 'run' ? 11 : 6, amp = mode === 'run' ? 0.7 : 0.4;
    m.legs.forEach(l => { l.rotation.x = moving ? Math.sin(t * f + l.userData.ph) * amp : 0; });
    m.head.rotation.x = mode === 'graze' ? 0.7 + Math.sin(t * 3) * 0.06 : 0;
    m.tail.rotation.y = Math.sin(t * 3) * 0.15;
  }

  // Ranger avatar for the opponent in VS
  function ranger(colorHex) {
    const root = new T.Group();
    part(root, G.cyl, '#2b2f2a', [-0.12, 0.9, 0], [0.08, 0.9, 0.08]); part(root, G.cyl, '#2b2f2a', [0.12, 0.9, 0], [0.08, 0.9, 0.08]);
    part(root, G.box, colorHex, [0, 1.25, 0], [0.48, 0.65, 0.28]);
    part(root, G.box, '#4a3d2e', [0, 1.3, -0.2], [0.36, 0.5, 0.16]);
    part(root, G.sph, '#c99a7a', [0, 1.72, 0], [0.13, 0.15, 0.13]);
    part(root, G.cyl, '#5a4a32', [0, 1.84, 0], [0.26, 0.03, 0.26]);
    part(root, G.cyl, '#5a4a32', [0, 1.95, 0], [0.14, 0.12, 0.14]);
    const arm = pivot(root, [0.3, 1.5, 0.05]); part(arm, G.cyl, colorHex, [0, 0, 0], [0.06, 0.55, 0.06], [-1.2, 0, 0]);
    part(arm, G.cyl, '#6a4a2a', [0, -0.18, 0.5], [0.025, 0.25, 0.025]);
    root.userData.arm = arm;
    return root;
  }

  window.Models3D = { build, animate, ranger, M, G };
})();
