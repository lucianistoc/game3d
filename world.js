// The living world around the base: crew progression and expeditions, house rooms, trade and factions,
// random events, a campaign with an ending, and sites that restock. The nightly hook is worldNight().

const RES_KEYS = ['scrap', 'food', 'ammo', 'shells', 'wood', 'water', 'diesel', 'meds'];
const VAL = { scrap: 1, food: 2.2, water: 1.6, ammo: 1.4, shells: 2, wood: 1.5, diesel: 3, meds: 4 };   // barter values
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickOf = a => a[Math.floor(Math.random() * a.length)];
const ri = (a, b) => Math.floor(rand(a, b + 1));

// ---------------------------------------------------------------- helpers
const roomLvl = k => (save.rooms && save.rooms[k]) || 0;
const crewCap = () => 8 + 3 * roomLvl('bunks');
const resCap = k => Math.round((k === 'scrap' || k === 'ammo' ? 150 : k === 'shells' ? 80 : 70) * (1 + .8 * roomLvl('storage') + .25 * save.outposts.filter(o => o.spec === 'depot').length));
function clampRes() {   // storage limits: whatever does not fit is lost
  const lost = [];
  for (const k of RES_KEYS) { const c = resCap(k); if (save.res[k] > c) { lost.push(`${Math.floor(save.res[k] - c)} ${k}`); save.res[k] = c; } }
  return lost;
}
const siteDanger = t => t.danger + Math.min(6, Math.floor(save.day / 4));   // threat grows with the days, but not without limit
const hasPerkOf = (c, id) => !!(c.perks && c.perks.includes(id));
const hasPerk = (role, id) => alive().some(c => c.role === role && c.perks && c.perks.includes(id));
const roleLvl = role => alive().reduce((m, c) => c.role === role ? Math.max(m, c.lvl || 1) : m, has(role) ? 1 : 0);
const scoutBonus = () => has('scout') ? 10 + 3 * (roleLvl('scout') - 1) + (crewPerk('pathfinder') ? 8 : 0) : 0;
const facRep = (f, d) => { save.fac[f].rep = clamp(save.fac[f].rep + d, -100, 100); };
const repWord = r => r >= 60 ? 'allied' : r >= 25 ? 'friendly' : r > -15 ? 'neutral' : r > -50 ? 'wary' : 'hostile';
const FACTIONS = {
  farmers: { name: 'Cărani farmers', col: '#8d6', blurb: 'Food, water and diesel from the villages.' },
  militia: { name: 'Timișoara militia', col: '#7ab8ff', blurb: 'Ammunition, medicine and weapons from the city.' },
  reapers: { name: 'The Reapers', col: '#f77', blurb: 'A raider gang. They hit your house and remember how you treat them.' },
  scientists: { name: 'Politehnica researchers', col: '#c8f', blurb: 'A lab holed up in the university. They want medicine and want sites cleared.' },
  army: { name: 'Army remnant', col: '#9c6', blurb: 'A garrison that still has fuel discipline and heavy kit.' },
};
const SPEC = {
  farm:     { name: 'Farm',       desc: 'Grows food and water instead of salvage.' },
  workshop: { name: 'Workshop',   desc: 'Turns scrap into scrap and ammunition.' },
  tower:    { name: 'Watchtower', desc: 'Twice the intel, safer, and it reveals what tonight brings.' },
  clinic:   { name: 'Clinic',     desc: 'Medicine, and it heals the garrison.' },
  depot:    { name: 'Depot',      desc: 'Every store in the settlement holds 25% more.' },
};
const SPEC_COST = { scrap: 40 };
function gainXp(c, n) {
  c.xp += n; const out = [];
  while (c.lvl < 5 && c.xp >= c.lvl * 4) { c.xp -= c.lvl * 4; c.lvl++; out.push(`${c.name} reached level ${c.lvl}`); }
  return out;
}
const costOk = cost => Object.entries(cost).every(([k, n]) => (save.res[k] || 0) >= n);
const payCost = cost => { for (const [k, n] of Object.entries(cost)) save.res[k] -= n; };
const costTxt = cost => Object.entries(cost).map(([k, n]) => `${n} ${k}`).join(' ');
const gainTxt = o => Object.entries(o).filter(([, n]) => n).map(([k, n]) => `+${n} ${k}`).join(' ');
function giveRes(o) { for (const [k, n] of Object.entries(o)) save.res[k] = (save.res[k] || 0) + n; }
const NAMES = ['Sorin', 'Vlad', 'Daniela', 'Gabi', 'Cristina', 'Bogdan', 'Teo', 'Lavinia', 'Paul', 'Raluca', 'Nicu', 'Simona', 'Dan', 'Irina', 'Stefan', 'Corina'];
function recruit(role) {
  if (living().length >= crewCap()) return null;
  if (save.crew.length >= 14) save.crew = save.crew.filter(c => c.hp > 0);
  const used = new Set(save.crew.map(c => c.name)), name = pickOf(NAMES.filter(n => !used.has(n)).concat(['Survivor']));
  const have = new Set(living().map(c => c.role)), lacking = Object.keys(ROLES).filter(r => !have.has(r));
  const c = crewInit({ name, role: role || pickOf(lacking.length ? lacking : Object.keys(ROLES)), hp: 70 }); c.morale = 60;
  save.crew.push(c); return c;
}
const moraleAvg = () => { const a = alive(); return a.length ? a.reduce((s, c) => s + c.morale, 0) / a.length : 0; };
const moraleHit = (n, who) => { for (const c of who || alive()) c.morale = clamp(c.morale - n * (c.trait === 'steady' ? .5 : c.trait === 'nervous' ? 1.5 : 1), 0, 100); };

