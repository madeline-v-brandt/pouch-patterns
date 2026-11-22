/* The Pouch Project: page state, controls and rendering. */
(function () {
  'use strict';

  const P = window.Pouch, D = window.Draw;
  const KEY = 'pouchproject:v1';
  const $ = sel => document.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SWATCHES = [
    { id: 'daisy', name: 'Olive daisy', lining: 'butter yellow' },
    { id: 'calico', name: 'Rosebud calico', lining: 'sage green' },
    { id: 'plaid', name: 'Faded plaid', lining: 'caramel' },
    { id: 'gingham', name: 'Butter gingham', lining: 'thistle' },
    { id: 'cord', name: 'Mahogany corduroy', lining: 'cashmere blue' },
  ];
  const swatchInfo = () => SWATCHES.find(s => s.id === state.swatch);
  const SA_OPTIONS = [0.25, 0.375, 0.5];

  /* ---------- State ---------- */
  function defaults() {
    const dims = {}, structure = {};
    for (const [t, T] of Object.entries(P.TYPES)) {
      dims[t] = {};
      T.dims.forEach(d => (dims[t][d.key] = d.def));
      structure[t] = T.structure;
    }
    return {
      type: 'boxy', units: 'in', dims, structure,
      zipAuto: true, zipMode: 'std', zipLen: 12, gauge: '5', zipKind: 'coil',
      sa: 0.375, pocket: false, swatch: 'daisy', done: {}, have: {}, cut: {},
    };
  }

  function merge(d, s) {
    if (!s || typeof s !== 'object') return d;
    if (P.TYPES[s.type]) d.type = s.type;
    if (s.units === 'in' || s.units === 'cm') d.units = s.units;
    for (const t in d.dims) {
      for (const spec of P.TYPES[t].dims) {
        const v = s.dims && s.dims[t] && s.dims[t][spec.key];
        if (typeof v === 'number' && v >= spec.min && v <= spec.max) d.dims[t][spec.key] = v;
      }
      if (s.structure && P.STRUCTURES[s.structure[t]]) d.structure[t] = s.structure[t];
    }
    if (typeof s.zipAuto === 'boolean') d.zipAuto = s.zipAuto;
    if (s.zipMode === 'std' || s.zipMode === 'yard') d.zipMode = s.zipMode;
    if (P.STD_ZIPPERS.includes(s.zipLen)) d.zipLen = s.zipLen;
    if (P.GAUGES[s.gauge]) d.gauge = s.gauge;
    if (s.zipKind === 'coil' || s.zipKind === 'metal') d.zipKind = s.zipKind;
    if (SA_OPTIONS.includes(s.sa)) d.sa = s.sa;
    if (typeof s.pocket === 'boolean') d.pocket = s.pocket;
    if (SWATCHES.some(w => w.id === s.swatch)) d.swatch = s.swatch;
    for (const k of ['done', 'have', 'cut']) if (s[k] && typeof s[k] === 'object') d[k] = s[k];
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return merge(defaults(), raw ? JSON.parse(raw) : null);
    } catch (e) {
      return defaults();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const state = load();
  let plan = null;
  let zipMsg = '';   // one-off message after a zipper chip resizes the pouch

  /* ---------- Units ---------- */
  const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  function fmtIn(v) {
    const e = Math.round(v * 8), w = Math.floor(e / 8), r = e % 8;
    if (!w && !r) return '0″';
    return `${w || ''}${EIGHTHS[r]}″`;
  }
  function fmtCm(v) {
    const c = Math.round(v * 25.4) / 10;
    return `${c.toFixed(1).replace(/\.0$/, '')} cm`;
  }
  const f = v => (state.units === 'in' ? fmtIn(v) : fmtCm(v));
  const zipLabel = z => (state.units === 'in' ? `${z}″` : `${Math.round(z * 2.54)} cm`);

  function rangeSpec(spec) {
    if (state.units === 'in') return { min: spec.min, max: spec.max, step: 0.25 };
    return { min: Math.ceil(spec.min * 2.54 * 2) / 2, max: Math.floor(spec.max * 2.54 * 2) / 2, step: 0.5 };
  }
  const toDisplay = v => (state.units === 'in' ? v : Math.round(v * 2.54 * 2) / 2);
  const fromDisplay = v => (state.units === 'in' ? v : v / 2.54);

  /* ---------- Controls (rebuilt on type or unit change) ---------- */
  function renderShapes() {
    $('#shapePicker').innerHTML = Object.entries(P.TYPES).map(([id, T]) => {
      const on = id === state.type;
      return `<button type="button" class="shape${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-type="${id}" id="shape-${id}">
        <span class="shape-art">${D.mini(id, state.dims[id], state.swatch)}</span>
        <span class="shape-text">
          <span class="shape-name">${T.name}</span>
          <span class="shape-blurb">${T.blurb}</span>
          <span class="shape-meta">${T.level} · ${T.time}</span>
        </span>
      </button>`;
    }).join('');
  }

  function renderSize() {
    const T = P.TYPES[state.type];
    $('#sizeControls').innerHTML = T.dims.map(spec => {
      const r = rangeSpec(spec);
      return `<div class="field">
        <div class="field-top">
          <label for="dim-${spec.key}">${spec.label}<span class="hint">${spec.hint}</span></label>
          <output id="out-${spec.key}" for="dim-${spec.key}"></output>
        </div>
        <input type="range" id="dim-${spec.key}" data-dim="${spec.key}" min="${r.min}" max="${r.max}" step="${r.step}">
        <div class="range-scale" aria-hidden="true"><span>${f(spec.min)}</span><span>${f(spec.max)}</span></div>
      </div>`;
    }).join('');
    syncSizeInputs();
  }

  function syncSizeInputs() {
    const dm = state.dims[state.type];
    P.TYPES[state.type].dims.forEach(spec => {
      $(`#dim-${spec.key}`).value = toDisplay(dm[spec.key]);
      $(`#out-${spec.key}`).textContent = f(dm[spec.key]);
    });
  }

  function renderZipperControls() {
    $('#zipLens').innerHTML =
      P.STD_ZIPPERS.map(z => `<button type="button" class="chip" id="zip-${z}" data-zip="${z}">${zipLabel(z)}</button>`).join('') +
      `<button type="button" class="chip" id="zip-yard" data-zip="yard">By the yard</button>`;
    $('#gaugeSeg').innerHTML = ['3', '4.5', '5']
      .map(id => `<button type="button" id="gauge-${id.replace('.', '-')}" data-gauge="${id}" title="${P.GAUGES[id].desc}">${P.GAUGES[id].label}</button>`).join('');
  }

  function renderFinishControls() {
    $('#structSeg').innerHTML = Object.entries(P.STRUCTURES).map(([id, s]) =>
      `<button type="button" class="struct" id="struct-${id}" data-structure="${id}">
        <span class="struct-name">${s.label}</span><span class="struct-desc">${s.desc}${s.material ? `. ${s.material}` : ''}.</span>
      </button>`).join('');
    $('#saSeg').innerHTML = SA_OPTIONS.map(v =>
      `<button type="button" id="sa-${v * 1000}" data-sa="${v}">${f(v)}</button>`).join('');
  }

  function renderSwatches() {
    $('#swatches').innerHTML = SWATCHES.map(s =>
      `<button type="button" class="swatch" id="swatch-${s.id}" data-swatch="${s.id}" aria-label="${s.name}" title="${s.name}">
        <svg viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" fill="url(#pat-${s.id})"/></svg>
      </button>`).join('');
  }

  function renderUnitsLabel() {
    $('#gridLabel').textContent = state.units === 'in' ? '1″' : '2 cm';
  }

  /* ---------- Sync pressed states ---------- */
  const press = (el, on) => el && el.setAttribute('aria-pressed', on ? 'true' : 'false');

  function syncControls() {
    document.querySelectorAll('[data-units]').forEach(b => press(b, b.dataset.units === state.units));
    document.querySelectorAll('[data-zip]').forEach(b => {
      const yard = b.dataset.zip === 'yard';
      const on = yard ? plan.zip.mode === 'yard' : plan.zip.mode === 'std' && plan.zip.length === Number(b.dataset.zip);
      press(b, on);
      const rec = yard ? !plan.zip.rec : plan.zip.rec === Number(b.dataset.zip);
      b.classList.toggle('is-rec', rec);
      b.title = rec ? 'Best fit for this size' : '';
    });
    $('#zipReset').hidden = state.zipAuto;
    const lead = zipMsg || (state.zipAuto ? 'Best fit for this size (marked with a dot).' : '');
    $('#zipNote').textContent = `${lead} ${plan.zipNote}`.trim();
    document.querySelectorAll('[data-gauge]').forEach(b => press(b, b.dataset.gauge === state.gauge));
    document.querySelectorAll('[data-kind]').forEach(b => {
      press(b, b.dataset.kind === plan.zip.kind);
      b.disabled = plan.zip.mode === 'yard' && b.dataset.kind === 'metal';
    });
    document.querySelectorAll('[data-structure]').forEach(b => press(b, b.dataset.structure === state.structure[state.type]));
    document.querySelectorAll('[data-sa]').forEach(b => press(b, Number(b.dataset.sa) === state.sa));
    document.querySelectorAll('[data-swatch]').forEach(b => press(b, b.dataset.swatch === state.swatch));
    document.documentElement.dataset.swatch = state.swatch;   // picks the coordinating lining color in CSS
    $('#pocketToggle').checked = state.pocket;
  }

  /* ---------- Results ---------- */
  function renderSummary() {
    const dm = state.dims[state.type], T = plan.T, g = P.GAUGES[state.gauge];
    const size = [`${f(dm.w)} wide`, `${f(dm.h)} tall`];
    if (T.boxed) size.push(`${f(dm.d)} deep`);
    const zip = plan.zip.mode === 'yard'
      ? `${f(plan.zip.length)} of ${g.label} coil`
      : `${zipLabel(plan.zip.length)} ${g.label} ${plan.zip.kind === 'metal' ? 'metal' : 'coil'}${plan.zip.method === 'tabs' ? ', with tabs' : ''}`;
    const count = plan.pieces.reduce((a, p) => a + p.qty, 0);
    const rows = [
      ['Finished size', size.join(' × ')],
      ['Zipper', zip],
      ['Opening', `About ${f(plan.zip.opening)}`],
      ['Pieces to cut', `${count}`],
    ];
    const sw = swatchInfo();
    rows.push(['Fabric', `${sw.name} outside, <span class="nowrap"><span class="lining-dot" aria-hidden="true"></span>${sw.lining} lining</span>`]);
    if (T.boxed) rows.splice(1, 0, ['Top width', `${f(plan.topWidth)} ${T.boxyTop ? 'across the flat top' : 'along the zipper'}`]);
    $('#summary').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#notes').innerHTML = plan.notes.map(n => `<li class="note note-${n.kind}">${n.text}</li>`).join('');
  }

  const FABRIC_LABEL = { exterior: 'Exterior fabric', lining: 'Lining fabric' };
  let lastPiecesWidth = 0;
  function renderPieces() {
    const host = $('#pieces');
    const cw = host.clientWidth || 900;
    lastPiecesWidth = cw;
    const normal = plan.pieces.filter(p => !p.long);
    const maxW = Math.max(...normal.map(p => p.w));
    const maxH = Math.max(...normal.map(p => p.h));
    const ppi = clamp(Math.min((cw - 110) / maxW, 420 / maxH), 5, 24);
    const opts = { maxPx: Math.max(160, cw - 110), gridStep: state.units === 'in' ? 1 : 2 / 2.54 };
    const chipFill = { interfacing: 'url(#pat-hatch)', lining: null, exterior: `url(#pat-${state.swatch})` };
    const chip = fab => `<span class="fab-chip"><svg viewBox="0 0 18 18" aria-hidden="true"><rect width="18" height="18"${chipFill[fab] ? ` fill="${chipFill[fab]}"` : ' class="pc-lin"'}/></svg></span>`;

    host.innerHTML = ['exterior', 'lining', 'interfacing'].map(fab => {
      const items = plan.pieces.filter(p => p.fabric === fab);
      if (!items.length) return '';
      const amt = plan.amounts[fab];
      const title = fab === 'interfacing' ? plan.st.material : FABRIC_LABEL[fab];
      return `<div class="piece-group">
        <div class="piece-group-head">
          <h3>${chip(fab)}${title}</h3>
          <p class="amount">${amt.main} <span>${amt.sub}</span></p>
        </div>
        <div class="piece-row">${items.map(pc => {
          const key = `${state.type}:${pc.id}`, on = !!state.cut[key];
          return `
          <figure class="piece${on ? ' is-cut' : ''}">
            ${D.piece(pc, ppi, f, state.swatch, opts)}
            <figcaption>
              <span class="piece-name">${pc.name}</span>
              <span class="piece-meta"><span class="qty">Cut ${pc.qty}</span> · ${f(pc.w)} × ${f(pc.h)}</span>
              ${pc.note ? `<span class="piece-note">${pc.note}</span>` : ''}
              <label class="check piece-check" for="cut-${pc.id}">
                <input type="checkbox" id="cut-${pc.id}" data-cut="${key}"${on ? ' checked' : ''}>
                <span class="box" aria-hidden="true"></span>
                <span>${pc.qty > 1 ? `All ${pc.qty} cut` : 'Cut'}</span>
              </label>
            </figcaption>
          </figure>`;
        }).join('')}
        </div>
      </div>`;
    }).join('');
    renderCutProgress();
  }

  function renderCutProgress() {
    const total = plan.pieces.length;
    const done = plan.pieces.filter(p => state.cut[`${state.type}:${p.id}`]).length;
    $('#cutProgress').textContent = done === total ? 'Everything is cut. On to sewing!' : `${done} of ${total} pieces cut`;
  }

  function renderMaterials() {
    const cols = [['Fabric', plan.materials.fabric], ['Notions', plan.materials.notions]];
    $('#materials').innerHTML = cols.map(([title, items]) => `
      <div class="mat-col">
        <h3>${title}</h3>
        <ul>${items.map(it => `
          <li><label class="check" for="have-${it.id}">
            <input type="checkbox" id="have-${it.id}" data-have="${it.id}"${state.have[it.id] ? ' checked' : ''}>
            <span class="box" aria-hidden="true"></span>
            <span class="mat-text">
              <span class="mat-name">${it.name}</span>
              ${it.amount ? `<span class="mat-amount">${it.amount}</span>` : ''}
              ${it.detail ? `<span class="mat-detail">${it.detail}${it.id === 'fab-lin' ? `, in ${swatchInfo().lining} to go with the ${swatchInfo().name.toLowerCase()}` : ''}</span>` : ''}
            </span>
          </label></li>`).join('')}
        </ul>
      </div>`).join('');
  }

  function renderSteps() {
    const t = state.type;
    $('#steps').innerHTML = plan.steps.map((st, i) => {
      const key = `${t}:${st.id}`, on = !!state.done[key];
      const fig = st.diagram ? D.diagram(st.diagram, plan, state, f) : '';
      return `<li class="step${on ? ' is-done' : ''}${st.highlight ? ' is-key' : ''}">
        <label class="step-check" for="step-${st.id}">
          <input type="checkbox" id="step-${st.id}" data-step="${key}"${on ? ' checked' : ''}>
          <span class="box" aria-hidden="true"></span>
          <span class="sr">Mark step ${i + 1} done</span>
        </label>
        <div class="step-body">
          <h3><span class="step-num">${String(i + 1).padStart(2, '0')}</span>${st.title}</h3>
          <p>${st.body}</p>
          ${st.tip ? `<p class="step-tip"><b>Tip</b>${st.tip}</p>` : ''}
        </div>
        ${fig ? `<figure class="step-fig">${fig}</figure>` : ''}
      </li>`;
    }).join('');
    renderProgress();
  }

  function renderProgress() {
    const t = state.type;
    const total = plan.steps.length;
    const done = plan.steps.filter(s => state.done[`${t}:${s.id}`]).length;
    $('#progressText').textContent = done === total ? `All ${total} steps done. Lovely work!` : `${done} of ${total} steps done`;
    $('#progressBar').style.width = `${(done / total) * 100}%`;
  }

  /* ---------- Update loop ---------- */
  function planInput() {
    return {
      type: state.type, dims: state.dims, structure: state.structure[state.type],
      sa: state.sa, pocket: state.pocket, gauge: state.gauge, zipKind: state.zipKind,
      zipAuto: state.zipAuto, zipMode: state.zipMode, zipLen: state.zipLen,
    };
  }

  let raf = 0;
  function update() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      plan = P.computePlan(planInput(), { f, units: state.units, zipLabel });
      syncControls();
      D.preview($('#preview'), state, plan, f);
      renderSummary();
      renderPieces();
      renderMaterials();
      renderSteps();
      save();
    });
  }

  function rebuild() {
    renderShapes();
    renderSize();
    renderZipperControls();
    renderFinishControls();
    renderSwatches();
    renderUnitsLabel();
    update();
  }

  // Clicking a zipper length resizes the pouch so that zipper is the best fit.
  function chooseZipper(Z) {
    const T = P.TYPES[state.type];
    const spec = T.dims.find(d => d.key === 'w');
    const dm = state.dims[state.type];
    const ideal = P.widthForZipper(state.type, dm, state.sa, state.gauge, Z);
    dm.w = clamp(ideal, spec.min, spec.max);
    const geo = P.shape(state.type, dm, state.sa, state.gauge);
    if (P.recommendedZipper(geo.span) === Z) {
      state.zipAuto = true;
      zipMsg = `Width set to ${f(dm.w)} to fit this zipper.`;
    } else {
      state.zipAuto = false; state.zipMode = 'std'; state.zipLen = Z;
      zipMsg = ideal > spec.max
        ? `This zipper suits a wider pouch than the ${T.name.toLowerCase()} goes, so the width is at its ${f(spec.max)} maximum.`
        : `This zipper suits a narrower pouch than the ${T.name.toLowerCase()} goes, so the width is at its ${f(spec.min)} minimum.`;
    }
    syncSizeInputs();
    renderShapes();
    update();
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.type) {
      if (ds.type === state.type) return;
      state.type = ds.type;
      zipMsg = '';
      renderShapes();
      renderSize();
      update();
      $(`#shape-${ds.type}`).focus();
    } else if (ds.units) {
      state.units = ds.units;
      zipMsg = '';
      rebuild();
    } else if (ds.zip) {
      if (ds.zip === 'yard') { state.zipAuto = false; state.zipMode = 'yard'; zipMsg = ''; update(); }
      else chooseZipper(Number(ds.zip));
    } else if (ds.gauge) {
      state.gauge = ds.gauge; update();
    } else if (ds.kind) {
      state.zipKind = ds.kind; update();
    } else if (ds.structure) {
      state.structure[state.type] = ds.structure; update();
    } else if (ds.sa) {
      state.sa = Number(ds.sa); update();
    } else if (ds.swatch) {
      state.swatch = ds.swatch; renderShapes(); update();
    } else if (b.id === 'zipReset') {
      state.zipAuto = true; zipMsg = ''; update();
    } else if (b.id === 'resetSteps') {
      Object.keys(state.done).forEach(k => { if (k.startsWith(`${state.type}:`)) delete state.done[k]; });
      renderSteps(); save();
    }
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.dim) return;
    const key = el.dataset.dim;
    const spec = P.TYPES[state.type].dims.find(d => d.key === key);
    const v = clamp(fromDisplay(Number(el.value)), spec.min, spec.max);
    state.dims[state.type][key] = v;
    $(`#out-${key}`).textContent = f(v);
    zipMsg = '';
    update();
  });

  const toggleIn = (bag, key, on) => { if (on) bag[key] = true; else delete bag[key]; };
  document.addEventListener('change', e => {
    const el = e.target;
    const ds = el.dataset || {};
    if (ds.dim) { renderShapes(); return; }   // mini shape icons redraw once a slider is let go
    if (el.id === 'pocketToggle') { state.pocket = el.checked; update(); return; }
    if (ds.step) {
      toggleIn(state.done, ds.step, el.checked);
      el.closest('.step').classList.toggle('is-done', el.checked);
      renderProgress(); save();
    } else if (ds.cut) {
      toggleIn(state.cut, ds.cut, el.checked);
      el.closest('.piece').classList.toggle('is-cut', el.checked);
      renderCutProgress(); save();
    } else if (ds.have) {
      toggleIn(state.have, ds.have, el.checked);
      save();
    }
  });

  // Redraw the to-scale pieces when the page width changes.
  if ('ResizeObserver' in window) {
    let t = 0;
    new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (plan && Math.abs(w - lastPiecesWidth) > 24) {
        clearTimeout(t);
        t = setTimeout(renderPieces, 120);
      }
    }).observe($('#pieces'));
  }

  rebuild();
})();
