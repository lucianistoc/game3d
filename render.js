// Procedural textures and scenery rendering for the base map.
// Everything is drawn in code (no image assets); textures are generated once at start-up.

const TEX = {};
let GROUND = null, NIGHT = false, DARK = 0;
const rnd = (() => { let s = 20240611; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const R = (a, b) => a + rnd() * (b - a);
const pick = a => a[(rnd() * a.length) | 0];

function mkTex(name, size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); fn(x, size);
  TEX[name] = x.createPattern(c, 'repeat');
}
function speckle(x, s, n, cols, a, b) {
  for (let i = 0; i < n; i++) { x.fillStyle = pick(cols); const z = R(a, b); x.fillRect(rnd() * s, rnd() * s, z, z); }
}
function tileRows(x, s, rows, tw, cols, gap) {   // roof tiles: staggered rows, each shaded top-to-bottom
  const rh = s / rows;
  for (let r = 0; r < rows; r++) for (let c = -1; c <= s / tw + 1; c++) {
    const ox = (r % 2) * tw / 2, tx = c * tw + ox, ty = r * rh, base = pick(cols);
    const g = x.createLinearGradient(0, ty, 0, ty + rh);
    g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
    x.fillStyle = base; x.fillRect(tx, ty, tw - gap, rh);
    x.fillStyle = g; x.fillRect(tx, ty, tw - gap, rh);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(tx + tw - gap, ty, gap, rh);
  }
}

function initTextures() {
  mkTex('plaster', 128, (x, s) => {
    x.fillStyle = '#a4a7a5'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '70,70,60'},.05)`; x.beginPath(); x.ellipse(rnd() * s, rnd() * s, R(8, 28), R(5, 14), R(0, 3), 0, 7); x.fill(); }
    speckle(x, s, 1700, ['rgba(255,255,255,.12)', 'rgba(0,0,0,.09)', 'rgba(110,110,100,.14)'], .7, 2);
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2;
    for (let i = 0; i < 22; i++) { x.beginPath(); x.arc(rnd() * s, rnd() * s, R(14, 40), R(0, 6), R(0, 6) + 1.2); x.stroke(); }
  });
  mkTex('brick', 64, (x, s) => {
    x.fillStyle = '#bdb2a0'; x.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) {
      x.fillStyle = pick(['#9c4630', '#a9503a', '#8f3f2c', '#b05a40', '#9a4a36']);
      x.fillRect(c * 16 + (r % 2) * 8 + 1, r * 8 + 1, 14, 6);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(c * 16 + (r % 2) * 8 + 1, r * 8 + 1, 14, 1);
    }
    speckle(x, s, 400, ['rgba(0,0,0,.14)', 'rgba(255,255,255,.08)'], .6, 1.6);
  });
  mkTex('tile', 64, (x, s) => { tileRows(x, s, 8, 10, ['#8f3b2a', '#843426', '#9a4430', '#7e3224'], 1); speckle(x, s, 300, ['rgba(0,0,0,.14)', 'rgba(255,200,150,.08)', 'rgba(70,95,45,.18)'], .8, 2); });
  mkTex('tile2', 64, (x, s) => { tileRows(x, s, 8, 10, ['#c8672f', '#bd5c28', '#d27438', '#b4561f'], 1); speckle(x, s, 300, ['rgba(0,0,0,.14)', 'rgba(255,220,170,.1)', 'rgba(90,110,50,.16)'], .8, 2); });
  mkTex('concrete', 128, (x, s) => {
    x.fillStyle = '#8c8f92'; x.fillRect(0, 0, s, s);
    speckle(x, s, 1800, ['rgba(255,255,255,.12)', 'rgba(0,0,0,.12)', 'rgba(90,90,85,.15)'], .7, 2);
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1;
    for (let i = 0; i < 3; i++) { x.beginPath(); let px = rnd() * s, py = rnd() * s; x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += R(-9, 9); py += R(2, 9); x.lineTo(px, py); } x.stroke(); }
  });
  mkTex('asphalt', 128, (x, s) => {
    x.fillStyle = '#313337'; x.fillRect(0, 0, s, s);
    speckle(x, s, 2600, ['rgba(255,255,255,.09)', 'rgba(0,0,0,.2)', 'rgba(160,160,170,.1)'], .7, 1.8);
  });
  mkTex('grass', 128, (x, s) => {
    x.fillStyle = '#69773b'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 20; i++) { x.fillStyle = rnd() < .5 ? 'rgba(70,125,50,.18)' : 'rgba(180,155,85,.16)'; x.beginPath(); x.ellipse(rnd() * s, rnd() * s, R(10, 30), R(6, 16), R(0, 3), 0, 7); x.fill(); }
    const cols = ['#587a30', '#8a8a42', '#4e6e2c', '#a39a4c', '#7a8a3a', '#6a8a38', '#b0a355'];
    for (let i = 0; i < 3000; i++) { x.strokeStyle = pick(cols); x.lineWidth = 1; const px = rnd() * s, py = rnd() * s; x.beginPath(); x.moveTo(px, py); x.lineTo(px + R(-1.8, 1.8), py - R(2, 6)); x.stroke(); }
  });
  mkTex('dirt', 128, (x, s) => {
    x.fillStyle = '#6c5439'; x.fillRect(0, 0, s, s);
    speckle(x, s, 1500, ['rgba(255,235,200,.12)', 'rgba(0,0,0,.18)', 'rgba(150,120,80,.2)'], .8, 2.4);
    for (let i = 0; i < 40; i++) { x.fillStyle = pick(['#8a7a68', '#756650', '#9a8a74']); x.beginPath(); x.ellipse(rnd() * s, rnd() * s, R(1, 3), R(.8, 2), R(0, 3), 0, 7); x.fill(); }
  });
  mkTex('gravel', 128, (x, s) => {
    x.fillStyle = '#85807a'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) { x.fillStyle = pick(['#a39e96', '#6c6862', '#928d84', '#b4afa6', '#77726b']); x.beginPath(); x.ellipse(rnd() * s, rnd() * s, R(1, 2.8), R(.8, 2), R(0, 3), 0, 7); x.fill(); }
  });
  mkTex('wood', 64, (x, s) => {
    x.fillStyle = '#7d5b35'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${rnd() < .5 ? '40,25,10' : '190,150,100'},${R(.08, .25)})`; x.lineWidth = R(.5, 1.5); const px = rnd() * s; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + R(-3, 3), s * .3, px + R(-3, 3), s * .7, px + R(-2, 2), s); x.stroke(); }
  });
}

