// Dynamic drawing for a site: decals, crates, characters, the per-frame scene, lighting and effects.
// ------------------------------------------------------------------ decals + dynamic sprites
function siteDecal(m, x, y, kind) {
  const g = m.fctx; if (!g) return; m.floorDirty = true;
  const cols = { z: ['rgba(34,48,16,.7)', 'rgba(56,80,24,.55)'], h: ['rgba(90,10,10,.7)', 'rgba(140,20,20,.5)'], burn: ['rgba(10,10,10,.5)', 'rgba(40,20,10,.4)'] }[kind] || ['rgba(0,0,0,.4)'];
  const n = kind === 'z' ? 4 : 3;
  for (let i = 0; i < n; i++) { g.fillStyle = choose(cols, Math.random()); g.beginPath(); g.ellipse(x + rand(-10, 10), y + rand(-8, 8), rand(3, 10), rand(2, 7), rand(0, 3), 0, 7); g.fill(); }
  for (let i = 0; i < 4; i++) { g.fillStyle = cols[0]; g.fillRect(x + rand(-22, 22), y + rand(-18, 18), rand(1, 3), rand(1, 3)); }
}

const CRATE_COL = { shells: '#ff7a5a', gear: '#d89aff', food: '#e8a33a', water: '#5aa8e8', ammo: '#b0b84a', meds: '#ff6a7a', scrap: '#c8c8d0', wood: '#d8b070', diesel: '#ff6a40', keys: '#7ab8ff', relay: '#6fe', card: '#6fe', drive: '#c8f' };
function drawCrate(g, c, t) {
  const rot = ((c.x * 7 + c.y * 3) % 40 - 20) * Math.PI / 180, k = c.keys ? 'keys' : c.k;
  g.save(); g.translate(c.x, c.y); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, 4, 12, 8, 0, 0, 7); g.fill();
  if (c.card || c.drive) {
    g.fillStyle = c.card ? '#1c2a32' : '#2a1c3a'; rrect(g, -9, -6, 18, 12, 2); g.fill(); g.strokeStyle = c.card ? '#6fe' : '#c8f'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = c.card ? '#6fe' : '#c8f'; g.fillRect(-7, -2, 14, 3); if (c.card) g.fillRect(-7, 3, 6, 2);
  } else if (c.relay) {
    g.fillStyle = '#1c2a32'; rrect(g, -9, -7, 18, 14, 3); g.fill(); g.strokeStyle = '#6fe'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#6fe'; g.fillRect(-6, -3, 5, 3); g.fillRect(1, -3, 5, 3); lineTo2(g, 4, -7, 8, -14, '#6fe', 1.5); g.beginPath(); g.arc(8, -14, 2, 0, 7); g.fill();
  } else if (c.keys) {
    g.strokeStyle = '#cfe4ff'; g.lineWidth = 3; g.beginPath(); g.arc(-4, 0, 6, 0, 7); g.stroke(); g.fillStyle = '#1a2a3a'; rrect(g, 3, -5, 12, 10, 3); g.fill(); g.strokeStyle = '#7ab8ff'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#7ab8ff'; g.fillRect(6, -2, 6, 4); lineTo2(g, 2, 0, -2, 0, '#cfe4ff', 2);
  } else if (k === 'gear') {
    const it = GEAR_BY_ID[c.g] || GEAR_ITEMS[0];
    if (it.slot === 'pack') { g.fillStyle = it.col; rrect(g, -8, -9, 16, 18, 5); g.fill(); g.fillStyle = 'rgba(0,0,0,.28)'; rrect(g, -8, -9, 16, 7, 4); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-5, 1, 10, 6); g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.2; rrect(g, -8, -9, 16, 18, 5); g.stroke(); lineTo2(g, -4, -9, -4, 9, 'rgba(0,0,0,.4)', 2); lineTo2(g, 4, -9, 4, 9, 'rgba(0,0,0,.4)', 2); }
    else if (it.slot === 'body') { g.fillStyle = it.col; g.fillRect(-7, -6, 14, 13); g.fillRect(-11, -6, 5, 12); g.fillRect(6, -6, 5, 12); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-2, -6, 4, 13); lineTo2(g, 0, -6, 0, 7, 'rgba(255,255,255,.5)', 1); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(-7.5, -6.5, 15, 14); }
    else if (it.slot === 'ranged') { const L = { pistol: 12, old_rifle: 22, shotgun: 24, smg: 16, hunting: 26, assault: 24 }[it.id] || 20; g.fillStyle = it.col; rrect(g, -L / 2, -2.5, L, 5, 1.5); g.fill(); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-L / 2, -2.5, Math.min(8, L * .35), 5); g.fillStyle = '#2a2c30'; g.fillRect(-L / 2 + L * .5, 1, 3, 5); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; rrect(g, -L / 2, -2.5, L, 5, 1.5); g.stroke(); }
    else if (it.slot === 'melee') { g.strokeStyle = it.col; g.lineWidth = it.id === 'axe' ? 3 : 4; g.beginPath(); g.moveTo(-11, 5); g.lineTo(11, -5); g.stroke(); if (it.id === 'axe') { g.fillStyle = '#c0c4c8'; g.beginPath(); g.moveTo(5, -8); g.lineTo(11, -2); g.lineTo(4, -2); g.closePath(); g.fill(); } if (it.id === 'machete') { g.strokeStyle = '#d8dce0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, 2); g.lineTo(12, -5); g.stroke(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-11, 5); g.lineTo(-3, 2); g.stroke(); } }
    else { for (const sx of [-5, 5]) { g.fillStyle = it.col; rrect(g, sx - 3.5, -8, 7, 14, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(sx - 3.5, 3, 7, 3); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; rrect(g, sx - 3.5, -8, 7, 14, 3); g.stroke(); } }
  } else if (c.drop) {
    g.fillStyle = '#8a4a22'; rrect(g, -9, -8, 18, 16, 4); g.fill(); g.fillStyle = '#6a3a18'; g.fillRect(-7, -2, 14, 6); g.strokeStyle = '#2a1a0a'; g.lineWidth = 1.5; rrect(g, -9, -8, 18, 16, 4); g.stroke(); lineTo2(g, -4, -8, -4, 8, '#3a2210', 2); lineTo2(g, 4, -8, 4, 8, '#3a2210', 2);
  } else if (k === 'food') {
    g.fillStyle = '#b8864a'; rrect(g, -10, -8, 20, 16, 2); g.fill(); g.fillStyle = '#d8c090'; g.fillRect(-2, -8, 4, 16); g.fillStyle = '#4a9a5a'; g.fillRect(-8, -5, 5, 6); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.strokeRect(-9.5, -7.5, 19, 15);
  } else if (k === 'water') {
    g.fillStyle = 'rgba(210,235,250,.75)'; rrect(g, -11, -8, 22, 16, 3); g.fill(); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = '#2a78c8'; g.beginPath(); g.arc(-6 + i * 6, -4 + j * 8, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-7 + i * 6, -5 + j * 8, 1.5, 1.5); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(-10.5, -7.5, 21, 15);
  } else if (k === 'shells') {
    g.fillStyle = '#7a2a1a'; rrect(g, -10, -7, 20, 14, 2); g.fill(); for (let i = 0; i < 4; i++) { g.fillStyle = '#d8b040'; g.fillRect(-7 + i * 4.5, -4, 3, 8); g.fillStyle = '#c0392b'; g.fillRect(-7 + i * 4.5, -4, 3, 5); } g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeRect(-9.5, -6.5, 19, 13);
  } else if (k === 'ammo') {
    g.fillStyle = '#4e5e32'; rrect(g, -11, -7, 22, 14, 2); g.fill(); g.fillStyle = '#d8d040'; g.fillRect(-7, -3, 8, 2); g.fillRect(-7, 1, 12, 2); g.fillStyle = '#2a3a1a'; g.fillRect(-4, -9, 8, 3); g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeRect(-10.5, -6.5, 21, 13);
  } else if (k === 'meds') {
    g.fillStyle = '#f2f4f6'; rrect(g, -10, -8, 20, 16, 3); g.fill(); g.fillStyle = '#e03a4a'; g.fillRect(-2, -6, 4, 12); g.fillRect(-6, -2, 12, 4); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(-9.5, -7.5, 19, 15);
  } else if (k === 'diesel') {
    g.fillStyle = '#c0392b'; rrect(g, -8, -9, 16, 18, 3); g.fill(); g.fillStyle = '#7a1a10'; g.fillRect(-5, -6, 10, 5); g.fillStyle = '#222'; g.beginPath(); g.arc(4, -6, 2.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-7, -8, 3, 14); g.strokeStyle = 'rgba(0,0,0,.5)'; rrect(g, -8, -9, 16, 18, 3); g.stroke();
  } else if (k === 'wood') {
    for (let i = 0; i < 3; i++) { g.fillStyle = choose(['#c9a064', '#b88a50', '#d8b078'], i / 3); g.fillRect(-11, -8 + i * 5.5, 22, 5); lineTo2(g, -9 + i * 3, -7 + i * 5.5, -3 + i * 3, -4 + i * 5.5, 'rgba(90,60,30,.5)'); g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(-11, -8 + i * 5.5, 22, 5); }
  } else {   // scrap
    for (let i = 0; i < 7; i++) { g.fillStyle = choose(['#9aa0a8', '#7a7e86', '#b0805a', '#c8c8d0'], i / 7); g.save(); g.translate(rand(-7, 7), rand(-5, 5)); g.rotate(rand(0, 6)); g.fillRect(-5, -2, rand(6, 11), rand(3, 5)); g.restore(); }
    g.fillStyle = '#6a6e76'; g.beginPath(); g.arc(-3, 2, 3, 0, 7); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(-3, 2, 1.2, 0, 7); g.fill();
  }
  g.restore();
  // pulsing marker ring so loot reads at a glance
  const col = k === 'gear' ? RARITY[(GEAR_BY_ID[c.g] || GEAR_ITEMS[0]).r].col : (CRATE_COL[k] || '#ffcc44'), pulse = .5 + .5 * Math.sin(t * 3 + c.x);
  g.strokeStyle = col; g.globalAlpha = .25 + .3 * pulse; g.lineWidth = 1.5; g.beginPath(); g.arc(c.x, c.y, 15 + pulse * 3, 0, 7); g.stroke(); g.globalAlpha = 1;
}

const SHIRTS = ['#55697a', '#7a4a4a', '#4a6a5a', '#7a7a4a', '#6a5a7a'];
function drawZombieTop(g, z, t, night) {
  const K = z.kind || (z.big ? 'brute' : 'walker');
  const s = K === 'mutant' ? 2.2 : K === 'brute' ? 1.5 : K === 'runner' ? .92 : K === 'spitter' ? 1.1 : K === 'armored' ? 1.12 : 1;
  const step = Math.sin((z.walk || 0) * (K === 'runner' ? 14 : 9) + (z.wob || 0)) * 3.2, a = z.a || 0, ph = z.wob || 0;
  const reach = z.state === 'chase' ? 15 : z.state === 'alert' ? 11 : 6;
  g.save(); g.translate(z.x, z.y);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, 3, 11 * s, 8 * s, 0, 0, 7); g.fill();
  g.rotate(a);
  g.fillStyle = K === 'armored' ? '#262a30' : '#2c3038'; g.beginPath(); g.ellipse(step, -3.5 * s, 4 * s, 2.6 * s, 0, 0, 7); g.ellipse(-step, 3.5 * s, 4 * s, 2.6 * s, 0, 0, 7); g.fill();
  const shirt = K === 'mutant' ? '#5a1f2f' : K === 'brute' ? '#4a3a32' : K === 'runner' ? '#8a8f78' : K === 'spitter' ? '#6a7a3a' : K === 'armored' ? '#3a424c' : SHIRTS[(z.vi || 0) % SHIRTS.length];
  if (K === 'spitter') { const gr = g.createRadialGradient(-6 * s, 0, 1, -6 * s, 0, 11 * s); gr.addColorStop(0, 'rgba(190,255,90,.9)'); gr.addColorStop(1, 'rgba(110,170,40,.0)'); g.fillStyle = gr; g.beginPath(); g.arc(-6 * s, 0, 11 * s, 0, 7); g.fill(); }
  g.fillStyle = shirt; g.beginPath(); g.ellipse(0, 0, (K === 'spitter' ? 10 : K === 'runner' ? 6.5 : 8) * s, (K === 'runner' ? 9.5 : 11) * s, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(-2 * s, 0, 4 * s, 9 * s, 0, 0, 7); g.fill();
  if (K === 'armored') { g.fillStyle = '#20252b'; g.fillRect(-4 * s, -9 * s, 8 * s, 18 * s); g.fillStyle = '#4a525c'; g.fillRect(-3 * s, -8 * s, 6 * s, 3 * s); g.fillRect(-3 * s, 5 * s, 6 * s, 3 * s); g.fillStyle = '#5a626c'; g.beginPath(); g.arc(0, -10 * s, 3.5 * s, 0, 7); g.arc(0, 10 * s, 3.5 * s, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(110,16,16,.65)'; g.beginPath(); g.ellipse(1 * s, 3 * s, 3 * s, 2.2 * s, .6, 0, 7); g.fill(); g.fillRect(-3 * s, -5 * s, 2 * s, 4 * s); }
  g.strokeStyle = K === 'runner' ? '#aab890' : '#7e9c68'; g.lineWidth = 3 * s; g.lineCap = 'round';
  const sw = Math.sin((z.walk || 0) * 5 + ph) * 2;
  g.beginPath(); g.moveTo(2 * s, -9 * s); g.lineTo(reach * s, (-6 + (reach < 10 ? -4 : 0)) * s + sw); g.moveTo(2 * s, 9 * s); g.lineTo(reach * s, (6 + (reach < 10 ? 4 : 0)) * s - sw); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = K === 'runner' ? '#aebc98' : K === 'spitter' ? '#a8b858' : '#8aa878'; g.beginPath(); g.arc(3 * s, 0, (K === 'spitter' ? 4.6 : 5.5) * s, 0, 7); g.fill();
  g.fillStyle = 'rgba(30,40,20,.55)'; g.beginPath(); g.arc(1 * s, 0, 4.2 * s, 1.2, 5.1); g.fill();
  if (K === 'armored') { g.fillStyle = '#2a2f36'; g.beginPath(); g.arc(3 * s, 0, 6.2 * s, 0, 7); g.fill(); g.fillStyle = '#10161c'; g.fillRect(4 * s, -3.5 * s, 3 * s, 7 * s); g.strokeStyle = '#6a727c'; g.lineWidth = 1; g.beginPath(); g.arc(3 * s, 0, 6.2 * s, 0, 7); g.stroke(); }
  else { g.fillStyle = '#2a2a1a'; g.beginPath(); g.arc(-1 * s, -1 * s, 3.4 * s, 2.2, 4.4); g.fill(); }
  if (z.hit > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(.7, z.hit * 6)})`; g.beginPath(); g.ellipse(0, 0, 9 * s, 12 * s, 0, 0, 7); g.fill(); }
  g.restore();
}
function drawPersonTop(g, p, a, t, opt) {   // player (opt.player) or gang member
  const step = Math.sin((p.walk || 0) * 10) * (opt.moving ? 4 : 0);
  g.save(); g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(2, 3, 12, 9, 0, 0, 7); g.fill();
  g.rotate(a); if (opt.sneak) g.scale(.9, .9);
  g.fillStyle = opt.bootCol || '#23262c'; g.beginPath(); g.ellipse(step, -4, 4.5, 3, 0, 0, 7); g.ellipse(-step, 4, 4.5, 3, 0, 0, 7); g.fill();
  const bag = opt.bag || .5; g.fillStyle = opt.packCol || (opt.player ? '#566a40' : '#5a4a3a'); rrect(g, -17 - bag * 4, -8, 11 + bag * 4, 16, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-15 - bag * 4, -1, 8 + bag * 4, 2);
  g.fillStyle = opt.coat; g.beginPath(); g.ellipse(0, 0, 8.5, 12.5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(-1, -3, 5, 7, 0, 0, 7); g.fill();
  g.strokeStyle = opt.coat; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(2, -9); g.lineTo(15, -4); g.moveTo(2, 9); g.lineTo(13, 3); g.stroke(); g.lineCap = 'butt';   // arms on the rifle
  g.fillStyle = '#e0c098'; g.beginPath(); g.arc(15, -4, 2.4, 0, 7); g.arc(13, 3, 2.4, 0, 7); g.fill();
  const wid = opt.weapon || 'old_rifle', WL = { pistol: 12, old_rifle: 24, shotgun: 27, smg: 17, hunting: 30, assault: 27 }[wid] || 24, wcol = (GEAR_BY_ID[wid] || {}).col || '#1e1f22';
  g.fillStyle = wcol; rrect(g, 5, -2.8, WL, 5, 1.5); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(5, -2.8, Math.min(8, WL * .35), 5); g.fillStyle = '#35373c'; g.fillRect(5 + WL * .55, -4, Math.min(6, WL * .25), 3);   // weapon
  g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(1, 0, 6, 0, 7); g.fill();
  g.fillStyle = opt.hat; g.beginPath(); g.arc(0, 0, 6.3, Math.PI * .55, Math.PI * 1.45); g.lineTo(2, 0); g.fill();
  if (opt.bandana) { g.fillStyle = '#c42a2a'; g.fillRect(-2, -6, 4, 12); }
  if (opt.player) { g.fillStyle = '#ffe48a'; g.fillRect(5, -1, 2.5, 2.5); }
  if (opt.flash > 0) { g.fillStyle = 'rgba(255,230,120,.95)'; g.beginPath(); const mx = 5 + WL; g.moveTo(mx, 0); g.lineTo(mx + 8, -3); g.lineTo(mx + 5, 0); g.lineTo(mx + 9, 4); g.lineTo(mx + 1, 2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,160,40,.6)'; g.beginPath(); g.arc(mx + 2, 0, 7, 0, 7); g.fill(); }
  g.restore();
}

// ------------------------------------------------------------------ per-frame scene
function siteDraw(m, town, t) {
  const L = gearLook();
  ctx.drawImage(m.floor, 0, 0);
  for (const c of m.crates) drawCrate(ctx, c, t);
  objDraw(m, t); hazDraw(m, t);
  for (const f of m.fires) drawFire(ctx, f, t);
  for (const a of m.acid) drawAcid(ctx, a, t);
  for (const r of m.rings) { const p = Math.min(1, r.t / .6); ctx.strokeStyle = `rgba(255,232,170,${(1 - p) * .32})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * p, 0, 7); ctx.stroke(); }
  // bullets
  for (const b of m.bullets) { const gr = ctx.createLinearGradient(b.x, b.y, b.x - b.vx * .05, b.y - b.vy * .05); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .05, b.y - b.vy * .05); ctx.stroke(); }
  for (const e of m.ebullets) { const gr = ctx.createLinearGradient(e.x, e.y, e.x - e.vx * .06, e.y - e.vy * .06); gr.addColorStop(0, 'rgba(255,150,60,1)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.vx * .06, e.y - e.vy * .06); ctx.stroke(); }
  // characters, back to front
  const act = [...m.zombies.map(z => ({ y: z.y, z })), ...m.humans.map(h => ({ y: h.y, h })), ...(m.npc && (m.npc.state === 'follow') ? [{ y: m.npc.y, n: m.npc }] : []), { y: m.p.y, p: true }].sort((a, b) => a.y - b.y);
  for (const e of act) {
    if (e.z) { drawZombieTop(ctx, e.z, t, m.night); if (e.z.burnT > 0) drawFlames(ctx, e.z.x, e.z.y - 4, 10, t, 2); }
    else if (e.n) drawPersonTop(ctx, e.n, e.n.a || 0, t, { coat: '#c0792b', hat: '#5a3a1a', moving: !!e.n.moving });
    else if (e.h) drawPersonTop(ctx, e.h, e.h.a, t, { coat: e.h.leader ? '#6a1a1a' : '#8a4a28', hat: '#2a2420', bandana: true, moving: !!e.h.moving, flash: e.h.flash || 0 });
    else drawPersonTop(ctx, m.p, m.p.a || 0, t, { player: true, weapon: m.wR.id, sneak: m.sneak, coat: L.coat, packCol: L.pack, bootCol: L.boot, hat: '#243444', moving: m.p.moving, flash: m.flashT, bag: Math.min(1, Object.values(m.carried).reduce((s, n) => s + n, 0) / m.cap) });
  }
  if (m.swing) {   // melee swing arc
    const p = 1 - m.swing.t / .2, a0 = m.swing.a - 1.0 + p * 2.0;
    ctx.strokeStyle = `rgba(255,255,255,${.5 * (1 - p)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(m.p.x, m.p.y, m.swing.reach, m.swing.a - 1.0, a0); ctx.stroke();
    ctx.strokeStyle = m.wM.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.p.x + Math.cos(a0) * 10, m.p.y + Math.sin(a0) * 10); ctx.lineTo(m.p.x + Math.cos(a0) * (m.swing.reach - 4), m.p.y + Math.sin(a0) * (m.swing.reach - 4)); ctx.stroke();
  }
  for (const sp of m.spits) { ctx.fillStyle = 'rgba(150,230,60,.9)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(210,255,120,.8)'; ctx.beginPath(); ctx.arc(sp.x - 1, sp.y - 1, 2, 0, 7); ctx.fill(); }
  for (const z of m.zombies) if (z.icoT > 0 && z.state !== 'idle') text2(ctx, z.state === 'chase' ? '!' : '?', z.x, z.y - 22, 16, z.state === 'chase' ? '#ff4a3a' : '#ffcf40');
  for (const h of m.humans) if (h.icoT > 0 && h.alert) text2(ctx, '!', h.x, h.y - 24, 16, '#ff4a3a');
  if (m.hot) { const c = m.hot.car, p = Math.min(1, m.hot.t / m.hot.need); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(c.x + c.w / 2 - 32, c.y - 16, 64, 9); ctx.fillStyle = c.alarm && m.hot.t > .3 ? '#ff5a3a' : '#7ab8ff'; ctx.fillRect(c.x + c.w / 2 - 31, c.y - 15, 62 * p, 7); ctx.strokeStyle = '#fff'; ctx.strokeRect(c.x + c.w / 2 - 32.5, c.y - 16.5, 65, 10); }
  if (m.nearCar && !m.hot) text2(ctx, `HOLD E: hotwire ${VEHICLE_TYPES[m.nearCar.veh].label}${m.nearCar.alarm ? '' : ''}`, m.nearCar.x + m.nearCar.w / 2, m.nearCar.y - 10, 11, '#bfe0ff');
  for (const b of m.blasts) drawBlast(ctx, b);
  for (const o of m.thrown) drawThrown(ctx, o, t);
  for (const p of m.parts) { ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x - 1, p.y - 1, 3, 3); }
  ctx.globalAlpha = 1;
  siteLighting(m, t);
}

function siteLighting(m, t) {
  const p = m.p, a = p.a || 0;
  if (m.night) {
    if (!m.dk) { m.dk = document.createElement('canvas'); m.dk.width = W; m.dk.height = H; }
    const d = m.dk.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(2,5,20,.86)'; d.fillRect(0, 36, W, H - 36);
    d.globalCompositeOperation = 'destination-out';
    let gr = d.createRadialGradient(p.x, p.y, 8, p.x, p.y, 105); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.beginPath(); d.arc(p.x, p.y, 105, 0, 7); d.fill();
    gr = d.createRadialGradient(p.x, p.y, 10, p.x, p.y, 380); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.7, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = gr; d.beginPath(); d.moveTo(p.x, p.y); d.arc(p.x, p.y, 380, a - .4, a + .4); d.closePath(); d.fill();
    const pool = (x, y, r, al) => { const g2 = d.createRadialGradient(x, y, 2, x, y, r); g2.addColorStop(0, `rgba(0,0,0,${al})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g2; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill(); };
    if (m.flashT > 0) pool(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, 150, .8);
    for (const h of m.humans) { pool(h.x, h.y, 70, .7); if (h.flash > 0) pool(h.x, h.y, 130, .8); }
    for (const e of m.ebullets) pool(e.x, e.y, 36, .6);
    for (const f of m.fires) pool(f.x, f.y, f.r * 2.6, .9);
    for (const b of m.blasts) pool(b.x, b.y, 220, 1);
    for (const a of m.acid) pool(a.x, a.y, 50, .5);
    for (const sp of m.spits) pool(sp.x, sp.y, 30, .6);
    for (const c of m.crates) pool(c.x, c.y, 26, .35);
    ctx.drawImage(m.dk, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    gr = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 380); gr.addColorStop(0, 'rgba(255,238,175,.2)'); gr.addColorStop(1, 'rgba(255,238,175,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, 380, a - .4, a + .4); ctx.closePath(); ctx.fill();
    for (const z of m.zombies) { const s = z.big ? 1.5 : 1, ex = z.x + Math.cos(z.a || 0) * 6 * s, ey = z.y + Math.sin(z.a || 0) * 6 * s, px = -Math.sin(z.a || 0) * 2.5 * s, py = Math.cos(z.a || 0) * 2.5 * s;
      for (const sg of [-1, 1]) { ctx.fillStyle = 'rgba(255,40,30,.95)'; ctx.beginPath(); ctx.arc(ex + px * sg, ey + py * sg, 1.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,40,30,.25)'; ctx.beginPath(); ctx.arc(ex + px * sg, ey + py * sg, 5 * s, 0, 7); ctx.fill(); } }
    for (const f of m.fires) { const fg = ctx.createRadialGradient(f.x, f.y, 6, f.x, f.y, f.r * 2.6); fg.addColorStop(0, 'rgba(255,140,40,.30)'); fg.addColorStop(1, 'rgba(255,110,20,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.6, 0, 7); ctx.fill(); }
    for (const c of m.crates) { ctx.strokeStyle = CRATE_COL[c.keys ? 'keys' : c.relay ? 'relay' : c.k] || '#fc4'; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, 7); ctx.stroke(); }
    ctx.restore();
  } else if (m.indoor) {   // flickering strip lights
    ctx.fillStyle = `rgba(20,30,40,${.12 + (Math.sin(t * 23) * Math.sin(t * 7.3) > .85 ? .12 : 0)})`; ctx.fillRect(0, 36, W, H - 36);
    for (let x = 140; x < W; x += 220) for (let y = 130; y < H; y += 150) { const g2 = ctx.createRadialGradient(x, y, 4, x, y, 120); g2.addColorStop(0, 'rgba(255,250,225,.10)'); g2.addColorStop(1, 'rgba(255,250,225,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 120, 0, 7); ctx.fill(); }
  } else { ctx.fillStyle = 'rgba(255,170,70,.05)'; ctx.fillRect(0, 36, W, H - 36); }
  // vignette + damage flash
  const vg = ctx.createRadialGradient(W / 2, H / 2 + 20, H * .35, W / 2, H / 2 + 20, H * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 36, W, H - 36);
  if (m.hurtT > 0) { const hv = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .85); hv.addColorStop(0, 'rgba(160,0,0,0)'); hv.addColorStop(1, `rgba(190,10,10,${Math.min(.6, m.hurtT * 2.2)})`); ctx.fillStyle = hv; ctx.fillRect(0, 36, W, H - 36); }
  // reticle
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, 7); ctx.moveTo(mouse.x - 15, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y); ctx.moveTo(mouse.x + 5, mouse.y); ctx.lineTo(mouse.x + 15, mouse.y); ctx.moveTo(mouse.x, mouse.y - 15); ctx.lineTo(mouse.x, mouse.y - 5); ctx.moveTo(mouse.x, mouse.y + 5); ctx.lineTo(mouse.x, mouse.y + 15); ctx.stroke();
}

// ------------------------------------------------------------------ fire, blasts, thrown items
function drawFlames(g, x, y, sz, t, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const ph = t * 11 + seed * 3 + i * 2.1, fh = sz * (1.1 + .5 * Math.sin(ph)), fw = sz * (.55 + .12 * Math.sin(ph * 1.3)), ox = (i - 1) * sz * .45;
    const gr = g.createLinearGradient(0, y, 0, y - fh); gr.addColorStop(0, 'rgba(255,200,60,.95)'); gr.addColorStop(.5, 'rgba(255,110,20,.85)'); gr.addColorStop(1, 'rgba(200,30,10,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + ox - fw, y); g.quadraticCurveTo(x + ox - fw * .2, y - fh * .5, x + ox + Math.sin(ph) * fw * .5, y - fh); g.quadraticCurveTo(x + ox + fw * .2, y - fh * .5, x + ox + fw, y); g.closePath(); g.fill();
  }
}
function drawFire(g, f, t) {   // a burning patch on the ground (f.l = seconds left)
  g.save(); g.globalAlpha = Math.min(1, f.l / 1.2);
  const gr = g.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r); gr.addColorStop(0, 'rgba(255,150,40,.45)'); gr.addColorStop(1, 'rgba(255,90,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const an = i * 2.4 + f.x * .1, rr = f.r * .62 * ((i % 3) + 1) / 3; drawFlames(g, f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * .8 + 4, f.r * .3, t, i); }
  g.restore();
}
function drawBlast(g, b) {
  const p = 1 - b.l / (b.d || .45), r = b.r * (.4 + p * .6);
  g.save(); g.globalAlpha = Math.max(0, 1 - p);
  const gr = g.createRadialGradient(b.x, b.y, 4, b.x, b.y, r); gr.addColorStop(0, 'rgba(255,240,170,.95)'); gr.addColorStop(.4, 'rgba(255,150,40,.7)'); gr.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,220,140,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r * p, 0, 7); g.stroke(); g.restore();
}
function drawThrown(g, o, t) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(o.x + 2, o.y + 3, 6, 3, 0, 0, 7); g.fill();
  g.save(); g.translate(o.x, o.y - o.h); g.rotate(t * 14);
  if (o.type === 'molotov') { g.fillStyle = '#3a8a52'; rrect(g, -3, -6, 6, 12, 2); g.fill(); g.fillStyle = '#e8d8b0'; g.fillRect(-1.5, -9, 3, 4); }
  else { g.fillStyle = '#6a6e76'; rrect(g, -7, -3, 14, 6, 2); g.fill(); g.fillStyle = '#2a2a2e'; g.fillRect(-7, -3, 3, 6); g.fillRect(4, -3, 3, 6); g.fillStyle = '#ffcf50'; g.fillRect(-1, -5, 2, 2); }
  g.restore();
  if (o.type === 'molotov') drawFlames(g, o.x, o.y - o.h - 6, 5, t, 1);
}

function drawAcid(g, a, t) {   // a puddle of acid (a.l = seconds left)
  g.save(); g.globalAlpha = Math.min(1, a.l / 1.2);
  const gr = g.createRadialGradient(a.x, a.y, 2, a.x, a.y, a.r); gr.addColorStop(0, 'rgba(180,255,70,.75)'); gr.addColorStop(.7, 'rgba(110,190,40,.5)'); gr.addColorStop(1, 'rgba(80,140,30,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(a.x, a.y, a.r, a.r * .8, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) { const an = i * 1.7 + t * .6, rr = a.r * .5; g.fillStyle = 'rgba(220,255,140,.7)'; g.beginPath(); g.arc(a.x + Math.cos(an) * rr, a.y + Math.sin(an) * rr * .8 - (Math.sin(t * 4 + i) * 1.5), 2 + (i % 2), 0, 7); g.fill(); }
  g.restore();
}
function siteClearCar(m, c) {   // a stolen car leaves an empty bay with an oil stain
  const g = m.fctx; m.floorDirty = true; g.fillStyle = TEX.asphalt; g.fillRect(c.x - 6, c.y - 8, c.w + 18, c.h + 18);
  g.fillStyle = 'rgba(20,20,30,.35)'; g.beginPath(); g.ellipse(c.x + c.w * .45, c.y + c.h * .55, c.w * .28, c.h * .3, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(c.x + c.w, c.y + 6); g.lineTo(c.x + c.w + 30, c.y + 12); g.moveTo(c.x + c.w, c.y + c.h - 6); g.lineTo(c.x + c.w + 30, c.y + c.h); g.stroke();
}

