/* Procedural, naturalistic animal renderer (canvas 2D). No external assets.
 * Art.draw(ctx, sp, {gender, t, stunned, sil, airborne, moving})
 * Birds/raptors/owls: origin = body centre. Ground animals: origin = feet on ground.
 */
(function () {
  const TAU = Math.PI * 2;
  function shade(hex, amt) { // amt -1..1
    if (!hex || hex[0] !== '#') return hex;
    let n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function lg(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  }
  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function colorsFor(sp, gender, sil) {
    const a = Object.assign({}, sp.art, gender === 'female' && sp.artF ? sp.artF : {});
    if (sil) { for (const k in a) if (typeof a[k] === 'string' && a[k][0] === '#') a[k] = sil; a.sil = sil; }
    return a;
  }
  const C = (a, k, d) => (a.sil ? a.sil : (a[k] || d));

  // ---------------- BIRDS ----------------
  function wingPath(ctx, sx, sy, span, chord, lift, fingers) {
    // lift: -1 (down) .. 1 (up). Side view of a flapping wing.
    const tipX = sx - span * 0.45, tipY = sy - span * 0.95 * lift;
    ctx.beginPath();
    ctx.moveTo(sx + chord * 0.45, sy);
    ctx.quadraticCurveTo(sx + chord * 0.2, sy - span * 0.55 * lift, tipX + chord * 0.15, tipY);
    if (fingers) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const fx = tipX + chord * 0.15 - i * chord * 0.16, fy = tipY + i * chord * 0.08 * Math.sign(lift || 1);
        ctx.lineTo(fx - chord * 0.18, fy + chord * 0.05 * Math.sign(lift || 1));
        ctx.lineTo(fx - chord * 0.1, fy + chord * 0.12 * Math.sign(lift || 1));
      }
    } else ctx.lineTo(tipX - chord * 0.25, tipY + chord * 0.1 * Math.sign(lift || 1));
    ctx.quadraticCurveTo(sx - chord * 0.5, sy - span * 0.35 * lift, sx - chord * 0.75, sy + 1);
    ctx.closePath();
  }

  function drawBird(ctx, sp, a, L, t, o) {
    const raptor = a.t === 'raptor', owl = a.t === 'owl';
    const bodyL = L * (a.duck ? 0.5 : a.heron ? 0.38 : raptor ? 0.42 : owl ? 0.42 : 0.46);
    const bodyH = L * (a.duck ? 0.22 : raptor ? 0.17 : owl ? 0.26 : 0.2);
    const back = C(a, 'back', '#555'), belly = C(a, 'belly', '#999'), head = C(a, 'head', back), wing = C(a, 'wing', back);
    let lift;
    if (o.stunned) lift = 0.05;
    else if (raptor || owl) lift = o.dive ? -0.15 : Math.sin(t * (owl ? 5 : 2.2)) * (0.25 + 0.55 * Math.max(0, Math.sin(t * 0.7)));
    else lift = Math.sin(t * (a.slowFlap ? 6.5 : 15) + (o.ph || 0)) * (a.slowFlap ? 0.8 : 0.95);
    const span = L * (raptor ? (a.narrow ? 0.62 : 0.78) : a.heron ? 0.7 : owl ? 0.66 : a.slowFlap ? 0.62 : 0.5);
    const chord = bodyL * (raptor ? (a.narrow ? 0.6 : 0.85) : owl ? 0.8 : 0.62);
    const sx = bodyL * 0.08, sy = -bodyH * 0.25;

    // far wing
    if (!o.stunned) {
      ctx.save(); ctx.globalAlpha *= 0.9;
      wingPath(ctx, sx + bodyL * 0.04, sy - 1, span * 0.9, chord * 0.95, lift * 0.85, raptor || owl);
      ctx.fillStyle = a.sil || shade(wing, -0.35); ctx.fill(); ctx.restore();
    }
    // trailing legs (heron)
    if (a.heron && a.legsTrail) {
      ctx.strokeStyle = C(a, 'legsTrail'); ctx.lineWidth = L * 0.018; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-bodyL * 0.25, bodyH * 0.2); ctx.lineTo(-bodyL * 0.5 - L * 0.38, bodyH * 0.25); ctx.stroke();
    }
    // tail
    const tailL = L * (a.tailL || 0.3), tx = -bodyL * 0.42;
    ctx.beginPath();
    const tw = raptor || owl ? bodyH * 0.45 : bodyH * 0.28;
    ctx.moveTo(tx + bodyL * 0.1, -bodyH * 0.22);
    ctx.lineTo(tx - tailL, -tw * 0.6 - (owl ? 0 : bodyH * 0.05));
    ctx.lineTo(tx - tailL * (raptor ? 1.0 : 0.96), tw * 0.5);
    ctx.lineTo(tx + bodyL * 0.1, bodyH * 0.15);
    ctx.closePath();
    const tc = C(a, 'tail', back);
    ctx.fillStyle = lg(ctx, 0, -tw, 0, tw, [[0, a.sil || shade(tc, 0.08)], [1, a.sil || shade(tc, -0.25)]]); ctx.fill();
    if (!a.sil && a.tailBand) { ctx.fillStyle = a.tailBand; ctx.fillRect(tx - tailL * 0.62, -tw * 0.7, tailL * 0.22, tw * 1.35); }
    if (!a.sil && a.tailTip) { ctx.fillStyle = a.tailTip; ctx.beginPath(); ctx.moveTo(tx - tailL * 0.82, -tw * 0.62); ctx.lineTo(tx - tailL, -tw * 0.6); ctx.lineTo(tx - tailL * 0.98, tw * 0.5); ctx.lineTo(tx - tailL * 0.8, tw * 0.48); ctx.fill(); }
    if (a.streamer) { ctx.strokeStyle = a.sil || tc; ctx.lineWidth = Math.max(1, L * 0.012); ctx.beginPath(); ctx.moveTo(tx - tailL * 0.8, 0); ctx.lineTo(tx - tailL * 1.45, bodyH * 0.05); ctx.stroke(); }

    // body
    ell(ctx, 0, 0, bodyL / 2, bodyH / 2, -0.04);
    ctx.fillStyle = a.sil || lg(ctx, 0, -bodyH / 2, 0, bodyH / 2, [[0, shade(back, 0.06)], [0.45, back], [0.62, belly], [1, shade(belly, -0.2)]]);
    ctx.fill();
    if (!a.sil && a.vent) { ell(ctx, -bodyL * 0.28, bodyH * 0.25, bodyL * 0.14, bodyH * 0.15); ctx.fillStyle = a.vent; ctx.fill(); }
    if (!a.sil && a.bars) { // barred belly (falcon) / wing bars
      ctx.save(); ell(ctx, 0, 0, bodyL / 2, bodyH / 2, -0.04); ctx.clip();
      ctx.strokeStyle = a.bars; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, L * 0.008);
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * bodyL * 0.1, bodyH * 0.05); ctx.lineTo(i * bodyL * 0.1 + bodyL * 0.04, bodyH * 0.5); ctx.stroke(); }
      ctx.restore();
    }

    // neck + head
    const neck = (a.neck || 0) * L + (a.duck ? L * 0.06 : 0);
    const hr = L * (owl ? 0.15 : raptor ? 0.09 : a.slowFlap && !a.heron ? 0.085 : a.heron ? 0.07 : 0.115);
    const hx = bodyL * 0.46 + neck * (a.heron ? 0.4 : 0.9), hy = -bodyH * (owl ? 0.2 : 0.3) - neck * (a.heron ? 0.6 : 0.25);
    if (neck > 0) {
      ctx.beginPath(); ctx.moveTo(bodyL * 0.25, -bodyH * 0.45); ctx.quadraticCurveTo(hx - hr, hy - hr * 0.6, hx, hy - hr * 0.8);
      ctx.lineTo(hx, hy + hr * 0.8); ctx.quadraticCurveTo(hx - hr * 1.6, hy + hr * 1.5, bodyL * 0.3, bodyH * 0.25); ctx.closePath();
      ctx.fillStyle = a.sil || C(a, 'throat', head); ctx.fill();
    }
    // beak
    const bl = L * (a.beakL || 0.2) * 0.42, bdepth = hr * (a.beakDeep ? 0.75 : a.flat ? 0.55 : a.hook ? 0.8 : 0.5);
    const bx = hx + hr * 0.78, by = hy + hr * 0.1;
    const curve = (a.curve || 0) * bl;
    ctx.beginPath();
    ctx.moveTo(bx - 1, by - bdepth * 0.5);
    if (a.hook || raptor || owl) {
      const hb = raptor || owl ? bl * 0.55 : bl;
      ctx.quadraticCurveTo(bx + hb * 0.9, by - bdepth * 0.7, bx + hb, by + bdepth * 0.5);
      ctx.quadraticCurveTo(bx + hb * 0.6, by + bdepth * 0.2, bx - 1, by + bdepth * 0.45);
    } else if (a.flat) {
      ctx.lineTo(bx + bl * 0.9, by - bdepth * 0.25); ctx.quadraticCurveTo(bx + bl * 1.05, by + bdepth * 0.1, bx + bl * 0.9, by + bdepth * 0.35); ctx.lineTo(bx - 1, by + bdepth * 0.45);
    } else {
      ctx.quadraticCurveTo(bx + bl * 0.6, by - bdepth * 0.35 + curve * 0.2, bx + bl, by + curve);
      ctx.quadraticCurveTo(bx + bl * 0.5, by + bdepth * 0.3 + curve * 0.5, bx - 1, by + bdepth * 0.5);
    }
    ctx.closePath();
    const bc = C(a, 'beak', '#333');
    ctx.fillStyle = a.sil || lg(ctx, bx, by - bdepth, bx, by + bdepth, [[0, shade(bc, 0.15)], [1, shade(bc, -0.25)]]); ctx.fill();
    // casque
    if (a.casque) {
      ctx.beginPath();
      if (a.casqueUp) { ctx.moveTo(bx, by - bdepth * 0.5); ctx.quadraticCurveTo(bx + bl * 0.3, by - bdepth * 1.4, bx + bl * 0.55, by - bdepth * 2.4); ctx.quadraticCurveTo(bx + bl * 0.45, by - bdepth * 1.2, bx + bl * 0.65, by - bdepth * 0.55); }
      else if (a.casqueFlat) { ctx.moveTo(bx - hr * 0.2, by - bdepth * 0.5); ctx.lineTo(bx - hr * 0.1, by - bdepth * 1.5); ctx.lineTo(bx + bl * 0.45, by - bdepth * 1.3); ctx.lineTo(bx + bl * 0.55, by - bdepth * 0.5); }
      else { ctx.moveTo(bx, by - bdepth * 0.5); ctx.quadraticCurveTo(bx + bl * 0.2, by - bdepth * 1.3, bx + bl * 0.5, by - bdepth * 0.5); }
      ctx.closePath(); ctx.fillStyle = a.sil || C(a, 'casque'); ctx.fill();
      if (!a.sil && a.casqueMark) { ell(ctx, bx + bl * 0.18, by - bdepth * 0.75, bl * 0.1, bdepth * 0.22); ctx.fillStyle = a.casqueMark; ctx.fill(); }
    }
    // head
    ell(ctx, hx, hy, hr * (owl ? 1.05 : 1), hr * (owl ? 1.0 : 0.92));
    ctx.fillStyle = a.sil || lg(ctx, hx, hy - hr, hx, hy + hr, [[0, shade(head, 0.08)], [1, shade(C(a, 'throat', head), -0.15)]]); ctx.fill();
    if (!a.sil && a.throat && !a.duck && neck <= 0) { ctx.save(); ell(ctx, hx, hy, hr, hr * 0.92); ctx.clip(); ctx.fillStyle = a.throat; ctx.fillRect(hx - hr * 0.2, hy + hr * 0.25, hr * 1.3, hr); ctx.restore(); }
    if (owl && !a.sil) {
      ell(ctx, hx + hr * 0.35, hy + hr * 0.05, hr * 0.62, hr * 0.7); ctx.fillStyle = a.disc; ctx.fill();
      // tufts
      ctx.fillStyle = shade(head, -0.2);
      ctx.beginPath(); ctx.moveTo(hx - hr * 0.1, hy - hr * 0.7); ctx.lineTo(hx - hr * 0.2, hy - hr * 1.55); ctx.lineTo(hx + hr * 0.3, hy - hr * 0.85); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + hr * 0.35, hy - hr * 0.8); ctx.lineTo(hx + hr * 0.5, hy - hr * 1.6); ctx.lineTo(hx + hr * 0.75, hy - hr * 0.7); ctx.fill();
    }
    if (!a.sil && a.mask) { ctx.fillStyle = a.mask; ell(ctx, hx + hr * 0.25, hy - hr * 0.05, hr * 0.5, hr * 0.22); ctx.fill(); }
    if (!a.sil && a.collar2) { ctx.strokeStyle = a.collar2; ctx.lineWidth = Math.max(1, hr * 0.18); ctx.beginPath(); ctx.arc(hx - hr * 0.35, hy + hr * 0.1, hr * 0.85, 0.8, 2.6); ctx.stroke(); }
    if (!a.sil && a.collar) { ctx.strokeStyle = a.collar; ctx.lineWidth = Math.max(1, hr * 0.12); ctx.beginPath(); ctx.arc(hx - hr * 0.3, hy + hr * 0.05, hr * 0.98, 0.5, 2.2); ctx.stroke(); }
    if (a.crest) {
      ctx.fillStyle = a.sil || a.crest;
      if (a.crestBig) {
        for (let i = 0; i < 6; i++) {
          const ang = -2.6 + i * 0.28, r = hr * 2.0;
          ctx.beginPath(); ctx.moveTo(hx - hr * 0.2, hy - hr * 0.4);
          ctx.lineTo(hx - hr * 0.2 + Math.cos(ang) * r - hr * 0.12, hy - hr * 0.4 + Math.sin(ang) * r);
          ctx.lineTo(hx - hr * 0.2 + Math.cos(ang) * r + hr * 0.12, hy - hr * 0.4 + Math.sin(ang) * r); ctx.fill();
          if (!a.sil) { ctx.fillStyle = a.crestTip; ell(ctx, hx - hr * 0.2 + Math.cos(ang) * r, hy - hr * 0.4 + Math.sin(ang) * r, hr * 0.12, hr * 0.12); ctx.fill(); ctx.fillStyle = a.crest; }
        }
      } else { ctx.beginPath(); ctx.moveTo(hx + hr * 0.4, hy - hr * 0.7); ctx.lineTo(hx + hr * 0.75, hy - hr * 1.25); ctx.lineTo(hx + hr * 0.1, hy - hr * 0.85); ctx.fill(); }
    }
    if (a.heron && a.crestTip && !a.sil) { ctx.strokeStyle = a.crestTip; ctx.lineWidth = Math.max(1, hr * 0.15); ctx.beginPath(); ctx.moveTo(hx, hy - hr * 0.4); ctx.lineTo(hx - hr * 2.2, hy - hr * 0.2); ctx.stroke(); }
    // eye
    if (!a.sil) {
      const ex = hx + hr * (owl ? 0.5 : 0.38), ey = hy - hr * (owl ? 0.05 : 0.18), er = Math.max(1.1, hr * (owl ? 0.2 : 0.15));
      if (o.stunned) { ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, er * 0.5); ctx.beginPath(); ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey); ctx.stroke(); }
      else {
        if (owl) { ell(ctx, ex, ey, er * 1.2, er * 1.2); ctx.fillStyle = a.eye; ctx.fill(); }
        ell(ctx, ex, ey, er * (owl ? 0.6 : 1), er * (owl ? 0.6 : 1)); ctx.fillStyle = '#0c0c0c'; ctx.fill();
        ell(ctx, ex + er * 0.3, ey - er * 0.3, er * 0.3, er * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      }
    }
    // near wing
    if (o.stunned) {
      ell(ctx, -bodyL * 0.08, -bodyH * 0.12, bodyL * 0.42, bodyH * 0.3, 0.06);
      ctx.fillStyle = a.sil || shade(wing, -0.05); ctx.fill();
    } else {
      wingPath(ctx, sx, sy, span, chord, lift, raptor || owl);
      const wt = C(a, 'wingTip', shade(wing, -0.3));
      ctx.fillStyle = a.sil || lg(ctx, sx, sy, sx - span * 0.45, sy - span * lift, [[0, shade(wing, 0.1)], [0.6, wing], [1, wt]]);
      ctx.fill();
      if (!a.sil && a.patch) {
        ctx.save(); wingPath(ctx, sx, sy, span, chord, lift, raptor || owl); ctx.clip();
        ctx.fillStyle = a.patch; ctx.globalAlpha = 0.9;
        const px = sx - span * 0.18, py = sy - span * 0.4 * lift;
        ell(ctx, px, py, chord * 0.28, span * 0.08 + 2, -lift * 1.1); ctx.fill(); ctx.restore();
      }
      if (!a.sil && a.bars && !raptor) {
        ctx.save(); wingPath(ctx, sx, sy, span, chord, lift, false); ctx.clip();
        ctx.strokeStyle = a.bars; ctx.lineWidth = Math.max(1.2, chord * 0.09);
        for (let i = 1; i < 6; i++) { const f = i / 6; ctx.beginPath(); ctx.moveTo(sx - chord, sy - span * lift * f); ctx.lineTo(sx + chord, sy - span * lift * f - chord * 0.2); ctx.stroke(); }
        ctx.restore();
      }
      if (!a.sil && a.under && lift < 0) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = a.under; wingPath(ctx, sx, sy, span * 0.6, chord * 0.6, lift, false); ctx.fill(); ctx.restore(); }
    }
  }

  function drawFowl(ctx, sp, a, L, t, o) {
    const s = a.small ? 0.85 : 1; L *= s;
    const legL = L * 0.22, bodyL = L * 0.5, bodyH = L * 0.32, by = -legL - bodyH * 0.45;
    const p = o.moving ? t * 9 : 0;
    // legs
    ctx.strokeStyle = C(a, 'legs', '#666'); ctx.lineWidth = Math.max(1.2, L * 0.03); ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const sw = Math.sin(p + i * Math.PI) * 0.4;
      ctx.beginPath(); ctx.moveTo(i * 4 - 2, by + bodyH * 0.3); ctx.lineTo(i * 4 - 2 + Math.sin(sw) * legL, by + bodyH * 0.3 + Math.cos(sw) * legL * 1.05); ctx.stroke();
    }
    // tail
    const tc = C(a, 'tail', '#222');
    if (!a.small) {
      ctx.strokeStyle = a.sil || tc; ctx.lineWidth = L * 0.04;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-bodyL * 0.35, by - bodyH * 0.1); ctx.quadraticCurveTo(-bodyL * 0.6 - i * 4, by - bodyH * (1.6 - i * 0.15), -bodyL * (0.95 + i * 0.07), by + bodyH * (0.1 + i * 0.12)); ctx.stroke(); }
    } else { ctx.beginPath(); ctx.moveTo(-bodyL * 0.3, by - bodyH * 0.2); ctx.lineTo(-bodyL * 0.75, by - bodyH * 0.6); ctx.lineTo(-bodyL * 0.55, by + bodyH * 0.2); ctx.fillStyle = a.sil || tc; ctx.fill(); }
    // body
    ell(ctx, 0, by, bodyL / 2, bodyH / 2, -0.15);
    const bc = C(a, 'body', '#333'); ctx.fillStyle = a.sil || lg(ctx, 0, by - bodyH / 2, 0, by + bodyH / 2, [[0, shade(bc, 0.1)], [1, shade(bc, -0.2)]]); ctx.fill();
    ell(ctx, -bodyL * 0.05, by - bodyH * 0.08, bodyL * 0.32, bodyH * 0.25, -0.1); ctx.fillStyle = a.sil || C(a, 'wing'); ctx.fill();
    // neck hackles
    const hx = bodyL * 0.42, hy = by - bodyH * 0.85 + Math.sin(p) * 1.2;
    ctx.beginPath(); ctx.moveTo(bodyL * 0.05, by - bodyH * 0.3); ctx.quadraticCurveTo(hx - L * 0.06, hy - L * 0.08, hx + L * 0.04, hy); ctx.lineTo(bodyL * 0.48, by); ctx.closePath();
    ctx.fillStyle = a.sil || lg(ctx, 0, hy, 0, by, [[0, shade(C(a, 'hackle'), 0.15)], [1, C(a, 'hackle')]]); ctx.fill();
    const hr = L * 0.075;
    ell(ctx, hx, hy, hr, hr * 0.9); ctx.fillStyle = a.sil || C(a, 'hackle'); ctx.fill();
    // comb, beak, eye
    ctx.fillStyle = a.sil || C(a, 'comb');
    ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(hx - hr * 0.6 + i * hr * 0.4, hy - hr * 0.6); ctx.lineTo(hx - hr * 0.45 + i * hr * 0.4, hy - hr * (a.small ? 1.0 : 1.5)); ctx.lineTo(hx - hr * 0.2 + i * hr * 0.4, hy - hr * 0.6); } ctx.fill();
    ell(ctx, hx + hr * 0.6, hy + hr * 0.9, hr * 0.25, hr * (a.small ? 0.25 : 0.45)); ctx.fill();
    ctx.fillStyle = a.sil || '#b9a37a'; ctx.beginPath(); ctx.moveTo(hx + hr * 0.8, hy - hr * 0.2); ctx.lineTo(hx + hr * 1.6, hy + hr * 0.15); ctx.lineTo(hx + hr * 0.8, hy + hr * 0.35); ctx.fill();
    if (!a.sil) eye(ctx, hx + hr * 0.35, hy - hr * 0.15, Math.max(1, hr * 0.16), o.stunned);
  }

  function eye(ctx, x, y, r, closed) {
    if (closed) { ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = Math.max(1, r * 0.6); ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke(); return; }
    ell(ctx, x, y, r, r); ctx.fillStyle = '#0a0a0a'; ctx.fill();
    ell(ctx, x + r * 0.35, y - r * 0.35, r * 0.35, r * 0.35); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  }

  // ---------------- QUADRUPEDS ----------------
  function bodyPath(ctx, bodyL, bodyH, cy, arch, hump) {
    const x0 = -bodyL / 2, x1 = bodyL / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + bodyH * 0.3, cy + bodyH * 0.45);
    ctx.quadraticCurveTo(x0 - bodyH * 0.25, cy + bodyH * 0.1, x0 + bodyH * 0.15, cy - bodyH * 0.4);
    ctx.bezierCurveTo(x0 + bodyL * 0.3, cy - bodyH * (0.62 + arch), x1 - bodyL * 0.3, cy - bodyH * (0.55 + hump + arch * 0.6), x1 - bodyH * 0.05, cy - bodyH * (0.42 + hump));
    ctx.quadraticCurveTo(x1 + bodyH * 0.25, cy, x1 - bodyH * 0.2, cy + bodyH * 0.45);
    ctx.quadraticCurveTo(0, cy + bodyH * 0.62, x0 + bodyH * 0.3, cy + bodyH * 0.45);
    ctx.closePath();
  }
  function leg(ctx, hx, hy, len, w, ang, col, knee) {
    const kx = hx + Math.sin(ang) * len * 0.5, ky = hy + Math.cos(ang) * len * 0.5;
    const fx = kx + Math.sin(ang * (knee || 0.4)) * len * 0.5, fy = ky + Math.cos(ang * (knee || 0.4)) * len * 0.5;
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.lineWidth = w * 1.35; ctx.beginPath(); ctx.moveTo(hx, hy - w); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
  }
  function drawQuad(ctx, sp, a, L, t, o) {
    const bodyL = a.bodyL * L, bodyH = a.bodyH * L, legL = a.legL * L, legW = (a.legW || 0.045) * L;
    const hopping = sp.move === 'hop';
    const fur = C(a, 'fur'), backC = C(a, 'back', fur), bellyC = C(a, 'belly', fur), legsC = C(a, 'legs', shade(fur, -0.15));
    const gaitSpd = sp.move === 'run' ? 13 : sp.move === 'scurry' ? 16 : 7;
    const p = o.moving && !hopping ? t * gaitSpd : 0;
    const bob = o.moving && !hopping ? Math.abs(Math.sin(p)) * L * 0.012 : 0;
    const cy = -legL - bodyH * 0.42 - bob;
    const stun = o.stunned;
    ctx.save();
    if (stun) { ctx.translate(0, 0); ctx.rotate(-0.04); }
    // tail (behind)
    drawTail(ctx, a, -bodyL / 2 + bodyH * 0.1, cy - bodyH * 0.15, L, t, o);
    // far legs
    const hipF = bodyL * 0.3, hipH = -bodyL * 0.3;
    const amp = sp.move === 'run' ? 0.7 : 0.45;
    const tuck = hopping && o.airborne ? 1 : 0;
    const farCol = a.sil || shade(legsC, -0.3);
    if (!stun) {
      leg(ctx, hipF + legW, cy + bodyH * 0.3, legL + bodyH * 0.1, legW, tuck ? -0.9 : Math.sin(p + Math.PI) * amp, farCol);
      leg(ctx, hipH + legW, cy + bodyH * 0.3, legL + bodyH * 0.1, legW * 1.1, tuck ? 1.2 : Math.sin(p) * amp, farCol, -0.6);
    }
    // neck
    const neck = (a.neck || 0) * L;
    const hx = bodyL / 2 + a.headL * L * 0.25, hy = cy - bodyH * 0.35 - neck - (a.primate ? bodyH * 0.1 : 0) + (stun ? bodyH * 0.35 : 0);
    ctx.beginPath(); ctx.moveTo(bodyL * 0.22, cy - bodyH * 0.45); ctx.quadraticCurveTo(hx - a.headL * L * 0.3, hy - a.headL * L * 0.35, hx, hy - a.headL * L * 0.25);
    ctx.lineTo(hx + a.headL * L * 0.1, hy + a.headL * L * 0.3); ctx.quadraticCurveTo(bodyL * 0.45, cy + bodyH * 0.2, bodyL * 0.3, cy + bodyH * 0.35); ctx.closePath();
    ctx.fillStyle = a.sil || lg(ctx, 0, hy - 10, 0, cy + bodyH * 0.4, [[0, backC], [1, bellyC]]); ctx.fill();
    // body
    bodyPath(ctx, bodyL, bodyH, cy, a.arch || 0, a.hump || 0);
    ctx.fillStyle = a.sil || lg(ctx, 0, cy - bodyH / 2, 0, cy + bodyH / 2, [[0, shade(backC, -0.05)], [0.45, fur], [0.8, bellyC], [1, shade(bellyC, -0.2)]]);
    ctx.fill();
    if (!a.sil) {
      ctx.save(); bodyPath(ctx, bodyL, bodyH, cy, a.arch || 0, a.hump || 0); ctx.clip();
      if (a.saddle) { ctx.fillStyle = a.saddle; ctx.beginPath(); ctx.moveTo(-bodyL * 0.38, cy - bodyH); ctx.lineTo(bodyL * 0.12, cy - bodyH); ctx.quadraticCurveTo(bodyL * 0.05, cy + bodyH * 0.1, bodyL * 0.12, cy + bodyH); ctx.lineTo(-bodyL * 0.28, cy + bodyH); ctx.quadraticCurveTo(-bodyL * 0.45, cy, -bodyL * 0.38, cy - bodyH); ctx.fill(); }
      if (a.stripe) { ctx.strokeStyle = a.stripe; ctx.lineWidth = bodyH * 0.09; ctx.beginPath(); ctx.moveTo(-bodyL * 0.4, cy + bodyH * 0.18); ctx.quadraticCurveTo(0, cy + bodyH * 0.05, bodyL * 0.38, cy + bodyH * 0.12); ctx.stroke(); ctx.strokeStyle = '#1b1712'; ctx.lineWidth = bodyH * 0.06; ctx.beginPath(); ctx.moveTo(-bodyL * 0.4, cy + bodyH * 0.27); ctx.quadraticCurveTo(0, cy + bodyH * 0.15, bodyL * 0.38, cy + bodyH * 0.22); ctx.stroke(); }
      if (a.spots) { ctx.fillStyle = a.spots; for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { ell(ctx, -bodyL * 0.35 + i * bodyL * 0.13 + r * 3, cy - bodyH * 0.2 + r * bodyH * 0.18, bodyH * 0.05, bodyH * 0.04); ctx.fill(); } }
      if (a.scales) scales(ctx, -bodyL / 2, cy - bodyH * 0.7, bodyL, bodyH * 1.1, bodyH * 0.2, a.back, a.fur);
      if (a.frost) { ctx.strokeStyle = a.frost; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = -bodyL / 2 + (i * 37 % 100) / 100 * bodyL, y = cy - bodyH * 0.5 + (i * 53 % 100) / 100 * bodyH * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 4); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (a.glossy) { ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = bodyH * 0.08; ctx.beginPath(); ctx.moveTo(-bodyL * 0.3, cy - bodyH * 0.32); ctx.quadraticCurveTo(0, cy - bodyH * 0.45, bodyL * 0.3, cy - bodyH * 0.32); ctx.stroke(); }
      ctx.restore();
      if (a.bristle) { ctx.strokeStyle = shade(backC, -0.3); ctx.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const x = -bodyL * 0.2 + i * bodyL * 0.045, y = cy - bodyH * (0.5 + (a.hump || 0) * (i / 14)); ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + 2, y - L * 0.025); ctx.stroke(); } }
    }
    // near legs
    const nearCol = a.sil || legsC;
    if (stun) {
      ctx.strokeStyle = farCol; ctx.lineWidth = legW; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hipF, cy + bodyH * 0.3); ctx.lineTo(hipF + legL * 0.6, -legW * 0.5); ctx.moveTo(hipH, cy + bodyH * 0.3); ctx.lineTo(hipH - legL * 0.4, -legW * 0.5); ctx.stroke();
    } else {
      leg(ctx, hipF, cy + bodyH * 0.3, legL + bodyH * 0.1, legW, tuck ? -0.7 : Math.sin(p) * amp, nearCol);
      leg(ctx, hipH, cy + bodyH * 0.3, legL + bodyH * 0.1, legW * 1.15, tuck ? 1.3 : Math.sin(p + Math.PI) * amp, nearCol, -0.6);
    }
    // head
    const hl = a.headL * L, hh = hl * (a.primate ? 0.72 : 0.5);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(stun ? 0.35 : (a.pig ? 0.25 : 0.12));
    // ears behind
    drawEar(ctx, a, -hl * 0.15, -hh * 0.4, L, hl);
    ell(ctx, 0, 0, hl * 0.42, hh * 0.55);
    ctx.fillStyle = a.sil || lg(ctx, 0, -hh * 0.6, 0, hh * 0.6, [[0, C(a, 'head', backC)], [1, shade(fur, -0.05)]]); ctx.fill();
    // snout
    const sn = (a.snout || 0.08) * L;
    ctx.beginPath(); ctx.moveTo(hl * 0.15, -hh * 0.38); ctx.quadraticCurveTo(hl * 0.3 + sn, -hh * 0.2, hl * 0.3 + sn, hh * 0.05);
    ctx.quadraticCurveTo(hl * 0.3 + sn * 0.6, hh * 0.38, hl * 0.1, hh * 0.42); ctx.closePath();
    ctx.fillStyle = a.sil || (a.face ? a.face : lg(ctx, 0, -hh * 0.4, 0, hh * 0.45, [[0, fur], [1, shade(bellyC, -0.05)]])); ctx.fill();
    if (a.trunk) { ctx.strokeStyle = a.sil || fur; ctx.lineWidth = hh * 0.35; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hl * 0.3 + sn * 0.8, 0); ctx.quadraticCurveTo(hl * 0.5 + sn * 1.3, hh * 0.2 + Math.sin(t * 3) * 2, hl * 0.45 + sn * 1.2, hh * 0.65); ctx.stroke(); }
    if (!a.sil) {
      if (a.pig) { ell(ctx, hl * 0.3 + sn, hh * 0.05, sn * 0.12, hh * 0.25); ctx.fillStyle = '#5a4842'; ctx.fill(); if (o.gender === 'male') { ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hl * 0.25 + sn * 0.7, hh * 0.3); ctx.quadraticCurveTo(hl * 0.35 + sn, hh * 0.1, hl * 0.3 + sn * 0.85, -hh * 0.15); ctx.stroke(); } }
      else if (!a.trunk) { ell(ctx, hl * 0.28 + sn, -hh * 0.02, Math.max(1.2, hh * 0.1), Math.max(1.2, hh * 0.09)); ctx.fillStyle = '#141210'; ctx.fill(); }
      if (a.mask) { ctx.fillStyle = '#1a1816'; ell(ctx, hl * 0.12, -hh * 0.08, hl * 0.25, hh * 0.24); ctx.fill(); ctx.fillStyle = '#cfc8b8'; ell(ctx, hl * 0.22, -hh * 0.38, hl * 0.12, hh * 0.08); ctx.fill(); }
      if (a.throat) { ctx.strokeStyle = '#efe6d4'; ctx.lineWidth = hh * 0.12; ctx.beginPath(); ctx.moveTo(-hl * 0.1, hh * 0.45); ctx.lineTo(-hl * 0.55, hh * 1.1); ctx.stroke(); }
      eye(ctx, hl * 0.12, -hh * 0.18, Math.max(1.2, hh * 0.1), stun);
    }
    if (a.antlers && o.gender === 'male') {
      ctx.strokeStyle = a.sil || '#8a7558'; ctx.lineWidth = Math.max(1.5, L * 0.014); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-hl * 0.05, -hh * 0.45); ctx.quadraticCurveTo(-hl * 0.3, -hh * 1.6, -hl * 0.1, -hh * 2.8);
      ctx.moveTo(-hl * 0.17, -hh * 1.2); ctx.lineTo(hl * 0.25, -hh * 1.6); ctx.moveTo(-hl * 0.18, -hh * 2.2); ctx.lineTo(-hl * 0.5, -hh * 2.6); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
  function scales(ctx, x, y, w, h, s, c1, c2) {
    ctx.lineWidth = 1;
    for (let r = 0; r * s * 0.7 < h; r++) for (let i = 0; i * s < w + s; i++) {
      const sx = x + i * s + (r % 2) * s / 2, sy = y + r * s * 0.7;
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.fillStyle = (r + i) % 2 ? shade(c2, -0.05) : shade(c1, 0.08); ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,8,0.5)'; ctx.stroke();
    }
  }
  function drawEar(ctx, a, x, y, L, hl) {
    const s = (a.earS || 0.08) * L; if (a.ear === 'none') return;
    const col = a.sil || a.earC || shade(a.fur, -0.1);
    ctx.fillStyle = col; ctx.beginPath();
    if (a.ear === 'point' || a.ear === 'tuft') { ctx.moveTo(x - s * 0.4, y + s * 0.3); ctx.lineTo(x - s * 0.1, y - s * (a.ear === 'tuft' ? 1.3 : 1.15)); ctx.lineTo(x + s * 0.45, y + s * 0.2); ctx.fill(); }
    else if (a.ear === 'long') { ell(ctx, x - s * 0.35, y - s * 0.45, s * 0.18, s * 0.6, -0.5); ctx.fill(); ctx.fillStyle = a.sil || '#c9a89a'; ell(ctx, x - s * 0.33, y - s * 0.45, s * 0.08, s * 0.45, -0.5); ctx.fill(); }
    else { ell(ctx, x, y - s * 0.2, s * 0.6, s * 0.6); ctx.fill(); if (a.earRim && !a.sil) { ctx.strokeStyle = a.earRim; ctx.lineWidth = 1.5; ctx.stroke(); } }
  }
  function drawTail(ctx, a, x, y, L, t, o) {
    const tl = (a.tailL || 0.3) * L, tc = a.sil || a.tailC || a.fur, sway = o.moving ? Math.sin(t * 4) * 0.12 : 0;
    ctx.lineCap = 'round';
    if (a.tail === 'bushy') {
      const th = (a.tailThick || 0.09) * L;
      ctx.beginPath(); ctx.moveTo(x + 4, y - th * 0.3);
      if (a.tailUp) { ctx.bezierCurveTo(x - tl * 0.6, y - th, x - tl * 0.7, y - tl * (0.9 + sway), x - tl * 0.2, y - tl * 1.1); ctx.bezierCurveTo(x - tl * 0.1, y - tl * 0.6, x - tl * 0.2, y + th * 0.3, x + 4, y + th * 0.6); }
      else { ctx.bezierCurveTo(x - tl * 0.3, y - th * 1.2, x - tl * 0.8, y + th * (0.2 + sway * 4), x - tl, y + th * (1.2 + sway * 4)); ctx.bezierCurveTo(x - tl * 0.7, y + th * 2.2, x - tl * 0.3, y + th * 1.4, x + 4, y + th * 0.6); }
      ctx.closePath(); ctx.fillStyle = tc; ctx.fill();
      if (a.tailTip && !a.sil) { ell(ctx, x - tl * 0.96, y + th * 1.5, th * 0.45, th * 0.6, 0.8); ctx.fillStyle = a.tailTip; ctx.fill(); }
    } else if (a.tail === 'thin') {
      ctx.strokeStyle = tc; ctx.lineWidth = Math.max(1.5, (a.tailThick || 0.03) * L);
      ctx.beginPath(); ctx.moveTo(x + 3, y);
      if (a.tailUp) ctx.bezierCurveTo(x - tl * 0.5, y - tl * 0.1, x - tl * 0.8, y + tl * 0.2, x - tl * 0.9, y - tl * (0.25 + sway));
      else ctx.quadraticCurveTo(x - tl * 0.5, y + tl * 0.3, x - tl, y + tl * (0.7 + sway));
      ctx.stroke();
    } else if (a.tail === 'thick') {
      ctx.beginPath(); ctx.moveTo(x + 6, y - L * 0.05); ctx.quadraticCurveTo(x - tl * 0.5, y - L * 0.02, x - tl, y + L * 0.2 + sway * 10); ctx.quadraticCurveTo(x - tl * 0.5, y + L * 0.12, x + 6, y + L * 0.07); ctx.closePath();
      ctx.fillStyle = tc; ctx.fill(); if (a.scales && !a.sil) { ctx.save(); ctx.clip(); scales(ctx, x - tl, y - L * 0.06, tl + 6, L * 0.3, L * 0.05, a.back, a.fur); ctx.restore(); }
    } else if (a.tail === 'puff') { ell(ctx, x + 2, y - 2, L * 0.07, L * 0.07); ctx.fillStyle = tc; ctx.fill(); }
    else if (a.tail === 'stub') { ell(ctx, x + 2, y, L * 0.03, L * 0.025); ctx.fillStyle = tc; ctx.fill(); }
  }

  function drawRoo(ctx, sp, a, L, t, o) {
    const fur = C(a, 'fur'), back = C(a, 'back', fur), belly = C(a, 'belly');
    const air = o.airborne && !o.stunned;
    ctx.save(); if (o.stunned) ctx.rotate(-0.25);
    const tilt = air ? 0.85 : 0.45;
    // tail
    ctx.beginPath(); ctx.moveTo(-L * 0.1, -L * 0.28); ctx.quadraticCurveTo(-L * 0.45, -L * 0.12, -L * 0.62, air ? -L * 0.2 : -L * 0.02); ctx.quadraticCurveTo(-L * 0.4, -L * 0.04, -L * 0.05, -L * 0.18); ctx.fill;
    ctx.fillStyle = a.sil || shade(fur, -0.1); ctx.fill();
    // hind leg + foot
    ell(ctx, -L * 0.05, -L * 0.25, L * 0.17, L * 0.13, 0.3); ctx.fillStyle = a.sil || lg(ctx, 0, -L * 0.4, 0, -L * 0.1, [[0, back], [1, fur]]); ctx.fill();
    ctx.strokeStyle = a.sil || shade(fur, -0.2); ctx.lineCap = 'round'; ctx.lineWidth = L * 0.04;
    ctx.beginPath(); ctx.moveTo(-L * 0.02, -L * 0.15); ctx.lineTo(air ? -L * 0.18 : L * 0.02, air ? -L * 0.05 : -L * 0.02); ctx.lineTo(air ? -L * 0.32 : L * 0.22, air ? 0 : 0); ctx.stroke();
    // torso
    ctx.save(); ctx.translate(L * 0.05, -L * 0.36); ctx.rotate(tilt);
    ell(ctx, 0, 0, L * 0.21, L * 0.11); ctx.fillStyle = a.sil || lg(ctx, 0, -L * 0.11, 0, L * 0.11, [[0, back], [0.6, fur], [1, belly]]); ctx.fill();
    ctx.restore();
    // arms
    ctx.strokeStyle = a.sil || shade(fur, -0.1); ctx.lineWidth = L * 0.022;
    ctx.beginPath(); ctx.moveTo(L * 0.16, -L * 0.42); ctx.lineTo(L * 0.22, -L * 0.33); ctx.stroke();
    // head
    const hx = air ? L * 0.3 : L * 0.2, hy = air ? -L * 0.45 : -L * 0.6;
    ctx.beginPath(); ctx.moveTo(L * 0.1, -L * 0.48); ctx.lineTo(hx, hy); ctx.lineWidth = L * 0.07; ctx.strokeStyle = a.sil || fur; ctx.stroke();
    ell(ctx, hx + L * 0.03, hy, L * 0.07, L * 0.045, 0.2); ctx.fillStyle = a.sil || fur; ctx.fill();
    ell(ctx, hx + L * 0.09, hy + L * 0.015, L * 0.035, L * 0.028, 0.2); ctx.fillStyle = a.sil || C(a, 'muzzle', belly); ctx.fill();
    ctx.fillStyle = a.sil || shade(fur, -0.15);
    ell(ctx, hx - L * 0.03, hy - L * 0.07, L * 0.018, L * 0.05, -0.3); ctx.fill();
    if (!a.sil) eye(ctx, hx + L * 0.04, hy - L * 0.012, Math.max(1.2, L * 0.011), o.stunned);
    ctx.restore();
  }

  function drawLizard(ctx, sp, a, L, t, o) {
    const fur = C(a, 'fur'), back = C(a, 'back', fur), belly = C(a, 'belly');
    const p = o.moving ? t * 6 : 0, und = Math.sin(p) * L * 0.015;
    const y = -L * 0.07;
    // tail
    ctx.beginPath(); ctx.moveTo(-L * 0.12, y - L * 0.035);
    ctx.bezierCurveTo(-L * 0.3, y - L * 0.02 + und, -L * 0.45, y + und * 2, -L * 0.68, y + L * 0.03 - und);
    ctx.bezierCurveTo(-L * 0.45, y + L * 0.03 + und, -L * 0.3, y + L * 0.035, -L * 0.12, y + L * 0.035); ctx.closePath();
    ctx.fillStyle = a.sil || lg(ctx, 0, y - L * 0.04, 0, y + L * 0.04, [[0, back], [1, belly]]); ctx.fill();
    // legs (sprawled)
    ctx.strokeStyle = a.sil || shade(fur, -0.1); ctx.lineCap = 'round'; ctx.lineWidth = L * 0.022;
    const legs = [[L * 0.12, 0], [-L * 0.09, Math.PI]];
    legs.forEach(([lx, ph]) => {
      const s = Math.sin(p + ph) * L * 0.03;
      ctx.beginPath(); ctx.moveTo(lx, y + L * 0.02); ctx.lineTo(lx + s + L * 0.02, y + L * 0.05); ctx.lineTo(lx + s + L * 0.03, 0); ctx.stroke();
    });
    // body
    ell(ctx, 0, y, L * 0.17, L * 0.062);
    ctx.fillStyle = a.sil || lg(ctx, 0, y - L * 0.05, 0, y + L * 0.05, [[0, back], [0.65, fur], [1, belly]]); ctx.fill();
    if (!a.sil && a.spots) { ctx.fillStyle = a.spots; ctx.globalAlpha = 0.75; for (let i = 0; i < 7; i++) { ell(ctx, -L * 0.14 + i * L * 0.045, y - L * 0.018, L * 0.009, L * 0.007); ctx.fill(); } for (let i = 0; i < 6; i++) { ell(ctx, -L * 0.25 - i * L * 0.06, y + und * (i / 6), L * 0.008, L * 0.006); ctx.fill(); } ctx.globalAlpha = 1; }
    // near legs
    ctx.strokeStyle = a.sil || fur;
    legs.forEach(([lx, ph]) => { const s = Math.sin(p + ph + Math.PI) * L * 0.03; ctx.beginPath(); ctx.moveTo(lx, y + L * 0.025); ctx.lineTo(lx + s - L * 0.01, y + L * 0.06); ctx.lineTo(lx + s, 0); ctx.stroke(); });
    // neck & head
    ctx.beginPath(); ctx.moveTo(L * 0.14, y - L * 0.035); ctx.quadraticCurveTo(L * 0.22, y - L * 0.05, L * 0.3, y - L * 0.03); ctx.lineTo(L * 0.35, y - L * 0.005); ctx.quadraticCurveTo(L * 0.22, y + L * 0.04, L * 0.14, y + L * 0.035); ctx.closePath();
    ctx.fillStyle = a.sil || lg(ctx, 0, y - L * 0.04, 0, y + L * 0.04, [[0, back], [1, belly]]); ctx.fill();
    if (!a.sil) {
      eye(ctx, L * 0.28, y - L * 0.02, Math.max(1.1, L * 0.007), o.stunned);
      if (!o.stunned && Math.sin(t * 2.3) > 0.7) { ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L * 0.35, y - L * 0.005); ctx.lineTo(L * 0.4, y); ctx.lineTo(L * 0.42, y - L * 0.01); ctx.moveTo(L * 0.4, y); ctx.lineTo(L * 0.42, y + L * 0.01); ctx.stroke(); }
    }
  }

  function draw(ctx, sp, o) {
    o = o || {};
    const a = colorsFor(sp, o.gender, o.sil);
    const L = sp.size * (o.scale || 1);
    const t = o.t || 0;
    if (a.t === 'bird' || a.t === 'raptor' || a.t === 'owl') drawBird(ctx, sp, a, L, t, o);
    else if (a.t === 'fowl') drawFowl(ctx, sp, a, L, t, o);
    else if (a.t === 'roo') drawRoo(ctx, sp, a, L, t, o);
    else if (a.t === 'lizard') drawLizard(ctx, sp, a, L, t, o);
    else drawQuad(ctx, sp, a, L, t, o);
  }
  const isFlyer = sp => ['bird', 'raptor', 'owl'].includes(sp.art.t);

  // Static portrait (data URL) for cards and journal
  const cache = {};
  function portrait(sp, opts) {
    opts = opts || {};
    const key = sp.id + (opts.gender || '') + (opts.sil || '') + (opts.w || 360);
    if (cache[key]) return cache[key];
    const W = opts.w || 360, H = Math.round(W * 0.7);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!opts.sil) {
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, '#3a4134'); g.addColorStop(1, '#171b16'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const flyer = isFlyer(sp);
    const extent = sp.size * (flyer ? 1.25 : 1.15) * (sp.art.t === 'raptor' ? 1.0 : 1);
    const scale = Math.min((W * 0.78) / extent, (H * 0.8) / (sp.size * (flyer ? 1.05 : 0.95)));
    ctx.save();
    ctx.translate(W * (flyer ? 0.52 : 0.5), flyer ? H * 0.55 : H * 0.84);
    if (!opts.sil && !flyer) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, 0, 2, sp.size * scale * 0.45, 6); ctx.fill(); }
    draw(ctx, sp, { gender: opts.gender || 'male', t: 0.35, scale, sil: opts.sil, moving: false });
    ctx.restore();
    return (cache[key] = c.toDataURL());
  }

  window.Art = { draw, portrait, isFlyer, shade, ell };
})();
