// Workshop (crafting), gear, and fleet screens.
// =====================================================================
// CREW SCENE
// =====================================================================
// =====================================================================
// FLEET SCENE
// =====================================================================
const fleetScene = {
  fixed: true,
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    drawHUD();
    text(`FLEET — ${save.vehicles.length}/${FLEET_MAX} parking spaces used`, W / 2, 70, 18, AMBER, 'center');
    text('Dealerships in Timișoara have keys. EVs burn no diesel: charge them from solar surplus, or from the house battery below.', W / 2, 90, 11, '#5fa478', 'center');
    text(`House battery ${save.energy.toFixed(1)}/${cap()} kWh · EV V2L reserve ${v2lPool().toFixed(1)} kWh`, W / 2, 106, 11, '#ec3', 'center');
    if (!save.vehicles.length) text('No vehicles. You can only go on foot.', W / 2, 200, 15, RED, 'center');
    save.vehicles.forEach((v, i) => {
      const y = 120 + i * 100, T = VEHICLE_TYPES[v.type], active = i === Math.min(save.vi, save.vehicles.length - 1);
      ctx.fillStyle = '#07150d'; ctx.fillRect(110, y, W - 220, 88); ctx.strokeStyle = active ? AMBER : DIM; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(110.5, y + .5, W - 220, 88);
      ctx.fillStyle = v.color; ctx.fillRect(126, y + 30, 46, 20); ctx.fillStyle = 'rgba(20,30,40,.8)'; ctx.fillRect(150, y + 33, 16, 10);
      if (T.ev) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(134, y + 38, 3, 8); }
      text(v.name, 190, y + 24, 15, '#fff'); text(T.label.toUpperCase() + (active ? '  · ACTIVE' : ''), 190, y + 42, 11, active ? AMBER : '#9fb');
      if (T.ev) {
        text(`${T.speed} km/h · carries ${T.cap} · ${T.kwhkm} kWh/km`, 190, y + 58, 11, '#9fb');
        const pct = v.charge / T.batt; ctx.fillStyle = '#10243a'; ctx.fillRect(190, y + 66, 200, 10); ctx.fillStyle = pct > .3 ? '#4aa8ff' : '#f55'; ctx.fillRect(190, y + 66, 200 * pct, 10);
        text(`${v.charge.toFixed(0)}/${T.batt} kWh`, 398, y + 75, 11, '#7affc8');
        button('CHARGE +10', 470, y + 12, 110, 32, () => { const a = Math.min(10, save.energy * .9, T.batt - v.charge); if (a > .2) { save.energy -= a / .9; v.charge += a; persist(); } else say('No energy to transfer, or EV full'); });
        button(`V2L ${v.v2l ? 'ON' : 'OFF'}`, 470, y + 48, 110, 28, () => { v.v2l = !v.v2l; persist(); });
      } else text(`${T.speed} km/h · carries ${T.cap} · fuel x${T.fuel} (diesel)`, 190, y + 58, 11, '#9fb');
      { const hp = v.hp == null ? 100 : v.hp; ctx.fillStyle = '#222'; ctx.fillRect(190, y + 80, 150, 5); ctx.fillStyle = hp < 30 ? RED : hp < 60 ? '#fc4' : GREEN; ctx.fillRect(190, y + 80, 150 * hp / 100, 5); text(`condition ${Math.round(hp)}%${hp <= 0 ? ' · WRECKED' : ''}`, 348, y + 86, 10, hp < 30 ? RED : '#9fb');
        button(`REPAIR +${repairAmt()} · ${repairCost()} scrap`, W - 340, y + 62, 220, 22, () => { v.hp = Math.min(100, hp + repairAmt()); save.res.scrap -= repairCost(); persist(); }, hp < 100 && save.res.scrap >= repairCost()); }
      button('USE', W - 340, y + 26, 80, 34, () => { save.vi = i; persist(); }, !active);
      button('SCRAP +' + ((8 + T.cap / 5 | 0) * (crewPerk('recycler') ? 2 : 1)), W - 250, y + 26, 130, 34, () => { save.res.scrap += (8 + T.cap / 5 | 0) * (crewPerk('recycler') ? 2 : 1); save.vehicles.splice(i, 1); save.vi = 0; persist(); });
    });
    button('◂ BACK', W - 190, H - 60, 170, 38, () => go(baseScene));
  },
};

