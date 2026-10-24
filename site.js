// Detailed top-down rendering for scavenging sites (shops, warehouses, dealerships, ruined streets).
// The static scene (floor, furniture, walls) is painted once into an offscreen canvas per mission;
// blood decals are added to it as you fight. Characters, crates and lighting are drawn every frame.

const rrect = (g, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
};
const lineTo2 = (g, x0, y0, x1, y1, col, w = 1) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };

function initSiteTextures() {
  mkTex('stile', 128, (x, s) => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? '#c9cdc6' : '#dadcd4'; x.fillRect(c * 32, r * 32, 32, 32); }
    x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32 + .5, 0); x.lineTo(i * 32 + .5, s); x.stroke(); x.beginPath(); x.moveTo(0, i * 32 + .5); x.lineTo(s, i * 32 + .5); x.stroke(); }
    speckle(x, s, 1000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.14)', 'rgba(90,80,60,.1)'], .6, 1.8);
  });
  mkTex('wtile', 128, (x, s) => {
    x.fillStyle = '#e6eaec'; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(80,110,130,.28)'; x.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32 + .5, 0); x.lineTo(i * 32 + .5, s); x.stroke(); x.beginPath(); x.moveTo(0, i * 32 + .5); x.lineTo(s, i * 32 + .5); x.stroke(); }
    speckle(x, s, 700, ['rgba(60,90,110,.06)', 'rgba(255,255,255,.4)'], .6, 1.6);
  });
  mkTex('polished', 128, (x, s) => {
    x.fillStyle = '#8b8e92'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) { const g = x.createLinearGradient(0, rnd() * s, s, rnd() * s); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }
    speckle(x, s, 1500, ['rgba(0,0,0,.1)', 'rgba(255,255,255,.1)', 'rgba(70,70,70,.12)'], .6, 1.8);
  });
}