// ---------- ground (one big world-space cache, drawn through the camera) ----------
const WORLD = { x0: -1300, y0: -520, x1: 1150, y1: 740 };
function diamond(g, gx, gy) {
  const [x, y] = iso(gx, gy);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + TW / 2, y + TH / 2); g.lineTo(x, y + TH); g.lineTo(x - TW / 2, y + TH / 2); g.closePath();
  return [x, y];
}
function buildGround() {
  const GS = 2, R0 = WORLD, w = R0.x1 - R0.x0, h = R0.y1 - R0.y0;
  const G = document.createElement('canvas'); G.width = w * GS; G.height = h * GS;
  const g = G.getContext('2d'); g.scale(GS, GS); g.translate(-R0.x0, -R0.y0);
  // far terrain: grass with big soft blotches
  g.fillStyle = TEX.grass; g.fillRect(R0.x0, R0.y0, w, h);
  g.fillStyle = 'rgba(40,70,30,.30)'; g.fillRect(R0.x0, R0.y0, w, h);
  for (let i = 0; i < 220; i++) { g.fillStyle = rnd() < .5 ? 'rgba(70,125,50,.12)' : 'rgba(180,155,85,.10)'; g.beginPath(); g.ellipse(R0.x0 + rnd() * w, R0.y0 + rnd() * h, R(40, 150), R(20, 80), R(0, 3), 0, 7); g.fill(); }
  // detailed tiles in and around the plot
  const M = 14, [pcx, pcy] = [GX / 2, GY / 2];
  for (let gy = -M; gy < GY + M; gy++) for (let gx = -M; gx < GX + M; gx++) {
    const inside = gx >= 0 && gx < GX && gy >= 0 && gy < GY, hv = hash(gx, gy), h2 = hash(gx + 9, gy - 4);
    const [x, y] = diamond(g, gx, gy);
    g.fillStyle = inside ? `rgba(${150 + hv * 40 | 0},${120 + hv * 30 | 0},60,${.10 + hv * .16})` : `rgba(30,70,30,${.06 + hv * .12})`; g.fill();
    const near = Math.max(0, 1 - Math.hypot(gx - 8, gy - 20) / 10);
    if (inside && h2 < .18 + near * .45) {   // trampled dirt around the house and gate
      g.save(); diamond(g, gx, gy); g.clip(); g.globalAlpha = .5 + near * .3; g.fillStyle = TEX.dirt;
      g.beginPath(); g.ellipse(x + R(-4, 4), y + TH / 2 + R(-2, 2), R(7, 14), R(4, 7), 0, 0, 7); g.fill(); g.restore();
    }
    if (!inside || hv > .3) for (let i = 0; i < 2; i++) {
      const tx = x + R(-TW / 3, TW / 3), ty = y + TH / 2 + R(-TH / 3, TH / 3);
      g.strokeStyle = pick(['#6a8a38', '#8a9a48', '#a39a4c']); g.lineWidth = .8;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 1.5, ty - 4); g.moveTo(tx, ty); g.lineTo(tx + .5, ty - 5); g.moveTo(tx, ty); g.lineTo(tx + 2, ty - 3); g.stroke();
      if (rnd() < .05) { g.fillStyle = pick(['#f4f0d0', '#e8d870', '#d890c0']); g.fillRect(tx, ty - 5, 1.6, 1.6); }
    }
  }
  // concrete path from gate to door, slab joints
  for (const [gx, gy] of PATH) {
    const [x, y] = diamond(g, gx, gy); g.fillStyle = TEX.concrete; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.30)'; g.lineWidth = .7; g.stroke();
    if (hash(gx, gy) < .25) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(x - 4, y + 5); g.lineTo(x + 5, y + 9); g.stroke(); }
  }
  for (let gx = 6; gx < 10; gx++) for (let gy = 24; gy < 26; gy++) { diamond(g, gx, gy); g.fillStyle = TEX.gravel; g.globalAlpha = .55; g.fill(); g.globalAlpha = 1; }
  // street along the south edge: sidewalk, curb, asphalt, dashed centre line
  const S0 = -70, S1 = GX + 70;
  const strip = (y0, y1, fill, stroke) => {
    g.beginPath(); [iso(S0, y0), iso(S1, y0), iso(S1, y1), iso(S0, y1)].forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath();
    g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  };
  strip(GY, GY + 1.8, TEX.concrete, '#555'); strip(GY + 1.8, GY + 2.0, '#6a6c70');
  strip(GY + 2.0, GY + 7.2, TEX.asphalt, '#222'); strip(GY + 7.2, GY + 7.4, '#6a6c70');
  for (let i = S0; i < S1; i += 4.4) { g.beginPath(); [iso(i, GY + 4.5), iso(i + 2.4, GY + 4.5), iso(i + 2.4, GY + 4.7), iso(i, GY + 4.7)].forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fillStyle = 'rgba(235,225,170,.8)'; g.fill(); }
  for (let i = S0; i < S1; i += 8) { g.beginPath(); [iso(i, GY + .2), iso(i + .08, GY + .2), iso(i + .08, GY + 1.8), iso(i, GY + 1.8)].forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill(); }
  // fog towards the edge of the world
  const [fx, fy] = iso(pcx, pcy), fg = g.createRadialGradient(fx, fy, 450, fx, fy, 1250);
  fg.addColorStop(0, 'rgba(5,10,5,0)'); fg.addColorStop(1, 'rgba(5,10,5,.9)'); g.fillStyle = fg; g.fillRect(R0.x0, R0.y0, w, h);
  GROUND = G;
}
function drawGround() { if (!GROUND) buildGround(); ctx.drawImage(GROUND, WORLD.x0, WORLD.y0, WORLD.x1 - WORLD.x0, WORLD.y1 - WORLD.y0); }

