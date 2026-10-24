// Crew as people: perks chosen at level-ups, relationships and couples, injuries and their treatment, personal
// events (a missing relative, a feud, a funeral) and the crew detail panel.

// ---------------------------------------------------------------- perks: pick one at level 2 and another at level 4
const PERKS = {
  fighter:  { t1: [['marksman', 'Marksman', '+0.5 damage from the windows'], ['guardian', 'Guardian', 'Outposts they hold are far harder to take']], t2: [['rapid', 'Rapid fire', 'Shoots 15% faster'], ['looter', 'Looter', '+15% loot from expeditions']] },
  engineer: { t1: [['fast', 'Fast hands', 'Repairs 50% faster'], ['trapper', 'Trapper', 'Your wire, pits and mines hit 50% harder']], t2: [['efficient', 'Efficient', 'Night repairs cost no scrap'], ['builder', 'Builder', 'Everything built costs 1 less scrap']] },
  medic:    { t1: [['surgeon', 'Surgeon', 'Injuries heal a day faster'], ['pharmacist', 'Pharmacist', 'Medicine heals 10 more']], t2: [['field', 'Field medic', 'Far fewer casualties at night'], ['immune', 'Immunologist', 'Infections clear by themselves']] },
  farmer:   { t1: [['green', 'Green thumb', '+1 food per greenhouse'], ['forager', 'Forager', '+20% loot from expeditions']], t2: [['irrigation', 'Irrigation', 'Greenhouses use no water'], ['thrift', 'Thrift', 'The crew eats 1 less a night']] },
  scout:    { t1: [['pathfinder', 'Pathfinder', '+8 s on missions'], ['eagle', 'Eagle eyes', 'Outposts report intel more often']], t2: [['stealth', 'Stealth', 'Sneak faster, stay unseen'], ['ranger', 'Ranger', '+8% expedition success']] },
  mechanic: { t1: [['tuner', 'Tuner', 'Vehicles wear half as fast'], ['hotwirer', 'Hotwirer', 'Hotwire 30% faster']], t2: [['recycler', 'Recycler', 'Scrapped vehicles give double'], ['gen', 'Generator whisperer', '+3 kWh from the generator']] },
  cook:     { t1: [['chef', 'Chef', '+1 morale every night'], ['stores', 'Quartermaster', 'Rations stretch: 1 less water too']], t2: [['feast', 'Feast', '+3 morale after a won night'], ['herbalist', 'Herbalist', 'Everyone heals 2 more']] },
};
const perkInfo = (role, id) => { for (const t of ['t1', 't2']) for (const p of PERKS[role][t]) if (p[0] === id) return p; return null; };
const perkPending = c => { const n = (c.perks || []).length; return (c.lvl >= 2 && n < 1) ? 't1' : (c.lvl >= 4 && n < 2 && n >= 1) ? 't2' : null; };
const crewPerk = id => alive().some(c => (c.perks || []).includes(id));

// ---------------------------------------------------------------- bios
const JOBS = {
  fighter: ['a conscript who deserted before the fall', 'a bouncer from Timișoara', 'a hunting-club member from Giarmata'],
  engineer: ['a retired electrician', 'a Politehnica dropout', 'a mechanic from Lugoj'],
  medic: ['a nurse from the county hospital', 'a pharmacy assistant', 'a village vet'],
  farmer: ['a Banat cereal farmer', 'a market gardener', 'a beekeeper from the plain'],
  scout: ['a delivery rider who knows every back road', 'a mountain guide', 'a land surveyor'],
  mechanic: ['a truck mechanic', 'a taxi driver', 'a bike-shop owner'],
  cook: ['a school canteen cook', 'a restaurant chef', 'a baker from Sânandrei'],
};
const bioOf = c => `${c.name} was ${JOBS[c.role][hashStr(c.name + c.role) % 3]}. ${TRAITS[c.trait].desc}.`;

// ---------------------------------------------------------------- relationships
const rel = (a, b) => a.rel[b.name] || 0;
const relAdd = (a, b, v) => { a.rel[b.name] = clamp((a.rel[b.name] || 0) + v, -100, 100); b.rel[a.name] = clamp((b.rel[a.name] || 0) + v, -100, 100); };
const relWord = v => v >= 70 ? 'very close' : v >= 40 ? 'friends' : v <= -50 ? 'bitter enemies' : v <= -30 ? 'rivals' : 'acquainted';