// ---------------------------------------------------------------- sites: depletion, infestation, events
const siteInfo = t => {
  const st = save.sites[t.name], d = st ? save.day - st.last : 0, fx = fxOf(t, true), own = !!outpostOf(t);
  return { depl: st ? Math.max(0, st.depl - (own ? .16 : .1) * d) : 0, inf: st ? Math.min(.9, st.inf + .08 * d) * (own ? .3 : 1) : 0, fx, own };
};
function applySite(t) {   // the town as it is today: picked over, re-infested, or affected by an event
  const s = siteInfo(t), o = Object.assign({}, t);
  o.crates = Math.max(2, Math.round((t.crates || 7) * (1 - s.depl * .75)));
  o.infMul = 1 + s.inf * .8;
  if (s.fx && s.fx.kind === 'convoy') { o.crates += 6; o.loot = { ...t.loot, ammo: (t.loot.ammo || 0) + 4, shells: (t.loot.shells || 0) + 3, meds: (t.loot.meds || 0) + 2, weapon: (t.loot.weapon || 0) + 4 }; o.wpool = 'army'; o.danger += 1; }
  if (s.fx && s.fx.kind === 'stash') { o.crates += 3; o.loot = { ...t.loot, ammo: (t.loot.ammo || 0) + 2, meds: (t.loot.meds || 0) + 2, food: (t.loot.food || 0) + 2 }; }
  if (s.fx && s.fx.kind === 'outbreak') { o.danger += 2; o.crates += 2; o.infMul += .6; }
  return o;
}
function visitSite(t, frac, ok) {
  const s = siteInfo(t);
  save.sites[t.name] = { depl: Math.min(.92, s.depl + (ok ? .6 : .15) * frac), last: save.day, inf: ok ? 0 : s.inf };
  if (ok && s.fx) save.fx = save.fx.filter(f => f !== s.fx);   // the convoy is stripped; the outbreak is cleared out
}

