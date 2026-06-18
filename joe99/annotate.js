/* Shared map annotation toolbar for Mapbox GL JS.
   Usage: include this file, then call initAnnotate(map) after the map's 'load'.
   Tools: Text, Line, Arrow, Rectangle, Circle, Polygon + color, undo, delete, clear.
   While a tool is active the map is in "draw mode" (an overlay captures clicks, so
   pan/zoom pause and feature popups don't fire); click the active tool again, or
   press Esc/▣ Done, to return to navigation. */
window.initAnnotate = function (map) {
  if (map.__annotInit) return; map.__annotInit = true;

  // ── styles ────────────────────────────────────────────────────────────────
  const css = `
  #annot-bar{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-wrap:wrap;gap:4px;
    background:#fff;padding:6px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.3);
    font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#222;max-width:92vw}
  #annot-bar button{border:1px solid #ddd;background:#fff;border-radius:5px;padding:6px 9px;cursor:pointer;font:600 12px inherit;line-height:1;color:#222}
  #annot-bar button:hover{background:#f2f4f8}
  #annot-bar button.active{background:#2d6cdf;color:#fff;border-color:#2d6cdf}
  #annot-bar .sep{width:1px;background:#e2e2e2;margin:2px 3px}
  #annot-bar input[type=color]{width:30px;height:30px;border:1px solid #ddd;border-radius:5px;padding:0;cursor:pointer;background:#fff}
  #annot-ov{position:absolute;inset:0;z-index:2;display:none;cursor:crosshair}
  #annot-hint{position:absolute;top:56px;left:50%;transform:translateX(-50%);z-index:3;display:none;
    background:rgba(26,26,46,.92);color:#fff;padding:4px 10px;border-radius:5px;
    font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}`;
  const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

  // ── DOM ─────────────────────────────────────────────────────────────────────
  const bar = document.createElement('div'); bar.id = 'annot-bar';
  const hint = document.createElement('div'); hint.id = 'annot-hint';
  const ov = document.createElement('div'); ov.id = 'annot-ov';
  document.body.appendChild(bar); document.body.appendChild(hint);
  map.getContainer().appendChild(ov);

  const TOOLS = [['text', 'Text'], ['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rect'], ['circle', 'Circle'], ['polygon', 'Poly']];
  const HINTS = {
    text: 'Click to place text', line: 'Click points · double-click to finish', arrow: 'Click start, then end',
    rect: 'Click two opposite corners', circle: 'Click center, then edge', polygon: 'Click vertices · double-click to finish',
    delete: 'Click a shape to delete it'
  };
  const btns = {};
  TOOLS.forEach(([k, label]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => setTool(k); bar.appendChild(b); btns[k] = b; });
  const color = document.createElement('input'); color.type = 'color'; color.value = '#e6194B'; color.title = 'Annotation color'; bar.appendChild(color);
  bar.appendChild(Object.assign(document.createElement('span'), { className: 'sep' }));
  const undoB = mkBtn('Undo', undo);
  const delB = document.createElement('button'); delB.textContent = 'Delete'; delB.onclick = () => setTool('delete'); bar.appendChild(delB); btns['delete'] = delB;
  mkBtn('Clear', clearAll);
  mkBtn('▣ Done', () => setTool(null));
  function mkBtn(t, fn) { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; bar.appendChild(b); return b; }

  // ── data + layers ────────────────────────────────────────────────────────────
  const fc = { type: 'FeatureCollection', features: [] };
  const pv = { type: 'FeatureCollection', features: [] };
  map.addSource('annot', { type: 'geojson', data: fc });
  map.addSource('annot-pv', { type: 'geojson', data: pv });
  map.addLayer({ id: 'annot-fill', type: 'fill', source: 'annot', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } });
  map.addLayer({ id: 'annot-poly-ol', type: 'line', source: 'annot', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
  map.addLayer({ id: 'annot-line', type: 'line', source: 'annot', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 } });
  map.addLayer({ id: 'annot-text', type: 'symbol', source: 'annot', filter: ['==', ['get', 'atype'], 'text'],
    layout: { 'text-field': ['get', 'text'], 'text-size': 16, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } });
  map.addLayer({ id: 'annot-pv-fill', type: 'fill', source: 'annot-pv', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'annot-pv-line', type: 'line', source: 'annot-pv', paint: { 'line-color': ['get', 'color'], 'line-width': 1.8, 'line-dasharray': [2, 1] } });
  const HIT = ['annot-fill', 'annot-line', 'annot-poly-ol', 'annot-text'];

  const refresh = () => map.getSource('annot').setData(fc);
  const setPv = (f) => { pv.features = f; map.getSource('annot-pv').setData(pv); };

  // ── geometry helpers ──────────────────────────────────────────────────────────
  const R = 6371000, toR = Math.PI / 180, toD = 180 / Math.PI;
  function haversine(a, b) { const dLa = (b[1] - a[1]) * toR, dLo = (b[0] - a[0]) * toR, la1 = a[1] * toR, la2 = b[1] * toR; const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  function dest(o, d, brng) { const la1 = o[1] * toR, lo1 = o[0] * toR, dr = d / R; const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(brng)); const lo2 = lo1 + Math.atan2(Math.sin(brng) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2)); return [lo2 * toD, la2 * toD]; }
  function rectPoly(a, b) { return { type: 'Polygon', coordinates: [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]] }; }
  function circlePoly(c, edge) { const d = haversine(c, edge), N = 64, ring = []; for (let i = 0; i <= N; i++) ring.push(dest(c, d, 2 * Math.PI * i / N)); return { type: 'Polygon', coordinates: [ring] }; }
  function arrowHead(a, b) { const pa = map.project(a), pb = map.project(b); const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), s = 16, sp = 0.45; const l = map.unproject([pb.x - s * Math.cos(ang - sp), pb.y - s * Math.sin(ang - sp)]); const r = map.unproject([pb.x - s * Math.cos(ang + sp), pb.y - s * Math.sin(ang + sp)]); return { type: 'Polygon', coordinates: [[[b[0], b[1]], [l.lng, l.lat], [r.lng, r.lat], [b[0], b[1]]]] }; }

  // ── annotation actions (grouped by action id so undo/delete remove whole shapes) ──
  let aid = 0;
  function feat(geometry, atype) { return { type: 'Feature', properties: { atype, color: color.value }, geometry }; }
  function commit(features) { aid++; features.forEach((f) => { f.properties.aid = aid; fc.features.push(f); }); refresh(); }
  function undo() { if (!fc.features.length) return; const last = Math.max.apply(null, fc.features.map((f) => f.properties.aid)); fc.features = fc.features.filter((f) => f.properties.aid !== last); refresh(); }
  function clearAll() { if (fc.features.length && confirm('Clear all annotations?')) { fc.features = []; refresh(); } }

  // ── tool state + overlay-based interaction ────────────────────────────────────
  let tool = null, pts = [];
  function setTool(t) {
    tool = (tool === t) ? null : t; pts = []; setPv([]);
    Object.values(btns).forEach((b) => b.classList.remove('active'));
    if (tool && btns[tool]) btns[tool].classList.add('active');
    ov.style.display = tool ? 'block' : 'none';
    hint.style.display = tool ? 'block' : 'none';
    hint.textContent = HINTS[tool] || '';
  }
  const ptOf = (e) => { const r = ov.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const llOf = (e) => { const p = ptOf(e); const u = map.unproject(p); return [u.lng, u.lat]; };

  ov.addEventListener('click', (e) => {
    const c = llOf(e);
    if (tool === 'delete') { const f = map.queryRenderedFeatures(ptOf(e), { layers: HIT })[0]; if (f) { const a = f.properties.aid; fc.features = fc.features.filter((x) => x.properties.aid != a); refresh(); } return; }
    if (tool === 'text') { const t = prompt('Annotation text:'); if (t) { const f = feat({ type: 'Point', coordinates: c }, 'text'); f.properties.text = t; commit([f]); } return; }
    if (tool === 'rect') { pts.push(c); if (pts.length === 2) { commit([feat(rectPoly(pts[0], pts[1]), 'rect')]); pts = []; setPv([]); } return; }
    if (tool === 'circle') { pts.push(c); if (pts.length === 2) { commit([feat(circlePoly(pts[0], pts[1]), 'circle')]); pts = []; setPv([]); } return; }
    if (tool === 'arrow') { pts.push(c); if (pts.length === 2) { commit([feat({ type: 'LineString', coordinates: [pts[0], pts[1]] }, 'arrow'), feat(arrowHead(pts[0], pts[1]), 'arrowhead')]); pts = []; setPv([]); } return; }
    if (tool === 'line' || tool === 'polygon') { pts.push(c); }
  });
  ov.addEventListener('mousemove', (e) => {
    if (!tool || !pts.length) return;
    const c = llOf(e), col = color.value;
    if (tool === 'rect') setPv([{ type: 'Feature', properties: { color: col }, geometry: rectPoly(pts[0], c) }]);
    else if (tool === 'circle') setPv([{ type: 'Feature', properties: { color: col }, geometry: circlePoly(pts[0], c) }]);
    else if (tool === 'arrow') setPv([{ type: 'Feature', properties: { color: col }, geometry: { type: 'LineString', coordinates: [pts[0], c] } }]);
    else if (tool === 'line' || tool === 'polygon') setPv([{ type: 'Feature', properties: { color: col }, geometry: { type: 'LineString', coordinates: pts.concat([c]) } }]);
  });
  ov.addEventListener('dblclick', (e) => { e.preventDefault(); finishMulti(); });

  function finishMulti() {
    let p = pts.filter((c, i) => i === 0 || c[0] !== pts[i - 1][0] || c[1] !== pts[i - 1][1]); // drop dbl-click duplicate
    if (tool === 'line' && p.length >= 2) commit([feat({ type: 'LineString', coordinates: p }, 'line')]);
    else if (tool === 'polygon' && p.length >= 3) { const ring = p.concat([p[0]]); commit([feat({ type: 'Polygon', coordinates: [ring] }, 'polygon')]); }
    pts = []; setPv([]);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (tool) { pts = []; setPv([]); } }
    else if (e.key === 'Enter' && (tool === 'line' || tool === 'polygon')) finishMulti();
  });
};