// ---------------------------------------------------------------- injuries
const INJ = {
  leg:       { name: 'broken leg',  days: [4, 6], blocks: true },
  wound:     { name: 'deep wound',  days: [3, 4], noheal: true },
  infection: { name: 'infection',   days: [99, 99] },
  trauma:    { name: 'shock',       days: [4, 5] },
};
const blocked = c => !!(c.inj && INJ[c.inj.type].blocks);
function maybeInjure(c, dmg) {
  if (!c || dmg < 12 || c.inj || c.hp <= 0 || Math.random() > clamp(.18 + dmg / 220, 0, .5)) return;
  let x = Math.random(), type = x < .35 ? 'wound' : x < .6 ? 'leg' : x < .8 ? 'infection' : 'trauma';
  c.inj = { type, days: ri(...INJ[type].days) }; logEvent(`${c.name} suffered a ${INJ[type].name}`); say(`${c.name}: ${INJ[type].name}`);
}

// ---------------------------------------------------------------- the nightly pass
function storiesNight(f, rep) {
  const here = alive();
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {   // people who stand watch together grow close; bad nights breed friction
    const a = here[i], b = here[j], same = save.posts[a.name] && save.posts[a.name] === save.posts[b.name];
    relAdd(a, b, rand(-.4, 1.2) * 1.7 * (same ? 2 : 1) * (f.won ? 1.2 : .6) - ((a.morale < 30 && b.morale < 30) ? 1.2 : 0) - (a.trait === 'nervous' && b.trait === 'steady' ? .1 : 0));
  }
  for (const a of here) for (const b of here) if (a !== b && !a.partner && !b.partner && rel(a, b) >= 75 && Math.random() < .1) { a.partner = b.name; b.partner = a.name; rep.push(`${a.name} and ${b.name} have become a couple`); logEvent(`${a.name} and ${b.name} became a couple`); }
  for (const c of here) {
    let d = 0; for (const o of here) if (o !== c) { const r = rel(c, o); if (r >= 40) d += o.name === c.partner ? 2 : 1; if (r <= -30) d -= 1; }
    if (hasPerkOf(c, 'chef')) d += 1; c.morale = clamp(c.morale + d, 0, 100);
    if (c.inj && c.inj.type === 'trauma') c.morale = Math.min(c.morale, 50);
    if (c.grief > 0) { c.grief--; c.morale = Math.max(0, c.morale - 2); }
  }
  if (f.won && crewPerk('feast')) for (const c of here) c.morale = clamp(c.morale + 3, 0, 100);
  if (crewPerk('herbalist')) for (const c of here) c.hp = Math.min(100, c.hp + 2);
  // injuries run their course
  for (const c of save.crew) if (c.hp > 0 && c.inj) {
    const I = INJ[c.inj.type];
    if (c.inj.type === 'infection') {
      if (crewPerk('immune') || (save.res.meds >= 2 && (has('medic') || roomLvl('clinic')))) { if (!crewPerk('immune')) save.res.meds -= 2; rep.push(`${c.name}'s infection was treated`); c.inj = null; }
      else { c.hp -= 8; rep.push(`${c.name} is fighting an infection (needs medicine and a medic or clinic)`); if (c.hp <= 0) { crewDied(c, 'succumbed to an infection'); rep.push(`${c.name} died of the infection`); } }
    } else { c.inj.days -= 1 + (roomLvl('clinic') ? 1 : 0) + (crewPerk('surgeon') ? 1 : 0); if (c.inj.days <= 0) { rep.push(`${c.name} recovered from their ${I.name}`); c.inj = null; } }
  }
}
function griefFor(dead) {   // the people who loved them take it hard
  for (const c of save.crew) if (c.hp > 0 && !c.dead && c !== dead) { const r = rel(c, dead); if (dead.partner === c.name) { c.partner = null; c.morale = Math.max(0, c.morale - 25); c.grief = 5; } else if (r >= 40) { c.morale = Math.max(0, c.morale - 10); c.grief = 3; } delete c.rel[dead.name]; }
  save.funeralQ.push(dead.name);
}

