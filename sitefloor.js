// Static scenery for a scavenging site: the pre-rendered floor, shell and fence, and every top-down prop.
// ------------------------------------------------------------------ static scene
function buildSiteFloor(m) {
  const F = document.createElement('canvas'); F.width = W; F.height = H; const g = F.getContext('2d');
  m.floor = F; m.fctx = g;
  const k = m.theme, B = m.bounds;
  // ----- ground
  const base = { camp: 'gravel', fuel: 'asphalt', hospital: 'wtile', police: 'polished', army: 'gravel', university: 'wtile', airport: 'polished', canal: 'grass', store: 'stile', outfitter: 'stile', hardware: 'polished', pharmacy: 'wtile', warehouse: 'polished', pharma_wh: 'polished', dealer: 'asphalt', dealer_ev: 'asphalt', dealer_com: 'asphalt', ruins_town: 'grass', ruins_village: 'grass' }[k];
  g.fillStyle = TEX[base] || '#222'; g.fillRect(0, 0, W, H);
  const stain = (n, col, ra = 40) => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.ellipse(rand(B.x0, B.x1), rand(B.y0, B.y1), rand(8, ra), rand(5, ra * .6), rand(0, 3), 0, 7); g.fill(); } };
  const scatter = (n, cols, sz) => { for (let i = 0; i < n; i++) { g.save(); g.translate(rand(B.x0 + 10, B.x1 - 10), rand(B.y0 + 10, B.y1 - 10)); g.rotate(rand(0, 6.3)); g.fillStyle = pick(cols); g.fillRect(-sz / 2, -sz / 3, rand(sz * .6, sz * 1.4), rand(sz * .4, sz)); g.restore(); } };
  if (k === 'store' || k === 'hardware' || k === 'outfitter') {
    stain(14, 'rgba(70,50,30,.10)'); stain(6, 'rgba(120,20,20,.10)', 22);
    if (k === 'store') { scatter(60, ['#c0392b', '#e8a33a', '#3a8a4a', '#2a6ab0', '#e8e8e8', '#8a5a2a'], 7); }
    else if (k === 'outfitter') { scatter(60, ['#2a4a8a', '#c0392b', '#3a6a4a', '#e8e8e8', '#26282c', '#d9822b'], 8); }
    else { scatter(50, ['#d9822b', '#6a6f74', '#8a6a3a', '#c0392b'], 7); for (let x = 60; x < W - 60; x += 220) lineTo2(g, x, B.y0, x, B.y1, 'rgba(230,140,40,.35)', 3); }
    // entrance mat + exit marks
    g.fillStyle = '#2a2a30'; rrect(g, 400, H - 70, 160, 34, 4); g.fill(); text2(g, 'WELCOME', 480, H - 49, 11, 'rgba(255,255,255,.35)');
    for (const gp of m.gaps) if (gp.s !== 'b') { const px = gp.s === 'l' ? 52 : gp.s === 'r' ? W - 52 : gp.c, py = gp.s === 't' ? 76 : gp.c; g.fillStyle = 'rgba(20,160,60,.5)'; g.fillRect(px - 14, py - 5, 28, 10); text2(g, 'EXIT', px, py + 3, 8, '#cfc'); }
  } else if (k === 'pharmacy') {
    stain(8, 'rgba(60,90,110,.08)'); scatter(40, ['#ffffff', '#7ab0d8', '#e86a6a', '#f2e6a0'], 6);
    g.fillStyle = 'rgba(40,170,90,.20)'; g.fillRect(450, 400, 60, 18); g.fillRect(471, 379, 18, 60);
    for (let i = 0; i < 4; i++) lineTo2(g, 190 + i * 150, 100, 190 + i * 150, 140, 'rgba(40,170,90,.25)', 2);
  } else if (k === 'warehouse' || k === 'pharma_wh') {
    stain(16, 'rgba(20,20,20,.14)', 34); stain(5, 'rgba(120,70,20,.10)', 26); scatter(30, ['#a0794a', '#6a4a2a', '#d8d0b0'], 8);
    const line = k === 'warehouse' ? 'rgba(235,190,40,.55)' : 'rgba(60,140,220,.5)';
    for (const x of [40, 285, 520, 770, 920]) lineTo2(g, x, B.y0, x, B.y1, line, 4);
    for (let y = 100; y < H - 40; y += 160) lineTo2(g, B.x0, y, B.x1, y, 'rgba(240,240,240,.18)', 2);
    for (const gp of m.gaps) if (gp.s === 't') { g.fillStyle = 'rgba(235,190,40,.35)'; for (let i = 0; i < 6; i++) g.fillRect(gp.c - 50 + i * 18, 70, 9, 20); }
  } else if (k === 'hospital' || k === 'university') {
    stain(k === 'hospital' ? 14 : 8, k === 'hospital' ? 'rgba(110,20,20,.16)' : 'rgba(60,90,110,.08)', 26);
    scatter(36, k === 'hospital' ? ['#ffffff', '#cfe0ea', '#e86a6a'] : ['#f2f2e8', '#8aa0c8', '#e8d8a0'], 6);
    if (k === 'hospital') { g.fillStyle = 'rgba(220,60,60,.25)'; g.fillRect(450, 200, 60, 18); g.fillRect(471, 179, 18, 60); lineTo2(g, B.x0, 330, B.x1, 330, 'rgba(60,200,120,.35)', 4); }
    else for (let i = 0; i < 4; i++) lineTo2(g, B.x0, 130 + i * 84, B.x1, 130 + i * 84, 'rgba(60,90,130,.12)', 2);
  } else if (k === 'police') {
    stain(10, 'rgba(0,0,0,.14)', 28); scatter(30, ['#e8e8e0', '#6aa8ff', '#d0c8a0'], 6); lineTo2(g, B.x0, 440, B.x1, 440, 'rgba(70,130,230,.35)', 4);
    g.fillStyle = 'rgba(70,130,230,.2)'; g.fillRect(430, 540, 100, 40);
  } else if (k === 'army' || k === 'camp') {
    g.fillStyle = TEX.dirt; g.globalAlpha = .55; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(rand(60, W - 60), rand(90, H - 60), rand(50, 120), rand(18, 40), 0, 0, 7); g.fill(); } g.globalAlpha = 1;
    for (const y of [252, 380, 520]) lineTo2(g, B.x0, y, B.x1, y, 'rgba(0,0,0,.22)', 10);
    for (let i = 0; i < 10; i++) lineTo2(g, 60 + i * 90, 560, 100 + i * 90, 560, 'rgba(235,225,170,.5)', 3);
    stain(8, 'rgba(0,0,0,.2)', 30);
  } else if (k === 'airport') {
    stain(12, 'rgba(20,20,30,.10)', 34); scatter(40, ['#d8d8e0', '#3a6ab0', '#c0392b', '#26282c'], 8);
    for (const x of [230, 480, 730]) { lineTo2(g, x, 150, x, 520, 'rgba(60,120,200,.28)', 6); lineTo2(g, x, 150, x - 10, 168, 'rgba(60,120,200,.28)', 6); lineTo2(g, x, 150, x + 10, 168, 'rgba(60,120,200,.28)', 6); }
  } else if (k === 'canal') {
    g.fillStyle = TEX.concrete; g.fillRect(0, 210, W, 78); g.fillRect(0, 372, W, 72);
    for (let x = 0; x < W; x += 36) { lineTo2(g, x, 210, x, 288, 'rgba(0,0,0,.18)'); lineTo2(g, x, 372, x, 444, 'rgba(0,0,0,.18)'); }
    for (const [a, b] of [[200, 280], [640, 730]]) { g.fillStyle = TEX.concrete; g.fillRect(a, 284, b - a, 92); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(a, 284, b - a, 4); g.fillRect(a, 372, b - a, 4); for (const rx of [a + 2, b - 4]) lineTo2(g, rx, 286, rx, 374, '#7a8088', 3); }
    stain(8, 'rgba(60,90,40,.14)', 40);
    for (let i = 0; i < 60; i++) { const tx = rand(0, W), ty = rand(40, H); if ((ty > 210 && ty < 444)) continue; g.strokeStyle = pick(['#6a8a38', '#8a9a48', '#a39a4c']); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 2, ty - 5); g.moveTo(tx, ty); g.lineTo(tx + 2, ty - 5); g.stroke(); }
  } else if (k === 'fuel') {
    stain(14, 'rgba(0,0,0,.2)', 34); stain(5, 'rgba(30,60,120,.12)', 26); scatter(30, ['#8a8a80', '#c8c0a0', '#3a3a40'], 6);
    g.fillStyle = TEX.concrete; g.fillRect(70, 214, 480, 168); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(70, 214, 480, 5);
    for (let c = 0; c <= 4; c++) lineTo2(g, 70 + c * 110, 222, 70 + c * 110, 372, 'rgba(255,255,255,.25)', 2);
    for (let i = 0; i < 14; i++) lineTo2(g, 70 + i * 36, 400, 90 + i * 36, 400, 'rgba(235,225,170,.5)', 3);
    lineTo2(g, B.x0, 560, B.x1, 560, 'rgba(235,225,170,.35)', 4);
    g.fillStyle = 'rgba(30,90,200,.35)'; g.fillRect(200, 500, 160, 26); text2(g, 'PETROM', 280, 519, 16, 'rgba(255,215,60,.7)');
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(740, 214, 6, 70); text2(g, 'DN69', 760, 530, 13, 'rgba(255,255,255,.4)');
  } else if (k.startsWith('dealer')) {
    stain(10, 'rgba(0,0,0,.18)', 30); stain(4, 'rgba(40,60,120,.10)', 24);
    for (const y of [214, 330, 446]) for (let c = 0; c <= 8; c++) { const x = 52 + c * 106; lineTo2(g, x, y - 8, x, y + 40, 'rgba(240,240,240,.55)', 2); }
    for (let i = 0; i < 16; i++) lineTo2(g, 80 + i * 56, 176, 100 + i * 56, 176, 'rgba(230,200,40,.5)', 3);
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) g.fillRect(430 + i * 18, 520, 10, 60);
  } else {   // ruined street / village
    const town = k === 'ruins_town';
    if (town) {
      g.fillStyle = TEX.concrete; g.fillRect(0, 290, W, 116); g.fillRect(420, 36, 120, H);
      g.fillStyle = TEX.asphalt; g.fillRect(0, 300, W, 96); g.fillRect(430, 36, 100, H);
      for (let x = -10; x < W; x += 56) { g.fillStyle = 'rgba(235,225,170,.6)'; if (x < 420 || x > 540) g.fillRect(x, 346, 30, 4); }
      for (let y = 44; y < H; y += 56) { g.fillStyle = 'rgba(235,225,170,.6)'; if (y < 290 || y > 400) g.fillRect(478, y, 4, 30); }
      for (let i = 0; i < 6; i++) lineTo2(g, 430 + i * 18, 308, 430 + i * 18, 390, 'rgba(255,255,255,.35)', 5);
      g.fillStyle = TEX.dirt; g.globalAlpha = .45; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rand(40, W - 40), rand(60, H - 40), rand(30, 70), rand(14, 30), 0, 0, 7); g.fill(); } g.globalAlpha = 1;
      for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); let px = rand(0, W), py = rand(300, 396); g.moveTo(px, py); for (let j = 0; j < 5; j++) { px += rand(-12, 12); py += rand(-5, 5); g.lineTo(px, py); } g.stroke(); }
    } else {
      g.fillStyle = TEX.dirt; g.globalAlpha = .9; g.beginPath(); g.moveTo(0, 390); g.bezierCurveTo(260, 330, 460, 470, W, 400); g.lineTo(W, 450); g.bezierCurveTo(460, 520, 260, 390, 0, 450); g.closePath(); g.fill(); g.globalAlpha = 1;
      stain(12, 'rgba(120,150,60,.14)', 70); stain(8, 'rgba(180,150,80,.12)', 60);
    }
    scatter(30, ['#6a6a60', '#8a8a80', '#7a5a3a'], 7);
    for (let i = 0; i < 80; i++) { const tx = rand(0, W), ty = rand(40, H); g.strokeStyle = pick(['#6a8a38', '#8a9a48', '#a39a4c']); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 2, ty - 5); g.moveTo(tx, ty); g.lineTo(tx + 2, ty - 5); g.stroke(); }
  }
  // ----- shadows of static furniture, then the furniture itself
  g.save(); g.fillStyle = 'rgba(0,0,0,.28)';
  for (const o of m.walls) { if (o.style === 'tree' || o.style === 'water') continue; const d = o.style === 'house' || o.style === 'showroom' || o.style === 'coldroom' ? 9 : 4; g.fillRect(o.x + d, o.y + d, o.w, o.h); }
  g.restore();
  for (const o of m.walls) drawProp(g, o);
  // ----- building shell / fence with openings
  if (m.indoor) drawShell(g, m); else if (m.fenced) drawFence(g, m);
  // inner shadow so the room feels enclosed
  if (m.indoor) { const gr = g.createLinearGradient(0, 62, 0, 130); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(36, 62, W - 72, 70); }
}
function text2(g, s, x, y, size, col) { g.font = `bold ${size}px monospace`; g.textAlign = 'center'; g.fillStyle = col; g.fillText(s, x, y); }