// =====================================================================
// CRAFT SCENE — the workshop. Crafting takes daylight hours.
// =====================================================================
const craftHours = r => r.hours * (has('engineer') ? .75 : 1);
function craftBlock(r) {   // why this can't be crafted right now ('' if it can)
  if (!save.buildings.some(b => b.t === 'workshop')) return 'workshop destroyed';
  if (r.upgrade && save.upgrades[r.upgrade]) return 'already built';
  for (const k in r.cost) if (save.res[k] < r.cost[k]) return 'missing ' + k;
  if (save.clock + craftHours(r) > DUSK) return 'not enough daylight';
  return '';
}
function doCraft(r) {
  const why = craftBlock(r); if (why) { say(`Can't craft: ${why}`); return; }
  for (const k in r.cost) save.res[k] -= r.cost[k];
  save.clock += craftHours(r);
  let msg = r.name;
  if (r.give) for (const k in r.give) { const n = r.give[k] + (r.medicBonus && has('medic') ? r.medicBonus : 0); save.res[k] += n; msg = `+${n} ${k}`; }
  if (r.items) for (const k in r.items) { save.items[k] += r.items[k]; msg = `+${r.items[k]} ${k === 'bomb' ? 'pipe bomb' : k}`; }
  if (r.gear) { save.gear.stash.push(r.gear); msg = `Crafted ${GEAR_BY_ID[r.gear].name}`; }
  if (r.upgrade) { save.upgrades[r.upgrade] = true; msg = `${r.name} fitted`; }
  persist(); say(msg);
}
const craftScene = {
  fixed: true,
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    drawHUD();
    text('WORKSHOP — CRAFTING', W / 2, 66, 18, AMBER, 'center');
    const ws = save.buildings.some(b => b.t === 'workshop');
    text(ws ? `Each craft takes daylight hours${has('engineer') ? ' (engineer: 25% faster)' : ''}. ${Math.max(0, DUSK - save.clock).toFixed(1)} h of light left today.` : 'The workshop was destroyed, so there is nothing to craft with.', W / 2, 88, 12, ws ? '#9fb' : RED, 'center');
    RECIPES.forEach((r, i) => {
      const col = i < 6 ? 0 : 1, row = i < 6 ? i : i - 6, x = 36 + col * 462, y = 100 + row * 71, why = craftBlock(r);
      ctx.fillStyle = '#07150d'; ctx.fillRect(x, y, 450, 66); ctx.strokeStyle = why ? '#1c3a28' : DIM; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, 450, 66);
      text(r.name, x + 12, y + 19, 14, why ? '#8aa' : '#fff'); text(r.desc, x + 12, y + 35, 10, '#9fb');
      let cx = x + 12; for (const k in r.cost) { const ok = save.res[k] >= r.cost[k], s = `${r.cost[k]} ${k}`; text(s, cx, y + 54, 11, ok ? GREEN : RED); cx += s.length * 6.9 + 10; }
      text(`${craftHours(r).toFixed(2).replace(/0$/, '')} h`, x + 12 + 230, y + 54, 10, '#5fa478');
      if (why) text(why, x + 290, y + 54, 10, RED);
      button('CRAFT', x + 356, y + 12, 84, 32, () => doCraft(r), !why);
    });
    text(`Throwables: molotov x${save.items.molotov} · pipe bomb x${save.items.bomb}   (Q switches, G throws)    Shells: ${save.res.shells}   ${save.upgrades.suppressor ? 'Suppressor fitted' : ''}`, W / 2, H - 12, 12, '#fa5', 'center');
    button('◂ BACK', W - 190, H - 60, 170, 38, () => go(baseScene));
  },
};

