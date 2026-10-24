// The night watch: raid planning and forecast, the night-plan screen (who stands where), different kinds of
// attacker, traps, and the raid simulation itself. It extends baseScene (base.js).

const RAID_TYPES = {
  horde:    { name: 'Shambling horde',  desc: 'Mostly walkers. The usual.',                                   mix: { walker: 1 }, mul: 1 },
  rush:     { name: 'Runner rush',      desc: 'Fast and fragile. They arrive before you can reload.',         mix: { runner: .8, walker: .2 }, mul: 1.5 },
  siege:    { name: 'Siege',            desc: 'Brutes that batter the walls. Keep the barriers repaired.',    mix: { brute: .4, walker: .6 }, mul: .8 },
  spitters: { name: 'Spitters',         desc: 'They stay back and melt your defences from range.',            mix: { spitter: .35, walker: .65 }, mul: .8 },
  armored:  { name: 'Armoured column',  desc: 'Plated infected. Pistols and turrets barely scratch them.',    mix: { armored: .45, walker: .55 }, mul: .75 },
  mixed:    { name: 'Everything at once', desc: 'A bit of every kind.',                                       mix: { walker: .4, runner: .2, brute: .15, spitter: .15, armored: .1 }, mul: 1.1 },
};
const RZ = {   // raid attackers
  walker:  { hp: 2, v: [1.1, 1.9], label: 'walker' },
  runner:  { hp: 1, v: [2.4, 3.1], label: 'runner' },
  brute:   { hp: 6, v: [.8, 1.0], big: true, wall: 1.6, label: 'brute' },
  spitter: { hp: 2, v: [1.0, 1.3], range: 7, label: 'spitter' },
  armored: { hp: 4, v: [.9, 1.3], armor: .7, label: 'armoured' },
};
const SIDES = ['the north', 'the street', 'the west', 'the east'];
const TRAP_KINDS = new Set(['wire', 'pit', 'mine']);
const POSTS = {
  rest:    'Rests and recovers',
  windows: 'Shoots from the windows',
  turret:  'Mans a turret: fires faster',
  repair:  'Repairs barriers (uses scrap)',
  medic:   'Fewer casualties among the crew',
};

function planRaid() {
  const d = save.day, w = { horde: 4, rush: d >= 4 ? 2.5 : 0, spitters: d >= 7 ? 2 : 0, siege: d >= 10 ? 2 : 0, armored: d >= 13 ? 2 : 0, mixed: d >= 18 ? 3 : 0 };
  let x = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), type = 'horde';
  for (const [k, v] of Object.entries(w)) if ((x -= v) <= 0) { type = k; break; }
  const T = RAID_TYPES[type], rr = save.fac.reapers.rep, boost = save.raidBoost;
  const n = Math.max(3, Math.round((3 + d * 2 + (boost ? 4 : 0)) * DF().raid * T.mul * (1 + Math.max(0, d - 15) * .04)));
  const rs = save.reapers.state, p = boost ? 1 : (reapersGone() || reapersTruce()) ? .03 : rs === 'war' ? clamp(.35 + .03 * d, .4, .9) : clamp(.15 + .03 * d + (-rr - 10) / 250, .04, .7);
  const rn = Math.min(8, Math.random() < p ? 2 + Math.floor(Math.random() * 3) + Math.floor(d / 6) : 0);
  // outposts that will be hit tonight (known now, so you can send help)
  const hit = [];
  for (const o of save.outposts) {
    const t = outTown(o); if (!t) continue; const g = garrison(o), inf = siteInfo(t).inf, hostile = save.fac.reapers.rep < -30 ? .08 : 0;
    if (Math.random() < clamp((g.length ? .1 : .25) + inf * .25 + hostile - .05 * (o.lvl - 1) - (o.spec === 'tower' ? .04 : 0), .04, .45)) hit.push(o.name);
  }
  save.outAttack = hit; save.forecast = { type, n, edge: Math.random() < .55 ? 1 : Math.floor(rand(0, 4)), rn };
}
const sizeWord = n => n < 8 ? 'small' : n < 16 ? 'medium' : n < 28 ? 'large' : 'huge';
const knowsDetail = () => has('scout') || save.warned || roomLvl('radio') >= 2 || save.outposts.some(o => garrison(o).length && o.spec === 'tower');
function forecastText() {
  const f = save.forecast; if (!f) return '';
  return knowsDetail() ? `${RAID_TYPES[f.type].name} from ${SIDES[f.edge]} (${sizeWord(f.n)}${f.rn ? ', armed survivors too' : ''})` : `A ${sizeWord(f.n)} force is expected after dark`;
}
const autoPosts = () => {
  const P = {}, hs = save.buildings.find(b => b.t === 'house'); let turrets = save.buildings.filter(b => b.t === 'turret' && Math.hypot(b.gx - hs.gx - hs.w / 2, b.gy - hs.gy - hs.h / 2) <= 10).length;
  for (const c of alive()) P[c.name] = c.role === 'engineer' ? 'repair' : c.role === 'medic' ? 'medic' : 'rest';
  const fs = alive().filter(c => c.role === 'fighter').sort((a, b) => b.lvl - a.lvl);
  fs.forEach((c, i) => { if (i % 2 === 1 && turrets > 0) { P[c.name] = 'turret'; turrets--; } else P[c.name] = 'windows'; });   // the windows cover every side; turrets only their own
  let shooters = fs.length;   // never leave the house without at least two guns
  for (const c of alive().filter(c => !['fighter', 'engineer', 'medic'].includes(c.role)).sort((a, b) => b.hp - a.hp)) { if (shooters >= 2) break; P[c.name] = 'windows'; shooters++; }
  save.posts = P;
};

