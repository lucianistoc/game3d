const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Logical size: the canvas fills the window. UI is laid out for 960x640 and scaled to fit, so wider windows
// (e.g. an ultrawide) simply get more room: W grows with the aspect ratio, H stays >= 640.
let W = 960, H = 640;
const UI = { scale: 1, dpr: 1, ox: 0, oy: 0, lw: 960, lh: 640 };
function applyLayout() {
  const cw = innerWidth, ch = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2), bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  const fit = Math.max(.6, Math.min(cw / 960, ch / 640)); UI.dpr = dpr; UI.scale = scene && scene.fixed ? fit : fit * SET.uiScale; UI.lw = cw / UI.scale; UI.lh = ch / UI.scale;
  const gl3 = !!(scene && scene.gl3d && R3D.ok); if (gl3 !== applyLayout.gl) { applyLayout.gl = gl3; R3D.show(gl3); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (gl3) ctx.clearRect(0, 0, canvas.width, canvas.height); else { ctx.fillStyle = '#030806'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (scene && scene.fixed) { W = 960; H = 640; UI.ox = (UI.lw - 960) / 2; UI.oy = (UI.lh - 640) / 2; }   // fixed-layout scenes sit centred on the screen
  else { W = UI.lw; H = UI.lh; UI.ox = UI.oy = 0; }
  const s = UI.scale * dpr; ctx.setTransform(s, 0, 0, s, UI.ox * s, UI.oy * s);
}

// ---------- input ----------
const keys = {};
const mouse = { x: 480, y: 320, cx: 0, cy: 0, down: false, btn: 0, touch: false };   // x, y: UI (or, in a 3D mission, stage) coordinates; cx, cy: client pixels
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
function mpos(e) {
  const r = canvas.getBoundingClientRect();
  mouse.cx = e.clientX; mouse.cy = e.clientY;
  mouse.x = (e.clientX - r.left) / UI.scale - UI.ox;
  mouse.y = (e.clientY - r.top) / UI.scale - UI.oy;
}
let btns = [];
canvas.addEventListener('pointermove', mpos);
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') TOUCH.on = true;
  mouse.touch = e.pointerType === 'touch';
  mpos(e); mouse.down = true; mouse.btn = e.button;
  if (e.button === 0) for (const b of btns) {
    if (mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) { sfx('click'); b.cb(); return; }
  }
  if (scene.click) scene.click();
});
// touch screens: every finger is tracked so the mission can use a stick and fire at the same time
const touchPts = new Map();
const tpos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / UI.scale - UI.ox, y: (e.clientY - r.top) / UI.scale - UI.oy }; };
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { const p = tpos(e); touchPts.set(e.pointerId, { ...p, sx: p.x, sy: p.y }); } }, true);
canvas.addEventListener('pointermove', e => { const t = touchPts.get(e.pointerId); if (t) Object.assign(t, tpos(e)); });
addEventListener('pointercancel', e => touchPts.delete(e.pointerId));
addEventListener('pointerup', e => { touchPts.delete(e.pointerId); mouse.down = touchPts.size > 0 && TOUCH.on ? mouse.down : false; if (scene && scene.up) scene.up(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { if (scene && scene.wheel) { e.preventDefault(); mpos(e); scene.wheel(e.deltaY < 0 ? 1.25 : 1 / 1.25, mouse.x, mouse.y); } }, { passive: false });

// ---------- helpers ----------
const GREEN = '#3f6', DIM = '#1c5a30', RED = '#f55', AMBER = '#fc4';
const rand = (a, b) => a + Math.random() * (b - a);
function text(s, x, y, size = 14, color = GREEN, align = 'left') {
  ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = align;
  const sb = ctx.shadowBlur, sc = ctx.shadowColor;
  if (!sb) { ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 3; }
  ctx.fillText(s, x, y);
  ctx.shadowBlur = sb; ctx.shadowColor = sc;
}
function button(label, x, y, w, h, cb, enabled = true) {
  const hover = enabled && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  ctx.fillStyle = hover ? '#0c3a1c' : '#07150d';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = enabled ? GREEN : '#244'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w, h);
  text(label, x + w / 2, y + h / 2 + 5, 13, enabled ? GREEN : '#355', 'center');
  if (enabled) btns.push({ x, y, w, h, cb });
}
const alive = () => save.crew.filter(c => c.hp > 0 && !c.away);   // present in the house
const living = () => save.crew.filter(c => c.hp > 0);             // present or away on an expedition
const has = role => alive().some(c => c.role === role);
const dayLoad = () => SOLAR.dayLoad + alive().length * SOLAR.perPerson + seasonOf().load;
function hurt(n, dmg) {   // injure n random living crew members
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = alive(); if (!a.length) break;
    const c = a[Math.floor(Math.random() * a.length)]; c.hp -= dmg; if (c.hp > 0) maybeInjure(c, dmg);
    if (c.hp <= 0) { crewDied(c, 'lost in a raid'); out.push(`${c.name} (${ROLES[c.role].label.toLowerCase()}) was lost`); }
  }
  return out;
}
// ---- day / night clock (hours; the night runs past 24 and dawn resets to 06:00) ----
const DAWN = 6, DUSK = 20;
const fmtClock = c => `${String(Math.floor(c % 24)).padStart(2, '0')}:${String(Math.floor((c % 1) * 60)).padStart(2, '0')}`;
const darkness = c => { c = ((c % 24) + 24) % 24; return c >= 20 || c < 5.5 ? 1 : c >= 17.5 ? (c - 17.5) / 2.5 : c < 7 ? (7 - c) / 1.5 : 0; };
const veh = () => save.vehicles[Math.min(save.vi, save.vehicles.length - 1)];
const tripSpeed = mode => mode === 'drive' && veh() ? VEHICLE_TYPES[veh().type].speed * condMul(veh()) : WALK.speed;   // km/h on real roads (x1.25 of crow-flies)
const tripHours = (t, mode) => 2 * kmBetween(t, HOME) * 1.25 / tripSpeed(mode) + 1;   // round trip + 1 h on site
const arriveClock = (t, mode) => save.clock + kmBetween(t, HOME) * 1.25 / tripSpeed(mode);
// ---- EVs: battery charge, V2L (vehicle-to-load) power for the house, fences and floodlights ----
const evs = () => save.vehicles.filter(v => VEHICLE_TYPES[v.type].ev);
const evReserve = v => VEHICLE_TYPES[v.type].batt * .15;                          // V2L never drains the last 15%
const v2lPool = () => evs().reduce((s, v) => v.v2l ? s + Math.max(0, v.charge - evReserve(v)) : s, 0);
const powerAvail = () => save.energy + v2lPool();
function useEnergy(kwh) {   // house battery first, then EVs with V2L on
  let need = kwh, a = Math.min(save.energy, need); save.energy -= a; need -= a;
  for (const v of evs()) { if (need <= 0) break; if (!v.v2l) continue; a = Math.min(need, Math.max(0, v.charge - evReserve(v))); v.charge -= a; need -= a; }
}
// ---- gear: what you wear changes what you can carry, how much damage you take and how fast you move ----
const gearStats = () => {
  let cap = 0, armor = 0, speed = 0;
  for (const [sl, id] of Object.entries(save.gear.eq)) { if (sl === 'ranged' || sl === 'melee') continue; const it = GEAR_BY_ID[id]; if (!it) continue; cap += it.cap || 0; armor += it.armor || 0; speed += it.speed || 0; }
  return { cap, armor: Math.min(.6, armor), speed };
};
const gearLook = () => { const e = save.gear.eq, c = id => (GEAR_BY_ID[id] || {}).col; return { coat: c(e.body) || '#3a6a9a', pack: c(e.pack), boot: c(e.boots) }; };
const cap = () => save.buildings.some(b => b.t === 'powerbox') ? SOLAR.cap : 0;
function drawHUD(noMenu) {
  ctx.fillStyle = '#07150d'; ctx.fillRect(0, 0, W, 34);
  ctx.strokeStyle = DIM; ctx.beginPath(); ctx.moveTo(0, 34.5); ctx.lineTo(W, 34.5); ctx.stroke();
  const r = save.res; let x = 10;
  const put = (s, col, size = 12) => { text(s, x, 22, size, col); x += ctx.measureText(s).width + 11; };   // text() sets ctx.font, so the measure is right
  put(`DAY ${save.day} ${seasonOf().name.slice(0, 3)}`, AMBER, 13); put(`SCRAP ${r.scrap}`, GREEN); put(`FOOD ${r.food}`, GREEN); put(`WATER ${r.water}`, '#6bd');
  put(`AMMO ${Math.floor(r.ammo)}${r.shells ? '+' + r.shells + 'sh' : ''}`, GREEN); put(`WOOD ${r.wood}`, GREEN); put(`DIESEL ${r.diesel}L`, '#fa5'); put(`MEDS ${r.meds}`, '#f8a');
  const c = cap(), e = Math.min(save.energy, c), bx = x + 2, bw = 110;
  ctx.fillStyle = '#1a2a10'; ctx.fillRect(bx, 10, bw, 14); ctx.fillStyle = e / (c || 1) < .25 ? RED : '#ec3'; ctx.fillRect(bx, 10, c ? bw * e / c : 0, 14);
  ctx.strokeStyle = '#8a7a20'; ctx.strokeRect(bx + .5, 10.5, bw, 14);
  text(c ? `${e.toFixed(1)}/${c} kWh` : 'NO BATTERY', bx + bw / 2, 21, 10, '#fff', 'center');
  { const ec = evs().reduce((s, v) => s + v.charge, 0), eb = evs().reduce((s, v) => s + VEHICLE_TYPES[v.type].batt, 0);
    if (eb) { ctx.fillStyle = '#10243a'; ctx.fillRect(bx, 27, bw, 4); ctx.fillStyle = '#4aa8ff'; ctx.fillRect(bx, 27, bw * ec / eb, 4); } }
  x = bx + bw + 12; { const aw = living().length - alive().length; put(`CREW ${alive().length}/${living().length}${aw ? ' (' + aw + ' out)' : ''}`, '#fff'); }
  { const dk = darkness(save.clock) > .5; ctx.fillStyle = dk ? '#bcd' : '#fd5'; ctx.beginPath(); ctx.arc(x + 4, 17, 5, 0, 7); ctx.fill();
    if (dk) { ctx.fillStyle = '#07150d'; ctx.beginPath(); ctx.arc(x + 6, 15, 4.5, 0, 7); ctx.fill(); }
    text(fmtClock(save.clock), x + 14, 22, 12, dk ? '#9bd' : AMBER); }
  text(`HP ${Math.max(0, Math.round(save.houseHp))}`, W - 12, 22, 13, save.houseHp < 40 ? RED : GREEN, 'right');
  if (!noMenu && scene !== menuScene) button('MENU', W - 122, 6, 54, 22, openMenu);
}