// =====================================================================
// GEAR SCENE — what you wear and carry, weapons included
// =====================================================================
const gearStatText = it => it.slot === 'ranged' ? `${it.dmg}${it.pellets > 1 ? 'x' + it.pellets : ''} dmg · ${(1 / it.rate).toFixed(1)}/s · ${it.ammo === 'shells' ? 'shells' : 'ammo'} · ${it.noise <= 320 ? 'quiet' : it.noise >= 640 ? 'very loud' : 'loud'}`
  : it.slot === 'melee' ? `${it.dmg} dmg · reach ${it.reach} · near silent`
  : [it.cap ? `+${it.cap} carry` : '', it.armor ? `-${Math.round(it.armor * 100)}% damage` : '', it.speed ? `+${Math.round(it.speed * 100)}% speed` : ''].filter(Boolean).join('  ');
const gearValue = it => it.slot === 'ranged' ? it.dmg * (it.pellets || 1) / it.rate * 3 : it.slot === 'melee' ? it.dmg / it.rate * 6 : (it.cap || 0) + (it.armor || 0) * 100 + (it.speed || 0) * 100;
const gearScene = {
  fixed: true,
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    drawHUD();
    const gs = gearStats();
    text('GEAR', W / 2, 66, 18, AMBER, 'center');
    text(`Carry +${gs.cap} · damage taken -${Math.round(gs.armor * 100)}% · speed +${Math.round(gs.speed * 100)}%`, W / 2, 88, 13, '#9fb', 'center');
    text('EQUIPPED', 40, 114, 12, '#5fa478');
    ['ranged', 'melee', 'pack', 'body', 'boots'].forEach((slot, i) => {
      const it = GEAR_BY_ID[save.gear.eq[slot]], y = 122 + i * 78, R = RARITY[it.r];
      ctx.fillStyle = '#07150d'; ctx.fillRect(40, y, 380, 70); ctx.strokeStyle = R.col; ctx.lineWidth = 1.5; ctx.strokeRect(40.5, y + .5, 380, 70);
      text(GEAR_SLOTS[slot], 54, y + 16, 10, '#5fa478');
      ctx.fillStyle = it.col; ctx.fillRect(54, y + 26, 34, 34); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeRect(54.5, y + 26.5, 34, 34);
      text(it.name, 100, y + 36, 14, R.col); text(R.name, 100, y + 50, 10, '#9fb'); text(gearStatText(it) || 'no bonus', 100, y + 64, 11, '#cfe');
    });
    text(`STASH (${save.gear.stash.length})`, 450, 114, 12, '#5fa478');
    if (!save.gear.stash.length) text('Nothing yet. Loot shops, houses, police and army sites, and gangs, or craft some.', 450, 150, 12, '#5fa478');
    save.gear.stash.slice(0, 10).forEach((id, i) => {
      const it = GEAR_BY_ID[id], y = 122 + i * 42, R = RARITY[it.r], cur = GEAR_BY_ID[save.gear.eq[it.slot]];
      ctx.fillStyle = '#07150d'; ctx.fillRect(450, y, 470, 38); ctx.strokeStyle = '#1c3a28'; ctx.lineWidth = 1; ctx.strokeRect(450.5, y + .5, 470, 38);
      ctx.fillStyle = it.col; ctx.fillRect(458, y + 9, 20, 20);
      text(it.name, 486, y + 16, 13, R.col); text(`${GEAR_SLOTS[it.slot].toLowerCase()} · ${gearStatText(it)}`, 486, y + 31, 10, '#9fb');
      button('WEAR' + (gearValue(it) > gearValue(cur) ? ' ▲' : ''), 776, y + 5, 66, 28, () => { const old = save.gear.eq[it.slot]; save.gear.eq[it.slot] = id; save.gear.stash.splice(i, 1); save.gear.stash.push(old); persist(); });
      button('+' + R.scrap, 848, y + 5, 62, 28, () => { save.res.scrap += R.scrap; save.gear.stash.splice(i, 1); persist(); });
    });
    if (save.gear.stash.length > 10) text(`+${save.gear.stash.length - 10} more`, 450, 122 + 10 * 42 + 8, 11, '#5fa478');
    text('The + button scraps an item for scrap.', 450, H - 40, 11, '#5fa478');
    button('◂ BACK', W - 190, H - 60, 170, 38, () => go(baseScene));
  },
};