// ---------------------------------------------------------------- night plan screen
const planScene = {
  fixed: true,
  enter() { if (!save.forecast) planRaid(); autoPosts(); setMood('night'); },
  options() { return Object.keys(POSTS).concat((save.outAttack || []).map(n => 'out:' + n)); },
  draw() {
    ctx.fillStyle = '#050d09'; ctx.fillRect(0, 0, W, H); drawHUD(true);
    text('NIGHT PLAN', W / 2, 62, 22, AMBER, 'center'); text(`It is ${fmtClock(save.clock)}. Decide who stands where before the dark.`, W / 2, 82, 11, '#9fb', 'center');
    const F = save.forecast, T = RAID_TYPES[F.type], det = knowsDetail();
    ctx.fillStyle = '#07150d'; ctx.fillRect(24, 100, 270, 200); ctx.strokeStyle = '#a85'; ctx.strokeRect(24.5, 100.5, 270, 200);
    text('FORECAST', 36, 120, 12, '#fa5'); text(det ? T.name : `A ${sizeWord(F.n)} force`, 36, 144, 15, '#fff');
    wrapText(det ? T.desc : 'Send a scout, finish the radio mast or post a tower to learn what is coming and from where.', 38).forEach((l, i) => text(l, 36, 166 + i * 13, 10, '#9fb'));
    text(det ? `From ${SIDES[F.edge]} · about ${F.n} attackers` : `About ${F.n < 12 ? 'a dozen' : F.n < 24 ? 'a few dozen' : 'dozens'} of them`, 36, 214, 11, '#cfe');
    text(F.rn && det ? 'Armed survivors may come too.' : '', 36, 230, 11, '#f88');
    const turrets = save.buildings.filter(b => b.t === 'turret').length, manned = Object.values(save.posts).filter(p => p === 'turret').length, traps = save.buildings.filter(b => TRAP_KINDS.has(b.t)).length;
    text(`Turrets ${manned}/${turrets} manned · traps ${traps}`, 36, 254, 11, '#9fb'); text(`Ammo ${Math.floor(save.res.ammo)} · battery ${save.energy.toFixed(0)} kWh · lights ${save.buildings.filter(b => b.t === 'floodlight').length}`, 36, 270, 11, '#9fb');
    text(`House ${Math.round(save.houseHp)} HP`, 36, 286, 11, save.houseHp < 50 ? RED : '#9fb');
    // outposts under threat
    ctx.fillStyle = '#07150d'; ctx.fillRect(24, 312, 270, 190); ctx.strokeStyle = DIM; ctx.strokeRect(24.5, 312.5, 270, 190);
    text('OUTPOSTS', 36, 332, 12, '#6f8');
    if (!save.outposts.length) text('none held', 36, 354, 11, '#566');
    save.outposts.slice(0, 6).forEach((o, i) => { const t = outTown(o), hit = (save.outAttack || []).includes(o.name), g = garrison(o).length; text(`${hit ? '⚠' : '✓'} ${(t.short || t.name).slice(0, 24)}`, 36, 354 + i * 18, 11, hit ? RED : '#6f8'); text(hit ? 'ATTACK' : `${g}/${o.lvl}`, 282, 354 + i * 18, 10, hit ? RED : '#8aa', 'right'); });
    text(save.outAttack && save.outAttack.length ? 'Cycle a person to "out: …" to send them' : 'No outpost expects an attack tonight.', 36, 486, 10, '#fa5');
    // crew posts
    text('CREW', 316, 112, 12, '#5fa478');
    const crew = alive().slice(0, 14);
    crew.forEach((c, i) => {
      const y = 122 + i * 31, p = save.posts[c.name] || 'rest', out = p.startsWith('out:');
      ctx.fillStyle = '#07150d'; ctx.fillRect(316, y, 614, 27); ctx.strokeStyle = DIM; ctx.strokeRect(316.5, y + .5, 614, 27);
      ctx.fillStyle = ROLES[c.role].color; ctx.fillRect(322, y + 6, 5, 15);
      text(c.name, 336, y + 18, 12, '#fff'); text(`${ROLES[c.role].label.toLowerCase()} Lv${c.lvl} · ${Math.round(c.hp)} hp`, 410, y + 18, 10, ROLES[c.role].color);
      const label = out ? `OUT: ${(outTown({ name: p.slice(4) }) || {}).short || p.slice(4)}` : p.toUpperCase();
      button(label.slice(0, 18), 560, y + 2, 150, 23, () => cyclePost(c));
      text(out ? 'Reinforces the outpost tonight' : POSTS[p], 722, y + 18, 10, '#9fb');
    });
    button('AUTO-ASSIGN', 316, H - 56, 160, 36, () => autoPosts());
    button('◂ BACK', 486, H - 56, 130, 36, () => { setMood('calm'); go(baseScene); });
    button('START THE NIGHT WATCH', W - 310, H - 56, 286, 36, () => { baseScene.startRaid(); go(baseScene); });
  },
};
function cyclePost(c) {
  const opts = planScene.options(), turrets = save.buildings.filter(b => b.t === 'turret').length;
  let i = opts.indexOf(save.posts[c.name] || 'rest');
  for (let k = 0; k < opts.length; k++) {
    i = (i + 1) % opts.length; const o = opts[i];
    if (o === 'turret' && Object.entries(save.posts).filter(([n, p]) => p === 'turret' && n !== c.name).length >= turrets) continue;
    save.posts[c.name] = o; return;
  }
}