const FX_KINDS = {
  convoy:   { col: '#fc4', icon: '▲', brief: 'ABANDONED CONVOY: extra crates, weapons and ammo', list: 'Wrecked convoy' },
  stash:    { col: '#6cf', icon: '?', brief: 'INTEL: a hidden stash was reported here (extra crates)', list: 'Reported stash' },
  outbreak: { col: '#f55', icon: '☣', brief: 'OUTBREAK: swarming with infected, but the shops are untouched', list: 'Outbreak' },
};
function fxOf(t, direct) {
  if (!save.fx || !save.fx.length) return null;
  const f = save.fx.find(f => f.town === t.name); if (f || direct) return f || null;
  if (t.type === 'city') return save.fx.find(f => { const s = TOWNS.find(x => x.name === f.town); return s && s.type === 'spot'; }) || null;
  return null;
}
function drawFx(t, x, y, time) {
  const own = outpostOf(t) || (t.type === 'city' && save.outposts.some(o => { const s = outTown(o); return s && s.type === 'spot' && s.lat > 45.7 && s.lat < 45.82 && s.lon > 21.1 && s.lon < 21.4; }));
  if (own) { ctx.strokeStyle = '#6f8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); text('⚑', x + 1, y - 15, 12, '#6f8', 'center'); }
  const f = fxOf(t); if (!f) return;
  const K = FX_KINDS[f.kind], p = .5 + .5 * Math.sin(time * 4);
  ctx.strokeStyle = K.col; ctx.lineWidth = 2; ctx.globalAlpha = .4 + .5 * p; ctx.beginPath(); ctx.arc(x, y, 14 + p * 5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  text(K.icon, x, y - 17, 12, K.col, 'center');
}
function drawFxList(x, y) {
  save.fx.forEach((f, i) => { const K = FX_KINDS[f.kind]; text(`${K.icon} ${K.list}: ${f.town.split(' · ')[0]} (${Math.max(0, f.until - save.day)}d left)`, x, y + i * 14, 11, K.col); });
}
function addFx(kind, town, days) { save.fx = save.fx.filter(f => f.town !== town.name); save.fx.push({ kind, town: town.name, until: save.day + days }); }


// ---------------------------------------------------------------- outposts
const MAX_OUTPOSTS = 5, OUT_COST = { scrap: 60, wood: 20 };
const outpostOf = t => save.outposts && save.outposts.find(o => o.name === t.name);
const outTown = o => TOWNS.find(t => t.name === o.name);
const outCost = o => ({ scrap: 60 + 40 * o.lvl, wood: 20 + 15 * o.lvl });
const garrison = o => save.crew.filter(c => c.hp > 0 && c.away && c.away.post === o.name);
const posted = () => save.crew.filter(c => c.hp > 0 && c.away && c.away.post);
const watched = t => !!outpostOf(t) || save.outposts.some(o => { const s = outTown(o); return s && garrison(o).length && kmBetween(s, t) <= 10; });
function outYield(t) {   // what an outpost produces each night: the site's richest supply
  const L = t.loot || {}, best = Object.entries(L).filter(([k]) => k !== 'gear' && k !== 'weapon' && k !== 'keys').sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'scrap';
}
function canEstablish(t) { return !outpostOf(t) && save.outposts.length < MAX_OUTPOSTS && !!save.sites[t.name] && costOk(OUT_COST); }
function establish(t) { logEvent(`Outpost established at ${t.short || t.name}`); payCost(OUT_COST); save.outposts.push({ name: t.name, lvl: 1 }); facRep(t.type === 'spot' ? 'militia' : 'farmers', 3); persist(); say(`Outpost established: ${t.short || t.name}. Post someone there.`); }
function dropOutpost(o) { for (const c of garrison(o)) c.away = null; save.outposts = save.outposts.filter(x => x !== o); }
const addIntel = txt => { save.intel.unshift({ day: save.day, text: txt }); save.intel = save.intel.slice(0, 8); };
function genIntel(o, t, g, rep) {   // the people at an outpost hear and see things; some of it is useful
  const scout = g.some(c => c.role === 'scout');
  if (Math.random() > clamp(.35 + .1 * (o.lvl - 1) + (scout ? .25 : 0) + (crewPerk('eagle') ? .2 : 0), 0, .95)) return;
  const nm = t.short || t.name, near = TOWNS.filter(x => x !== t && x.kind !== 'camp' && !outpostOf(x) && kmBetween(x, t) <= 20), r = Math.random();
  let m;
  if (r < .26 && near.length) { const s = pickOf(near); addFx('stash', s, 3); m = `${nm} scouts found a hidden stash at ${s.short || s.name}`; }
  else if (r < .42) { save.warned = 1; m = `${nm} saw armed riders heading for the house: the crew will be ready tonight`; }
  else if (r < .56 && near.some(x => x.type !== 'spot')) { const s = pickOf(near.filter(x => x.type !== 'spot')); addFx('outbreak', s, 5); m = `${nm} reports an outbreak in ${s.name}`; }
  else if (r < .68 && near.some(x => x.type === 'spot')) { const s = pickOf(near.filter(x => x.type === 'spot')); addFx('convoy', s, 3); m = `${nm} spotted a wrecked convoy at ${s.short || s.name}`; }
  else if (r < .84) { save.priceTip = save.day + 1; m = `Traders passed ${nm}: better prices tomorrow`; }
  else { save.intelEvent = pickOf(['gate', 'distress']); m = `Survivors were seen on the road near ${nm}, heading your way`; }
  addIntel(m); rep.push(`Intel: ${m}`);
}
function outpostsNight(rep, f) {
  for (const o of save.outposts.slice()) {
    const t = outTown(o); if (!t) continue; const nm = t.short || t.name, g = garrison(o);
    // attack (decided at dawn so you could send help)
    if ((save.outAttack || []).includes(o.name)) {
      const reinf = save.crew.filter(c => c.hp > 0 && c.away && c.away.tonight === o.name), party = g.concat(reinf);
      const fighters = party.filter(c => c.role === 'fighter').length, guardian = party.some(c => hasPerkOf(c, 'guardian'));
      const def = (g.length || reinf.length ? .45 + .12 * o.lvl + .08 * party.length + .08 * fighters + (guardian ? .06 : 0) + (o.spec === 'tower' ? .08 : 0) : .25);
      logEvent(`${nm} was attacked${reinf.length ? ' (reinforced)' : ''}`);
      if (Math.random() < def) { rep.push(`Outpost ${nm} fought off an attack${reinf.length ? ' with your help' : ''}`); for (const c of party) gainXp(c, c.role === 'fighter' ? 2 : 1).forEach(x => rep.push(x)); }
      else {
        for (const c of party) { const dmg = ri(25, 60); c.hp -= dmg; maybeInjure(c, dmg); if (c.hp <= 0) { crewDied(c, `died defending ${nm}`); f.lost++; rep.push(`${c.name} died defending ${nm}`); } }
        if (o.lvl > 1) { o.lvl--; garrison(o).slice(o.lvl).forEach(c => { c.away = null; }); rep.push(`OUTPOST ${nm.toUpperCase()} was hit hard and lost a level`); }
        else { dropOutpost(o); logEvent(`Outpost ${nm} was overrun`); rep.push(`OUTPOST ${nm.toUpperCase()} WAS OVERRUN${g.length ? '; the survivors fell back to the house' : ''}`); moraleHit(3); }
        continue;
      }
    }
    if (!g.length) { rep.push(`${nm} has no garrison: nothing produced`); continue; }
    // upkeep and production
    const need = g.length;
    if (save.res.food >= need) {
      save.res.food -= need; const k = outYield(t), mul = o.lvl * (1 + .25 * (g.length - 1)), base = Math.round((k === 'diesel' ? ri(3, 5) : ri(2, 4)) * mul);
      const prod = o.spec === 'farm' ? { food: Math.round(ri(2, 3) * mul), water: Math.round(ri(1, 2) * mul) } : o.spec === 'workshop' ? { scrap: Math.round(ri(2, 4) * mul), ammo: Math.round(ri(1, 2) * mul) } : o.spec === 'clinic' ? { meds: Math.round(ri(1, 2) * mul), [k]: Math.max(1, Math.round(base / 2)) } : { [k]: base };
      giveRes(prod); if (o.spec === 'clinic') for (const c of g) c.hp = Math.min(100, c.hp + 15);
      rep.push(`${nm} (${g.map(c => c.name).join(', ')}): ${gainTxt(prod)}`);
      facRep(t.type === 'spot' ? 'militia' : 'farmers', .5);
      for (const c of g) gainXp(c, 1).forEach(x => rep.push(x));
      genIntel(o, t, g, rep); if (o.spec === 'tower') genIntel(o, t, g, rep);
    } else { rep.push(`${nm} garrison is out of rations and produced nothing`); moraleHit(5, g); }
  }
}
const outpostsScene = {
  fixed: true, pick: null, pickSpec: null,
  enter() { this.pick = null; this.pickSpec = null; },
  draw() {
    panel('OUTPOSTS', `${save.outposts.length}/${MAX_OUTPOSTS} held · garrison them: an empty outpost produces nothing and falls easily`);
    if (!save.outposts.length) wrapText('No outposts yet. Loot a village, a petrol station or any site in Timișoara, then press ESTABLISH OUTPOST on its briefing. Post crew there: they work the site, defend it and feed back intel. Outposts also lower trade prices and count towards founding your settlement.', 80).forEach((l, i) => text(l, W / 2, 180 + i * 18, 13, '#9fb', 'center'));
    save.outposts.forEach((o, i) => {
      const t = outTown(o), y = 100 + i * 74, K = t && t.type === 'spot' ? SPOT_KINDS[t.kind] : null, up = outCost(o), g = garrison(o);
      ctx.fillStyle = '#07150d'; ctx.fillRect(40, y, 880, 68); ctx.strokeStyle = g.length ? '#3a9a5a' : '#8a5a2a'; ctx.strokeRect(40.5, y + .5, 880, 68);
      text(`⚑ ${t ? (t.short || t.name) : o.name}`, 54, y + 22, 14, '#fff'); text(`${K ? K.label : t.type} · level ${o.lvl}/3 · ${Math.round(kmBetween(t, HOME) * 1.25)} km`, 54, y + 40, 10, K ? K.color : '#9fb');
      text(`makes ${outYield(t)} (x${o.lvl}) · garrison eats 1 food each`, 54, y + 58, 10, '#8aa');
      text(`GARRISON ${g.length}/${o.lvl}`, 330, y + 22, 11, g.length ? '#6f8' : RED);
      g.forEach((c, j) => button(`✕ ${c.name} (${ROLES[c.role].label.toLowerCase()})`, 330 + j * 150, y + 30, 146, 24, () => { c.away = null; persist(); }));
      if (g.length < o.lvl) button('+ POST CREW', 330 + g.length * 150, y + 30, 120, 24, () => { this.pick = o; }, alive().some(c => c.hp >= 40 && !blocked(c)) && alive().length > 2);
      button(o.lvl >= 3 ? 'MAX LEVEL' : `UP: ${up.scrap} scrap, ${up.wood} wood`, 720, y + 8, 188, 24, () => { payCost(up); o.lvl++; persist(); }, o.lvl < 3 && costOk(up));
      button(o.spec ? SPEC[o.spec].name : 'SPECIALISE', 720, y + 38, 94, 24, () => { this.pickSpec = o; }, !o.spec && o.lvl >= 2 && costOk(SPEC_COST));
      button('ABANDON', 818, y + 38, 90, 24, () => { if (typeof confirm !== 'function' || confirm('Abandon this outpost?')) { dropOutpost(o); persist(); } });
    });
    const iy = 100 + Math.max(1, save.outposts.length) * 74 + 6;
    text('INTEL FEED', 40, iy + 8, 12, '#6cf');
    if (!save.intel.length) text('Garrisoned outposts report what they see and hear. Scouts hear more.', 40, iy + 28, 11, '#5fa478');
    save.intel.slice(0, Math.floor((H - 70 - iy) / 16)).forEach((n, i) => text(`day ${n.day}: ${n.text}`, 40, iy + 28 + i * 16, 11, i ? '#8aa' : '#9fd'));
    back();
    if (this.pickSpec) {
      const o = this.pickSpec, t = outTown(o); ctx.fillStyle = 'rgba(3,8,6,.96)'; ctx.fillRect(220, 110, 520, 400); ctx.strokeStyle = GREEN; ctx.strokeRect(220.5, 110.5, 520, 400);
      text(`SPECIALISE ${(t.short || t.name).toUpperCase()}`, W / 2, 140, 15, AMBER, 'center'); text(`one-off cost: ${costTxt(SPEC_COST)}`, W / 2, 160, 11, '#9fb', 'center');
      Object.entries(SPEC).forEach(([k, S], i) => { const y = 176 + i * 58; ctx.fillStyle = '#07150d'; ctx.fillRect(240, y, 480, 50); ctx.strokeStyle = DIM; ctx.strokeRect(240.5, y + .5, 480, 50); text(S.name, 252, y + 22, 13, '#fff'); text(S.desc, 252, y + 40, 10, '#9fb'); button('CHOOSE', 620, y + 12, 90, 26, () => { payCost(SPEC_COST); o.spec = k; this.pickSpec = null; logEvent(`${t.short || t.name} became a ${S.name.toLowerCase()}`); persist(); }); });
      button('CANCEL', W / 2 - 60, 470, 120, 28, () => { this.pickSpec = null; });
    }
    if (this.pick) {
      const o = this.pick, t = outTown(o); ctx.fillStyle = 'rgba(3,8,6,.95)'; ctx.fillRect(250, 110, 460, 420); ctx.strokeStyle = GREEN; ctx.strokeRect(250.5, 110.5, 460, 420);
      text(`POST TO ${(t.short || t.name).toUpperCase()}`, W / 2, 140, 15, AMBER, 'center');
      alive().filter(c => c.hp >= 40 && !blocked(c)).slice(0, 9).forEach((c, i) => button(`${c.name} · ${ROLES[c.role].label} Lv${c.lvl} · HP ${Math.round(c.hp)}`, 270, 160 + i * 38, 420, 32, () => { c.away = { post: o.name, back: null }; this.pick = null; persist(); }, alive().length > 2));
      button('CANCEL', W / 2 - 60, 494, 120, 28, () => { this.pick = null; });
    }
  },
};

// ---------------------------------------------------------------- panels
function panel(title, sub) {
  ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H); drawHUD();
  text(title, W / 2, 66, 18, AMBER, 'center'); if (sub) text(sub, W / 2, 86, 11, '#9fb', 'center');
}
const back = (label = '◂ BACK') => button(label, W - 190, H - 52, 170, 36, () => go(baseScene));
function bar(x, y, w, h, f, col, bg = '#300') { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(f, 0, 1), h); }

