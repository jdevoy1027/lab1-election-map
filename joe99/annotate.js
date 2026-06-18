/* Microsoft-Paint-style annotation palette for Mapbox GL JS.
   Usage: include this file, then call initAnnotate(map) after the map's 'load'.
   Draggable tool box: Pencil (freehand), Line, Arrow, Rectangle, Ellipse, Polygon,
   Text, Eraser, Fill-bucket (recolor), Eyedropper (pick color) + brush sizes,
   fill toggle, dashed / square-end line styles, color palette, undo, clear,
   and Save/Load annotations to GeoJSON. Annotations are real map layers, so they
   are automatically included in the map's PDF export.
   While a tool is active the map is in "draw mode" (overlay captures input, so
   pan/zoom pause and popups don't fire). Click Done / press Esc to navigate. */
window.initAnnotate = function (map) {
  if (map.__annotInit) return; map.__annotInit = true;

  const ICON = {
    pencil: '<path d="M10.5 1.5l4 4-9 9-4.5 1 1-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    line: '<line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke="currentColor" stroke-width="1.7"/>',
    arrow: '<line x1="2.5" y1="13.5" x2="12.5" y2="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M13.2 2.8l-4.2 1 3.2 3.2z" fill="currentColor"/>',
    rect: '<rect x="2.5" y="4" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    circle: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    polygon: '<polygon points="8,2 14,7 11.5,14 4.5,14 2,7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    text: '<text x="8" y="13" font-size="14" font-weight="700" text-anchor="middle" fill="currentColor" font-family="Arial,Helvetica,sans-serif">A</text>',
    erase: '<path d="M2.5 10.5l5-5 6 6-2.5 2.5H5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><line x1="5" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.4"/>',
    bucket: '<path d="M7 2l5.5 5.5-4.5 4.5a1.6 1.6 0 0 1-2.3 0L2.5 8.5a1.6 1.6 0 0 1 0-2.3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M13 10c.9 1 1.4 1.9 1.4 2.6a1.4 1.4 0 1 1-2.8 0c0-.7.5-1.6 1.4-2.6z" fill="currentColor"/>',
    pick: '<path d="M10.5 2.2l3.3 3.3-1.4 1.4-3.3-3.3z" fill="currentColor"/><path d="M8.7 5.4l-5.2 5.2L2.4 14l3.4-1.1 5.2-5.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
  };
  const svg = (k) => `<svg viewBox="0 0 16 16" width="17" height="17">${ICON[k]}</svg>`;
  const PALETTE = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'];

  // ── styles ────────────────────────────────────────────────────────────────
  const css = `
  #pbox{position:absolute;left:12px;top:96px;z-index:5;width:118px;background:#ece9d8;border:1px solid #8a8a8a;border-radius:5px;
    box-shadow:0 2px 8px rgba(0,0,0,.35);font:12px Tahoma,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#222;user-select:none}
  #pbox .hd{background:linear-gradient(#2d6cdf,#1d4fae);color:#fff;font-weight:700;padding:5px 8px;border-radius:4px 4px 0 0;cursor:move;font-size:12px}
  #pbox .sec{padding:6px;border-bottom:1px solid #c9c5b4}
  #pbox .lbl{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.03em;margin:0 0 4px}
  #pbox .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
  #pbox .tool{display:flex;align-items:center;justify-content:center;height:30px;background:#fff;border:1px solid #aaa;border-radius:3px;cursor:pointer;color:#222}
  #pbox .tool:hover{background:#eaf1ff}
  #pbox .tool.active{background:#2d6cdf;border-color:#1d4fae;color:#fff}
  #pbox .sizes{display:flex;gap:4px}
  #pbox .sz{flex:1;height:26px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #aaa;border-radius:3px;cursor:pointer}
  #pbox .sz.active{background:#2d6cdf;border-color:#1d4fae}
  #pbox .sz .bar{background:#222;border-radius:2px}
  #pbox .sz.active .bar{background:#fff}
  #pbox .tg{width:100%;height:24px;margin-top:5px;background:#fff;border:1px solid #aaa;border-radius:3px;cursor:pointer;font:600 11px inherit;color:#222}
  #pbox .tg.active{background:#2d6cdf;border-color:#1d4fae;color:#fff}
  #pbox .cur{display:flex;align-items:center;gap:6px;margin-bottom:5px}
  #pbox .cur .sw{width:24px;height:24px;border:1px solid #888;border-radius:3px}
  #pbox .cur input[type=color]{width:26px;height:24px;border:1px solid #aaa;border-radius:3px;padding:0;background:#fff;cursor:pointer}
  #pbox .pal{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
  #pbox .pal span{padding-top:100%;border:1px solid rgba(0,0,0,.25);border-radius:2px;cursor:pointer}
  #pbox .act{display:flex;gap:4px;padding:6px;border-bottom:1px solid #c9c5b4}
  #pbox .act button{flex:1;height:26px;background:#fff;border:1px solid #aaa;border-radius:3px;cursor:pointer;font:600 11px inherit;color:#222}
  #pbox .act button:hover{background:#eaf1ff}
  #pbox .done{width:100%;height:26px;margin-top:0;background:#2d6cdf;color:#fff;border:none;border-radius:3px;cursor:pointer;font:700 11px inherit}
  #annot-ov{position:absolute;inset:0;z-index:2;display:none;cursor:crosshair}
  #annot-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:5;display:none;
    background:rgba(26,26,46,.92);color:#fff;padding:4px 10px;border-radius:5px;font:12px Tahoma,Helvetica,Arial,sans-serif}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // ── palette DOM ───────────────────────────────────────────────────────────
  const box = document.createElement('div'); box.id = 'pbox';
  const TOOLS = [['pencil', 'Pencil (freehand)'], ['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rectangle'],
    ['circle', 'Ellipse'], ['polygon', 'Polygon'], ['text', 'Text'], ['erase', 'Eraser (click a shape)'],
    ['bucket', 'Fill bucket (recolor a shape)'], ['pick', 'Eyedropper (pick a color)']];
  box.innerHTML =
    '<div class="hd">✎ Annotate</div>' +
    '<div class="sec"><div class="lbl">Tools</div><div class="grid" id="p-tools"></div></div>' +
    '<div class="sec"><div class="lbl">Size</div><div class="sizes" id="p-sizes"></div>' +
    '<button class="tg" id="p-fill">Fill: Off</button></div>' +
    '<div class="sec"><div class="lbl">Line style</div><button class="tg" id="p-dash" style="margin-top:0">Dashed: Off</button>' +
    '<button class="tg" id="p-cap">Ends: Round</button></div>' +
    '<div class="sec"><div class="lbl">Color</div><div class="cur"><span class="sw" id="p-cur"></span>' +
    '<input type="color" id="p-custom" title="Custom color"></div><div class="pal" id="p-pal"></div></div>' +
    '<div class="act"><button id="p-undo">Undo</button><button id="p-clear">Clear</button></div>' +
    '<div class="act"><button id="p-save">Save</button><button id="p-load">Load</button></div>' +
    '<div style="padding:6px"><button class="done" id="p-done">▣ Done</button></div>' +
    '<input type="file" id="p-loadinput" accept=".geojson,.json" hidden>';
  document.body.appendChild(box);
  const ov = document.createElement('div'); ov.id = 'annot-ov'; map.getContainer().appendChild(ov);
  const hint = document.createElement('div'); hint.id = 'annot-hint'; document.body.appendChild(hint);

  const cur = { tool: null, color: '#ed1c24', width: 3, fill: false, dash: false, cap: 'round' };
  const HINTS = { pencil: 'Drag to draw freehand', line: 'Click points · double-click to finish', arrow: 'Click start, then end',
    rect: 'Click two opposite corners', circle: 'Click center, then edge', polygon: 'Click vertices · double-click to finish',
    text: 'Click to place text', erase: 'Click a shape to delete it', bucket: 'Click a shape to recolor it', pick: 'Click a shape to pick its color' };

  const toolEls = {}; const tg = box.querySelector('#p-tools');
  TOOLS.forEach(([k, title]) => { const b = document.createElement('div'); b.className = 'tool'; b.title = title; b.innerHTML = svg(k); b.onclick = () => setTool(k); tg.appendChild(b); toolEls[k] = b; });
  const SZ = [2, 4, 8]; const szEls = []; const sg = box.querySelector('#p-sizes');
  SZ.forEach((w) => { const b = document.createElement('div'); b.className = 'sz' + (w === cur.width ? ' active' : ''); b.title = w + 'px';
    b.innerHTML = `<span class="bar" style="width:${4 + w * 1.4}px;height:${w}px"></span>`;
    b.onclick = () => { cur.width = w; szEls.forEach((e) => e.classList.remove('active')); b.classList.add('active'); }; sg.appendChild(b); szEls.push(b); });
  const fillBtn = box.querySelector('#p-fill');
  fillBtn.onclick = () => { cur.fill = !cur.fill; fillBtn.classList.toggle('active', cur.fill); fillBtn.textContent = 'Fill: ' + (cur.fill ? 'On' : 'Off'); };
  const dashBtn = box.querySelector('#p-dash');
  dashBtn.onclick = () => { cur.dash = !cur.dash; dashBtn.classList.toggle('active', cur.dash); dashBtn.textContent = 'Dashed: ' + (cur.dash ? 'On' : 'Off'); };
  const capBtn = box.querySelector('#p-cap');
  capBtn.onclick = () => { cur.cap = cur.cap === 'round' ? 'square' : 'round'; capBtn.classList.toggle('active', cur.cap === 'square'); capBtn.textContent = 'Ends: ' + (cur.cap === 'round' ? 'Round' : 'Square'); };
  const curSw = box.querySelector('#p-cur'); curSw.style.background = cur.color;
  const custom = box.querySelector('#p-custom'); custom.value = cur.color; custom.oninput = () => setColor(custom.value);
  const pal = box.querySelector('#p-pal');
  PALETTE.forEach((c) => { const s = document.createElement('span'); s.style.background = c; s.title = c; s.onclick = () => setColor(c); pal.appendChild(s); });
  function setColor(c) { cur.color = c; curSw.style.background = c; custom.value = c; }
  box.querySelector('#p-undo').onclick = undo;
  box.querySelector('#p-clear').onclick = clearAll;
  box.querySelector('#p-save').onclick = save;
  const loadInput = box.querySelector('#p-loadinput');
  box.querySelector('#p-load').onclick = () => loadInput.click();
  loadInput.onchange = () => { if (loadInput.files[0]) loadFile(loadInput.files[0]); loadInput.value = ''; };
  box.querySelector('#p-done').onclick = () => setTool(null);

  (function drag() {
    const hd = box.querySelector('.hd'); let ox, oy, on = false;
    hd.addEventListener('mousedown', (e) => { on = true; ox = e.clientX - box.offsetLeft; oy = e.clientY - box.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (!on) return; box.style.left = (e.clientX - ox) + 'px'; box.style.top = (e.clientY - oy) + 'px'; });
    document.addEventListener('mouseup', () => { on = false; });
  })();

  // ── data + layers ──────────────────────────────────────────────────────────
  const fc = { type: 'FeatureCollection', features: [] };
  const pv = { type: 'FeatureCollection', features: [] };
  map.addSource('annot', { type: 'geojson', data: fc });
  map.addSource('annot-pv', { type: 'geojson', data: pv });
  const HIT = [];
  map.addLayer({ id: 'annot-fill', type: 'fill', source: 'annot', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'fill'], 0.3, 0] } }); HIT.push('annot-fill');
  // polygon outlines: solid + dashed
  [false, true].forEach((d) => { const id = 'annot-poly-' + (d ? 'd' : 's');
    map.addLayer({ id, type: 'line', source: 'annot', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'dash'], d]], layout: { 'line-join': 'round' },
      paint: Object.assign({ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] }, d ? { 'line-dasharray': [2, 1.6] } : {}) }); HIT.push(id); });
  // line/arrow/pencil: solid|dashed × round|square ends
  [[false, 'round'], [false, 'square'], [true, 'round'], [true, 'square']].forEach(([d, cap]) => { const id = `annot-line-${d ? 'd' : 's'}-${cap}`;
    map.addLayer({ id, type: 'line', source: 'annot', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'dash'], d], ['==', ['get', 'cap'], cap]], layout: { 'line-cap': cap, 'line-join': 'round' },
      paint: Object.assign({ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] }, d ? { 'line-dasharray': [2, 1.6] } : {}) }); HIT.push(id); });
  map.addLayer({ id: 'annot-text', type: 'symbol', source: 'annot', filter: ['==', ['get', 'atype'], 'text'],
    layout: { 'text-field': ['get', 'text'], 'text-size': ['+', 11, ['*', ['get', 'width'], 1.8]], 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } }); HIT.push('annot-text');
  map.addLayer({ id: 'annot-pv-fill', type: 'fill', source: 'annot-pv', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'fill'], 0.18, 0] } });
  map.addLayer({ id: 'annot-pv-line', type: 'line', source: 'annot-pv', paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [2, 1.6] } });
  const refresh = () => map.getSource('annot').setData(fc);
  const setPv = (f) => { pv.features = f; map.getSource('annot-pv').setData(pv); };

  // ── geometry helpers ───────────────────────────────────────────────────────
  const R = 6371000, toR = Math.PI / 180, toD = 180 / Math.PI;
  function haversine(a, b) { const dLa = (b[1] - a[1]) * toR, dLo = (b[0] - a[0]) * toR, la1 = a[1] * toR, la2 = b[1] * toR; const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  function dest(o, d, brng) { const la1 = o[1] * toR, lo1 = o[0] * toR, dr = d / R; const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(brng)); const lo2 = lo1 + Math.atan2(Math.sin(brng) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2)); return [lo2 * toD, la2 * toD]; }
  const rectPoly = (a, b) => ({ type: 'Polygon', coordinates: [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]] });
  function circlePoly(c, e) { const d = haversine(c, e), N = 64, ring = []; for (let i = 0; i <= N; i++) ring.push(dest(c, d, 2 * Math.PI * i / N)); return { type: 'Polygon', coordinates: [ring] }; }
  function arrowHead(a, b) { const pa = map.project(a), pb = map.project(b); const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), s = 9 + cur.width * 2.5, sp = 0.45; const l = map.unproject([pb.x - s * Math.cos(ang - sp), pb.y - s * Math.sin(ang - sp)]); const r = map.unproject([pb.x - s * Math.cos(ang + sp), pb.y - s * Math.sin(ang + sp)]); return { type: 'Polygon', coordinates: [[[b[0], b[1]], [l.lng, l.lat], [r.lng, r.lat], [b[0], b[1]]]] }; }

  // ── actions ────────────────────────────────────────────────────────────────
  let aid = 0;
  function feat(geometry, atype, forceFill) { return { type: 'Feature', properties: { atype, color: cur.color, width: cur.width, fill: !!(forceFill || cur.fill), dash: cur.dash, cap: cur.cap }, geometry }; }
  function commit(features) { aid++; features.forEach((f) => { f.properties.aid = aid; fc.features.push(f); }); refresh(); }
  function undo() { if (!fc.features.length) return; const last = Math.max.apply(null, fc.features.map((f) => f.properties.aid)); fc.features = fc.features.filter((f) => f.properties.aid !== last); refresh(); }
  function clearAll() { if (fc.features.length && confirm('Clear all annotations?')) { fc.features = []; refresh(); } }
  const pvFeat = (geometry) => ({ type: 'Feature', properties: { color: cur.color, width: cur.width, fill: cur.fill }, geometry });

  function save() {
    const out = { type: 'FeatureCollection', features: fc.features };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/geo+json' }));
    a.download = 'annotations.geojson'; a.click(); URL.revokeObjectURL(a.href);
  }
  function loadFile(file) {
    const r = new FileReader();
    r.onload = () => { try {
      const g = JSON.parse(r.result);
      const feats = g.type === 'FeatureCollection' ? g.features : g.type === 'Feature' ? [g] : [];
      if (!feats.length) throw new Error('No features found.');
      feats.forEach((ft) => { aid++; const p = ft.properties || (ft.properties = {});
        p.aid = aid; p.atype = p.atype || (ft.geometry && ft.geometry.type === 'Point' && p.text ? 'text' : 'shape');
        p.color = p.color || '#ed1c24'; p.width = p.width || 3; p.fill = !!p.fill; p.dash = !!p.dash; p.cap = p.cap || 'round';
        fc.features.push(ft); });
      refresh();
    } catch (e) { alert('Load failed: ' + e.message); } };
    r.readAsText(file);
  }

  // ── tool selection ──────────────────────────────────────────────────────────
  function setTool(t) {
    cur.tool = (cur.tool === t) ? null : t; pts = []; free = null; setPv([]);
    Object.values(toolEls).forEach((b) => b.classList.remove('active'));
    if (cur.tool && toolEls[cur.tool]) toolEls[cur.tool].classList.add('active');
    ov.style.display = cur.tool ? 'block' : 'none';
    hint.style.display = cur.tool ? 'block' : 'none';
    hint.textContent = HINTS[cur.tool] || '';
  }

  // ── interaction (overlay) ────────────────────────────────────────────────────
  let pts = [], free = null, lastPx = null;
  const ptOf = (e) => { const r = ov.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const llOf = (e) => { const u = map.unproject(ptOf(e)); return [u.lng, u.lat]; };
  const hitAid = (e) => { const f = map.queryRenderedFeatures(ptOf(e), { layers: HIT })[0]; return f || null; };

  ov.addEventListener('mousedown', (e) => { if (cur.tool === 'pencil') { free = [llOf(e)]; lastPx = ptOf(e); } });
  ov.addEventListener('mousemove', (e) => {
    if (cur.tool === 'pencil' && free) { const p = ptOf(e); if (Math.hypot(p[0] - lastPx[0], p[1] - lastPx[1]) >= 2.5) { free.push(llOf(e)); lastPx = p; setPv([pvFeat({ type: 'LineString', coordinates: free })]); } return; }
    if (!cur.tool || !pts.length) return;
    const c = llOf(e);
    if (cur.tool === 'rect') setPv([pvFeat(rectPoly(pts[0], c))]);
    else if (cur.tool === 'circle') setPv([pvFeat(circlePoly(pts[0], c))]);
    else if (cur.tool === 'arrow') setPv([pvFeat({ type: 'LineString', coordinates: [pts[0], c] })]);
    else if (cur.tool === 'line' || cur.tool === 'polygon') setPv([pvFeat({ type: 'LineString', coordinates: pts.concat([c]) })]);
  });
  ov.addEventListener('mouseup', () => { if (cur.tool === 'pencil' && free) { if (free.length >= 2) commit([feat({ type: 'LineString', coordinates: free }, 'pencil')]); free = null; setPv([]); } });
  ov.addEventListener('click', (e) => {
    if (cur.tool === 'pencil') return;
    const c = llOf(e);
    if (cur.tool === 'erase') { const f = hitAid(e); if (f) { const a = f.properties.aid; fc.features = fc.features.filter((x) => x.properties.aid != a); refresh(); } return; }
    if (cur.tool === 'pick') { const f = hitAid(e); if (f && f.properties.color) setColor(f.properties.color); return; }
    if (cur.tool === 'bucket') { const f = hitAid(e); if (f) { const a = f.properties.aid; fc.features.forEach((x) => { if (x.properties.aid == a) { x.properties.color = cur.color; x.properties.width = cur.width; x.properties.dash = cur.dash; x.properties.cap = cur.cap; x.properties.fill = x.properties.atype === 'arrowhead' ? true : cur.fill; if (x.properties.atype === 'arrowhead') x.properties.dash = false; } }); refresh(); } return; }
    if (cur.tool === 'text') { const t = prompt('Annotation text:'); if (t) { const f = feat({ type: 'Point', coordinates: c }, 'text'); f.properties.text = t; commit([f]); } return; }
    if (cur.tool === 'rect') { pts.push(c); if (pts.length === 2) { commit([feat(rectPoly(pts[0], pts[1]), 'rect')]); pts = []; setPv([]); } return; }
    if (cur.tool === 'circle') { pts.push(c); if (pts.length === 2) { commit([feat(circlePoly(pts[0], pts[1]), 'circle')]); pts = []; setPv([]); } return; }
    if (cur.tool === 'arrow') { pts.push(c); if (pts.length === 2) { const head = feat(arrowHead(pts[0], pts[1]), 'arrowhead', true); head.properties.dash = false; commit([feat({ type: 'LineString', coordinates: [pts[0], pts[1]] }, 'arrow'), head]); pts = []; setPv([]); } return; }
    if (cur.tool === 'line' || cur.tool === 'polygon') pts.push(c);
  });
  ov.addEventListener('dblclick', (e) => { e.preventDefault(); finishMulti(); });
  function finishMulti() {
    const p = pts.filter((c, i) => i === 0 || c[0] !== pts[i - 1][0] || c[1] !== pts[i - 1][1]);
    if (cur.tool === 'line' && p.length >= 2) commit([feat({ type: 'LineString', coordinates: p }, 'line')]);
    else if (cur.tool === 'polygon' && p.length >= 3) commit([feat({ type: 'Polygon', coordinates: [p.concat([p[0]])] }, 'polygon')]);
    pts = []; setPv([]);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { pts = []; free = null; setPv([]); }
    else if (e.key === 'Enter' && (cur.tool === 'line' || cur.tool === 'polygon')) finishMulti();
  });
};