// ---------- scenery helpers ----------
function prism(x0, y0, x1, y1, z0, z1, col, topCol) { prismG(x0 * GSCALE, y0 * GSCALE, x1 * GSCALE, y1 * GSCALE, z0, z1, col, topCol); }   // old 3 m units
function prismG(x0, y0, x1, y1, z0, z1, col, topCol) {   // small coloured box in grid space
  const P = (gx, gy, z) => { const [x, y] = iso(gx, gy); return [x, y - z]; };
  poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], col);
  poly([P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], col);
  poly([P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], 'rgba(0,0,0,.3)');
  poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], topCol || col);
  poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], 'rgba(0,0,0,.12)');
}

function drawVehicle(gx, gy, v) {   // parked on the street; shape depends on the vehicle type
  const P = (x, y, z) => { const [sx, sy] = iso(x * GSCALE, y * GSCALE); return [sx, sy - z]; };
  const col = v.color || '#2f4a7a', T = VEHICLE_TYPES[v.type], t = v.type.replace('ev_', ''), wd = .62;
  const win = (x0, x1, z0, z1) => {
    poly([P(x0, gy + wd, z0), P(x1, gy + wd, z0), P(x1, gy + wd, z1), P(x0, gy + wd, z1)], '#27333f');
    poly([P(x0, gy + wd, z0), P(x0 + (x1 - x0) * .4, gy + wd, z0), P(x0 + (x1 - x0) * .4, gy + wd, z1), P(x0, gy + wd, z1)], 'rgba(255,255,255,.12)');
  };
  const wheel = wx => { const [x, y] = P(wx, gy + wd, 3); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x, y, 4.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#9a9aa0'; ctx.beginPath(); ctx.ellipse(x, y, 2, 1.8, 0, 0, 7); ctx.fill(); };
  let front = gx + 1.5, roofZ = 15;
  if (t === 'pickup') {
    prism(gx, gy, gx + 1.9, gy + wd, 3, 9, col, 'rgba(255,255,255,.12)'); prism(gx + 1.0, gy + .05, gx + 1.6, gy + wd - .05, 9, 15, col, col);
    win(gx + 1.03, gx + 1.57, 9.5, 14.5); prism(gx + .05, gy + .05, gx + .95, gy + wd - .05, 9, 10.5, '#262626', '#3a3a3a');
    wheel(gx + .35); wheel(gx + 1.55); front = gx + 1.9;
  } else if (t === 'van') {
    prism(gx, gy, gx + 2.0, gy + wd + .06, 3, 17, col, 'rgba(255,255,255,.18)'); win(gx + 1.55, gx + 1.95, 10, 16);
    poly([P(gx + .1, gy + wd + .06, 8), P(gx + 1.45, gy + wd + .06, 8), P(gx + 1.45, gy + wd + .06, 10), P(gx + .1, gy + wd + .06, 10)], 'rgba(255,255,255,.35)');
    wheel(gx + .4); wheel(gx + 1.6); front = gx + 2.0; roofZ = 17;
  } else if (t === 'truck') {
    prism(gx, gy, gx + 1.7, gy + wd + .1, 4, 21, '#e4e4e4', '#f4f4f4'); prism(gx + 1.75, gy + .02, gx + 2.5, gy + wd + .08, 3, 15, col, col);
    win(gx + 1.8, gx + 2.45, 9, 14); wheel(gx + .4); wheel(gx + 1.2); wheel(gx + 2.1); front = gx + 2.5; roofZ = 21;
  } else if (t === 'suv') {
    prism(gx, gy, gx + 1.7, gy + wd + .04, 3, 10, col, 'rgba(255,255,255,.12)'); prism(gx + .25, gy + .05, gx + 1.5, gy + wd - .02, 10, 17, col, col);
    win(gx + .3, gx + 1.45, 10.5, 16.5); wheel(gx + .35); wheel(gx + 1.4); front = gx + 1.7; roofZ = 17;
  } else {
    prism(gx, gy, gx + 1.5, gy + wd, 3, 9, col, 'rgba(255,255,255,.12)'); prism(gx + .35, gy + .06, gx + 1.15, gy + wd - .06, 9, 15, col, col);
    win(gx + .38, gx + 1.12, 9.5, 14.5); wheel(gx + .3); wheel(gx + 1.2);
  }
  const [hx, hy] = P(front, gy + .15, 6); ctx.fillStyle = NIGHT ? '#ffe9a0' : '#ddd'; ctx.fillRect(hx - 2, hy - 1, 4, 3);
  if (T.ev) {   // blue-green EV stripe, lightning bolt on the door, charge light on the roof
    const mx = gx + (front - gx) * .5;
    poly([P(gx + .05, gy + wd + .02, 5.5), P(front - .05, gy + wd + .02, 5.5), P(front - .05, gy + wd + .02, 6.8), P(gx + .05, gy + wd + .02, 6.8)], '#3fd6a8');
    const [bx, by] = P(mx, gy + wd + .03, 6); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(bx + 1.5, by - 5); ctx.lineTo(bx - 2, by + 0.5); ctx.lineTo(bx, by + 0.5); ctx.lineTo(bx - 1.5, by + 5); ctx.lineTo(bx + 2, by - 0.5); ctx.lineTo(bx, by - 0.5); ctx.closePath(); ctx.fill();
    const [lx, ly] = P(mx, gy + wd / 2, roofZ + 1.5), pct = (v.charge || 0) / T.batt;
    ctx.fillStyle = pct > .5 ? '#4f8' : pct > .2 ? '#fc4' : '#f55'; ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, 7); ctx.fill();
  }
}