function drawShell(g, m) {
  const t = { t: [0, 36, W, 28], b: [0, H - 34, W, 34], l: [0, 36, 34, H - 36], r: [W - 34, 36, 34, H - 36] };
  const wallTex = m.theme === 'warehouse' || m.theme === 'pharma_wh' ? TEX.concrete : TEX.plaster;
  const gapsOf = s => m.gaps.filter(q => q.s === s).sort((a, b) => a.c - b.c);
  for (const side of ['t', 'b', 'l', 'r']) {
    const [x, y, w, h] = t[side], horiz = side === 't' || side === 'b', len = horiz ? w : h, start = horiz ? x : y;
    let cur = start;
    const segs = [];
    for (const gp of gapsOf(side)) { segs.push([cur, gp.c - gp.w / 2]); cur = gp.c + gp.w / 2; }
    segs.push([cur, start + len]);
    for (const [a, b] of segs) {
      if (b - a < 1) continue;
      const rx = horiz ? a : x, ry = horiz ? y : a, rw = horiz ? b - a : w, rh = horiz ? h : b - a;
      g.fillStyle = wallTex; g.fillRect(rx, ry, rw, rh); g.fillStyle = 'rgba(30,25,20,.45)'; g.fillRect(rx, ry, rw, rh);
      g.fillStyle = 'rgba(255,255,255,.12)';   // lit inner edge
      if (side === 't') g.fillRect(rx, ry + rh - 3, rw, 3); if (side === 'b') g.fillRect(rx, ry, rw, 3); if (side === 'l') g.fillRect(rx + rw - 3, ry, 3, rh); if (side === 'r') g.fillRect(rx, ry, 3, rh);
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.strokeRect(rx, ry, rw, rh);
    }
    for (const gp of gapsOf(side)) {   // door frame, glass or roller door
      const a = gp.c - gp.w / 2, b = gp.c + gp.w / 2, dock = side === 't' && (m.theme === 'warehouse' || m.theme === 'pharma_wh');
      g.fillStyle = dock ? '#5a6068' : 'rgba(140,200,230,.35)';
      if (horiz) { g.fillRect(a, y + (side === 't' ? 0 : 0), gp.w, 6); lineTo2(g, a, y, a, y + h, '#222', 3); lineTo2(g, b, y, b, y + h, '#222', 3); if (!dock) { lineTo2(g, gp.c, y, gp.c, y + 8, 'rgba(255,255,255,.6)', 2); } }
      else { g.fillRect(x + (side === 'r' ? 28 : 0), a, 6, gp.w); lineTo2(g, x, a, x + w, a, '#222', 3); lineTo2(g, x, b, x + w, b, '#222', 3); }
    }
  }
}
function drawFence(g, m) {   // chain-link fence round the lot, with a gate and two gaps
  const gaps = m.gaps;
  const gapAt = (s, v) => gaps.some(q => q.s === s && Math.abs(v - q.c) < q.w / 2);
  g.strokeStyle = 'rgba(190,200,210,.55)'; g.lineWidth = 2;
  for (let x = 14; x < W - 14; x += 6) { if (gapAt('b', x)) continue; lineTo2(g, x, H - 14, x + 3, H - 20, 'rgba(190,200,210,.5)', 1); }
  lineTo2(g, 14, H - 18, 480 - 120, H - 18, '#aab4bc', 2); lineTo2(g, 480 + 120, H - 18, W - 14, H - 18, '#aab4bc', 2);
  for (const side of ['l', 'r']) { const x = side === 'l' ? 14 : W - 14; let y0 = 62; const c = gaps.find(q => q.s === side); lineTo2(g, x, 62, x, c.c - c.w / 2, '#aab4bc', 2); lineTo2(g, x, c.c + c.w / 2, x, H - 18, '#aab4bc', 2); }
  for (let x = 14; x <= W - 14; x += 60) { if (gapAt('b', x)) continue; g.fillStyle = '#6a7078'; g.fillRect(x - 2, H - 22, 5, 8); }
  g.fillStyle = '#c9a15a'; g.fillRect(480 - 120 - 4, H - 24, 8, 12); g.fillRect(480 + 120 - 4, H - 24, 8, 12);
}

