// Objectives screen, the five endings and how to earn them, the ending screen, seasons, and the day-100 milestone.

// ---------------------------------------------------------------- seasons
const SEASONS = [
  { id: 'spring', name: 'SPRING', sun: 1.0, grow: 1.0, load: 0, need: 0, desc: 'Mild. Planting season.' },
  { id: 'summer', name: 'SUMMER', sun: 1.2, grow: 1.25, load: 0, need: 0, water: 1, desc: 'Long sun and rich crops, but the crew drinks more.' },
  { id: 'autumn', name: 'AUTUMN', sun: .95, grow: 1.0, load: 0, need: 0, desc: 'The harvest, and the days shortening.' },
  { id: 'winter', name: 'WINTER', sun: .55, grow: .5, load: 4, need: 1, desc: 'Thin sun, poor crops, heating bills and bigger appetites.' },
];
const seasonOf = () => SEASONS[(Math.floor((save.day - 1) / 30) + (save.season0 == null ? 2 : save.season0)) % 4];

// ---------------------------------------------------------------- endings
const hasHauler = () => save.vehicles.some(v => ['pickup', 'van', 'truck', 'ev_van'].includes(v.type) && (v.hp == null ? 100 : v.hp) >= 50);
const ENDINGS = {
  founded: {
    title: 'FREE SETTLEMENT', blurb: 'Found your own settlement, answering to nobody.',
    req: () => [[`${save.outposts.length}/3 outposts`, save.outposts.length >= 3], [`farmers ${Math.round(save.fac.farmers.rep)} and militia ${Math.round(save.fac.militia.rep)} (need 25)`, save.fac.farmers.rep >= 25 && save.fac.militia.rep >= 25], ['the Reapers are no open threat', reapersGone() || reapersTruce() || save.fac.reapers.rep > -15]],
    text: ['is now a name people know across Timiș County.', 'Trucks come to the Petrom station for fuel, caravans stop at your gate, and the farms trade with the city through you.'],
  },
  enlisted: {
    title: 'THE REPUBLIC', blurb: 'Hand the house to the militia and take a seat on the Timișoara council.',
    req: () => [['a pact with the militia', !!save.pacts.militia], [`militia standing ${Math.round(save.fac.militia.rep)} (need 70)`, save.fac.militia.rep >= 70], [`${save.outposts.length}/2 outposts`, save.outposts.length >= 2], [`${living().length}/5 survivors`, living().length >= 5]],
    text: ['joined the Republic of Timișoara.', 'The colonel took your keys and gave you a seat on the council, a garrison for every outpost and wages for your people.'],
  },
  north: {
    title: 'THE ROAD NORTH', blurb: 'Leave the county for the mountains: a convoy, a long drive, a fresh start.',
    req: () => [['a pickup, van or truck in good shape', hasHauler()], [`${save.res.diesel}/60 diesel`, save.res.diesel >= 60], [`${save.res.food}/40 food and ${save.res.water}/40 water`, save.res.food >= 40 && save.res.water >= 40], [`${living().length}/6 survivors`, living().length >= 6]],
    text: ['left the plain.', 'You packed the trucks at dawn. The house, the greenhouses and the graves stayed behind. By noon the mountains were on the horizon and nobody looked back.'],
  },
  dominion: {
    title: 'THE BANAT COMPACT', blurb: 'Make every road in the county pay you a toll or a favour.',
    req: () => [[`${save.outposts.length}/4 outposts`, save.outposts.length >= 4], ['the Reapers destroyed or taken in', reapersGone()], [`${save.stats.trades}/15 trades`, save.stats.trades >= 15], [`${Object.keys(save.pacts).length}/2 alliances`, Object.keys(save.pacts).length >= 2]],
    text: ['holds the county together.', 'The gangs are gone, the militia owes you favours and every road passes one of your outposts. They call it the Banat Compact. They are not entirely joking.'],
  },
  endurance: {
    title: 'ONE HUNDRED DAYS', blurb: 'Simply outlast everything. It happens by itself at day 100.', auto: true,
    req: () => [[`day ${save.day}/100`, save.day >= 100]],
    text: ['is still standing.', 'A hundred days. The calendar on the kitchen wall has run out of pages, and you are still here.'],
  },
};
const endingOk = id => ENDINGS[id].req().every(r => r[1]);
function declareEnding(id) {
  save.won = true; save.endingId = id; logEvent(`Ending: ${ENDINGS[id].title}`);
  if (!save.scoreRec) { save.scoreRec = true; recordScore(ENDINGS[id].title); }
  persist(); go(endScene);
}