// ---------------------------------------------------------------- crew and expeditions
const EXPEDS = [
  { id: 'farms',  name: 'Farms around Cărani',    days: 1, risk: .12, loot: { food: [6, 12], water: [4, 8] } },
  { id: 'houses', name: 'Village houses',          days: 1, risk: .15, loot: { scrap: [10, 18], wood: [3, 6], ammo: [2, 5] } },
  { id: 'pharm',  name: 'Pharmacy in Sânandrei',   days: 1, risk: .22, loot: { meds: [4, 9] } },
  { id: 'fuel',   name: 'Fuel stop on the DN6',    days: 1, risk: .25, loot: { diesel: [6, 12] } },
  { id: 'depot',  name: 'Industrial depot',        days: 2, risk: .35, loot: { scrap: [18, 28], ammo: [6, 12], shells: [3, 6] } },
  { id: 'family', name: 'Search for family', days: 2, risk: .4, loot: {}, hidden: true },
  { id: 'radio',  name: 'Search for survivors',    days: 2, risk: .30, loot: { food: [2, 4] }, recruit: .55, needs: 'radio' },
];
const expedChance = (c, E) => clamp(1 - E.risk + .05 * (c.lvl - 1) + (hasPerkOf(c, 'ranger') ? .08 : 0) + (c.trait === 'lucky' ? .1 : 0) + (c.morale >= 75 ? .05 : c.morale < 35 ? -.1 : 0), .3, .95);
function expedReturn(c, rep) {
  const E = EXPEDS.find(e => e.id === c.away.id), fam = c.away.id === 'family' ? c.away : null; c.away = null;
  if (fam) {
    if (Math.random() < .5) { const n = recruit(); c.morale = clamp(c.morale + 25, 0, 100); gainXp(c, 2); const m = n ? `${c.name} found their ${fam.rel} alive near ${fam.place}, and ${n.name} (${ROLES[n.role].label.toLowerCase()}) came back with them` : `${c.name} found their ${fam.rel} near ${fam.place}, but there is no room to take them in`; rep.push(m); logEvent(m); }
    else { c.morale = clamp(c.morale - 25, 0, 100); const dmg = ri(10, 30); c.hp -= dmg; maybeInjure(c, dmg); if (c.hp <= 0) { crewDied(c, `died looking for family near ${fam.place}`); rep.push(`${c.name} never came back from ${fam.place}`); return 1; } rep.push(`${c.name} came back from ${fam.place} with nothing but bad news`); logEvent(`${c.name} found no trace of their ${fam.rel}`); }
    return 0;
  }
  if (Math.random() < expedChance(c, E)) {
    const mul = (c.trait === 'scavenger' ? 1.3 : 1) * (1 + .1 * (c.lvl - 1)) * (hasPerkOf(c, 'looter') ? 1.15 : 1) * (hasPerkOf(c, 'forager') ? 1.2 : 1), got = {};
    for (const [k, [a, b]] of Object.entries(E.loot)) got[k] = Math.round(ri(a, b) * mul);
    giveRes(got); const lv = gainXp(c, 3); c.morale = clamp(c.morale + 4, 0, 100);
    let extra = ''; if (E.recruit && Math.random() < E.recruit) { const n = recruit(); extra = n ? `, and brought back ${n.name} (${ROLES[n.role].label.toLowerCase()})` : ', and found survivors but there is no room'; }
    rep.push(`${c.name} came back from the ${E.name.toLowerCase()}: ${gainTxt(got)}${extra}`); lv.forEach(m => rep.push(m));
  } else {
    const dmg = ri(30, 65); c.hp -= dmg; gainXp(c, 1); maybeInjure(c, dmg);
    if (c.hp <= 0) { crewDied(c, `never came back from the ${E.name.toLowerCase()}`); rep.push(`${c.name} never came back from the ${E.name.toLowerCase()}`); return 1; }
    rep.push(`${c.name} was hurt on the ${E.name.toLowerCase()} and returned empty-handed`);
  }
  return 0;
}
const crewScene = {
  fixed: true, rows: [], pick: null, sel: null,
  enter() { this.pick = null; this.sel = null; },
  click() {
    if (this.pick) return;
    const row = this.rows.find(r => mouse.y >= r.y && mouse.y <= r.y + 60 && mouse.x >= r.x && mouse.x <= r.x + 320);
    if (row && row.c.hp > 0) this.sel = row.c;
  },
  draw() {
    panel('CREW', `${living().length} of ${crewCap()} beds · average morale ${Math.round(moraleAvg())} · click a person for details, perks and relationships`);
    this.rows = [];
    const list = save.crew.filter(c => c.hp > 0 || save.crew.length <= 8);
    list.forEach((c, i) => {
      const col = i < 7 ? 0 : 1, row = i < 7 ? i : i - 7, x = 24 + col * 460, y = 100 + row * 66, role = ROLES[c.role], dead = c.hp <= 0;
      this.rows.push({ x, y, c });
      ctx.fillStyle = '#07150d'; ctx.fillRect(x, y, 450, 60); ctx.strokeStyle = dead ? '#522' : c.away ? '#445' : DIM; ctx.strokeRect(x + .5, y + .5, 450, 60);
      ctx.fillStyle = dead ? '#444' : role.color; ctx.fillRect(x + 8, y + 12, 6, 36);
      text(c.name + (c.partner ? ' ♥' : ''), x + 24, y + 19, 14, dead ? '#755' : '#fff');
      text(dead ? 'LOST' : `${role.label}  Lv${c.lvl}`, x + 24, y + 34, 11, dead ? RED : role.color);
      text(dead ? '' : TRAITS[c.trait].name, x + 24, y + 50, 10, '#8aa');
      if (dead) return;
      text(c.inj ? `⚕ ${INJ[c.inj.type].name}` : c.away ? (c.away.post ? `POSTED: ${(outTown({ name: c.away.post }) || {}).short || c.away.post}` : `OUT: ${EXPEDS.find(e => e.id === c.away.id).name}`) : role.desc.length > 30 ? role.desc.slice(0, 29) + '…' : role.desc, x + 130, y + 19, 10, c.away ? AMBER : '#9fb');
      text('HP', x + 130, y + 36, 9, '#9a9'); bar(x + 150, y + 29, 80, 8, c.hp / 100, c.hp < 40 ? RED : GREEN);
      text('MORALE', x + 130, y + 52, 9, '#9a9'); bar(x + 172, y + 45, 58, 8, c.morale / 100, c.morale < 30 ? RED : c.morale > 75 ? '#8df' : '#fc4', '#222');
      bar(x + 240, y + 29, 60, 5, c.xp / (c.lvl * 4), '#c8f', '#212'); text(perkPending(c) ? '★ PERK!' : c.lvl >= 5 ? 'MAX' : `XP ${c.xp}/${c.lvl * 4}`, x + 240, y + 48, 9, perkPending(c) ? '#fc4' : '#a8c');
      if (c.away) text(c.away.post ? 'at outpost' : `back day ${c.away.back}`, x + 380, y + 35, 10, AMBER, 'center');
      else button('SEND OUT', x + 330, y + 18, 108, 26, () => { this.pick = c; }, c.hp >= 40 && save.res.food >= 2 && alive().length > 2 && !blocked(c));
    });
    text('Away crew do not eat, fight or work. An expedition costs 2 food.', 24, H - 24, 11, '#5fa478');
    back();
    if (this.sel && !this.pick) drawCrewDetail(this);
    if (this.pick) {
      const c = this.pick; ctx.fillStyle = 'rgba(3,8,6,.94)'; ctx.fillRect(150, 100, 660, 430); ctx.strokeStyle = GREEN; ctx.strokeRect(150.5, 100.5, 660, 430);
      text(`SEND ${c.name.toUpperCase()} (${ROLES[c.role].label} Lv${c.lvl})`, W / 2, 130, 16, AMBER, 'center');
      EXPEDS.filter(e => !e.hidden).forEach((E, i) => {
        const y = 150 + i * 56, ok = !E.needs || roomLvl(E.needs) > 0, pc = Math.round(expedChance(c, E) * 100);
        ctx.fillStyle = '#07150d'; ctx.fillRect(170, y, 620, 48); ctx.strokeStyle = DIM; ctx.strokeRect(170.5, y + .5, 620, 48);
        text(E.name, 182, y + 20, 13, ok ? '#fff' : '#566'); text(`${E.days} day${E.days > 1 ? 's' : ''} · ${ok ? pc + '% success' : 'needs a radio room'}`, 182, y + 38, 10, pc < 60 ? '#fa5' : '#9fb');
        text(E.recruit ? 'may bring back a survivor' : Object.entries(E.loot).map(([k, [a, b]]) => `${k} ${a}-${b}`).join('  '), 440, y + 29, 10, '#8aa');
        button('GO', 700, y + 10, 78, 28, () => { c.away = { id: E.id, back: save.day + E.days }; save.res.food -= 2; save.stats.expeds++; this.pick = null; persist(); }, ok);
      });
      button('CANCEL', W / 2 - 60, 490, 120, 30, () => { this.pick = null; });
    }
  },
};