// ---------------------------------------------------------------- raid simulation
const houseMuzzle = (hx, hy, tx, ty) => { const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy) || 1; return [hx + dx / d * 2.6, hy + dy / d * 3.4]; };   // roughly where the house's windows are, towards the target
const hitZ = (z, d) => { z.hp -= z.armor ? Math.max(.3, d - z.armor) : d; z.hitT = .1; };
Object.assign(baseScene, {
  startRaid() {
    if (!save.forecast) planRaid(); if (!save.posts || !Object.keys(save.posts).length) autoPosts();
    save.clock = Math.max(save.clock, DUSK);
    const P = save.forecast, warned = save.warned; save.forecast = null; save.warned = 0; save.raidBoost = 0;
    // reinforcements leave the house for the night
    for (const c of alive()) { const p = save.posts[c.name]; if (p && p.startsWith('out:')) c.away = { tonight: p.slice(4), back: null }; }
    const manned = new Map(); const turrets = save.buildings.filter(b => b.t === 'turret');
    for (const c of alive()) if (save.posts[c.name] === 'turret') { const tb = turrets.find(b => !manned.has(b)); if (tb) manned.set(tb, c); }
    sfx('night'); setMood('night'); this.shake = 0;
    this.raid = { fires: [], blasts: [], toSpawn: P.n, total: P.n + P.rn, spawnT: 1, zombies: [], shots: [], t: 0, result: null, kills: 0, raiders: P.rn, rT: rand(8, 14), rSpawnT: 0, rEdge: Math.random() < .6 ? 1 : Math.floor(rand(0, 4)), rWarned: false, warned, type: P.type, edge: P.edge, plan: P, manned, repT: 1, repAcc: 0, medicT: 2 };
    say(`Night falls: ${RAID_TYPES[P.type].name.toLowerCase()}`);
  },
  shoot() {
    const r = this.raid, w = GEAR_BY_ID[save.gear.eq.ranged] || GEAR_BY_ID.old_rifle; if (!r || r.result || save.res[w.ammo] < (w.cost || 1)) return;
    let best = null, bd = 1.8, wx = 0, wy = 0;
    if (R3D.ok) best = R3D.base.pickZombie(r);   // 3D: the attacker nearest the cursor on screen
    else { const [wx2, wy2] = toWorld(mouse.x, mouse.y), [fx, fy] = unIso(wx2, wy2 + 8); wx = wx2; wy = wy2; for (const z of r.zombies) { const d = Math.hypot(z.x - fx, z.y - fy); if (d < bd) { bd = d; best = z; } } }
    save.res[w.ammo] -= (w.cost || 1); sfx(w.pellets > 1 ? 'shot_shotgun' : w.id === 'pistol' ? 'shot_pistol' : 'shot_rifle', 1, 60);
    if (best) { hitZ(best, Math.max(1, Math.round(w.dmg * ((w.pellets || 1) > 1 ? 3 : 1)))); r.shots.push({ x: wx, y: wy, gx: best.x, gy: best.y, l: .15 }); }
  },
  raidUpdate(dt) {
    const r = this.raid; if (r.result) return;
    r.t += dt;
    save.clock = DUSK + 9.5 * (1 - (r.zombies.length + r.toSpawn + r.raiders) / r.total);
    r.spawnT -= dt;
    const lights = powerAvail() > 0 ? save.buildings.filter(b => b.t === 'floodlight') : [];
    LIT = lights.length > 0; useEnergy(lights.length * 0.05 * dt);
    for (const b of save.buildings) if (b.zapFx > 0) b.zapFx -= dt;
    const edge = (side, e) => [[e * GX, -6], [e * GX, GY + 6], [-6, e * GY], [GX + 6, e * GY]][side];
    const mixTbl = { ...RAID_TYPES[r.type].mix }; for (const [k, w] of Object.entries(ZMODES[save.zmode] ? ZMODES[save.zmode].w : {})) if (mixTbl[k] !== undefined) mixTbl[k] *= w;
    const pickKind = () => { let x = Math.random() * Object.values(mixTbl).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(mixTbl)) if ((x -= v) <= 0) return k; return 'walker'; };
    if (r.toSpawn > 0 && r.spawnT <= 0) {
      r.spawnT = r.type === 'rush' ? rand(.25, .7) : rand(.5, 1.4); r.toSpawn--;
      const kind = pickKind(), K = RZ[kind], side = (r.type === 'rush' || Math.random() < .65) ? r.edge : Math.floor(rand(0, 4)), [x, y] = edge(side, rand(0, 1));
      const hpMul = 1 + Math.max(0, save.day - 14) * .02;
      r.zombies.push({ x, y, kind, ph: Math.random(), hp: K.hp * hpMul, big: !!K.big, armor: K.armor || 0, v: rand(K.v[0], K.v[1]), atk: 0, spitT: rand(.5, 1.5) });
    }
    if (r.raiders > 0 && r.t > r.rT) {
      if (!r.rWarned) { r.rWarned = true; say('Armed survivors are approaching'); }
      r.rSpawnT -= dt;
      if (r.rSpawnT <= 0) { r.rSpawnT = rand(.6, 1.1); r.raiders--; const [x, y] = edge(r.rEdge, rand(.3, .7)); r.zombies.push({ x, y, kind: 'walker', ph: Math.random(), hp: 3, big: false, raider: true, v: 1.6, atk: 0, shotT: rand(.5, 1.2) }); }
    }
    const house = save.buildings.find(b => b.t === 'house'), hx = house.gx + house.w / 2, hy = house.gy + house.h / 2;
    const medic = alive().some(c => save.posts[c.name] === 'medic'), trapMul = crewPerk('trapper') ? 1.5 : 1;
    const hurtHouse = d => { save.houseHp -= d; this.shake = Math.max(this.shake || 0, .3); sfx('hurt', .5, 300); r.houseDmg = (r.houseDmg || 0) + d; while (r.houseDmg >= 10) { r.houseDmg -= 10; if (medic && Math.random() < (crewPerk('field') ? .8 : .5)) continue; (r.lost = r.lost || []).push(...hurt(1, 15)); } };
    const targets = save.buildings.filter(b => !TRAP_KINDS.has(b.t) && b.t !== 'garden');
    for (const z of r.zombies) {
      z.hitT = Math.max(0, (z.hitT || 0) - dt);
      if (z.raider) {
        const dh = Math.hypot(hx - z.x, hy - z.y);
        if (dh <= 11) { z.shotT -= dt; if (z.shotT <= 0) { z.shotT = rand(1.1, 1.7); hurtHouse(2); const [x1, y1] = iso(z.x, z.y), [x2, y2] = iso(hx, hy); r.shots.push({ x1, y1: y1 - 12, x: x2, y: y2 - 14, l: .1, c: '#f66', g: [z.x, z.y, .9, hx, hy, 1.3] }); } continue; }
      }
      const K = RZ[z.kind] || RZ.walker;
      if (z.kind === 'spitter') {   // keeps its distance and melts the nearest building
        let tb = null, td = 1e9; for (const b of targets) { const d = Math.hypot(b.gx + b.w / 2 - z.x, b.gy + b.h / 2 - z.y); if (d < td) { td = d; tb = b; } }
        if (tb && td <= K.range) {
          z.spitT -= dt;
          if (z.spitT <= 0) { z.spitT = 1.7; sfx('spit', .5, 300); const [x1, y1] = iso(z.x, z.y), [x2, y2] = iso(tb.gx + tb.w / 2, tb.gy + tb.h / 2); r.shots.push({ x1, y1: y1 - 14, x: x2, y: y2 - 8, l: .25, c: '#9d4', g: [z.x, z.y, 1, tb.gx + tb.w / 2, tb.gy + tb.h / 2, 1] }); if (tb.t === 'house') hurtHouse(3); else tb.hp -= 4; }
          continue;
        }
      }
      const dazzled = lights.some(l => Math.hypot(z.x - l.gx - .5, z.y - l.gy - .5) < 7), v = z.v * (dazzled ? .7 : 1) * (z.slowT > 0 ? .45 : 1);
      if (z.slowT > 0) z.slowT -= dt;
      const a = Math.atan2(hy - z.y, hx - z.x), nx = z.x + Math.cos(a) * v * dt, ny = z.y + Math.sin(a) * v * dt;
      const blocker = cellAt(Math.floor(nx), Math.floor(ny));
      if (blocker && TRAP_KINDS.has(blocker.t)) {   // traps do not block, they bite
        if (blocker.t === 'wire') { z.slowT = .3; z.wireT = (z.wireT || 0) + dt; if (z.wireT > .5) { z.wireT = 0; hitZ(z, .6 * trapMul); blocker.hp -= 2; } }
        else if (blocker.t === 'pit') { hitZ(z, 4 * trapMul); blocker.hp = 0; sfx('wall', .6, 120); }
        else if (blocker.t === 'mine') { blocker.hp = 0; sfx('boom', .8); this.shake = Math.max(this.shake || 0, .45); r.blasts.push({ x: nx, y: ny, l: .4 }); for (const o of r.zombies) if (Math.hypot(o.x - nx, o.y - ny) < 2.3) o.hp -= 6 * trapMul; }
        z.x = nx; z.y = ny; continue;
      }
      if (blocker && blocker.t !== 'garden') {
        if (TIERS[blocker.t] && (blocker.t === 'fence' || blocker.t === 'gate') && (blocker.lvl || 0) >= 3 && powerAvail() > 0) { z.zap = (z.zap || 0) + dt; if (z.zap > .5) { z.zap = 0; z.hp -= 1; blocker.zapFx = .25; useEnergy(.15); } }
        z.atk += dt;
        if (z.atk > (z.kind === 'runner' ? .8 : 1.0)) {
          z.atk = 0; const wallMul = K.wall || 1, dmg = blocker.t === 'house' ? (z.big ? 5 : z.kind === 'runner' ? 1.5 : 2) : (z.big ? 12 : z.kind === 'runner' ? 3.5 : 5) * wallMul;
          sfx('wall', .6, 220); if (blocker.t === 'house') hurtHouse(dmg); else blocker.hp -= dmg;
        }
      } else { z.x = nx; z.y = ny; }
    }
    // allied gunners (militia and army pacts)
    for (const [pf, cnt, dmg, rate] of [['militia', 2, 1, 1.0], ['army', 1, 1.4, .8]]) if (save.pacts[pf]) { r.ally = r.ally || {}; r.ally[pf] = (r.ally[pf] || 0) - dt; if (r.ally[pf] <= 0) { r.ally[pf] = rate / cnt; let best = null, bd = 11; for (const z of r.zombies) { const d = Math.hypot(z.x - hx, z.y - hy); if (d < bd) { bd = d; best = z; } } if (best) { sfx('shot_pistol', .25, 150); hitZ(best, dmg); const [x1, y1] = iso(hx, hy), [x2, y2] = iso(best.x, best.y); r.shots.push({ x1: x1 + 10, y1: y1 - 18, x: x2, y: y2 - 10, l: .1, c: '#adf', g: [...houseMuzzle(hx, hy, best.x, best.y), 1.6, best.x, best.y, .7] }); } } }
    // crew defenders: windows, manned turrets, repairs, medics
    for (const c of alive()) {
      const p = save.posts[c.name]; if (p !== 'windows') continue;
      c.cd = (c.cd || 0) - dt; if (c.cd > 0 || save.res.ammo <= 0) continue;
      let best = null, bd = 11; for (const z of r.zombies) { const d = Math.hypot(z.x - hx, z.y - hy); if (d < bd) { bd = d; best = z; } }
      if (best) { sfx('shot_pistol', .35, 120); const fighter = c.role === 'fighter'; hitZ(best, fighter ? 1 + ((c.lvl || 1) >= 3 ? .5 : 0) + (hasPerk('fighter', 'marksman') ? .5 : 0) : .6); c.cd = ((fighter ? .8 : 1.1) - .08 * ((c.lvl || 1) - 1)) * (r.warned ? .8 : 1) * (hasPerkOf(c, 'rapid') ? .85 : 1); save.res.ammo -= .25; const [x1, y1] = iso(hx, hy), [x2, y2] = iso(best.x, best.y); r.shots.push({ x1, y1: y1 - 20, x: x2, y: y2 - 10, l: .12, g: [...houseMuzzle(hx, hy, best.x, best.y), 1.4, best.x, best.y, .7] }); }
    }
    r.repT -= dt;
    if (r.repT <= 0) {
      r.repT = 1;
      for (const c of alive()) if (save.posts[c.name] === 'repair') {
        if (save.res.scrap < 1 && !crewPerk('efficient')) continue;
        const amt = 2 * (c.role === 'engineer' ? 2.5 : 1) * (hasPerk('engineer', 'fast') ? 1.5 : 1);
        let worst = null, wr = 1; for (const b of save.buildings) if (b.t !== 'house' && !TRAP_KINDS.has(b.t) && b.hp < maxHp(b)) { const q = b.hp / maxHp(b); if (q < wr) { wr = q; worst = b; } }
        if (worst) { worst.hp = Math.min(maxHp(worst), worst.hp + amt); r.repAcc += amt; } else if (save.houseHp < 100) { save.houseHp = Math.min(100, save.houseHp + amt * .3); r.repAcc += amt * .3; }
        if (r.repAcc >= 10) { r.repAcc -= 10; if (!crewPerk('efficient')) save.res.scrap = Math.max(0, save.res.scrap - 1); }
      }
    }
    if (medic) { r.medicT -= dt; if (r.medicT <= 0) { r.medicT = 2; for (const c of alive()) c.hp = Math.min(100, c.hp + 1); } }
    // throwables: Q switches, G throws at the cursor
    const qN = kdown('swap'), gN = kdown('throw');
    if (qN && !this.qH) this.item = this.item === 'molotov' ? 'bomb' : 'molotov';
    if (gN && !this.gH && save.items[this.item] > 0) {
      const [fx, fy] = R3D.ok ? R3D.base.groundCell() : (([wx, wy]) => unIso(wx, wy))(toWorld(mouse.x, mouse.y)); save.items[this.item]--;
      sfx(this.item === 'molotov' ? 'fire' : 'boom'); this.shake = Math.max(this.shake || 0, this.item === 'molotov' ? 0 : .5);
      if (this.item === 'molotov') r.fires.push({ x: fx, y: fy, l: 5 });
      else { r.blasts.push({ x: fx, y: fy, l: .5 }); for (const z of r.zombies) if (Math.hypot(z.x - fx, z.y - fy) < 5) z.hp -= 6; }
    }
    this.qH = qN; this.gH = gN;
    for (const f of r.fires) { f.l -= dt; for (const z of r.zombies) if (Math.hypot(z.x - f.x, z.y - f.y) < 3) { z.burnT = .5; z.burn = (z.burn || 0) + dt; if (z.burn > .5) { z.burn = 0; z.hp--; } } }
    r.fires = r.fires.filter(f => f.l > 0); for (const bl of r.blasts) bl.l -= dt; r.blasts = r.blasts.filter(bl => bl.l > 0);
    for (const z of r.zombies) if (z.burnT > 0) z.burnT -= dt;
    // turrets (a crew member on one makes it faster and a bit stronger)
    for (const b of save.buildings) if (b.t === 'turret') {
      b.cd = (b.cd || 0) - dt;
      if (b.cd > 0 || save.res.ammo <= 0) continue;
      const lit = lights.some(l => Math.hypot(l.gx - b.gx, l.gy - b.gy) < 8), man = r.manned.get(b);
      let best = null, bd = 9; for (const z of r.zombies) { const d = Math.hypot(z.x - b.gx - .5, z.y - b.gy - .5); if (d < bd) { bd = d; best = z; } }
      if (best) { sfx('turret', .5, 90); hitZ(best, man ? (man.role === 'fighter' ? 1.4 : 1.15) : 1); b.cd = (lit ? .5 : .7) * (man ? .65 : 1); save.res.ammo -= .25; const [x1, y1] = iso(b.gx + .5, b.gy + .5), [x2, y2] = iso(best.x, best.y); r.shots.push({ x1, y1: y1 - 24, x: x2, y: y2 - 10, l: .12, g: [b.gx + .5, b.gy + .5, 1.1, best.x, best.y, .7] }); }
    }
    for (const z of r.zombies) if (z.hp <= 0) { z.dead = true; r.kills++; save.stats.zk++; sfx('zdie', .6, 90); if (z.raider) { save.res.ammo += 3; save.res.scrap += 3; r.rloot = (r.rloot || 0) + 1; } }
    r.zombies = r.zombies.filter(z => !z.dead);
    save.buildings = save.buildings.filter(b => b.t === 'house' || b.hp > 0); cellsDirty = true;
    for (const s of r.shots) s.l -= dt; r.shots = r.shots.filter(s => s.l > 0);
    save.res.ammo = Math.max(0, Math.round(save.res.ammo * 4) / 4); save.energy = Math.min(save.energy, cap());
    if (save.houseHp <= 0) {
      r.result = 'lost'; save.houseHp = 50; setMood('calm');
      for (const k in save.res) save.res[k] = Math.floor(save.res[k] / 2);
      r.report = this.endNight(false, r.lost || []);
    } else if (r.toSpawn <= 0 && r.raiders <= 0 && r.zombies.length === 0) {
      r.result = 'won'; r.report = this.endNight(true, r.lost || []); sfx('dawn'); setMood('calm');
    }
    if (r.result && r.rloot) { facRep('reapers', -2 * Math.min(3, r.rloot)); save.stats.kills += r.kills; r.report.push(`Survivors driven off: +${r.rloot * 3} ammo, +${r.rloot * 3} scrap from their gear`); }
  },
});