// ---------------------------------------------------------------- personal events (added to the pool in world.js)
const pairWhere = fn => { const a = alive(); for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (fn(rel(a[i], a[j]), a[i], a[j])) return [a[i], a[j]]; return null; };
const byName = n => save.crew.find(c => c.name === n && c.hp > 0);
Object.assign(EVENTS, {
  funeral: {
    title: 'A FUNERAL', w: 0, when: () => save.funeralQ.length > 0, prep: () => ({ names: save.funeralQ.splice(0, 3) }),
    text: ev => `${ev.names.join(', ')} ${ev.names.length > 1 ? 'are' : 'is'} gone. The crew gathers at the back of the plot. Nobody is sure what to say.`,
    choices: [
      { label: 'Hold a funeral (2 food)', ok: () => save.res.food >= 2, act: () => { save.res.food -= 2; for (const c of alive()) { c.morale = clamp(c.morale + 8, 0, 100); c.grief = Math.max(0, (c.grief || 0) - 2); } return 'A few words, a few flowers from the greenhouse. It helps a little.'; } },
      { label: 'There is no time', act: () => { moraleHit(4); return 'The work goes on. The silence at supper says what nobody does.'; } },
    ],
  },
  grudge: {
    title: 'BAD BLOOD', w: 2, when: () => save.day >= 5 && !!pairWhere(r => r <= -30), prep: () => { const p = pairWhere(r => r <= -30); return p ? { a: p[0].name, b: p[1].name } : null; },
    text: ev => `${ev.a} and ${ev.b} have been at each other's throats for days. Tonight it comes to a head over a stolen ration.`,
    choices: [
      { label: 'Make them talk it out', act: ev => { const a = byName(ev.a), b = byName(ev.b); if (a && b && Math.random() < .5) { relAdd(a, b, 30); return 'It takes an hour and a bottle of plum brandy, but they shake hands.'; } if (a && b) { moraleHit(8, [a, b]); } return 'It gets louder, not quieter. Both walk off furious.'; } },
      { label: 'Separate their shifts', act: ev => { const a = byName(ev.a), b = byName(ev.b); if (a && b) { relAdd(a, b, 8); moraleHit(2, [a, b]); } return 'Out of sight, out of mind, mostly.'; } },
      { label: 'Let them fight it out', act: ev => { const a = byName(ev.a), b = byName(ev.b); if (a && b) { const l = Math.random() < .5 ? a : b; l.hp = Math.max(1, l.hp - 20); l.inj = l.inj || { type: 'wound', days: 3 }; a.rel[b.name] = -5; b.rel[a.name] = -5; } return 'A short ugly fight. Someone ends up hurt, and the air is cleaner.'; } },
    ],
  },
  romance: {
    title: 'TWO PEOPLE', w: 2, when: () => save.day >= 4 && !!pairWhere((r, a, b) => r >= 65 && !a.partner && !b.partner), prep: () => { const p = pairWhere((r, a, b) => r >= 65 && !a.partner && !b.partner); return p ? { a: p[0].name, b: p[1].name } : null; },
    text: ev => `${ev.a} and ${ev.b} have been inseparable since the winter. Someone suggests marking it with a proper supper.`,
    choices: [
      { label: 'Celebrate (3 food)', ok: () => save.res.food >= 3, act: ev => { save.res.food -= 3; const a = byName(ev.a), b = byName(ev.b); if (a && b) { a.partner = b.name; b.partner = a.name; moraleHit(-6, [a, b]); } for (const c of alive()) c.morale = clamp(c.morale + 3, 0, 100); return 'Music from a phone, a pot of sarmale, and for one evening the house feels like a home.'; } },
      { label: 'Leave them be', act: () => 'They are better off without an audience.' },
    ],
  },
  family: {
    title: 'A RUMOUR', w: 2, when: () => save.day >= 6 && save.day - (save.lastFamily || 0) >= 10 && alive().some(c => !c.familyDone && !c.inj), prep: () => { const c = pickOf(alive().filter(c => !c.familyDone && !c.inj)), v = pickOf(TOWNS.filter(t => t.type === 'village' && kmBetween(t, HOME) < 25 && kmBetween(t, HOME) > 4)); return c && v ? { who: c.name, rel: pickOf(['brother', 'sister', 'mother', 'cousin']), place: v.name } : null; },
    text: ev => `${ev.who} heard a rumour on the radio that their ${ev.rel} was seen alive near ${ev.place}. They want to go and look, whatever the risk.`,
    choices: [
      { label: 'Let them go (2 days)', ok: ev => { const c = byName(ev.who); return !!c && alive().length > 2 && c.hp >= 40; }, act: ev => { const c = byName(ev.who); c.familyDone = true; save.lastFamily = save.day; c.away = { id: 'family', back: save.day + 2, place: ev.place, rel: ev.rel }; return `${c.name} packs a bag and leaves at first light. You will know in two days.`; } },
      { label: 'It is too dangerous', act: ev => { const c = byName(ev.who); if (c) { c.familyDone = true; moraleHit(10, [c]); } return `${ev.who} nods and says nothing. It will not be forgotten.`; } },
    ],
  },
});