function drawTree(gx, gy, sc = 1) {
  const [x, y] = iso(gx, gy), r = 17 * sc;
  const g = ctx.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, '#5a4128'); g.addColorStop(1, '#2e2012');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 2.5, y - 24 * sc); ctx.lineTo(x + 2.5, y - 24 * sc); ctx.lineTo(x + 4, y); ctx.fill();
  const blobs = [[0, -34, 1], [-11, -26, .8], [11, -27, .82], [-5, -42, .75], [7, -39, .7], [0, -26, .9]];
  for (const [bx, by, s] of blobs) {
    const cx = x + bx * sc, cy = y + by * sc, rr = r * s;
    const gr = ctx.createRadialGradient(cx - rr * .35, cy - rr * .4, rr * .1, cx, cy, rr);
    gr.addColorStop(0, '#6fa446'); gr.addColorStop(.55, '#3d7a2c'); gr.addColorStop(1, '#1d4a1c');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 26; i++) { const a = hash(gx * 7 + i, gy) * 6.28, d = hash(i, gx * 3 + gy) * r * 1.1; ctx.fillStyle = i % 3 ? 'rgba(150,210,90,.28)' : 'rgba(10,40,10,.3)'; ctx.fillRect(x + Math.cos(a) * d * 1.1 - 1, y - 33 * sc + Math.sin(a) * d * .9 - 1, 2.4, 2.4); }
}

