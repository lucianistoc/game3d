// The base builder: an isometric map of the plot (1.5 m cells) with a pan/zoom camera, drag-to-paint building,
// a ghost preview of what you are about to place, hover info, and the night-watch raid.

const TABS = { def: ['fence', 'wall', 'turret', 'floodlight'], trap: ['wire', 'pit', 'mine'], base: ['garden', 'tank', 'well', 'generator', 'powerbox'], tools: ['upgrade', 'repair', 'sell'] };
const PAINTABLE = new Set(['fence', 'wall', 'wire', 'garden', 'upgrade', 'repair', 'sell']);
const TOOL_DESC = {
  fence: 'Fence line. Drag to draw a run of it. Upgrade it to chain-link, concrete and finally electric.',
  wall: 'Thin wall that links up with its neighbours. Drag to draw. Sandbag, then concrete, then reinforced.',
  turret: 'Automatic gun. Burns ammo. Range about 9 cells.',
  wire: 'Barbed wire: slows and cuts anything that crosses it. Wears out. Drag to lay a belt of it outside your walls.',
  pit: 'Spiked pit: one victim, then it is spent. Good against brutes.',
  mine: 'Pressure mine: a blast that hurts everything near it. One use.',
  floodlight: 'Slows zombies in its light and speeds nearby turrets. Draws battery or V2L power.',
  garden: 'Grows 1 food per cell each night. Drag to lay out a plot.',
  tank: 'Collects rainwater overnight (more when it rains).',
  well: 'Hand-dug well: +4 water every night, rain or shine.',
  generator: 'Diesel backup power. One only.',
  powerbox: 'Inverter and 30 kWh battery. One only.',
  upgrade: 'Click or drag over fences, walls and the gate to raise them one tier.',
  repair: 'Click a damaged building: 2 scrap restores 20 HP (10 for the house).',
  sell: 'Refunds half the cost. Drag to clear a run of fence or wall.',
};
const wrapText = (s, n) => { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; };
const camXform = () => { ctx.translate(W / 2, H / 2); ctx.scale(CAM.z, CAM.z); ctx.translate(-CAM.x, -CAM.y); };

