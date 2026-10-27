// The drive to a site, as a short stretch you actually steer (3D only; without WebGL the old text events in objectives.js are used).
// The road runs along -z, seen from above. Wrecks, potholes and shambling crowds are real obstacles; the road events (roadblock, the Reapers' toll,
// an ambush, a fuel cache) are built on the road itself. Damage goes straight to the vehicle and your health, and you arrive at
// the site with whatever is left of both. World units are metres, x across the road, y up, s = distance driven (world z = -s).

const driveScene = (() => {
  const ROAD = 6, MAXX = 8.6, CAR_W = 1.9;
  let D = null, g = null;
  const rr = (a, b) => a + Math.random() * (b - a);
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const sceneObj = {
    fixed: true, gl3d: true,
    make(town, ev, opts = {}) { start(town, ev, opts); return sceneObj; },
    enter() { /* built in make */ },
    update(dt) { if (D) sim(Math.min(dt, .05)); },
    draw(dt, t) { if (!D) { go(mapScene); return; } render(dt, t); hud(); },
    up() {},
    _g: () => g, _d: () => D, toll: c => tollChoice(c),
  };

  // ---------------------------------------------------------------- setup
  function start(town, ev, opts) {
    const v = veh(), VT = VEHICLE_TYPES[v.type], hours = kmBetween(town, HOME) * 1.25 / tripSpeed('drive'), danger = siteDanger(town);
    D = {
      town, ev, v, VT, hours, danger, L: Math.round(Math.min(760, Math.max(420, 300 + hours * 220))), s: 0, x: 0, vx: 0, sp: 0, hp: opts.hp || 100, t: 0, state: 'drive', stateT: 0,
      obs: [], cans: [], shooters: [], tracers: [], parts: [], floats: [], shake: 0, hitCD: 0, steer: 0, boost: false, brake: false, got: { diesel: 0 }, msg: '', trapped: 0,
      vmax: VT.speed * .55 * ((v.hp == null ? 100 : v.hp) < 40 ? .8 : 1), clock0: save.clock, res: null,
    };
    D.hurt = 0; D.hits = 0;
    layout();
    g = null; build3d(); sfx('engine');
  }

  // where things go. s is the distance along the road.
  function layout() {
    const L = D.L, put = o => { D.obs.push(o); return o; };
    const wreck = (x, s, extra = {}) => put({ k: 'wreck', x, s, hw: 1.05, hl: 2.5, type: pickOf(['car', 'car', 'pickup', 'van', 'truck']), col: pickOf(VEHICLE_COLORS), burnt: Math.random() < .35, ry: rr(-.18, .18), ...extra });
    const crowd = (x, s, n) => { for (let i = 0; i < n; i++) put({ k: 'z', x: x + rr(-3, 3), s: s + rr(-5, 5), hw: .45, hl: .45, hp: 1, walk: rr(0, 6), look: [Math.random(), Math.random()], kind: Math.random() < .12 ? 'runner' : 'walker' }); };
    // event first, so ordinary hazards keep out of its way
    const se = L * rr(.5, .65), zone = [];
    const ev = D.ev; D.evS = se;
    if (ev === 'roadblock') {
      const gap = pickOf([-4, 0, 4]);
      for (const x of [-6.2, -4, -2, 0, 2, 4, 6.2]) if (Math.abs(x - gap) > 2.5) wreck(x, se + rr(-1.5, 1.5), { solid: true, burnt: Math.random() < .5 });
      for (let i = 0; i < 5; i++) put({ k: 'prop', x: rr(-6, 6), s: se + rr(-3, 3), what: 'barrel' });
      D.gap = gap; D.banner = 'ROADBLOCK'; zone.push([se - 30, se + 30]);
    } else if (ev === 'toll') {
      const side = pickOf([-1, 1]);
      D.toll = put({ k: 'wreck', x: side * 1.6, s: se, type: 'pickup', col: '#7a2a2a', burnt: false, across: true, solid: true, open: 0 });
      for (let i = 0; i < 3; i++) D.shooters.push({ x: side * (5.2 + i * 1.1), s: se + 1.5 - i * 1.5, cd: rr(.5, 1.2), on: false, look: i, toll: true });
      D.tollS = se; D.banner = 'TOLL'; zone.push([se - 50, se + 30]);
    } else if (ev === 'ambush') {
      wreck(pickOf([-4, 0, 4]), se - 14, { burnt: true });
      for (let i = 0; i < 4; i++) D.shooters.push({ x: (i % 2 ? 1 : -1) * rr(9.5, 11.5), s: se + i * 16, cd: rr(.4, 1.1), on: false, look: i });
      D.banner = 'AMBUSH'; zone.push([se - 60, se + 90]);
    } else if (ev === 'cache') {
      wreck(7.5, se, { burnt: true, type: 'truck', ry: .5, solid: false, off: true });
      for (let i = 0; i < 3; i++) D.cans.push({ x: pickOf([-1, 1]) * rr(2.5, 5.5), s: se + i * 9 + rr(-3, 3), got: false });
      D.banner = 'FUEL'; zone.push([se - 20, se + 40]);
    }
    const free = s => !zone.some(([a, b]) => s > a && s < b);
    // ordinary hazards: more on dangerous roads
    const n = 5 + Math.round(Math.min(8, D.danger * .8)); let s = 70;
    for (let i = 0; i < n && s < L - 70; i++) {
      s += rr(L / (n + 2) * .6, L / (n + 2) * 1.3); if (!free(s)) continue;
      const k = pickOf(['wreck', 'wreck', 'hole', 'hole', 'crowd', 'crowd', 'wreckpair', 'can']);
      if (k === 'wreck') wreck(pickOf([-4, 0, 4]) + rr(-1, 1), s);
      else if (k === 'wreckpair') { const a = pickOf([-4, 0]); wreck(a, s); wreck(a + 4.2, s + rr(6, 12)); }
      else if (k === 'hole') for (let j = 0; j < 1 + (Math.random() < .5); j++) put({ k: 'hole', x: rr(-5, 5), s: s + j * 6, r: rr(1, 1.5) });
      else if (k === 'crowd') crowd(pickOf([-3, 0, 3]), s, 3 + Math.floor(Math.random() * (3 + Math.min(4, D.danger * .4))));
      else if (!D.ev) D.cans.push({ x: pickOf([-1, 1]) * rr(2, 5), s, got: false });
    }
    D.obs.sort((a, b) => a.s - b.s);
  }

  // ---------------------------------------------------------------- simulation
  const keyAxis = () => {
    let st = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), boost = !!(keys.KeyW || keys.ArrowUp), brake = !!(keys.KeyS || keys.ArrowDown || keys.Space);
    for (const p of touchPts.values()) for (const [a, bx, by] of TB()) if (Math.hypot(p.x - bx, p.y - by) < 48) { if (a === 'l') st -= 1; else if (a === 'r') st += 1; else if (a === 'b') brake = true; else boost = true; }
    return [Math.max(-1, Math.min(1, st)), boost, brake];
  };
  const TB = () => [['l', 100, H - 90], ['r', 215, H - 90], ['b', W - 215, H - 90], ['g', W - 100, H - 90]];
  const hurtCar = (n, why) => { wearVehicle(D.v, n); D.hp = Math.max(20, D.hp - n * 1.1); D.hurt += n; D.hits++; D.shake = Math.min(1, D.shake + n / 14); float(why ? why + ' ' : '', '-' + Math.round(n) + ' CONDITION', '#f66'); persist(); if (vhp() <= 0) { D.state = 'dead'; D.stateT = 0; D.msg = 'The engine dies for good. You will have to walk the rest.'; sfx('bad'); } };
  const vhp = () => D.v.hp == null ? 100 : D.v.hp;
  const float = (a, txt, col) => D.floats.push({ txt: (a || '') + txt, col, l: 1.6, s: D.s, x: D.x });
  const spark = (x, y, z, n, c = '#ffd070', sp = 6) => { for (let i = 0; i < n; i++) D.parts.push({ x, y, z, vx: rr(-sp, sp), vy: rr(1, sp), vz: rr(-sp, sp), l: rr(.25, .6), c }); };

  function sim(dt) {
    D.t += dt; D.stateT += dt; D.hitCD -= dt; D.shake = Math.max(0, D.shake - dt * 1.6);
    const [st, boost, brake] = keyAxis(); D.boost = boost; D.brake = brake;
    if (D.state === 'toll') { D.sp = Math.max(0, D.sp - 30 * dt); D.s += D.sp * dt; }
    if (D.state === 'dead' || D.state === 'done') { D.sp = Math.max(0, D.sp - 25 * dt); D.s += D.sp * dt; if (D.stateT > (D.state === 'dead' ? 3 : 1.4)) finish(); return; }
    if (D.state === 'drive') {
      const off = Math.abs(D.x) > ROAD + .4;
      const target = D.t < 1 ? D.vmax * .6 : brake ? 5 : (boost ? D.vmax * 1.2 : D.vmax) * (off ? .55 : 1);
      D.sp += Math.sign(target - D.sp) * Math.min(Math.abs(target - D.sp), (target > D.sp ? (D.VT.cap > 50 ? 8 : 13) : 30) * dt);
      const want = st * (4 + Math.min(7, D.sp * .5)); D.vx += (want - D.vx) * Math.min(1, 7 * dt); D.x += D.vx * dt;
      if (D.x > MAXX) { D.x = MAXX; D.vx = 0; } if (D.x < -MAXX) { D.x = -MAXX; D.vx = 0; }
      D.s += D.sp * dt; D.steer = D.vx;
      if (off && D.sp > 4) { D.shake = Math.max(D.shake, .15); if (Math.random() < dt * 8) D.parts.push({ x: D.x + rr(-1, 1), y: .2, z: -D.s + 1.5, vx: rr(-2, 2), vy: rr(.5, 2), vz: rr(1, 3), l: .7, c: '#8a7a5a' }); }
    }
    // triggers
    if (D.toll && D.state === 'drive' && !D.tollDone && D.s > D.tollS - 40) { D.state = 'toll'; D.stateT = 0; }
    if (D.toll && D.toll.open > 0 && D.toll.open < 1) { D.toll.open = Math.min(1, D.toll.open + dt * .6); }
    // collisions
    const hl = D.VT.len * 2.9 / 2, cx = D.x, cs = D.s;
    for (const o of D.obs) {
      if (o.dead || Math.abs(o.s - cs) > 40) continue;
      if (o.k === 'z') {   // the crowd drifts towards the road and the car
        if (!o.fly) { const d = Math.abs(o.s - cs); if (d < 38) { const dx = D.x - o.x, k = Math.min(1.1, 1.1) * dt; o.x += Math.sign(dx) * Math.min(Math.abs(dx), k * (o.kind === 'runner' ? 2.4 : 1)); } o.walk += dt * 1.6; }
        else { o.fly -= dt; o.x += o.fvx * dt; o.s += o.fvs * dt; o.fy += o.fvy * dt; o.fvy -= 14 * dt; if (o.fy < 0) { o.fy = 0; o.fvy = 0; o.fvx *= .8; } if (o.fly <= 0) o.dead = true; continue; }
        if (Math.abs(o.x - cx) < CAR_W / 2 + o.hw && Math.abs(o.s - cs) < hl + o.hl && D.sp > 2) {
          o.fly = 1.1; o.fvx = D.vx * .6 + rr(-4, 4); o.fvs = D.sp * .8; o.fvy = rr(5, 8); o.fy = 0; D.sp *= .93; sfx('hit', .8, 60); sfx('zdie', .6, 90); save.stats.zk++; spark(o.x, 1, -o.s, 8, '#7a2', 4); D.shake = Math.min(1, D.shake + .12); D.zhit = (D.zhit || 0) + 1;
          if (D.zhit % 3 === 0) hurtCar(1, 'crowd');
        }
      } else if (o.k === 'hole') {
        if (!o.hit && Math.hypot(o.x - cx, o.s - cs) < o.r + .8) { o.hit = true; if (D.sp > 8) { D.sp *= .75; hurtCar(1.5 + D.sp * .05); D.shake = Math.min(1, D.shake + .35); sfx('wall', .6, 100); } }
      } else if (o.k === 'wreck' && !o.off) {
        if (o.open >= .55) continue;
        const ox = o.x + (o.open ? o.open * 12 * Math.sign(o.x || 1) : 0), dx = cx - ox, dz = cs - o.s, ex = CAR_W / 2 + o.hw, ez = hl + o.hl;
        if (Math.abs(dx) < ex && Math.abs(dz) < ez && D.hitCD <= 0) {
          D.hitCD = .45; hurtCar(Math.max(2, Math.min(20, D.sp * .6)), 'crash'); sfx('wall', 1, 80); spark(cx, 1, -cs - 2, 12);
          if (ez - Math.abs(dz) < ex - Math.abs(dx)) { D.s = o.s + Math.sign(dz || -1) * (ez + .05); D.sp *= .15; }
          else { D.x = ox + Math.sign(dx || 1) * (ex + .05); D.vx = Math.sign(dx || 1) * 3; D.sp *= .6; }
          if (!o.solid) o.shove = (o.shove || 0) + 1;
        }
      }
    }
    // fuel cans
    for (const c of D.cans) if (!c.got && Math.abs(c.s - cs) < 2.4 && Math.abs(c.x - cx) < 2.2) { c.got = true; const n = ri(1, 2); save.res.diesel += n; D.got.diesel += n; float('', '+' + n + ' DIESEL', '#fa5'); sfx('pickup'); persist(); }
    // shooters
    for (const sh of D.shooters) {
      const d = sh.s - cs; sh.on = d < 60 && d > -25 && (!sh.toll || D.tollRun);
      if (!sh.on || D.state !== 'drive' && D.state !== 'toll') continue;
      sh.cd -= dt; if (sh.cd > 0) continue; sh.cd = rr(.8, 1.4);
      const hit = Math.random() < Math.max(.12, .5 - D.sp / 70 + (Math.abs(d) < 12 ? .1 : 0));
      const tx = cx + (hit ? 0 : rr(-2.2, 2.2) + Math.sign(rr(-1, 1)) * 1.2), tz = -cs - D.sp * .15;
      D.tracers.push({ x0: sh.x, y0: 1.5, z0: -sh.s, x1: tx, y1: hit ? 1 : .1, z1: tz, l: .12 }); sh.flash = .1; sfx('shot_rifle', .4, 140); spark(sh.x, 1.5, -sh.s, 2, '#ffe7a0', 2);
      if (hit) { hurtCar(rr(2, 4), 'shot'); D.hp = Math.max(20, D.hp - rr(3, 6)); sfx('hit', .6, 120); spark(tx, 1, tz, 6); } else spark(tx, .1, tz, 4, '#a89878', 3);
    }
    for (const t of D.tracers) t.l -= dt; D.tracers = D.tracers.filter(t => t.l > 0);
    for (const f of D.floats) f.l -= dt; D.floats = D.floats.filter(f => f.l > 0);
    for (const p of D.parts) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 12 * dt; if (p.y < 0) { p.y = 0; p.vy = 0; } } D.parts = D.parts.filter(p => p.l > 0);
    if (D.state === 'drive' && D.s >= D.L) { D.state = 'done'; D.stateT = 0; sfx('ok'); }
  }

  // the toll: pay or run it or turn back
  function tollChoice(c) {
    if (c === 'pay') { save.res.scrap -= 12; facRep('reapers', 2); D.toll.open = .01; float('', '-12 SCRAP', '#fa5'); sfx('pickup'); }
    else if (c === 'run') { facRep('reapers', -5); D.tollRun = true; }
    else { D.state = 'done'; D.abort = true; D.stateT = 0; save.clock += .5; persist(); return; }
    D.state = 'drive'; D.tollDone = true; D.sp = 2; persist();
  }

  function finish() {
    const town = D.town, abort = D.abort, hp = Math.max(20, Math.round(D.hp)), walk = D.state === 'dead' || vhp() <= 0;
    if (g && g.road) g.road.material.map.dispose(); g = null; D = null;
    if (abort) { go(mapScene); return; }
    go(missionScene(town, walk ? 'walk' : 'drive', { hp }));
  }

  // ---------------------------------------------------------------- 3D scene
  const _c = new THREE.Color();
  function build3d() {
    const R3 = R3D, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(62, 1, 1, 900), L = D.L, season = seasonOf().id;
    sc.background = new THREE.Color('#8fb2c8'); sc.fog = new THREE.Fog('#9db9c8', 90, 330);
    const hemi = new THREE.HemisphereLight('#e6eefb', '#6b6a5c', 1.5), sun = new THREE.DirectionalLight('#fff1d6', 2.1); sun.position.set(-30, 50, 20); sc.add(hemi, sun);
    g = { scene: sc, camera: cam, hemi, sun, obs: new Map(), t: 0, season };
    const grass = { spring: '#4f7a38', summer: '#5a8a3a', autumn: '#7a6a34', winter: '#b8c4c8' }[season];
    g.ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: grass })); g.ground.rotation.x = -Math.PI / 2; sc.add(g.ground);
    // road texture: asphalt with dashed lane lines, repeats every 16 m
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c2 = cv.getContext('2d');
    c2.fillStyle = '#34363a'; c2.fillRect(0, 0, 128, 128); for (let i = 0; i < 500; i++) { c2.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .06})`; c2.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    c2.fillStyle = '#d8d8d0'; c2.fillRect(2, 0, 4, 128); c2.fillRect(122, 0, 4, 128);           // edge lines
    for (const x of [128 / 3, 128 * 2 / 3]) c2.fillRect(x - 2, 0, 4, 52);                      // dashes at the lane borders
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, (L + 400) / 16); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
    g.road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2, L + 400), new THREE.MeshLambertMaterial({ map: tex })); g.road.rotation.x = -Math.PI / 2; g.road.position.set(0, .08, -L / 2 + 40); sc.add(g.road);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2 + 3.4, L + 400), new THREE.MeshLambertMaterial({ color: '#6a5f4c' })); sh.rotation.x = -Math.PI / 2; sh.position.set(0, .03, -L / 2 + 40); sc.add(sh);
    // trees, poles and fields: built once along the whole road and merged
    const tr = new THREE.Group(), leaf = season === 'autumn' ? ['#a8662a', '#8a4a1e', '#b08a2a'] : season === 'winter' ? ['#d8e0e0', '#c8d4d6'] : ['#2f5a2a', '#3a6a30', '#2a4e28'];
    for (let s = -40; s < L + 120; s += rr(3, 7)) for (const sd of [-1, 1]) {
      if (Math.random() < .25) continue; const x = sd * (ROAD + rr(8, 38)), h = rr(5, 10);
      R3.mesh(R3.cyl(.25, .35, h * .4, 6), R3.mat('#4a3626'), x, h * .2, -s, tr, false);
      R3.mesh(R3.cone(h * .3, h * .85, 7), R3.mat(pickOf(leaf)), x, h * .4 + h * .42, -s, tr, false);
    }
    for (let s = 0; s < L + 120; s += 46) { const x = -(ROAD + 3); R3.mesh(R3.cyl(.14, .18, 9, 6), R3.mat('#5a4a38'), x, 4.5, -s, tr, false); R3.mesh(R3.box(.2, .2, 2.6), R3.mat('#5a4a38'), x, 8.4, -s, tr, false); }
    for (let s = 20; s < L + 100; s += rr(60, 140)) { const sd = pickOf([-1, 1]), x = sd * rr(22, 60), w = rr(14, 30); R3.mesh(R3.box(w, .05, rr(20, 50)), R3.mat(pickOf(season === 'winter' ? ['#d0d8da'] : ['#6a8a3a', '#9a8a42', '#7a6a3a'])), x, .04, -s, tr, false); }
    sc.add(R3.merge(tr));
    // the destination: a small town on the horizon
    const tw = new THREE.Group(); for (let i = 0; i < 26; i++) { const w = rr(8, 18), h = rr(6, 22); R3.mesh(R3.box(w, h, rr(8, 16)), R3.mat(pickOf(['#4a4a50', '#5a544c', '#3c4048', '#665a4c'])), rr(-70, 70), h / 2, -(L + 120 + rr(0, 60)), tw, false); }
    g.town = R3.merge(tw); sc.add(g.town);
    g.hills = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = R3.mesh(R3.cone(rr(60, 110), rr(30, 60), 6), R3.mat(season === 'winter' ? '#c8d0d4' : '#3a5a3a'), (i - 4) * 120 + rr(-30, 30), 0, -(L + 360), g.hills, false); } sc.add(g.hills);
    // the player's vehicle, with headlights for the dark
    const v = D.v; g.car = new THREE.Group(); g.carBody = R3.vehicle(v.type, v.color || '#2f4a7a', D.VT.len * 2.9, CAR_W); g.carBody.rotation.y = Math.PI / 2; g.car.add(g.carBody); sc.add(g.car);
    g.lights = new THREE.SpotLight('#fff3c8', 0, 70, .5, .5, 1); g.lights.position.set(0, 1, -1); g.lights.target.position.set(0, 0, -30); g.car.add(g.lights, g.lights.target);
    // obstacles
    for (const o of D.obs) {
      let m = null;
      if (o.k === 'wreck') { m = R3.vehicle(o.type, o.col, VEHICLE_TYPES[o.type].len * 2.9, 1.9, { burnt: o.burnt }); const len = VEHICLE_TYPES[o.type].len * 2.9; m.rotation.y = o.across ? (o.ry || 0) : Math.PI / 2 + (o.ry || 0); if (o.across) { o.hw = len / 2; o.hl = 1; } else { o.hl = len / 2; o.hw = 1.05; } }
      else if (o.k === 'hole') { m = new THREE.Mesh(R3.cyl(o.r, o.r, .05, 12), new THREE.MeshBasicMaterial({ color: '#0c0c0e' })); m.position.y = .045; }
      else if (o.k === 'prop') { m = R3.mesh(R3.cyl(.4, .4, .9, 8), R3.mat(pickOf(['#7a3a22', '#2a4a6a'])), 0, .45, 0, null, false); }
      else if (o.k === 'z') { const L0 = R3.zombieLook(o.kind, o.look[0], o.look[1]); m = R3.humanoid({ skin: L0.skin, shirt: L0.shirt, pants: L0.pants, hat: L0.hair, extra: '#3a4046', variant: L0.variant, scale: 1.75, pose: 'zombie' }); }
      if (m) { sc.add(m); g.obs.set(o, m); }
    }
    for (const c of D.cans) { const m = new THREE.Group(); R3.mesh(R3.box(.34, .5, .2), R3.mat('#b83a1c'), 0, .25, 0, m, false); R3.mesh(R3.box(.1, .08, .1), R3.mat('#333'), .08, .54, 0, m, false); const gl = new THREE.Mesh(R3.cyl(.5, .5, 2.4, 10), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: .22, depthWrite: false })); gl.position.y = 1.2; m.add(gl); sc.add(m); c.mesh = m; }
    for (const s of D.shooters) { const m = R3.humanoid({ skin: '#c89a74', shirt: '#8a4a28', pants: '#2a2420', hat: '#2a2420', variant: 'raider', extra: '#5a2a1a', scale: 1.75, gun: 'old_rifle', pose: 'aim', twoHand: true }); sc.add(m); s.mesh = m; }
    g.tracers = R3.pool(() => { const m = new THREE.Mesh(R3.box(.05, .05, 1), R3.basic('#ffe08a', .9)); sc.add(m); return m; });
    g.parts = R3.particles(260, .4); sc.add(g.parts);
    g.rain = null; if (save.weather === 'storm') { g.rain = R3.particles(400, .12); sc.add(g.rain); g.drops = Array.from({ length: 400 }, () => ({ x: rr(-30, 30), y: rr(0, 22), z: rr(-40, 4) })); }
  }

  function render(dt, t) {
    if (!g) return;
    const R3 = R3D, sc = g.scene, cam = g.camera, wx = save.weather, wf = { sunny: 1, partly: .85, cloudy: .55, storm: .38 }[wx] || 1;
    const clk = D.clock0 + D.hours * Math.min(1, D.s / D.L), dk = darkness(clk), flash = R3.lightning(dt, wx === 'storm');
    const dusk = Math.sin(Math.min(1, dk) * Math.PI) * .45 * (dk < .98 ? 1 : 0);
    const sky = _c.set('#8fb2c8').lerp(new THREE.Color('#6f7a84'), (1 - wf) * 1.3).lerp(new THREE.Color('#02040a'), dk).lerp(new THREE.Color('#d98a5a'), dusk); if (flash) sky.lerp(new THREE.Color('#dfe8ff'), flash * .5);
    sc.background.copy(sky); sc.fog.color.copy(sky); sc.fog.near = 120 - 20 * dk; sc.fog.far = (400 - 120 * dk) * (wx === 'storm' ? .7 : 1);
    g.hemi.color.set('#e6eefb').lerp(new THREE.Color('#4a5a96'), dk); g.hemi.groundColor.set('#6b6a5c').lerp(new THREE.Color('#05070c'), dk); g.hemi.intensity = (1.5 * wf) * (1 - dk) + .5 * dk + flash * 2.4;
    g.sun.color.set('#fff1d6').lerp(new THREE.Color('#7a92ff'), dk); g.sun.intensity = (2.1 * wf) * (1 - dk) + .4 * dk;
    g.lights.intensity = dk > .3 ? 140 * dk : 0;
    // the car
    const cz = -D.s; g.car.position.set(D.x, .08, cz); g.car.rotation.y = -D.vx * .03; g.carBody.rotation.z = -D.vx * .01;
    g.carBody.position.y = Math.sin(t * 28) * .01 * Math.min(1, D.sp / 10) + (Math.abs(D.x) > ROAD + .4 ? Math.sin(t * 50) * .04 : 0);
    g.ground.position.set(D.x, 0, cz); g.road.visible = true;
    // camera: behind and above, a little further back when fast
    const sh = D.shake * .6; cam.fov = 50 + Math.min(8, D.sp * .2); cam.up.set(0, 0, -1);   // top-down: the road runs up the screen
    cam.position.set(D.x * .8 + (Math.random() - .5) * sh, 34, cz + 4 + D.sp * .2 + (Math.random() - .5) * sh); cam.lookAt(D.x * .8, 0, cz - 7 - D.sp * .2); cam.updateProjectionMatrix();
    // things
    for (const [o, m] of g.obs) {
      if (o.k === 'z') { m.visible = !o.dead && Math.abs(o.s - D.s) < 160; if (!m.visible) continue; m.position.set(o.x, o.fly ? o.fy : 0, -o.s); m.rotation.y = o.fly ? o.fly * 9 : Math.atan2(-(o.s - D.s), D.x - o.x); m.rotation.z = o.fly ? o.fly * 6 : 0; if (!o.fly && Math.abs(o.s - D.s) < 80) R3.pose(m, o.walk, o.kind === 'runner' ? .9 : .5, { pose: 'zombie', chase: true }); }
      else if (o.k === 'wreck') { m.visible = Math.abs(o.s - D.s) < 200; m.position.set(o.x + (o.open ? o.open * 12 * Math.sign(o.x || 1) : 0) + (o.shove ? Math.sign(o.x || 1) * Math.min(1.5, o.shove * .6) : 0), 0, -o.s); }
      else { m.visible = Math.abs(o.s - D.s) < 200; m.position.set(o.x, m.userData.keepY || (o.k === 'hole' ? .045 : 0), -o.s); if (o.k === 'prop') m.position.y = 0; }
    }
    for (const c of D.cans) if (c.mesh) { c.mesh.visible = !c.got && Math.abs(c.s - D.s) < 160; c.mesh.position.set(c.x, 0, -c.s); c.mesh.rotation.y = t * 1.5; }
    for (const s of D.shooters) { const m = s.mesh; m.position.set(s.x, 0, -s.s); const a = Math.atan2(-(cz - -s.s), D.x - s.x); m.rotation.y = s.on ? a : a * .5; R3.pose(m, t, 0, { pose: 'aim', twoHand: true }); m.visible = Math.abs(s.s - D.s) < 180; }
    g.tracers.begin(); for (const tr of D.tracers) { const m = g.tracers.next(), dx = tr.x1 - tr.x0, dy = tr.y1 - tr.y0, dz = tr.z1 - tr.z0, len = Math.hypot(dx, dy, dz); m.position.set(tr.x0 + dx / 2, tr.y0 + dy / 2, tr.z0 + dz / 2); m.scale.set(1, 1, len); m.lookAt(tr.x1, tr.y1, tr.z1); } g.tracers.end();
    g.parts.userData.set(D.parts, p => [p.x, p.y, p.z, p.c]);
    // a little exhaust smoke when the car is hurt
    if (vhp() < 45 && Math.random() < dt * 14) D.parts.push({ x: D.x + rr(-.3, .3), y: 1, z: cz - 1.5, vx: rr(-.5, .5), vy: rr(1, 2.5), vz: 1.5, l: .9, c: '#555' });
    if (g.rain) { const arr = g.drops; for (const d of arr) { d.y -= 32 * dt; d.z += D.sp * dt * .3; if (d.y < 0) { d.y = rr(14, 22); d.x = rr(-30, 30); d.z = rr(-40, 4); } } g.rain.userData.set(arr, d => [D.x + d.x, d.y, cz + d.z, '#9ab8d8']); }
    R3.show(true); R3.render(sc, cam);
  }

  // ---------------------------------------------------------------- 2D overlay
  function hud() {
    drawHUD(true);
    const near = (s, x) => { const p = R3D.toUI(x, 1, -s, g.camera); return p; };
    // floating notices, anchored on the road
    for (const f of D.floats) { const p = near(f.s, f.x); if (!p) continue; ctx.globalAlpha = Math.min(1, f.l); text(f.txt, p.x, p.y - (1.6 - f.l) * 40, 14, f.col, 'center'); ctx.globalAlpha = 1; }
    // road event banner as it comes up
    // progress bar and gauges
    const bw = 460, bx = W / 2 - bw / 2, by = 52, p = Math.min(1, D.s / D.L);
    ctx.fillStyle = 'rgba(3,10,6,.7)'; ctx.fillRect(bx - 10, by - 14, bw + 20, 44); ctx.strokeStyle = DIM; ctx.strokeRect(bx - 10.5, by - 14.5, bw + 20, 44);
    text(`ON THE ROAD TO ${(D.town.short || D.town.name).toUpperCase()}`, W / 2, by - 2, 11, '#9fb', 'center');
    ctx.fillStyle = '#12301e'; ctx.fillRect(bx, by + 8, bw, 6); ctx.fillStyle = GREEN; ctx.fillRect(bx, by + 8, bw * p, 6); ctx.fillStyle = AMBER; ctx.fillRect(bx + bw * p - 3, by + 4, 6, 14);
    text(`${Math.max(0, Math.round(D.L - D.s))} m`, bx + bw, by + 26, 10, '#9fb', 'right'); text(D.banner && p < .45 ? 'WATCH THE ROAD' : '', bx, by + 26, 10, '#fa5');
    const vh = Math.round(vhp());
    text(`${Math.round(D.sp * 3.6)} km/h`, 24, 76, 22, GREEN); text(`${D.VT.label.toUpperCase()}  ${vh}%`, 24, 94, 12, vh < 40 ? RED : '#9fb'); ctx.fillStyle = '#12301e'; ctx.fillRect(24, 102, 130, 6); ctx.fillStyle = vh < 40 ? RED : vh < 70 ? AMBER : GREEN; ctx.fillRect(24, 102, 130 * vh / 100, 6);
    text(`YOU ${Math.round(D.hp)}`, 24, 124, 12, D.hp < 50 ? RED : '#9fb');
    if (!TOUCH.on) text('A / D or ← → steer · W boost · S brake', W / 2, H - 14, 12, '#9fb', 'center');
    if (D.banner && D.state === 'drive' && D.evS - D.s < 140 && D.evS - D.s > -10) { const nm = { ROADBLOCK: 'ROADBLOCK AHEAD', TOLL: 'ROADBLOCK — ARMED MEN AHEAD', AMBUSH: 'SOMETHING IS WRONG AHEAD', FUEL: 'FUEL AHEAD' }[D.banner]; ctx.globalAlpha = .6 + .4 * Math.sin(D.t * 6); text(nm, W / 2, 134, 16, D.banner === 'FUEL' ? AMBER : '#f66', 'center'); ctx.globalAlpha = 1; }
    if (D.t < 3) { ctx.globalAlpha = Math.max(0, 1 - D.t / 3); text(D.banner ? 'Something is on the road ahead…' : 'Keep to the road.', W / 2, 150, 18, AMBER, 'center'); ctx.globalAlpha = 1; }
    if (TOUCH.on) { ctx.globalAlpha = .55; for (const [a, bx2, by2] of TB()) { ctx.strokeStyle = '#9fb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx2, by2, 44, 0, 7); ctx.stroke(); text({ l: '◀', r: '▶', b: 'BRAKE', g: 'BOOST' }[a], bx2, by2 + 5, a === 'l' || a === 'r' ? 22 : 11, '#cfe', 'center'); } ctx.globalAlpha = 1; }
    if (D.state === 'toll') {
      ctx.fillStyle = 'rgba(3,10,6,.88)'; ctx.fillRect(170, 90, 620, 250); ctx.strokeStyle = '#fa5'; ctx.strokeRect(170.5, 90.5, 620, 250);
      text('THE REAPERS\' TOLL', W / 2, 122, 20, '#fa5', 'center'); wrapText('A pickup blocks the road. Armed men lean on it and one of them waves a rifle: "Toll. Pay up or turn back."', 62).forEach((l, i) => text(l, W / 2, 148 + i * 18, 13, '#cfe', 'center'));
      button('Pay 12 scrap', 220, 196, 520, 34, () => tollChoice('pay'), save.res.scrap >= 12);
      button('Run the gauntlet (they shoot, reputation -5)', 220, 238, 520, 34, () => tollChoice('run'));
      button('Turn back', 220, 280, 520, 34, () => tollChoice('back'));
    }
    if (D.state === 'dead') { ctx.fillStyle = 'rgba(3,10,6,.7)'; ctx.fillRect(0, H / 2 - 40, W, 80); text('BREAKDOWN', W / 2, H / 2 - 6, 24, RED, 'center'); text(D.msg, W / 2, H / 2 + 22, 13, '#cfe', 'center'); }
    if (D.state === 'done') { ctx.fillStyle = `rgba(3,8,6,${Math.min(1, D.stateT / 1.2)})`; ctx.fillRect(-UI.ox, -UI.oy, UI.lw, UI.lh); }
  }

  return sceneObj;
})();