function drawBush(gx, gy, sc = 1) {
  const [x, y] = iso(gx, gy);
  for (const [bx, by, s] of [[-7, -7, .8], [6, -6, .75], [0, -11, 1], [-2, -4, .9]]) {
    const cx = x + bx * sc, cy = y + by * sc, rr = 9 * s * sc;
    const gr = ctx.createRadialGradient(cx - rr * .3, cy - rr * .4, 1, cx, cy, rr);
    gr.addColorStop(0, '#c4c050'); gr.addColorStop(.6, '#8a9a38'); gr.addColorStop(1, '#4e6a24');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(240,235,120,.5)' : 'rgba(60,90,30,.4)'; ctx.fillRect(x + (hash(i, gx) - .5) * 24, y - 6 - hash(gy, i) * 14, 2, 2); }
}

function drawPile(gx, gy) {   // insulation boards + wheelbarrow, like beside the house in the photo
  const [x, y] = iso(gx, gy);
  for (let i = 0; i < 3; i++) {
    const bx = x - 9 + i * 7, by = y - 9 - i * 2;
    ctx.fillStyle = i % 2 ? '#e4e4ea' : '#f6f6f6'; ctx.fillRect(bx, by, 12, 8);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(bx + 8, by, 4, 8); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(bx, by, 12, 1.5);
    ctx.strokeStyle = '#999'; ctx.strokeRect(bx + .5, by + .5, 12, 8);
  }
  ctx.fillStyle = '#7a7a7a'; ctx.beginPath(); ctx.moveTo(x + 11, y - 6); ctx.lineTo(x + 24, y - 6); ctx.lineTo(x + 21, y); ctx.lineTo(x + 13, y); ctx.fill();
  ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x + 12, y - 6, 12, 2);
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 14, y + 2, 3, 0, 7); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(x + 22, y - 3); ctx.lineTo(x + 30, y + 3); ctx.stroke();
}

function drawCat(gx, gy, fur, t) {
  const [x, y] = iso(gx, gy);
  ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(x, y - 3, 5, 3, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 6, 2.6, 0, 7); ctx.fill();
  ctx.fillRect(x + 3.6, y - 10, 1.4, 2.4); ctx.fillRect(x + 5.6, y - 10, 1.4, 2.4);
  ctx.strokeStyle = fur; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.quadraticCurveTo(x - 9, y - 8 + Math.sin(t * 3) * 2, x - 7, y - 11); ctx.stroke();
}

