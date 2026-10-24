// The county map (pan, zoom, roads, settlements, event markers) and the mission briefing screen.
// =====================================================================
// MAP SCENE — scrollable / zoomable wireframe map of Timiș County
// =====================================================================
const KLON = Math.cos(45.8 * Math.PI / 180), BASEPX = 460;      // px per degree of latitude at zoom 1
const cam = { lon: 21.19, lat: 45.83, z: 2.8 };
const VIEW_TOP = 36;
const mscale = () => BASEPX * cam.z;
const mproj = (lon, lat) => [W / 2 + (lon - cam.lon) * mscale() * KLON, (H + VIEW_TOP) / 2 - (lat - cam.lat) * mscale()];
const munproj = (x, y) => [cam.lon + (x - W / 2) / (mscale() * KLON), cam.lat - (y - (H + VIEW_TOP) / 2) / mscale()];
const kmBetween = (a, b) => Math.hypot((a.lon - b.lon) * 111 * KLON, (a.lat - b.lat) * 111);
const kmLL = (a, b) => Math.hypot((a[0] - b[0]) * 111 * KLON, (a[1] - b[1]) * 111);

// nearest point of a polyline to a lon/lat point
function snapLine(pt, line) {
  let best = { d: 1e9 };
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / L)), p = [ax + dx * t, ay + dy * t], d = kmLL(pt, p);
    if (d < best.d) best = { d, i, p };
  }
  return best;
}
// Cărani -> Timișoara along the real road geometry (plus a short connector from the village to the road)
const ROUTE = (() => {
  const T = TOWNS.find(t => t.name === 'Timișoara'), H0 = [HOME.lon, HOME.lat], Tp = [T.lon, T.lat];
  let best = null;
  for (const r of GEO.roads) {
    if (r.t === 'road') continue;
    const a = snapLine(H0, r.p), b = snapLine(Tp, r.p), sc = a.d + b.d;
    if (!best || sc < best.sc) best = { r, a, b, sc };
  }
  if (!best || best.sc > 15) return { pts: [H0, Tp], km: kmLL(H0, Tp), road: '' };
  const { r, a, b } = best;
  const mid = a.i <= b.i ? r.p.slice(a.i + 1, b.i + 1) : r.p.slice(b.i + 1, a.i + 1).reverse();
  const pts = [H0, a.p, ...mid, b.p, Tp];
  let km = 0; for (let i = 0; i < pts.length - 1; i++) km += kmLL(pts[i], pts[i + 1]);
  return { pts, km, road: r.c, connector: a.d };
})();
// nearest neighbouring villages (for the approximate local links)
const NEIGHBOURS = TOWNS.filter(t => t.pop > 500).map(t => ({ t, d: kmBetween(t, HOME) })).sort((a, b) => a.d - b.d).slice(0, 6).map(o => o.t);
const hasLocalRoads = typeof LOCAL_ROADS !== 'undefined';

