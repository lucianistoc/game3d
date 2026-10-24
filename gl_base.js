// 3D view of the base (the Cărani plot) and the night watch. The grid is unchanged: one cell = 1.5 m = one world unit,
// gx runs west->east (x), gy north->south (z), and y is up. Every building is turned into a small model; the raid's
// attackers, shots, fires and blasts are drawn straight from the raid state.

R3D.base = (() => {
  const B = {};
  const HT = { house: [1.9, .95], workshop: [1.45, .7], greenhouse: [1, .55], gazebo: [1.5, .85], barn: [1.6, .8] };   // wall height, roof height (cells)
  let g = null;   // scene state, built on first use
  const col = (c, k) => k === 1 ? c : '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------------------------------------------------------- textures
  const noiseTex = (base, specks, rep, size = 256) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 14; i++) { x.fillStyle = specks[Math.floor(Math.random() * specks.length)]; x.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 3); }
    return R3D.canvasTex(c, rep);
  };

  // ---------------------------------------------------------------- build the static world once
  const init = () => {
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, .5, 600);
    g = { scene: sc, camera: cam, tx: GX / 2, tz: GY / 2 + 1, dist: 44, yaw: .55, pitch: .95, recs: new Map(), crew: new Map(), zs: new Map(), vehs: new Map(), fx: [], t: 0, shots: null };
    sc.fog = new THREE.Fog('#8db7dc', 70, 200); sc.background = new THREE.Color('#8db7dc');
    g.hemi = new THREE.HemisphereLight('#dfeaf8', '#6a6a50', 1.5); sc.add(g.hemi);
    g.sun = new THREE.DirectionalLight('#fff1d6', 2.4); g.sun.castShadow = true; g.sun.target.position.set(GX / 2, 0, GY / 2); sc.add(g.sun, g.sun.target);
    const s = g.sun.shadow; s.mapSize.set(2048, 2048); s.camera.left = -34; s.camera.right = 34; s.camera.top = 34; s.camera.bottom = -34; s.camera.near = 1; s.camera.far = 140; s.bias = -.0008;
    g.moon = new THREE.DirectionalLight('#6e86ff', 0); g.moon.position.set(-20, 40, -25); g.moon.target.position.set(GX / 2, 0, GY / 2); sc.add(g.moon, g.moon.target);
    g.porch = new THREE.PointLight('#ffb460', 0, 12, 0); g.porch.position.set(8.6, 1.6, 19.8); sc.add(g.porch);
    g.flood = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#fff2cc', 0, 14, 0); sc.add(l); return l; });
    g.fireL = [0, 1].map(() => { const l = new THREE.PointLight('#ff8a30', 0, 14, 0); sc.add(l); return l; });
    g.blastL = new THREE.PointLight('#ffb050', 0, 24, 0); sc.add(g.blastL);

    // shared materials whose glow follows the time of day and the power
    g.win = new THREE.MeshLambertMaterial({ color: '#6a7c8c', emissive: '#ffcf70', emissiveIntensity: 0, flatShading: true });
    g.elec = new THREE.MeshLambertMaterial({ color: '#567', emissive: '#7df', emissiveIntensity: 0 });
    g.lamp = new THREE.MeshLambertMaterial({ color: '#ddd', emissive: '#fff2cc', emissiveIntensity: 0 });

    // ground
    const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: noiseTex('#3c6428', ['#47742f', '#345a22', '#53803a', '#5a6a2a'], 90) })); far.rotation.x = -Math.PI / 2; far.position.set(GX / 2, -.02, GY / 2); far.receiveShadow = true; sc.add(far);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(GX, GY), new THREE.MeshLambertMaterial({ map: noiseTex('#527f36', ['#5d8c3e', '#4a7430', '#6a8f44', '#7a8a4a', '#6b5a3a'], 7) })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(GX / 2, 0, GY / 2); lawn.receiveShadow = true; sc.add(lawn);
    for (const [x, y] of PATH) R3D.mesh(R3D.box(1, .05, 1), R3D.mat('#a4a6a6'), x + .5, .03, y + .5, sc, false).receiveShadow = true;
    // the street (Aleea Sportivilor) along the south edge
    R3D.mesh(R3D.box(260, .06, 1.4), R3D.mat('#9a9d9f'), GX / 2, .03, GY + .7, sc, false);
    R3D.mesh(R3D.box(260, .05, 7), R3D.mat('#34373b'), GX / 2, .02, GY + 4.9, sc, false).receiveShadow = true;
    for (let x = -60; x < 80; x += 3) R3D.mesh(R3D.box(1.5, .06, .12), R3D.mat('#d8d8c0'), x, .06, GY + 4.6, sc, false);
    // scenery: trees, bushes, boards and the cats
    const tree = (x, z, sc2 = 1) => {
      const t = new THREE.Group(); t.position.set(x, 0, z);
      R3D.mesh(R3D.cyl(.12 * sc2, .2 * sc2, 1.6 * sc2, 7), R3D.mat('#5a3d22'), 0, .8 * sc2, 0, t);
      for (const [dx, dy, dz, r, c] of [[0, 2.3, 0, 1.15, '#2f6a2a'], [.5, 1.9, .3, .85, '#3a7a30'], [-.45, 2.0, -.3, .9, '#2a5e26']]) R3D.mesh(R3D.sphere(r * sc2, 9), R3D.mat(c), dx * sc2, dy * sc2, dz * sc2, t);
      sc.add(t);
    };
    for (const [x, y] of TREES) tree(x * GSCALE, y * GSCALE, 1);
    for (const [x, y, s2] of TREES_FAR) tree(x * GSCALE, y * GSCALE, s2 * 1.1);
    for (const [x, y] of BUSHES) { const b = R3D.mesh(R3D.sphere(.5, 8), R3D.mat('#3a7a32'), x * GSCALE, .35, y * GSCALE, sc); b.scale.y = .8; }
    for (const [x, y] of PILES) { const p = new THREE.Group(); p.position.set(x * GSCALE, 0, y * GSCALE); for (let i = 0; i < 4; i++) R3D.mesh(R3D.box(1.1, .08, .6), R3D.mat('#d8d6b8'), 0, .06 + i * .09, 0, p).rotation.y = i * .1; R3D.mesh(R3D.box(.7, .25, .4), R3D.mat('#3a6a8a'), 1.1, .35, .1, p); sc.add(p); }
    for (const [x, y, c] of CATS) { const k = new THREE.Group(); k.position.set(x * GSCALE, 0, y * GSCALE); R3D.mesh(R3D.box(.34, .16, .14), R3D.mat(c), 0, .12, 0, k); R3D.mesh(R3D.box(.14, .14, .14), R3D.mat(c), .2, .2, 0, k); sc.add(k); }
    g.bldRoot = new THREE.Group(); sc.add(g.bldRoot); g.ents = new THREE.Group(); sc.add(g.ents);

    // pools
    g.cells = R3D.pool(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .4, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .08; g.ents.add(m); return m; });
    g.tracers = R3D.pool(() => { const m = new THREE.Mesh(R3D.box(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ff8' })); g.ents.add(m); return m; });
    g.flames = R3D.pool(() => { const f = R3D.flame(); g.ents.add(f); return f; });
    g.blasts = R3D.pool(() => { const m = new THREE.Mesh(R3D.sphere(1, 14), new THREE.MeshBasicMaterial({ color: '#ffb44a', transparent: true, opacity: .8, depthWrite: false })); g.ents.add(m); return m; });
    g.hits = R3D.pool(() => { const m = new THREE.Mesh(R3D.sphere(.22, 8), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: .9 })); g.ents.add(m); return m; });
    g.parts = R3D.particles(400, .22); g.ents.add(g.parts);
    // rain
    const N = 700, rp = new Float32Array(N * 6); g.rain = { n: N, pos: rp, obj: null };
    for (let i = 0; i < N; i++) { const x = Math.random() * 60 - 20, y = Math.random() * 30, z = Math.random() * 70 - 20; rp.set([x, y, z, x - .08, y - .7, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); g.rain.obj = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#aabbd0', transparent: true, opacity: .45 })); g.rain.obj.frustumCulled = false; g.rain.obj.visible = false; sc.add(g.rain.obj);
    g.ghosts = new Map(); g.ghost = null;
  };

  // ---------------------------------------------------------------- building models (local origin = the building's NW corner, units = cells)
  const blk = (p, x, y, z, w, h, d, color, o) => R3D.mesh(R3D.box(w, h, d), R3D.mat(color, o), x + w / 2, y + h / 2, z + d / 2, p);
  const nbr = (b, dx, dy) => { const o = cellAt(b.gx + dx, b.gy + dy); return !!o && (o.t === 'wall' || o.t === 'fence' || o.t === 'gate'); };
  const roofOf = (p, w, d, H, rh, color, over = .3) => { const r = R3D.mesh(R3D.prism(d + over * 2, rh, w + over * 2), R3D.mat(color), w / 2, H, d / 2, p); r.rotation.y = Math.PI / 2; return r; };
  const panels = (p, w, d, H, rh, z0, z1, rows) => {   // solar panels on both slopes of a ridge running along z
    const span = w / 2 + .3, ang = Math.atan2(rh, span), len = Math.hypot(span, rh) - .35;
    for (const sd of [-1, 1]) for (let i = 0; i < rows; i++) {
      const pz = z0 + (z1 - z0) * (i + .5) / rows, m = R3D.mesh(R3D.box(len * .86, .05, (z1 - z0) / rows * .86), R3D.mat('#15305c'), w / 2 + sd * (span / 2 - .05), H + rh / 2 + .07, pz, p, false);
      m.rotation.z = sd < 0 ? ang : -ang;
    }
  };
  const windows = (p, w, d, H, mats) => {
    const win = g.win;
    for (let i = 0; i < 4; i++) for (const sx of [0, w]) { const m = R3D.mesh(R3D.box(.06, .55, .7), win, sx, H * .55, d * (i + .5) / 4, p, false); }
    for (const z of [.9, w - .9]) R3D.mesh(R3D.box(.7, .55, .06), win, z, H * .55, d, p, false);
  };

  const MODELS = {
    house(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.house, k = o.k;
      blk(p, 0, 0, 0, w, H, d, col('#b9bdb6', k)); roofOf(p, w, d, H, rh, col('#7a2e24', k));
      blk(p, w * .6, H + rh * .5, d * .25, .45, .9, .45, col('#8a8a86', k));   // chimney
      blk(p, 2.2, 0, d, .9, 1.35, .1, '#5a3a22'); blk(p, 1.9, 0, d, 1.5, .12, .5, '#8a8c8a');   // door + step
      windows(p, w, d, H); panels(p, w, d, H, rh, .6, d - .6, 5);
    },
    workshop(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.workshop, k = o.k;
      blk(p, 0, 0, 0, w, H, d, col('#a05038', k)); roofOf(p, w, d, H, rh, col('#7a3a2a', k));
      blk(p, 1, 0, d, 2, 1.2, .08, '#6a6e72'); for (let i = 0; i < 5; i++) blk(p, 1, .2 + i * .22, d + .05, 2, .03, .02, '#4a4e52');   // roller door
      for (let i = 0; i < 3; i++) R3D.mesh(R3D.box(.06, .5, .8), g.win, w, H * .6, d * (i + .5) / 3, p, false);
      panels(p, w, d, H, rh, .8, d - .8, 4);
    },
    greenhouse(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.greenhouse, k = o.k;
      blk(p, 0, 0, 0, w, .2, d, col('#6a7078', k)); R3D.mesh(R3D.box(w - .1, H, d - .1), R3D.mat('#bfe6f6', { op: .3 }), w / 2, H / 2 + .1, d / 2, p, false);
      const r = R3D.mesh(R3D.prism(w, rh, d), R3D.mat('#cdeefb', { op: .32 }), w / 2, H + .1, d / 2, p, false);
      for (let i = 0; i <= 4; i++) blk(p, i * w / 4 - .03, .1, -.02, .06, H, .06, '#c8d0d4'), blk(p, i * w / 4 - .03, .1, d - .04, .06, H, .06, '#c8d0d4');
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.floor(w); j++) { const h2 = .25 + hash(j + b.gx, i + b.gy) * .35; R3D.mesh(R3D.cone(.18, h2, 5), R3D.mat(k < 1 ? '#4a5a2a' : '#3f9a3a'), .5 + j, .2 + h2 / 2, .45 + i * .8, p); }
    },
    gazebo(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.gazebo, k = o.k;
      blk(p, 0, 0, 0, w, .12, d, col('#8a6a46', k));
      for (const [x, z] of [[.05, .05], [w - .15, .05], [.05, d - .15], [w - .15, d - .15]]) blk(p, x, .12, z, .1, H - .12, .1, col('#8a5a3a', k));
      const r = R3D.mesh(R3D.cone(w * .85, rh, 4), R3D.mat(col('#b0452f', k)), w / 2, H + rh / 2, d / 2, p); r.rotation.y = Math.PI / 4;
      blk(p, .5, .12, .6, w - 1, .3, .35, '#6a4a2a'); blk(p, .4, .12, 1.0, w - .8, .5, .05, '#6a4a2a');
    },
    barn(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.barn, k = o.k;
      blk(p, 0, 0, 0, w, H, d, col('#b0a290', k)); roofOf(p, w, d, H, rh, col('#c4622e', k), .15);
      for (let i = 0; i < 6; i++) blk(p, w, H * .35, 1 + i * 3.1, .05, .5, .8, '#5a6a78');
    },
    gate(b, o, p) {
      const w = b.w, lvl = b.lvl || 0, H = 1.15, steel = lvl >= 1;
      blk(p, -.05, 0, .35, .22, H + .25, .3, '#c8c8c0'); blk(p, w - .17, 0, .35, .22, H + .25, .3, '#c8c8c0');
      for (const half of [0, 1]) {
        const x0 = .2 + half * (w / 2 - .02), x1 = w / 2 - .05 + half * (w / 2 - .02);
        if (steel) blk(p, x0, .1, .47, x1 - x0, H - .1, .06, lvl >= 2 ? '#46586a' : '#566a7c'); else for (let i = 0; i <= 8; i++) blk(p, x0 + (x1 - x0) * i / 8 - .02, .1, .48, .05, H - .1, .05, '#3a3f46');
        blk(p, x0, .3, .47, x1 - x0, .05, .06, '#8a98a8'); blk(p, x0, H - .15, .47, x1 - x0, .05, .06, '#8a98a8');
        if (lvl >= 2) for (let i = 0; i < 7; i++) R3D.mesh(R3D.cone(.05, .2, 4), R3D.mat('#ccc'), x0 + (x1 - x0) * (i + .5) / 7, H + .05, .5, p);
        if (lvl >= 3) blk(p, x0, H + .3, .47, x1 - x0, .04, .04, '#567').material = g.elec;
      }
    },
    generator(b, o, p) { blk(p, .1, 0, .15, .8, .6, .7, col('#c8861a', o.k)); blk(p, .2, .6, .3, .25, .3, .25, '#222'); blk(p, .55, 0, .1, .25, .3, .2, '#a03a1a'); },
    powerbox(b, o, p) { blk(p, .2, 0, .25, .6, 1.1, .5, col('#cfd4d8', o.k)); blk(p, .35, .85, .75, .3, .1, .02, '#3d3', {}); },
    wire(b, o, p) {
      for (const [x, z] of [[.05, .5], [.95, .5]]) blk(p, x - .03, 0, z - .03, .06, .35, .06, '#6a6a6a');
      for (let i = 0; i < 4; i++) { const r = R3D.mesh(R3D.box(1.05, .035, .035), R3D.mat('#b5b5b5'), .5, .1 + i * .07, .5 + (i % 2 ? .06 : -.06), p, false); r.rotation.z = (i % 2 ? .1 : -.1); }
      for (let i = 0; i < 6; i++) R3D.mesh(R3D.box(.03, .12, .03), R3D.mat('#999'), .08 + i * .17, .22, .5 + (i % 2) * .08 - .04, p, false);
    },
    pit(b, o, p) { blk(p, .05, 0, .05, .9, .03, .9, '#120c06'); blk(p, 0, 0, 0, 1, .06, .06, '#5a4630'); blk(p, 0, 0, .94, 1, .06, .06, '#5a4630'); blk(p, 0, 0, 0, .06, .06, 1, '#5a4630'); blk(p, .94, 0, 0, .06, .06, 1, '#5a4630'); },
    mine(b, o, p) { R3D.mesh(R3D.cyl(.25, .27, .08, 12), R3D.mat('#555'), .5, .05, .5, p); R3D.mesh(R3D.sphere(.05, 6), R3D.basic('#f33'), .5, .12, .5, p); },
    well(b, o, p) {
      R3D.mesh(R3D.cyl(.42, .46, .55, 12), R3D.mat(col('#8a8d90', o.k)), .5, .28, .5, p); R3D.mesh(R3D.cyl(.3, .3, .02, 12), R3D.mat('#10202a'), .5, .56, .5, p);
      blk(p, .1, .5, .45, .08, .9, .1, '#7a5a3a'); blk(p, .82, .5, .45, .08, .9, .1, '#7a5a3a'); const r = R3D.mesh(R3D.prism(1, .35, 1), R3D.mat('#8a5a3a'), .5, 1.35, .5, p);
    },
    tank(b, o, p) { R3D.mesh(R3D.cyl(.4, .4, 1.1, 14), R3D.mat(col('#4a6a8a', o.k)), .5, .55, .5, p); R3D.mesh(R3D.cyl(.2, .4, .15, 14), R3D.mat('#7aa0c4'), .5, 1.17, .5, p); blk(p, .46, .05, .88, .08, .1, .1, '#222'); },
    floodlight(b, o, p) { R3D.mesh(R3D.cyl(.05, .06, 2.3, 8), R3D.mat('#8a8f96'), .5, 1.15, .5, p); blk(p, .32, 2.2, .3, .36, .2, .4, '#6a6e74'); blk(p, .34, 2.18, .68, .32, .16, .04, '#fff').material = g.lamp; },
    fence(b, o, p) {
      const lvl = b.lvl || 0, k = o.k, along = b.dir === 'y', q = new THREE.Group(); p.add(q);
      q.position.set(.5, 0, .5); if (along) q.rotation.y = Math.PI / 2; q.position.set(.5, 0, .5);
      const X = (x, y, z, w, h, d, c, op) => { const m = R3D.mesh(R3D.box(w, h, d), R3D.mat(c, op), x, y + h / 2, z, q); return m; };
      if (lvl === 0) {
        const tone = ['#7a5a36', '#6e4f2e', '#85633c'][Math.floor(hash(b.gx, b.gy) * 3)]; X(0, .05, 0, 1, .78, .07, col(tone, k)); X(0, .2, .05, 1, .06, .04, col('#4a3220', k)); X(0, .55, .05, 1, .06, .04, col('#4a3220', k)); X(-.47, 0, 0, .1, .95, .1, col('#5a3e20', k));
      } else if (lvl === 1) {
        X(0, .05, 0, 1, .85, .015, col('#c0ccd4', k), { op: .28 }); X(0, .9, 0, 1, .04, .04, col('#b8c2ca', k)); X(-.47, 0, 0, .06, .98, .06, col('#9aa4ac', k));
      } else {
        X(0, 0, 0, 1, 1.15, .13, col('#a4a6a8', k)); X(0, .55, .07, 1, .02, .02, '#7a7c7e'); X(-.47, 0, 0, .12, 1.3, .16, col('#6a6e74', k));
        if (lvl === 2) { for (let i = 0; i < 8; i++) { const m = X(-.45 + i * .13, 1.2, 0, .13, .03, .03, '#b8b8b8'); m.rotation.z = (i % 2 ? .6 : -.6); } }
        else { X(0, 1.28, 0, 1, .035, .035, '#567').material = g.elec; X(0, 1.42, 0, 1, .035, .035, '#567').material = g.elec; }
      }
    },
    garden(b, o, p) {
      blk(p, .02, 0, .02, .96, .07, .96, '#3a2a1a');
      for (let i = 0; i < 4; i++) { const h2 = .22 + hash(b.gx * 3 + i, b.gy) * .2; R3D.mesh(R3D.cone(.14, h2, 5), R3D.mat(o.k < 1 ? '#5a6a2a' : '#3f9a3a'), .25 + (i % 2) * .5, .07 + h2 / 2, .25 + Math.floor(i / 2) * .5, p); }
    },
    wall(b, o, p) {
      const lvl = b.lvl || 0, hh = [.65, .95, 1.2][lvl], t = .34, k = o.k, c = [col('#b9a272', k), col('#9a9ea4', k), col('#4c545e', k)][lvl], top = [col('#d6c08c', k), col('#b6bac0', k), col('#707a85', k)][lvl];
      blk(p, .5 - t / 2, 0, .5 - t / 2, t, hh, t, c);
      if (nbr(b, 0, -1)) blk(p, .5 - t / 2, 0, 0, t, hh, .5 - t / 2, c);
      if (nbr(b, 0, 1)) blk(p, .5 - t / 2, 0, .5 + t / 2, t, hh, .5 - t / 2, c);
      if (nbr(b, -1, 0)) blk(p, 0, 0, .5 - t / 2, .5 - t / 2, hh, t, c);
      if (nbr(b, 1, 0)) blk(p, .5 + t / 2, 0, .5 - t / 2, .5 - t / 2, hh, t, c);
      blk(p, .5 - t / 2 - .02, hh, .5 - t / 2 - .02, t + .04, .05, t + .04, top);
      if (lvl === 2) for (let i = 0; i < 3; i++) R3D.mesh(R3D.cone(.04, .22, 4), R3D.mat('#c8ccd0'), .4 + i * .1, hh + .15, .5, p);
    },
    turret(b, o, p) {
      R3D.mesh(R3D.cyl(.34, .4, .55, 10), R3D.mat(col('#6a3a3a', o.k)), .5, .28, .5, p);
      const head = new THREE.Group(); head.position.set(.5, .72, .5); p.add(head); blk(head, -.25, -.12, -.25, .5, .26, .5, col('#8a4a4a', o.k)); blk(head, .1, -.04, -.05, .75, .1, .1, '#2a2d30'); blk(head, -.05, .14, -.1, .2, .1, .2, '#c55');
      p.userData.head = head;
    },
  };

  const dmgOf = (frac) => frac < .3 ? 2 : frac < .6 ? 1 : 0;
  const makeBuilding = (b, ghost) => {
    const grp = new THREE.Group(); grp.position.set(b.gx, 0, b.gy);
    const fn = MODELS[b.t]; if (!fn) return grp;
    const frac = b.t === 'house' ? save.houseHp / 100 : b.hp / maxHp(b), d = ghost ? 0 : dmgOf(frac);
    fn(b, { k: d === 2 ? .55 : d === 1 ? .78 : 1 }, grp);
    if (ghost) grp.traverse(c => { if (c.isMesh) { const m = c.material.clone(); m.transparent = true; m.opacity = Math.min(m.opacity, .6); m.depthWrite = false; c.material = m; c.castShadow = false; c.userData.own = true; } });
    return grp;
  };
  const sigOf = b => {
    const frac = b.t === 'house' ? save.houseHp / 100 : b.hp / maxHp(b);
    let s = `${b.t}|${b.gx},${b.gy}|${b.lvl || 0}|${b.dir || ''}|${dmgOf(frac)}`;
    if (b.t === 'wall') s += `|${+nbr(b, 0, -1)}${+nbr(b, 0, 1)}${+nbr(b, -1, 0)}${+nbr(b, 1, 0)}`;
    return s;
  };

  // vehicles parked on the street
  const makeVehicle = v => R3D.vehicle(v.type, v.color || '#2f4a7a', VEHICLE_TYPES[v.type].len * GSCALE, 1.2);
  const crewMesh = c => R3D.humanoid({ skin: '#caa07a', shirt: ROLES[c.role] ? ROLES[c.role].color : '#8a8', pants: '#2f3440', hat: '#3a3a40', scale: 1.15, pose: 'idle' });
  const ZB = { walker: [1.15, 1], runner: [1.1, .95], brute: [1.5, 1.45], spitter: [1.15, 1.05], armored: [1.22, 1.12] };
  const ZSKIN = { walker: '#7d9468', brute: '#8c946a', runner: '#a3ad84', spitter: '#97c93f', armored: '#6f8a6c' };
  const CLOTH = ['#5a5348', '#3f4a56', '#6a4a3a', '#4a5a4a', '#6a6a6a', '#4a3a5a'];
  const attackerMesh = z => {
    if (z.raider) return R3D.humanoid({ skin: '#c89a74', shirt: '#8a4a28', pants: '#2a2420', hat: '#2a2420', scale: 1.2, gun: .6, pose: 'aim', twoHand: true });
    const [s, bulk] = ZB[z.kind] || ZB.walker, skin = ZSKIN[z.kind] || ZSKIN.walker, h = R3D.humanoid({ skin, shirt: z.kind === 'spitter' ? '#566a2a' : CLOTH[Math.floor(z.ph * 6) % 6], pants: '#303236', hat: z.kind === 'armored' ? '#40464c' : skin, extra: '#3a4046', scale: s, bulk, pose: 'zombie', belly: z.kind === 'spitter', plates: z.kind === 'armored', lean: z.kind === 'runner' ? .22 : 0 });
    for (const sg of [-1, 1]) { const e = new THREE.Mesh(R3D.box(.02, .025, .03), R3D.basic('#ff2a1e')); e.position.set(.085, .02, sg * .04); h.userData.head.add(e); }
    return h;
  };

  // ---------------------------------------------------------------- picking and aiming
  const recOf = grp => { while (grp && !grp.userData.b) grp = grp.parent; return grp; };
  B.groundCell = () => { if (!g) return [-1, -1]; const p = R3D.ground(g.camera, 0); return p ? [p.x, p.z] : [-1, -1]; };
  B.pick = () => {   // the grid cell under the cursor: a building the ray hits first, otherwise the ground
    if (!g) return [-1, -1];
    g.camera.updateMatrixWorld();
    const G = R3D.ground(g.camera, 0); if (!G) return [-1, -1];
    const cand = [];
    for (const [b, r] of g.recs) if (G.x > b.gx - 4 && G.x < b.gx + b.w + 4 && G.z > b.gy - 4 && G.z < b.gy + b.h + 4) cand.push(r.grp);
    if (cand.length) {
      const rc = R3D.setRay(g.camera), hit = rc.intersectObjects(cand, true)[0];
      if (hit) { const root = recOf(hit.object); if (root) { const b = root.userData.b; return [Math.floor(Math.max(b.gx, Math.min(b.gx + b.w - .01, hit.point.x))), Math.floor(Math.max(b.gy, Math.min(b.gy + b.h - .01, hit.point.z)))]; } }
    }
    return [Math.floor(G.x), Math.floor(G.z)];
  };
  B.pickZombie = raid => {   // nearest attacker to the cursor on screen
    if (!g) return null; let best = null, bd = 48;
    for (const z of raid.zombies) { const q = R3D.toUI(z.x, .65, z.y, g.camera); if (!q) continue; const d = Math.hypot(q.x - mouse.x, q.y - mouse.y); if (d < bd) { bd = d; best = z; } }
    return best;
  };

  // ---------------------------------------------------------------- camera
  B.fit = () => { if (!g) init(); g.tx = GX / 2 - 1; g.tz = GY / 2 + 1; g.dist = Math.max(30, Math.min(60, 62 * Math.min(1.15, innerWidth / innerHeight) ** -.3)); g.yaw = .55; g.pitch = .95; };
  B.look = (x, z) => { if (!g) init(); g.tx = x; g.tz = z; };
  B.zoom = f => { if (!g) init(); g.dist = Math.max(8, Math.min(90, g.dist / f)); };
  B.camUpdate = (sc, dt) => {
    if (!g) init();
    const sp = (g.dist * .9 + 6) * dt, fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), rx = Math.cos(g.yaw), rz = -Math.sin(g.yaw);
    let dx = (kdown('right') ? 1 : 0) - (kdown('left') ? 1 : 0), dz = (kdown('up') ? 1 : 0) - (kdown('down') ? 1 : 0);
    g.tx += (rx * dx + fx * dz) * sp; g.tz += (rz * dx + fz * dz) * sp;
    if (keys.Equal || keys.NumpadAdd) B.zoom(1 + 1.2 * dt); if (keys.Minus || keys.NumpadSubtract) B.zoom(1 / (1 + 1.2 * dt));
    if (keys.BracketLeft) g.yaw -= 1.4 * dt; if (keys.BracketRight) g.yaw += 1.4 * dt;
    if (keys.Home) { g.yaw = .55; g.pitch = .95; }
    if (sc.rot && mouse.down) { g.yaw = sc.rot.yaw - (mouse.x - sc.rot.x) * .008; g.pitch = Math.max(.35, Math.min(1.45, sc.rot.pitch + (mouse.y - sc.rot.y) * .006)); }
    if (sc.pan && mouse.down) {   // grab-style pan: the ground point that was under the cursor stays under it
      g.camera.updateMatrixWorld(); const p = R3D.ground(g.camera, 0); if (p && sc.pan.g) { g.tx += sc.pan.g.x - p.x; g.tz += sc.pan.g.z - p.z; }
    }
    g.tx = Math.max(-14, Math.min(GX + 14, g.tx)); g.tz = Math.max(-14, Math.min(GY + 14, g.tz));
  };
  B.startPan = sc => { if (!g) init(); g.camera.updateMatrixWorld(); const p = R3D.ground(g.camera, 0); sc.pan = { g: p }; };
  B.startRot = sc => { if (!g) init(); sc.rot = { x: mouse.x, y: mouse.y, yaw: g.yaw, pitch: g.pitch }; };

  // ---------------------------------------------------------------- one frame
  const sky = { day: new THREE.Color('#8db7dc'), night: new THREE.Color('#04060d'), dusk: new THREE.Color('#e08a5a'), grey: new THREE.Color('#7f8a94'), tmp: new THREE.Color() };
  B.frame = (sc, dt, time, hover) => {
    if (!g) init();
    g.t += dt; const raid = sc.raid, dk = darkness(save.clock), wx = save.weather, wf = { sunny: 1, partly: .85, cloudy: .55, storm: .38 }[wx] || 1, cam = g.camera;
    // sky and light
    const day = 1 - dk, dusk = Math.sin(Math.min(1, dk) * Math.PI) * .35 * (dk < .98 ? 1 : 0);
    sky.tmp.copy(sky.day).lerp(sky.grey, 1 - wf).lerp(sky.night, dk).lerp(sky.dusk, dusk); g.scene.background.copy(sky.tmp); g.scene.fog.color.copy(sky.tmp); g.scene.fog.near = wx === 'storm' ? 40 : 70; g.scene.fog.far = wx === 'storm' ? 120 : 200;
    g.hemi.intensity = .42 + 1.1 * day * wf; g.hemi.color.set(dk > .5 ? '#4a5a96' : '#dfeaf8'); g.hemi.groundColor.set(dk > .5 ? '#05070c' : '#6a6a50');
    const th = Math.max(0, Math.min(1, (save.clock - 6) / 14)) * Math.PI;
    g.sun.position.set(GX / 2 - Math.cos(th) * 42, Math.sin(th) * 38 + 5, GY / 2 + 10); g.sun.intensity = 2.5 * Math.max(0, day - .08) * wf; g.sun.color.set(dusk > .1 ? '#ffc890' : '#fff1d6');
    g.moon.intensity = .85 * dk;
    const lit = dk > .35;
    g.win.emissiveIntensity = lit && alive().length ? .9 : 0; g.porch.intensity = lit ? 2.6 : 0;
    const powered = powerAvail() > 0; g.elec.emissiveIntensity = powered ? 1 : 0;
    g.rain.obj.visible = wx === 'storm';
    if (wx === 'storm') { const p = g.rain.pos; for (let i = 0; i < g.rain.n; i++) { const o = i * 6; p[o + 1] -= 28 * dt; p[o + 4] -= 28 * dt; if (p[o + 1] < 0) { p[o + 1] += 30; p[o + 4] += 30; } } g.rain.obj.geometry.attributes.position.needsUpdate = true; }

    // buildings: rebuild only what changed
    const seen = new Set(); let flood = 0;
    for (const b of save.buildings) {
      seen.add(b); const sig = sigOf(b); let r = g.recs.get(b);
      if (!r || r.sig !== sig) { if (r) { g.bldRoot.remove(r.grp); R3D.disposeTree(r.grp); } const grp = makeBuilding(b); grp.userData.b = b; r = { grp, sig, head: grp.userData.head }; g.recs.set(b, r); g.bldRoot.add(grp); }
      if (b.t === 'turret' && r.head) {
        let tgt = null, td = 99; if (raid) for (const z of raid.zombies) { const d = Math.hypot(z.x - b.gx - .5, z.y - b.gy - .5); if (d < td && d < 10) { td = d; tgt = z; } }
        if (tgt) r.head.rotation.y = -Math.atan2(tgt.y - b.gy - .5, tgt.x - b.gx - .5);
      }
      if (b.t === 'floodlight' && lit && powered && flood < 4) { const L = g.flood[flood++]; L.position.set(b.gx + .5, 2.2, b.gy + .5); L.intensity = 3.4; }
    }
    for (; flood < 4; flood++) g.flood[flood].intensity = 0;
    g.lamp.emissiveIntensity = lit && powered ? 1.3 : 0;
    for (const [b, r] of g.recs) if (!seen.has(b)) { g.bldRoot.remove(r.grp); R3D.disposeTree(r.grp); g.recs.delete(b); }
    // the house burns when it is nearly gone
    const fires = [];
    if (save.houseHp < 30) { const h = save.buildings.find(b => b.t === 'house'); if (h) fires.push([h.gx + 1, 2.4, h.gy + 3, 1.3], [h.gx + 3, 2.2, h.gy + 6, 1.1]); }
    // vehicles
    const vl = save.vehicles.slice(0, FLEET_MAX);
    for (const [v, m] of g.vehs) if (!vl.includes(v)) { g.ents.remove(m); g.vehs.delete(v); }
    vl.forEach((v, i) => { let m = g.vehs.get(v); if (!m) { m = makeVehicle(v); g.vehs.set(v, m); g.ents.add(m); } const [cx, cy] = FLEET_SLOTS[i]; m.position.set((cx + VEHICLE_TYPES[v.type].len / 2) * GSCALE, 0, (cy + .45) * GSCALE); });
    // the crew, standing about in the yard
    const crew = alive();
    for (const [c, m] of g.crew) if (!crew.includes(c)) { g.ents.remove(m); g.crew.delete(c); }
    crew.forEach((c, i) => {
      let m = g.crew.get(c); if (!m) { m = crewMesh(c); g.crew.set(c, m); g.ents.add(m); }
      const gx = 9.2 + (i % 4) * .6, gy = 18.4 + Math.floor(i / 4) * 1.6 + (i % 4) * .7; m.position.set(gx, 0, gy); m.rotation.y = -1.2 + Math.sin(g.t * .5 + i) * .4; R3D.pose(m, g.t * .15 + i, 0, {});
      m.userData.head.rotation.y = Math.sin(g.t * .7 + i * 2) * .5;
    });

    // the raid
    const sync = (map, list, make, upd, onGone) => {
      const s = new Set();
      for (const o of list) { let r = map.get(o); if (!r) { r = make(o); map.set(o, r); g.ents.add(r); } upd(r, o); s.add(o); }
      for (const [o, r] of map) if (!s.has(o)) { g.ents.remove(r); r.userData.mats.forEach(x => x.dispose()); if (onGone) onGone(o, r); map.delete(o); }
    };
    sync(g.zs, raid ? raid.zombies : [], attackerMesh, (r, z) => {
      const u = r.userData, sp = Math.hypot(z.x - (u.lx ?? z.x), z.y - (u.ly ?? z.y)) / Math.max(.001, dt); u.lx = z.x; u.ly = z.y;
      r.position.set(z.x, 0, z.y); const hx = save.buildings.find(b => b.t === 'house'), a = Math.atan2(hx.gy + hx.h / 2 - z.y, hx.gx + hx.w / 2 - z.x); r.rotation.y = -a;
      R3D.pose(r, g.t * (z.v || 1.4) * .55 + z.ph * 6, Math.min(1, sp / 1.4), z.raider ? {} : { chase: true });
      R3D.tint(r, z.burnT > 0 ? '#ff7a20' : '#ff3a2a', z.burnT > 0 ? .8 : z.hitT > 0 ? .9 : 0);
      if (z.slowT > 0) r.rotation.z = Math.sin(g.t * 30) * .03;
    }, (z, r) => { for (let i = 0; i < 9; i++) g.fx.push({ x: z.x, y: .5 + Math.random() * .6, z: z.y, vx: (Math.random() - .5) * 3, vy: Math.random() * 3, vz: (Math.random() - .5) * 3, l: .5 + Math.random() * .3, c: z.raider ? '#fa6' : '#7c3' }); });
    // shots: tracers between the shooter and the target, a flash where the player hit
    g.tracers.begin(); g.hits.begin();
    if (raid) for (const s of raid.shots) {
      if (s.g) { const [x1, y1, h1, x2, y2, h2] = s.g, a = new THREE.Vector3(x1, h1, y1), b2 = new THREE.Vector3(x2, h2, y2), m = g.tracers.next(), len = a.distanceTo(b2);
        m.position.copy(a).add(b2).multiplyScalar(.5); m.lookAt(b2); m.scale.set(s.c === '#9d4' ? .12 : .05, s.c === '#9d4' ? .12 : .05, len); m.material.color.set(s.c || '#ffe888'); }
      else if (s.gx !== undefined) { const h = g.hits.next(); h.position.set(s.gx, .7, s.gy); h.scale.setScalar(.8 + (.15 - s.l) * 8); }
    }
    g.tracers.end(); g.hits.end();
    // fires, blasts
    g.flames.begin(); let fi = 0;
    if (raid) for (const f of raid.fires) {
      const k = Math.min(1, f.l / 1.2);
      for (let i = 0; i < 7; i++) { const an = i * 2.4 + f.x, rr = 1.1 * ((i % 3) + 1) / 3, fl = g.flames.next(); fl.position.set(f.x + Math.cos(an) * rr, 0, f.y + Math.sin(an) * rr); const s2 = .32 * k; fl.scale.set(s2, s2 * 1.5, s2); R3D.flicker(fl, g.t, i); }
      if (fi < 2) { const L = g.fireL[fi++]; L.position.set(f.x, 1.5, f.y); L.intensity = 3.5 * k; }
    }
    if (raid) for (const z of raid.zombies) if (z.burnT > 0) { const fl = g.flames.next(); fl.position.set(z.x, .5, z.y); fl.scale.setScalar(.35); R3D.flicker(fl, g.t, z.ph * 5); }
    for (const [x, y, z, s2] of fires) { const fl = g.flames.next(); fl.position.set(x, y, z); fl.scale.setScalar(s2 * .5); R3D.flicker(fl, g.t, x); if (fi < 2) { const L = g.fireL[fi++]; L.position.set(x, y + 1, z); L.intensity = 2.5; } }
    g.flames.end(); for (; fi < 2; fi++) g.fireL[fi].intensity = 0;
    g.blasts.begin(); let bl = 0;
    if (raid) for (const b2 of raid.blasts) { const pr = Math.min(1, 1 - b2.l / .5), m = g.blasts.next(); m.position.set(b2.x, .8, b2.y); m.scale.setScalar(1 + pr * 3.4); m.material.opacity = Math.max(0, .85 * (1 - pr)); bl = Math.max(bl, 1 - pr); g.blastL.position.set(b2.x, 3, b2.y); }
    g.blasts.end(); g.blastL.intensity = bl * 28;
    // particles
    for (const p of g.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 9 * dt; p.l -= dt; if (p.y < .05) { p.y = .05; p.vy = 0; p.vx *= .8; p.vz *= .8; } }
    g.fx = g.fx.filter(p => p.l > 0); g.parts.userData.set(g.fx, p => [p.x, p.y, p.z, p.c]);

    // hover: the ghost of what a click would place, and highlighted cells for upgrade / repair / sell
    g.cells.begin();
    if (g.ghost) { g.ents.remove(g.ghost); g.ghost = null; }
    if (hover && !raid) {
      const { gx, gy, tool, ok, obj } = hover, cellQ = (x, y, c, o) => { const m = g.cells.next(); m.position.set(x + .5, .08, y + .5); m.material.color.set(c); m.material.opacity = o; };
      if (obj) { const c = hover.ok === false ? '#ff5a5a' : tool === 'sell' ? '#ffaa3c' : tool === 'upgrade' ? '#5ac8ff' : '#5aff8c'; for (let i = 0; i < obj.w; i++) for (let j = 0; j < obj.h; j++) cellQ(obj.gx + i, obj.gy + j, c, .42); }
      else if (KINDS[tool] && !['upgrade', 'repair', 'sell'].includes(tool)) {
        cellQ(gx, gy, ok ? '#78ffa0' : '#ff6464', .38);
        if (ok) { const key = tool + '|' + hover.dir; let gh = g.ghosts.get(key); if (!gh) { gh = makeBuilding({ t: tool, gx: 0, gy: 0, w: 1, h: 1, hp: 99, dir: hover.dir, lvl: 0 }, true); g.ghosts.set(key, gh); } gh.position.set(gx, 0, gy); g.ents.add(gh); g.ghost = gh; }
      }
    }
    g.cells.end();

    // camera
    const sh = (sc.shake || 0) > 0 && SET.shake ? sc.shake * .5 * SET.shake : 0, cp = Math.cos(g.pitch) * g.dist;
    cam.position.set(g.tx + Math.sin(g.yaw) * cp + (sh ? (Math.random() - .5) * sh : 0), Math.sin(g.pitch) * g.dist + (sh ? (Math.random() - .5) * sh : 0), g.tz + Math.cos(g.yaw) * cp);
    cam.lookAt(g.tx, 0, g.tz);
    R3D.show(true); R3D.render(g.scene, cam);
    B.overlay(sc, raid);
  };

  // ---------------------------------------------------------------- labels and health bars drawn in 2D on top
  B.overlay = (sc, raid) => {
    const cam = g.camera;
    for (const b of save.buildings) {
      const frac = b.t === 'house' ? save.houseHp / 100 : b.hp / maxHp(b), top = (HT[b.t] ? HT[b.t][0] + HT[b.t][1] : 1.3) + .6;
      if (['house', 'workshop', 'greenhouse', 'gazebo'].includes(b.t)) { const q = R3D.toUI(b.gx + b.w / 2, top + .6, b.gy + b.h / 2, cam); if (q) text(KINDS[b.t].label, q.x, q.y, 11, '#cfe', 'center'); }
      if (frac < 1 && b.t !== 'garden') { const q = R3D.toUI(b.gx + b.w / 2, top, b.gy + b.h / 2, cam); if (q) { ctx.fillStyle = '#300'; ctx.fillRect(q.x - 12, q.y, 24, 3); ctx.fillStyle = frac < .4 ? RED : GREEN; ctx.fillRect(q.x - 12, q.y, 24 * Math.max(0, frac), 3); } }
    }
    if (!raid) alive().forEach(c => { const m = g.crew.get(c); if (m && g.dist < 30) { const q = R3D.toUI(m.position.x, 1.5, m.position.z, cam); if (q) text(c.name, q.x, q.y, 9, '#cfe', 'center'); } });
    if (raid && !raid.result) { const rx = mouse.cx / UI.scale - UI.ox, ry = mouse.cy / UI.scale - UI.oy; if (!sc.overUI()) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx, ry, 9, 0, 7); ctx.moveTo(rx - 14, ry); ctx.lineTo(rx - 5, ry); ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 14, ry); ctx.moveTo(rx, ry - 14); ctx.lineTo(rx, ry - 5); ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 14); ctx.stroke(); } }
    // red edge when the house is in trouble
    if (raid && save.houseHp < 40) { const hv = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); hv.addColorStop(0, 'rgba(160,0,0,0)'); hv.addColorStop(1, `rgba(190,10,10,${.25 + Math.sin(g.t * 5) * .08})`); ctx.fillStyle = hv; ctx.fillRect(0, 0, W, H); }
  };
  return B;
})();
