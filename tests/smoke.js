// Smoke test: loads the real game in headless Chromium and drives every part of it, failing on any page error.
//   npm install playwright && npx playwright install chromium   (once)
//   node tests/smoke.js            (set CHROMIUM=/path/to/chromium to use a specific browser)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // headless Chromium needs a software GL backend for the 3D view. Set FLAT=1 to test the 2D fallback (?2d) instead.
  const opts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) };
  const flat = !!process.env.FLAT;
  const b = await chromium.launch(opts);
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; let checks = 0;
  p.on('pageerror', e => errors.push('page error: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + (flat ? '?2d' : '')); await p.waitForTimeout(400);
  if ((await p.evaluate(() => R3D.ok)) === flat) errors.push(`R3D.ok should be ${!flat}`);
  const run = async (name, fn, arg) => {
    const before = errors.length; checks++;
    try { const r = await p.evaluate(fn, arg); if (r === false) errors.push(`${name}: returned false`); }
    catch (e) { errors.push(`${name}: ${e.message.split('\n')[0]}`); }
    await p.waitForTimeout(40);
    if (errors.length > before) console.log('FAIL', name, errors.slice(before).join(' | ')); else console.log('ok  ', name);
  };

  // ---- every scene draws
  await run('title + new game screen', () => { go(titleScene); go(newGameScene); });
  for (const scen of ['standard', 'siege', 'network']) for (const [diff, zmode, season] of [['easy', 'classic', 'summer'], ['hard', 'fast', 'winter']])
    await run(`new game ${scen}/${diff}/${zmode}/${season}`, o => { startNewGame(1, o); for (const s of [baseScene, mapScene, crewScene, roomsScene, outpostsScene, goalsScene, historyScene, craftScene, gearScene, fleetScene, planScene]) { go(s); } go(baseScene); }, { scen, diff, zmode, season });
  await run('settings + menu', () => { settingsScene.prev = baseScene; go(settingsScene); openMenu(); });
  await run('radio tabs', () => { save.rooms.radio = 2; genTrades(); for (let i = 0; i < 3; i++) { const q = makeQuest(); if (q) save.quests.push(q); } for (const t of ['offers', 'quests', 'diplo']) { tradeScene.tab = t; go(tradeScene); } });

  // ---- every site type: a short mission, then extraction
  const kinds = await p.evaluate(() => Object.keys(SPOT_KINDS));
  for (const k of [...kinds, 'village', 'town']) await run(`mission: ${k}`, kind => {
    startNewGame(1, {}); save.day = 8; save.clock = 9; save.stats.trips = 5; save.res.ammo = 80; save.reapers.state = 'war';
    const t = kind === 'village' ? TOWNS.find(t => t.type === 'village') : kind === 'town' ? TOWNS.find(t => t.type === 'town') : TOWNS.find(t => t.kind === kind);
    const m = missionScene(t, 'drive'); go(m); mouse.down = false;
    for (let i = 0; i < 600; i++) m.update(1 / 60);
    m.draw(0.016, 1); m.finish(true);
  }, k);
  for (const type of ['rescue', 'clear', 'boss', 'vault', 'sneak', 'camp']) await run(`objective: ${type}`, ty => {
    startNewGame(1, {}); save.day = 8; save.clock = 9; save.stats.trips = 5; objFor = () => ty;
    const t = TOWNS.find(t => t.kind === (ty === 'camp' ? 'camp' : 'store')); const m = missionScene(t, 'drive'); go(m);
    if (m.npc) { m.p.x = m.npc.x; m.p.y = m.npc.y + 30; keys[SET.kb.use] = true; }
    for (let i = 0; i < 400; i++) m.update(1 / 60); keys[SET.kb.use] = false; m.draw(0.016, 1); m.finish(true);
  }, type);
  await run('hazards', () => { startNewGame(1, {}); const m = missionScene(TOWNS.find(t => t.kind === 'warehouse'), 'walk'); go(m); m.cracks = [{ x: m.p.x + 10, y: m.p.y, r: 30, t: 0, st: 'idle' }]; m.fireHaz = true; m.hazT = .1; for (let i = 0; i < 300; i++) m.update(1 / 60); m.draw(0.016, 1); });

  // ---- road events
  await run('road events', () => { startNewGame(1, {}); save.res.scrap = 50; save.res.ammo = 50; for (const E of Object.values(ROAD_EVENTS)) for (const c of E.choices) if (!c.ok || c.ok()) c.act(); roadScene.ev = ROAD_EVENTS.roadblock; roadScene.town = TOWNS.find(t => t.type === 'village'); roadScene.res = null; go(roadScene); });

  // ---- the night watch, every raid type, with traps and posts
  for (const type of ['horde', 'rush', 'siege', 'spitters', 'armored', 'mixed']) await run(`raid: ${type}`, T => {
    startNewGame(1, {}); save.day = 14; save.res.ammo = 200;
    for (const [x, y] of [[3, 25], [9, 25]]) save.buildings.push({ t: 'turret', gx: x, gy: y, w: 1, h: 1, hp: 35 });
    save.buildings.push({ t: 'wire', gx: 5, gy: 26, w: 1, h: 1, hp: 12 }, { t: 'pit', gx: 6, gy: 26, w: 1, h: 1, hp: 5 }, { t: 'mine', gx: 7, gy: 26, w: 1, h: 1, hp: 5 }); cellsDirty = true;
    save.pacts = { militia: 'ally' }; save.forecast = { type: T, n: 18, edge: 1, rn: 2 }; autoPosts(); baseScene.startRaid(); go(baseScene);
    const r = baseScene.raid; let n = 0; while (!r.result && n < 4000) { baseScene.update(.05); n++; if (n % 40 === 0) baseScene.draw(.05, n); }
  }, type);

  // ---- a long game: nights, events, diplomacy, stories
  await run('60 nights', () => {
    startNewGame(1, { diff: 'normal' }); save.rooms = { radio: 2, clinic: 1, bunks: 1 };
    const f = TOWNS.find(t => t.kind === 'fuel'); save.sites[f.name] = { depl: 0, last: 1, inf: 0 }; save.res.scrap = 999; establish(f); save.crew[5].away = { post: f.name, back: null };
    for (let d = 0; d < 60; d++) {
      for (const k of Object.keys(save.res)) save.res[k] = Math.max(save.res[k], 40);
      if (save.crew.filter(c => c.hp > 0).length < 5) recruit();
      baseScene.endNight(Math.random() < .85, []);
      if (save.event) { const E = EVENTS[save.event.id], c = E.choices.find(c => !c.ok || c.ok(save.event)) || E.choices[0]; c.act(save.event); save.event = null; }
      for (const c of save.crew) if (c.hp > 0 && perkPending(c)) c.perks.push(PERKS[c.role][perkPending(c)][0][0]);
      if (d % 10 === 5) { genTrades(); for (const t of save.trades) if (costOk(t.give) && !t.recruit) { payCost(t.give); giveRes(t.get || {}); t.used = true; save.stats.trades++; } }
      for (const q of save.quests.slice()) if (questReady(q)) claimQuest(q);
    }
    if (save.day < 60) return false;
  });
  await run('quests, pacts, research, Reapers', () => { startNewGame(1, {}); save.rooms.radio = 1; save.rp = 5; save.fac.militia.rep = 80; save.res.scrap = 300; save.res.ammo = 80; save.pacts.militia = 'ally'; diploNight([]); for (const id of Object.keys(RESEARCH)) save.research[id] = true; save.reapers = { state: 'truce', until: save.day + 10 }; planRaid(); save.reapers = { state: 'war', until: 0 }; planRaid(); save.reapers = { state: 'destroyed', until: 0 }; planRaid(); });

  // ---- saves
  await run('save slots round trip', () => { startNewGame(2, { diff: 'hard', scen: 'siege' }); save.day = 17; persist(); loadSlot(2); if (save.day !== 17 || save.diff !== 'hard') return false; go(titleScene); try { localStorage.removeItem(slotKey(2)); } catch {} });
  await run('old save upgrade', () => { const s = fresh(); delete s.rooms; delete s.fac.scientists; delete s.outposts; s.ver = 11; s.crew.forEach(c => { delete c.perks; delete c.rel; delete c.xp; }); const u = upgradeSave(s); if (!u.rooms || !u.fac.army || !u.crew[0].perks) return false; });

  // ---- endings
  for (const id of ['founded', 'enlisted', 'north', 'dominion', 'endurance']) await run(`ending: ${id}`, e => { startNewGame(1, {}); save.endingId = e; save.won = true; go(endScene); endScene.draw(0, 0); go(goalsScene); goalsScene.view = 'endings'; goalsScene.draw(); }, id);

  // ---- touch input and pointer clicks through the real UI
  await run('touch mission', () => { startNewGame(1, {}); TOUCH.on = true; const m = missionScene(TOWNS.find(t => t.kind === 'store'), 'drive'); go(m); touchPts.set(1, { x: 150, y: 450, sx: 100, sy: 450 }); touchPts.set(2, { x: 600, y: 200, sx: 600, sy: 200 }); for (let i = 0; i < 60; i++) m.update(1 / 60); m.draw(0.016, 1); touchPts.clear(); TOUCH.on = false; });

  // ---- the drivable stretch on the way to a site: every road event, run to the end, hands over to the mission
  for (const ev of ['plain', 'roadblock', 'toll', 'ambush', 'cache']) await run(`drive: ${ev}`, e => {
    startNewGame(1, {}); save.day = 8; save.clock = 9; save.stats.trips = 5; save.res.scrap = 50; const t = TOWNS.find(t => t.type === 'town');
    if (!R3D.ok) { startDrive(t); return true; }   // flat game: the old text events
    go(driveScene.make(t, e === 'plain' ? null : e)); const first = scene; let draws = 0;
    for (let i = 0; i < 60 * 80 && scene === first; i++) {
      keys.KeyD = Math.floor(i / 50) % 4 === 0; keys.KeyA = Math.floor(i / 50) % 4 === 2;
      if (driveScene._d().state === 'toll') { if (draws < 8) { scene.draw(.016, i / 60); draws++; } driveScene.toll(e === 'toll' ? 'pay' : 'run'); }
      scene.update(1 / 60); if (i % 400 === 0 && draws < 8) { scene.draw(.016, i / 60); draws++; }
    }
    keys.KeyD = keys.KeyA = false; return scene !== first && !!scene.p;
  }, ev);
  await run('graphics levels', () => { startNewGame(1, {}); const m = missionScene(TOWNS.find(t => t.kind === 'store'), 'drive'); go(m); for (const q of ['high', 'medium', 'low', '2d', 'auto']) { R3D.setPref(q); m.update(1 / 60); m.draw(.016, 1); baseScene.fit(); } go(baseScene); for (const q of ['low', 'high', 'auto']) { R3D.setPref(q); baseScene.draw(.016, 1); } R3D.label(); });
  await run('touch base', () => { startNewGame(1, {}); TOUCH.on = true; go(baseScene); baseScene.draw(.016, 1); touchPts.set(1, { x: 300, y: 300, sx: 300, sy: 300 }); touchPts.set(2, { x: 500, y: 300, sx: 500, sy: 300 }); baseScene.update(.05); touchPts.get(1).x = 280; touchPts.get(2).x = 540; baseScene.update(.05); touchPts.clear(); baseScene.up(); TOUCH.on = false; });

  console.log(`\n${checks} checks, ${errors.length} problem(s)`);
  await b.close();
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
})();
