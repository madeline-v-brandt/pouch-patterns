/* The Pouch Project: pouch types, pattern math, cut lists, materials and sewing steps.
   Every measurement in this file is in inches. app.js converts for display.

   To add a new pouch type: add an entry to TYPES, then teach shape() and computePlan()
   (pieces) and buildSteps() (instructions) about it, and draw.js how to draw it. */
(function (global) {
  'use strict';

  const STD_ZIPPERS = [7, 9, 10, 12, 14, 16, 18, 20, 22, 24, 30];

  // tape = total tape width. topSA = distance from tape edge to a stitch line
  // ⅛″ from the teeth, which becomes the seam allowance along the zipper edge.
  const GAUGES = {
    '3':   { label: '#3',   tape: 1,     topSA: 0.25,  desc: 'Fine' },
    '4.5': { label: '#4.5', tape: 1.125, topSA: 0.375, desc: 'Everyday' },
    '5':   { label: '#5',   tape: 1.25,  topSA: 0.375, desc: 'Chunky' },
  };

  const STRUCTURES = {
    none:   { label: 'None',       short: '',            material: null,                        desc: 'Just fabric and lining' },
    soft:   { label: 'Soft',       short: 'interfacing', material: 'Woven fusible interfacing', desc: 'Light, a little body',   bolt: 20, boltCm: 50,  trimSA: false },
    medium: { label: 'Padded',     short: 'fleece',      material: 'Fusible fleece',            desc: 'Cushioned, gentle shape', bolt: 45, boltCm: 115, trimSA: true },
    firm:   { label: 'Structured', short: 'foam',        material: 'Sew-in foam stabilizer',    desc: 'Stands up on its own',    bolt: 58, boltCm: 150, trimSA: true },
  };

  const TYPES = {
    flat: {
      name: 'Flat Zip Pouch',
      blurb: 'Pencil cases, cord keepers, card pouches.',
      level: 'Beginner', time: 'About 45 min',
      boxed: false, boxyTop: false, handles: false, structure: 'soft',
      dims: [
        { key: 'w', label: 'Width',  hint: 'side to side',     min: 3, max: 14, def: 8 },
        { key: 'h', label: 'Height', hint: 'bottom to zipper', min: 3, max: 10, def: 5 },
      ],
    },
    boxed: {
      name: 'Boxed Makeup Bag',
      blurb: 'Flat base, soft rounded top. Makeup and toiletries.',
      level: 'Confident beginner', time: 'About 1¼ hr',
      boxed: true, boxyTop: false, handles: false, structure: 'medium',
      dims: [
        { key: 'w', label: 'Width',  hint: 'across the base', min: 3,   max: 12, def: 8 },
        { key: 'h', label: 'Height', hint: 'base to zipper',  min: 3,   max: 9,  def: 5 },
        { key: 'd', label: 'Depth',  hint: 'front to back',   min: 1.5, max: 6,  def: 3 },
      ],
    },
    boxy: {
      name: 'Boxy Pouch',
      blurb: 'Squared top and bottom, so it sits like a little box.',
      level: 'Confident beginner', time: 'About 1½ hr',
      boxed: true, boxyTop: true, handles: false, structure: 'medium',
      dims: [
        { key: 'w', label: 'Width',  hint: 'across the base', min: 3.5, max: 12, def: 8 },
        { key: 'h', label: 'Height', hint: 'base to top',     min: 3,   max: 8,  def: 4.5 },
        { key: 'd', label: 'Depth',  hint: 'front to back',   min: 2.5, max: 6,  def: 4 },
      ],
    },
    tote: {
      name: 'Zip-Top Tote',
      blurb: 'A roomy carryall with handles and a boxed base.',
      level: 'Intermediate', time: '2 to 3 hr',
      boxed: true, boxyTop: false, handles: true, structure: 'medium',
      dims: [
        { key: 'w',    label: 'Width',       hint: 'across the base',      min: 8,  max: 20, def: 15 },
        { key: 'h',    label: 'Height',      hint: 'base to zipper',       min: 8,  max: 16, def: 12 },
        { key: 'd',    label: 'Depth',       hint: 'front to back',        min: 3,  max: 8,  def: 5 },
        { key: 'drop', label: 'Handle drop', hint: 'zipper to handle top', min: 5,  max: 12, def: 8 },
      ],
    },
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const roundTo = (v, step) => Math.round(v / step) * step;
  const roundUp = (v, step) => Math.ceil(v / step - 1e-9) * step;
  const floorTo = (v, step) => Math.floor(v / step + 1e-9) * step;

  const recommendedZipper = span => STD_ZIPPERS.find(z => z >= span) || null;

  // Boxy pouch: squares cut from the top corners box the zipper ends.
  // About a third of the depth, like the Pearl Pouch's 1″–1¼″ top squares.
  const topSquare = D => clamp(roundTo(D * 0.32, 0.25), 0.75, D / 2);

  /* Core geometry shared by the plan and the zipper-to-width helper.
     Boxed corners: a raw-edge square of half the depth gives that depth.
     Boxy top: the zipper runs between the top cut-outs, so it must be cut to exactly `span`. */
  function shape(type, dm, sa, gauge) {
    const T = TYPES[type];
    const W = dm.w, H = dm.h, D = T.boxed ? dm.d : 0;
    const topSA = GAUGES[gauge].topSA;
    const t = T.boxyTop ? topSquare(D) : 0;
    const seamW = W + D;
    const P = seamW + 2 * sa;
    const panelH = T.boxyTop ? H + D / 2 + t + 2 * sa : H + D / 2 + topSA + sa;
    const span = P - 2 * t;
    return { T, W, H, D, topSA, t, seamW, P, panelH, span, notch: D / 2, exact: T.boxyTop };
  }

  // The width that suits a chosen zipper: about 1″ to trim off, or ½″ for a cut-to-fit boxy zipper.
  // Never so narrow that the next-smaller standard zipper would fit instead.
  function widthForZipper(type, dm, sa, gauge, Z) {
    const g = shape(type, dm, sa, gauge);
    const offset = g.D + 2 * sa - 2 * g.t;            // span = width + offset
    const ideal = floorTo((g.exact ? Z - 0.5 : Z - 1) - offset, 0.25);
    const prev = STD_ZIPPERS.filter(z => z < Z).pop();
    const least = prev ? roundUp(prev + 0.01 - offset, 0.25) : -Infinity;
    return Math.max(ideal, Math.min(least, floorTo(Z - offset, 0.25)));
  }

  /* How the zipper meets the panel.
     long: longer than the panel, overhangs and is trimmed after sewing.
     cut:  boxy pouch, cut to exact length before sewing; the boxed ends become the stops.
     tabs: shorter than needed, so fabric tabs extend it. */
  function resolveZipper(s, geo, g, sa) {
    const { span, seamW, exact } = geo;
    const rec = recommendedZipper(span);
    let mode = s.zipMode, len = s.zipLen;
    if (s.zipAuto) {
      if (rec) { mode = 'std'; len = rec; } else { mode = 'yard'; }
    }
    const fullOpen = exact ? span - 2 * sa - 0.5 : seamW - 0.5;
    if (mode === 'yard') {
      const cut = exact ? span : roundUp(span + 2, 0.5);
      return { mode, length: cut, method: exact ? 'cut' : 'long', opening: fullOpen, extra: cut - span, rec, kind: 'coil' };
    }
    const kind = s.zipKind;
    if (len >= span) {
      return { mode, length: len, method: exact ? 'cut' : 'long', opening: fullOpen, extra: len - span, rec, kind };
    }
    const ext = Math.max(0.75, (span - len) / 2 + 0.25);
    const tabW = roundUp(g.tape + 0.5, 0.25);
    const tabL = roundUp(2 * ext + 2, 0.25);
    const opening = Math.max(1, Math.min(len - 1, fullOpen));
    return { mode, length: len, method: 'tabs', ext, tabW, tabL, opening, rec, kind };
  }

  /* ---------- Fabric quantities (simple shelf packing) ---------- */
  function packLength(pieces, binW) {
    const rects = [];
    for (const p of pieces) {
      for (let i = 0; i < p.qty; i++) {
        let w = p.w, h = p.h;
        if (p.rotatable && h > w && h <= binW) [w, h] = [h, w];
        if (w > binW) {
          if (h <= binW) [w, h] = [h, w];
          else return Infinity;
        }
        rects.push({ w, h });
      }
    }
    rects.sort((a, b) => b.h - a.h || b.w - a.w);
    const shelves = [];
    for (const r of rects) {
      let shelf = shelves.find(x => x.used + r.w <= binW + 1e-6);
      if (!shelf) { shelf = { used: 0, h: r.h }; shelves.push(shelf); }
      shelf.used += r.w;
    }
    return shelves.reduce((a, x) => a + x.h, 0);
  }
  const fitsIn = (pieces, a, b) => packLength(pieces, a) <= b || packLength(pieces, b) <= a;

  const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  function yardText(yd) {
    const e = Math.round(yd * 8), w = Math.floor(e / 8), r = e % 8;
    return `${w || ''}${EIGHTHS[r]}`;
  }

  function lengthNeeded(len, units, bolt, boltCm, minYd) {
    if (units === 'in') {
      const yd = Math.max(minYd, roundUp((len + 2) / 36, 0.125));
      return `${yardText(yd)} yd of ${bolt}″-wide`;
    }
    const m = Math.max(minYd * 0.9144, roundUp((len + 2) * 0.0254, 0.1));
    return `${m.toFixed(1)} m of ${boltCm} cm wide`;
  }

  // Returns { main, sub, line }: main/sub for the cut-list headings, line for the materials list.
  function fabricAmount(pieces, units) {
    const len = packLength(pieces, 42);
    const yardage = `${lengthNeeded(len, units, 42, 110, 0.25)} fabric`;
    if (fitsIn(pieces, 9, 21)) {
      const size = units === 'in' ? '9″ × 21″' : 'about 23 × 55 cm';
      return { main: 'Fits a fat eighth', sub: `${size}, or ${yardage}`, line: `A fat eighth (${size}) or ${yardage}` };
    }
    if (fitsIn(pieces, 18, 21)) {
      const size = units === 'in' ? '18″ × 21″' : 'about 46 × 55 cm';
      return { main: 'Fits a fat quarter', sub: `${size}, or ${yardage}`, line: `A fat quarter (${size}) or ${yardage}` };
    }
    const [amt, rest] = yardage.split(' of ');
    return { main: amt, sub: `of ${rest}`, line: yardage };
  }

  function stabilizerAmount(pieces, st, units) {
    const t = `${lengthNeeded(packLength(pieces, st.bolt), units, st.bolt, st.boltCm, 0.25)} ${st.short}`;
    const [amt, rest] = t.split(' of ');
    return { main: amt, sub: `of ${rest}`, line: t };
  }

  /* ---------- The plan ---------- */
  function computePlan(s, fx) {
    const f = fx.f;
    const dm = s.dims[s.type];
    const sa = s.sa;
    const g = GAUGES[s.gauge];
    const st = STRUCTURES[s.structure];
    const geo = shape(s.type, dm, sa, s.gauge);
    const { T, W, H, D, topSA, t, seamW, P, panelH, span, notch } = geo;

    const zip = resolveZipper(s, geo, g, sa);
    const gap = T.handles ? 5 : clamp(roundTo(W * 0.5, 0.5), 3, Math.min(5, W - 1));

    // Inside slip pocket, sized to the lining panel and kept clear of the boxed corners.
    let pocket = null, pocketBlocked = false;
    if (s.pocket) {
      const top = topSA + t + (H >= 6 ? 1.25 : 0.75);
      const bottomLimit = panelH - sa - D / 2 - 0.5;
      const avail = bottomLimit - top;
      const pw = Math.min(clamp(roundTo(W * 0.6, 0.5), 3, 10), W - 1);
      const ph = Math.min(roundTo(H * 0.6, 0.25), floorTo(avail, 0.25));
      if (ph >= 2 && pw >= 3) pocket = { pw, ph, top };
      else pocketBlocked = true;
    }

    let straps = null;
    if (T.handles) {
      const spacing = clamp(roundTo(W * 0.35, 0.5), 4, 7);
      const finishedLen = 2 * dm.drop + 0.6 * spacing;
      straps = { spacing, cut: roundUp(finishedLen + 2 * topSA, 0.5), cutW: 4, width: 1 };
    }

    /* Pieces */
    const pieces = [];
    const seam = { top: topSA, side: sa };
    const cornerNote = T.boxyTop
      ? `Cut ${f(notch)} squares from the bottom corners and ${f(t)} squares from the top corners.`
      : T.boxed ? `Cut ${f(notch)} squares from the two bottom corners.` : '';
    pieces.push({
      id: 'ext', name: 'Exterior panel', fabric: 'exterior', qty: 2, w: P, h: panelH,
      notch, topNotch: t, seam, zipperEdge: true, grain: 'v',
      note: cornerNote || 'Top edge is the zipper edge.',
    });
    if (zip.method === 'tabs') {
      pieces.push({
        id: 'tab', name: 'Zipper tab', fabric: 'exterior', qty: 2, w: zip.tabW, h: zip.tabL,
        folds: [0.5, zip.tabL / 2, zip.tabL - 0.5], grain: 'v', rotatable: true,
        note: `Press both ends under ${f(0.5)}, then fold in half.`,
      });
    }
    if (straps) {
      pieces.push({
        id: 'strap', name: 'Strap', fabric: 'exterior', qty: 2, w: straps.cut, h: straps.cutW,
        folds: [1, 2, 3], grain: 'h', rotatable: true, long: true,
        note: `Folds into a ${f(straps.width)} strap, four layers thick.`,
      });
    }
    pieces.push({
      id: 'lin', name: 'Lining panel', fabric: 'lining', qty: 2, w: P, h: panelH,
      notch, topNotch: t, seam, zipperEdge: true, grain: 'v',
      note: cornerNote || 'Same size as the exterior.',
    });
    if (pocket) {
      const ph2 = 2 * (pocket.ph + sa);
      pieces.push({
        id: 'pocket', name: 'Slip pocket', fabric: 'lining', qty: 1, w: pocket.pw + 2 * sa, h: ph2,
        folds: [ph2 / 2], grain: 'v', rotatable: true,
        note: `Folds in half to a ${f(pocket.pw)} × ${f(pocket.ph)} pocket.`,
      });
    }
    let inter = null;
    if (st.material) {
      inter = st.trimSA
        ? { id: 'int', name: st.material, fabric: 'interfacing', qty: 2, w: seamW, h: panelH - topSA - sa,
            notch: Math.max(0, notch - sa), topNotch: Math.max(0, t - sa), seam: null, grain: 'v',
            note: 'No seam allowance. It sits inside the stitch lines.' }
        : { id: 'int', name: st.material, fabric: 'interfacing', qty: 2, w: P, h: panelH,
            notch, topNotch: t, seam: null, grain: 'v', note: 'Same size as the exterior panel.' };
      pieces.push(inter);
    }

    const byFabric = k => pieces.filter(p => p.fabric === k);
    const amounts = {
      exterior: fabricAmount(byFabric('exterior'), fx.units),
      lining: fabricAmount(byFabric('lining'), fx.units),
    };
    if (inter) amounts.interfacing = stabilizerAmount(byFabric('interfacing'), st, fx.units);

    /* Advice */
    const notes = [];
    if (zip.method === 'tabs' && zip.opening < 0.7 * seamW) {
      const pct = Math.round((zip.opening / seamW) * 100);
      notes.push({ kind: 'warn', text: `This zipper opens only about ${pct}% of the top, so the opening will be narrow. ${zip.rec ? `A ${fx.zipLabel(zip.rec)} zipper opens the full width.` : 'Zipper by the yard opens the full width.'}` });
    }
    if (zip.mode === 'std' && zip.method !== 'tabs' && zip.extra > 6) {
      notes.push({ kind: 'tip', text: `That zipper is ${f(zip.extra)} longer than you need. It works fine; you'll just trim more off.` });
    }
    if (zip.mode === 'std' && zip.kind === 'metal' && zip.method === 'long') {
      notes.push({ kind: 'warn', text: 'Metal teeth break needles. You\'ll pull a few teeth off where the side seams cross the zipper (see the steps).' });
    }
    if (zip.mode === 'std' && zip.kind === 'metal' && zip.method === 'cut') {
      notes.push({ kind: 'warn', text: 'A boxy pouch zipper gets cut to length and sewn through at the ends. Nylon coil is much easier for this than metal.' });
    }
    if (T.boxed && D > H) notes.push({ kind: 'tip', text: 'Deeper than it is tall, so it will sit low and wide, like a tray. Great for brushes and pens.' });
    if (T.boxed && D > 0.8 * W) notes.push({ kind: 'tip', text: 'Nearly as deep as it is wide. The ends will look almost square from above.' });
    if (!T.boxed && H > W) notes.push({ kind: 'tip', text: 'Taller than wide: a nice shape for a phone, passport or glasses.' });
    if (s.structure === 'firm' && T.boxed && D < 2.5) notes.push({ kind: 'tip', text: 'Foam is stiff in small corners. Fleece is easier to box at this depth.' });
    if (s.structure === 'none' && T.boxed) notes.push({ kind: 'tip', text: 'With no interfacing it will be soft and slouchy. Canvas or a quilted exterior helps it hold the box shape.' });
    if (pocketBlocked) notes.push({ kind: 'warn', text: 'This pouch is too short for an inside pocket. Make it a little taller to fit one.' });

    // Width across the top once sewn: the zipper seam, less the boxed top corners on a boxy pouch.
    const topWidth = T.boxyTop ? seamW - 2 * t : seamW;
    const c = { T, s, g, st, W, H, D, sa, topSA, t, seamW, P, span, panelH, notch, topWidth, zip, gap, pocket, straps, inter };
    const steps = buildSteps(c, fx);
    const materials = buildMaterials(c, fx, amounts);

    let zipNote;
    if (zip.method === 'cut') {
      zipNote = zip.mode === 'yard'
        ? `Cut ${f(span)} of coil and add a slider. The ends get sewn into the boxed top corners.`
        : `You'll cut it down to ${f(span)}, the space between the top corner cut-outs.`;
    } else if (zip.method === 'tabs') {
      zipNote = `Shorter than the ${f(span)} it needs to cover, so you'll add little fabric tabs to the ends.`;
    } else if (zip.mode === 'yard') {
      zipNote = `Cut ${f(zip.length)} of coil and add a slider. You'll trim the ends after sewing.`;
    } else {
      zipNote = `Longer than the ${f(P)} panel, so it overhangs and you trim the ends after sewing.`;
    }

    return { ...c, pieces, amounts, notes, steps, materials, zipNote, pocketBlocked };
  }

  /* ---------- Materials ---------- */
  function buildMaterials(c, fx, amounts) {
    const { T, g, st, zip, straps, span } = c;
    const f = fx.f;
    const fabric = [
      { id: 'fab-ext', name: 'Exterior fabric', amount: amounts.exterior.line,
        detail: T.handles ? 'Canvas, duck cloth or home-décor cotton' : 'Quilting cotton, linen, canvas or an old quilt' },
      { id: 'fab-lin', name: 'Lining fabric', amount: amounts.lining.line, detail: 'Quilting cotton' },
    ];
    if (amounts.interfacing) {
      fabric.push({ id: 'fab-int', name: st.material, amount: amounts.interfacing.line,
        detail: { soft: 'Gives cotton a little body', medium: 'Soft and cushy, fuses with an iron', firm: 'Holds its shape, sews like fabric' }[c.s.structure] });
    }
    const zipName = zip.mode === 'yard'
      ? `${f(zip.length)} of ${g.label} zipper coil and 1 ${g.label} slider`
      : `One ${fx.zipLabel(zip.length)} ${g.label} ${zip.kind === 'metal' ? 'metal' : 'nylon coil'} zipper`;
    const zipDetail = { tabs: 'Ends get fabric tabs', cut: `Cut down to ${f(span)}`, long: 'You\'ll trim it to fit' }[zip.method];
    const notions = [
      { id: 'zip', name: zipName, detail: zip.mode === 'yard' ? '' : zipDetail },
      { id: 'thread', name: 'All-purpose polyester thread', detail: 'Match the exterior, or pick a contrast for topstitching' },
      { id: 'pull', name: 'Zipper pull (optional)', detail: 'Ribbon, leather cord or a vintage charm' },
    ];
    if (straps) {
      notions.push({ id: 'webbing', name: 'Cotton webbing (optional)', detail: `2 × ${f(straps.cut)} of ${f(1)} webbing, instead of fabric straps` });
    }
    return { fabric, notions };
  }

  /* ---------- Sewing steps ---------- */
  function buildSteps(c, fx) {
    const f = fx.f;
    const B = v => `<b>${f(v)}</b>`;
    const { T, s, g, st, sa, topSA, t, P, span, notch, zip, gap, pocket, straps, inter } = c;
    const coil = zip.kind !== 'metal';
    const boxy = T.boxyTop;
    const steps = [];
    const add = (id, title, body, extra) => steps.push(Object.assign({ id, title, body }, extra || {}));

    let corners = '';
    if (boxy) corners = `Then cut squares from all four corners of every exterior and lining panel: ${B(notch)} at the bottom and ${B(t)} at the top (the zipper edge)${inter && inter.notch > 0 ? `. The ${st.short} pieces get ${B(inter.notch)} and ${B(inter.topNotch)} squares` : ''}. `;
    else if (T.boxed) corners = `Then cut a ${B(notch)} square from both bottom corners of every exterior and lining panel${inter && inter.notch > 0 ? `, and a ${B(inter.notch)} square from the ${st.short} pieces` : ''}. `;
    add('cut', 'Cut your pieces',
      `Cut everything in the cut list. ${corners}Mark the top (zipper) edge of each panel with chalk so you don't mix up top and bottom.`,
      { tip: 'Using a directional print? Make sure it points up on both exterior panels, with the top at the zipper edge.' });

    if (inter) {
      const fuse = {
        soft: `Lay each exterior panel wrong side up and put the interfacing on top, glue side down (the slightly shiny, bumpy side). Press with a hot, dry iron for about 10 seconds at a time, lifting the iron instead of sliding it.`,
        medium: `Center the fleece on the wrong side of each exterior panel, glue side down. You'll see a ${B(sa)} border of bare fabric at the sides and bottom and ${B(topSA)} at the top. Turn it over and fuse from the fabric side with steam, about 10 seconds per spot.`,
        firm: `Foam doesn't fuse. Center it on the wrong side of each exterior panel, inside the stitch lines, and hold it with temporary spray adhesive. Or quilt the two together with straight lines about ${B(1)} apart, which looks lovely and stops the foam shifting.`,
      }[s.structure];
      add('fuse', s.structure === 'firm' ? 'Attach the foam' : `Fuse the ${st.short}`, fuse,
        { diagram: 'fuse', tip: s.structure === 'soft' ? 'If your lining is thin, fuse interfacing to the lining panels too.' : '' });
    }

    if (pocket) {
      add('pocket', 'Make the slip pocket',
        `Fold the pocket piece in half, right sides together, so the fold is at the top. Sew the sides and bottom with a ${B(sa)} seam allowance, leaving a ${B(2)} gap in the bottom. Clip the corners, turn it right side out and press, tucking in the gap edges. Topstitch ${B(0.125)} from the fold. Center it on the right side of one lining panel with its top edge ${B(pocket.top)} below the lining's top edge, then edgestitch the sides and bottom, which also closes the gap.`,
        { diagram: 'pocket', tip: 'Backstitch at the two top corners. They take the most strain.' });
    }

    if (straps) {
      add('straps', 'Make the straps',
        `Fold each strap strip in half lengthwise, wrong sides together, and press. Open it, fold both long edges in to meet the center crease and press, then fold in half again. You now have a ${B(1)} strap, four layers thick. Edgestitch ${B(0.125)} from both long edges.`,
        { diagram: 'strap', tip: `Using webbing instead? Skip this step and cut two ${f(straps.cut)} lengths. Seal the ends with a lighter if it's polyester.` });
      add('straps-on', 'Baste the straps to the exterior',
        `On the right side of each exterior panel, mark the top edge ${B(straps.spacing / 2)} each side of center. Line up the strap ends with the raw top edge at those marks, with the loop hanging down over the panel. Check the strap isn't twisted, then baste ${B(0.125)} from the edge, going back and forth a few times.`,
        { diagram: 'strapsOn' });
    }

    if (zip.method === 'tabs') {
      const target = boxy ? span : P;
      add('zip-prep', 'Add tabs to the zipper ends',
        `Fold both short ends of each tab ${B(0.5)} to the wrong side and press. Fold the tab in half so the pressed edges meet, and press again. Slide one end of the zipper ${B(0.5)} into the tab, between the folded edges, and edgestitch across ${B(0.125)} from the fold. Repeat at the other end, keeping the slider in the middle. ${boxy ? `Trim the tabs so zipper plus tabs measures exactly ${B(target)}` : `Zipper plus tabs should now measure at least ${B(target)}`}. Trim the tab sides even with the zipper tape.`,
        { diagram: 'tabs' });
    } else if (zip.mode === 'yard') {
      add('zip-prep', 'Cut the zipper and add the slider',
        `Cut ${B(zip.length)} of ${g.label} coil. Hold the two halves even and push both into the wide end of the slider at the same time, then pull the slider up about ${B(1)}. Check the teeth zip together evenly. If they don't, pull the slider off and try again. Move the slider to the middle${boxy ? ' and keep it away from the ends until they are sewn into the corners' : ''}.`,
        { tip: `Use a slider made for ${g.label} coil. They aren't interchangeable.` });
    } else if (zip.method === 'cut') {
      add('zip-prep', 'Cut the zipper to length',
        `Move the slider to the middle. Measure ${B(span)} centered on the zipper and cut off both ends. That's the distance between the top corner cut-outs. The ends get sewn into the boxed top corners, which become the new zipper stops, so keep the slider away from the cut ends until then.`,
        { tip: 'A dab of fray check or a few hand stitches across each cut end keeps the slider from running off.' });
    } else {
      add('zip-prep', 'Get the zipper ready',
        `Your zipper is longer than the ${B(P)} panel, which is the easy way to do it. Move the slider to the middle, center the zipper along the panel's top edge and let the ends hang off. You'll trim them after sewing.${!coil ? ` Metal teeth will break a needle, so mark where the panel edges fall on the zipper and pull the teeth off with pliers for ${B(sa + 0.25)} inside each mark.` : ''}`,
        { tip: coil ? 'Nylon coil is fine to sew straight across. That\'s why longer-than-needed is the easy option.' : '' });
    }

    add('zip-1', 'Sew the first side of the zipper',
      `Lay one exterior panel right side up with its top edge away from you. Place the zipper face down on it, with the edge of the tape along the panel's top edge${boxy ? ' and the zipper ends lined up with the inner corners of the top cut-outs' : ''}${straps ? ' (covering the strap ends)' : ''}. Add a lining panel right side down, top edges even. Clip the three layers. With your zipper foot, sew ${B(topSA)} from the edge, about ${B(0.125)} from the teeth.`,
      { diagram: 'sandwich', tip: 'When the slider gets in the way, stop with the needle down, lift the presser foot and slide the pull behind the foot.' });

    add('zip-1-top', 'Press and topstitch',
      `Fold the exterior and lining away from the zipper, wrong sides together, so the teeth are uncovered. Press${coil ? ' with a cool iron (nylon coil melts)' : ''}. Topstitch through all layers ${B(0.125)} from the fold.`,
      { diagram: 'topstitch', tip: 'A slightly longer stitch, around 3 mm, makes topstitching look neater.' });

    add('zip-2', 'Sew the second side',
      `Lay the other exterior panel right side up. Place the zipper unit on it, face down, with the free edge of the tape along the top edge, so the two exterior panels face each other. Put the second lining panel on top, right side down. Make sure the side edges line up with the first pair, then clip, sew, press and topstitch the same way.`,
      { diagram: 'second' });

    add('open', 'Open the zipper halfway',
      `Do this before you sew the sides. You'll turn the pouch right side out through the open zipper, and once the ends are sewn a closed zipper can't be opened from inside.`,
      { diagram: 'open', highlight: true });

    add('pin', 'Line everything up',
      `Open it all out so the two exterior panels are right sides together and the two lining panels are right sides together. ${boxy ? 'Match the side edges of the exterior and of the lining; the zipper sits in the middle with a cut-out on each side of its ends.' : `At each end, fold the zipper tape${zip.method === 'tabs' ? ' and tab' : ''} toward the lining so the teeth point at the lining side, and match the zipper seams exactly.`} Clip all around. Mark a ${B(gap)} gap in the middle of the lining's bottom edge.`,
      { diagram: 'layout' });

    const slow = coil ? '' : ', turning the hand wheel by hand over the zipper ends';
    let sewText;
    if (boxy) sewText = `Sew the side seams and the bottom edges with a ${B(sa)} seam allowance. Skip all eight cut-out corners, and leave the ${B(gap)} gap in the lining's bottom. Backstitch at the start and end of every seam.`;
    else if (T.boxed) sewText = `Sew the side seams and both bottom edges with a ${B(sa)} seam allowance, skipping the cut-out corners and the ${B(gap)} gap in the lining's bottom. Backstitch at the start and end of every seam. Go slowly across the zipper${slow}.`;
    else sewText = `Starting at one side of the gap, sew all the way around with a ${B(sa)} seam allowance and stop at the other side of the gap. Backstitch at both ends. Go slowly across the zipper${slow}.`;
    add('sew', 'Sew around the edges', sewText, { diagram: 'sew' });

    if (!boxy) {
      add('trim', T.boxed ? 'Trim the zipper ends' : 'Trim and clip',
        T.boxed
          ? `Trim the zipper${zip.method === 'tabs' ? ' tabs' : ' ends'} even with the raw edges of the panels.`
          : `Trim the zipper${zip.method === 'tabs' ? ' tabs' : ' ends'} even with the raw edges. Clip the four corners diagonally, close to the stitching but not through it, so they turn out crisp.`);
    }

    if (boxy) {
      add('box-top', 'Box the zipper ends',
        `At one end of the zipper, open out the cut-out corners. Flatten the end so the side seams sit on top of the zipper, with the zipper running across the middle and the exterior and lining corners on either side. The raw edges form one straight line. Clip, and sew straight across with a ${B(sa)} seam allowance, going slowly over the zipper${coil ? '' : ' and by hand over any metal teeth'}. Repeat at the other end. These seams are the zipper stops now.`,
        { diagram: 'boxTop', tip: 'Check from the outside before you move on: the zipper end should sit centered on the end of the pouch.' });
    }

    if (T.boxed) {
      add('box', boxy ? 'Box the bottom corners' : 'Box the corners',
        `Open one bottom cut-out corner and pull it apart so the side seam sits right on top of the bottom seam, making a straight raw edge. Press the two seam allowances in opposite directions so they nest, clip, and sew straight across with a ${B(sa)} seam allowance. Repeat on all four bottom corners, two exterior and two lining. Your bag is now ${B(c.D)} deep.`,
        { diagram: 'box', tip: s.structure === 'firm' ? 'Foam is bulky here. Clip well and sew slowly with a longer stitch.' : '' });
    }

    add('turn', 'Turn it right side out',
      `Reach through the gap in the lining and the open zipper, and pull the whole thing right side out. Push the corners out with a chopstick${T.boxed ? ' and shape the boxed corners with your fingers' : ''}.`);

    add('close', 'Close the gap',
      `Fold the gap's raw edges in to line up with the seam and press. Edgestitch it closed ${B(0.125)} from the edge by machine, or ladder-stitch by hand for an invisible finish.`);

    add('finish', 'Finish',
      `Push the lining down inside and give it a final press${s.structure === 'firm' ? ' (skip the iron on foam; shape it with your hands)' : ''}. Tie a loop of ribbon, leather cord or a charm through the zipper pull. Done!`,
      { diagram: 'finish' });

    return steps;
  }

  global.Pouch = { TYPES, GAUGES, STRUCTURES, STD_ZIPPERS, computePlan, recommendedZipper, widthForZipper, shape, topSquare };
})(window);