const baseScene = {
  gl3d: R3D.ok, item: 'molotov', sel: 'wall', tab: 'def', raid: null, paint: null, pan: null, fitted: false, kh: [], fh: false, ui: null,

  // ---------------------------------------------------------------- camera
  fit() {
    if (R3D.ok) { R3D.base.fit(); this.fitted = true; return; }
    const left = 180, top = 44, bottom = 72;                       // keep clear of the build panel and the bars
    const bx0 = -560, bx1 = 300, by0 = -80, by1 = 430;               // plot + street + building heights, in world px
    CAM.z = Math.max(.4, Math.min((W - left - 20) / (bx1 - bx0), (H - top - bottom) / (by1 - by0)));
    const ucx = left + (W - left) / 2, ucy = top + (H - top - bottom) / 2;
    CAM.x = (bx0 + bx1) / 2 - (ucx - W / 2) / CAM.z; CAM.y = (by0 + by1) / 2 - (ucy - H / 2) / CAM.z;
    this.fitted = true;
  },
  clampCam() {
    const zmin = Math.max(W / (WORLD.x1 - WORLD.x0), H / (WORLD.y1 - WORLD.y0), .35);
    CAM.z = Math.max(zmin, Math.min(6, CAM.z));
    const hw = W / 2 / CAM.z, hh = H / 2 / CAM.z;
    CAM.x = Math.max(WORLD.x0 + hw, Math.min(WORLD.x1 - hw, CAM.x)); CAM.y = Math.max(WORLD.y0 + hh, Math.min(WORLD.y1 - hh, CAM.y));
  },
  wheel(f, x, y) {
    if (R3D.ok) { R3D.base.zoom(f); return; }
    const [wx, wy] = toWorld(x, y);
    CAM.z = Math.max(.35, Math.min(6, CAM.z * f));
    CAM.x = wx - (x - W / 2) / CAM.z; CAM.y = wy - (y - H / 2) / CAM.z;
  },
  enter() { if (!this.fitted) this.fit(); setMood(this.raid ? 'night' : 'calm'); },
  cellUnderMouse() { if (R3D.ok) return R3D.base.pick(); const [wx, wy] = toWorld(mouse.x, mouse.y), [fx, fy] = unIso(wx, wy); return [Math.floor(fx), Math.floor(fy)]; },
  overUI() { const u = this.ui; return !!u && mouse.x >= u.x && mouse.x <= u.x + u.w && mouse.y >= u.y && mouse.y <= u.y + u.h; },

  // ---------------------------------------------------------------- building tools
  inBounds: (gx, gy) => gx >= 0 && gy >= 0 && gx < GX && gy < GY,
  canPlace(kind, gx, gy) {
    if (!this.inBounds(gx, gy) || cellAt(gx, gy)) return false;
    const k = KINDS[kind]; if (!k) return false;
    if (k.unique && save.buildings.some(b => b.t === kind)) return false;
    for (const r in k.cost) if (save.res[r] < k.cost[r]) return false;
    return true;
  },
  fenceDir(gx, gy) {
    const f = (x, y) => { const o = cellAt(x, y); return o && o.t === 'fence'; };
    return (f(gx - 1, gy) || f(gx + 1, gy)) ? 'x' : (f(gx, gy - 1) || f(gx, gy + 1)) ? 'y' : 'x';
  },
  tool(gx, gy, quiet) {   // apply the selected tool to one cell; returns true if something happened
    if (!this.inBounds(gx, gy)) return false;
    const ex = cellAt(gx, gy), sel = this.sel, S = msg => { if (!quiet) say(msg); };
    if (sel === 'upgrade') { if (ex && TIERS[ex.t]) return this.upgrade(ex, quiet); return false; }
    if (sel === 'repair') {
      if (!ex) return false;
      if (ex.t === 'house') { if (save.houseHp >= 100) return false; if (save.res.scrap < 2) { S('Need 2 scrap'); return false; } save.res.scrap -= 2; save.houseHp = Math.min(100, save.houseHp + 10); return true; }
      if (ex.hp >= maxHp(ex)) return false;
      if (save.res.scrap < 2) { S('Need 2 scrap'); return false; }
      save.res.scrap -= 2; ex.hp = Math.min(maxHp(ex), ex.hp + 20); return true;
    }
    if (sel === 'sell') {
      if (!ex || !KINDS[ex.t].cost) return false;
      for (const k in KINDS[ex.t].cost) save.res[k] += Math.floor(KINDS[ex.t].cost[k] / 2);
      save.buildings.splice(save.buildings.indexOf(ex), 1); cellsDirty = true; return true;
    }
    const k = KINDS[sel];
    if (ex) return false;
    if (k.unique && save.buildings.some(b => b.t === sel)) { S(`Only one ${k.label.toLowerCase()}`); return false; }
    const kc = { ...k.cost }; if (crewPerk('builder') && kc.scrap > 1) kc.scrap--;
    for (const r in kc) if (save.res[r] < kc[r]) { S(`Need ${r}: ${kc[r]}`); return false; }
    for (const r in kc) save.res[r] -= kc[r];
    save.buildings.push({ t: sel, gx, gy, w: 1, h: 1, hp: sel === 'fence' ? FENCE_LVL[0].hp : sel === 'wall' ? WALL_LVL[0].hp : k.hp, dir: this.fenceDir(gx, gy), lvl: 0 });
    cellsDirty = true; return true;
  },
  upgrade(b, quiet) {
    const tbl = TIERS[b.t]; if (!tbl) return false;
    const lvl = b.lvl || 0;
    if (lvl >= tbl.length - 1) { if (!quiet) say('Already max level'); return false; }
    const nx = tbl[lvl + 1];
    for (const r in nx.cost) if (save.res[r] < nx.cost[r]) { if (!quiet) say(`Upgrade to ${nx.name}: need ${costStr(nx.cost)}`); return false; }
    for (const r in nx.cost) save.res[r] -= nx.cost[r];
    b.lvl = lvl + 1; b.hp = nx.hp; return true;
  },
  upgradeAll() {
    const list = save.buildings.filter(b => TIERS[b.t]).sort((a, b) => (a.lvl || 0) - (b.lvl || 0));
    let n = 0; for (const f of list) if (this.upgrade(f, true)) n++;
    persist(); say(n ? `Upgraded ${n} sections` : 'Nothing affordable to upgrade');
  },
  click() {
    if (this.confirmEnd) return;
    if (mouse.btn !== 0 || this.panMode) {
      if (R3D.ok) { if (mouse.btn === 1 || (mouse.btn === 2 && (keys.ShiftLeft || keys.ShiftRight))) R3D.base.startRot(this); else R3D.base.startPan(this); return; }   // middle-drag (or shift + right-drag) rotates, right-drag pans
      this.pan = { x: mouse.x, y: mouse.y, cx: CAM.x, cy: CAM.y }; return;
    }
    if (this.overUI()) return;
    if (this.raid) { this.shoot(); return; }
    const [gx, gy] = this.cellUnderMouse();
    this.paint = { last: [gx, gy], did: this.tool(gx, gy, false) };
  },
  up() { if (this.paint && this.paint.did) persist(); this.paint = null; this.pan = null; this.rot = null; },

  // ---------------------------------------------------------------- night watch
  update(dt) {
    // camera + hotkeys (always)
    if (R3D.ok) R3D.base.camUpdate(this, dt);
    else {
    const sp = 520 * dt / CAM.z;
    if (kdown('left')) CAM.x -= sp; if (kdown('right')) CAM.x += sp;
    if (kdown('up')) CAM.y -= sp; if (kdown('down')) CAM.y += sp;
    if (keys.Equal || keys.NumpadAdd) this.wheel(1 + 1.2 * dt, W / 2, H / 2); if (keys.Minus || keys.NumpadSubtract) this.wheel(1 / (1 + 1.2 * dt), W / 2, H / 2);
    if (this.pan && mouse.down) { CAM.x = this.pan.cx - (mouse.x - this.pan.x) / CAM.z; CAM.y = this.pan.cy - (mouse.y - this.pan.y) / CAM.z; }
    this.clampCam();
    }
    for (let i = 0; i < 5; i++) { const k = keys['Digit' + (i + 1)]; if (k && !this.kh[i] && !this.raid) { const it = TABS[this.tab][i]; if (it) this.sel = it; } this.kh[i] = !!k; }
    if (keys.KeyF && !this.fh) this.fit(); this.fh = !!keys.KeyF;
    // drag-to-paint along the mouse path
    if (this.paint && mouse.down && !this.raid && PAINTABLE.has(this.sel) && !this.overUI()) {
      const [gx, gy] = this.cellUnderMouse(), [lx, ly] = this.paint.last;
      if (gx !== lx || gy !== ly) {
        const n = Math.max(Math.abs(gx - lx), Math.abs(gy - ly));
        for (let i = 1; i <= n; i++) { if (this.tool(Math.round(lx + (gx - lx) * i / n), Math.round(ly + (gy - ly) * i / n), true)) this.paint.did = true; }
        this.paint.last = [gx, gy];
      }
    }
    if (!this.raid) { if (save.clock >= DUSK && !save.over && scene === this) go(planScene); return; }

    this.raidUpdate(dt);
  },
  endNight(won, lostMsgs = []) {
    const rep = [], r = save.res, wx = WEATHER[save.weather];
    save.day++; LIT = false; save.clock = DAWN;
    if ((save.day - 1) % 30 === 0) rep.push(`${seasonOf().name} begins: ${seasonOf().desc}`);
    let food = 0, water = 0;
    for (const b of save.buildings) {
      if (b.t === 'garden') food += 1;
      if (b.t === 'greenhouse') { if (r.water >= 1 || crewPerk('irrigation')) { if (!crewPerk('irrigation')) r.water -= 1; food += 3 + (has('farmer') ? 1 + (roleLvl('farmer') >= 3 ? 1 : 0) : 0) + (hasPerk('farmer', 'green') ? 1 : 0); } else rep.push('A greenhouse ran dry: no harvest'); }
      if (b.t === 'workshop') r.ammo += 1;
      if (b.t === 'well') water += 4 + (hasResearch('filters') ? 2 : 0);
      if (b.t === 'tank') water += ((save.weather === 'cloudy' || save.weather === 'storm') ? 3 : 1) + (hasResearch('filters') ? 1 : 0);
    }
    food = Math.round(food * seasonOf().grow); r.food += food; r.water += water;
    if (food) rep.push(`Harvest +${food} food`);
    if (water) rep.push(`Tanks +${water} water`);
    if (won) r.scrap += 5 + save.day;
    const n = alive().length, need = Math.max(1, Math.round((Math.ceil(n * .75) - (has('cook') ? 1 : 0) - (roomLvl('kitchen') ? 1 : 0) - (crewPerk('thrift') ? 1 : 0) + seasonOf().need) * DF().need)), needW = Math.max(1, need - (crewPerk('stores') ? 1 : 0) + (seasonOf().water || 0));
    let lackF = Math.max(0, need - r.food), lackW = Math.max(0, needW - r.water);
    r.food = Math.max(0, r.food - need); r.water = Math.max(0, r.water - needW);
    rep.push(`Crew of ${n} used ${need} food and ${need} water`);
    if (lackF) rep.push(`Short ${lackF} food: hungry crew hurt`);
    if (lackW) rep.push(`Short ${lackW} water: thirsty crew hurt`);
    for (const m of hurt((lackF + lackW) * 2, 25)) rep.push(m);
    for (const m of lostMsgs) rep.push(m);
    if (has('engineer')) { for (const b of save.buildings) if (b.t !== 'house') b.hp = Math.min(maxHp(b), b.hp + maxHp(b) * (.25 + .05 * (roleLvl('engineer') - 1))); save.houseHp = Math.min(100, save.houseHp + 10); rep.push('Engineer repaired the base'); }
    if (alive().length) {
      const heal = (has('medic') ? 25 + 5 * (roleLvl('medic') - 1) : 5) + 10 * roomLvl('clinic'); for (const c of alive()) if (!(c.inj && INJ[c.inj.type].noheal)) c.hp = Math.min(100, c.hp + heal);
      let used = 0; for (const c of alive().sort((a, b) => a.hp - b.hp)) if (r.meds > 0 && c.hp < 75) { r.meds--; used++; c.hp = Math.min(100, c.hp + (roomLvl('clinic') ? 55 : 40) + (crewPerk('pharmacist') ? 10 : 0)); }
      if (used) rep.push(`Medicine used on ${used} injured crew member${used > 1 ? 's' : ''}`);
    }
    // solar day: 16 kWp panels, then the house's daily load
    const c = cap(), gen = SOLAR.kwp * wx.sun * SOLAR.eff * seasonOf().sun * (hasResearch('panels') ? 1.1 : 1);
    let e = save.energy + gen - dayLoad();
    rep.push(`${wx.name}: solar +${gen.toFixed(0)} kWh, house load -${dayLoad().toFixed(0)} kWh`);
    if (e < 0) {   // V2L: EVs cover the shortfall before the generator starts
      let used = 0;
      for (const v of evs()) { if (!v.v2l || e >= 0) continue; const a = Math.min(-e, Math.max(0, v.charge - evReserve(v))); v.charge -= a; e += a; used += a; }
      if (used > .4) rep.push(`V2L: EVs powered the house (-${used.toFixed(0)} kWh)`);
    }
    if (e < 0 && save.buildings.some(b => b.t === 'generator') && r.diesel >= 3) { r.diesel -= 3; e += (has('mechanic') ? 14 : 10) + (crewPerk('gen') ? 3 : 0); rep.push(`Generator ran: -3 L diesel, +${(has('mechanic') ? 14 : 10) + (crewPerk('gen') ? 3 : 0)} kWh`); }
    if (e < 0) { e = 0; r.food = Math.max(0, r.food - 2); rep.push('BLACKOUT: freezer thawed, -2 food'); }
    if (e > c) {   // solar surplus charges the EVs (11 kW charger: up to ~40 kWh per car per day)
      let sp = e - c, ch = 0;
      for (const v of evs()) { const a = Math.max(0, Math.min(sp, VEHICLE_TYPES[v.type].batt - v.charge, 40)); v.charge += a; sp -= a; ch += a; }
      if (ch > .4) rep.push(`Solar surplus charged EVs: +${ch.toFixed(0)} kWh`);
    }
    save.energy = Math.min(c, e);
    const blackout = rep.some(l => /BLACKOUT/.test(l));
    if (!c) rep.push('No battery: solar energy is wasted');
    // next day's weather
    let roll = Math.random(), pickW = 'sunny';
    for (const [k, v] of Object.entries(WEATHER)) { if (roll < v.p) { pickW = k; break; } roll -= v.p; }
    save.weather = pickW;
    r.ammo = Math.floor(r.ammo); if (won) save.stats.nights++; else save.stats.lostNights++; logEvent(won ? `Night ${save.day - 1} held` : `The house was overrun on night ${save.day - 1}`);
    worldNight({ won, lackF, lackW, blackout, lost: lostMsgs.length }, rep);
    for (const c of save.crew) if (c.away && c.away.tonight) c.away = null;
    planRaid();
    if (!living().length) save.over = true;
    persist();
    return rep;
  },

  // ---------------------------------------------------------------- drawing
  draw(dt, time) {
    if (R3D.ok) return this.draw3d(dt, time);
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.5); ctx.save(); if (this.shake > 0 && SET.shake) ctx.translate((Math.random() - .5) * this.shake * 14 * SET.shake, (Math.random() - .5) * this.shake * 14 * SET.shake);
    if (!this.raid) LIT = false;
    DARK = darkness(save.clock); NIGHT = DARK > .55;
    const blds = save.buildings, raid = this.raid, tool = this.sel;
    const [hgx, hgy] = this.cellUnderMouse(), hoverIn = this.inBounds(hgx, hgy) && !this.overUI() && mouse.y > 40;
    // ---- pass 1: ground, grid, tool highlights
    ctx.save(); camXform();
    drawGround();
    if (!raid) {
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1 / CAM.z; ctx.beginPath();
      for (let i = 0; i <= GX; i++) { const [x0, y0] = iso(i, 0), [x1, y1] = iso(i, GY); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      for (let j = 0; j <= GY; j++) { const [x0, y0] = iso(0, j), [x1, y1] = iso(GX, j); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,120,.35)'; ctx.lineWidth = 2 / CAM.z; ctx.beginPath(); [iso(0, 0), iso(GX, 0), iso(GX, GY), iso(0, GY)].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.stroke();
    }
    const cellDiamond = (gx, gy, fill, stroke) => { const [x, y] = iso(gx, gy); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TW / 2, y + TH / 2); ctx.lineTo(x, y + TH); ctx.lineTo(x - TW / 2, y + TH / 2); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5 / CAM.z; ctx.stroke(); } };
    if (!raid && hoverIn && ['upgrade', 'repair', 'sell'].includes(tool)) {   // highlight the whole building under the cursor
      const o = cellAt(hgx, hgy);
      if (o) { const ok = tool === 'sell' ? !!KINDS[o.t].cost : tool === 'upgrade' ? !!TIERS[o.t] : true, col = !ok ? 'rgba(255,90,90,.35)' : tool === 'sell' ? 'rgba(255,170,60,.4)' : tool === 'upgrade' ? 'rgba(90,200,255,.4)' : 'rgba(90,255,140,.35)';
        for (let i = 0; i < o.w; i++) for (let j = 0; j < o.h; j++) cellDiamond(o.gx + i, o.gy + j, col, null); }
    }
    ctx.restore();

    // ---- shadows (screen space, drawn through the camera)
    const carShadows = save.vehicles.slice(0, FLEET_MAX).map((v, i) => { const [cx, cy] = FLEET_SLOTS[i], len = VEHICLE_TYPES[v.type].len, [x, y] = iso((cx + len / 2) * GSCALE, (cy + .45) * GSCALE); return [x + 8, y + 4, 16 + len * 12, 9]; });
    drawShadows(blds, TREES.map(([x, y]) => [x * GSCALE, y * GSCALE, 1]).concat(TREES_FAR.map(([x, y, s]) => [x * GSCALE, y * GSCALE, s]), BUSHES.map(([x, y]) => [x * GSCALE, y * GSCALE, .45])), carShadows);

    // ---- pass 2: depth-sorted entities
    const items = blds.map(b => ({ d: b.gx + b.w + b.gy + b.h, b }));
    if (raid) for (const z of raid.zombies) items.push({ d: z.x + z.y + .5, z });
    for (const [tx, ty] of TREES) items.push({ d: (tx + ty) * GSCALE + .5, tree: [tx * GSCALE, ty * GSCALE, 1] });
    for (const t of TREES_FAR) items.push({ d: (t[0] + t[1]) * GSCALE + .5, tree: [t[0] * GSCALE, t[1] * GSCALE, t[2]] });
    for (const [bx, by] of BUSHES) items.push({ d: (bx + by) * GSCALE + .3, bush: [bx * GSCALE, by * GSCALE] });
    for (const [px, py] of PILES) items.push({ d: (px + py) * GSCALE + .5, pile: [px * GSCALE, py * GSCALE] });
    save.vehicles.slice(0, FLEET_MAX).forEach((v, i) => items.push({ d: (FLEET_SLOTS[i][0] + FLEET_SLOTS[i][1] + 1.2) * GSCALE, car: [FLEET_SLOTS[i][0], FLEET_SLOTS[i][1], v] }));
    for (const c of CATS) items.push({ d: (c[0] + c[1]) * GSCALE + .3, cat: [c[0] * GSCALE, c[1] * GSCALE, c[2]] });
    alive().forEach((c, i) => { const gx = 9.2 + (i % 4) * .45, gy = 18.4 + Math.floor(i / 4) * 1.4 + (i % 4) * .6; items.push({ d: gx + gy, person: { c, i, gx, gy } }); });
    let ghost = null;   // preview of what a click would place
    if (!raid && hoverIn && KINDS[tool] && !['upgrade', 'repair', 'sell'].includes(tool)) { ghost = { gx: hgx, gy: hgy, ok: this.canPlace(tool, hgx, hgy) }; items.push({ d: hgx + hgy + 1, ghost }); }
    items.sort((a, b) => a.d - b.d);
    ctx.save(); camXform();
    for (const it of items) {
      if (it.tree) drawTree(...it.tree);
      else if (it.bush) drawBush(...it.bush);
      else if (it.pile) drawPile(...it.pile);
      else if (it.car) drawVehicle(...it.car);
      else if (it.cat) drawCat(...it.cat, time);
      else if (it.person) { const [x, y] = iso(it.person.gx, it.person.gy); drawPerson(x, y, it.person.c, time, it.person.i); }
      else if (it.b) drawBox(it.b, it.b.t, it.b.t === 'house' ? save.houseHp / 100 : it.b.hp / maxHp(it.b));
      else if (it.ghost) {
        const g = it.ghost;
        if (g.ok) { ctx.globalAlpha = .6; drawBox({ t: tool, gx: g.gx, gy: g.gy, w: 1, h: 1, hp: 99, dir: this.fenceDir(g.gx, g.gy), lvl: 0 }, tool, 1); ctx.globalAlpha = 1; cellDiamond(g.gx, g.gy, 'rgba(90,255,140,.28)', 'rgba(120,255,160,.9)'); }
        else cellDiamond(g.gx, g.gy, 'rgba(255,70,70,.35)', 'rgba(255,100,100,.9)');
      } else { const [x, y] = iso(it.z.x, it.z.y); if (it.z.raider) drawRaider(x, y, time, it.z.ph || 0); else drawRaidZ(it.z, x, y, time); if (it.z.burnT > 0) drawFlames(ctx, x, y - 6, 9, time, 2); }
    }
    if (raid) for (const f of raid.fires) { const [x, y] = iso(f.x, f.y); drawFire(ctx, { x, y, r: 3 * TW * .6, l: f.l }, time); }
    if (raid) for (const bl of raid.blasts) { const [x, y] = iso(bl.x, bl.y); drawBlast(ctx, { x, y, r: 5 * TW * .55, l: bl.l, d: .5 }); }
    ctx.restore();

    // ---- lighting (screen space; glow positions converted through the camera)
    const lit = [], spots = [], S2 = (gx, gy) => { const [x, y] = iso(gx, gy); return toScreen(x, y); };
    if (NIGHT) {
      if (powerAvail() > 0) for (const b of blds) if (b.t === 'floodlight') lit.push(S2(b.gx + .5, b.gy + .5));
      spots.push([...S2(8.4, 19.8), 70 * CAM.z, '255,170,70', .38]);
      for (const b of blds) if (b.t === 'turret') spots.push([...S2(b.gx + .5, b.gy + .5), 26 * CAM.z, '255,120,90', .25]);
    }
    drawLighting(time, lit, spots, DARK, CAM.z);
    // building labels at readable size, tracers on top
    for (const b of blds) if (['house', 'workshop', 'greenhouse', 'gazebo'].includes(b.t)) {
      const [x, y] = S2(b.gx + b.w / 2, b.gy + b.h / 2), k = KINDS[b.t];
      text(k.label, x, y - (k.hgt + (k.rh || 0) + 8) * CAM.z, 11, '#cfe', 'center');
    }
    if (raid) { ctx.save(); camXform(); for (const s of raid.shots) {
      ctx.strokeStyle = s.c || '#ff8'; ctx.lineWidth = 2 / CAM.z; ctx.beginPath();
      if (s.x1 !== undefined) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x, s.y); } else { ctx.arc(s.x, s.y, 8, 0, 7); }
      ctx.stroke();
    } ctx.restore(); }

    ctx.restore();
    this.drawUI(raid, hoverIn, hgx, hgy);
  },

  // the 3D view: the world comes from gl_base.js, the panels and HUD below are the same 2D UI
  draw3d(dt, time) {
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.5);
    if (!this.raid) LIT = false;
    DARK = darkness(save.clock); NIGHT = DARK > .55;
    const raid = this.raid, tool = this.sel, [hgx, hgy] = this.cellUnderMouse(), hoverIn = this.inBounds(hgx, hgy) && !this.overUI() && mouse.y > 40;
    let hover = null;
    if (hoverIn && !raid) {
      const o = cellAt(hgx, hgy);
      if (['upgrade', 'repair', 'sell'].includes(tool)) { if (o) hover = { tool, obj: o, ok: tool === 'sell' ? !!KINDS[o.t].cost : tool === 'upgrade' ? !!TIERS[o.t] : true }; }
      else if (KINDS[tool]) hover = { gx: hgx, gy: hgy, tool, ok: this.canPlace(tool, hgx, hgy), dir: this.fenceDir(hgx, hgy) };
    }
    R3D.base.frame(this, dt, time, hover);
    this.drawUI(raid, hoverIn, hgx, hgy);
  },

  drawUI(raid, hoverIn, hgx, hgy) {
    drawHUD();
    { const px = W - 250, py = 44, c = cap(), wx = WEATHER[save.weather];
      ctx.fillStyle = 'rgba(7,21,13,.85)'; ctx.fillRect(px, py, 238, 94); ctx.strokeStyle = DIM; ctx.strokeRect(px + .5, py + .5, 238, 94);
      text(`SOLAR ${SOLAR.kwp} kWp · BATTERY ${SOLAR.cap} kWh`, px + 8, py + 16, 11, '#ec3');
      text(`Today: ${wx.name}  ≈${(SOLAR.kwp * wx.sun * SOLAR.eff).toFixed(0)} kWh/day`, px + 8, py + 34, 11, '#9fb');
      text(`House load -${dayLoad().toFixed(0)} kWh/day (${alive().length} people)`, px + 8, py + 50, 11, '#5fa478');
      const gen = save.buildings.some(b => b.t === 'generator');
      text(gen ? `Generator: ${save.res.diesel >= 3 ? 'ready (3 L → +10 kWh)' : 'NO DIESEL'}` : 'Generator: none', px + 8, py + 66, 11, gen && save.res.diesel >= 3 ? GREEN : RED);
      text(`Throwables: molotov ${save.items.molotov} · pipe bomb ${save.items.bomb}  (Q, G)`, px + 8, py + 86, 11, '#fa5'); }
    if (save.over) {
      ctx.fillStyle = 'rgba(3,8,6,.9)'; ctx.fillRect(0, 0, W, H);
      text('THE HOUSE IS SILENT', W / 2, 270, 38, RED, 'center');
      text(`Everyone is gone. You lasted ${save.day} days.`, W / 2, 310, 16, GREEN, 'center');
      button('BACK TO TITLE', W / 2 - 80, 340, 160, 40, () => { persist(); go(titleScene); });
      return;
    }
    text(`BASE — ${HOME.name}, Timiș`, 12, 58, 15, AMBER);
    this.ui = null;
    if (raid) {
      text(`NIGHT WATCH ${fmtClock(save.clock)} — ${raid.zombies.length + raid.toSpawn + raid.raiders}/${raid.total} hostile (click to shoot)`, W / 2 - 40, 58, 14, RED, 'center');
      if (raid.result) {
        const rp = raid.report || [], oy = Math.max(40, Math.min(H / 2 - 150, H - 160 - (raid.report || []).length * (((raid.report || []).length > 12) ? 16 : 20) - 10)), lh = rp.length > 12 ? 16 : 20, oh = 150 + rp.length * lh;
        ctx.fillStyle = 'rgba(3,8,6,.88)'; ctx.fillRect(0, oy, W, oh);
        text(raid.result === 'won' ? 'DAWN — THE HOUSE HOLDS' : 'THE HOUSE WAS OVERRUN', W / 2, oy + 40, 30, raid.result === 'won' ? GREEN : RED, 'center');
        text(raid.result === 'won' ? `Killed ${raid.kills}.` : 'You lost half your supplies.', W / 2, oy + 66, 14, GREEN, 'center');
        rp.forEach((l, i) => text(l, W / 2, oy + 92 + i * lh, rp.length > 12 ? 12 : 13, /BLACKOUT|No |dry|LOW|left in the night|never came|Storage/.test(l) ? RED : '#9fb', 'center'));
        button('CONTINUE', W / 2 - 70, oy + oh - 44, 140, 34, () => { this.raid = null; afterNight(); });
      }
      return;
    }
    // ---- build panel
    const px = 8, py = 74, pw = 164, items = TABS[this.tab], desc = wrapText(TOOL_DESC[this.sel] || '', 26);
    const ph = 44 + items.length * 52 + 8 + desc.length * 13 + (this.tab === 'tools' ? 96 : 0) + 14;
    ctx.fillStyle = 'rgba(5,14,9,.86)'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = DIM; ctx.strokeRect(px + .5, py + .5, pw, ph);
    this.ui = { x: px, y: py, w: pw, h: ph };
    [['def', 'DEF'], ['trap', 'TRAP'], ['base', 'BASE'], ['tools', 'TOOL']].forEach(([k, l], i) => {
      const x = px + 6 + i * 39, w = 38; button(l, x, py + 8, w, 24, () => { this.tab = k; this.sel = TABS[k][0]; });
      if (this.tab === k) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(x, py + 8, w, 24); }
    });
    items.forEach((k, i) => {
      const cost = KINDS[k] && KINDS[k].cost ? costStr(KINDS[k].cost) : ({ repair: '2 scrap = +20 HP', sell: 'refund 50%', upgrade: 'next tier' })[k];
      const y = py + 40 + i * 52;
      button((k === 'powerbox' ? 'BATTERY' : k.toUpperCase()), px + 8, y, pw - 16, 34, () => { this.sel = k; });
      if (this.sel === k) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(px + 8, y, pw - 16, 34); }
      text(String(i + 1), px + 13, y + 11, 9, '#5fa478'); text(cost, px + 10, y + 46, 10, '#5fa478');
    });
    let ty = py + 40 + items.length * 52 + 6;
    desc.forEach((l, i) => text(l, px + 10, ty + 8 + i * 13, 10, '#9fb')); ty += desc.length * 13 + 14;
    if (this.tab === 'tools') {
      button('UPGRADE ALL', px + 8, ty, pw - 16, 30, () => this.upgradeAll());
      const cnt = [0, 0, 0, 0]; for (const b of save.buildings) if (b.t === 'fence') cnt[b.lvl || 0]++;
      text('fence tiers', px + 10, ty + 46, 10, '#5fa478');
      FENCE_LVL.forEach((f, i) => text(`${f.name}: ${cnt[i]}`, px + 10, ty + 59 + i * 12, 10, i === 3 ? '#8df' : '#5fa478'));
    }
    button('FIT VIEW', px, py + ph + 8, pw, 26, () => this.fit());
    // ---- hover info
    if (hoverIn) {
      const o = cellAt(hgx, hgy);
      if (o) {
        const tbl = TIERS[o.t], lvl = o.lvl || 0, name = tbl ? tbl[lvl].name : KINDS[o.t].label, hp = o.t === 'house' ? Math.round(save.houseHp) : Math.round(o.hp), mx = o.t === 'house' ? 100 : maxHp(o);
        const lines = [`${name}`, `HP ${hp}/${mx}`];
        if (tbl && lvl < tbl.length - 1) lines.push(`next: ${tbl[lvl + 1].name} (${costStr(tbl[lvl + 1].cost)})`); else if (tbl) lines.push('max tier');
        ctx.font = '12px monospace'; const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16, h = lines.length * 16 + 8;
        const tx = Math.min(mouse.x + 18, W - w - 6), tyy = Math.min(mouse.y + 18, H - h - 6);
        ctx.fillStyle = 'rgba(7,21,13,.94)'; ctx.fillRect(tx, tyy, w, h); ctx.strokeStyle = GREEN; ctx.strokeRect(tx + .5, tyy + .5, w, h);
        lines.forEach((s, i) => text(s, tx + 8, tyy + 18 + i * 16, 12, i ? '#9fb' : '#fff'));
      }
    }
    button('CREW', 8, H - 60, 76, 38, () => go(crewScene)); button('FLEET', 92, H - 60, 80, 38, () => go(fleetScene));
    button('GEAR', 8, H - 106, 76, 38, () => go(gearScene)); button('CRAFT', 92, H - 106, 80, 38, () => go(craftScene));
    button('◂ MAP', W - 190, H - 106, 170, 38, () => go(mapScene));
    if (TOUCH.on) { button(this.panMode ? 'PAN ✓' : 'PAN', W - 250, 204, 76, 30, () => { this.panMode = !this.panMode; }); button('+', W - 168, 204, 40, 30, () => this.wheel(1.4, W / 2, H / 2)); button('−', W - 120, 204, 40, 30, () => this.wheel(1 / 1.4, W / 2, H / 2)); }
    button('OUTPOSTS', W - 190, H - 198, 170, 38, () => go(outpostsScene)); button('ROOMS', W - 190, H - 152, 82, 38, () => go(roomsScene)); button('RADIO', W - 102, H - 152, 82, 38, () => go(tradeScene), roomLvl('radio') > 0);
    { const gx = W - 250, gy = 144, C = CHAPTERS[Math.min(save.goal.ch, CHAPTERS.length - 1)];
      ctx.fillStyle = 'rgba(7,21,13,.85)'; ctx.fillRect(gx, gy, 238, 52); ctx.strokeStyle = AMBER; ctx.strokeRect(gx + .5, gy + .5, 238, 52);
      text(`OBJECTIVE ${Math.min(save.goal.ch + 1, 5)}/5: ${C.t}`, gx + 8, gy + 17, 11, AMBER);
      text(C.prog().slice(0, 40), gx + 8, gy + 34, 10, '#9fb'); text('click for details', gx + 8, gy + 46, 9, '#5fa478');
      btns.push({ x: gx, y: gy, w: 238, h: 52, cb: () => go(goalsScene) }); }
    button(save.clock >= DUSK ? 'NIGHT WATCH ☾' : 'END DAY ☾', W - 190, H - 60, 170, 38, () => { if (save.clock >= DUSK) go(planScene); else this.confirmEnd = true; });
    text(save.clock >= 17.5 ? `Dusk is coming: night watch at ${DUSK}:00` : `Daylight until ${DUSK}:00 · END DAY starts the night watch`, W / 2 + 40, 58, 12, save.clock >= 17.5 ? AMBER : '#9fb', 'center');
    if (this.confirmEnd) {   // "End day?" confirmation: swallow every other button while it is up
      btns.length = 0;
      ctx.fillStyle = 'rgba(3,8,6,.78)'; ctx.fillRect(0, 0, W, H);
      const bx = W / 2 - 230, by = H / 2 - 100;
      ctx.fillStyle = '#07150d'; ctx.fillRect(bx, by, 460, 190); ctx.strokeStyle = AMBER; ctx.strokeRect(bx + .5, by + .5, 460, 190);
      text('END THE DAY?', W / 2, by + 40, 22, AMBER, 'center');
      text(`It is ${fmtClock(save.clock)}. The night watch starts now and daylight is lost.`, W / 2, by + 72, 13, '#cfe', 'center');
      text('Unfinished scavenging, crafting and trading wait until tomorrow.', W / 2, by + 92, 11, '#8aa', 'center');
      button('NO, KEEP GOING', bx + 24, by + 120, 200, 44, () => { this.confirmEnd = false; });
      button('YES, END DAY', bx + 236, by + 120, 200, 44, () => { this.confirmEnd = false; go(planScene); });
      if (keys.Escape) { keys.Escape = false; this.confirmEnd = false; }
    }
    { const ft = forecastText(); if (ft && !raid) text('Tonight: ' + ft, W / 2 + 40, 76, 11, '#fa5', 'center'); }
    drawTip('base');
    text(R3D.ok ? 'right-drag / WASD: pan · middle-drag or [ ]: rotate · wheel: zoom · drag to paint fences & walls · 1-4: pick item · F: reset view' : 'right-drag / WASD: pan · wheel: zoom · drag to paint fences & walls · 1-4: pick item · F: fit view', W / 2, H - 14, 11, '#5fa478', 'center');
  },
};
