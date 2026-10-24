// Base-plot geometry (isometric projection, camera) and how every kind of building is drawn.
// =====================================================================
// BASE SCENE — isometric, Clash-of-Clans style, Cărani
// =====================================================================
// World space: isometric tiles of 32x16 px (one cell = 1.5 m). The camera maps world px to the screen.
const TW = 32, TH = 16;
const iso = (gx, gy) => [(gx - gy) * TW / 2, (gx + gy) * TH / 2];
const unIso = (wx, wy) => { const a = wx / (TW / 2), b = wy / (TH / 2); return [(a + b) / 2, (b - a) / 2]; };
const CAM = { x: -80, y: 150, z: 1 };   // world point shown at the screen centre, and zoom
const toWorld = (sx, sy) => [(sx - W / 2) / CAM.z + CAM.x, (sy - H / 2) / CAM.z + CAM.y];
const toScreen = (wx, wy) => [(wx - CAM.x) * CAM.z + W / 2, (wy - CAM.y) * CAM.z + H / 2];
const KINDS = {
  house:  { color: '#9aa0a2', roof: '#7a2e24', hgt: 32, rh: 16, gable: true, scaffold: true, pv: true, wallTex: 'plaster', roofTex: 'tile', label: 'HOUSE' },
  workshop:   { color: '#a8553c', roof: '#8a3a2a', hgt: 22, rh: 12, gable: true, pv: true, wallTex: 'brick', roofTex: 'tile', label: 'WORKSHOP', hp: 80 },
  greenhouse: { color: '#4a90b8', roof: '#6ab8d8', hgt: 8, rh: 7, gable: true, glass: true, label: 'GREENHOUSE', hp: 50 },
  gazebo:     { color: '#8a5a3a', roof: '#b0452f', hgt: 14, rh: 12, pyramid: true, open: true, roofTex: 'tile2', label: 'GAZEBO', hp: 30 },
  barn:       { color: '#b0a290', roof: '#c4622e', hgt: 14, rh: 9, gable: true, wallTex: 'plaster', roofTex: 'tile2', label: 'NEIGHBOUR (barricade)', hp: 300 },
  gate:       { color: '#3a3f46', roof: '#3a3f46', hgt: 16, label: 'GATE', hp: 70 },
  generator:  { color: '#c8861a', roof: '#e0a840', hgt: 10, label: 'GENERATOR', hp: 40, cost: { scrap: 30 }, unique: true },
  powerbox:   { color: '#cfd4d8', roof: '#e8ecef', hgt: 16, label: 'BATTERY 30kWh', hp: 40, cost: { scrap: 50 }, unique: true },
  wire:   { color: '#999', roof: '#bbb', hgt: 4, label: 'WIRE', cost: { scrap: 3 }, hp: 12 },
  pit:    { color: '#3a2a1a', roof: '#2a1a0e', hgt: 1, label: 'PIT', cost: { scrap: 4, wood: 2 }, hp: 5 },
  mine:   { color: '#555', roof: '#777', hgt: 3, label: 'MINE', cost: { scrap: 8, ammo: 2 }, hp: 5 },
  well:       { color: '#8a8d90', roof: '#8a5a3a', hgt: 16, label: 'WELL', hp: 40, cost: { scrap: 40, wood: 6 } },
  tank:       { color: '#4a6a8a', roof: '#7aa0c4', hgt: 14, label: 'TANK', hp: 30, cost: { scrap: 12, wood: 2 } },
  floodlight: { color: '#8a8f96', roof: '#ddd', hgt: 28, label: 'FLOODLIGHT', hp: 25, cost: { scrap: 18, wood: 1 } },
  fence:  { color: '#6b4a2a', roof: '#6b4a2a', hgt: 13, label: 'FENCE', cost: { scrap: 1 }, hp: 20 },
  garden: { color: '#1a5a22', roof: '#2a8a32', hgt: 3,  label: 'GARDEN', cost: { scrap: 6 }, hp: 20 },
  wall:   { color: '#667',    roof: '#99a',    hgt: 14, label: 'WALL',   cost: { scrap: 3 },  hp: 40 },
  turret: { color: '#6a3a3a', roof: '#c55',    hgt: 24, label: 'TURRET', cost: { scrap: 25, wood: 2 }, hp: 35 },
};

