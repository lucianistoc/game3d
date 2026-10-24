// The radio: daily offers, a quest board, diplomacy (alliances, the Reapers: truce, war, or taking them in) and research.

const RESEARCH = {
  filters:     { name: 'Water filters',   rp: 2, desc: 'Tanks give +1 water a night and wells +2.' },
  antibiotics: { name: 'Antibiotics',     rp: 2, desc: 'Everyone present heals 5 more a night.' },
  panels:      { name: 'Better panels',   rp: 3, desc: 'Solar output +10%.' },
};
const PACTS = {
  farmers:    'Farm alliance: +4 food every night',
  militia:    'Militia alliance: two gunners help every night watch',
  scientists: 'Research alliance: +2 meds a night, a research point every 5 nights',
  army:       'Army alliance: +3 shells a night and an armoured gunner at night',
};
const PACT_COST = { scrap: 50 };
const reapersTruce = () => save.reapers.state === 'truce' && save.reapers.until >= save.day;
const reapersGone = () => ['destroyed', 'absorbed'].includes(save.reapers.state);
const reapersLive = () => !reapersGone() && !reapersTruce();
const hasResearch = id => !!save.research[id];

// ---------------------------------------------------------------- nightly effects
function diploNight(rep) {
  // expire the truce
  if (save.reapers.state === 'truce' && save.reapers.until < save.day) { save.reapers.state = 'hostile'; rep.push('The truce with the Reapers has run out'); logEvent('The Reaper truce ended'); }
  // alliances pay out, and fall apart if you mistreat the partner
  for (const f of Object.keys(save.pacts)) {
    if (save.fac[f].rep < 30) { delete save.pacts[f]; rep.push(`The ${FACTIONS[f].name} alliance has fallen apart`); logEvent(`Lost the ${FACTIONS[f].name} alliance`); continue; }
    if (f === 'farmers') { save.res.food += 4; rep.push('Allied farmers sent +4 food'); }
    if (f === 'scientists') { save.res.meds += 2; rep.push('Allied researchers sent +2 meds'); if (save.day % 5 === 0) { save.rp++; rep.push('The researchers share a research point'); } }
    if (f === 'army') { save.res.shells += 3; rep.push('The army sent +3 shells'); }
  }
  if (save.reapers.state === 'absorbed') { addIntel('Former Reapers report from the roads'); }
  genQuests(rep); questsNight(rep);
}