// ---------------------------------------------------------------- rooms
const ROOMS = {
  bunks:   { name: 'Bunk rooms',  max: 2, cost: [{ scrap: 30, wood: 10 }, { scrap: 60, wood: 20 }], eff: l => `Beds for ${8 + 3 * l} survivors. Room to take in more people.` },
  kitchen: { name: 'Kitchen',     max: 1, cost: [{ scrap: 25, wood: 6 }], eff: () => 'Stocked kitchen: the crew eats 1 less food a night and morale rises.' },
  clinic:  { name: 'Clinic',      max: 2, cost: [{ scrap: 40, meds: 4 }, { scrap: 70, meds: 8 }], eff: l => `Beds and supplies: +${10 * l} healing a night, medicine works better.` },
  radio:   { name: 'Radio room',  max: 2, cost: [{ scrap: 60, ammo: 10 }, { scrap: 90, wood: 20, ammo: 20 }], eff: l => l < 1 ? 'Opens trade, distress calls and news.' : l < 2 ? 'Radio room built. A mast would reach every faction: more offers each day.' : 'Long-range mast raised: more offers from every faction.' },
  storage: { name: 'Storeroom',   max: 2, cost: [{ scrap: 35, wood: 12 }, { scrap: 70, wood: 24 }], eff: l => `Stores up to ${resCap('food')} of most supplies (${resCap('scrap')} scrap). Surplus is lost.` },
};
const roomsScene = {
  fixed: true,
  draw() {
    panel('HOUSE ROOMS', 'Rooms inside the house. Each one changes how the crew lives.');
    Object.entries(ROOMS).forEach(([k, R], i) => {
      const y = 106 + i * 82, l = roomLvl(k), full = l >= R.max, c = R.cost[l];
      ctx.fillStyle = '#07150d'; ctx.fillRect(60, y, 840, 74); ctx.strokeStyle = l ? '#3a9a5a' : DIM; ctx.strokeRect(60.5, y + .5, 840, 74);
      text(R.name.toUpperCase(), 78, y + 24, 15, '#fff'); for (let j = 0; j < R.max; j++) { ctx.fillStyle = j < l ? AMBER : '#223'; ctx.fillRect(78 + j * 22, y + 34, 18, 8); }
      text(R.eff(k === 'radio' ? l : Math.max(1, l)), 78, y + 62, 11, '#9fb');
      if (!full) { text(costTxt(c), 560, y + 28, 12, costOk(c) ? GREEN : RED);  }
      button(full ? 'BUILT' : l ? 'UPGRADE' : 'BUILD', 770, y + 18, 110, 36, () => { payCost(c); save.rooms[k] = l + 1; persist(); say(`${R.name} ${l ? 'upgraded' : 'built'}`); }, !full && costOk(c));
    });
    back();
  },
};