// ---------------------------------------------------------------- the crew detail panel (drawn over crewScene)
function drawCrewDetail(sc) {
  const c = sc.sel; if (!c || c.hp <= 0) { sc.sel = null; return; }
  ctx.fillStyle = '#030806'; ctx.fillRect(110, 92, 740, 470); ctx.strokeStyle = ROLES[c.role].color; ctx.strokeRect(110.5, 92.5, 740, 470);
  text(c.name, 130, 124, 22, '#fff'); text(`${ROLES[c.role].label}  Lv${c.lvl}${c.partner ? '  ♥ ' + c.partner : ''}`, 130, 146, 13, ROLES[c.role].color);
  wrapText(bioOf(c), 70).forEach((l, i) => text(l, 130, 170 + i * 14, 11, '#9fb'));
  text('HP', 130, 214, 10, '#9a9'); bar(152, 207, 150, 9, c.hp / 100, c.hp < 40 ? RED : GREEN); text('MORALE', 130, 232, 10, '#9a9'); bar(182, 225, 120, 9, c.morale / 100, c.morale < 30 ? RED : c.morale > 75 ? '#8df' : '#fc4', '#222');
  text(c.inj ? `${INJ[c.inj.type].name.toUpperCase()}${c.inj.type === 'infection' ? ' (needs medicine)' : ` · ${Math.max(1, c.inj.days)} more days`}` : 'no injuries', 330, 214, 11, c.inj ? RED : '#6a8');
  text(`${c.lvl >= 5 ? 'max level' : `XP ${c.xp}/${c.lvl * 4}`}${c.grief ? ' · grieving' : ''}`, 330, 232, 11, '#a8c');
  // relationships
  text('RELATIONSHIPS', 130, 268, 11, '#5fa478');
  const rs = alive().filter(o => o !== c).map(o => [o, rel(c, o)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
  rs.forEach(([o, v], i) => { text(`${o.name}${o.name === c.partner ? ' ♥' : ''}`, 130, 288 + i * 18, 11, '#fff'); text(relWord(v), 230, 288 + i * 18, 10, v >= 40 ? '#8f8' : v <= -30 ? '#f88' : '#8aa'); bar(320, 281 + i * 18, 90, 6, (v + 100) / 200, v >= 0 ? '#6c6' : '#c66', '#222'); });
  if (!rs.length) text('Nobody else is here.', 130, 288, 11, '#566');
  // perks
  text('PERKS', 480, 268, 11, '#5fa478');
  (c.perks || []).forEach((id, i) => { const p = perkInfo(c.role, id); if (p) { text(`★ ${p[1]}`, 480, 288 + i * 30, 12, '#fc4'); text(p[2], 480, 301 + i * 30, 9, '#9fb'); } });
  const pend = perkPending(c);
  if (pend) { text('Choose a perk:', 480, 288 + (c.perks || []).length * 30, 11, '#fff'); PERKS[c.role][pend].forEach((p, i) => { const y = 296 + (c.perks || []).length * 30 + i * 52; button(p[1], 480, y, 200, 26, () => { c.perks.push(p[0]); logEvent(`${c.name} learned ${p[1]}`); persist(); sfx('ok'); }); text(p[2], 480, y + 40, 9, '#9fb'); }); }
  else if (!(c.perks || []).length) text(c.lvl < 2 ? 'The first perk comes at level 2.' : '', 480, 288, 10, '#566');
  else if ((c.perks || []).length < 2) text('The second perk comes at level 4.', 480, 288 + (c.perks || []).length * 30, 10, '#566');
  button('RENAME', 130, 508, 110, 30, () => { const n = (typeof prompt === 'function') ? prompt('Rename crew member', c.name) : null; if (n && n.trim()) { const old = c.name; c.name = n.trim().slice(0, 14); for (const o of save.crew) { if (o.rel[old] !== undefined) { o.rel[c.name] = o.rel[old]; delete o.rel[old]; } if (o.partner === old) o.partner = c.name; } persist(); } });
  button('CLOSE', 730, 508, 100, 30, () => { sc.sel = null; });
}