function drawZombie(x, y, big, t, ph, scale, tint) {
  const s = scale || (big ? 1.5 : 1), bob = Math.sin(t * 6 + ph) * 1.2, sw = Math.sin(t * 6 + ph) * 3;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 3 * s, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 2.2 * s;                       // legs
  ctx.beginPath(); ctx.moveTo(x - 1.5 * s, y - 8 * s); ctx.lineTo(x - 2 * s + sw * .4, y); ctx.moveTo(x + 1.5 * s, y - 8 * s); ctx.lineTo(x + 2 * s - sw * .4, y); ctx.stroke();
  ctx.fillStyle = tint || (big ? '#5a3a2a' : pick2(ph)); ctx.fillRect(x - 3.5 * s, y - 17 * s + bob, 7 * s, 10 * s);   // torn clothes
  ctx.fillStyle = 'rgba(120,20,20,.55)'; ctx.fillRect(x - 2 * s, y - 13 * s + bob, 3 * s, 2.5 * s);
  ctx.strokeStyle = '#7a9a62'; ctx.lineWidth = 2 * s;                         // arms reaching out
  ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 15 * s + bob); ctx.lineTo(x - 7 * s, y - 13 * s + bob + sw * .3); ctx.moveTo(x + 3 * s, y - 15 * s + bob); ctx.lineTo(x + 7 * s, y - 13 * s + bob - sw * .3); ctx.stroke();
  ctx.fillStyle = '#86a66a'; ctx.beginPath(); ctx.arc(x, y - 20 * s + bob, 3.8 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff3030'; ctx.fillRect(x - 2 * s, y - 21 * s + bob, 1.4 * s, 1.4 * s); ctx.fillRect(x + .8 * s, y - 21 * s + bob, 1.4 * s, 1.4 * s);
}
function drawRaidZ(z, x, y, t) {   // raid attackers: the same body, told apart by size, colour and kit
  const ph = z.ph || 0, k = z.kind;
  if (k === 'runner') drawZombie(x, y, false, t * 1.8, ph, .86, '#8a4a3a');
  else if (k === 'spitter') { drawZombie(x, y, false, t, ph, 1, '#4a7a30'); ctx.fillStyle = 'rgba(150,230,60,.85)'; ctx.beginPath(); ctx.arc(x, y - 11, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(210,255,120,.7)'; ctx.beginPath(); ctx.arc(x - 1, y - 12, 1.2, 0, 7); ctx.fill(); }
  else if (k === 'armored') { drawZombie(x, y, false, t, ph, 1.05, '#4a4f56'); ctx.fillStyle = '#7a8088'; ctx.beginPath(); ctx.arc(x, y - 21.6, 4.4, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#5a6068'; ctx.fillRect(x - 4.5, y - 17, 9, 7); ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 1; ctx.strokeRect(x - 4.5, y - 17, 9, 7); }
  else drawZombie(x, y, !!z.big, t, ph);
  if (z.hitT > 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y - 12, 8, 0, 7); ctx.fill(); }
}
const pick2 = ph => ['#4a5a6a', '#6a4a4a', '#4a6a5a', '#6a6a4a'][Math.floor(ph * 10) % 4];

function drawPerson(x, y, c, t, i) {
  const sway = Math.sin(t * 2 + i) * .8, col = ROLES[c.role].color, hurtc = c.hp < 50;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2e3440'; ctx.fillRect(x - 2.5, y - 7, 2, 7); ctx.fillRect(x + .5, y - 7, 2, 7);
  ctx.fillStyle = col; ctx.fillRect(x - 3.5, y - 14 + sway, 7, 8);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x - 3.5, y - 14 + sway, 7, 1.5);
  ctx.fillStyle = hurtc ? '#d8a0a0' : '#e8c8a0'; ctx.beginPath(); ctx.arc(x, y - 17 + sway, 3.2, 0, 7); ctx.fill();
  ctx.fillStyle = ['#2a1a10', '#5a3a1a', '#c8a040', '#1a1a1a'][i % 4]; ctx.beginPath(); ctx.arc(x, y - 18.2 + sway, 3.3, Math.PI, 0); ctx.fill();
}

// ---------- shadows: drawn solid into an offscreen canvas, then composited once ----------
let SH = null;
function drawShadows(blds, trees, extra) {   // call in screen space; shadows are drawn solid into a screen-sized canvas through the camera, then composited once
  const sw = Math.ceil(W), sh = Math.ceil(H);
  if (!SH || SH.width !== sw || SH.height !== sh) { SH = document.createElement('canvas'); SH.width = sw; SH.height = sh; }
  const s = SH.getContext('2d'); s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, sw, sh);
  s.setTransform(CAM.z, 0, 0, CAM.z, W / 2 - CAM.x * CAM.z, H / 2 - CAM.y * CAM.z); s.fillStyle = '#000';
  const P = (gx, gy) => iso(gx, gy), dxy = h => [h * .85, h * .42];
  const quadPath = pts => { s.beginPath(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); s.fill(); };
  for (const b of blds) {
    if (b.t === 'fence' || b.t === 'gate' || b.t === 'floodlight' || b.t === 'wall') continue;
    const k = KINDS[b.t], h = k.hgt + (k.rh || 0) * .55, [ox, oy] = dxy(h);
    const F = [P(b.gx, b.gy), P(b.gx + b.w, b.gy), P(b.gx + b.w, b.gy + b.h), P(b.gx, b.gy + b.h)], S = F.map(([x, y]) => [x + ox, y + oy]);
    quadPath(F); quadPath(S); for (let i = 0; i < 4; i++) quadPath([F[i], F[(i + 1) % 4], S[(i + 1) % 4], S[i]]);
  }
  for (const [gx, gy, sc = 1] of trees) { const [x, y] = iso(gx, gy); s.beginPath(); s.ellipse(x + 20 * sc, y + 6 * sc, 24 * sc, 9 * sc, 0, 0, 7); s.fill(); }
  for (const [x, y, rx, ry] of extra) { s.beginPath(); s.ellipse(x, y, rx, ry, 0, 0, 7); s.fill(); }
  ctx.save(); ctx.globalAlpha = NIGHT ? .22 : .34; ctx.drawImage(SH, 0, 0, W, H); ctx.restore();
}

function drawRaider(x, y, t, ph) {   // armed survivor
  const bob = Math.sin(t * 5 + ph) * 1;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2f38'; ctx.fillRect(x - 3, y - 8, 2.4, 8); ctx.fillRect(x + .6, y - 8, 2.4, 8);
  ctx.fillStyle = '#6a2f26'; ctx.fillRect(x - 4, y - 17 + bob, 8, 10);                 // jacket
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + 2, y - 14 + bob, 10, 2.2);               // rifle
  ctx.fillStyle = '#d6b48e'; ctx.beginPath(); ctx.arc(x, y - 20 + bob, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#b02828'; ctx.fillRect(x - 3.8, y - 21.5 + bob, 7.6, 2);            // bandana
  if (NIGHT) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x + 10, y - 14, 1, x + 10, y - 14, 22); g.addColorStop(0, 'rgba(255,230,160,.5)'); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 10, y - 14, 22, 0, 7); ctx.fill(); ctx.restore(); }
}