// ---------------------------------------------------------------- quests
function makeQuest() {
  const fs = ['farmers', 'militia', 'scientists', 'army'].filter(f => save.fac[f].rep > -30 && !save.quests.some(q => q.fac === f)); if (!fs.length) return null;
  const f = pickOf(fs), spots = k => TOWNS.filter(t => t.type === 'spot' && k.includes(t.kind)), vil = TOWNS.filter(t => t.type === 'village' && kmBetween(t, HOME) < 25);
  const T = {
    farmers: [
      () => { const n = ri(8, 14); return { type: 'supply', need: { water: n }, text: `The farms are short of water: deliver ${n} water`, reward: { rep: 8, res: { food: ri(8, 12) } } }; },
      () => ({ type: 'hunt', n: 3, text: 'Bandits keep raiding the farms: kill 3 gang members in the field', reward: { rep: 9, res: { ammo: 12, food: 6 } } }),
      () => { const t = pickOf(vil); return { type: 'clear', target: t.name, text: `Clear ${t.name} of infected so families can return`, reward: { rep: 10, res: { wood: 8, food: 10 } } }; },
    ],
    militia: [
      () => ({ type: 'hunt', n: 4, text: 'Gangs are choking the roads: kill 4 gang members in the field', reward: { rep: 10, res: { ammo: 20 } } }),
      () => { const t = pickOf(spots(['store', 'warehouse', 'hardware'])); return { type: 'clear', target: t.name, text: `Clear ${t.short || t.name} so the militia can use it`, reward: { rep: 10, res: { meds: 6 } } }; },
      () => { const n = ri(10, 14); return { type: 'supply', need: { food: n }, text: `Rations for the city garrison: deliver ${n} food`, reward: { rep: 8, res: { shells: 8, ammo: 10 } } }; },
    ],
    scientists: [
      () => { const n = ri(6, 9); return { type: 'supply', need: { meds: n }, text: `The lab needs ${n} medicine for its experiments`, reward: { rep: 10, rp: 1 } }; },
      () => { const t = pickOf(spots(['pharma_wh', 'pharmacy', 'hospital'])); return { type: 'clear', target: t.name, text: `Clear ${t.short || t.name}: the researchers want what is inside`, reward: { rep: 10, rp: 1, res: { meds: 4 } } }; },
    ],
    army: [
      () => { const n = ri(8, 12); return { type: 'supply', need: { diesel: n }, text: `The garrison's generators are dry: deliver ${n} diesel`, reward: { rep: 10, res: { shells: 10 } } }; },
      () => { const t = pickOf(spots(['army', 'airport', 'police'])); return { type: 'clear', target: t.name, text: `Retake ${t.short || t.name} for the army`, reward: { rep: 12, item: rollGear('outfit') } }; },
    ],
  };
  const q = pickOf(T[f])(); return { id: Math.random().toString(36).slice(2), fac: f, until: save.day + ri(4, 7), base: save.stats.kills, ...q };
}
function genQuests(rep) {
  if (!roomLvl('radio')) return;
  save.quests = save.quests.filter(q => q.until >= save.day || q.ready);
  for (let i = 0; i < 2 && save.quests.length < 4; i++) { if (Math.random() < .6) { const q = makeQuest(); if (q) { save.quests.push(q); if (rep) rep.push(`New request from the ${FACTIONS[q.fac].name}`); } } }
}
function questsNight(rep) {
  for (const q of save.quests.slice()) {
    if (q.type === 'hunt' && save.stats.kills - q.base >= q.n) q.ready = true;
    if (q.until < save.day && !q.ready && !q.done) { save.quests = save.quests.filter(x => x !== q); facRep(q.fac, -2); rep.push(`The ${FACTIONS[q.fac].name} request expired (-standing)`); }
  }
}
function questsOnVisit(town, ok) {
  if (!ok) return;
  for (const q of save.quests) if (q.type === 'clear' && q.target === town.name && !q.done) { q.done = true; say(`Request done: report back by radio`); }
}
const questReady = q => q.ready || q.done || (q.type === 'supply' && costOk(q.need)) || (q.type === 'hunt' && save.stats.kills - q.base >= q.n);
function claimQuest(q) {
  if (q.type === 'supply') payCost(q.need);
  const R = q.reward; if (R.res) giveRes(R.res); if (R.rep) facRep(q.fac, R.rep); if (R.rp) save.rp += R.rp; if (R.item) save.gear.stash.push(R.item);
  save.quests = save.quests.filter(x => x !== q); save.stats.quests = (save.stats.quests || 0) + 1; logEvent(`Request done for the ${FACTIONS[q.fac].name}`); sfx('ok'); persist();
}
const rewardTxt = R => [R.rep ? `+${R.rep} standing` : '', R.res ? gainTxt(R.res) : '', R.rp ? `+${R.rp} research` : '', R.item ? GEAR_BY_ID[R.item].name : ''].filter(Boolean).join(' · ');