function poly(pts, fill, stroke) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

let LIT = false;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const shade = (a) => `rgba(0,0,0,${a})`;

function drawBox(b, kind, hpFrac) {
  const k = KINDS[kind], h = k.hgt, rh = k.rh || 0, edge = 'rgba(0,0,0,.38)';
  const P = (gx, gy, z = 0) => { const [x, y] = iso(gx, gy); return [x, y - z]; };
  const WF = TEX[k.wallTex] || k.color, RF = TEX[k.roofTex] || k.roof;
  const x0 = b.gx, y0 = b.gy, x1 = b.gx + b.w, y1 = b.gy + b.h, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const E = (t, z) => P(x1, y0 + t * (y1 - y0), z);      // east face (long side)
  const S = (t, z) => P(x0 + t * (x1 - x0), y1, z);       // south face (street side)
  const quad = (F, t0, t1, z0, z1, fill, line) => poly([F(t0, z0), F(t1, z0), F(t1, z1), F(t0, z1)], fill, line);
  const seg = (p, q, color, w = 1) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };

  const bar = (hh) => { if (hpFrac < 1) { const [cx, cy] = P(xm, ym, hh); ctx.fillStyle = '#300'; ctx.fillRect(cx - 12, cy, 24, 3); ctx.fillStyle = hpFrac < .4 ? RED : GREEN; ctx.fillRect(cx - 12, cy, 24 * hpFrac, 3); } };
  if (kind === 'fence') {
    const lvl = b.lvl || 0, along = b.dir === 'y';
    const A = along ? [x0 + .5, y0] : [x0, y0 + .5], B = along ? [x0 + .5, y1] : [x1, y0 + .5];
    const at = (t, z = 0) => P(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, z);
    if (lvl === 0) {
      for (let i = 0; i < 12; i++) poly([at(i / 12, 1), at((i + 1) / 12 - .012, 1), at((i + 1) / 12 - .012, h - (i % 3) * 1.5), at(i / 12, h - (i % 3) * 1.5)], TEX.wood, 'rgba(0,0,0,.45)');
      for (const z of [4, 9]) seg(at(0, z), at(1, z), 'rgba(40,25,10,.6)', 1.5);
      for (let i = 0; i <= 1; i++) { const p = at(i); seg(p, [p[0], p[1] - h - 2], '#5a3e20', 3.5); }
    } else if (lvl === 1) {      // steel posts + chain-link mesh
      poly([at(0, 1), at(1, 1), at(1, h), at(0, h)], 'rgba(170,190,200,.16)');
      for (let i = 0; i < 8; i++) { seg(at(i / 8, 1), at((i + 1) / 8, h), 'rgba(190,205,215,.5)'); seg(at((i + 1) / 8, 1), at(i / 8, h), 'rgba(190,205,215,.5)'); }
      seg(at(0, h), at(1, h), '#b8c2ca', 2);
      for (let i = 0; i <= 2; i++) { const p = at(i / 2); seg(p, [p[0], p[1] - h - 2], '#9aa4ac', 3); }
    } else {                      // concrete panel wall with barbed wire (lvl 2) / electric wire (lvl 3)
      const hh = h + 3;
      poly([at(0, 0), at(1, 0), at(1, hh), at(0, hh)], TEX.concrete, 'rgba(0,0,0,.5)');
      poly([at(0, 0), at(1, 0), at(1, hh), at(0, hh)], 'rgba(0,0,0,.18)');
      seg(at(.5, 0), at(.5, hh), 'rgba(0,0,0,.35)'); seg(at(0, hh * .5), at(1, hh * .5), 'rgba(0,0,0,.2)');
      for (const t of [0, 1]) { const p = at(t); seg(p, [p[0], p[1] - hh - 8], '#6a6e74', 4); }
      if (lvl === 2) {
        for (let i = 0; i < 12; i++) { const p = at(i / 12, hh + 3 + (i % 2) * 4), q = at((i + 1) / 12, hh + 3 + ((i + 1) % 2) * 4); seg(p, q, '#b8b8b8'); }
      } else {
        const lit = powerAvail() > 0;
        ctx.save(); if (lit) { ctx.shadowColor = '#6cf'; ctx.shadowBlur = 8; }
        for (const z of [hh + 3, hh + 8]) seg(at(0, z), at(1, z), lit ? '#8df' : '#567', 1.5);
        ctx.restore();
        for (let i = 0; i <= 3; i++) { const p = at(i / 3, hh + 3); seg(p, [p[0], p[1] - 5], '#eee', 2); }
        if ((b.zapFx || 0) > 0) for (let i = 0; i < 5; i++) { const p = at(Math.random(), hh + 3 + Math.random() * 5); seg(p, [p[0] + (Math.random() - .5) * 14, p[1] - Math.random() * 10], '#ff8', 2); }
      }
    }
    bar(h + 6);
    return;
  }
  if (kind === 'wall') {   // thin segments that join up with neighbouring walls, fences and gates
    const lvl = b.lvl || 0, hh = [11, 16, 20][lvl], t = .17, cx = b.gx + .5, cy = b.gy + .5;
    const nb = (dx, dy) => { const o = cellAt(b.gx + dx, b.gy + dy); return !!o && (o.t === 'wall' || o.t === 'fence' || o.t === 'gate'); };
    const fill = lvl === 0 ? '#b9a272' : lvl === 1 ? TEX.concrete : '#4c545e', topc = lvl === 0 ? '#d6c08c' : lvl === 1 ? '#b6bac0' : '#707a85';
    const seg3 = (xa, ya, xb, yb) => { prismG(xa, ya, xb, yb, 0, hh, fill, topc); if (lvl === 0) for (const z of [3.5, 7]) { const [p1x, p1y] = P(xa, yb, z), [p2x, p2y] = P(xb, yb, z); seg([p1x, p1y], [p2x, p2y], 'rgba(60,45,20,.45)'); } };
    if (nb(0, -1)) seg3(cx - t, b.gy, cx + t, cy);
    if (nb(-1, 0)) seg3(b.gx, cy - t, cx, cy + t);
    seg3(cx - t, cy - t, cx + t, cy + t);
    if (nb(0, 1)) seg3(cx - t, cy, cx + t, b.gy + 1);
    if (nb(1, 0)) seg3(cx, cy - t, b.gx + 1, cy + t);
    if (lvl === 2) for (let i = 0; i < 3; i++) { const [sx, sy] = P(cx - .1 + i * .1, cy, hh); seg([sx, sy], [sx, sy - 5], '#c8ccd0', 1.5); }
    bar(hh + 6);
    return;
  }
  if (kind === 'gate') {
    const lvl = b.lvl || 0, pc = ['rgba(60,66,76,.85)', 'rgba(70,90,110,.9)', 'rgba(70,90,110,.9)', 'rgba(70,90,110,.9)'][lvl];
    for (let i = 0; i < 2; i++) {
      const ta = i / 2, tb = (i + 1) / 2 - .04;
      const F = (t, z) => P(x0 + t * (x1 - x0), y0 + .5, z);
      poly([F(ta + .02, 1), F(tb, 1), F(tb, h), F(ta + .02, h)], pc, '#8a98a8');
      for (let j = 1; j < 6; j++) { const t = ta + (tb - ta) * j / 6; seg(F(t, 1), F(t, h), '#8a98a8'); }
      seg(F(ta + .02, 7), F(tb, 7), '#8a98a8');
      if (lvl >= 2) for (let j = 0; j <= 6; j++) { const t = ta + .02 + (tb - ta - .02) * j / 6, p = F(t, h); seg(p, [p[0], p[1] - 5], '#ccc', 1.5); }
      if (lvl >= 3) { const lit = powerAvail() > 0; ctx.save(); if (lit) { ctx.shadowColor = '#6cf'; ctx.shadowBlur = 8; } seg(F(ta + .02, h + 6), F(tb, h + 6), lit ? '#8df' : '#567', 1.5); ctx.restore(); }
    }
    if (lvl >= 3 && (b.zapFx || 0) > 0) for (let i = 0; i < 5; i++) { const p = P(x0 + Math.random() * b.w, y0 + .5, h + 6); seg(p, [p[0] + (Math.random() - .5) * 14, p[1] - Math.random() * 10], '#ff8', 2); }
    const [lx, ly] = P(x0, y0 + .5), [rx, ry] = P(x1, y0 + .5);
    seg([lx, ly], [lx, ly - h - 3], '#c8c8c0', 4); seg([rx, ry], [rx, ry - h - 3], '#c8c8c0', 4);
    bar(h + 8);
    return;
  }
  if (kind === 'floodlight') {
    const [cx, cy] = P(x0 + .5, y0 + .5);
    seg([cx, cy], [cx, cy - h + 2], '#8a8f96', 3);
    ctx.fillStyle = LIT ? '#ffe9a0' : '#ccc'; ctx.fillRect(cx - 6, cy - h - 2, 12, 5); ctx.strokeStyle = '#555'; ctx.strokeRect(cx - 5.5, cy - h - 1.5, 12, 5);
    bar(h + 6);
    return;
  }
  if (kind === 'wire') {
    const pts = [P(x0 + .08, y0 + .5), P(x0 + .3, y0 + .15), P(x0 + .5, y0 + .85), P(x0 + .7, y0 + .15), P(x0 + .92, y0 + .5)];
    ctx.strokeStyle = '#b8bcc0'; ctx.lineWidth = 1.4; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y - 3) : ctx.moveTo(x, y - 3)); ctx.stroke();
    ctx.strokeStyle = '#6a6e72'; ctx.lineWidth = 1; for (const [x, y] of [pts[0], pts[4]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.stroke(); }
    bar(8); return;
  }
  if (kind === 'pit') {
    const [cx, cy] = P(x0 + .5, y0 + .5);
    ctx.fillStyle = '#4a3a28'; ctx.beginPath(); ctx.ellipse(cx, cy, 10, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#0e0a06'; ctx.beginPath(); ctx.ellipse(cx, cy, 7.5, 3.6, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 2.6, cy + 1); ctx.lineTo(cx + i * 2.6, cy - 2.5); ctx.stroke(); }
    bar(6); return;
  }
  if (kind === 'mine') {
    const [cx, cy] = P(x0 + .5, y0 + .5);
    ctx.fillStyle = '#4a4d52'; ctx.beginPath(); ctx.ellipse(cx, cy - 1, 6.5, 3.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2a2c30'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, 5, 2.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = Math.sin(performance.now() / 300) > .3 ? '#ff4040' : '#802020'; ctx.beginPath(); ctx.arc(cx, cy - 2.5, 1.2, 0, 7); ctx.fill();
    bar(6); return;
  }
  if (kind === 'well') {
    const [cx, cy] = P(x0 + .5, y0 + .5);
    ctx.fillStyle = '#6a6d70'; ctx.fillRect(cx - 11, cy - 8, 22, 8); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 5.5, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#9a9da0'; ctx.beginPath(); ctx.ellipse(cx, cy - 8, 11, 5.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#0f2a44'; ctx.beginPath(); ctx.ellipse(cx, cy - 8, 7.5, 3.6, 0, 0, 7); ctx.fill();
    seg([cx - 9, cy - 6], [cx - 9, cy - h], '#7a5a3a', 2.5); seg([cx + 9, cy - 6], [cx + 9, cy - h], '#7a5a3a', 2.5); seg([cx - 10, cy - h], [cx + 10, cy - h], '#7a5a3a', 2.5);
    ctx.fillStyle = '#8a3a2a'; ctx.beginPath(); ctx.moveTo(cx - 13, cy - h); ctx.lineTo(cx, cy - h - 7); ctx.lineTo(cx + 13, cy - h); ctx.closePath(); ctx.fill();
    seg([cx, cy - h], [cx, cy - 10], '#555', 1);
    bar(h + 8);
    return;
  }
  if (kind === 'tank') {
    const [cx, cy] = P(x0 + .5, y0 + .5);
    { const gr = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0); gr.addColorStop(0, '#7aa0c4'); gr.addColorStop(.5, '#5a7a9a'); gr.addColorStop(1, '#2e4660'); ctx.fillStyle = gr; ctx.fillRect(cx - 12, cy - h, 24, h); }
    ctx.fillStyle = '#2e4660'; ctx.beginPath(); ctx.ellipse(cx, cy, 12, 6, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = RF; ctx.beginPath(); ctx.ellipse(cx, cy - h, 12, 6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
    seg([cx - 12, cy - h * .35], [cx + 12, cy - h * .35], 'rgba(0,0,0,.3)'); seg([cx - 12, cy - h * .7], [cx + 12, cy - h * .7], 'rgba(0,0,0,.3)');
    seg([cx + 12, cy - 3], [cx + 17, cy - 3], '#888', 2);
    bar(h + 8);
    return;
  }

  if (k.glass) {   // crop rows visible through the glass
    for (let i = 0; i < b.w; i++) {
      const xa = x0 + .15 + i * (b.w - .3) / (b.w);
      poly([P(xa, y0 + .2, 1), P(xa + .22, y0 + .2, 1), P(xa + .22, y1 - .2, 1), P(xa, y1 - .2, 1)], i % 2 ? '#2a8a3a' : '#3aa84a');
    }
    ctx.globalAlpha = .72;
  }

  if (k.open) {    // gazebo: posts, rails and a wooden deck instead of solid walls
    poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], '#7a5a3a', '#4a3320');
    for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const p = P(px, py); seg(p, [p[0], p[1] - h], '#6a4a2a', 3); }
    for (const z of [5, 9]) { seg(P(x0, y1, z), P(x1, y1, z), '#5a3a1e', 2); seg(P(x1, y1, z), P(x1, y0, z), '#5a3a1e', 2); }
  } else {
    // walls: south face and east face (shaded)
    poly([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], WF, edge);
    poly([P(x1, y1), P(x1, y0), P(x1, y0, h), P(x1, y1, h)], WF, edge);
    poly([P(x1, y1), P(x1, y0), P(x1, y0, h), P(x1, y1, h)], shade(.3));
    for (const [a1, b1, c1, d1] of [[P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], [P(x1, y1), P(x1, y0), P(x1, y0, h), P(x1, y1, h)]]) {
      const gr = ctx.createLinearGradient(0, a1[1], 0, d1[1]); gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(.3, 'rgba(0,0,0,.08)'); gr.addColorStop(1, 'rgba(255,255,255,.08)');
      poly([a1, b1, c1, d1], gr);
    }
    // plaster patches / weathering
    if (kind === 'house' || kind === 'barn') {
      for (let i = 0; i < 9; i++) {
        const t = hash(b.gx + i, 1), z = 4 + hash(b.gy + i, 2) * (h - 8);
        quad(E, t * .85, t * .85 + .12, z, z + 5, `rgba(255,255,255,${.05 + hash(i, 3) * .08})`);
        quad(S, t * .8, t * .8 + .15, z, z + 4, `rgba(0,0,0,${.04 + hash(i, 4) * .06})`);
      }
      quad(E, 0, 1, 0, 3, shade(.35)); quad(S, 0, 1, 0, 3, shade(.28));      // concrete plinth
    }
    if (kind === 'workshop') {   // brick courses
      for (let z = 3; z < h; z += 3) { seg(E(0, z), E(1, z), 'rgba(0,0,0,.22)'); seg(S(0, z), S(1, z), 'rgba(0,0,0,.18)'); }
    }
  }

  // gable / pyramid / flat roofs
  const tiles = (a, bb, c, dd, n, col) => { for (let i = 0; i <= n; i++) { const t = i / n; seg(P(a[0], a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t), P(c[0], c[1] + (dd[1] - c[1]) * t, c[2] + (dd[2] - c[2]) * t), col); } };
  if (k.gable) {
    poly([P(x0, y1, h), P(x1, y1, h), P(xm, y1, h + rh)], WF, edge);
    poly([P(x0, y0, h), P(xm, y0, h + rh), P(xm, y1, h + rh), P(x0, y1, h)], RF, edge);
    poly([P(xm, y0, h + rh), P(x1, y0, h), P(x1, y1, h), P(xm, y1, h + rh)], RF, edge);
    poly([P(xm, y0, h + rh), P(x1, y0, h), P(x1, y1, h), P(xm, y1, h + rh)], shade(.22));
    poly([P(x0, y0, h), P(xm, y0, h + rh), P(xm, y1, h + rh), P(x0, y1, h)], 'rgba(255,235,190,.1)');
    seg(P(x1, y0, h), P(x1, y1, h), 'rgba(0,0,0,.5)', 2.5); seg(P(x1, y0, h - 1), P(x1, y1, h - 1), 'rgba(220,220,215,.55)', 1);   // eave + gutter
    seg(P(x0, y1, h), P(xm, y1, h + rh), 'rgba(0,0,0,.45)', 2);  seg(P(xm, y1, h + rh), P(x1, y1, h), 'rgba(0,0,0,.45)', 2);
    if (!k.glass) {
      const n = Math.round(b.h * 1.5), tc = 'rgba(0,0,0,.28)';
      for (let i = 1; i < n; i++) { const y = y0 + (y1 - y0) * i / n; seg(P(x0, y, h), P(xm, y, h + rh), tc); seg(P(xm, y, h + rh), P(x1, y, h), tc); }
      for (let i = 1; i < 4; i++) { const f = i / 4; seg(P(x0 + (xm - x0) * f, y0, h + rh * f), P(x0 + (xm - x0) * f, y1, h + rh * f), tc); seg(P(x1 - (x1 - xm) * f, y0, h + rh * f), P(x1 - (x1 - xm) * f, y1, h + rh * f), tc); }
      seg(P(xm, y0, h + rh), P(xm, y1, h + rh), 'rgba(0,0,0,.45)', 2);   // ridge cap
    } else {
      for (let i = 0; i <= b.h; i++) { const y = y0 + (y1 - y0) * i / (b.h); seg(P(x0, y, h), P(xm, y, h + rh), 'rgba(220,245,255,.6)'); seg(P(xm, y, h + rh), P(x1, y, h), 'rgba(220,245,255,.6)'); }
    }
  } else if (k.pyramid) {
    const ap = P(xm, ym, h + rh);
    poly([P(x0, y1, h), P(x1, y1, h), ap], RF, edge);
    poly([P(x1, y1, h), P(x1, y0, h), ap], '#8a3220', edge);
    for (let i = 1; i < 4; i++) { const f = i / 4; seg(P(x0 + (xm - x0) * f, y1 - (y1 - ym) * f, h + rh * f), P(x1 - (x1 - xm) * f, y1 - (y1 - ym) * f, h + rh * f), 'rgba(0,0,0,.3)'); }
    seg(ap, [ap[0], ap[1] - 6], '#333', 2);
  } else {
    poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], RF, edge);
  }
  ctx.globalAlpha = 1;

  // ---- per-building details ----
  const win = (F, t0, t1, z0, z1) => {
    quad(F, t0, t1, z0, z1, '#ecece6', 'rgba(0,0,0,.4)');
    const a = F(t0 + .015, z0 + 1), bb = F(t1 - .015, z0 + 1), c = F(t1 - .015, z1 - 1), d = F(t0 + .015, z1 - 1);
    const gr = ctx.createLinearGradient(0, d[1], 0, a[1]);
    if (NIGHT) { gr.addColorStop(0, '#ffeab0'); gr.addColorStop(1, '#e8a64e'); }
    else { gr.addColorStop(0, '#9cc0e0'); gr.addColorStop(.55, '#46688a'); gr.addColorStop(1, '#1c2c42'); }
    poly([a, bb, c, d], gr);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo((d[0] + c[0]) / 2, (d[1] + c[1]) / 2); ctx.lineTo((a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2); ctx.lineTo(a[0], a[1]); ctx.closePath(); ctx.fill();
    seg(F((t0 + t1) / 2, z0 + 1), F((t0 + t1) / 2, z1 - 1), '#ecece6');
    quad(F, t0 - .01, t1 + .01, z0 - 1.5, z0, '#b4b4b0');
  };
  if (kind === 'house') {
    win(E, .08, .24, 10, 23); win(E, .70, .86, 10, 23, '#3a2418');
    quad(E, .40, .56, 0, 21, '#f2f2ee');                       // door frame
    quad(E, .42, .54, 1, 20, '#e8851a');                       // lit doorway
    quad(E, .43, .48, 1, 20, 'rgba(255,255,255,.55)');         // glass door leaf
    quad(E, .36, .60, -2, 0, '#9a9a94');                       // step
    quad(E, .60, .70, 22, 27, '#f4f4f4', '#999');              // AC unit
    seg(E(.62, 24), E(.68, 24), '#aaa');
    win(S, .15, .42, 10, 23);
    // attic balcony opening with scaffold, as in the photo
    poly([S(.28, h + 2), S(.72, h + 2), S(.72, h + 11), S(.28, h + 11)], '#2a1f18', '#cba');
    seg(S(.28, h + 6), S(.72, h + 6), '#d8b060', 2);
    // skylight on the east roof slope
    poly([P(xm + 1.1, y0 + 2.2, h + rh * .55), P(xm + 1.7, y0 + 2.2, h + rh * .38), P(xm + 1.7, y0 + 3.4, h + rh * .38), P(xm + 1.1, y0 + 3.4, h + rh * .55)], '#9ac', '#ddd');
    // chimney
    const c0 = P(xm - .4, y0 + 2.4, h + rh * .9); seg([c0[0], c0[1] + 6], [c0[0], c0[1] - 8], '#7a4a3a', 6);
  } else if (kind === 'workshop') {
    quad(E, .55, .85, 0, 15, '#6b6f74', '#aaa');                  // roller door
    for (let z = 3; z < 15; z += 3) seg(E(.55, z), E(.85, z), 'rgba(0,0,0,.35)');
    win(E, .12, .28, 9, 17); win(S, .35, .65, 9, 17);
  } else if (kind === 'barn') {
    for (let i = 0; i < 4; i++) { const t = .08 + i * .24; win(E, t, t + .1, 6, 11); }
  } else if (kind === 'generator') {
    seg(P(x0 + .8, y0 + .2, h), P(x0 + .8, y0 + .2, h + 9), '#444', 2.5);
    quad(E, .15, .85, 3, 7, 'rgba(0,0,0,.35)'); quad(S, .2, .6, 3, 8, '#222');
    for (const [cx0, cy0] of [[x0 - .15, y1 + .3], [x0 + .2, y1 + .35]]) { const p = P(cx0, cy0); ctx.fillStyle = '#b33'; ctx.fillRect(p[0] - 4, p[1] - 9, 8, 9); ctx.fillStyle = '#722'; ctx.fillRect(p[0] - 2, p[1] - 11, 4, 2); }
  } else if (kind === 'powerbox') {
    quad(E, .2, .8, 4, 13, '#aab0b6', '#777'); quad(E, .3, .7, 9, 11, save.energy > 0 ? '#3f6' : '#a33');
    quad(S, .25, .75, 5, 12, '#bcc2c8', '#888');
  } else if (kind === 'greenhouse') {
    for (let i = 0; i <= b.h; i++) { const t = i / (b.h); seg(E(t, 0), E(t, h), 'rgba(235,250,255,.8)'); }
    for (let i = 0; i <= b.w; i++) { const t = i / (b.w); seg(S(t, 0), S(t, h), 'rgba(235,250,255,.8)'); }
    quad(E, .42, .58, 0, h - 1, 'rgba(240,250,255,.5)', '#fff');   // door
  }
  if (k.pv) {          // rooftop PV array on the east roof slope
    const Q = (y, f) => P(xm + (x1 - xm) * f, y, h + rh - rh * f), ya = kind === 'house' ? y0 + 3.8 : y0 + .6, yb = y1 - .6, cols = kind === 'house' ? 5 : 9;
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      const f0 = .1 + r * .42, f1 = f0 + .38, c0 = ya + (yb - ya) * c / cols + .03, c1 = ya + (yb - ya) * (c + 1) / cols - .03;
      poly([Q(c0, f0), Q(c1, f0), Q(c1, f1), Q(c0, f1)], '#122a58', '#7f9fd4');
      seg(Q(c0, (f0 + f1) / 2), Q(c1, (f0 + f1) / 2), 'rgba(160,190,240,.35)');
    }
  }
  if (k.scaffold) {   // renovation scaffolding on the south face, with a ladder
    const sc = '#c9a15a', o1 = .36, o2 = 1.0;
    for (let i = 0; i <= 5; i++) { const t = i / 5, p = P(x0 + (x1 - x0) * t, y1 + o1); seg(p, [p[0], p[1] - h - 12], sc, 1.5); }
    for (let z = 10; z <= h + 10; z += 11) { seg(P(x0, y1 + o1, z), P(x1, y1 + o1, z), sc, 1.5); poly([P(x0, y1 + o1, z), P(x1, y1 + o1, z), P(x1, y1 + o2, z), P(x0, y1 + o2, z)], 'rgba(120,90,50,.55)'); }
    for (let z = 0; z < h + 10; z += 11) { seg(P(x0, y1 + o1, z), P(x1, y1 + o1, z + 11), 'rgba(201,161,90,.6)'); }
    seg(P(x1 + .2, y1 + 1.2), P(x1 + .2, y1 + .2, h), '#d8d8d8', 2); seg(P(x1 + .6, y1 + 1.2), P(x1 + .6, y1 + .2, h), '#d8d8d8', 2);
    for (let z = 4; z < h; z += 5) seg(P(x1 + .2, y1 + 1.2 - (1.0 * z / h), z), P(x1 + .6, y1 + 1.2 - (1.0 * z / h), z), '#d8d8d8');
  }
  if (kind === 'turret') {
    const [cx, cy] = P(x0 + .5, y0 + .5, h);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
  }
  if (hpFrac < 1) {
    const [cx, cy] = P(xm, ym, h + rh + 6);
    ctx.fillStyle = '#300'; ctx.fillRect(cx - 14, cy, 28, 4); ctx.fillStyle = hpFrac < .4 ? RED : GREEN; ctx.fillRect(cx - 14, cy, 28 * hpFrac, 4);
  }
}