// ---------- lighting (d = darkness 0..1 from the clock) ----------
function drawLighting(time, lights, glowSpots, d = 0, zoom = 1) {   // lights/glowSpots are in screen coordinates
  if (d > 0.03) {
    ctx.fillStyle = `rgba(6,12,38,${.52 * d})`; ctx.fillRect(0, 36, W, H - 36);
    if (d < 0.97) { ctx.fillStyle = `rgba(255,120,50,${Math.sin(Math.PI * d) * .16})`; ctx.fillRect(0, 36, W, H - 36); }   // dusk / dawn glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, R0, rgb, a) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, .5);
      const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, R0); gr.addColorStop(0, `rgba(${rgb},${a * d})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R0, 0, 7); ctx.fill(); ctx.restore();
    };
    for (const [x, y] of lights) glow(x, y, 7 * TW * .55 * zoom, '255,236,160', .42);
    for (const [x, y, R0, rgb, a] of glowSpots) glow(x, y, R0, rgb, a);
    ctx.restore();
  }
  if (d < 0.97) { ctx.fillStyle = `rgba(255,170,70,${.07 * (1 - d)})`; ctx.fillRect(0, 36, W, H - 36); }   // warm daylight tint
  const vg = ctx.createRadialGradient(W / 2 + 40, H / 2 + 20, H * .3, W / 2 + 40, H / 2 + 20, H * .95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 36, W, H - 36);
}