// ------------------------------------------------------------------ props (all drawn top-down)
function drawProp(g, o) {
  const { x, y, w, h } = o, s = o.seed || 0, sr = i => { const v = Math.sin((s * 999 + i) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  switch (o.style) {
    case 'shelf': case 'rack': case 'prack': {
      const store = o.style === 'shelf', horiz = w >= h, pal = o.pal || (store ? ['#c0392b', '#e8a33a', '#3a8a4a', '#2a6ab0', '#d9d4c0', '#8a5a2a', '#e8e8e8', '#a03a6a'] :
        o.style === 'prack' ? ['#ffffff', '#dfe9f2', '#7ab0d8', '#e86a6a', '#9ad0a8', '#c8d8e8'] : ['#a0794a', '#8a6a3a', '#c9a064', '#d8d0b0', '#6a4a2a', '#7a8088']);
      g.fillStyle = store ? '#a9afb3' : o.style === 'prack' ? '#cfd8e0' : '#51565c'; rrect(g, x, y, w, h, 3); g.fill();
      if (o.style !== 'shelf' && w + h > 80) { g.fillStyle = o.style === 'prack' ? '#3a78c8' : '#d9822b'; if (horiz) { g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3); } else { g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h); } }
      const cell = store ? 11 : 15; let i = 0;
      if (horiz) for (let cx = x + 3; cx < x + w - 6; cx += cell) for (const half of [0, 1]) {
        i++; if (sr(i) < .14) continue;
        const cw = cell - 2, ch = h / 2 - 3, cy = half ? y + h / 2 + 1 : y + 2;
        g.fillStyle = choose(pal, sr(i + 50)); g.fillRect(cx, cy, cw, ch); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(cx, half ? cy + ch - 2 : cy, cw, 2);
        if (!store && o.style === 'rack') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(cx + .5, cy + .5, cw, ch); }
      } else for (let cy = y + 3; cy < y + h - 6; cy += cell + 2) for (const half of [0, 1]) {
        i++; if (sr(i) < .1) continue;
        const cx = half ? x + w / 2 + 1 : x + 2, cw = w / 2 - 3, ch = cell + 1;
        if (o.style === 'rack' && sr(i + 9) < .3) { g.fillStyle = 'rgba(235,235,240,.7)'; g.fillRect(cx, cy, cw, ch); g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(cx + .5, cy + .5, cw, ch); }
        else { g.fillStyle = choose(pal, sr(i + 50)); g.fillRect(cx, cy, cw, ch); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx, cy, cw, 2); g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(cx + .5, cy + .5, cw, ch); }
      }
      lineTo2(g, ...(horiz ? [x + 2, y + h / 2, x + w - 2, y + h / 2] : [x + w / 2, y + 2, x + w / 2, y + h - 2]), 'rgba(0,0,0,.4)', 1);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.5; rrect(g, x, y, w, h, 3); g.stroke();
      break;
    }
    case 'fridge': {
      g.fillStyle = '#d6dadd'; rrect(g, x, y, w, h, 3); g.fill();
      g.fillStyle = 'rgba(150,205,235,.55)'; g.fillRect(x + 3, y + 8, w - 6, h - 11);
      for (let dx = x + 3; dx < x + w - 6; dx += (w - 6) / 4) lineTo2(g, dx, y + 8, dx, y + h - 3, 'rgba(0,0,0,.35)', 1);
      for (let i = 0; i < 12; i++) { g.fillStyle = choose(['#c0392b', '#3a8a4a', '#e8e8e8', '#2a6ab0', '#e8a33a'], sr(i)); g.fillRect(x + 5 + i * ((w - 12) / 12), y + 11, 6, 8); }
      g.fillStyle = '#2a6ab0'; g.fillRect(x, y, w, 5); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'counter': {
      g.fillStyle = '#8a6a44'; rrect(g, x, y, w, h, 3); g.fill(); g.fillStyle = '#e8e4da'; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      g.fillStyle = '#2a2a2e'; g.fillRect(x + 4, y + h - 9, w - 30, 5);                                   // belt
      g.fillStyle = '#4a4e56'; g.fillRect(x + w - 22, y + 4, 16, h - 8); g.fillStyle = '#7ac6a0'; g.fillRect(x + w - 20, y + 6, 12, 5);   // till
      for (let i = 0; i < 3; i++) { g.fillStyle = choose(['#c0392b', '#e8a33a', '#3a8a4a'], sr(i)); g.fillRect(x + 8 + i * 16, y + 5, 10, 8); }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'cart': { g.strokeStyle = '#9aa2aa'; g.lineWidth = 2; g.strokeRect(x + 2, y + 3, w - 4, h - 6); for (let i = 0; i < 4; i++) lineTo2(g, x + 6 + i * 9, y + 3, x + 6 + i * 9, y + h - 3, '#9aa2aa', 1); g.fillStyle = '#e04a3a'; g.fillRect(x + w - 6, y + 4, 4, h - 8); break; }
    case 'chair': { g.fillStyle = '#3a5a8a'; rrect(g, x, y, w, w, 5); g.fill(); g.fillStyle = '#2a4268'; g.fillRect(x, y, w, 7); break; }
    case 'lumber': { for (let i = 0; i < 6; i++) { g.fillStyle = choose(['#c9a064', '#b88a50', '#d8b078'], sr(i)); g.fillRect(x, y + i * (h / 6), w, h / 6 - 1); for (let j = 0; j < 5; j++) lineTo2(g, x + sr(i * 9 + j) * w, y + i * (h / 6), x + sr(i * 9 + j) * w + 8, y + (i + 1) * (h / 6) - 1, 'rgba(90,60,30,.35)'); } g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x + .5, y + .5, w, h); break; }
    case 'paint': { g.fillStyle = '#51565c'; g.fillRect(x, y, w, h); for (let i = 0; i < Math.floor(w / 14); i++) for (const r of [0, 1]) { g.fillStyle = choose(['#c0392b', '#2a6ab0', '#e8e8e8', '#3a8a4a', '#e8c040'], sr(i + r * 9)); g.beginPath(); g.arc(x + 8 + i * 14, y + 7 + r * 13, 5.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x + 7 + i * 14, y + 5.5 + r * 13, 2, 0, 7); g.fill(); } break; }
    case 'pallet': {
      g.fillStyle = '#7a5a34'; g.fillRect(x, y, w, h);
      if (sr(1) < .5) { for (let cx = x + 2; cx < x + w - 6; cx += 16) for (let cy = y + 2; cy < y + h - 6; cy += 14) { g.fillStyle = choose(['#b8864a', '#a9783e', '#c89a5a'], sr(cx + cy)); g.fillRect(cx, cy, 14, 12); g.fillStyle = 'rgba(220,200,150,.7)'; g.fillRect(cx + 6, cy, 3, 12); g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(cx + .5, cy + .5, 14, 12); } }
      else { g.fillStyle = 'rgba(235,240,245,.65)'; g.fillRect(x + 2, y + 2, w - 4, h - 4); for (let i = 0; i < 6; i++) lineTo2(g, x + 3, y + 4 + i * (h / 6), x + w - 3, y + 8 + i * (h / 6), 'rgba(120,130,140,.35)'); g.fillStyle = 'rgba(40,90,170,.5)'; g.fillRect(x + w / 2 - 6, y + h / 2 - 5, 12, 10); }
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'forklift': { g.fillStyle = '#e8b020'; rrect(g, x + 14, y + 2, w - 14, h - 4, 4); g.fill(); g.fillStyle = '#2a2a2e'; g.fillRect(x + 22, y + 7, 18, h - 14); g.fillStyle = '#9aa0a8'; g.fillRect(x, y + 5, 16, 3); g.fillRect(x, y + h - 8, 16, 3); g.fillStyle = '#111'; for (const [wx, wy] of [[x + 18, y], [x + 18, y + h - 5], [x + w - 12, y], [x + w - 12, y + h - 5]]) g.fillRect(wx, wy, 9, 5); break; }
    case 'coldroom': { g.fillStyle = '#bcd2e0'; g.fillRect(x, y, w, h); for (let i = 0; i < w; i += 22) lineTo2(g, x + i, y, x + i, y + h, 'rgba(60,100,130,.4)', 1); g.fillStyle = '#6a8aa0'; g.fillRect(x + w / 2 - 22, y + h - 6, 44, 6); g.fillStyle = 'rgba(80,140,200,.35)'; for (let i = 0; i < 3; i++) g.fillRect(x + 20 + i * 70, y + 12, 40, 26); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); text2(g, 'COLD STORE', x + w / 2, y + 62, 12, 'rgba(20,60,100,.6)'); break; }
    case 'showroom': {
      g.fillStyle = TEX.concrete; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y, w, h);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#7a8088'; g.fillRect(x + 40 + i * 160, y + 14, 46, 34); lineTo2(g, x + 40 + i * 160, y + 31, x + 86 + i * 160, y + 31, '#4a4e54'); }   // roof units
      const gr = g.createLinearGradient(0, y + h - 24, 0, y + h); gr.addColorStop(0, '#3a4a58'); gr.addColorStop(1, '#9ac8e8'); g.fillStyle = gr; g.fillRect(x, y + h - 24, w, 24);
      for (let i = 0; i < w; i += 70) lineTo2(g, x + i, y + h - 24, x + i, y + h, 'rgba(255,255,255,.5)', 2);
      g.fillStyle = o.sign ? '#1d4fa8' : '#d83a3a'; g.fillRect(x + w / 2 - 110, y + h - 40, 220, 14); text2(g, o.sign || 'AUTO', x + w / 2, y + h - 29, 11, o.sign ? '#ffd23a' : '#fff');
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); break;
    }
    case 'car': drawCarTop(g, x, y, w, h, o.col, o.burnt, s, o.shiny, o.veh, o.military); break;
    case 'pump': {
      g.fillStyle = '#8a8d90'; g.fillRect(x, y, w, h); g.strokeStyle = '#e8c030'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = '#dfe2e4'; rrect(g, x + w / 2 - 8, y + h / 2 - 10, 16, 20, 3); g.fill(); g.fillStyle = '#c0262c'; g.fillRect(x + w / 2 - 8, y + h / 2 - 10, 16, 6);
      g.fillStyle = '#12301e'; g.fillRect(x + w / 2 - 5, y + h / 2 - 2, 10, 6); lineTo2(g, x + w / 2 + 8, y + h / 2, x + w / 2 + 12, y + h / 2 + 10, '#222', 2); break;
    }
    case 'bed': {
      g.fillStyle = '#cfd6da'; rrect(g, x, y, w, h, 3); g.fill(); g.fillStyle = '#f3f5f7'; rrect(g, x + 2, y + 3, w - 4, h - 6, 2); g.fill();
      g.fillStyle = '#fff'; rrect(g, x + 4, y + 5, w - 8, 12, 3); g.fill();
      g.fillStyle = choose(['#8ab8d8', '#a8c8a0', '#e0d8b0', '#c8a8c8'], sr(1)); g.fillRect(x + 2, y + 24, w - 4, h - 28);
      if (sr(2) < .35) { g.fillStyle = 'rgba(120,16,16,.55)'; g.beginPath(); g.ellipse(x + w / 2, y + 36, 8, 12, .3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; rrect(g, x, y, w, h, 3); g.stroke(); break;
    }
    case 'gurney': {
      g.fillStyle = '#b8c0c6'; rrect(g, x, y + 3, w, h - 6, 3); g.fill(); g.fillStyle = '#eef0f2'; rrect(g, x + 3, y + 6, w - 6, h - 12, 2); g.fill();
      g.fillStyle = sr(1) < .5 ? '#8ab8d8' : '#f4f4f4'; g.fillRect(x + 14, y + 6, w - 17, h - 12);
      g.fillStyle = '#222'; for (const [wx, wy] of [[x + 4, y], [x + w - 8, y], [x + 4, y + h - 5], [x + w - 8, y + h - 5]]) g.fillRect(wx, wy, 5, 5); break;
    }
    case 'locker': {
      g.fillStyle = '#6a7882'; g.fillRect(x, y, w, h); for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeRect(x + 2 + i * (w / 3), y + 2, w / 3 - 3, h - 4); lineTo2(g, x + 6 + i * (w / 3), y + 6, x + w / 3 - 3 + i * (w / 3), y + 6, 'rgba(0,0,0,.4)'); }
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'cell': {
      g.fillStyle = 'rgba(30,34,40,.85)'; g.fillRect(x, y, w, h); g.fillStyle = '#8a8e94'; g.fillRect(x + 6, y + 8, 30, h - 22); g.fillStyle = '#c8c0a0'; g.fillRect(x + 8, y + 10, 26, 12);
      for (let i = 0; i <= w; i += 11) lineTo2(g, x + i, y + h - 10, x + i, y + h, '#9aa0a8', 3);
      lineTo2(g, x, y + h - 8, x + w, y + h - 8, '#9aa0a8', 3); g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); break;
    }
    case 'cage': {
      g.fillStyle = 'rgba(20,24,28,.9)'; g.fillRect(x, y, w, h); for (let i = 0; i < 6; i++) { g.fillStyle = '#3a3e44'; g.fillRect(x + 10 + i * 38, y + 12, 8, h - 24); g.fillStyle = '#6a5a3a'; g.fillRect(x + 10 + i * 38, y + 14, 8, 12); }
      g.strokeStyle = 'rgba(230,190,40,.7)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      g.strokeStyle = 'rgba(160,170,180,.5)'; g.lineWidth = 1; for (let i = 0; i < w; i += 9) lineTo2(g, x + i, y, x + i, y + h, 'rgba(160,170,180,.28)'); break;
    }
    case 'desk': {
      g.fillStyle = '#8a6a44'; rrect(g, x, y, w, h, 2); g.fill(); g.fillStyle = '#a58660'; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let i = 0; i < Math.floor(w / 26); i++) { g.fillStyle = choose(['#e8e4da', '#3a4a5a', '#c0392b', '#2a4a8a'], sr(i)); g.fillRect(x + 6 + i * 26, y + 5, 16, 11); }
      g.fillStyle = '#3a4a68'; g.beginPath(); g.arc(x + w / 2, y + h + 6, 6, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'container': {
      g.fillStyle = o.col || '#8a3a2a'; g.fillRect(x, y, w, h); for (let i = 3; i < w; i += 6) lineTo2(g, x + i, y, x + i, y + h, 'rgba(0,0,0,.28)');
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, w, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + h - 4, w, 4);
      g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); lineTo2(g, x + w - 8, y, x + w - 8, y + h, 'rgba(0,0,0,.5)', 3); break;
    }
    case 'sandbag': {
      for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w / 14); i++) { g.fillStyle = choose(['#b8a272', '#a89264', '#c4ae80'], sr(i + j * 9)); g.beginPath(); g.ellipse(x + 8 + i * 14 + (j ? 7 : 0), y + 5 + j * 6, 8, 5, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,45,20,.5)'; g.stroke(); } break;
    }
    case 'tent': {
      g.fillStyle = '#5a6a3a'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w, y + h); g.lineTo(x + w / 2, y + h); g.closePath(); g.fill();
      lineTo2(g, x + w / 2, y, x + w / 2, y + h, 'rgba(0,0,0,.4)', 2); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.strokeRect(x + .5, y + .5, w, h); break;
    }
    case 'tower': {
      g.fillStyle = '#6a5a3a'; g.fillRect(x, y, w, h); g.fillStyle = '#8a7650'; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = '#3a3a3a'; g.fillRect(x + 12, y + 12, w - 24, w - 24);
      g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); break;
    }
    case 'luggage': {
      for (let i = 0; i < 2; i++) { const bx = x + i * 20, by = y + (i ? 4 : 0), bw = 22, bh = 22 - i * 4; g.fillStyle = choose(['#2a4a8a', '#c0392b', '#26282c', '#3a6a4a', '#a06a2a', '#7a3a8a'], sr(i + 3)); rrect(g, bx, by, bw, bh, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx + 3, by + 3, bw - 6, 3); lineTo2(g, bx + 5, by + bh / 2, bx + bw - 5, by + bh / 2, 'rgba(0,0,0,.35)'); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1; rrect(g, bx, by, bw, bh, 3); g.stroke(); } break;
    }
    case 'carousel': {
      g.fillStyle = '#26282c'; rrect(g, x, y, w, h, h / 2); g.fill(); g.fillStyle = '#4a4e56'; rrect(g, x + 8, y + 8, w - 16, h - 16, (h - 16) / 2); g.fill();
      for (let i = 0; i < w - 20; i += 12) lineTo2(g, x + 10 + i, y + 9, x + 10 + i, y + h - 9, 'rgba(255,255,255,.12)', 2);
      for (let i = 0; i < 3; i++) { g.fillStyle = choose(['#2a4a8a', '#c0392b', '#a06a2a'], i / 3); g.fillRect(x + 30 + i * 52, y + h / 2 - 7, 24, 14); }
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; rrect(g, x, y, w, h, h / 2); g.stroke(); break;
    }
    case 'benchrow': {
      g.fillStyle = '#5a5e66'; g.fillRect(x, y + h - 6, w, 4); for (let i = 0; i < Math.floor(w / 24); i++) { g.fillStyle = choose(['#3a5a8a', '#4a4e56'], sr(i)); rrect(g, x + 3 + i * 24, y, 20, h - 4, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 5 + i * 24, y + 2, 16, 3); } break;
    }
    case 'bench': {
      g.fillStyle = '#6a4a2a'; g.fillRect(x + 2, y + 2, w - 4, h - 4); for (let i = 0; i < 3; i++) lineTo2(g, x + 2, y + 4 + i * 3, x + w - 2, y + 4 + i * 3, 'rgba(0,0,0,.35)'); g.fillStyle = '#3a3e44'; g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h); break;
    }
    case 'boat': {
      g.fillStyle = '#7a5a34'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); g.fill(); g.fillStyle = '#4a3820'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 5, h / 2 - 4, 0, 0, 7); g.fill();
      lineTo2(g, x + w * .35, y + 2, x + w * .35, y + h - 2, '#8a6a44', 2); lineTo2(g, x + w * .65, y + 2, x + w * .65, y + h - 2, '#8a6a44', 2); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); g.stroke(); break;
    }
    case 'water': {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2e5a72'); gr.addColorStop(.5, '#3a7088'); gr.addColorStop(1, '#264a60'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let i = 0; i < w / 18; i++) { g.strokeStyle = 'rgba(200,235,250,.16)'; g.lineWidth = 1; g.beginPath(); const rx = x + sr(i) * w, ry = y + 8 + sr(i + 40) * (h - 16); g.moveTo(rx, ry); g.quadraticCurveTo(rx + 6, ry - 3, rx + 14, ry); g.stroke(); }
      g.fillStyle = 'rgba(140,150,160,.9)'; g.fillRect(x, y - 2, w, 4); g.fillRect(x, y + h - 2, w, 4); break;
    }
    case 'house': drawHouseTop(g, o); break;
    case 'rubble': {
      for (let i = 0; i < 14; i++) { g.fillStyle = choose(['#6a6a66', '#8a8a84', '#58585a', '#7a6a58'], sr(i)); g.beginPath(); const cx = x + sr(i + 20) * w, cy = y + sr(i + 40) * h, r = 4 + sr(i + 60) * 8; for (let a = 0; a < 6; a++) { const an = a * 1.05 + sr(i + a), rr2 = r * (.6 + sr(a + i * 3) * .5); a ? g.lineTo(cx + Math.cos(an) * rr2, cy + Math.sin(an) * rr2) : g.moveTo(cx + Math.cos(an) * rr2, cy + Math.sin(an) * rr2); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke(); }
      break;
    }
    case 'tree': {
      const cx = x + 7, cy = y + 7; g.fillStyle = '#4a3320'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
      for (const [bx, by, rr2] of [[0, 0, 30], [-14, -8, 22], [14, -6, 22], [-6, 12, 20], [10, 12, 20]]) {
        const gr = g.createRadialGradient(cx + bx - 6, cy + by - 6, 3, cx + bx, cy + by, rr2); gr.addColorStop(0, '#6fa446'); gr.addColorStop(.6, '#3d7a2c'); gr.addColorStop(1, 'rgba(29,74,28,.85)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx + bx, cy + by, rr2, 0, 7); g.fill();
      }
      break;
    }
  }
}
const choose = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