const mapScene = {
  hover: null, drag: null, labels: [],
  click() { this.drag = { x: mouse.x, y: mouse.y, lon: cam.lon, lat: cam.lat, moved: false }; },
  up() {
    if (this.drag && !this.drag.moved && this.hover && this.hover.name === 'Timișoara') { if (cam.z < 5.5) this.flyTo(this.hover.lon, this.hover.lat, 10); else say('Pick a store, pharmacy, warehouse or dealership'); }
    else if (this.drag && !this.drag.moved && this.hover) { if (save.clock >= DUSK) say('Night has fallen: get back to base'); else go(briefScene(this.hover)); }
    this.drag = null;
  },
  wheel(f, x, y) {
    const [lo, la] = munproj(x, y);
    cam.z = Math.max(1, Math.min(14, cam.z * f));
    const [nx, ny] = mproj(lo, la);                       // keep the point under the cursor fixed
    cam.lon += (nx - x) / (mscale() * KLON); cam.lat -= (ny - y) / mscale();
  },
  flyTo(lon, lat, z) { cam.lon = lon; cam.lat = lat; cam.z = z; },
  update(dt) {
    if (this.drag && mouse.down) {
      const dx = mouse.x - this.drag.x, dy = mouse.y - this.drag.y;
      if (this.drag.moved || Math.hypot(dx, dy) > 5) { this.drag.moved = true; cam.lon = this.drag.lon - dx / (mscale() * KLON); cam.lat = this.drag.lat + dy / mscale(); }
    }
    const sp = 380 * dt / mscale();
    if (kdown('left')) cam.lon -= sp / KLON; if (kdown('right')) cam.lon += sp / KLON;
    if (kdown('up')) cam.lat += sp; if (kdown('down')) cam.lat -= sp;
    if (keys.Equal || keys.NumpadAdd) this.wheel(1 + 1.2 * dt, W / 2, H / 2);
    if (keys.Minus || keys.NumpadSubtract) this.wheel(1 / (1 + 1.2 * dt), W / 2, H / 2);
    cam.lon = Math.max(20.0, Math.min(22.8, cam.lon)); cam.lat = Math.max(45.0, Math.min(46.35, cam.lat));
    // hover: nearest visible settlement
    this.hover = null; let bd = 1e9;
    for (const t of TOWNS) {
      if (!this.visible(t)) continue;
      const [x, y] = mproj(t.lon, t.lat), d = Math.hypot(mouse.x - x, mouse.y - y), r = Math.max(11, this.size(t) + 5);
      if (mouse.y > VIEW_TOP && d < r && d < bd) { bd = d; this.hover = t; }
    }
  },
  size(t) { return t.type === 'spot' ? 8 : t.type === 'city' ? 8 : t.type === 'town' ? 6 : t.type === 'village' ? 4 : 3; },
  visible(t) { if (t.kind === 'camp' && save.reapers.state !== 'war') return false; if (t.type === 'spot') return cam.z >= (t.out ? 2 : 5.2); return t.type === 'city' || t.type === 'town' || (t.type === 'village' && cam.z >= 1.3) || cam.z >= 2.2; },
  drawSpot(t, x, y, hv) {
    const k = SPOT_KINDS[t.kind], r = 8;
    ctx.fillStyle = 'rgba(5,13,9,.92)'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = hv ? '#fff' : k.color; ctx.lineWidth = 2; ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    if (t.kind === 'pharmacy') { ctx.fillStyle = hv ? '#fff' : k.color; ctx.fillRect(x - 1.5, y - 5, 3, 10); ctx.fillRect(x - 5, y - 1.5, 10, 3); }
    else text(k.glyph, x, y + 4, 11, hv ? '#fff' : k.color, 'center');
    if (cam.z >= (t.out ? 3 : 7.5) || hv) this.placeLabel(t.short || t.name, x + r + 4, y + 4, 11, hv ? '#fff' : k.color);
  },
  placeLabel(s, x, y, size, color, align = 'left') {   // greedy collision-avoiding labels
    ctx.font = `${size}px monospace`;
    const w = ctx.measureText(s).width, x0 = align === 'left' ? x : x - w / 2, r = { x: x0 - 2, y: y - size, w: w + 4, h: size + 4 };
    if (r.x > W || r.x + r.w < 0 || r.y > H || r.y + r.h < VIEW_TOP) return false;
    for (const o of this.labels) if (r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) return false;
    this.labels.push(r); text(s, x, y, size, color, align); return true;
  },
  // Dashed polylines made of short solid segments, skipping what is off screen. A dashed ctx.stroke() of a long path
  // (the county border, the neighbouring regions) cost ~0.4 s per frame to rasterise when zoomed out; this is ~1 ms.
  tracePathDashed(pts, dash, gap, off = 0, close = false) {
    ctx.beginPath(); const cyc = dash + gap, n = pts.length + (close ? 1 : 0); let ph = ((off % cyc) + cyc) % cyc, px = 0, py = 0;
    for (let i = 0; i < n; i++) {
      const [lo, la] = pts[i % pts.length], [x, y] = mproj(lo, la);
      if (i) {
        const dx = x - px, dy = y - py, len = Math.hypot(dx, dy);
        if (len > 0) {
          if (Math.max(px, x) < -20 || Math.min(px, x) > W + 20 || Math.max(py, y) < VIEW_TOP - 20 || Math.min(py, y) > H + 20) ph = (ph + len) % cyc;
          else for (let s = 0; s < len;) {
            const inDash = ph < dash, step = Math.min((inDash ? dash : cyc) - ph, len - s);
            if (inDash) { ctx.moveTo(px + dx * s / len, py + dy * s / len); ctx.lineTo(px + dx * (s + step) / len, py + dy * (s + step) / len); }
            s += step; ph += step; if (ph >= cyc - 1e-9) ph = 0;
          }
        }
      }
      px = x; py = y;
    }
  },
  tracePath(pts) { ctx.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = mproj(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); },
  draw(dt, time) {
    this.labels = [];
    ctx.save(); ctx.beginPath(); ctx.rect(0, VIEW_TOP, W, H - VIEW_TOP); ctx.clip();
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, VIEW_TOP, W, H - VIEW_TOP);
    // graticule that gets finer as you zoom in
    const steps = [1, .5, .2, .1, .05, .02, .01], px = s => s * mscale(), stp = steps.find((s, i) => px(s) < 140 && (px(s) >= 55 || i === steps.length - 1)) || .01;
    const [lo0, la1] = munproj(0, VIEW_TOP), [lo1, la0] = munproj(W, H);
    ctx.lineWidth = 1; ctx.strokeStyle = '#0b2415'; ctx.beginPath();
    for (let lo = Math.ceil(lo0 / stp) * stp; lo <= lo1; lo += stp) { const [x] = mproj(lo, 0); ctx.moveTo(Math.round(x) + .5, VIEW_TOP); ctx.lineTo(Math.round(x) + .5, H); }
    for (let la = Math.ceil(la0 / stp) * stp; la <= la1; la += stp) { const [, y] = mproj(0, la); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); }
    ctx.stroke();
    // neighbouring regions (context)
    ctx.strokeStyle = '#17402a'; ctx.lineWidth = 1; ctx.beginPath();
    for (const n of GEO.neigh) this.tracePathDashed(n.p, 6, 5, 0), ctx.stroke();
    // county
    this.tracePath(GEO.county); ctx.closePath();
    ctx.fillStyle = 'rgba(40,120,70,0.07)'; ctx.fill();
    // rivers
    ctx.strokeStyle = 'rgba(60,140,210,.55)'; ctx.lineWidth = 1.5;
    for (const r of GEO.rivers) { this.tracePath(r.p); ctx.stroke(); }
    // roads: dim outside the county, bright inside
    const roadStyle = { major: ['#8dffae', 3.2], sec: ['#3fe070', 2.2], road: ['#2b9a52', 1.2] };
    const drawRoads = (dim) => {
      for (const r of GEO.roads) {
        if (r.t === 'road' && cam.z < 1.5) continue;
        const [c, w] = roadStyle[r.t]; ctx.strokeStyle = c; ctx.globalAlpha = dim ? .3 : 1; ctx.lineWidth = w * (cam.z > 5 ? 1.4 : 1);
        this.tracePath(r.p); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    drawRoads(true);
    ctx.save(); this.tracePath(GEO.county); ctx.closePath(); ctx.clip();
    // glow: a wider, faint pass under the bright one. (ctx.shadowBlur here cost ~0.5 s per frame when zoomed out.)
    ctx.globalAlpha = .16; for (const r of GEO.roads) { if (r.t === 'road' && cam.z < 1.5) continue; ctx.strokeStyle = '#3f6'; ctx.lineWidth = roadStyle[r.t][1] * (cam.z > 5 ? 1.4 : 1) + 5; this.tracePath(r.p); ctx.stroke(); } ctx.globalAlpha = 1;
    drawRoads(false);
    if (hasLocalRoads) {   // real local roads, if an OSM export was added (see tools/README.md)
      ctx.strokeStyle = '#2fbf62'; ctx.lineWidth = 1.2;
      for (const r of LOCAL_ROADS) { if (cam.z < (r.t === 'sec' ? 1.6 : 3)) continue; this.tracePath(r.p); ctx.stroke(); }
    }
    ctx.restore();
    // county outline on top
    this.tracePathDashed(GEO.county, 14, 6, 0, true);
    ctx.strokeStyle = '#d6ffe4'; ctx.lineWidth = 2; ctx.stroke();

    // route Cărani -> Timișoara along the real road (amber), approximate local links (dashed)
    if (cam.z >= 1.2) {
      ctx.strokeStyle = AMBER; ctx.lineWidth = 3; ctx.globalAlpha = .85;
      this.tracePathDashed(ROUTE.pts, 10, 6, -time * 12); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (!hasLocalRoads && cam.z >= 3) {
      ctx.strokeStyle = 'rgba(80,200,120,.7)'; ctx.lineWidth = 1.2;
      for (const n of NEIGHBOURS) { this.tracePathDashed([[HOME.lon, HOME.lat], [n.lon, n.lat]], 4, 5); ctx.stroke(); }
    }

    // settlements, biggest first so they win label space
    const inf = t => Math.min(1, (t.danger + save.day * 0.3) / 6);
    const list = TOWNS.filter(t => this.visible(t)).sort((a, b) => (b.pop || 0) - (a.pop || 0));
    for (const t of list) {
      const [x, y] = mproj(t.lon, t.lat); if (x < -20 || x > W + 20 || y < VIEW_TOP - 20 || y > H + 20) continue;
      if (t.type === 'spot') { this.drawSpot(t, x, y, t === this.hover); drawFx(t, x, y, time); continue; }
      const r = this.size(t) * (cam.z > 6 ? 1.3 : 1), i = inf(t), hv = t === this.hover;
      ctx.strokeStyle = hv ? '#fff' : `rgb(${80 + i * 175},${220 - i * 160},80)`; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(5,13,9,.85)'; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      const big = t.type === 'city' || t.type === 'town';
      const show = big || (t.type === 'village' && cam.z >= 2.2) || (t.pop > 600 && cam.z >= 3.5) || cam.z >= 5.5 || hv;
      if (show) this.placeLabel(t.name, x + r + 5, y + 4, big ? 12 : 11, hv ? '#fff' : big ? GREEN : '#7fe0a0');
      drawFx(t, x, y, time);
    }
    // road numbers
    if (cam.z >= 1.4) for (const r of GEO.roads) {
      if (!r.c || r.t === 'road') continue;
      let best = null, bd = 1e9;
      for (const [lo, la] of r.p) { const [x, y] = mproj(lo, la); if (x < 40 || x > W - 40 || y < VIEW_TOP + 20 || y > H - 20) continue; const d = Math.hypot(x - W / 2, y - H / 2); if (d < bd) { bd = d; best = [x, y]; } }
      if (best) { const w = r.c.length * 7 + 8; if (this.placeLabel(r.c, best[0], best[1] + 4, 11, '#0a140e', 'center') === false) continue;
        ctx.fillStyle = r.t === 'major' ? '#8dffae' : '#3fe070'; ctx.fillRect(best[0] - w / 2, best[1] - 8, w, 14); text(r.c, best[0], best[1] + 3, 11, '#02150a', 'center'); }
    }
    // Timișoara hint at low zoom
    if (cam.z < 5.2 && cam.z >= 1.4) { const T = TOWNS.find(t => t.name === 'Timișoara'), [tx, ty] = mproj(T.lon, T.lat); text(`(zoom in: ${SPOTS_TM.filter(s => s[0] !== 'fuel').length} sites)`, tx + 14, ty + 18, 10, '#5fa478'); }
    // home
    { const [hx, hy] = mproj(HOME.lon, HOME.lat), pulse = 9 + Math.sin(time * 4) * 2;
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,204,68,.2)';
      ctx.beginPath(); ctx.moveTo(hx - pulse, hy + 7); ctx.lineTo(hx, hy - pulse); ctx.lineTo(hx + pulse, hy + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      text(`${HOME.name.toUpperCase()} (HOME)`, hx + 14, hy + 4, 13, AMBER); }
    ctx.restore();

    // ---- overlays (not clipped) ----
    drawHUD();
    // scale bar
    { const kmpx = mscale() / 111, nice = [.5, 1, 2, 5, 10, 20, 50].find(k => k * kmpx >= 70) || 50, len = nice * kmpx;
      ctx.strokeStyle = GREEN; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, H - 32); ctx.lineTo(14, H - 26); ctx.lineTo(14 + len, H - 26); ctx.lineTo(14 + len, H - 32); ctx.stroke();
      text(`${nice} km`, 14 + len / 2, H - 36, 11, GREEN, 'center'); }
    const [clo, cla] = munproj(mouse.x, mouse.y);
    text(`${cla.toFixed(4)}°N  ${clo.toFixed(4)}°E   zoom ${cam.z.toFixed(1)}×`, 14, H - 10, 11, '#5fa478');
    text('TIMIȘ COUNTY', 14, VIEW_TOP + 22, 16, AMBER);
    if (save.clock >= DUSK) text('NIGHT HAS FALLEN — get back to base', W / 2, VIEW_TOP + 24, 15, RED, 'center');
    drawFxList(14, H - 96 - 14 * Math.max(0, save.fx.length - 1)); drawTip('map');
    text('drag / WASD: pan · wheel / + −: zoom · click a settlement', 14, VIEW_TOP + 40, 11, '#5fa478');
    text(`${HOME.name} → Timișoara ≈ ${Math.round(ROUTE.km)} km${ROUTE.road ? ' via ' + ROUTE.road : ''}`, 14, VIEW_TOP + 58, 12, AMBER);
    // legend
    { const lx = W - 240, ly = VIEW_TOP + 10; ctx.fillStyle = 'rgba(7,21,13,.82)'; ctx.fillRect(lx, ly, 228, 92); ctx.strokeStyle = DIM; ctx.strokeRect(lx + .5, ly + .5, 228, 92);
      const row = (i, c, w, label, dash) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(lx + 10, ly + 16 + i * 17); ctx.lineTo(lx + 44, ly + 16 + i * 17); ctx.stroke(); ctx.setLineDash([]); text(label, lx + 54, ly + 20 + i * 17, 11, '#9fb'); };
      row(0, '#8dffae', 3, 'motorway / E-road'); row(1, '#3fe070', 2, 'national road (DN)'); row(2, AMBER, 3, 'route to Timișoara', [8, 5]);
      row(3, 'rgba(80,200,120,.8)', 1.4, hasLocalRoads ? 'local roads (OSM)' : 'local link (approximate)', hasLocalRoads ? [] : [4, 5]);
      text('Roads: Natural Earth (major only)', lx + 10, ly + 86, 10, DIM); }
    // tooltip
    if (this.hover && mouse.y > VIEW_TOP) {
      const t = this.hover, k = t.type === 'spot' ? SPOT_KINDS[t.kind] : null;
      const lines = [t.name, k ? `${k.label} — ${k.blurb}` : (t.pop ? `${t.pop.toLocaleString()} people` : ''), t.name === 'Timișoara' ? 'click to zoom in on the city' : ''].filter(Boolean);
      ctx.font = '12px monospace'; const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16, h = lines.length * 16 + 8;
      const tx = Math.min(mouse.x + 16, W - w - 6), ty = Math.min(mouse.y + 16, H - h - 6);
      ctx.fillStyle = 'rgba(7,21,13,.94)'; ctx.fillRect(tx, ty, w, h); ctx.strokeStyle = GREEN; ctx.strokeRect(tx + .5, ty + .5, w, h);
      lines.forEach((s, i) => text(s, tx + 8, ty + 18 + i * 16, 12, i ? '#9fb' : '#fff'));
    }
    // buttons
    button('+', W - 190, H - 148, 40, 34, () => this.wheel(1.5, W / 2, H / 2));
    button('−', W - 146, H - 148, 40, 34, () => this.wheel(1 / 1.5, W / 2, H / 2));
    button('⌂ CĂRANI', W - 102, H - 148, 82, 34, () => this.flyTo(HOME.lon, HOME.lat, 6));
    button('WHOLE COUNTY', W - 190, H - 106, 170, 34, () => this.flyTo(21.4, 45.67, 1.05));
    button(save.clock >= DUSK ? 'NIGHT FALLS ▸ Base' : 'GO HOME  ▸ Base', W - 190, H - 60, 170, 38, () => go(baseScene));
  },
};

