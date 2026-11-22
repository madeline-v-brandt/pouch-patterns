/* The Pouch Project: SVG drawing. The pouch preview, pattern pieces and step diagrams.
   Colors come from CSS classes (see styles.css) so both themes work. */
(function (global) {
  'use strict';

  // Oblique projection: depth recedes up and to the right.
  const CX = 0.46, CY = 0.3;
  const r1 = v => Math.round(v * 10) / 10;
  const pt = p => `${r1(p[0])},${r1(p[1])}`;

  function geom(T, dm, k, ox, oy) {
    const W = dm.w, H = dm.h, D = T.boxed ? dm.d : 0;
    const P = (x, y, z) => [ox + (x + y * CX) * k, oy - (z + y * CY) * k];
    const g = { W, H, D, k, P, FBL: P(0, 0, 0), FBR: P(W, 0, 0), BBR: P(W, D, 0) };
    if (T.boxyTop) {
      // Flat top face: top squares of t give a top 2t deep, overhanging the base by D/2 − t.
      const t = Pouch.topSquare(D);
      const o = D / 2 - t;
      g.t = t; g.o = o;
      g.TFL = P(-o, D / 2 - t, H); g.TFR = P(W + o, D / 2 - t, H);
      g.TBL = P(-o, D / 2 + t, H); g.TBR = P(W + o, D / 2 + t, H);
      g.ZL = P(-o, D / 2, H); g.ZR = P(W + o, D / 2, H);
    } else {
      const e = D * 0.2;
      g.ZL = P(-e, D / 2, H); g.ZR = P(W + e, D / 2, H);
    }
    return g;
  }

  function bounds(T, dm) {
    const g = geom(T, dm, 1, 0, 0);
    const xs = [g.FBL[0], g.FBR[0], g.BBR[0], g.ZL[0], g.ZR[0]];
    if (T.boxyTop) xs.push(g.TBR[0]);
    let minY = Math.min(g.FBL[1], g.BBR[1], g.ZL[1], T.boxyTop ? g.TBL[1] : 0);
    if (T.handles) minY = Math.min(minY, g.ZL[1] - dm.drop);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY };
  }

  // Quadratic edge that bulges outward (for clockwise-on-screen paths), so the pouch looks plump.
  function curve(a, b, bulge) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const m = [(a[0] + b[0]) / 2 + (dy / L) * bulge, (a[1] + b[1]) / 2 + (-dx / L) * bulge];
    return ` Q${pt(m)} ${pt(b)}`;
  }

  /* ---------- Pouch ---------- */
  function zipperArt(x0, x1, y, o, k) {
    const tw = Math.max(3, o.tape * 0.5 * k);
    const len = x1 - x0;
    let t0 = x0, t1 = x1, s = '';
    if (o.zip && o.zip.method === 'tabs') {
      const span = len * Math.min(1, o.zip.opening / o.zip.seamW);
      t0 = x0 + (len - span) / 2; t1 = t0 + span;
      s += `<line class="pw-tab" x1="${r1(x0)}" y1="${r1(y)}" x2="${r1(t0 + tw * 0.5)}" y2="${r1(y)}" stroke-width="${r1(tw * 1.3)}"/>`;
      s += `<line class="pw-tab" x1="${r1(t1 - tw * 0.5)}" y1="${r1(y)}" x2="${r1(x1)}" y2="${r1(y)}" stroke-width="${r1(tw * 1.3)}"/>`;
    }
    s += `<line class="pw-tape" x1="${r1(t0)}" y1="${r1(y)}" x2="${r1(t1)}" y2="${r1(y)}" stroke-width="${r1(tw)}"/>`;
    const tooth = Math.max(1, k * 0.07);
    s += `<line class="pw-teeth" x1="${r1(t0 + tw * 0.3)}" y1="${r1(y)}" x2="${r1(t1 - tw * 0.3)}" y2="${r1(y)}" stroke-width="${r1(tw * 0.42)}" stroke-dasharray="${r1(tooth)} ${r1(tooth)}"/>`;
    const sx = t0 + (t1 - t0) * 0.8, sw = tw * 1.5, sh = tw * 1.25;
    const pl = tw * 2.3, pw = tw * 0.8;
    s += `<rect class="pw-pull" x="${r1(sx - pw / 2)}" y="${r1(y)}" width="${r1(pw)}" height="${r1(pl)}" rx="${r1(pw / 2)}"/>`;
    s += `<circle class="pw-pull-hole" cx="${r1(sx)}" cy="${r1(y + pl - pw * 0.6)}" r="${r1(pw * 0.2)}"/>`;
    s += `<rect class="pw-slider" x="${r1(sx - sw / 2)}" y="${r1(y - sh / 2)}" width="${r1(sw)}" height="${r1(sh)}" rx="${r1(sh * 0.3)}"/>`;
    return s;
  }

  function handleArt(g, dm, o, back) {
    const k = g.k;
    const mid = (g.ZL[0] + g.ZR[0]) / 2 + (back ? k * 0.3 : 0);
    const half = (o.spacing * k) / 2;
    const y = g.ZL[1] + (back ? -k * 0.1 : k * 0.35);
    const c = (dm.drop * k * 4) / 3;
    const d = `M${r1(mid - half)},${r1(y)} C${r1(mid - half)},${r1(y - c)} ${r1(mid + half)},${r1(y - c)} ${r1(mid + half)},${r1(y)}`;
    const w = Math.max(3, k);
    return `<path class="pw-strap${back ? ' is-back' : ''}" d="${d}" stroke-width="${r1(w)}"/>` +
      (back ? '' : `<path class="pw-strap-stitch" d="${d}"/>`);
  }

  function pouchArt(T, dm, g, o) {
    const k = g.k, bul = Math.max(1.2, k * 0.16);
    let s = '';
    const right = g.D ? g.BBR[0] : g.FBR[0];
    const sy = g.FBL[1] - (g.D * CY * k) / 2 + 1.5;
    s += `<ellipse class="pw-shadow" cx="${r1((g.FBL[0] + right) / 2)}" cy="${r1(sy)}" rx="${r1((right - g.FBL[0]) / 2 + k * 0.5)}" ry="${r1(Math.max(3, (g.D * CY * k) / 2 + k * 0.22))}"/>`;
    if (T.handles) s += handleArt(g, dm, o, true);

    const fill = `url(#pat-${o.swatch})`;
    if (T.boxyTop) {
      const b2 = bul * 0.6;
      const front = `M${pt(g.FBL)}${curve(g.FBL, g.TFL, b2)} L${pt(g.TFR)}${curve(g.TFR, g.FBR, b2)}${curve(g.FBR, g.FBL, b2 * 0.6)} Z`;
      const side = `M${pt(g.FBR)}${curve(g.FBR, g.TFR, -b2)} L${pt(g.TBR)}${curve(g.TBR, g.BBR, b2)}${curve(g.BBR, g.FBR, b2 * 0.5)} Z`;
      const top = `M${pt(g.TFL)} L${pt(g.TBL)} L${pt(g.TBR)} L${pt(g.TFR)} Z`;
      s += `<path d="${front}" fill="${fill}"/><path class="pw-puff" d="${front}"/>`;
      s += `<path d="${side}" fill="${fill}"/><path class="pw-side-shade" d="${side}"/>`;
      s += `<path d="${top}" fill="${fill}"/><path class="pw-top-light" d="${top}"/>`;
      s += `<path class="pw-edge" d="${side}"/><path class="pw-edge" d="${front}"/><path class="pw-edge" d="${top}"/>`;
      [-1, 1].forEach(sg => {
        const yy = g.D / 2 + sg * Math.min(g.t * 0.6, 0.45);
        const a = g.P(-g.o + 0.35, yy, g.H), b = g.P(g.W + g.o - 0.35, yy, g.H);
        s += `<line class="pw-topstitch" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
      });
      s += zipperArt(g.ZL[0], g.ZR[0], g.ZL[1], o, k * 0.8);
      return s;
    }
    const front = `M${pt(g.FBL)}${curve(g.FBL, g.ZL, bul)} L${pt(g.ZR)}${curve(g.ZR, g.FBR, bul)}${curve(g.FBR, g.FBL, bul * 0.5)} Z`;
    s += `<path d="${front}" fill="${fill}"/><path class="pw-puff" d="${front}"/>`;
    if (g.D > 0) {
      const side = `M${pt(g.FBR)}${curve(g.FBR, g.ZR, -bul)}${curve(g.ZR, g.BBR, bul)}${curve(g.BBR, g.FBR, bul * 0.4)} Z`;
      s += `<path d="${side}" fill="${fill}"/><path class="pw-side-shade" d="${side}"/><path class="pw-edge" d="${side}"/>`;
    }
    s += `<path class="pw-edge" d="${front}"/>`;
    const ty = g.ZL[1] + Math.max(3.5, k * 0.34);
    s += `<line class="pw-topstitch" x1="${r1(g.ZL[0] + k * 0.4)}" y1="${r1(ty)}" x2="${r1(g.ZR[0] - k * 0.4)}" y2="${r1(ty)}"/>`;
    s += zipperArt(g.ZL[0], g.ZR[0], g.ZL[1], o, k);
    if (T.handles) s += handleArt(g, dm, o, false);
    return s;
  }

  function dim(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * 5, ny = (dx / L) * 5;
    return `<g class="pw-dim"><line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>` +
      `<line x1="${r1(x1 - nx)}" y1="${r1(y1 - ny)}" x2="${r1(x1 + nx)}" y2="${r1(y1 + ny)}"/>` +
      `<line x1="${r1(x2 - nx)}" y1="${r1(y2 - ny)}" x2="${r1(x2 + nx)}" y2="${r1(y2 + ny)}"/></g>`;
  }
  const label = (x, y, text, anchor) =>
    `<text class="pw-dim-label" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor || 'middle'}">${text}</text>`;

  function pencil(x, y, k, caption) {
    const L = 7.5 * k, t = Math.max(5, 0.3 * k);
    const er = 0.45 * k, fe = 0.3 * k, tip = 0.85 * k, body = L - er - fe - tip;
    const top = y - t / 2;
    const tx = x + er + fe + body;
    return `<g class="pw-pencil">` +
      `<rect class="pp-eraser" x="${r1(x)}" y="${r1(top)}" width="${r1(er + 2)}" height="${r1(t)}" rx="${r1(t * 0.35)}"/>` +
      `<rect class="pp-ferrule" x="${r1(x + er)}" y="${r1(top)}" width="${r1(fe)}" height="${r1(t)}"/>` +
      `<rect class="pp-body" x="${r1(x + er + fe)}" y="${r1(top)}" width="${r1(body)}" height="${r1(t)}"/>` +
      `<line class="pp-facet" x1="${r1(x + er + fe)}" y1="${r1(y)}" x2="${r1(tx)}" y2="${r1(y)}"/>` +
      `<path class="pp-wood" d="M${r1(tx)},${r1(top)} L${r1(tx + tip)},${r1(y)} L${r1(tx)},${r1(top + t)} Z"/>` +
      `<path class="pp-lead" d="M${r1(tx + tip * 0.62)},${r1(y - t * 0.19)} L${r1(tx + tip)},${r1(y)} L${r1(tx + tip * 0.62)},${r1(y + t * 0.19)} Z"/>` +
      `</g><text class="pw-caption" x="${r1(tx + tip + 10)}" y="${r1(y + 4.5)}">${caption}</text>`;
  }

  function preview(svg, st, plan, f) {
    const T = Pouch.TYPES[st.type], dm = st.dims[st.type];
    const showTop = T.boxed && !T.handles;
    const VBW = 560, VBH = 400, padX = 82, padTop = showTop ? 54 : 30, base = VBH - 100;
    const maxDm = {};
    T.dims.forEach(d => (maxDm[d.key] = d.max));
    const bm = bounds(T, maxDm);
    const k = Math.min((VBW - 2 * padX) / (bm.maxX - bm.minX), (base - padTop) / -bm.minY);
    const b = bounds(T, dm);
    const ox = VBW / 2 - ((b.minX + b.maxX) / 2) * k;
    const g = geom(T, dm, k, ox, base);
    const o = {
      swatch: st.swatch, tape: Pouch.GAUGES[st.gauge].tape,
      zip: { method: plan.zip.method, opening: plan.zip.opening, seamW: plan.seamW },
      spacing: plan.straps ? plan.straps.spacing : 0,
    };
    let s = pouchArt(T, dm, g, o);

    const wy = base + 20;
    s += dim(g.FBL[0], wy, g.FBR[0], wy) + label((g.FBL[0] + g.FBR[0]) / 2, wy + 22, f(dm.w));
    if (showTop) {
      const a = T.boxyTop ? g.TBL : g.ZL, b = T.boxyTop ? g.TBR : g.ZR;
      const y = a[1] - (T.boxyTop ? 14 : 20);
      s += dim(a[0], y, b[0], y) + label((a[0] + b[0]) / 2, y - 9, `${f(plan.topWidth)} across the top`);
    }
    const hx = Math.min(g.FBL[0], g.ZL[0]) - 16;
    s += dim(hx, base, hx, base - dm.h * k) + label(hx - 9, base - (dm.h * k) / 2 + 7, f(dm.h), 'end');
    if (T.boxed) {
      const n = [0.546 * 15, 0.837 * 15];
      const a = [g.FBR[0] + n[0], g.FBR[1] + n[1]], c = [g.BBR[0] + n[0], g.BBR[1] + n[1]];
      s += dim(a[0], a[1], c[0], c[1]) + label(c[0] + 8, c[1] + 16, f(dm.d), 'start');
    }
    if (T.handles) {
      const mid = (g.ZL[0] + g.ZR[0]) / 2;
      const x = mid + (o.spacing * k) / 2 + 18;
      s += dim(x, g.ZL[1], x, g.ZL[1] - dm.drop * k) + label(x + 10, g.ZL[1] - (dm.drop * k) / 2 + 7, `${f(dm.drop)} drop`, 'start');
    }
    const pLen = 7.5 * k + 0.85 * k + 120;
    s += pencil(VBW / 2 - pLen / 2, base + 70, k, `pencil, ${f(7.5)}`);
    svg.innerHTML = s;
  }

  function mini(type, dims, swatch) {
    const T = Pouch.TYPES[type], VBW = 160, VBH = 112, pad = 12;
    const b = bounds(T, dims);
    const k = Math.min((VBW - 2 * pad) / (b.maxX - b.minX), (VBH - 2 * pad) / -b.minY);
    const ox = VBW / 2 - ((b.minX + b.maxX) / 2) * k;
    const oy = VBH / 2 + (-b.minY * k) / 2;
    const g = geom(T, dims, k, ox, oy);
    const o = { swatch, zip: { method: 'long' }, tape: 1.25, spacing: Math.min(7, Math.max(4, dims.w * 0.35)) };
    return `<svg viewBox="0 0 ${VBW} ${VBH}" aria-hidden="true" focusable="false">${pouchArt(T, dims, g, o)}</svg>`;
  }

  /* ---------- Pattern pieces, to scale ---------- */
  function piece(pc, ppi, f, swatch, opts) {
    const notched = (pc.notch || 0) > 0 || (pc.topNotch || 0) > 0;
    const padT = 30, padR = 64, padB = 8, padL = notched ? 66 : 8;
    let pw = pc.w * ppi;
    const ph = pc.h * ppi;
    let broken = false;
    if (pw > opts.maxPx) { broken = true; pw = opts.maxPx; }
    const VW = pw + padL + padR, VH = ph + padT + padB;
    const x0 = padL, y0 = padT, x1 = x0 + pw, y1 = y0 + ph;
    let s = '';

    // Cutting-mat grid behind the piece
    const step = opts.gridStep * ppi;
    if (step >= 4) {
      let gl = '';
      for (let x = x0; x <= x1 + 0.5; x += step) gl += `M${r1(x)},${r1(y0 - 6)}V${r1(y1 + 6)}`;
      for (let y = y0; y <= y1 + 0.5; y += step) gl += `M${r1(x0 - 6)},${r1(y)}H${r1(x1 + 6)}`;
      s += `<path class="pc-grid" d="${gl}"/>`;
    }

    // Outline, with boxed-corner cut-outs at the bottom (n) and, for the boxy pouch, the top (tn)
    const n = (pc.notch || 0) * ppi, tn = (pc.topNotch || 0) * ppi;
    const outline = `M${r1(x0 + tn)},${y0} H${r1(x1 - tn)}${tn ? ` V${r1(y0 + tn)} H${r1(x1)}` : ''}` +
      ` V${r1(y1 - n)}${n ? ` H${r1(x1 - n)} V${r1(y1)}` : ''} H${r1(x0 + n)}${n ? ` V${r1(y1 - n)} H${x0}` : ''}` +
      ` V${r1(y0 + tn)}${tn ? ` H${r1(x0 + tn)}` : ''} Z`;
    const fillCls = { exterior: 'pc-ext', lining: 'pc-lin', interfacing: 'pc-int' }[pc.fabric];
    if (pc.fabric === 'exterior') s += `<path d="${outline}" fill="url(#pat-${swatch})"/><path class="pc-wash" d="${outline}"/>`;
    else s += `<path class="${fillCls}" d="${outline}"/>`;
    const away = (x, y, w) => `<rect class="pc-away" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(w)}"/>`;
    if (n > 0) s += away(x0, y1 - n, n) + away(x1 - n, y1 - n, n);
    if (tn > 0) s += away(x0, y0, tn) + away(x1 - tn, y0, tn);

    // Stitch line
    if (pc.seam) {
      const t = pc.seam.top * ppi, a = pc.seam.side * ppi;
      let seam = tn > 0
        ? `M${r1(x0 + tn + a)},${r1(y0 + t)} H${r1(x1 - tn - a)} V${r1(y0 + tn + a)} H${r1(x1 - a)}`
        : `M${r1(x0 + a)},${r1(y0 + t)} H${r1(x1 - a)}`;
      seam += n > 0
        ? ` V${r1(y1 - n - a)} H${r1(x1 - n - a)} V${r1(y1 - a)} H${r1(x0 + n + a)} V${r1(y1 - n - a)} H${r1(x0 + a)}`
        : ` V${r1(y1 - a)} H${r1(x0 + a)}`;
      seam += tn > 0 ? ` V${r1(y0 + tn + a)} H${r1(x0 + tn + a)} Z` : ' Z';
      s += `<path class="pc-seam" d="${seam}"/>`;
    }

    // Fold lines (measured from the top edge)
    (pc.folds || []).forEach(at => {
      const y = y0 + at * ppi;
      s += `<line class="pc-fold" x1="${x0}" y1="${r1(y)}" x2="${r1(x1)}" y2="${r1(y)}"/>`;
    });

    s += `<path class="pc-cut" d="${outline}"/>`;

    if (broken) {
      const bx = x0 + pw / 2;
      s += `<rect class="pc-break" x="${r1(bx - 7)}" y="${y0 - 4}" width="14" height="${r1(ph + 8)}"/>`;
      s += `<path class="pc-cut" d="M${r1(bx - 7)},${y0 - 4} l4,${r1((ph + 8) / 4)} l-4,${r1((ph + 8) / 4)} l4,${r1((ph + 8) / 4)} l-4,${r1((ph + 8) / 4)} M${r1(bx + 7)},${y0 - 4} l4,${r1((ph + 8) / 4)} l-4,${r1((ph + 8) / 4)} l4,${r1((ph + 8) / 4)} l-4,${r1((ph + 8) / 4)}"/>`;
    }

    // Grain arrow
    if (pc.grain === 'v' && ph > 60 && pw > 30) {
      const gx = x0 + pw * (pc.zipperEdge ? 0.5 : 0.5), ga = y0 + ph * 0.38, gb = y0 + ph * 0.72;
      s += `<path class="pc-grain" d="M${r1(gx)},${r1(ga)} V${r1(gb)} M${r1(gx - 4)},${r1(ga + 6)} L${r1(gx)},${r1(ga)} L${r1(gx + 4)},${r1(ga + 6)} M${r1(gx - 4)},${r1(gb - 6)} L${r1(gx)},${r1(gb)} L${r1(gx + 4)},${r1(gb - 6)}"/>`;
    }
    if (pc.zipperEdge && pw > 110 && ph > 70) {
      s += `<text class="pc-label" x="${r1(x0 + pw / 2)}" y="${r1(y0 + (pc.seam ? pc.seam.top * ppi : 0) + 18)}" text-anchor="middle">zipper edge</text>`;
    }

    // Dimensions
    s += `<g class="pc-dim"><path d="M${x0},${y0 - 12} H${r1(x1)} M${x0},${y0 - 17} V${y0 - 7} M${r1(x1)},${y0 - 17} V${y0 - 7}"/></g>`;
    s += `<text class="pc-dim-label" x="${r1(x0 + pw / 2)}" y="${y0 - 16}" text-anchor="middle">${f(pc.w)}${broken ? ' long' : ''}</text>`;
    s += `<g class="pc-dim"><path d="M${r1(x1 + 12)},${y0} V${r1(y1)} M${r1(x1 + 7)},${y0} H${r1(x1 + 17)} M${r1(x1 + 7)},${r1(y1)} H${r1(x1 + 17)}"/></g>`;
    s += `<text class="pc-dim-label" x="${r1(x1 + 21)}" y="${r1(y0 + ph / 2 + 6)}">${f(pc.h)}</text>`;

    // Cut-out square sizes, measured along the left edge
    const notchDim = (ya, yb, val) =>
      `<g class="pc-dim pc-notch-dim"><path d="M${x0 - 10},${r1(ya)} V${r1(yb)} M${x0 - 15},${r1(ya)} H${x0 - 5} M${x0 - 15},${r1(yb)} H${x0 - 5}"/></g>` +
      `<text class="pc-notch-label" x="${x0 - 19}" y="${r1((ya + yb) / 2 + 5)}" text-anchor="end">${f(val)}</text>`;
    if (n > 0) s += notchDim(y1 - n, y1, pc.notch);
    if (tn > 0) s += notchDim(y0, y0 + tn, pc.topNotch);

    return `<svg width="${r1(VW)}" height="${r1(VH)}" viewBox="0 0 ${r1(VW)} ${r1(VH)}" role="img" aria-label="${pc.name}, ${f(pc.w)} by ${f(pc.h)}">${s}</svg>`;
  }

  /* ---------- Step diagrams (220 × 140) ---------- */
  const T_ = (x, y, text, anchor) => `<text class="d-label" x="${x}" y="${y}" text-anchor="${anchor || 'start'}">${text}</text>`;
  const zipBand = (x0, x1, y, h) =>
    `<rect class="d-tape" x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" rx="2"/>` +
    `<line class="d-teeth" x1="${x0 + 3}" y1="${y + h / 2}" x2="${x1 - 3}" y2="${y + h / 2}" stroke-width="${h * 0.4}"/>`;

  function diagram(key, plan, st, f) {
    const sw = `url(#pat-${st.swatch})`;
    const boxed = plan.T.boxed;
    let s = '';
    switch (key) {
      case 'fuse': {
        s += `<rect class="d-wrong" x="34" y="18" width="152" height="104" rx="2"/><rect class="d-line" x="34" y="18" width="152" height="104" rx="2"/>`;
        if (st.structure === 'soft') {
          s += `<path class="d-inter" d="M34,18 H186 V96 L160,122 H34 Z"/><path class="d-inter-edge" d="M186,96 L160,122 L166,102 Z"/>`;
        } else {
          s += `<rect class="d-inter" x="44" y="26" width="132" height="86"/>`;
        }
        s += T_(110, 72, plan.st.short, 'middle') + T_(36, 136, 'exterior, wrong side up');
        break;
      }
      case 'pocket': {
        s += `<rect class="d-lin" x="30" y="14" width="160" height="112" rx="2"/><rect class="d-line" x="30" y="14" width="160" height="112" rx="2"/>`;
        s += `<rect class="d-lin-deep" x="70" y="34" width="80" height="58"/><rect class="d-line" x="70" y="34" width="80" height="58"/>`;
        s += `<path class="d-stitch" d="M73,36 V89 H147 V36"/><line class="d-stitch" x1="70" y1="38" x2="150" y2="38"/>`;
        s += T_(110, 112, 'edgestitch sides + bottom', 'middle');
        break;
      }
      case 'strap': {
        s += `<rect class="d-ext" x="16" y="16" width="188" height="40" fill="${sw}"/><rect class="d-line" x="16" y="16" width="188" height="40"/>`;
        [26, 36, 46].forEach(y => (s += `<line class="d-fold" x1="16" y1="${y}" x2="204" y2="${y}"/>`));
        s += `<path class="d-arrow" d="M110,64 V82 M104,76 L110,83 L116,76"/>`;
        s += `<rect class="d-ext" x="16" y="92" width="188" height="12" fill="${sw}"/><rect class="d-line" x="16" y="92" width="188" height="12"/>`;
        s += `<line class="d-stitch" x1="18" y1="94.5" x2="202" y2="94.5"/><line class="d-stitch" x1="18" y1="101.5" x2="202" y2="101.5"/>`;
        s += T_(110, 126, 'fold in quarters, edgestitch', 'middle');
        break;
      }
      case 'strapsOn': {
        s += `<rect class="d-ext" x="30" y="24" width="160" height="100" fill="${sw}"/><rect class="d-line" x="30" y="24" width="160" height="100"/>`;
        s += `<path class="d-strap" d="M86,24 V78 Q86,104 110,104 Q134,104 134,78 V24"/>`;
        s += `<line class="d-stitch" x1="30" y1="28" x2="190" y2="28"/>`;
        s += T_(110, 16, 'ends on the top edge, baste', 'middle');
        break;
      }
      case 'tabs': {
        s += zipBand(56, 164, 60, 20);
        s += `<rect class="d-tab" x="16" y="58" width="48" height="24" rx="2"/><rect class="d-line" x="16" y="58" width="48" height="24" rx="2"/>`;
        s += `<rect class="d-tab" x="156" y="58" width="48" height="24" rx="2"/><rect class="d-line" x="156" y="58" width="48" height="24" rx="2"/>`;
        s += `<line class="d-stitch" x1="60" y1="58" x2="60" y2="82"/><line class="d-stitch" x1="160" y1="58" x2="160" y2="82"/>`;
        s += `<rect class="d-slider" x="118" y="56" width="14" height="28" rx="4"/>`;
        s += T_(40, 104, 'tab', 'middle') + T_(180, 104, 'tab', 'middle') + T_(110, 42, `edgestitch ${f(0.125)} from fold`, 'middle');
        break;
      }
      case 'sandwich': {
        s += `<rect class="d-ext" x="30" y="44" width="160" height="80" fill="${sw}"/><rect class="d-line" x="30" y="44" width="160" height="80"/>`;
        s += `<rect class="d-tape" x="30" y="44" width="160" height="15"/>`;
        s += `<path class="d-lin" d="M30,44 H128 Q120,84 132,124 H30 Z"/><path class="d-line" d="M30,44 H128 Q120,84 132,124 H30 Z"/>`;
        s += `<line class="d-stitch-strong" x1="30" y1="50" x2="190" y2="50"/>`;
        s += T_(62, 92, 'lining', 'middle') + T_(176, 100, 'exterior', 'middle') + T_(160, 38, 'zipper face down', 'middle');
        s += `<path class="d-arrow" d="M160,40 V48"/>`;
        break;
      }
      case 'topstitch': {
        s += zipBand(30, 190, 26, 20);
        s += `<rect class="d-lin" x="30" y="10" width="160" height="16"/><rect class="d-line" x="30" y="10" width="160" height="16"/>`;
        s += `<rect class="d-ext" x="30" y="46" width="160" height="78" fill="${sw}"/><rect class="d-line" x="30" y="46" width="160" height="78"/>`;
        s += `<line class="d-stitch-strong" x1="30" y1="51" x2="190" y2="51"/>`;
        s += `<rect class="d-slider" x="140" y="23" width="14" height="26" rx="4"/>`;
        s += T_(110, 92, `topstitch ${f(0.125)} from fold`, 'middle');
        break;
      }
      case 'second': {
        s += `<rect class="d-ext" x="30" y="12" width="160" height="50" fill="${sw}"/><rect class="d-line" x="30" y="12" width="160" height="50"/>`;
        s += `<rect class="d-ext" x="30" y="78" width="160" height="50" fill="${sw}"/><rect class="d-line" x="30" y="78" width="160" height="50"/>`;
        s += zipBand(30, 190, 62, 16);
        s += `<line class="d-stitch-strong" x1="30" y1="57" x2="190" y2="57"/><line class="d-stitch-strong" x1="30" y1="83" x2="190" y2="83"/>`;
        s += `<rect class="d-slider" x="140" y="58" width="14" height="24" rx="4"/>`;
        break;
      }
      case 'open': {
        s += zipBand(20, 200, 60, 20);
        s += `<path class="d-open" d="M20,60 H110 L110,60"/>`;
        s += `<rect class="d-slider" x="104" y="56" width="16" height="28" rx="4"/>`;
        s += `<path class="d-arrow-strong" d="M150,104 H124 M131,97 L123,104 L131,111"/>`;
        s += T_(110, 40, 'slider in the middle', 'middle') + T_(156, 109, 'open!');
        break;
      }
      case 'layout':
      case 'sew': {
        const x0 = 10, x1 = 210, y0 = 34, y1 = 110, xm = 110, n = boxed ? 11 : 0, m = plan.T.boxyTop ? 8 : 0;
        // Rectangle with square notches of nL at the left corners and nR at the right corners.
        const shape = (a, b, nL, nR) =>
          `M${a + nL},${y0} H${b - nR} V${y0 + nR} H${b} V${y1 - nR} H${b - nR} V${y1} H${a + nL} V${y1 - nL} H${a} V${y0 + nL} H${a + nL} Z`;
        const ext = shape(x0, xm, n, m), lin = shape(xm, x1, m, n);
        s += `<path class="d-ext" d="${ext}" fill="${sw}"/><path class="d-line" d="${ext}"/>`;
        s += `<path class="d-lin" d="${lin}"/><path class="d-line" d="${lin}"/>`;
        const zt = m ? y0 + m : y0 - 10, zb = m ? y1 - m : y1 + 10;
        s += `<rect class="d-tape" x="${xm - 4}" y="${zt}" width="8" height="${zb - zt}" rx="2"/>`;
        s += `<line class="d-teeth" x1="${xm + (m ? 0 : 4)}" y1="${zt + 2}" x2="${xm + (m ? 0 : 4)}" y2="${zb - 2}" stroke-width="3"/>`;
        if (key === 'sew') {
          const i = 5;
          let p;
          if (m) {
            p = `M${x1 - i},${y0 + 52} V${y1 - n - i} H${x1 - n - i} V${y1 - i} H${xm + m + i}` +
              ` M${xm - m - i},${y1 - i} H${x0 + n + i} V${y1 - n - i} H${x0 + i} V${y0 + n + i} H${x0 + n + i} V${y0 + i} H${xm - m - i}` +
              ` M${xm + m + i},${y0 + i} H${x1 - n - i} V${y0 + n + i} H${x1 - i} V${y0 + 24}`;
          } else if (n) {
            p = `M${x1 - i},${y0 + 52} V${y1 - n - i} H${x1 - n - i} V${y1 - i} H${x0 + n + i} V${y1 - n - i} H${x0 + i} V${y0 + n + i} H${x0 + n + i} V${y0 + i} H${x1 - n - i} V${y0 + n + i} H${x1 - i} V${y0 + 24}`;
          } else {
            p = `M${x1 - i},${y0 + 52} V${y1 - i} H${x0 + i} V${y0 + i} H${x1 - i} V${y0 + 24}`;
          }
          s += `<path class="d-stitch-strong" d="${p}"/>`;
        }
        s += `<line class="d-gap" x1="${x1 + 3}" y1="${y0 + 26}" x2="${x1 + 3}" y2="${y0 + 50}"/>`;
        s += T_(60, 24, 'exterior', 'middle') + T_(160, 24, 'lining', 'middle') + T_(x1 - 2, 128, 'gap', 'end');
        s += T_(60, 128, key === 'sew' ? 'sew all round' : 'right sides together', 'middle');
        break;
      }
      case 'box': {
        s += `<path class="d-ext" d="M40,16 H180 V104 H40 Z" fill="${sw}"/><path class="d-line" d="M40,16 H180 V104 H40 Z"/>`;
        s += `<line class="d-seam" x1="110" y1="16" x2="110" y2="104"/>`;
        s += `<line class="d-stitch-strong" x1="40" y1="94" x2="180" y2="94"/>`;
        s += `<rect class="d-chip" x="92" y="26" width="36" height="20" rx="4"/>`;
        s += T_(110, 41, 'seams', 'middle') + T_(110, 126, `sew across, ${f(plan.sa)} in`, 'middle');
        break;
      }
      case 'boxTop': {
        s += `<path class="d-ext" d="M40,16 H110 V104 H40 Z" fill="${sw}"/><path class="d-lin" d="M110,16 H180 V104 H110 Z"/>`;
        s += `<path class="d-line" d="M40,16 H180 V104 H40 Z"/>`;
        s += `<rect class="d-tape" x="102" y="16" width="16" height="88"/>`;
        s += `<line class="d-teeth" x1="110" y1="18" x2="110" y2="102" stroke-width="5"/>`;
        s += `<line class="d-stitch-strong" x1="40" y1="94" x2="180" y2="94"/>`;
        s += T_(75, 60, 'exterior', 'middle') + T_(145, 60, 'lining', 'middle');
        s += T_(110, 126, 'sew across the zipper end', 'middle');
        break;
      }
      case 'finish': {
        const dims = st.dims[st.type];
        const inner = mini(st.type, dims, st.swatch).replace('viewBox="0 0 160 112"', 'x="30" y="4" width="160" height="112" viewBox="0 0 160 112"');
        s += inner + T_(110, 132, 'ta-da!', 'middle');
        break;
      }
      default:
        return '';
    }
    return `<svg viewBox="0 0 220 140" aria-hidden="true" focusable="false">${s}</svg>`;
  }

  global.Draw = { preview, mini, piece, diagram };
})(window);