// ------------------------------------------------------------------ layout
function siteSetup(m, town) {
  const kind = town.type === 'spot' ? town.kind : (town.type === 'town' || town.type === 'city' ? 'ruins_town' : 'ruins_village');
  const indoor = ['store', 'hardware', 'outfitter', 'pharmacy', 'warehouse', 'pharma_wh', 'hospital', 'police', 'university', 'airport'].includes(kind), lot = kind.startsWith('dealer'), depot = kind === 'army' || kind === 'fuel' || kind === 'camp';
  m.theme = kind; m.indoor = indoor; m.fenced = lot || depot; m.walls = []; m.decor = []; m.flashT = 0; m.hurtT = 0; m.lastHp = m.p.hp;
  m.bounds = indoor ? { x0: 36, y0: 66, x1: W - 36, y1: H - 36 } : (lot || depot) ? { x0: 24, y0: 62, x1: W - 24, y1: H - 28 } : { x0: 12, y0: 48, x1: W - 12, y1: H - 12 };
  m.gaps = []; m.spawns = null; m.keyZone = null;
  const add = o => { if (Math.hypot(o.x + o.w / 2 - m.p.x, o.y + o.h / 2 - m.p.y) > 70 + Math.max(o.w, o.h) / 4) m.walls.push(o); };
  const SEG = (y, x0, x1, gapC, gapW, o) => { if (gapC - gapW / 2 - x0 > 30) add({ ...o, x: x0, y, w: gapC - gapW / 2 - x0 }); if (x1 - (gapC + gapW / 2) > 30) add({ ...o, x: gapC + gapW / 2, y, w: x1 - gapC - gapW / 2 }); };
  const shopRows = (rows, y0, step, style, h, extra) => { for (let r = 0; r < rows; r++) SEG(y0 + r * step, 60, W - 60, rand(220, 740), 100, { h, style, seed: Math.random(), ...extra }); };

  if (kind === 'store' || kind === 'hardware' || kind === 'outfitter') {
    m.p.x = W / 2; m.p.y = 490;
    m.gaps = [{ s: 'b', c: 480, w: 170 }, { s: 'l', c: 290, w: 84 }, { s: 'r', c: 215, w: 84 }, { s: 't', c: 130, w: 84 }];
    m.spawns = [{ x: 50, y: 290 }, { x: W - 50, y: 215 }, { x: 130, y: 76 }, { x: 480, y: H - 48 }];
    const hw = kind === 'hardware', of = kind === 'outfitter', OP = of ? { pal: ['#2a4a8a', '#c0392b', '#3a6a4a', '#e8e8e8', '#26282c', '#d9822b', '#8a5a3a', '#a070d0'] } : {};
    shopRows(4, 124, 84, hw ? 'rack' : 'shelf', hw ? 30 : 26, OP);
    if (!hw) for (let x = 200; x < W - 70; x += 124) add(of ? { x, y: 68, w: 116, h: 26, style: 'shelf', seed: x, ...OP } : { x, y: 68, w: 116, h: 26, style: 'fridge' });
    else { add({ x: 200, y: 70, w: 300, h: 28, style: 'lumber' }); add({ x: 560, y: 70, w: 160, h: 28, style: 'paint' }); }
    for (const x of [100, 215, 700, 815]) add({ x, y: 548, w: 92, h: 24, style: 'counter', seed: x });
    add({ x: 345, y: 560, w: 40, h: 24, style: 'cart' }); add({ x: 585, y: 556, w: 40, h: 26, style: 'cart' });
    if (hw) { add({ x: 760, y: 420, w: 110, h: 70, style: 'pallet', seed: 3 }); add({ x: 90, y: 430, w: 90, h: 60, style: 'pallet', seed: 5 }); }
  } else if (kind === 'pharmacy') {
    m.p.x = W / 2; m.p.y = 480;
    m.gaps = [{ s: 'b', c: 480, w: 150 }, { s: 'l', c: 300, w: 84 }];
    m.spawns = [{ x: 50, y: 300 }, { x: 480, y: H - 48 }, { x: W - 50, y: 420 }];
    SEG(86, 190, 780, 480, 130, { h: 38, style: 'counter', seed: 11 });
    shopRows(3, 182, 92, 'shelf', 26);
    for (let i = 0; i < 4; i++) add({ x: 70 + i * 34, y: 500, w: 26, h: 26, style: 'chair' });
    add({ x: 780, y: 480, w: 90, h: 50, style: 'rack', seed: 7 });
  } else if (kind === 'warehouse' || kind === 'pharma_wh') {
    const ph = kind === 'pharma_wh';
    m.p.x = W / 2; m.p.y = 520;
    m.gaps = [{ s: 't', c: 240, w: 110 }, { s: 't', c: 480, w: 110 }, { s: 't', c: 720, w: 110 }, { s: 'r', c: 420, w: 90 }, { s: 'b', c: 140, w: 70 }];
    m.spawns = [{ x: 240, y: 78 }, { x: 480, y: 78 }, { x: 720, y: 78 }, { x: W - 48, y: 420 }];
    const cols = ph ? 4 : 5;
    for (let c = 0; c < cols; c++) {
      const x = (ph ? 100 : 100) + c * (ph ? 190 : 165), gapC = rand(220, 420);
      const y0 = ph ? 190 : 110;
      if (gapC - 40 - y0 > 30) add({ x, y: y0, w: 46, h: gapC - 40 - y0, style: ph ? 'prack' : 'rack', seed: Math.random() });
      if (470 - (gapC + 40) > 30) add({ x, y: gapC + 40, w: 46, h: 470 - gapC - 40, style: ph ? 'prack' : 'rack', seed: Math.random() });
    }
    if (ph) add({ x: 600, y: 70, w: 250, h: 112, style: 'coldroom' });
    for (let i = 0; i < 6; i++) add({ x: rand(80, W - 140), y: rand(110, 470), w: 52, h: 52, style: 'pallet', seed: Math.random() });
    add({ x: rand(120, 780), y: rand(500, 540), w: 54, h: 30, style: 'forklift' });
  } else if (kind === 'hospital') {
    m.p.x = W / 2; m.p.y = 505;
    m.gaps = [{ s: 'b', c: 480, w: 170 }, { s: 'l', c: 300, w: 84 }, { s: 'r', c: 220, w: 84 }];
    m.spawns = [{ x: 50, y: 300 }, { x: W - 50, y: 225 }, { x: 480, y: H - 48 }];
    for (const y of [96, 252, 408]) for (let i = 0; i < 13; i++) { if (i % 4 === 3 && y !== 252) continue; if (Math.random() < .12) continue; add({ x: 64 + i * 66, y, w: 34, h: 60, style: 'bed', seed: Math.random() }); }
    for (let i = 0; i < 5; i++) add({ x: rand(100, W - 160), y: rand(172, 226), w: 58, h: 26, style: 'gurney', seed: Math.random() });
    add({ x: 90, y: 548, w: 150, h: 26, style: 'counter', seed: 4 }); add({ x: 720, y: 548, w: 150, h: 26, style: 'counter', seed: 6 });
    for (let x = 200; x < 760; x += 140) add({ x, y: 68, w: 118, h: 24, style: 'shelf', seed: x, pal: ['#ffffff', '#dfe9f2', '#e86a6a', '#9ad0a8', '#c8d8e8'] });
  } else if (kind === 'police') {
    m.p.x = W / 2; m.p.y = 548;
    m.gaps = [{ s: 'b', c: 480, w: 170 }, { s: 'l', c: 330, w: 84 }, { s: 'r', c: 260, w: 84 }];
    m.spawns = [{ x: 50, y: 330 }, { x: W - 50, y: 260 }, { x: 480, y: H - 48 }];
    SEG(470, 70, W - 70, 480, 170, { h: 36, style: 'counter', seed: 11 });
    for (let i = 0; i < 3; i++) add({ x: 70 + i * 116, y: 70, w: 106, h: 96, style: 'cell', seed: i });
    for (let i = 0; i < 6; i++) add({ x: 520 + i * 62, y: 68, w: 52, h: 26, style: 'locker', seed: i });
    add({ x: 650, y: 130, w: 240, h: 74, style: 'cage', seed: 3 });
    for (const [x, y] of [[150, 250], [330, 250], [150, 360], [330, 360], [560, 290], [740, 290]]) add({ x, y, w: 78, h: 34, style: 'desk', seed: x + y });
  } else if (kind === 'army') {
    m.p.x = W / 2; m.p.y = 515;
    m.gaps = [{ s: 'b', c: 480, w: 240 }, { s: 'l', c: 340, w: 80 }, { s: 'r', c: 340, w: 80 }];
    m.spawns = [{ x: 480, y: H - 40 }, { x: 36, y: 340 }, { x: W - 36, y: 340 }];
    const cc = ['#8a3a2a', '#2f5a8a', '#3a6a3a', '#7a6a2a'];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) { if (Math.random() < .15) continue; add({ x: 80 + c * 168 + rand(-6, 6), y: 100 + r * 70, w: 92, h: 38, style: 'container', col: cc[(r + c) % cc.length], seed: Math.random() }); }
    for (let i = 0; i < 4; i++) add({ x: 150 + i * 190, y: 290 + (i % 2) * 20, w: 84, h: 16, style: 'sandbag', seed: Math.random() });
    for (let i = 0; i < 3; i++) add({ x: 110 + i * 300, y: 400 + (i % 2) * 30, w: 86, h: 58, style: 'tent', seed: i });
    add({ x: 800, y: 270, w: 44, h: 44, style: 'tower' });
    for (let i = 0; i < 2; i++) add({ x: rand(120, 740), y: 470 + i * 40, w: 84, h: 32, style: 'car', col: '#5a6a3a', veh: 'truck', military: true, seed: Math.random() });
  } else if (kind === 'university') {
    m.p.x = W / 2; m.p.y = 495;
    m.gaps = [{ s: 'b', c: 480, w: 170 }, { s: 'l', c: 280, w: 84 }, { s: 'r', c: 230, w: 84 }];
    m.spawns = [{ x: 50, y: 280 }, { x: W - 50, y: 230 }, { x: 480, y: H - 48 }];
    for (let r = 0; r < 4; r++) SEG(150 + r * 84, 70, W - 70, rand(260, 700), 110, { h: 24, style: 'desk', seed: Math.random() });
    add({ x: 400, y: 80, w: 160, h: 34, style: 'counter', seed: 21 });
    for (const x of [80, 780]) add({ x, y: 78, w: 100, h: 40, style: 'shelf', seed: x, pal: ['#8a5a2a', '#2a4a8a', '#3a6a3a', '#c0392b', '#e8d8a0'] });
  } else if (kind === 'airport') {
    m.p.x = W / 2; m.p.y = 520;
    m.gaps = [{ s: 'b', c: 480, w: 300 }, { s: 'l', c: 320, w: 100 }, { s: 'r', c: 320, w: 100 }, { s: 't', c: 480, w: 160 }];
    m.spawns = [{ x: 50, y: 320 }, { x: W - 50, y: 320 }, { x: 480, y: 80 }, { x: 300, y: H - 48 }, { x: 680, y: H - 48 }];
    for (let i = 0; i < 6; i++) add({ x: 80 + i * 140, y: 100, w: 100, h: 28, style: 'counter', seed: i + 31 });
    for (const y of [220, 300]) for (let i = 0; i < 3; i++) add({ x: 100 + i * 280 + (y === 300 ? 60 : 0), y, w: 150, h: 24, style: 'benchrow', seed: Math.random() });
    for (let i = 0; i < 8; i++) add({ x: rand(80, W - 130), y: rand(350, 470), w: 44, h: 30, style: 'luggage', seed: Math.random() });
    add({ x: 90, y: 390, w: 210, h: 66, style: 'carousel' });
  } else if (kind === 'camp') {
    m.p.x = W / 2; m.p.y = 530;
    m.gaps = [{ s: 'b', c: 480, w: 220 }, { s: 'l', c: 330, w: 80 }, { s: 'r', c: 330, w: 80 }];
    m.spawns = [{ x: 480, y: H - 40 }, { x: 36, y: 330 }, { x: W - 36, y: 330 }];
    const cc = ['#6a2a1a', '#3a4a5a', '#5a5a2a', '#4a2a4a'];
    for (let c = 0; c < 4; c++) add({ x: 90 + c * 210, y: 80, w: 100, h: 40, style: 'container', col: cc[c % 4], seed: c });
    for (let i = 0; i < 5; i++) add({ x: 100 + i * 170 + rand(-10, 10), y: 250 + (i % 2) * 28, w: 96, h: 16, style: 'sandbag', seed: Math.random() });
    for (let i = 0; i < 4; i++) add({ x: 130 + i * 210, y: 150 + (i % 2) * 20, w: 88, h: 58, style: 'tent', seed: i });
    for (let i = 0; i < 3; i++) add({ x: rand(100, 760), y: 380 + i * 44, w: 76, h: 32, style: 'car', col: ['#5a2a2a', '#2a2a30', '#6a5a2a'][i], burnt: i === 1, veh: 'pickup', seed: Math.random() });
    add({ x: 820, y: 130, w: 44, h: 44, style: 'tower' });
  } else if (kind === 'fuel') {
    m.p.x = W / 2; m.p.y = 520;
    m.gaps = [{ s: 'b', c: 300, w: 200 }, { s: 'b', c: 700, w: 140 }, { s: 'l', c: 350, w: 80 }, { s: 'r', c: 400, w: 80 }];
    m.spawns = [{ x: 300, y: H - 40 }, { x: 700, y: H - 40 }, { x: 36, y: 350 }, { x: W - 36, y: 400 }];
    add({ x: 590, y: 62, w: 320, h: 112, style: 'showroom', sign: 'PETROM · SHOP' });
    for (const y of [236, 352]) for (let i = 0; i < 4; i++) add({ x: 110 + i * 110, y, w: 26, h: 54, style: 'pump', seed: i + y });
    add({ x: 90, y: 440, w: 70, h: 34, style: 'car', col: '#5a2a2a', burnt: true, veh: 'car', seed: 1 });
    add({ x: 760, y: 340, w: 88, h: 34, style: 'car', col: '#d8d8d8', veh: 'truck', seed: 2 });
    add({ x: 400, y: 236, w: 66, h: 30, style: 'car', col: '#2f4a7a', veh: 'car', seed: 3 });
    for (const [x, y] of [[560, 220], [620, 440], [880, 470]]) add({ x, y, w: 26, h: 22, style: 'pallet', seed: x });
    add({ x: 520, y: 236, w: 120, h: 22, style: 'bench', seed: 4 });
  } else if (kind === 'canal') {
    m.p.x = W / 2; m.p.y = 470;
    const wy = 290, wh = 80; let cx = 0;
    for (const [a, b] of [[200, 280], [640, 730]]) { add({ x: cx, y: wy, w: a - cx, h: wh, style: 'water' }); cx = b; }
    add({ x: cx, y: wy, w: W - cx, h: wh, style: 'water' });
    for (let i = 0; i < 6; i++) add({ x: rand(40, W - 80), y: i % 2 ? rand(222, 262) : rand(404, 440), w: 40, h: 14, style: 'bench', seed: Math.random() });
    for (let i = 0; i < 7; i++) add({ x: rand(40, W - 60), y: i % 2 ? rand(80, 200) : rand(470, 580), w: 14, h: 14, style: 'tree', seed: Math.random() });
    for (const bx of [60, 340, 470, 790]) add({ x: bx + rand(-10, 10), y: wy + 28, w: 62, h: 22, style: 'boat', seed: Math.random() });
  } else if (lot) {
    const cols = ['#2f4a7a', '#c9ccd0', '#7a2a2a', '#2a5a3a', '#d8d0b0', '#3a3a40', '#a05a1a', '#e8e8e8'];
    m.p.x = W / 2; m.p.y = 505;
    m.gaps = [{ s: 'b', c: 480, w: 240 }, { s: 'l', c: 360, w: 80 }, { s: 'r', c: 360, w: 80 }];
    m.spawns = [{ x: 480, y: H - 40 }, { x: 36, y: 360 }, { x: W - 36, y: 360 }];
    m.keyZone = { y1: 300 };
    add({ x: 130, y: 62, w: 700, h: 98, style: 'showroom' });
    for (const [row, y] of [[0, 214], [1, 330], [2, 446]]) for (let c = 0; c < 8; c++) {
      const x = 60 + c * 106 + rand(-4, 4);
      if (row === 2 && c > 1 && c < 6) continue;
      if (Math.random() < .88) { const v = pickFleet(town.fleet), dm = { car: [58, 28], pickup: [66, 28], van: [70, 30], truck: [86, 32], ev_car: [58, 28], ev_suv: [62, 30], ev_van: [70, 30] }[v] || [58, 28]; add({ x, y: y + rand(-3, 3), w: dm[0], h: dm[1], style: 'car', col: cols[Math.floor(Math.random() * cols.length)], shiny: true, veh: v, alarm: Math.random() < .3, seed: Math.random() }); }
    }
  } else if (kind === 'ruins_town') {
    m.p.x = W / 2; m.p.y = 345;
    const roadH = [300, 396], roadV = [430, 530];
    const hit = (o, list) => list.some(q => o.x < q.x + q.w + 14 && o.x + o.w + 14 > q.x && o.y < q.y + q.h + 14 && o.y + o.h + 14 > q.y);
    const quads = [[30, 56, 396, 296], [540, 56, 930, 296], [30, 410, 396, 626], [540, 410, 930, 626]];
    for (const [x0, y0, x1, y1] of quads) for (let i = 0; i < 6; i++) {
      const w = rand(90, 170), h = rand(70, 120), o = { x: rand(x0, x1 - w), y: rand(y0, y1 - h), w, h, style: 'house', seed: Math.random(), dmg: Math.random() < .5, tex: Math.random() < .5 ? 'tile' : 'tile2' };
      if (!hit(o, m.walls)) add(o);
    }
    for (let i = 0; i < 4; i++) add({ x: rand(40, W - 130), y: rand(300, 366), w: 56, h: 28, style: 'car', col: pick(['#3a3a3a', '#5a3a28', '#4a4a50']), burnt: true, seed: Math.random() });
    for (let i = 0; i < 5; i++) add({ x: rand(40, W - 100), y: rand(70, H - 100), w: rand(36, 62), h: rand(26, 42), style: 'rubble', seed: Math.random() });
  } else {   // ruins_village
    m.p.x = W / 2; m.p.y = H / 2 + 100;
    const hit = (o, list) => list.some(q => o.x < q.x + q.w + 18 && o.x + o.w + 18 > q.x && o.y < q.y + q.h + 18 && o.y + o.h + 18 > q.y);
    for (let i = 0; i < 7; i++) {
      const w = rand(80, 130), h = rand(60, 90), o = { x: rand(40, W - w - 40), y: rand(70, H - h - 60), w, h, style: 'house', seed: Math.random(), dmg: Math.random() < .45, tex: Math.random() < .6 ? 'tile2' : 'tile' };
      if (!hit(o, m.walls)) add(o);
    }
    for (let i = 0; i < 7; i++) { const o = { x: rand(40, W - 60), y: rand(70, H - 80), w: 14, h: 14, style: 'tree', seed: Math.random() }; if (!hit(o, m.walls)) add(o); }
    add({ x: rand(80, 400), y: rand(500, 560), w: 56, h: 28, style: 'car', col: '#5a3a28', burnt: true, seed: 1 });
  }
  buildSiteFloor(m);
}