// ---------- mission briefing ----------
function briefScene(town) {
  return {
    draw() {
      mapScene.draw(0, 0); btns = [];
      const gs = gearStats();
      ctx.fillStyle = 'rgba(3,8,6,.85)'; ctx.fillRect(0, 0, W, H);
      const x = W / 2 - 260, y = 80, bw = 520, K = town.type === 'spot' ? SPOT_KINDS[town.kind] : null;
      ctx.fillStyle = '#07150d'; ctx.fillRect(x, y, bw, 520);
      ctx.strokeStyle = K ? K.color : GREEN; ctx.strokeRect(x + .5, y + .5, bw, 520);
      text(K ? town.short.toUpperCase() : `SCAVENGE: ${town.name.toUpperCase()}`, W / 2, y + 36, 19, K ? K.color : GREEN, 'center');
      if (K) text(town.name.split(' · ')[1] ? `${town.name.split(' · ')[1]}${town.out ? '' : ', Timișoara'} — ${K.blurb}` : K.blurb, W / 2, y + 56, 11, '#9fb', 'center');
      const ti = applySite(town), si = siteInfo(town), d = siteDanger(ti), l = ti.loot;
      text(`Threat level: ${'▮'.repeat(Math.min(d, 9))}${'▯'.repeat(Math.max(0, 7 - d))}`, W / 2, y + 80, 14, d > 4 ? RED : AMBER, 'center');
      text('Likely loot: ' + Object.entries(l).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k).join(' · '), W / 2, y + 102, 11, GREEN, 'center');
      { const bits = []; if (si.fx) bits.push(FX_KINDS[si.fx.kind].brief); if (si.depl > .08) bits.push(`picked over ${Math.round(si.depl * 100)}%`); if (si.inf > .12) bits.push(`re-infested ${Math.round(si.inf * 100)}%`);
        if (bits.length) text(bits.join(' · '), W / 2, y + (town.keys ? 132 : 122), 11, si.fx ? FX_KINDS[si.fx.kind].col : '#c8a', 'center'); }
      { const ob = objFor(town); if (ob) text(`◆ ${OBJ[ob].brief}`, W / 2, y + (town.keys ? 146 : 136), 11, '#ffd070', 'center'); }
      if (town.keys) text(`Vehicle keys on site: ${town.keys}  (${Object.keys(town.fleet).map(t => VEHICLE_TYPES[t].label.toLowerCase()).join(' / ')})`, W / 2, y + 120, 12, '#7ab8ff', 'center');
      const km = Math.round(kmBetween(town, HOME) * 1.25), v = veh(), VT = v ? VEHICLE_TYPES[v.type] : null;
      const isEv = !!(VT && VT.ev), need = isEv ? Math.ceil(2 * km * VT.kwhkm) : 0;
      const fuel = v && !isEv ? Math.max(1, Math.round(km / 7 * VT.fuel * (has('mechanic') ? .75 : 1))) : 0, tm = scoutBonus();
      const gangs = Math.min(4, Math.round(d * .55 + .4 + (town.gangs || 0)));
      text(`${km} km from home · clock ${fmtClock(save.clock)} · dusk at ${DUSK}:00`, W / 2, y + 158, 13, '#9fb', 'center');
      // vehicle selector
      if (v) {
        text(`VEHICLE: ${v.name}${v.name === VT.label ? '' : ' (' + VT.label.toLowerCase() + ')'} · ${Math.round(VT.speed * condMul(v))} km/h · carries ${VT.cap + gs.cap} · cond ${Math.round(v.hp == null ? 100 : v.hp)}% · ${isEv ? `${v.charge.toFixed(0)}/${VT.batt} kWh, V2L ${v.v2l ? 'on' : 'off'}` : `fuel x${VT.fuel}`}`, W / 2, y + 184, 12, isEv ? '#7affc8' : '#cfe', 'center');
        if (save.vehicles.length > 1) { button('◀', x + 16, y + 170, 30, 22, () => { save.vi = (save.vi + save.vehicles.length - 1) % save.vehicles.length; }); button('▶', x + bw - 46, y + 170, 30, 22, () => { save.vi = (save.vi + 1) % save.vehicles.length; }); }
      } else text('No vehicle — you are on foot. Find a dealership.', W / 2, y + 184, 12, RED, 'center');
      const mode = (label, m, y0, extra, ok) => {
        const trip = tripHours(town, m), back = save.clock + trip, arrive = arriveClock(town, m);
        const late = back >= DUSK, tooLong = back >= 26;
        text(`${label}: ${extra} · away ${trip.toFixed(1)} h · back ${fmtClock(back)}${tooLong ? ' — too far' : late ? ' — after dark' : ''}`, W / 2, y0, 12, !ok || tooLong ? RED : late ? AMBER : GREEN, 'center');
        if (ok && arrive >= 19.5) text('   you would arrive in the dark', W / 2, y0 + 14, 11, RED, 'center');
        return { trip, tooLong };
      };
      const dr = mode('DRIVE', 'drive', y + 216, v ? (isEv ? `${need} kWh${v.charge < need ? ' (battery too low: charge it)' : ''}` : `${fuel} L diesel`) + `, ${75 + tm}s on site` : 'no vehicle', !!v && (!isEv || v.charge >= need));
      const wk = mode('WALK ', 'walk', y + 254, `free, ${45 + tm}s on site, carries ${WALK.cap + gs.cap}`, true);
      text('DAY:   zombies + survivor gangs (about ' + gangs + ' here)', W / 2, y + 308, 12, '#e8c070', 'center');
      text('NIGHT: more and faster zombies, far fewer survivors, dark', W / 2, y + 326, 12, '#8aa4e0', 'center');
      const zl = town.zmix ? Object.entries(town.zmix).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => ZTYPES[k].label).join(', ') : 'walkers, brutes, runners and spitters';
      text(`Infected here: ${zl}`, W / 2, y + 348, 12, '#c8e8b0', 'center');
      text('WASD move · click fire · Space melee · Shift sneak · hold E at a car: hotwire · X: leave', W / 2, y + 370, 11, '#5fa478', 'center');
      if (watched(town)) { const n0 = Math.round((3 + d * 1.5) * (ti.infMul || 1)); text(`OUTPOST INTEL: about ${n0} infected inside · ${gangs} gang members · ${Math.round((1 - si.depl) * 100)}% stocked`, W / 2, y + 402, 11, '#6cf', 'center'); }
      text('Gunfire is heard far away and brings a horde. Melee is quiet. Dying loses what you carry.', W / 2, y + 386, 11, '#5fa478', 'center');
      button(isEv ? `DRIVE (-${need} kWh)` : `DRIVE (-${fuel} L)`, W / 2 - 215, y + 412, 135, 40, () => { if (isEv) v.charge -= need; else save.res.diesel -= fuel; persist(); startDrive(town); }, !!v && (v.hp == null || v.hp > 0) && (isEv ? v.charge >= need : save.res.diesel >= fuel) && !dr.tooLong);
      button('WALK', W / 2 - 67, y + 412, 135, 40, () => go(missionScene(town, 'walk')), !wk.tooLong);
      button('CANCEL', W / 2 + 80, y + 412, 135, 40, () => go(mapScene));
      { const op = outpostOf(town);
        if (op) text(`⚑ Your outpost (level ${op.lvl}): it keeps this site quiet and restocks it faster`, W / 2, y + 474, 12, '#6f8', 'center');
        else if (save.outposts.length >= MAX_OUTPOSTS) text(`You already hold ${MAX_OUTPOSTS} outposts`, W / 2, y + 474, 12, '#8aa', 'center');
        else if (!save.sites[town.name]) text('Loot this site once to be able to claim it as an outpost', W / 2, y + 474, 11, '#5fa478', 'center');
        else button(`ESTABLISH OUTPOST (${costTxt(OUT_COST)})`, W / 2 - 170, y + 462, 340, 30, () => { establish(town); }, costOk(OUT_COST)); }
    },
  };
}

