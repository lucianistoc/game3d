// Balance simulator (development only). Drives the real game in headless Chromium:
//   node tools/sim.js missions   - a crude bot scavenges sites at different days; prints loot and survival
//   node tools/sim.js raids      - the night watch with different defences; prints survival and losses
//   node tools/sim.js economy    - days of upkeep with typical income; prints stock levels
// Needs Playwright (see README). The bot is far weaker than a person, so read results as a lower bound.
const { chromium } = require('playwright');
const mode = process.argv[2] || 'missions';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(300);
  const diff = process.env.DIFF || 'normal';

  if (mode === 'missions') {
    const kinds = ['village', 'store', 'pharmacy', 'warehouse', 'hospital', 'army', 'fuel'], days = [1, 6, 12, 20], N = +(process.env.N || 6);
    console.log(`difficulty ${diff}; bot, ${N} runs each: loot units / survived / seconds used`);
    for (const k of kinds) {
      const row = [];
      for (const day of days) {
        let loot = 0, ok = 0, secs = 0;
        for (let i = 0; i < N; i++) {
          const r = await p.evaluate(({ k, day, diff }) => {
            startNewGame(1, { diff, scen: 'standard', zmode: 'classic' }); save.day = day; save.clock = 8; save.res.ammo = 60;
            const t = k === 'village' ? TOWNS.find(t => t.type === 'village' && kmBetween(t, HOME) < 15) : TOWNS.find(t => t.kind === k);
            const m = missionScene(t, 'drive'); scene = m; let steps = 0;
            const mv = (dx, dy) => { for (const a of ['up', 'down', 'left', 'right']) keys[SET.kb[a]] = false; if (dy < -4) keys[SET.kb.up] = true; if (dy > 4) keys[SET.kb.down] = true; if (dx < -4) keys[SET.kb.left] = true; if (dx > 4) keys[SET.kb.right] = true; };
            let stuck = 0, lx = 0, ly = 0;
            while (!m.done && steps < 60 * 90) {
              steps++;
              const c = m.crates.filter(c => !c.got).sort((a, b) => Math.hypot(a.x - m.p.x, a.y - m.p.y) - Math.hypot(b.x - m.p.x, b.y - m.p.y))[0];
              const zs = m.zombies.filter(z => !z.dead && Math.hypot(z.x - m.p.x, z.y - m.p.y) < 300 && m.los(m.p.x, m.p.y, z.x, z.y)).sort((a, b) => Math.hypot(a.x - m.p.x, a.y - m.p.y) - Math.hypot(b.x - m.p.x, b.y - m.p.y));
              const hs = m.humans.filter(h => h.alert && h.hp > 0);
              const tgt = zs[0] || hs[0];
              if (tgt) { mouse.x = tgt.x; mouse.y = tgt.y; mouse.down = true; mouse.btn = 0; } else mouse.down = false;
              if (c) mv(c.x - m.p.x, c.y - m.p.y); else mv(0, 0);
              if (Math.hypot(m.p.x - lx, m.p.y - ly) < .4) stuck++; else stuck = 0; lx = m.p.x; ly = m.p.y;
              if (stuck > 30) { mv(Math.random() * 40 - 20, Math.random() * 40 - 20); if (stuck > 60) stuck = 0; }
              if (m.time < 3 || Object.values(m.carried).reduce((s, v) => s + v, 0) >= m.cap) keys[SET.kb.leave] = true;
              m.update(1 / 60);
            }
            mouse.down = false; for (const a in SET.kb) keys[SET.kb[a]] = false;
            return { loot: Object.values(m.carried).reduce((s, v) => s + v, 0), ok: m.done === 'win', secs: steps / 60 };
          }, { k, day, diff });
          loot += r.ok ? r.loot : 0; ok += r.ok ? 1 : 0; secs += r.secs;
        }
        row.push(`d${day}: ${(loot / N).toFixed(0)}u ${Math.round(ok / N * 100)}% ${(secs / N).toFixed(0)}s`);
      }
      console.log(k.padEnd(10), row.join('   '));
    }
  }

  if (mode === 'raids') {
    const setups = { 'bare': { turrets: 0, fighters: 2 }, '2 turrets': { turrets: 2, fighters: 2 }, '4 turrets': { turrets: 4, fighters: 3 } }, days = [1, 4, 8, 14, 20, 30], N = +(process.env.N || 4);
    console.log(`difficulty ${diff}; night watch results: won% / house hp left / crew lost / ammo used`);
    for (const [name, S] of Object.entries(setups)) {
      const row = [];
      for (const day of days) {
        let won = 0, hp = 0, lost = 0, ammo = 0;
        for (let i = 0; i < N; i++) {
          const r = await p.evaluate(({ S, day, diff, T }) => {
            startNewGame(1, { diff, scen: 'standard', zmode: 'classic' }); save.day = day; save.res.ammo = 140; save.res.food = 99; save.res.water = 99;
            save.fac.reapers.rep = -10;
            for (let t = 0; t < S.turrets; t++) { for (const c of [[3, 25], [9, 25], [3, 22], [9, 22]]) { if (!cellAt(c[0], c[1])) { save.buildings.push({ t: 'turret', gx: c[0], gy: c[1], w: 1, h: 1, hp: 35 }); cellsDirty = true; break; } } }
            if (T) save.forecast = { type: T, n: Math.round((3 + day * 2) * DF().raid * RAID_TYPES[T].mul), edge: 1, rn: 0 }; const a0 = save.res.ammo; baseScene.startRaid(); const r = baseScene.raid; let n = 0;
            while (!r.result && n < 20000) { baseScene.update(.05); n++; }
            return { won: r.result === 'won', hp: save.houseHp, lost: (r.lost || []).length, ammo: a0 - save.res.ammo };
          }, { S, day, diff, T: process.env.RAID || null });
          won += r.won ? 1 : 0; hp += r.hp; lost += r.lost; ammo += r.ammo;
        }
        row.push(`d${day}: ${Math.round(won / N * 100)}% hp${Math.round(hp / N)} -${(lost / N).toFixed(1)}c ${Math.round(ammo / N)}a`);
      }
      console.log(name.padEnd(10), row.join('  '));
    }
  }

  if (mode === 'economy') {
    const out = await p.evaluate(({ diff }) => {
      startNewGame(1, { diff, scen: 'standard', zmode: 'classic' }); const log = [];
      // a typical day: one scavenging run worth ~22 units (food/water/scrap/ammo mix), then the night
      for (let d = 1; d <= 20; d++) {
        const mix = { food: 3, water: 5, scrap: 5, ammo: 3, diesel: 1, meds: 1 }; for (const k in mix) save.res[k] += Math.round(mix[k] * DF().loot);
        save.res.diesel = Math.max(0, save.res.diesel - 1);
        baseScene.endNight(true, []);
        log.push(`day ${save.day}: food ${save.res.food} water ${save.res.water} scrap ${save.res.scrap} ammo ${Math.floor(save.res.ammo)} meds ${save.res.meds} diesel ${save.res.diesel} energy ${save.energy.toFixed(0)} crew ${living().length}`);
      }
      return log;
    }, { diff });
    console.log(out.join('\n'));
  }
  await b.close();
})();