function drawCarTop(g, x, y, w, h, col, burnt, seed, shiny, veh, military) {
  g.save(); g.translate(x + w / 2, y + h / 2); if ((seed || 0) > .5) g.scale(-1, 1); const hw = w / 2, hh = h / 2;
  g.fillStyle = '#0c0c0c'; for (const [wx, wy] of [[-hw + 6, -hh - 1], [hw - 16, -hh - 1], [-hw + 6, hh - 3], [hw - 16, hh - 3]]) g.fillRect(wx, wy, 10, 4);   // wheels
  rrect(g, -hw, -hh, w, h, 7); g.fillStyle = burnt ? '#2e2a28' : col; g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.stroke();
  if (burnt) { g.fillStyle = 'rgba(140,70,30,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rand(-hw + 6, hw - 6), rand(-hh + 4, hh - 4), rand(3, 9), rand(2, 5), 0, 0, 7); g.fill(); } }
  else { const gr = g.createLinearGradient(0, -hh, 0, hh); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; rrect(g, -hw, -hh, w, h, 7); g.fill(); }
  g.fillStyle = burnt ? '#14110f' : '#1f2a34'; g.beginPath(); g.moveTo(hw - 15, -hh + 3); g.lineTo(hw - 20, -hh + 6); g.lineTo(hw - 20, hh - 6); g.lineTo(hw - 15, hh - 3); g.closePath(); g.fill();      // windscreen
  g.fillRect(-hw + 6, -hh + 5, 8, h - 10);                                                                                                           // rear window
  g.fillStyle = burnt ? '#3a3430' : col; rrect(g, -hw + 15, -hh + 4, w - 36, h - 8, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-hw + 17, -hh + 5, w - 40, 3);   // roof
  if (shiny) { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(hw - 28, -hh + 5, 6, 3); }
  const vk = (veh || '').replace('ev_', '');
  if (vk === 'pickup') { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-hw + 3, -hh + 3, w * .36, h - 6); g.strokeStyle = 'rgba(255,255,255,.2)'; g.strokeRect(-hw + 3.5, -hh + 3.5, w * .36, h - 7); }
  if (vk === 'van') { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-hw + 6, -hh + 4, w - 26, h - 8); }
  if (vk === 'truck') { g.fillStyle = military ? '#4a5a30' : '#e4e4e4'; g.fillRect(-hw + 3, -hh + 3, w * .55, h - 6); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(-hw + 3.5, -hh + 3.5, w * .55, h - 7); }
  if ((veh || '').startsWith('ev_')) { g.fillStyle = '#3fd6a8'; g.fillRect(-hw + 4, -1.5, w - 14, 3); g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(1, -6); g.lineTo(-3, 1); g.lineTo(0, 1); g.lineTo(-1, 6); g.lineTo(3, -1); g.lineTo(0, -1); g.closePath(); g.fill(); }
  g.fillStyle = '#ffe9a0'; g.fillRect(hw - 3, -hh + 2, 3, 5); g.fillRect(hw - 3, hh - 7, 3, 5); g.fillStyle = '#b02222'; g.fillRect(-hw, -hh + 2, 3, 5); g.fillRect(-hw, hh - 7, 3, 5);
  g.restore();
}