// ---------------------------------------------------------------- the radio screen
const tradeScene = {
  fixed: true, msg: '', tab: 'offers',
  enter() { if (!save.trades.length) genTrades(); this.msg = ''; },
  factionCards() {
    Object.entries(FACTIONS).forEach(([f, F], i) => {
      const r = save.fac[f].rep, y = 104 + i * 84, trib = f === 'reapers' && r < -40 && reapersLive(), gc = trib ? { scrap: 20, ammo: 10 } : { scrap: 12 };
      ctx.fillStyle = '#07150d'; ctx.fillRect(24, y, 250, 78); ctx.strokeStyle = F.col; ctx.strokeRect(24.5, y + .5, 250, 78);
      text(F.name, 34, y + 18, 12, F.col); text(`${repWord(r)} (${Math.round(r)})${save.pacts[f] ? ' · ALLIED' : ''}`, 34, y + 34, 10, '#fff');
      bar(34, y + 40, 230, 5, (r + 100) / 200, F.col, '#222');
      button(trib ? 'PAY TRIBUTE (20 scrap, 10 ammo)' : 'GIFT 12 scrap (+5)', 34, y + 50, 230, 22, () => { payCost(gc); facRep(f, trib ? 15 : 5); persist(); }, costOk(gc) && !(f === 'reapers' && reapersGone()));
    });
  },
  draw() {
    panel('RADIO', 'Standing changes prices, quests and who will deal with you.');
    this.factionCards();
    [['offers', 'OFFERS'], ['quests', `QUESTS (${save.quests.length})`], ['diplo', 'DIPLOMACY']].forEach(([k, l], i) => { button(l, 290 + i * 150, 96, 144, 24, () => { this.tab = k; this.msg = ''; }); if (this.tab === k) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(290 + i * 150, 96, 144, 24); ctx.lineWidth = 1; } });
    if (this.tab === 'offers') this.drawOffers(); else if (this.tab === 'quests') this.drawQuests(); else this.drawDiplo();
    if (this.msg) text(this.msg, 610, H - 70, 13, AMBER, 'center');
    back();
  },
  drawOffers() {
    let n = 0;
    for (const t of save.trades) {
      const yy = 130 + n * 32; if (yy > H - 80) break; n++;
      const F = t.fac === 'own' ? { name: t.label, col: '#6f8' } : FACTIONS[t.fac] || { name: 'Wandering trader', col: '#fc8' };
      ctx.fillStyle = '#07150d'; ctx.fillRect(290, yy, 640, 29); ctx.strokeStyle = t.used ? '#222' : '#1c3a28'; ctx.strokeRect(290.5, yy + .5, 640, 29);
      text(F.name, 300, yy + 12, 9, t.used ? '#566' : F.col);
      const what = t.recruit ? 'A survivor joins the crew' : t.item ? `${GEAR_BY_ID[t.item].name} (${RARITY[GEAR_BY_ID[t.item].r].name})` : gainTxt(t.get).replace(/\+/g, '');
      text(what, 300, yy + 25, 12, t.used ? '#566' : '#fff'); text(`for ${costTxt(t.give)}`, 640, yy + 19, 12, t.used ? '#566' : costOk(t.give) ? GREEN : RED);
      const room = !t.recruit || living().length < crewCap();
      button(t.used ? 'DONE' : 'DEAL', 840, yy + 3, 80, 23, () => {
        payCost(t.give); t.used = true; save.stats.trades++;
        if (t.recruit) { const c = recruit(); this.msg = c ? `${c.name} joins the crew (${ROLES[c.role].label.toLowerCase()})` : ''; }
        else if (t.item) { save.gear.stash.push(t.item); this.msg = `Got ${GEAR_BY_ID[t.item].name}`; }
        else { giveRes(t.get); this.msg = `Traded for ${gainTxt(t.get)}`; clampRes(); }
        if (t.fac in save.fac) facRep(t.fac, 1.5); persist();
      }, !t.used && costOk(t.give) && room);
    }
    if (!save.trades.length) text('No offers today.', 610, 200, 13, '#566', 'center');
  },
  drawQuests() {
    if (!save.quests.length) { text('No requests right now. They arrive by radio each morning.', 610, 200, 13, '#566', 'center'); return; }
    save.quests.forEach((q, i) => {
      const y = 130 + i * 92, F = FACTIONS[q.fac], ready = questReady(q);
      ctx.fillStyle = '#07150d'; ctx.fillRect(290, y, 640, 84); ctx.strokeStyle = ready ? '#3a9a5a' : DIM; ctx.strokeRect(290.5, y + .5, 640, 84);
      text(F.name, 302, y + 18, 11, F.col); text(`${Math.max(0, q.until - save.day)} days left`, 920, y + 18, 10, '#fa5', 'right');
      wrapText(q.text, 80).forEach((l, j) => text(l, 302, y + 36 + j * 14, 12, '#fff'));
      const prog = q.type === 'hunt' ? `killed ${Math.min(q.n, save.stats.kills - q.base)}/${q.n}` : q.type === 'clear' ? (q.done ? 'cleared: report back' : `go and loot ${(outTown({ name: q.target }) || {}).short || q.target}`) : `needs ${costTxt(q.need)}`;
      text(prog, 302, y + 72, 10, ready ? '#6f8' : '#9fb'); text(rewardTxt(q.reward), 560, y + 72, 10, '#fc4');
      button(q.type === 'supply' ? 'DELIVER' : 'CLAIM', 810, y + 38, 108, 26, () => { claimQuest(q); this.msg = 'Request complete'; }, ready);
      button('DROP', 810, y + 6, 108, 22, () => { facRep(q.fac, -1); save.quests = save.quests.filter(x => x !== q); persist(); });
    });
  },
  drawDiplo() {
    let y = 130;
    for (const f of ['farmers', 'militia', 'scientists', 'army']) {
      const r = save.fac[f].rep, pact = save.pacts[f];
      ctx.fillStyle = '#07150d'; ctx.fillRect(290, y, 640, 52); ctx.strokeStyle = pact ? '#3a9a5a' : DIM; ctx.strokeRect(290.5, y + .5, 640, 52);
      text(FACTIONS[f].name, 302, y + 16, 12, FACTIONS[f].col); wrapText(pact ? PACTS[f] : r >= 60 ? `They would sign an alliance: ${PACTS[f].split(': ')[1]}.` : `Needs standing 60 (now ${Math.round(r)}): ${PACTS[f].split(': ')[1]}.`, 78).forEach((l, i) => text(l, 302, y + 32 + i * 11, 10, pact ? '#6f8' : '#9fb'));
      if (pact) button('END PACT', 820, y + 14, 100, 24, () => { delete save.pacts[f]; persist(); });
      else button(`ALLY (${costTxt(PACT_COST)})`, 790, y + 14, 130, 24, () => { payCost(PACT_COST); save.pacts[f] = 'ally'; logEvent(`Allied with the ${FACTIONS[f].name}`); sfx('ok'); persist(); }, r >= 60 && costOk(PACT_COST));
      y += 58;
    }
    // the Reapers
    const rs = save.reapers.state, R = save.fac.reapers.rep;
    ctx.fillStyle = '#07150d'; ctx.fillRect(290, y, 640, 78); ctx.strokeStyle = '#f77'; ctx.strokeRect(290.5, y + .5, 640, 78);
    const st = { hostile: 'At odds with you', truce: `Truce until day ${save.reapers.until}`, war: 'AT WAR: their camp is marked on the map', destroyed: 'Broken. The gang is gone.', absorbed: 'Part of your settlement' }[rs];
    text('The Reapers', 302, y + 18, 12, '#f77'); text(st, 302, y + 36, 11, '#fff');
    wrapText(rs === 'war' ? 'Kill their leader at the camp (map, zoom in north of Timișoara). War means bigger raids.' : rs === 'hostile' || rs === 'truce' ? 'Buy peace for ten days, go to war, or invite them in (standing 40+).' : '', 44).forEach((l, i) => text(l, 302, y + 52 + i * 11, 10, '#9fb'));
    if (rs === 'hostile' || rs === 'truce') {
      button('TRUCE (60 scrap, 20 ammo)', 560, y + 46, 200, 26, () => { payCost({ scrap: 60, ammo: 20 }); save.reapers = { state: 'truce', until: save.day + 10 }; logEvent('Bought a truce with the Reapers'); persist(); }, costOk({ scrap: 60, ammo: 20 }) && rs === 'hostile');
      button('DECLARE WAR', 770, y + 46, 150, 26, () => { save.reapers = { state: 'war', until: 0 }; facRep('reapers', -100); logEvent('War with the Reapers'); say('War! Their camp is on the map.'); persist(); });
      button('TAKE THEM IN (80 scrap, 30 food)', 560, y + 12, 280, 26, () => { payCost({ scrap: 80, food: 30 }); save.reapers = { state: 'absorbed', until: 0 }; let n = 0; for (let i = 0; i < 2; i++) { const c = recruit('fighter'); if (c) { c.name = c.name; n++; } } facRep('reapers', 100); logEvent(`The Reapers joined (${n} fighters)`); this.msg = n ? `${n} Reaper fighters join your crew` : 'The Reapers stand down (no room for them)'; persist(); }, costOk({ scrap: 80, food: 30 }) && R >= 40);
    }
    // research
    y += 88; text(`RESEARCH · ${save.rp} point${save.rp === 1 ? '' : 's'} (earned from the researchers' requests)`, 302, y + 4, 11, '#c8f');
    Object.entries(RESEARCH).forEach(([id, Rs], i) => { const x = 290 + i * 215; ctx.fillStyle = '#07150d'; ctx.fillRect(x, y + 12, 207, 64); ctx.strokeStyle = save.research[id] ? '#3a9a5a' : DIM; ctx.strokeRect(x + .5, y + 12.5, 207, 64); text(Rs.name, x + 8, y + 28, 11, '#fff'); wrapText(Rs.desc, 33).forEach((l, j) => text(l, x + 8, y + 42 + j * 11, 9, '#9fb')); button(save.research[id] ? 'DONE' : `${Rs.rp} points`, x + 8, y + 56, 90, 18, () => { save.rp -= Rs.rp; save.research[id] = true; logEvent(`Research: ${Rs.name}`); persist(); }, !save.research[id] && save.rp >= Rs.rp); });
  },
};
