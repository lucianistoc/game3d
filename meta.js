// Everything around the game rather than in it: title and save slots, menu, settings, history and memorial,
// new-game options, tutorial tips, and the log / death bookkeeping other files call.

// ---------------------------------------------------------------- bookkeeping
function logEvent(txt) { save.log.push({ day: save.day, text: txt }); if (save.log.length > 300) save.log.shift(); }
function crewDied(c, cause) {
  if (c.dead) return;
  c.hp = 0; c.dead = true; c.away = null;
  save.fallen.push({ name: c.name, role: c.role, lvl: c.lvl || 1, day: save.day, cause }); save.stats.deaths++; griefFor(c);
  logEvent(`${c.name} (${ROLES[c.role].label.toLowerCase()}) ${cause}`);
}
const fmtPlay = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${m}m` : `${m}m`; };

// ---------------------------------------------------------------- difficulty, zombie mixes, start scenarios
const DIFFS = {
  easy:   { name: 'EASY',   desc: 'Fewer infected, richer loot, lighter raids.',   zomb: .75, loot: 1.25, need: .8,  raid: .8,  dmg: .8 },
  normal: { name: 'NORMAL', desc: 'The intended challenge.',                       zomb: 1,   loot: 1,    need: 1,   raid: 1,   dmg: 1 },
  hard:   { name: 'HARD',   desc: 'More infected, thin loot, bigger raids.',        zomb: 1.3, loot: .8,   need: 1.15, raid: 1.3, dmg: 1.2 },
};
const ZMODES = {
  classic: { name: 'CLASSIC', desc: 'Mostly walkers with the odd brute, runner and spitter.', w: {} },
  fast:    { name: 'FAST',    desc: 'Runners everywhere. Keep moving, keep quiet.',          w: { runner: 2.6, walker: .75 } },
  heavy:   { name: 'HEAVY',   desc: 'Brutes and armoured infected. Bring real firepower.',    w: { brute: 2.4, armored: 3, walker: .8 } },
};
const SCENARIOS = {
  standard: { name: 'THE HOUSE IN CĂRANI', desc: 'The full crew of eight and a quiet first week.' },
  siege:    { name: 'UNDER SIEGE',         desc: 'Six survivors, extra scrap, and the dead arrive early and in numbers.' },
  network:  { name: 'THE WIDER WORLD',     desc: 'A radio room and a garrisoned Petrom outpost to start with, but thin supplies.' },
};
const SEASON_PICK = {
  autumn: { name: 'AUTUMN', desc: 'Start with the harvest. Winter is two months away.' },
  summer: { name: 'SUMMER', desc: 'Long sun and rich crops. Winter is three months off.' },
  spring: { name: 'SPRING', desc: 'Planting season. A gentle start, then summer.' },
  winter: { name: 'WINTER', desc: 'Start in the cold: thin sun, poor crops. Hard.' },
};
const DF = () => DIFFS[save.diff] || DIFFS.normal;
const startingSave = o => {
  const s = fresh(o);
  if (o.season0 === 3) { s.res.food += 14; s.res.water += 10; s.res.scrap += 20; s.energy = 30; }
  if (o.scen === 'siege') { s.crew = s.crew.slice(0, 6); s.res.scrap += 60; s.res.ammo += 30; s.day = 4; s.clock = 7; s.raidBoost = 1; }
  if (o.scen === 'network') {
    s.res.food = 7; s.res.water = 10; s.res.scrap = 50; s.rooms.radio = 1; s.res.diesel = 10;
    const t = TOWNS.find(t => t.kind === 'fuel'); if (t) { s.sites[t.name] = { depl: .3, last: 1, inf: 0 }; s.outposts.push({ name: t.name, lvl: 1 }); const sc = s.crew.find(c => c.role === 'scout'); if (sc) sc.away = { post: t.name, back: null }; }
  }
  return s;
};

// ---------------------------------------------------------------- title and save slots
const titleScene = {
  fixed: true, confirmDel: 0,
  enter() { setMood('calm'); this.confirmDel = 0; },
  draw(dt, time) {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0b2415';
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    ctx.shadowColor = GREEN; ctx.shadowBlur = 20; text('TIMIȘ Z', W / 2, 130, 72, GREEN, 'center'); ctx.shadowBlur = 0;
    text('The dead walk the Banat plain. Hold the house in Cărani.', W / 2, 168, 15, '#9fb', 'center');
    for (let i = 1; i <= 3; i++) {
      const y = 200 + (i - 1) * 100, s = readSlot(i), x = 150;
      ctx.fillStyle = '#07150d'; ctx.fillRect(x, y, 660, 88); ctx.strokeStyle = s ? '#3a9a5a' : DIM; ctx.strokeRect(x + .5, y + .5, 660, 88);
      text(`SLOT ${i}`, x + 16, y + 24, 12, '#5fa478');
      if (s) {
        text(s.fname || 'Cărani Settlement', x + 16, y + 48, 18, '#fff');
        text(`Day ${s.day} · ${(s.crew || []).filter(c => c.hp > 0).length} survivors · ${(s.outposts || []).length} outposts · ${DIFFS[s.diff] ? DIFFS[s.diff].name.toLowerCase() : 'normal'} · ${fmtPlay(s.playSec || 0)}${s.won ? ' · FOUNDED' : ''}`, x + 16, y + 70, 11, '#9fb');
        button('CONTINUE', x + 410, y + 14, 110, 28, () => { loadSlot(i); go(baseScene); });
        button(this.confirmDel === i ? 'SURE?' : 'DELETE', x + 530, y + 14, 110, 28, () => { if (this.confirmDel === i) { try { localStorage.removeItem(slotKey(i)); } catch {} this.confirmDel = 0; } else this.confirmDel = i; });
        text(s.created ? new Date(s.t || s.created).toLocaleDateString() : '', x + 640, y + 70, 10, '#5fa478', 'right');
      } else {
        text('empty', x + 16, y + 52, 14, '#566');
        button('NEW GAME', x + 530, y + 30, 110, 28, () => { newGameScene.slot = i; go(newGameScene); });
      }
    }
    button('SETTINGS', W / 2 - 175, 508, 160, 34, () => { settingsScene.prev = titleScene; go(settingsScene); }); fsButton(W / 2 + 15, 508, 160, 34);
    const hof = hallOfFame(); if (hof.length) text(`Best: ${hof[0].name} · ${hof[0].score} points (${hof[0].end})`, W / 2, 570, 12, '#fc4', 'center');
    text('M mutes · all progress saves automatically', W / 2, H - 20, 11, DIM, 'center');
  },
};

// ---------------------------------------------------------------- new game
const newGameScene = {
  fixed: true, slot: 1, o: { diff: 'normal', scen: 'standard', zmode: 'classic', season: 'autumn' },
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    text('NEW GAME', W / 2, 60, 28, AMBER, 'center'); text(`slot ${this.slot}`, W / 2, 82, 11, '#5fa478', 'center');
    const group = (title, y, table, key) => {
      text(title, 60, y, 12, '#5fa478'); const ks = Object.keys(table), w = Math.floor(840 / ks.length);
      ks.forEach((k, i) => {
        const x = 60 + i * w, on = this.o[key] === k; ctx.fillStyle = on ? '#0c3a1c' : '#07150d'; ctx.fillRect(x, y + 10, w - 8, 78); ctx.strokeStyle = on ? AMBER : DIM; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(x + .5, y + 10.5, w - 8, 78); ctx.lineWidth = 1;
        text(table[k].name, x + 12, y + 32, 13, on ? AMBER : '#fff'); wrapText(table[k].desc, Math.floor((w - 28) / 6.6)).forEach((l, j) => text(l, x + 12, y + 50 + j * 13, 10, '#9fb'));
        btns.push({ x, y: y + 10, w: w - 8, h: 78, cb: () => { this.o[key] = k; sfx('click'); } });
      });
    };
    group('START', 96, SCENARIOS, 'scen'); group('DIFFICULTY', 200, DIFFS, 'diff'); group('THE INFECTED', 304, ZMODES, 'zmode'); group('SEASON AT THE START', 408, SEASON_PICK, 'season');
    button('◂ BACK', 60, H - 70, 160, 40, () => go(titleScene));
    button('BEGIN', W - 220, H - 70, 160, 40, () => startNewGame(this.slot, this.o));
  },
};
function startNewGame(slot, o) {
  if (o.season) o = { ...o, season0: ['spring', 'summer', 'autumn', 'winter'].indexOf(o.season) };
  curSlot = slot; save = startingSave(o); cellsDirty = true; save.t = Date.now(); planRaid(); persist(); go(baseScene);
}

// ---------------------------------------------------------------- in-game menu
const menuScene = {
  fixed: true, prev: null,
  draw() {
    if (this.prev && this.prev.draw && this.prev !== menuScene) { const p = this.prev; ctx.save(); try { p.draw(0, 0); } catch {} ctx.restore(); btns = []; }
    ctx.fillStyle = 'rgba(3,8,6,.85)'; ctx.fillRect(0, 0, W, H);
    text('MENU', W / 2, 150, 30, AMBER, 'center'); text(`${save.fname} · day ${save.day} · ${fmtPlay(save.playSec)}`, W / 2, 176, 12, '#9fb', 'center');
    const b = (l, y, cb) => button(l, W / 2 - 120, y, 240, 42, cb);
    b('RESUME', 210, () => go(this.prev || baseScene));
    b('SETTINGS', 262, () => { settingsScene.prev = menuScene; go(settingsScene); });
    b('HISTORY AND MEMORIAL', 314, () => { historyScene.prev = menuScene; go(historyScene); });
    b('SAVE AND QUIT TO TITLE', 366, () => { persist(); go(titleScene); }); fsButton(W / 2 - 120, 418, 240, 42);
    if (keys.Escape) { keys.Escape = false; go(this.prev || baseScene); }
  },
};
const openMenu = () => { if (scene !== menuScene) { menuScene.prev = scene; go(menuScene); } };
addEventListener('keydown', e => { if (e.code === 'Escape' && !e.repeat && scene && (scene === baseScene || scene === mapScene) && !(scene.raid) && !scene.confirmEnd) openMenu(); });

// ---------------------------------------------------------------- settings
const settingsScene = {
  fixed: true, prev: null, capture: null,
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H);
    text('SETTINGS', W / 2, 56, 26, AMBER, 'center');
    const slider = (label, y, key) => {
      text(label, 60, y + 5, 13, '#cfe'); const x = 200, w = 240;
      ctx.fillStyle = '#10261a'; ctx.fillRect(x, y - 6, w, 12); ctx.fillStyle = GREEN; ctx.fillRect(x, y - 6, w * SET[key], 12); ctx.strokeStyle = DIM; ctx.strokeRect(x + .5, y - 5.5, w, 12);
      text(`${Math.round(SET[key] * 100)}%`, x + w + 12, y + 5, 12, '#9fb');
      if (mouse.down && mouse.btn === 0 && mouse.x >= x - 6 && mouse.x <= x + w + 6 && mouse.y >= y - 12 && mouse.y <= y + 12) { SET[key] = clamp((mouse.x - x) / w, 0, 1); applyVolumes(); saveSettings(); }
    };
    slider('Master volume', 110, 'master'); slider('Effects', 146, 'sfx'); slider('Music', 182, 'music');
    text('Interface size', 60, 226, 13, '#cfe'); button('−', 200, 208, 40, 28, () => { SET.uiScale = clamp(Math.round((SET.uiScale - .1) * 10) / 10, .8, 1.4); saveSettings(); });
    text(`${Math.round(SET.uiScale * 100)}%`, 262, 227, 13, '#fff'); button('+', 300, 208, 40, 28, () => { SET.uiScale = clamp(Math.round((SET.uiScale + .1) * 10) / 10, .8, 1.4); saveSettings(); });
    text('(base and map; the arena and menus keep their size)', 360, 227, 10, '#5fa478');
    text('Screen shake', 60, 266, 13, '#cfe'); button(SET.shake ? 'ON' : 'OFF', 200, 248, 70, 28, () => { SET.shake = SET.shake ? 0 : 1; saveSettings(); });
    text('Tutorial tips', 300, 266, 13, '#cfe'); button(SET.tips ? 'ON' : 'OFF', 420, 248, 70, 28, () => { SET.tips = !SET.tips; saveSettings(); });
    text('FPS', 800, 266, 13, '#cfe'); button(SET.fps ? 'ON' : 'OFF', 835, 248, 70, 28, () => { SET.fps = !SET.fps; saveSettings(); });
    if (R3D.can) { text('Graphics', 520, 266, 13, '#cfe'); button(R3D.label(), 590, 248, 190, 28, () => R3D.cyclePref()); text('AUTO lowers itself if the game stutters', 590, 292, 10, '#5fa478'); }
    text('KEY BINDINGS (click one, then press a key; Esc cancels)', 60, 312, 12, '#5fa478');
    Object.keys(KB_DEFAULT).forEach((a, i) => {
      const col = i < 5 ? 0 : 1, row = i % 5, x = 60 + col * 440, y = 324 + row * 40, cap = this.capture === a;
      text(KB_LABEL[a], x, y + 20, 13, '#cfe'); button(cap ? 'press a key…' : keyName(SET.kb[a]), x + 190, y, 160, 30, () => { this.capture = a; });
    });
    button('RESET KEYS', 60, 540, 150, 34, () => { SET.kb = { ...KB_DEFAULT }; saveSettings(); }); fsButton(230, 540, 190, 34);
    text('Touch: the mission arena shows a stick and buttons on touch screens.', 240, 562, 10, '#5fa478');
    button('◂ BACK', W - 200, H - 70, 160, 40, () => go(this.prev || titleScene));
  },
};
addEventListener('keydown', e => {
  const s = settingsScene; if (scene !== s || !s.capture) return;
  e.preventDefault(); if (e.code !== 'Escape') { SET.kb[s.capture] = e.code; saveSettings(); } s.capture = null; keys[e.code] = false;
}, true);

// ---------------------------------------------------------------- history, statistics, memorial
const historyScene = {
  fixed: true, prev: null,
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H); drawHUD(true);
    text('HISTORY', W / 2, 66, 22, AMBER, 'center');
    const S = save.stats, rows = [['Days survived', save.day], ['Time played', fmtPlay(save.playSec)], ['Nights held', S.nights], ['Nights lost', S.lostNights], ['Scavenging trips', S.trips], ['Infected killed', S.zk], ['Survivors killed', S.kills], ['Trades made', S.trades], ['Expeditions sent', S.expeds], ['Outposts held', save.outposts.length], ['Crew lost', S.deaths]];
    ctx.fillStyle = '#07150d'; ctx.fillRect(30, 90, 250, 480); ctx.strokeStyle = DIM; ctx.strokeRect(30.5, 90.5, 250, 480);
    text('STATISTICS', 44, 112, 12, '#5fa478'); rows.forEach(([k, v], i) => { text(k, 44, 140 + i * 24, 12, '#9fb'); text(String(v), 264, 140 + i * 24, 12, '#fff', 'right'); });
    ctx.fillStyle = '#07150d'; ctx.fillRect(296, 90, 380, 480); ctx.strokeStyle = DIM; ctx.strokeRect(296.5, 90.5, 380, 480);
    text('TIMELINE', 310, 112, 12, '#5fa478');
    save.log.slice(-26).reverse().forEach((l, i) => text(`day ${l.day}: ${l.text.slice(0, 48)}`, 310, 136 + i * 16.5, 11, i ? '#8aa' : '#cfe'));
    if (!save.log.length) text('Nothing worth recording yet.', 310, 140, 12, '#566');
    ctx.fillStyle = '#07150d'; ctx.fillRect(692, 90, 240, 480); ctx.strokeStyle = '#522'; ctx.strokeRect(692.5, 90.5, 240, 480);
    text('MEMORIAL', 706, 112, 12, '#c88');
    save.fallen.slice(-17).reverse().forEach((f, i) => { text(`✝ ${f.name}`, 706, 138 + i * 26, 12, '#e8c8c8'); text(`${ROLES[f.role].label.toLowerCase()} Lv${f.lvl} · day ${f.day}`, 706, 150 + i * 26, 9, '#a88'); });
    if (!save.fallen.length) text('Nobody lost. Yet.', 706, 140, 12, '#566');
    button('◂ BACK', W - 190, H - 52, 170, 36, () => go(this.prev || baseScene));
  },
};

// ---------------------------------------------------------------- score and hall of fame
const hallOfFame = () => { try { return JSON.parse(localStorage.getItem('timisz_hof')) || []; } catch { return []; } };
function calcScore() { return Math.round(save.day * 5 + living().length * 30 + save.outposts.reduce((s, o) => s + 25 + 15 * o.lvl, 0) + save.stats.trades * 2 + save.stats.zk / 5 + Object.values(save.rooms).reduce((a, b) => a + b, 0) * 12 + (save.won ? 200 : 0) - save.stats.deaths * 10) * ({ easy: .8, normal: 1, hard: 1.4 }[save.diff] || 1); }
function recordScore(endName) {
  const h = hallOfFame(); h.push({ name: save.fname, score: Math.round(calcScore()), day: save.day, end: endName, diff: save.diff });
  h.sort((a, b) => b.score - a.score); try { localStorage.setItem('timisz_hof', JSON.stringify(h.slice(0, 5))); } catch {}
}

// ---------------------------------------------------------------- tutorial tips
const TIPS = [
  { id: 'welcome',  sc: 'base', when: () => save.day <= 2 && !save.stats.trips, text: 'Welcome. Supplies first: open the MAP, pick a nearby settlement (Cărani\'s neighbours are gentle) and scavenge it. MENU or Esc opens the menu.' },
  { id: 'map',      sc: 'map',  when: () => !save.stats.trips, text: 'Click a settlement for its briefing. DRIVE burns diesel but is fast; WALK is free but slow. Dying loses everything you carried.' },
  { id: 'build',    sc: 'base', when: () => save.stats.trips >= 1 && save.day <= 4 && !save.buildings.some(b => b.t === 'turret'), text: 'Spend scrap on defences from the left panel. Drag to paint fences and walls; turrets and floodlights help at night.' },
  { id: 'gear',     sc: 'base', when: () => save.gear.stash.length > 1, text: 'You have spare gear. GEAR wears it (packs carry more, jackets block damage) and CRAFT makes ammo and bandages.' },
  { id: 'night',    sc: 'base', when: () => save.clock >= 17 && save.day <= 4, text: 'Dusk is near. END DAY starts the night watch: click zombies to help your fighters and turrets.' },
  { id: 'trap',     sc: 'base', when: () => save.day >= 3 && !save.buildings.some(b => ['wire', 'pit', 'mine'].includes(b.t)), text: 'Try the TRAP tab: barbed wire slows and cuts attackers, pits and mines punish brutes. Lay them outside your fence on the side the raid comes from.' },
  { id: 'plan',     sc: 'base', when: () => save.day >= 2 && save.clock >= 12, text: 'Before dark you get a NIGHT PLAN: put fighters on turrets and windows, an engineer on repairs, a medic on casualties. A forecast says what is coming.' },
  { id: 'power',    sc: 'base', when: () => save.energy < 6, text: 'The battery is low. Floodlights and electric fences need power: keep the panels clean of blackouts or run the generator.' },
  { id: 'food',     sc: 'base', when: () => save.res.food <= 4 && save.day > 1, text: 'Food is short. Gardens and greenhouses feed the crew; scavenge farms and shops before people go hungry.' },
  { id: 'radio',    sc: 'base', when: () => save.day >= 4 && !roomLvl('radio'), text: 'Build a RADIO room under ROOMS to trade, hear about events and meet other survivor groups.' },
  { id: 'outpost',  sc: 'base', when: () => save.stats.trips >= 3 && !save.outposts.length, text: 'Loot a site once, then claim it as an OUTPOST from its briefing. Post crew there and it produces supplies and intel.' },
  { id: 'morale',   sc: 'base', when: () => moraleAvg() < 40, text: 'Morale is low. Kitchens, bunks and good nights lift it. People who hit rock bottom walk out.' },
];
let tipBox = null;
function drawTip(sc) {
  if (!SET.tips) return; const t = TIPS.find(t => t.sc === sc && !save.tips[t.id] && t.when()); if (!t) return;
  const w = Math.min(620, W - 440), x = W / 2 - w / 2, y = H - 118, lines = wrapText(t.text, Math.floor(w / 7));
  ctx.fillStyle = 'rgba(7,26,40,.92)'; ctx.fillRect(x, y, w, 24 + lines.length * 15); ctx.strokeStyle = '#6cf'; ctx.strokeRect(x + .5, y + .5, w, 24 + lines.length * 15);
  text('TIP', x + 8, y + 15, 10, '#6cf'); lines.forEach((l, i) => text(l, x + 36, y + 15 + i * 15, 11, '#dff')); text('click to dismiss', x + w - 8, y + 18 + (lines.length - 1) * 15 + 4, 9, '#789', 'right');
  btns.push({ x, y, w, h: 24 + lines.length * 15, cb: () => { save.tips[t.id] = 1; persist(); } });
}