// ---------------------------------------------------------------- the objectives screen
const goalsScene = {
  fixed: true, view: 'goals',
  enter() { this.view = save.goal.ch >= 4 ? 'endings' : 'goals'; },
  draw() {
    goalsTick();
    panel('OBJECTIVES', 'Build the settlement, then choose how the story ends.');
    [['goals', 'THE ROAD'], ['endings', 'ENDINGS']].forEach(([k, l], i) => { button(l, 60 + i * 150, 92, 144, 24, () => { this.view = k; }); if (this.view === k) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.strokeRect(60 + i * 150, 92, 144, 24); ctx.lineWidth = 1; } });
    if (this.view === 'goals') {
      CHAPTERS.forEach((C, i) => {
        const y = 128 + i * 70, done = i < save.goal.ch, cur = i === save.goal.ch;
        ctx.fillStyle = '#07150d'; ctx.fillRect(60, y, 840, 62); ctx.strokeStyle = done ? '#3a9a5a' : cur ? AMBER : '#1c3a28'; ctx.lineWidth = cur ? 2 : 1; ctx.strokeRect(60.5, y + .5, 840, 62); ctx.lineWidth = 1;
        text(`${i + 1}. ${C.t}`, 78, y + 22, 14, done ? '#6c8' : cur ? AMBER : '#677');
        wrapText(C.d, 100).forEach((l, j) => text(l, 78, y + 38 + j * 13, 10, done || cur ? '#9fb' : '#566'));
        if (cur) text(C.prog(), 890, y + 22, 11, '#fff', 'right'); if (done) text('✓ done', 890, y + 22, 11, '#6c8', 'right');
      });
      text(`${seasonOf().name}: ${seasonOf().desc}`, 60, H - 62, 11, '#9fb');
    } else {
      Object.entries(ENDINGS).forEach(([id, E], i) => {
        const y = 128 + i * 74, rq = E.req(), ok = rq.every(r => r[1]);
        ctx.fillStyle = '#07150d'; ctx.fillRect(60, y, 840, 66); ctx.strokeStyle = ok ? '#3a9a5a' : DIM; ctx.strokeRect(60.5, y + .5, 840, 66);
        text(E.title, 76, y + 20, 14, ok ? '#6f8' : '#fff'); text(E.blurb, 76, y + 36, 10, '#9fb');
        let x = 76; rq.forEach(r => { const s = `${r[1] ? '✓' : '✗'} ${r[0]}`; text(s, x, y + 55, 10, r[1] ? '#6c8' : '#c88'); x += s.length * 6.2 + 16; });
        if (!E.auto) button('DECLARE', 790, y + 18, 100, 30, () => declareEnding(id), ok && !save.won);
      });
      text(save.won ? 'You have already chosen an ending. You can keep playing.' : 'Declaring ends the story but not the game: you can keep building afterwards.', 60, H - 62, 11, '#9fb');
    }
    text(`Your settlement: ${save.fname}`, 60, H - 24, 12, '#6f8');
    button('RENAME', 400, H - 40, 90, 24, () => { const n = (typeof prompt === 'function') ? prompt('Name your settlement', save.fname) : null; if (n && n.trim()) { save.fname = n.trim().slice(0, 28); persist(); } });
    back();
  },
};

// ---------------------------------------------------------------- the ending screen
const endScene = {
  fixed: true,
  draw(dt, time) {
    const E = ENDINGS[save.endingId] || ENDINGS.founded;
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = GREEN; ctx.shadowBlur = 20; text(E.title, W / 2, 120, 40, GREEN, 'center'); ctx.shadowBlur = 0;
    text(`${save.fname} ${E.text[0]}`, W / 2, 158, 15, '#9fb', 'center');
    wrapText(E.text[1], 90).forEach((l, i) => text(l, W / 2, 184 + i * 17, 13, '#cfe', 'center'));
    text(`${living().length} survivors · ${save.day} days · ${save.outposts.length} outposts · ${save.stats.trades} trades · ${save.stats.zk} infected killed · ${save.stats.deaths} lost`, W / 2, 246, 12, '#cfe', 'center');
    text(`SCORE ${Math.round(calcScore())}`, W / 2, 280, 22, '#fc4', 'center');
    save.outposts.slice(0, 5).forEach((o, i) => { const t = outTown(o); text(`⚑ ${t ? (t.short || t.name) : o.name} (level ${o.lvl})`, W / 2, 312 + i * 15, 11, '#6f8', 'center'); });
    living().slice(0, 14).forEach((c, i) => text(`${c.name} — ${ROLES[c.role].label.toLowerCase()} Lv${c.lvl}${c.partner ? ' ♥' : ''}`, W / 2, 400 + i * 12.5, 10, ROLES[c.role].color, 'center'));
    button('KEEP PLAYING', W / 2 - 280, H - 56, 170, 38, () => { save.wonSeen = true; persist(); go(baseScene); });
    button('HISTORY', W / 2 - 85, H - 56, 170, 38, () => { historyScene.prev = endScene; go(historyScene); });
    button('TITLE', W / 2 + 110, H - 56, 170, 38, () => { persist(); go(titleScene); });
  },
};
