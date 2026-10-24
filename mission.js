// A scavenging run: weapons and melee, noise and stealth, infected that hunt by sight and sound,
// five kinds of infected, hotwiring parked cars, gangs and throwables.
// Rendering lives in site.js; this file is the game logic.

const SIGHT_BLOCK = new Set(['shelf', 'rack', 'prack', 'fridge', 'container', 'house', 'showroom', 'coldroom', 'cage', 'locker', 'tent', 'tower', 'car', 'lumber', 'cell']);

function missionScene(town, mode = 'drive', opts = {}) {
  const siteKey = town; town = applySite(town);   // today's version of the site: picked over, re-infested or hit by an event
  const _W = W, _H = H; W = 960; H = 640;   // the mission arena is a fixed 960x640 stage, whatever size the window is
  const m = {
    fixed: true, gl3d: R3D.ok,
    p: { x: W / 2, y: H / 2 + 100, hp: opts.hp || 100 },
    bullets: [], zombies: [], parts: [], crates: [], walls: [],
    carried: { scrap: 0, food: 0, ammo: 0, shells: 0, wood: 0, water: 0, diesel: 0, meds: 0 },
    time: (mode === 'walk' ? 45 : 75) + scoutBonus(), spawnT: 8, shotT: 0, meleeT: 0, done: null, doneT: 0,
    danger: siteDanger(town),
  };
  m.town = town; m.trip = tripHours(town, mode); m.night = arriveClock(town, mode) >= 19.5;
  m.humans = []; m.ebullets = []; m.gained = []; m.wrecked = null; m.fullT = 0;
  m.veh = mode === 'drive' ? veh() : null; m.cap = m.veh ? VEHICLE_TYPES[m.veh.type].cap : WALK.cap;
  m.gear = gearStats(); m.cap += m.gear.cap; m.armor = m.gear.armor; m.speedMul = 1 + m.gear.speed;
  m.gearGot = []; m.fires = []; m.thrown = []; m.blasts = []; m.item = save.items.molotov > 0 || save.items.bomb <= 0 ? 'molotov' : 'bomb';
  m.wR = GEAR_BY_ID[save.gear.eq.ranged] || GEAR_BY_ID.old_rifle; m.wM = GEAR_BY_ID[save.gear.eq.melee] || GEAR_BY_ID.crowbar;
  m.shake = 0; m.floats = []; m.float = (x, y, txt, col) => m.floats.push({ x, y, y0: y, txt, col, l: 1 }); setMood(m.night ? 'night' : 'calm');
  m.noiseLvl = 0; m.rings = []; m.acid = []; m.spits = []; m.alarms = []; m.swing = null; m.hordeCD = 20; m.hordeT = 0;
  m.sneak = false; m.stepT = 0; m.hot = null; m.nearCar = null; m.dryT = 0; m.lastNoise = null;
  const carriedTotal = () => Object.values(m.carried).reduce((s, n) => s + n, 0);
  siteSetup(m, town);   // layout, bounds, spawn points and the pre-rendered floor (site.js)
  const lootPool = Object.entries(town.loot).flatMap(([k, n]) => Array(n).fill(k));
  const free = (x, y, r) => !m.walls.some(w => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h);
  const place = zone => { for (let i = 0; i < 300; i++) { const x = rand(m.bounds.x0 + 16, m.bounds.x1 - 16), y = rand(m.bounds.y0 + 16, zone ? Math.min(zone.y1, m.bounds.y1 - 16) : m.bounds.y1 - 16); if (free(x, y, 16)) return [x, y]; } return [m.p.x + 50, m.p.y]; };
  const mkCrate = (x, y, k) => k === 'gear' ? { x, y, k, g: rollGear(town.bias) } : k === 'weapon' ? { x, y, k: 'gear', g: rollWeapon(town.wpool) } : { x, y, k };
  const D = DF();
  for (let i = 0; i < Math.max(2, Math.round((town.crates || 7) * D.loot)); i++) { const [x, y] = place(); m.crates.push(mkCrate(x, y, lootPool[Math.floor(Math.random() * lootPool.length)] || 'scrap')); }
  for (let i = 0; i < (town.keys || 0); i++) { const [x, y] = place(m.keyZone); m.crates.push({ x, y, keys: true }); }
  m.nCrates0 = m.crates.filter(c => !c.keys).length || 1;

  // ---------------------------------------------------------------- helpers
  m.burst = (x, y, c, n = 8) => { for (let i = 0; i < n; i++) { const a = rand(0, 7), v = rand(30, 140); m.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: rand(.3, .7), c }); } };
  m.killZombie = z => { if (z.dead) return; z.dead = true; sfx('zdie', .7, 70); save.stats.zk++; m.burst(z.x, z.y, '#6a2', 12); siteDecal(m, z.x, z.y, z.burnT > 0 ? 'burn' : 'z'); };
  m.killHuman = h => {   // gang members drop supplies, and sometimes clothes, a pack or a weapon
    if (h.dead) return; h.dead = true; facRep('reapers', -1.5); facRep('militia', .5); save.stats.kills++; m.burst(h.x, h.y, '#fa6', 12); siteDecal(m, h.x, h.y, 'h');
    const r = Math.random(), k = r < .18 ? 'gear' : r < .3 ? 'weapon' : ['ammo', 'ammo', 'food', 'scrap', 'water', 'shells'][Math.floor(Math.random() * 6)];
    m.crates.push(k === 'gear' ? { x: h.x, y: h.y, drop: true, k, g: rollGear('gang') } : k === 'weapon' ? { x: h.x, y: h.y, drop: true, k: 'gear', g: rollWeapon('police') } : { x: h.x, y: h.y, drop: true, k });
  };
  m.moveBlocked = (o, dx, dy, r) => { if (free(o.x + dx, o.y, r)) o.x += dx; if (free(o.x, o.y + dy, r)) o.y += dy; };
  const sightFree = (x, y) => !m.walls.some(w => SIGHT_BLOCK.has(w.style) && x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
  m.los = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14); for (let i = 1; i < n; i++) { const t = i / n; if (!sightFree(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; };
  // noise: loud things pull the infected towards the sound, and fill the noise meter that brings a horde
  m.noise = (x, y, r, amt, ring = true) => {
    m.noiseLvl = Math.min(100, m.noiseLvl + amt); m.lastNoise = { x, y };
    if (ring && r >= 120) m.rings.push({ x, y, r, t: 0 });
    for (const z of m.zombies) if (!z.dead && z.state !== 'chase' && Math.hypot(z.x - x, z.y - y) < r) { z.state = 'alert'; z.tx = x; z.ty = y; z.alertT = 7; z.icoT = 1.2; }
    for (const h of m.humans) if (!h.alert && Math.hypot(h.x - x, h.y - y) < r * .7) { h.alert = true; h.icoT = 1.2; }
  };

  // ---------------------------------------------------------------- the infected
  const pickKind = () => {
    const mx = { ...(town.zmix || { walker: .74, brute: .07 + m.danger * .01, runner: .05 + m.danger * .01, spitter: .04 + m.danger * .01, armored: .02 }) };
    for (const [k, w] of Object.entries(ZMODES[save.zmode] ? ZMODES[save.zmode].w : {})) if (mx[k] !== undefined) mx[k] *= w;
    if (m.night) mx.runner = (mx.runner || 0) * 1.7 + .05;
    let x = Math.random() * Object.values(mx).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(mx)) if ((x -= v) <= 0) return k;
    return 'walker';
  };
  m.mkZ = (kind, x, y, state) => {
    const T = ZTYPES[kind];
    return { x, y, kind, big: kind === 'brute', r: T.r, hp: T.hp, v: rand(T.v[0], T.v[1]) * (m.night ? 1.1 : 1), armor: T.armor || 0, dmg: T.dmg, wob: rand(0, 6), vi: Math.floor(rand(0, 5)), walk: 0, hit: 0,
      state, tx: 0, ty: 0, alertT: 0, icoT: 0, wa: rand(0, 6.28), wander: rand(0, 3), pause: false, spitT: rand(1, 2.5), a: rand(0, 6.28) };
  };
  m.spawnZ = (state, horde) => {
    if (m.zombies.length > 38) return;
    let x, y;
    if (m.spawns) { const sp = m.spawns[Math.floor(Math.random() * m.spawns.length)]; x = sp.x + rand(-10, 10); y = sp.y + rand(-10, 10); }
    else { const side = Math.floor(rand(0, 4)); x = side < 2 ? (side ? W + 10 : -10) : rand(0, W); y = side < 2 ? rand(40, H) : (side === 2 ? 30 : H + 10); }
    const z = m.mkZ(pickKind(), x, y, state), tgt = m.lastNoise || m.p;
    if (state === 'alert') { z.tx = tgt.x; z.ty = tgt.y; z.alertT = horde ? 14 : 9; }
    m.zombies.push(z);
  };
  // the infected already in the building, wandering until something draws them
  const n0 = Math.round((3 + m.danger * 1.5) * (m.night ? 1.3 : 1) * (town.infMul || 1) * D.zomb);
  for (let i = 0; i < n0; i++) for (let k = 0; k < 40; k++) { const [x, y] = place(); if (Math.hypot(x - m.p.x, y - m.p.y) > 240) { m.zombies.push(m.mkZ(pickKind(), x, y, 'idle')); break; } }
  // other survivors: hostile gangs, common by day and rare at night
  const nH = Math.min(4, Math.round((m.danger * 0.55 + 0.4 + (town.gangs || 0)) * (m.night ? 0.3 : 1) * D.zomb));
  for (let i = 0; i < nH; i++) for (let k = 0; k < 30; k++) {
    const [x, y] = place();
    if (Math.hypot(x - m.p.x, y - m.p.y) > 260) { m.humans.push({ x, y, r: 10, hp: 3, wa: rand(0, 6.28), wander: 0, alert: false, shotT: rand(.5, 1.5), a: 0, icoT: 0 }); break; }
  }
  setupObjective(m, town, place, free); setupHazards(m, town, place, free);
  if (m.veh && !VEHICLE_TYPES[m.veh.type].ev) { m.noise(m.p.x, m.p.y, 280, 8); sfx('engine'); }   // arriving by diesel announces you; EVs are silent

  const newVehicle = () => {
    const type = pickFleet(town.fleet), T = VEHICLE_TYPES[type], v = { type, name: T.label, hp: ri(40, 90), color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)] };
    if (T.ev) { v.charge = T.batt * rand(.35, .7); v.v2l = true; }
    return v;
  };
  m.finish = ok => {
    m.done = ok ? 'win' : 'dead'; m.doneT = 0;
    objFinish(m, ok); questsOnVisit(m.town, ok); if (m.veh) wearVehicle(m.veh, ok ? ri(3, 9) : 20);
    save.stats.trips++; logEvent(`${ok ? 'Scavenged' : 'Died at'} ${town.short || town.name}`);
    visitSite(siteKey, 1 - m.crates.filter(c => !c.got && !c.drop && !c.keys).length / m.nCrates0, ok);
    if (ok) {
      for (const k in m.carried) save.res[k] = (save.res[k] || 0) + m.carried[k];
      for (const v of m.gained) { if (save.vehicles.length < FLEET_MAX) save.vehicles.push(v); else { save.res.scrap += 10; m.fullPark = true; } }
      save.gear.stash.push(...m.gearGot);
    } else if (m.veh && Math.random() < .35) {   // a failed run can cost you the vehicle
      m.wrecked = m.veh.name; save.vehicles.splice(save.vehicles.indexOf(m.veh), 1); save.vi = 0;
    }
    save.clock += m.trip; persist();
  };

  // ---------------------------------------------------------------- touch controls: a stick on the left, buttons on the right, touch anywhere else to aim and fire
  const TBTN = () => [['melee', W - 80, H - 190, 'HIT'], ['throw', W - 170, H - 190, 'THROW'], ['use', W - 80, H - 110, 'USE'], ['sneak', W - 170, H - 110, 'SNEAK'], ['leave', W - 46, 100, 'LEAVE'], ['zoomin', W - 128, 100, '+'], ['zoomout', W - 210, 100, '−']];
  m.touchUpdate = () => {
    for (const a of ['melee', 'use', 'throw', 'leave', 'zoomin', 'zoomout']) TOUCH.act[a] = false; TOUCH.stick = null; let aim = null;
    for (const p of touchPts.values()) {
      let used = false;
      for (const [a, bx, by] of TBTN()) if (Math.hypot(p.x - bx, p.y - by) < 38) { used = true; if (a === 'sneak') { if (!p.tog) { p.tog = true; TOUCH.act.sneak = !TOUCH.act.sneak; } } else TOUCH.act[a] = true; }
      if (used) continue;
      if (p.sx < W * .36 && p.sy > H * .4) { const dx = (p.x - p.sx) / 50, dy = (p.y - p.sy) / 50, l = Math.max(1, Math.hypot(dx, dy)); TOUCH.stick = { x: dx / l, y: dy / l }; TOUCH.stickC = p; continue; }
      aim = p;
    }
    if (aim) { mouse.x = aim.x; mouse.y = aim.y; mouse.cx = (aim.x + UI.ox) * UI.scale; mouse.cy = (aim.y + UI.oy) * UI.scale; mouse.down = true; mouse.btn = 0; } else mouse.down = false;
  };
  m.drawTouch = () => {
    if (!TOUCH.on) return; ctx.globalAlpha = .5;
    const c = TOUCH.stick && TOUCH.stickC ? TOUCH.stickC : { sx: 110, sy: H - 110, x: 110, y: H - 110 };
    ctx.strokeStyle = '#9fb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.sx, c.sy, 50, 0, 7); ctx.stroke(); ctx.fillStyle = '#9fb'; ctx.beginPath(); ctx.arc(c.sx + Math.max(-50, Math.min(50, c.x - c.sx)), c.sy + Math.max(-50, Math.min(50, c.y - c.sy)), 20, 0, 7); ctx.fill();
    for (const [a, bx, by, l] of TBTN()) { ctx.strokeStyle = a === 'sneak' && TOUCH.act.sneak ? AMBER : '#9fb'; ctx.beginPath(); ctx.arc(bx, by, 34, 0, 7); ctx.stroke(); text(l, bx, by + 4, 10, '#cfe', 'center'); }
    ctx.globalAlpha = 1;
  };

  // ---------------------------------------------------------------- update
  m.update = dt => {
    if (m.done) { m.doneT += dt; return; }
    m.time -= dt; m.fullT -= dt; m.flashT -= dt; m.hurtT -= dt; m.dryT -= dt; m.hordeT -= dt; m.hordeCD -= dt;
    if (TOUCH.on) m.touchUpdate();
    if (R3D.ok) { R3D.mission.aim(m); if (TOUCH.act.zoomin) m.wheel(1.03); if (TOUCH.act.zoomout) m.wheel(1 / 1.03); }   // 3D: turn the cursor into a point on the stage; touch zoom buttons
    if (kdown('leave')) { keys[SET.kb.leave] = false; TOUCH.act.leave = false; m.finish(true); return; }
    // ---- movement (Shift sneaks: slower, but quiet and harder to spot)
    m.sneak = kdown('sneak');
    const sp = 190 * m.speedMul * (m.sneak ? (crewPerk('stealth') ? .7 : .55) : 1);
    let dx = (kdown('right') ? 1 : 0) - (kdown('left') ? 1 : 0), dy = (kdown('down') ? 1 : 0) - (kdown('up') ? 1 : 0);
    if (TOUCH.stick) { dx = TOUCH.stick.x; dy = TOUCH.stick.y; }
    const len = Math.max(1, Math.hypot(dx, dy));
    m.moveBlocked(m.p, dx / len * sp * dt, dy / len * sp * dt, 10);
    const Bn = m.bounds; m.p.x = Math.max(Bn.x0, Math.min(Bn.x1, m.p.x)); m.p.y = Math.max(Bn.y0, Math.min(Bn.y1, m.p.y));
    m.p.moving = dx || dy; if (m.p.moving) m.p.walk = (m.p.walk || 0) + dt * (m.sneak ? .6 : 1); m.p.a = Math.atan2(mouse.y - m.p.y, mouse.x - m.p.x);
    if (m.p.moving && !m.sneak) { m.stepT -= dt; if (m.stepT <= 0) { m.stepT = .5; m.noise(m.p.x, m.p.y, 80, .3, false); } }
    // ---- noise meter, trickle of new infected, and the horde
    m.noiseLvl = Math.max(0, m.noiseLvl - 4 * dt);
    m.spawnT -= dt * (.1 + m.noiseLvl / 35) * D.zomb;
    if (m.spawnT <= 0) { m.spawnT = Math.max(.35, 1.6 - m.danger * .15) * (m.night ? .65 : 1); m.spawnZ(m.noiseLvl > 25 ? 'alert' : 'idle'); }
    if (m.noiseLvl > 80 && m.hordeCD <= 0) { m.hordeCD = 35; m.hordeT = 3.5; m.noiseLvl = 55; sfx('horde'); say('A horde is heading your way!'); for (let i = 0; i < 3 + Math.round(m.danger); i++) m.spawnZ('alert', true); }
    for (const r of m.rings) r.t += dt; m.rings = m.rings.filter(r => r.t < .7);
    if (m.swing) { m.swing.t -= dt; if (m.swing.t <= 0) m.swing = null; }
    // ---- cars: hold E next to a parked car to hotwire it (slow, noisy, and some have alarms)
    m.nearCar = null;
    for (const w of m.walls) if (w.style === 'car' && w.veh && !w.taken && !w.burnt) {
      const ddx = Math.max(w.x - m.p.x, 0, m.p.x - (w.x + w.w)), ddy = Math.max(w.y - m.p.y, 0, m.p.y - (w.y + w.h));
      if (Math.hypot(ddx, ddy) < 26) { m.nearCar = w; break; }
    }
    if (kdown('use') && m.nearCar) {
      if (!m.hot || m.hot.car !== m.nearCar) m.hot = { car: m.nearCar, t: 0, need: 4 * (has('mechanic') ? .7 : 1) * (crewPerk('hotwirer') ? .7 : 1), pulse: 0 };
      const c = m.hot.car; m.hot.t += dt; m.hot.pulse -= dt;
      if (m.hot.pulse <= 0) { m.hot.pulse = .8; sfx('hotwire'); m.noise(c.x + c.w / 2, c.y + c.h / 2, 170, 1.5, false); }
      if (c.alarm && !c.alarmOn) { c.alarmOn = true; sfx('alarm'); m.alarms.push({ car: c, l: 14, p: 0 }); say('The alarm goes off!'); }
      if (m.hot.t >= m.hot.need) {
        const T = VEHICLE_TYPES[c.veh], v = { type: c.veh, name: T.label, hp: ri(40, 90), color: c.col };
        if (T.ev) { v.charge = T.batt * rand(.35, .7); v.v2l = true; }
        m.gained.push(v); c.taken = true; m.walls.splice(m.walls.indexOf(c), 1); m.alarms = m.alarms.filter(a => a.car !== c); siteClearCar(m, c); m.hot = null; say(`Took the ${T.label}`);
      }
    } else if (m.hot) { m.hot.t = Math.max(0, m.hot.t - dt * 1.5); if (m.hot.t <= 0) m.hot = null; }
    for (const a of m.alarms) { a.l -= dt; a.p -= dt; if (a.p <= 0) { a.p = .7; m.noise(a.car.x + a.car.w / 2, a.car.y + a.car.h / 2, 700, 4.5); } }
    m.alarms = m.alarms.filter(a => a.l > 0);
    // ---- ranged weapon: left click
    m.shotT -= dt; m.meleeT -= dt;
    if (mouse.down && mouse.btn === 0 && m.shotT <= 0) {
      const w = m.wR, kind = w.ammo, cost = w.cost || 1;
      if (save.res[kind] < cost) { m.shotT = .3; if (m.dryT <= 0) { say(`Out of ${kind === 'shells' ? 'shells' : 'ammo'}: switch to melee (Space)`); m.dryT = 2; } }
      else {
        save.res[kind] -= cost; m.shotT = w.rate; m.flashT = .07; sfx(w.pellets > 1 ? 'shot_shotgun' : w.id === 'smg' || w.id === 'assault' ? 'shot_smg' : w.id === 'pistol' ? 'shot_pistol' : 'shot_rifle', save.upgrades.suppressor ? .45 : 1, 40); m.shake = Math.max(m.shake, w.pellets > 1 ? .22 : .08);
        const base = Math.atan2(mouse.y - m.p.y, mouse.x - m.p.x), sup = save.upgrades.suppressor ? .4 : 1;
        for (let i = 0; i < (w.pellets || 1); i++) { const a = base + (Math.random() - .5) * 2 * w.spread; m.bullets.push({ x: m.p.x + Math.cos(base) * 26, y: m.p.y + Math.sin(base) * 26, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, l: w.range / w.speed, dmg: w.dmg, pierce: w.pierce || 0, hit: new Set() }); }
        m.noise(m.p.x, m.p.y, w.noise * sup, w.noise * sup / 120);
      }
    }
    // ---- melee: Space. Nearly silent, and triple damage on anything that has not noticed you
    if (kdown('melee') && m.meleeT <= 0) {
      const w = m.wM, a = m.p.a; let hitAny = false;
      m.meleeT = w.rate; m.swing = { t: .2, a, reach: w.reach }; sfx('melee', 1, 60);
      const inArc = (e, r) => { const ex = e.x - m.p.x, ey = e.y - m.p.y; if (Math.hypot(ex, ey) > w.reach + r) return false; let da = Math.atan2(ey, ex) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < 1.0; };
      for (const z of m.zombies) if (inArc(z, z.r)) {
        const dmg = Math.max(.34, w.dmg * (z.state === 'idle' ? 3 : 1) - z.armor); z.hp -= dmg; z.hit = .15; hitAny = true;
        z.x += Math.cos(a) * w.knock; z.y += Math.sin(a) * w.knock; m.burst(z.x, z.y, '#7c3', 5);
        if (z.hp <= 0) m.killZombie(z); else if (z.state !== 'chase') { z.state = 'chase'; z.icoT = 1.2; }
      }
      for (const h of m.humans) if (inArc(h, h.r)) { h.hp -= w.dmg * (h.alert ? 1 : 3); hitAny = true; m.burst(h.x, h.y, '#fa6', 5); if (h.hp > 0 && !h.alert) { h.alert = true; h.icoT = 1.2; } }
      m.noise(m.p.x, m.p.y, w.noise, hitAny ? .8 : .3, false);
    }
    for (const b of m.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; if (!free(b.x, b.y, 1) || b.x < m.bounds.x0 - 6 || b.x > m.bounds.x1 + 6 || b.y < m.bounds.y0 - 6 || b.y > m.bounds.y1 + 6) b.l = 0; }
    // ---- throwables: Q switches, G or right-click throws at the cursor
    const qNow = kdown('swap'), gNow = kdown('throw') || (mouse.down && mouse.btn === 2);
    if (qNow && !m.qH) m.item = m.item === 'molotov' ? 'bomb' : 'molotov';
    if (gNow && !m.gH && save.items[m.item] > 0) {
      save.items[m.item]--;
      const dd = Math.min(Math.hypot(mouse.x - m.p.x, mouse.y - m.p.y), 380), a2 = Math.atan2(mouse.y - m.p.y, mouse.x - m.p.x);
      m.thrown.push({ x: m.p.x, y: m.p.y, sx: m.p.x, sy: m.p.y, tx: m.p.x + Math.cos(a2) * dd, ty: m.p.y + Math.sin(a2) * dd, t: 0, dur: Math.max(.25, dd / 420), h: 0, type: m.item });
    }
    m.qH = qNow; m.gH = gNow;
    for (const o of m.thrown) { o.t += dt; const f = Math.min(1, o.t / o.dur); o.x = o.sx + (o.tx - o.sx) * f; o.y = o.sy + (o.ty - o.sy) * f; o.h = Math.sin(f * Math.PI) * 26; if (f >= 1) o.done = true; }
    for (const o of m.thrown) if (o.done) {
      sfx(o.type === 'molotov' ? 'fire' : 'boom'); if (o.type !== 'molotov') m.shake = Math.max(m.shake, .6);
      if (o.type === 'molotov') { m.fires.push({ x: o.tx, y: o.ty, l: 5, r: 50 }); siteDecal(m, o.tx, o.ty, 'burn'); m.noise(o.tx, o.ty, 140, 1.5, false); }
      else {
        m.blasts.push({ x: o.tx, y: o.ty, l: .45, r: 95 });
        for (const z of m.zombies) if (Math.hypot(z.x - o.tx, z.y - o.ty) < 95) { z.hp -= 6; z.hit = .15; }
        for (const h of m.humans) if (Math.hypot(h.x - o.tx, h.y - o.ty) < 95) { h.hp -= 6; h.alert = true; }
        if (Math.hypot(m.p.x - o.tx, m.p.y - o.ty) < 70) m.p.hp -= 25 * (1 - m.armor);
        m.burst(o.tx, o.ty, '#fb4', 22); siteDecal(m, o.tx, o.ty, 'burn'); m.noise(o.tx, o.ty, 680, 14);
      }
    }
    m.thrown = m.thrown.filter(o => !o.done);
    for (const f of m.fires) {
      f.l -= dt;
      for (const z of m.zombies) if (Math.hypot(z.x - f.x, z.y - f.y) < f.r) { z.burnT = .6; z.burn = (z.burn || 0) + dt; if (z.burn > .5) { z.burn = 0; z.hp--; } if (z.state === 'idle') { z.state = 'chase'; z.icoT = 1; } }
      for (const h of m.humans) if (Math.hypot(h.x - f.x, h.y - f.y) < f.r) { h.burn = (h.burn || 0) + dt; h.alert = true; if (h.burn > .5) { h.burn = 0; h.hp--; } }
      if (Math.hypot(m.p.x - f.x, m.p.y - f.y) < f.r * .8) m.p.hp -= 14 * dt * (1 - m.armor);
    }
    m.fires = m.fires.filter(f => f.l > 0);
    for (const b of m.blasts) b.l -= dt;
    m.blasts = m.blasts.filter(b => b.l > 0);

    // ---- the infected: idle -> alert (heard something) -> chase (saw you)
    for (const z of m.zombies) {
      if (z.burnT > 0) z.burnT -= dt;
      z.hit = Math.max(0, z.hit - dt); z.icoT = Math.max(0, z.icoT - dt);
      const d = Math.hypot(m.p.x - z.x, m.p.y - z.y);
      const vis = (m.night ? 140 : 220) * (m.sneak ? (crewPerk('stealth') ? .4 : .5) : 1) * (z.kind === 'runner' ? 1.15 : 1);
      if (z.state !== 'chase' && d < vis && m.los(z.x, z.y, m.p.x, m.p.y)) {
        z.state = 'chase'; z.icoT = 1.2; sfxAt('groan', z.x, z.y, m.p.x, m.p.y, 350);
        if (z.kind === 'runner' && !z.screamed) { z.screamed = true; sfxAt('scream', z.x, z.y, m.p.x, m.p.y); m.noise(z.x, z.y, 260, 3); }   // runners scream when they spot you
      }
      if (z.state === 'chase' && d > vis * 2.4) { z.state = 'alert'; z.tx = m.p.x; z.ty = m.p.y; z.alertT = 5; }
      let a = z.a, spd = 0;
      if (z.state === 'chase') {
        a = Math.atan2(m.p.y - z.y, m.p.x - z.x) + Math.sin(m.time * 2 + z.wob) * .25; spd = z.v;
        if (z.kind === 'mutant') { z.chT -= dt; if (z.charge > 0) { z.charge -= dt; spd = z.v * 3.2; } else if (z.chT <= 0 && d > 70 && d < 260) { z.charge = .6; z.chT = 4.5; m.noise(z.x, z.y, 320, 4); sfxAt('scream', z.x, z.y, m.p.x, m.p.y); } }
        if (z.kind === 'spitter') {   // keeps its distance and spits acid
          if (d < 150) { a += Math.PI; spd = z.v * .9; } else if (d < 200) spd = 0;
          z.spitT -= dt;
          if (z.spitT <= 0 && d < 300 && m.los(z.x, z.y, m.p.x, m.p.y)) { z.spitT = 2.6; sfxAt('spit', z.x, z.y, m.p.x, m.p.y); const aa = Math.atan2(m.p.y - z.y, m.p.x - z.x); m.spits.push({ x: z.x, y: z.y, vx: Math.cos(aa) * 230, vy: Math.sin(aa) * 230, l: 1.7 }); }
        }
      } else if (z.state === 'alert') {
        a = Math.atan2(z.ty - z.y, z.tx - z.x); spd = z.v * .8; z.alertT -= dt;
        if (Math.hypot(z.tx - z.x, z.ty - z.y) < 16 || z.alertT <= 0) { z.state = 'idle'; z.wander = 0; }
      } else {
        z.wander -= dt; if (z.wander <= 0) { z.wa = rand(0, 6.28); z.wander = rand(2, 4); z.pause = Math.random() < .4; }
        a = z.wa; spd = z.pause ? 0 : 24;
      }
      z.a = a; z.walk += dt * spd / 60;
      if (spd) m.moveBlocked(z, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, z.r * .7);
      if (d < z.r + 9) m.p.hp -= z.dmg * dt * (1 - m.armor) * D.dmg;
      for (const b of m.bullets) if (b.l > 0 && !b.hit.has(z) && Math.hypot(b.x - z.x, b.y - z.y) < z.r + 3) {
        b.hit.add(z); const dmg = Math.max(.34, b.dmg - z.armor);
        if (z.armor && b.dmg <= z.armor) m.burst(b.x, b.y, '#ccd', 2); else m.burst(b.x, b.y, '#7c3', 3);
        z.hp -= dmg; z.hit = .12; sfx('hit', .6, 50); m.float(z.x, z.y - 12, `${Math.round(dmg * 10) / 10}`, '#ffe08a'); if (z.state !== 'chase') { z.state = 'chase'; z.icoT = 1.2; }
        if (b.pierce > 0) b.pierce--; else b.l = 0;
        if (z.hp <= 0) m.killZombie(z);
      }
    }
    for (const sp2 of m.spits) {
      sp2.x += sp2.vx * dt; sp2.y += sp2.vy * dt; sp2.l -= dt; let land = sp2.l <= 0 || !free(sp2.x, sp2.y, 1);
      if (Math.hypot(sp2.x - m.p.x, sp2.y - m.p.y) < 12) { m.p.hp -= 6 * (1 - m.armor); m.burst(m.p.x, m.p.y, '#9d4', 6); land = true; }
      if (land) { sp2.done = true; m.acid.push({ x: sp2.x, y: sp2.y, l: 4, r: 26 }); }
    }
    m.spits = m.spits.filter(s => !s.done);
    for (const a of m.acid) { a.l -= dt; if (Math.hypot(m.p.x - a.x, m.p.y - a.y) < a.r) m.p.hp -= 7 * dt * (1 - m.armor * .5); }
    m.acid = m.acid.filter(a => a.l > 0);
    m.bullets = m.bullets.filter(b => b.l > 0);
    for (const z of m.zombies) if (z.hp <= 0) m.killZombie(z);
    m.zombies = m.zombies.filter(z => !z.dead);

    // ---- survivors: wander until they see or hear you, then close in and shoot
    for (const h of m.humans) {
      const d = Math.hypot(m.p.x - h.x, m.p.y - h.y), ca = Math.atan2(m.p.y - h.y, m.p.x - h.x); h.a = ca;
      h.walk = (h.walk || 0) + dt * 2; h.moving = h.alert; if (h.flash > 0) h.flash -= dt; h.icoT = Math.max(0, (h.icoT || 0) - dt);
      if (!h.alert && d < (m.night ? 190 : 280) * (m.sneak ? .55 : 1) && m.los(h.x, h.y, m.p.x, m.p.y)) { h.alert = true; h.icoT = 1.2; }
      if (!h.alert) { h.wander -= dt; if (h.wander <= 0) { h.wa = rand(0, 6.28); h.wander = rand(1, 3); } m.moveBlocked(h, Math.cos(h.wa) * 25 * dt, Math.sin(h.wa) * 25 * dt, 9); continue; }
      if (d > 190) m.moveBlocked(h, Math.cos(ca) * 68 * dt, Math.sin(ca) * 68 * dt, 9);
      else if (d < 120) m.moveBlocked(h, -Math.cos(ca) * 50 * dt, -Math.sin(ca) * 50 * dt, 9);
      else m.moveBlocked(h, -Math.sin(ca) * 30 * dt, Math.cos(ca) * 30 * dt, 9);
      h.shotT -= dt;
      if (h.shotT <= 0 && d < 340) { h.shotT = rand(1, 1.6); h.flash = .08; const a2 = ca + rand(-.2, .2); m.ebullets.push({ x: h.x + Math.cos(ca) * 24, y: h.y + Math.sin(ca) * 24, vx: Math.cos(a2) * 320, vy: Math.sin(a2) * 320, l: 1.3 }); m.noise(h.x, h.y, 380, 1.5, false); }
      for (const b of m.bullets) if (b.l > 0 && !b.hit.has(h) && Math.hypot(b.x - h.x, b.y - h.y) < h.r + 3) {
        b.hit.add(h); h.hp -= b.dmg; h.alert = true; m.burst(b.x, b.y, '#fa6', 3);
        if (b.pierce > 0) b.pierce--; else b.l = 0;
        if (h.hp <= 0) m.killHuman(h);
      }
    }
    for (const h of m.humans) if (h.hp <= 0) m.killHuman(h);
    m.humans = m.humans.filter(h => !h.dead);
    for (const h of m.humans) { h.x = Math.max(m.bounds.x0, Math.min(m.bounds.x1, h.x)); h.y = Math.max(m.bounds.y0, Math.min(m.bounds.y1, h.y)); }
    for (const e of m.ebullets) {
      e.x += e.vx * dt; e.y += e.vy * dt; e.l -= dt; if (!free(e.x, e.y, 1)) e.l = 0;
      if (Math.hypot(e.x - m.p.x, e.y - m.p.y) < 11) { e.l = 0; m.p.hp -= 9 * (1 - m.armor); m.burst(m.p.x, m.p.y, '#f66', 5); }
    }
    m.ebullets = m.ebullets.filter(e => e.l > 0);

    // ---- crates
    for (const c of m.crates) if (Math.hypot(c.x - m.p.x, c.y - m.p.y) < 20) {
      if (objPickup(m, c)) continue;
      if (c.keys) { c.got = true; m.gained.push(newVehicle()); say('Found vehicle keys!'); continue; }
      if (c.k === 'gear') { c.got = true; sfx('gear'); m.gearGot.push(c.g); const it = GEAR_BY_ID[c.g]; say(`Found ${it.name} (${RARITY[it.r].name})`); continue; }
      const room = m.cap - carriedTotal();
      if (room <= 0) { if (m.fullT <= 0) { say(`Full: ${m.cap} units. Press X to head home.`); m.fullT = 2.5; } continue; }
      c.got = true;
      const k = c.k || 'scrap';
      let n = k === 'ammo' ? Math.floor(rand(6, 14)) : k === 'shells' ? Math.floor(rand(4, 9)) : k === 'water' ? Math.floor(rand(4, 10)) : k === 'diesel' ? Math.floor(rand(2, 6)) : k === 'meds' ? Math.floor(rand(2, 6)) : Math.floor(rand(3, 8));
      n = Math.min(n, room); m.carried[k] += n; say(`+${n} ${k}`); sfx('pickup', 1, 40); m.float(c.x, c.y - 10, `+${n} ${k}`, CRATE_COL[k] || '#fc4');
    }
    objUpdate(m, dt); hazUpdate(m, dt);
    m.crates = m.crates.filter(c => !c.got);
    for (const p of m.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }
    m.parts = m.parts.filter(p => p.l > 0);

    if (m.p.hp < m.lastHp - .01) { m.hurtT = .3; m.shake = Math.max(m.shake, .25); sfx('hurt', 1, 180); } m.lastHp = m.p.hp;
    m.shake = Math.max(0, m.shake - dt * 1.6); for (const f of m.floats) { f.l -= dt; f.y -= 22 * dt; } m.floats = m.floats.filter(f => f.l > 0);
    setMood(m.noiseLvl > 55 || m.zombies.some(z => z.state === 'chase') ? 'tense' : m.night ? 'night' : 'calm');
    if (m.p.hp <= 0) m.finish(false);
    else if (m.time <= 0 || m.crates.length === 0) m.finish(true);
  };

  // ---------------------------------------------------------------- draw (world in siteDraw or the 3D view, HUD here)
  m.wheel = f => { if (R3D.ok) R3D.mission.wheel(m, f); };
  m.draw = (dt, time) => {
    if (R3D.ok) R3D.mission.frame(m, town, dt, time || 0);
    else {
    ctx.save(); if (m.shake > 0 && SET.shake) ctx.translate((Math.random() - .5) * m.shake * 16 * SET.shake, (Math.random() - .5) * m.shake * 16 * SET.shake);
    siteDraw(m, town, time || 0);
    for (const f of m.floats) { ctx.globalAlpha = Math.min(1, f.l * 1.6); text(f.txt, f.x, f.y, 12, f.col, 'center'); } ctx.globalAlpha = 1;
    ctx.restore();
    }
    drawHUD(true); m.drawTouch();
    text(`${town.name.toUpperCase()} · ${m.night ? 'NIGHT' : 'DAY'}  ${Math.max(0, Math.ceil(m.time))}s  crates ${m.crates.length}  survivors ${m.humans.length}`, W / 2, 56, 14, m.night ? '#9bd' : AMBER, 'center');
    // noise meter and detection status
    objHud(m, time);
    { const nl = m.noiseLvl / 100, spotted = m.zombies.some(z => z.state === 'chase') || m.humans.some(h => h.alert);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 82, 64, 164, 12);
      ctx.fillStyle = nl < .4 ? '#5fd078' : nl < .75 ? '#f0c040' : '#ff5a3a'; ctx.fillRect(W / 2 - 80, 66, 160 * nl, 8); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.strokeRect(W / 2 - 82.5, 63.5, 165, 12);
      text(`NOISE · ${spotted ? 'SPOTTED' : m.sneak ? 'SNEAKING' : 'HIDDEN'}`, W / 2, 90, 11, spotted ? '#ff7a6a' : m.sneak ? '#9fe0b0' : '#9fb', 'center'); }
    if (m.hordeT > 0) text('HORDE!', W / 2, 130, 28 + Math.sin(time * 14) * 2, '#ff4a3a', 'center');
    // hp bar + carried + loadout
    ctx.fillStyle = '#300'; ctx.fillRect(12, H - 22, 160, 10); ctx.fillStyle = RED; ctx.fillRect(12, H - 22, 160 * Math.max(0, m.p.hp) / 100, 10);
    const c = m.carried, n = Object.values(c).reduce((s, v) => s + v, 0);
    text(`carrying ${n}/${m.cap}: scrap ${c.scrap} food ${c.food} ammo ${c.ammo} shells ${c.shells} wood ${c.wood} water ${c.water} diesel ${c.diesel} meds ${c.meds}${m.gained.length ? '  · vehicles x' + m.gained.length : ''}${m.gearGot.length ? '  · gear x' + m.gearGot.length : ''}`, 12, H - 30, 12, GREEN);
    text(`throw: ${m.item === 'bomb' ? 'pipe bomb' : 'molotov'} x${save.items[m.item]}  (Q switch · G throw)`, 12, H - 46, 12, '#fa5');
    text(`${m.wR.name}: ${save.res[m.wR.ammo]} ${m.wR.ammo === 'shells' ? 'shells' : 'ammo'}${save.upgrades.suppressor ? ' (suppressed)' : ''}  · melee ${m.wM.name} [Space]  · Shift sneak · hold E at a car · X leave`, 12, H - 62, 12, '#cfe');
    if (m.done) {
      ctx.fillStyle = 'rgba(3,8,6,.8)'; ctx.fillRect(0, 0, W, H);
      text(m.done === 'win' ? 'EXTRACTED' : 'YOU WERE OVERRUN', W / 2, 260, 36, m.done === 'win' ? GREEN : RED, 'center');
      text(m.done === 'win' ? `Loot: scrap ${c.scrap} food ${c.food} ammo ${c.ammo} shells ${c.shells} wood ${c.wood} water ${c.water} diesel ${c.diesel} meds ${c.meds}` : 'Everything you carried is lost.', W / 2, 300, 15, GREEN, 'center');
      { const msg = m.gained.length && m.done === 'win' ? `Vehicle recovered: ${m.gained.map(v => v.name).join(', ')}${m.fullPark ? ' (parking full: extras scrapped for scrap)' : ''}` : m.wrecked ? `Your ${m.wrecked} was wrecked` : ''; if (msg) text(msg, W / 2, 282, 14, m.wrecked ? RED : '#7ab8ff', 'center'); }
      text(`Back home at ${fmtClock(save.clock)}${save.clock >= DUSK ? ' — night is falling' : ''}`, W / 2, 324, 14, save.clock >= DUSK ? RED : AMBER, 'center');
      if (m.done === 'win' && m.objMsg) text(m.objMsg, W / 2, 432, 13, '#ffd070', 'center');
      if (m.done === 'win' && m.gearGot.length) text(`Found: ${m.gearGot.map(id => GEAR_BY_ID[id].name).join(', ')}`, W / 2, 346, 13, '#d89aff', 'center');
      if (m.doneT > 0.5) button('BACK TO MAP', W / 2 - 80, 368, 160, 40, () => go(mapScene));
    }
  };
  W = _W; H = _H;
  return m;
}