// ---------------------------------------------------------------- trade and factions
function genTrades() {
  const o = [], rate = f => 1.2 - save.fac[f].rep / 220 + (f === 'reapers' ? .25 : 0) - .04 * save.outposts.length - (save.priceTip >= save.day ? .12 : 0);
  const res = (f, gets, gives) => { const g = pickOf(gets), k = pickOf(gives.filter(x => x !== g)), n = ri(5, 10), give = Math.max(1, Math.ceil(VAL[g] * n * rate(f) / VAL[k])); return { fac: f, get: { [g]: n }, give: { [k]: give } }; };
  const item = (f, id) => { const it = GEAR_BY_ID[id]; return { fac: f, item: id, give: { scrap: Math.ceil((28 + it.r * 34) * rate(f)) } }; };
  for (let i = 0; i < 2; i++) o.push(res('farmers', ['food', 'water', 'diesel', 'wood'], ['scrap', 'ammo', 'meds']));
  for (let i = 0; i < 2; i++) o.push(res('militia', ['ammo', 'shells', 'meds'], ['food', 'scrap', 'diesel', 'water']));
  o.push(item('militia', rollWeapon('police')));
  o.push(res('scientists', ['meds', 'water'], ['food', 'scrap', 'ammo'])); o.push(res('army', ['ammo', 'shells'], ['diesel', 'food', 'meds'])); o.push(item('army', rollWeapon('army')));
  if (save.fac.reapers.rep > -50 && !reapersGone()) { o.push(res('reapers', ['ammo', 'shells', 'scrap', 'meds'], ['food', 'diesel', 'water'])); o.push(item('reapers', rollWeapon('any'))); o.push(item('reapers', rollGear('gang'))); }
  if (roomLvl('radio') >= 2) { o.push(res('farmers', ['food', 'water', 'diesel', 'wood'], ['scrap', 'ammo', 'meds'])); o.push(res('militia', ['ammo', 'shells', 'meds'], ['food', 'scrap', 'diesel', 'water'])); }
  for (const p of save.outposts) { const t = outTown(p); if (!t) continue; const k = outYield(t), n = ri(6, 12) * p.lvl, g = pickOf(['scrap', 'ammo', 'food', 'wood'].filter(x => x !== k)); o.push({ fac: 'own', label: `Your outpost: ${t.short || t.name}`, get: { [k]: n }, give: { [g]: Math.max(1, Math.ceil(VAL[k] * n * .7 / VAL[g])) } }); }
  if (save.fac.farmers.rep >= 40) o.push({ fac: 'farmers', recruit: true, give: { food: 10 } });
  if (save.fac.militia.rep >= 50) o.push({ fac: 'militia', recruit: true, give: { ammo: 20 } });
  save.trades = o.slice(0, 16);
}
// ---------------------------------------------------------------- random events
const reapersRaid = () => { save.raidBoost = 1; };
const EVENTS = {
  distress: {
    title: 'DISTRESS CALL', when: () => roomLvl('radio') > 0 && save.day >= 2, w: 3,
    text: () => 'A shaky voice on the radio: a few survivors are pinned down in a farmhouse a few kilometres away, with infected outside.',
    choices: [
      { label: 'Send the fighters (4 ammo)', ok: () => has('fighter') && save.res.ammo >= 4, act: () => {
        save.res.ammo -= 4;
        if (Math.random() < .65) { const c = recruit(), g = { food: ri(3, 8), water: ri(3, 6), scrap: ri(5, 12) }; giveRes(g); alive().filter(x => x.role === 'fighter').forEach(f => gainXp(f, 2)); return c ? `You got them out. ${c.name} joins the crew, and they left supplies (${gainTxt(g)}).` : `You got them out. They moved on, but left supplies (${gainTxt(g)}).`; }
        const f = pickOf(alive().filter(x => x.role === 'fighter')); f.hp = Math.max(1, f.hp - 40); return `It was a trap. ${f.name} came back hurt, with nothing to show for it.`; } },
      { label: 'Stay put', act: () => { moraleHit(3); return 'The voice fades out. Nobody says much for the rest of the day.'; } },
    ],
  },
  gate: {
    title: 'SURVIVORS AT THE GATE', when: () => save.day >= 2, w: 3,
    text: () => 'A man, a woman and a teenager stand at the gate with a handcart. They are thin but unarmed.',
    choices: [
      { label: 'Take one in (5 food)', ok: () => save.res.food >= 5 && living().length < crewCap(), act: () => { save.res.food -= 5; const c = recruit(); return `${c.name} joins you as a ${ROLES[c.role].label.toLowerCase()}. The others thank you and walk on.`; } },
      { label: 'Trade with them', act: () => { const g = { [pickOf(['scrap', 'wood', 'water', 'ammo'])]: ri(6, 12) }; giveRes(g); return `They swap what they can spare (${gainTxt(g)}) and go.`; } },
      { label: 'Turn them away', act: () => { moraleHit(4); return 'They go. The crew watched from the windows.'; } },
    ],
  },
  trader: {
    title: 'WANDERING TRADER', when: () => save.day >= 2, w: 2,
    text: () => 'A man with a loaded bicycle trailer stops at the fence and shows you his goods.',
    choices: [
      { label: 'Browse his wares', act: () => { genTrades(); save.trades = save.trades.filter(t => !t.recruit && t.fac !== 'own').map(t => ({ ...t, fac: 'wanderer', give: Object.fromEntries(Object.entries(t.give).map(([k, n]) => [k, Math.max(1, Math.round(n * .9))])) })); save.goTrade = true; return 'He lays everything out on a tarp.'; } },
      { label: 'Wave him on', act: () => 'He shrugs and rolls on.' },
    ],
  },
  convoy: {
    title: 'CONVOY SPOTTED', when: () => save.day >= 3 && !save.fx.some(f => f.kind === 'convoy'), w: 2,
    text: () => 'A scout saw an abandoned military convoy on the edge of Timișoara. It is marked on the map for a few days, and every infected for miles has noticed it too.',
    choices: [{ label: 'Mark it on the map', act: () => { const t = pickOf(TOWNS.filter(t => t.type === 'spot' && t.kind !== 'airport' && t.kind !== 'camp')); addFx('convoy', t, 3); return `Marked at ${t.short || t.name}: extra crates, weapons and ammo. It will not last.`; } }],
  },
  outbreak: {
    title: 'OUTBREAK', when: () => save.day >= 3 && !save.fx.some(f => f.kind === 'outbreak'), w: 2,
    text: () => 'Smoke on the horizon, and the radio is full of screaming. A nearby settlement is swarming.',
    choices: [{ label: 'Mark it on the map', act: () => { const t = pickOf(TOWNS.filter(t => (t.type === 'village' || t.type === 'town') && kmBetween(t, HOME) < 40 && kmBetween(t, HOME) > 4)); addFx('outbreak', t, 5); return `${t.name} is overrun. Dangerous, but nobody has looted it yet.`; } }],
  },
  storm: {
    title: 'VIOLENT STORM', when: () => true, w: 1.5,
    text: () => 'Black clouds roll in from the west. By morning the sky is a wall of rain and the panels are dark.',
    choices: [{ label: 'Batten down', act: () => { save.weather = 'storm'; save.energy = Math.max(0, save.energy - 5); moraleHit(2); const w = tanks(); save.res.water += w; return `Solar will be poor today and the battery took a hit (-5 kWh).${w ? ` The tanks filled: +${w} water.` : ''}`; } }],
  },
  demand: {
    title: 'THE REAPERS ARE AT THE FENCE', when: () => save.fac.reapers.rep < 5 && save.day >= 4 && reapersLive(), w: 3,
    text: () => 'Four armed men with a pickup. Their leader offers terms: pay for passage, or they will take what they want tomorrow night.',
    choices: [
      { label: 'Pay tribute (20 scrap, 10 ammo)', ok: () => save.res.scrap >= 20 && save.res.ammo >= 10, act: () => { save.res.scrap -= 20; save.res.ammo -= 10; facRep('reapers', 15); return 'He takes it without a word. They will leave you alone for now.'; } },
      { label: 'Refuse', act: () => { facRep('reapers', -10); reapersRaid(); moraleHit(3); return 'They drive off. Expect a bigger visit tonight.'; } },
    ],
  },
  militia: {
    title: 'MILITIA REQUEST', when: () => save.day >= 3 && roomLvl('radio') > 0, w: 2,
    text: () => 'A militia radio operator asks for medicine. Their field hospital in Timișoara is out of everything.',
    choices: [
      { label: 'Send 6 meds', ok: () => save.res.meds >= 6, act: () => { save.res.meds -= 6; facRep('militia', 15); giveRes({ ammo: 10 }); return 'They send back 10 rounds and their thanks. Word will get around.'; } },
      { label: 'Decline', act: () => { facRep('militia', -3); return 'They sign off, politely.'; } },
    ],
  },
  illness: {
    title: 'FEVER IN THE HOUSE', when: () => save.day >= 2, w: 1.5,
    text: () => 'One of the crew woke up burning with fever. Nobody is sure whether it is an infection.',
    choices: [
      { label: 'Treat it (3 meds)', ok: () => save.res.meds >= 3, act: () => { save.res.meds -= 3; return 'The fever breaks by evening. Whatever it was, it is gone.'; } },
      { label: 'Let it run its course', act: () => { const c = pickOf(alive()); c.hp = Math.max(1, c.hp - 35); moraleHit(3); return `${c.name} gets through it, barely.`; } },
    ],
  },
  cache: {
    title: 'A HIDDEN CACHE', when: () => true, w: 2,
    text: () => 'While repairing the shed, the crew finds a sealed box under the floor. Someone hid it a long time ago.',
    choices: [{ label: 'Open it', act: () => { const g = {}; for (let i = 0; i < 3; i++) { const k = pickOf(RES_KEYS); g[k] = (g[k] || 0) + ri(3, 9); } giveRes(g); moraleHit(-5); return `Inside: ${gainTxt(g)}.`; } }],
  },
};
const tanks = () => save.buildings.filter(b => b.t === 'tank').length * 3;
function rollEvent() {
  if (save.funeralQ.length) { save.event = { id: 'funeral', ...EVENTS.funeral.prep() }; return; }
  if (save.intelEvent) { save.event = { id: save.intelEvent }; save.intelEvent = null; return; }
  if (save.day < 2 || Math.random() > .62) return;
  const pool = Object.entries(EVENTS).filter(([id, e]) => id !== 'funeral' && e.when()), tot = pool.reduce((s, [, e]) => s + e.w, 0);
  let x = Math.random() * tot; for (const [id, e] of pool) if ((x -= e.w) <= 0) { const data = e.prep ? e.prep() : {}; if (!data) return; save.event = { id, ...data }; return; }
}
const eventScene = {
  fixed: true, res: null,
  enter() { this.res = null; },
  draw() {
    const E = EVENTS[save.event && save.event.id]; if (!E) { go(baseScene); return; }
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H); drawHUD();
    ctx.fillStyle = '#07150d'; ctx.fillRect(160, 110, 640, 380); ctx.strokeStyle = AMBER; ctx.strokeRect(160.5, 110.5, 640, 380);
    text(`DAY ${save.day}`, W / 2, 138, 11, '#9fb', 'center'); text(E.title, W / 2, 168, 22, AMBER, 'center');
    wrapText(E.text(save.event), 62).forEach((l, i) => text(l, W / 2, 210 + i * 18, 13, '#cfe', 'center'));
    if (!this.res) E.choices.forEach((c, i) => button(c.label, 220, 320 + i * 46, 520, 38, () => { this.res = c.act(save.event); logEvent(`${E.title}: ${c.label}`); save.event = null; persist(); }, !c.ok || c.ok(save.event)));
    else {
      wrapText(this.res, 62).forEach((l, i) => text(l, W / 2, 330 + i * 18, 13, GREEN, 'center'));
      button('CONTINUE', W / 2 - 70, 430, 140, 36, () => { if (save.goTrade) { save.goTrade = false; go(tradeScene); } else afterNight(); });
    }
  },
};