function drawHouseTop(g, o) {
  const { x, y, w, h } = o, horiz = w >= h, tex = TEX[o.tex] || '#8a3a2a', s = o.seed || 0;
  g.fillStyle = '#b5ad9c'; g.fillRect(x - 3, y - 3, w + 6, h + 6);                                         // walls / eaves
  g.fillStyle = tex; g.fillRect(x, y, w, h);
  const half = horiz ? [[x, y, w, h / 2], [x, y + h / 2, w, h / 2]] : [[x, y, w / 2, h], [x + w / 2, y, w / 2, h]];
  g.fillStyle = 'rgba(255,235,190,.14)'; g.fillRect(...half[0]); g.fillStyle = 'rgba(0,0,0,.26)'; g.fillRect(...half[1]);
  if (horiz) { lineTo2(g, x, y + h / 2, x + w, y + h / 2, 'rgba(0,0,0,.55)', 3); for (let i = 1; i < w / 9; i++) { lineTo2(g, x + i * 9, y, x + i * 9, y + h / 2 - 1, 'rgba(0,0,0,.14)'); lineTo2(g, x + i * 9, y + h / 2 + 1, x + i * 9, y + h, 'rgba(0,0,0,.14)'); } }
  else { lineTo2(g, x + w / 2, y, x + w / 2, y + h, 'rgba(0,0,0,.55)', 3); for (let i = 1; i < h / 9; i++) { lineTo2(g, x, y + i * 9, x + w / 2 - 1, y + i * 9, 'rgba(0,0,0,.14)'); lineTo2(g, x + w / 2 + 1, y + i * 9, x + w, y + i * 9, 'rgba(0,0,0,.14)'); } }
  g.fillStyle = '#6a5a50'; g.fillRect(x + w * .7, y + h * .2, 9, 9); g.fillStyle = '#2a2420'; g.fillRect(x + w * .7 + 2, y + h * .2 + 2, 5, 5);   // chimney
  if (o.dmg) {   // collapsed roof section showing dark rooms and beams
    const hx = x + w * (.15 + (s * 7 % .3)), hy = y + h * .2, hw2 = w * .32, hh2 = h * .55;
    g.fillStyle = '#1a1512'; g.beginPath(); g.moveTo(hx, hy + 6); g.lineTo(hx + hw2 * .5, hy); g.lineTo(hx + hw2, hy + 10); g.lineTo(hx + hw2 - 6, hy + hh2); g.lineTo(hx + 8, hy + hh2 - 4); g.closePath(); g.fill();
    for (let i = 0; i < 4; i++) lineTo2(g, hx + 4 + i * hw2 / 4, hy + 4, hx + 10 + i * hw2 / 4, hy + hh2 - 4, '#6a4a2a', 3);
    g.fillStyle = 'rgba(80,70,60,.7)'; for (let i = 0; i < 8; i++) g.fillRect(hx + rand(-8, hw2 + 8), hy + rand(-6, hh2 + 6), rand(3, 7), rand(2, 5));
  }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.strokeRect(x - 3, y - 3, w + 6, h + 6);
}

