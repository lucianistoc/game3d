// What happens on the way and at the site beyond grabbing crates: mission objectives (rescue, clear, boss, vault,
// sneak), hazards (fire, collapsing floor), vehicle condition and the road encounters on a drive.

// ---------------------------------------------------------------- vehicle condition
const condMul = v => v ? .7 + .3 * clamp((v.hp == null ? 100 : v.hp) / 100, 0, 1) : 1;   // a battered vehicle is slower
const wearVehicle = (v, n) => { if (v) v.hp = Math.max(0, Math.round((v.hp == null ? 100 : v.hp) - n * (has('mechanic') ? .6 : 1) * (crewPerk('tuner') ? .5 : 1))); };
const repairCost = () => 6, repairAmt = () => has('mechanic') ? 35 : 25;

// ---------------------------------------------------------------- objectives
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const OBJ = {
  rescue: { label: 'RESCUE',   brief: 'A survivor is trapped here. Free them and get them out alive.' },
  clear:  { label: 'CLEAR',    brief: 'Kill every infected in the building to uncover a hidden cache.' },
  boss:   { label: 'MUTANT',   brief: 'Something huge is nesting here. Kill it for rare loot.' },
  vault:  { label: 'VAULT',    brief: 'A locked vault, and a keycard somewhere on site.' },
  camp:   { label: 'ASSAULT',  brief: 'The Reapers\' camp. Kill their leader to break the gang.' },
  sneak:  { label: 'DATA',     brief: 'Retrieve a data drive without raising the noise meter past 70.' },
};
const INDOOR_KINDS = ['store', 'hardware', 'outfitter', 'pharmacy', 'warehouse', 'pharma_wh', 'hospital', 'police', 'university', 'airport'];
function objFor(town) {   // decided by the site and the day, so the briefing and the mission agree
  if (town.kind === 'camp') return 'camp';
  const R = seeded(hashStr(town.name + ':' + save.day)); if (R() > .55) return null;
  const kind = town.type === 'spot' ? town.kind : 'ruins', indoor = INDOOR_KINDS.includes(kind), d = town.danger + save.day / 4;
  const w = { rescue: 2, clear: 2, vault: indoor ? 1.5 : 0, sneak: indoor ? 1.2 : 0, boss: d >= 3.5 && save.day >= 5 ? 1.2 : 0 };
  let x = R() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) if ((x -= v) <= 0) return k;
  return null;
}
function findSpot(m, free, w, h) {
  for (let i = 0; i < 300; i++) {
    const x = rand(m.bounds.x0 + 30, m.bounds.x1 - w - 30), y = rand(m.bounds.y0 + 30, m.bounds.y1 - h - 30);
    if (Math.hypot(x + w / 2 - m.p.x, y + h / 2 - m.p.y) > 200 && free(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 12)) return [x, y];
  }
  return [m.bounds.x0 + 60, m.bounds.y0 + 60];
}
function setupObjective(m, town, place, free) {
  const type = objFor(town); m.noisePeak = 0; if (!type) { m.obj = null; return; }
  const o = m.obj = { type, done: false, failed: false, msg: '' };
  if (type === 'rescue') {
    const [x, y] = findSpot(m, free, 44, 44); const cx = x + 22, cy = y + 22;
    m.walls.push({ x, y, w: 44, h: 44, style: 'inv', cage: true }); m.npc = { x: cx, y: cy, hp: 6, state: 'caged', free: 0, a: 0, walk: 0 };
  } else if (type === 'clear') {
    o.total = m.zombies.length; m.zombies.forEach(z => { z.init = true; });
  } else if (type === 'camp') {
    for (let i = 0; i < 5; i++) { const [x, y] = place(); m.humans.push({ x, y, r: 10, hp: 3, wa: rand(0, 6.28), wander: 0, alert: false, shotT: rand(.5, 1.5), a: 0, icoT: 0 }); }
    const [lx, ly] = findSpot(m, free, 40, 40); const L = { x: lx + 20, y: ly + 20, r: 12, hp: 14, wa: 0, wander: 0, alert: false, shotT: .9, a: 0, icoT: 0, leader: true }; m.humans.push(L); m.leader = L;
  } else if (type === 'boss') {
    const [x, y] = findSpot(m, free, 60, 60), Z = ZTYPES.mutant, z = m.mkZ('mutant', x + 30, y + 30, 'idle');
    z.hp = Z.hp * (1 + save.day / 25); z.maxhp = z.hp; z.boss = true; z.chT = 3; m.zombies.push(z); m.boss = z;
  } else if (type === 'vault') {
    const [x, y] = findSpot(m, free, 96, 56); m.walls.push({ x, y, w: 96, h: 56, style: 'inv', vault: true });
    const [cx, cy] = place(); m.crates.push({ x: cx, y: cy, k: 'card', card: true });
  } else if (type === 'sneak') {
    const [cx, cy] = findSpot(m, free, 20, 20); m.crates.push({ x: cx + 10, y: cy + 10, k: 'drive', drive: true });
  }
}
const vaultRect = m => m.walls.find(w => w.vault);
function objUpdate(m, dt) {
  const o = m.obj; m.noisePeak = Math.max(m.noisePeak || 0, m.noiseLvl); if (!o) return;
  if (o.type === 'rescue' && m.npc) {
    const n = m.npc;
    if (n.state === 'caged') {
      if (Math.hypot(m.p.x - n.x, m.p.y - n.y) < 52 && kdown('use')) { n.free += dt; if (n.free > 2.5) { n.state = 'follow'; m.walls = m.walls.filter(w => !w.cage); m.noise(n.x, n.y, 220, 3); say('Free! Keep them alive and leave.'); sfx('ok'); } }
      else n.free = Math.max(0, n.free - dt * 2);
    } else if (n.state === 'follow' && n.hp > 0) {
      const d = Math.hypot(m.p.x - n.x, m.p.y - n.y); n.a = Math.atan2(m.p.y - n.y, m.p.x - n.x); n.moving = d > 60;
      if (d > 60) { m.moveBlocked(n, Math.cos(n.a) * 125 * dt, Math.sin(n.a) * 125 * dt, 9); n.walk += dt * 1.4; }
      for (const z of m.zombies) if (Math.hypot(z.x - n.x, z.y - n.y) < z.r + 9) n.hp -= z.dmg * dt * .5;
      for (const e of m.ebullets) if (Math.hypot(e.x - n.x, e.y - n.y) < 10) { e.l = 0; n.hp -= 3; }
      if (n.hp <= 0) { n.state = 'dead'; o.failed = true; say('The survivor was killed.'); m.burst(n.x, n.y, '#fa6', 10); }
    }
    o.done = n.state === 'follow' && n.hp > 0;
  } else if (o.type === 'clear' && !o.done) {
    const left = m.zombies.filter(z => z.init && !z.dead).length;
    if (left === 0) {
      o.done = true; say('The building is clear: a cache is revealed!'); sfx('ok');
      for (const k of ['gear', 'weapon', 'meds']) { const [x, y] = m.p.x ? [m.p.x + rand(-80, 80), m.p.y + rand(-60, 60)] : [480, 320]; m.crates.push(k === 'gear' ? { x, y, k, g: rollGear('outfit') } : k === 'weapon' ? { x, y, k: 'gear', g: rollWeapon(m.town && m.town.wpool) } : { x, y, k }); }
    }
  } else if (o.type === 'camp') {
    if (m.leader && m.leader.dead && !o.done) { o.done = true; say('The Reaper leader is dead!'); sfx('ok'); for (let i = 0; i < 4; i++) { const k = ['weapon', 'ammo', 'shells', 'gear'][i]; const x = m.leader.x + rand(-50, 50), y = m.leader.y + rand(-40, 40); m.crates.push(k === 'gear' ? { x, y, k, g: rollGear('gang') } : k === 'weapon' ? { x, y, k: 'gear', g: rollWeapon('army') } : { x, y, k }); } }
  } else if (o.type === 'boss') {
    if (m.boss && m.boss.dead && !o.done) { o.done = true; const b = m.boss; say('The mutant is down! Loot it.'); sfx('ok'); const hi = GEAR_ITEMS.filter(g => (g.slot === 'pack' || g.slot === 'body' || g.slot === 'boots') && g.r >= 2), pk = () => hi[Math.floor(Math.random() * hi.length)].id;
      m.crates.push({ x: b.x - 30, y: b.y, k: 'gear', g: pk() }, { x: b.x + 30, y: b.y, k: 'gear', g: rollWeapon('army') }, { x: b.x, y: b.y + 34, k: 'meds' }); }
  } else if (o.type === 'vault') {
    const v = vaultRect(m);
    if (v) {
      const ddx = Math.max(v.x - m.p.x, 0, m.p.x - (v.x + v.w)), ddy = Math.max(v.y - m.p.y, 0, m.p.y - (v.y + v.h));
      if (Math.hypot(ddx, ddy) < 30 && kdown('use')) {
        if (!m.hasCard) { if (!m.vaultMsgT || m.vaultMsgT < m.time) { say('Locked. Find the keycard.'); m.vaultMsgT = m.time - 2; } }
        else { v.open = (v.open || 0) + dt; if (v.open > 1.4) { m.walls = m.walls.filter(w => w !== v); o.done = true; sfx('ok'); say('The vault is open!'); m.noise(v.x, v.y, 260, 3);
          for (let i = 0; i < 4; i++) { const k = ['weapon', 'gear', 'meds', 'ammo', 'shells'][Math.floor(Math.random() * 5)]; const x = v.x + 20 + (i % 2) * 52, y = v.y + 16 + Math.floor(i / 2) * 26; m.crates.push(k === 'gear' ? { x, y, k, g: rollGear('outfit') } : k === 'weapon' ? { x, y, k: 'gear', g: rollWeapon('army') } : { x, y, k }); } } }
      } else v.open = Math.max(0, (v.open || 0) - dt * 2);
    }
  } else if (o.type === 'sneak') {
    o.done = !!o.got && m.noisePeak <= 70; o.failed = !!o.got && m.noisePeak > 70 || (!o.got && m.noisePeak > 70);
  }
}
function objPickup(m, c) {   // special crates; returns true if handled
  const o = m.obj;
  if (c.card) { c.got = true; m.hasCard = true; say('Found the vault keycard!'); sfx('gear'); return true; }
  if (c.drive) { c.got = true; if (o) o.got = true; say(m.noisePeak > 70 ? 'Got the data drive, but you were too loud.' : 'Got the data drive. Stay quiet.'); sfx('pickup'); return true; }
  return false;
}
function objDraw(m, t) {   // vault, cage and survivor are dynamic so opening them needs no floor redraw
  const v = vaultRect(m);
  if (v) {
    ctx.fillStyle = '#2a3642'; ctx.fillRect(v.x, v.y, v.w, v.h); for (let i = 4; i < v.w; i += 8) { ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.moveTo(v.x + i, v.y); ctx.lineTo(v.x + i, v.y + v.h); ctx.stroke(); }
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeRect(v.x + 1.5, v.y + 1.5, v.w - 3, v.h - 3);
    ctx.fillStyle = '#d8b030'; ctx.fillRect(v.x + v.w / 2 - 9, v.y + v.h / 2 - 5, 18, 14); ctx.strokeStyle = '#d8b030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.x + v.w / 2, v.y + v.h / 2 - 5, 7, Math.PI, 0); ctx.stroke();
    text('VAULT', v.x + v.w / 2, v.y + 14, 10, '#9ab', 'center');
    if (v.open) { ctx.fillStyle = '#000'; ctx.fillRect(v.x, v.y + v.h + 4, v.w, 5); ctx.fillStyle = '#6fe'; ctx.fillRect(v.x, v.y + v.h + 4, v.w * Math.min(1, v.open / 1.4), 5); }
  }
  const n = m.npc;
  if (n && n.state === 'caged') {
    ctx.fillStyle = 'rgba(20,24,28,.55)'; ctx.fillRect(n.x - 22, n.y - 22, 44, 44);
    drawPersonTop(ctx, n, 0, t, { coat: '#c0792b', hat: '#5a3a1a', moving: false });
    ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 2; for (let i = -18; i <= 18; i += 9) { ctx.beginPath(); ctx.moveTo(n.x + i, n.y - 22); ctx.lineTo(n.x + i, n.y + 22); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(230,190,40,.85)'; ctx.lineWidth = 3; ctx.strokeRect(n.x - 22, n.y - 22, 44, 44);
    if (Math.hypot(m.p.x - n.x, m.p.y - n.y) < 52) { ctx.fillStyle = '#000'; ctx.fillRect(n.x - 22, n.y + 28, 44, 5); ctx.fillStyle = '#6fe'; ctx.fillRect(n.x - 22, n.y + 28, 44 * Math.min(1, n.free / 2.5), 5); text('HOLD E', n.x, n.y - 30, 11, '#fff', 'center'); }
  }
}
function objHud(m, time) {
  const o = m.obj; if (!o) return; const O = OBJ[o.type]; let s = '';
  if (o.type === 'rescue') s = !m.npc ? '' : m.npc.state === 'caged' ? 'free the survivor (hold E at the cage)' : m.npc.state === 'follow' ? `keep them alive (HP ${Math.max(0, Math.ceil(m.npc.hp))}) and leave` : 'the survivor died';
  else if (o.type === 'clear') s = o.done ? 'cache revealed' : `${m.zombies.filter(z => z.init && !z.dead).length} of ${o.total} infected left`;
  else if (o.type === 'boss') s = o.done ? 'mutant dead: take the loot' : 'kill the mutant';
  else if (o.type === 'camp') s = o.done ? 'the gang is broken: loot and leave' : `kill the leader (${m.humans.filter(h => !h.dead).length} guns in the camp)`;
  else if (o.type === 'vault') s = o.done ? 'vault open' : m.hasCard ? 'take the card to the vault and hold E' : 'find the keycard';
  else if (o.type === 'sneak') s = o.failed ? 'too loud: the drive is worthless' : o.got ? 'got it: stay quiet and leave' : `find the data drive (noise peak ${Math.round(m.noisePeak)}/70)`;
  text(`◆ ${O.label}: ${s}`, W / 2, 108, 12, o.done ? '#6f8' : o.failed ? '#f77' : '#ffd070', 'center');
  if (m.boss && !m.boss.dead && (m.boss.state === 'chase' || m.boss.hit > 0)) { const b = m.boss; ctx.fillStyle = '#300'; ctx.fillRect(W / 2 - 150, 122, 300, 8); ctx.fillStyle = '#e44'; ctx.fillRect(W / 2 - 150, 122, 300 * Math.max(0, b.hp) / b.maxhp, 8); text('MUTANT', W / 2, 144, 10, '#f99', 'center'); }
}
function objFinish(m, ok) {
  const o = m.obj; m.objMsg = ''; if (!o || !ok) return;
  if (o.type === 'rescue' && o.done) {
    const c = recruit(); if (c) { m.objMsg = `${c.name} joins you as a ${ROLES[c.role].label.toLowerCase()}`; } else { giveRes({ food: 8, water: 6, ammo: 8 }); m.objMsg = 'The survivor gives you their supplies (no room to take them in)'; }
    facRep('farmers', 3); logEvent(`Rescued a survivor at ${m.town.short || m.town.name}`);
  } else if (o.type === 'camp' && o.done) { save.reapers = { state: 'destroyed', until: 0 }; facRep('militia', 10); facRep('farmers', 8); logEvent('The Reapers were destroyed'); m.objMsg = 'The Reapers are finished. The roads are quieter.'; }
  else if (o.type === 'boss' && o.done) { facRep('militia', 3); logEvent(`Killed a mutant at ${m.town.short || m.town.name}`); m.objMsg = 'The militia will hear about the mutant (+standing)'; }
  else if (o.type === 'clear' && o.done) { facRep('militia', 1); logEvent(`Cleared ${m.town.short || m.town.name}`); m.objMsg = 'Building cleared'; }
  else if (o.type === 'vault' && o.done) logEvent(`Opened the vault at ${m.town.short || m.town.name}`);
  else if (o.type === 'sneak' && o.done) {
    const g = {}; for (let i = 0; i < 3; i++) { const k = pickOf(RES_KEYS); g[k] = (g[k] || 0) + ri(5, 9); } giveRes(g); facRep('militia', 3); addIntel(`The data drive from ${m.town.short || m.town.name} paid off`); m.objMsg = `Data drive delivered: ${gainTxt(g)}, militia standing up`; logEvent(`Delivered a data drive from ${m.town.short || m.town.name}`);
  }
}

// ---------------------------------------------------------------- hazards
function setupHazards(m, town, place, free) {
  m.cracks = []; m.hazT = rand(10, 25); m.fireHaz = Math.random() < .25;
  if (Math.random() < .3) for (let i = 0; i < 2; i++) { const [x, y] = place(); m.cracks.push({ x, y, r: 30, t: 0, st: 'idle' }); m.crates.push({ x: x + rand(-18, 18), y: y + rand(-18, 18), k: pickOf(['scrap', 'meds', 'ammo', 'food']) }); }
}
function hazUpdate(m, dt) {
  if (m.fireHaz) { m.hazT -= dt; if (m.hazT <= 0) { m.fireHaz = false; for (let i = 0; i < 2; i++) { const x = rand(m.bounds.x0 + 60, m.bounds.x1 - 60), y = rand(m.bounds.y0 + 60, m.bounds.y1 - 60); if (Math.hypot(x - m.p.x, y - m.p.y) > 120) m.fires.push({ x, y, l: 40, r: 46 }); } say('A fire breaks out!'); sfx('fire'); } }
  for (const c of m.cracks) {
    if (c.st !== 'idle') continue;
    if (Math.hypot(m.p.x - c.x, m.p.y - c.y) < c.r) c.t += dt; else c.t = Math.max(0, c.t - dt * .5);
    if (c.t > .7) {
      c.st = 'hole'; m.walls.push({ x: c.x - 26, y: c.y - 26, w: 52, h: 52, style: 'inv', hole: true }); sfx('boom', .5); m.shake = Math.max(m.shake, .5); m.noise(c.x, c.y, 300, 3);
      const d = Math.hypot(m.p.x - c.x, m.p.y - c.y); if (d < 38) { m.p.hp -= 14 * (1 - m.armor); const a = Math.atan2(m.p.y - c.y, m.p.x - c.x) || 1; m.p.x = c.x + Math.cos(a) * 46; m.p.y = c.y + Math.sin(a) * 46; say('The floor gives way!'); }
    }
  }
}
function hazDraw(m, t) {
  for (const c of m.cracks) {
    if (c.st === 'idle') { ctx.strokeStyle = `rgba(20,14,8,${.55 + c.t * .4})`; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.05 + .3; ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * 24, c.y + Math.sin(a) * 18); ctx.lineTo(c.x + Math.cos(a + .2) * 31, c.y + Math.sin(a + .2) * 25); } ctx.stroke(); if (c.t > .05) { ctx.fillStyle = 'rgba(180,160,120,.25)'; ctx.beginPath(); ctx.arc(c.x, c.y, 28 * Math.min(1, c.t + .2), 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 27, 24, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 3; ctx.stroke(); }
  }
}

// ---------------------------------------------------------------- road encounters on a drive
const ROAD_EVENTS = {
  roadblock: {
    title: 'ROADBLOCK', when: () => true, w: 3, text: () => 'Wrecked cars are dragged across the road ahead. Whoever put them there is gone, or hiding.',
    choices: [
      { label: 'Go around the fields (+1 h, +1 L)', act: () => { save.res.diesel = Math.max(0, save.res.diesel - 1); return { msg: 'Slow going over the plough, but you are through.', hours: 1 }; } },
      { label: 'Push through (vehicle -15 condition)', act: () => { const v = veh(); wearVehicle(v, 15); return Math.random() < .3 ? { msg: 'You get stuck for a while before it gives.', hours: 1.5 } : { msg: 'Metal screams and you are through.', hours: 0 }; } },
      { label: 'Strip the wrecks for scrap (+1.5 h)', act: () => { const n = ri(5, 10); save.res.scrap += n; return { msg: `+${n} scrap from the wrecks.`, hours: 1.5, hp: 85 }; } },
    ],
  },
  toll: {
    title: 'THE REAPERS\' TOLL', when: () => save.fac.reapers.rep < 25 && reapersLive(), w: 3,
    text: () => 'A pickup blocks the road. Armed men lean on it and one of them waves a rifle: "Toll. Pay up or turn back."',
    choices: [
      { label: 'Pay 12 scrap', ok: () => save.res.scrap >= 12, act: () => { save.res.scrap -= 12; facRep('reapers', 2); return { msg: 'They wave you through, grinning.', hours: 0 }; } },
      { label: 'Floor it (vehicle -10, might get shot)', act: () => { wearVehicle(veh(), 10); facRep('reapers', -5); return Math.random() < .5 ? { msg: 'Shots ring off the bodywork. You are hurt, but through.', hours: 0, hp: 70 } : { msg: 'Nobody hits anything. You are through.', hours: 0 }; } },
      { label: 'Turn back', act: () => ({ msg: 'You turn around. Nothing gained, nothing lost.', abort: true, hours: .5 }) },
    ],
  },
  breakdown: {
    title: 'BREAKDOWN', when: () => veh() && (veh().hp || 0) < 45, w: 8,
    text: () => 'The engine coughs, shudders and dies at the roadside. The vehicle is in a bad way.',
    choices: [
      { label: has => (has('mechanic') ? 'Fix it on the spot (the mechanic is on it)' : 'Patch it up (8 scrap, +1 h)'), ok: () => has('mechanic') || save.res.scrap >= 8, act: () => { if (!has('mechanic')) save.res.scrap -= 8; const v = veh(); v.hp = Math.min(100, (v.hp || 0) + 15); return { msg: 'It starts, for now.', hours: has('mechanic') ? .3 : 1 }; } },
      { label: 'Limp on (vehicle -10, +0.5 h)', act: () => { wearVehicle(veh(), 10); return { msg: 'It smokes but keeps going.', hours: .5 }; } },
      { label: 'Abandon it and walk the rest', act: () => ({ msg: 'You walk. The trip will take much longer.', walk: true, hours: 0 }) },
    ],
  },
  stranded: {
    title: 'STRANDED TRAVELLER', when: () => true, w: 2, text: () => 'A woman waves from beside a dead tractor, a child on her hip.',
    choices: [
      { label: 'Stop and help (+1 h)', act: () => { facRep('farmers', 3); const g = { food: ri(4, 8) }; giveRes(g); return { msg: `They are grateful and press ${g.food} food on you.`, hours: 1 }; } },
      { label: 'Drive on', act: () => ({ msg: 'You keep going. Nobody speaks for a bit.', hours: 0 }) },
    ],
  },
  ambush: {
    title: 'AMBUSH', when: () => save.day >= 4, w: 3, text: () => 'Muzzle flashes from a ditch. Someone wants your vehicle and everything in it.',
    choices: [
      { label: 'Floor it (vehicle -12)', act: () => { wearVehicle(veh(), 12); return Math.random() < .4 ? { msg: 'A round clips you as you tear away.', hours: 0, hp: 75 } : { msg: 'You tear past them.', hours: 0 }; } },
      { label: 'Fight back (6 ammo)', ok: () => save.res.ammo >= 6, act: () => { save.res.ammo -= 6; if (Math.random() < .6) { const n = ri(8, 14); save.res.scrap += n; facRep('reapers', -3); return { msg: `They break and run. You search what they left: +${n} scrap.`, hours: .3 }; } return { msg: 'It is a close thing. You are hurt, and they get away.', hours: .3, hp: 60 }; } },
    ],
  },
  cache: {
    title: 'ROADSIDE FUEL', when: () => true, w: 1, text: () => 'An overturned tanker has a few jerrycans still intact beside it.',
    choices: [{ label: 'Take them', act: () => { const n = ri(2, 5); save.res.diesel += n; return { msg: `+${n} diesel.`, hours: .3 }; } }],
  },
};
function rollRoadEvent() {
  if (save.stats.trips < 2 || Math.random() > .3) return null;
  const pool = Object.entries(ROAD_EVENTS).filter(([, e]) => e.when()), tot = pool.reduce((s, [, e]) => s + e.w, 0);
  let x = Math.random() * tot; for (const [id, e] of pool) if ((x -= e.w) <= 0) return id; return null;
}
function startDrive(town) {
  const id = rollRoadEvent(); if (!id) { go(missionScene(town, 'drive')); return; }
  roadScene.ev = ROAD_EVENTS[id]; roadScene.town = town; roadScene.res = null; go(roadScene);
}
const roadScene = {
  fixed: true, ev: null, town: null, res: null,
  draw() {
    const E = this.ev; if (!E) { go(mapScene); return; }
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H); drawHUD(true);
    ctx.fillStyle = '#07150d'; ctx.fillRect(160, 110, 640, 380); ctx.strokeStyle = '#fa5'; ctx.strokeRect(160.5, 110.5, 640, 380);
    text(`ON THE ROAD TO ${(this.town.short || this.town.name).toUpperCase()}`, W / 2, 138, 11, '#9fb', 'center'); text(E.title, W / 2, 170, 22, '#fa5', 'center');
    wrapText(E.text(), 62).forEach((l, i) => text(l, W / 2, 212 + i * 18, 13, '#cfe', 'center'));
    if (!this.res) E.choices.forEach((c, i) => { const label = typeof c.label === 'function' ? c.label(has) : c.label; button(label, 220, 320 + i * 46, 520, 38, () => { const r = c.act(); this.res = r; save.clock += r.hours || 0; persist(); }, !c.ok || c.ok()); });
    else {
      wrapText(this.res.msg, 62).forEach((l, i) => text(l, W / 2, 330 + i * 18, 13, GREEN, 'center'));
      button(this.res.abort ? 'BACK TO THE MAP' : 'CONTINUE', W / 2 - 80, 430, 160, 36, () => { const r = this.res; if (r.abort) go(mapScene); else go(missionScene(this.town, r.walk ? 'walk' : 'drive', { hp: r.hp })); });
    }
  },
};