// ---------- persistent state ----------
const SAVE_VER = 13;
const fresh = (o = {}) => ({
  ver: SAVE_VER, day: 1, clock: 7, vehicles: [{ type: 'car', name: 'Family car', color: '#2f4a7a', hp: 100 }], vi: 0, houseHp: 100, energy: 24, weather: 'sunny',
  res: { scrap: 40, food: 10, ammo: 40, shells: 6, wood: 5, water: 15, diesel: 15, meds: 6 },
  gear: { eq: { pack: 'school', body: 'hoodie', boots: 'trainers', ranged: 'pistol', melee: 'crowbar' }, stash: ['old_rifle'] }, items: { molotov: 1, bomb: 0 }, upgrades: { suppressor: false },
  crew: CREW_START.map(c => crewInit({ ...c, hp: 100 })),
  buildings: START_BUILDINGS.map(b => ({ ...b })),
  rooms: {}, sites: {}, outposts: [], fname: 'Cărani Settlement', fx: [], event: null, trades: [], raidBoost: 0, won: false, wonSeen: false,
  fac: { farmers: { rep: 10 }, militia: { rep: 0 }, reapers: { rep: -20 }, scientists: { rep: 0 }, army: { rep: -5 } },
  pacts: {}, reapers: { state: 'hostile', until: 0 }, quests: [], research: {}, rp: 0,
  intel: [], warned: 0, intelEvent: null, priceTip: 0, goal: { ch: 0, parts: 0, found: {}, evac: 0 },
  stats: { trades: 0, kills: 0, zk: 0, expeds: 0, trips: 0, nights: 0, lostNights: 0, deaths: 0 },
  forecast: null, outAttack: [], posts: {}, funeralQ: [], log: [], fallen: [], tips: {}, playSec: 0, created: Date.now(), diff: o.diff || 'normal', scen: o.scen || 'standard', zmode: o.zmode || 'classic', season0: o.season0 == null ? 2 : o.season0, endingId: null, scoreRec: false,
});
function mergeDeep(d, s) {   // fill in anything an older save lacks, keeping what it has
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!plain(d) || !plain(s)) return s === undefined ? d : s;
  const o = { ...s }; for (const k in d) o[k] = k in s ? mergeDeep(d[k], s[k]) : d[k]; return o;
}
function upgradeSave(s) { const o = mergeDeep(fresh(), s); o.ver = SAVE_VER; o.crew.forEach(crewInit); o.vehicles.forEach(v => { if (v.hp == null) v.hp = 100; }); return o; }
let save = fresh(), curSlot = 0;
const slotKey = n => 'timisz_s' + n;
const readSlot = n => { try { const s = JSON.parse(localStorage.getItem(slotKey(n))); return s && s.ver >= 11 ? s : null; } catch { return null; } };
function loadSlot(n) { const s = readSlot(n); curSlot = n; save = s ? upgradeSave(s) : fresh(); cellsDirty = true; if (!save.forecast) planRaid(); }
try { const old = localStorage.getItem('timisz'); if (old && !localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), old); } catch {}   // older single-save games move into slot 1
const maxHp = b => b.t === 'fence' ? FENCE_LVL[b.lvl || 0].hp : b.t === 'gate' ? GATE_LVL[b.lvl || 0].hp : b.t === 'wall' ? WALL_LVL[b.lvl || 0].hp : (KINDS[b.t].hp || 60);
const TIERS = { fence: FENCE_LVL, gate: GATE_LVL, wall: WALL_LVL };
// cell -> building lookup (rebuilt whenever the building list changes)
const CELLS = new Map(); let cellsFor = null, cellsN = -1, cellsDirty = true;
function cellAt(gx, gy) {
  if (cellsDirty || cellsFor !== save.buildings || cellsN !== save.buildings.length) {
    CELLS.clear(); for (const b of save.buildings) for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) CELLS.set((b.gx + i) * 128 + (b.gy + j), b);
    cellsFor = save.buildings; cellsN = save.buildings.length; cellsDirty = false;
  }
  return CELLS.get(gx * 128 + gy);
}
const costStr = c => Object.entries(c).map(([a, n]) => `${n} ${a}`).join(', ');
const persist = () => { if (!curSlot) return; try { localStorage.setItem(slotKey(curSlot), JSON.stringify(save)); } catch {} };

let scene = null;
let notice = { msg: '', t: 0 };
const say = m => { notice = { msg: m, t: 3 }; };
function go(s) { scene = s; if (s.enter) s.enter(); }
function drawNotice(dt) {
  if (notice.t > 0) { notice.t -= dt; text(notice.msg, W / 2, H - 14, 15, AMBER, 'center'); }
}