// ---------------------------------------------------------------- campaign and ending
const founded = () => ({
  outposts: save.outposts.length >= 3, trades: save.stats.trades >= 8,
  allies: save.fac.farmers.rep >= 25 && save.fac.militia.rep >= 25, peace: save.fac.reapers.rep > -15,
});
const CHAPTERS = [
  { t: 'DIG IN', d: 'Survive until day 6 and upgrade a fence, wall or the gate beyond its first tier.', ok: () => save.day >= 6 && save.buildings.some(b => ['fence', 'wall', 'gate'].includes(b.t) && (b.lvl || 0) >= 1), prog: () => `Day ${Math.min(save.day, 6)}/6`, reward: { scrap: 40, wood: 10 } },
  { t: 'REACH OUT', d: 'Build the radio room and make a trade with a survivor group.', ok: () => roomLvl('radio') >= 1 && save.stats.trades >= 1, prog: () => `Radio room ${roomLvl('radio') ? '✓' : '✗'} · trades ${Math.min(1, save.stats.trades)}/1`, reward: { ammo: 30, meds: 6 } },
  { t: 'PLANT A FLAG', d: 'Loot a site, then claim it as your first outpost from its briefing screen. Outposts produce supplies, calm the area and count towards your settlement.', ok: () => save.outposts.length >= 1, prog: () => `Outposts ${save.outposts.length}/1`, reward: { scrap: 60, wood: 20 } },
  { t: 'A NETWORK', d: 'Hold three outposts and make eight trades. Outposts are a petrol station on the DN69, villages, pharmacies, depots: pick the useful ones.', ok: () => save.outposts.length >= 3 && save.stats.trades >= 8, prog: () => `Outposts ${save.outposts.length}/3 · trades ${Math.min(8, save.stats.trades)}/8`, reward: { diesel: 15, ammo: 40, meds: 8 } },
  { t: 'WRITE THE ENDING', d: 'Choose how the story ends on the ENDINGS tab: a free settlement, the Republic, the road north or the Banat Compact. Each has its own requirements.', ok: () => save.won, prog: () => `${Object.keys(ENDINGS).filter(k => !ENDINGS[k].auto && endingOk(k)).length} ending(s) available`, reward: {} },
];
function goalsTick(rep) {
  let n = 0;
  while (save.goal.ch < CHAPTERS.length && CHAPTERS[save.goal.ch].ok() && n++ < 5) {
    const C = CHAPTERS[save.goal.ch]; giveRes(C.reward); save.goal.ch++;
    logEvent(`Objective done: ${C.t}`);
    const m = `OBJECTIVE DONE: ${C.t}${Object.keys(C.reward).length ? ' (' + gainTxt(C.reward) + ')' : ''}`;
    if (rep) rep.push(m); else say(m);
  }
}
// ---------------------------------------------------------------- the nightly hook (called from endNight)
function worldNight(f, rep) {
  // expeditions coming home
  for (const c of save.crew) if (c.hp > 0 && c.away && c.away.id && save.day >= c.away.back) f.lost += expedReturn(c, rep);
  // experience and morale
  const here = alive(), lv = [];
  for (const c of here) { lv.push(...gainXp(c, 1 + (f.won && c.role === 'fighter' ? 1 : 0))); }
  lv.forEach(m => rep.push(m));
  const dm = f.lackF || f.lackW ? -8 : 2;
  for (const c of here) {
    let d = 1 + dm + (f.won ? 2 : -8) + (roomLvl('kitchen') ? 2 : 0) + (roomLvl('clinic') ? 1 : 0) + (roomLvl('radio') ? 1 : 0) + (roomLvl('bunks') ? 1 : 0);
    if (f.blackout) d -= 5; if (f.lost) d -= 10 * f.lost;
    c.morale = clamp(c.morale + (d < 0 ? d * (c.trait === 'steady' ? .5 : c.trait === 'nervous' ? 1.5 : 1) : d), 0, 100);
    if (c.trait === 'tough') c.hp = Math.min(100, c.hp + 10);
    if (hasResearch('antibiotics')) c.hp = Math.min(100, c.hp + 5);
  }
  storiesNight(f, rep);
  const avg = moraleAvg(); if (here.length) rep.push(avg >= 75 ? 'Morale is high' : avg < 35 ? 'MORALE IS LOW: people are talking about leaving' : `Average morale ${Math.round(avg)}`);
  if (alive().length > 3) for (const c of alive()) if (c.morale < 12 && Math.random() < .35) { crewDied(c, 'left in the night'); save.res.food = Math.max(0, save.res.food - 3); rep.push(`${c.name} left in the night, taking some food`); break; }
  // storage, trade, events
  const lost = clampRes(); if (lost.length) rep.push(`Storage full, lost: ${lost.join(', ')}`);
  outpostsNight(rep, f); diploNight(rep);
  genTrades();
  const before = save.fx.length; save.fx = save.fx.filter(x => x.until > save.day); if (save.fx.length < before) rep.push('A marked site has gone cold');
  goalsTick(rep);
  if (save.day >= 100 && !save.won && !save.scoreRec) { save.won = true; save.endingId = 'endurance'; save.scoreRec = true; recordScore(ENDINGS.endurance.title); logEvent('One hundred days'); rep.push('ONE HUNDRED DAYS: you have outlasted everything'); }
  if (!save.won) rollEvent();
}
function afterNight() {   // where to go once the night report is dismissed
  if (save.won && !save.wonSeen) go(endScene);
  else if (save.event && EVENTS[save.event.id]) go(eventScene);
  else go(baseScene);
}
