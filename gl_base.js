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
      const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = hash(x, z) * 6;
      R3D.mesh(R3D.cyl(.1 * sc2, .21 * sc2, 1.7 * sc2, 9), R3D.mat('#5a3d22'), 0, .85 * sc2, 0, t); R3D.mesh(R3D.cyl(.25 * sc2, .3 * sc2, .2 * sc2, 9), R3D.mat('#4a3219'), 0, .1 * sc2, 0, t);
      for (const [dx, dz, ry] of [[.35, 0, -.9], [-.3, .2, .8], [0, -.35, .2]]) { const br = R3D.mesh(R3D.cyl(.035 * sc2, .06 * sc2, .9 * sc2, 6), R3D.mat('#5a3d22'), dx * sc2, 1.6 * sc2, dz * sc2, t); br.rotation.z = dx > 0 ? -.8 : dx < 0 ? .8 : 0; br.rotation.x = dz * 1.6; }
      const greens = ['#2f6a2a', '#3a7a30', '#2a5e26', '#44883a', '#356f2c'];
      for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = i ? .75 : 0, c = R3D.mesh(R3D.blob((i ? .62 : 1.0) * sc2, i), R3D.mat(greens[i % 5]), Math.cos(a) * rr * sc2, (2.0 + (i % 3) * .3 + (i ? 0 : .35)) * sc2, Math.sin(a) * rr * sc2, t); c.rotation.y = i; }
      sc.add(t);
    };
    for (const [x, y] of TREES) tree(x * GSCALE, y * GSCALE, 1);
    for (const [x, y, s2] of TREES_FAR) tree(x * GSCALE, y * GSCALE, s2 * 1.1);
    for (const [x, y] of BUSHES) for (let i = 0; i < 3; i++) { const bu = R3D.mesh(R3D.blob(.34 - i * .04, i + 9), R3D.mat(['#3a7a32', '#2f6a2a', '#44883a'][i]), x * GSCALE + Math.cos(i * 2.1) * .28, .28, y * GSCALE + Math.sin(i * 2.1) * .28, sc); }
    for (const [x, y] of PILES) { const p = new THREE.Group(); p.position.set(x * GSCALE, 0, y * GSCALE); for (let i = 0; i < 4; i++) R3D.mesh(R3D.box(1.1, .08, .6), R3D.mat('#d8d6b8'), 0, .06 + i * .09, 0, p).rotation.y = i * .1; R3D.mesh(R3D.box(.7, .25, .4), R3D.mat('#3a6a8a'), 1.1, .35, .1, p); sc.add(p); }
    for (const [x, y, c] of CATS) { const k = new THREE.Group(); k.position.set(x * GSCALE, 0, y * GSCALE); R3D.mesh(R3D.box(.34, .16, .14), R3D.mat(c), 0, .12, 0, k); R3D.mesh(R3D.box(.14, .14, .14), R3D.mat(c), .2, .2, 0, k); sc.add(k); }
    { const keep = new Set(sc.children.filter(c => c.isGroup)); const scen = new THREE.Group(); for (const c of keep) { sc.remove(c); scen.add(c); } scen.updateMatrixWorld(true); R3D.merge(scen); sc.add(scen); }   // trees, bushes, piles, cats: one batch
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
      const pz = z0 + (z1 - z0) * (i + .5) / rows, px = w / 2 + sd * (span / 2 - .05), fr = R3D.mesh(R3D.box(len * .9, .045, (z1 - z0) / rows * .92), R3D.mat('#aeb4ba'), px, H + rh / 2 + .06, pz, p, false), m = R3D.mesh(R3D.box(len * .84, .06, (z1 - z0) / rows * .84), R3D.mat('#15305c'), px, H + rh / 2 + .075, pz, p, false);
      fr.rotation.z = sd < 0 ? ang : -ang;
      for (let c = 1; c < 3; c++) { const ln = R3D.mesh(R3D.box(len * .84, .065, .02), R3D.mat('#4a6aa0'), px, H + rh / 2 + .078, pz + ((z1 - z0) / rows * .84) * (c / 3 - .5), p, false); ln.rotation.z = sd < 0 ? ang : -ang; }
      m.rotation.z = sd < 0 ? ang : -ang;
    }
  };
  const windows = (p, w, d, H) => {
    const win = g.win, fr = R3D.mat('#e8e6de'), one = (x, z, alongX) => {   // frame, glass, mullions, sill, shutters
      const ww = alongX ? .78 : .1, dd = alongX ? .1 : .78, y = H * .55;
      R3D.mesh(R3D.box(ww + (alongX ? .1 : 0), .66, dd + (alongX ? 0 : .1)), fr, x, y, z, p, false);
      R3D.mesh(R3D.box(ww * (alongX ? .86 : 1.2), .54, dd * (alongX ? 1.2 : .86)), win, x, y, z, p, false);
      R3D.mesh(R3D.box(alongX ? .03 : .13, .54, alongX ? .13 : .03), fr, x, y, z, p, false); R3D.mesh(R3D.box(alongX ? .8 : .13, .03, alongX ? .13 : .8), fr, x, y, z, p, false);
      R3D.mesh(R3D.box(alongX ? .9 : .2, .05, alongX ? .2 : .9), R3D.mat('#bcbab2'), x + (alongX ? 0 : (x > 1 ? .05 : -.05)), y - .36, z + (alongX ? .05 : 0), p, false);
    };
    for (let i = 0; i < 4; i++) for (const sx of [0, w]) one(sx, d * (i + .5) / 4, false);
    for (const z of [.9, w - .9]) one(z, d, true);
  };
  const eaves = (p, w, d, H, rh, k) => {   // ridge cap, fascia boards, gutters
    R3D.mesh(R3D.box(.14, .1, d + .7), R3D.mat(col('#5a2018', k)), w / 2, H + rh + .02, d / 2, p);
    for (const sx of [-.3, w + .3]) { R3D.mesh(R3D.box(.08, .12, d + .7), R3D.mat('#e8e6de'), sx, H - .04, d / 2, p, false); R3D.mesh(R3D.cyl(.05, .05, d + .6, 8), R3D.mat('#8a8e92'), sx * (sx < 0 ? .85 : 1.0) + (sx < 0 ? .0 : 0), H - .16, d / 2, p, false).rotation.x = Math.PI / 2; }
    for (const z of [-.3, d + .3]) R3D.mesh(R3D.box(w + .7, .1, .08), R3D.mat('#e8e6de'), w / 2, H - .02, z, p, false);
  };

  const MODELS = {
    house(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.house, k = o.k;
      blk(p, 0, 0, 0, w, H, d, col('#b9bdb6', k)); roofOf(p, w, d, H, rh, col('#7a2e24', k));
      blk(p, w * .6, H + rh * .5, d * .25, .45, .9, .45, col('#8a8a86', k));   // chimney
      blk(p, 2.2, 0, d, .9, 1.35, .1, '#5a3a22'); blk(p, 1.9, 0, d, 1.5, .12, .5, '#8a8c8a');   // door + step
      windows(p, w, d, H); eaves(p, w, d, H, rh, k); panels(p, w, d, H, rh, .6, d - .6, 5);
      blk(p, 2.0, 0, d - .02, 1.1, 1.5, .06, '#e8e6de'); R3D.mesh(R3D.sphere(.04, 6), R3D.mat('#d8b030'), 2.95, .75, d + .12, p); blk(p, 1.9, 1.5, d - .02, 1.3, .08, .3, '#bcbab2');   // door frame, knob, canopy
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

  // ---- detailed versions of the outbuildings, defences and utilities (these replace the simple ones above)
  const frameWin = (p, x, y, z, alongX, w = .78, h = .55) => {   // window with frame, glass, mullion and sill
    const fr = R3D.mat('#e8e6de'), dx = alongX ? w : .1, dz = alongX ? .1 : w;
    R3D.mesh(R3D.box(dx + (alongX ? .1 : 0), h + .1, dz + (alongX ? 0 : .1)), fr, x, y, z, p, false);
    R3D.mesh(R3D.box(alongX ? w * .86 : .13, h, alongX ? .13 : w * .86), g.win, x, y, z, p, false);
    R3D.mesh(R3D.box(alongX ? .03 : .14, h, alongX ? .14 : .03), fr, x, y, z, p, false);
  };
  const cylH = (p, r, h, color, x, y, z, seg = 10) => R3D.mesh(R3D.cyl(r, r, h, seg), R3D.mat(color), x, y + h / 2, z, p);
  Object.assign(MODELS, {
    workshop(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.workshop, k = o.k;
      blk(p, -.04, 0, -.04, w + .08, .22, d + .08, col('#6a5a50', k));   // plinth
      blk(p, 0, .22, 0, w, H - .22, d, col('#a05038', k));
      for (let i = 1; i < 6; i++) blk(p, -.012, .22 + i * .2, -.012, w + .024, .018, d + .024, col('#7a3a28', k));   // brick courses
      for (const [x, z] of [[0, 0], [w - .14, 0], [0, d - .14], [w - .14, d - .14]]) blk(p, x - .01, 0, z - .01, .16, H, .16, col('#8a4430', k));
      roofOf(p, w, d, H, rh, col('#7a3a2a', k)); eaves(p, w, d, H, rh, k);
      // roller door with slats, frame, lamp
      blk(p, .85, 0, d - .03, 2.3, 1.3, .1, '#e0ddd4'); blk(p, 1, .06, d + .02, 2, 1.2, .06, '#7a7e82'); for (let i = 0; i < 8; i++) blk(p, 1, .08 + i * .15, d + .06, 2, .025, .03, '#52565a');
      blk(p, 1.9, 1.38, d + .02, .22, .14, .16, '#2a2a2a'); R3D.mesh(R3D.sphere(.06, 8), g.lamp, 2, 1.28, d + .14, p, false);
      for (let i = 0; i < 3; i++) frameWin(p, w + .03, H * .6, d * (i + .5) / 3, false, .7, .5);
      frameWin(p, w * .5 + 1.4, H * .6, d + .02, true, .6, .5);
      cylH(p, .09, .5, '#6a6e72', w * .2, H + rh * .6, d * .6); R3D.mesh(R3D.cyl(.13, .09, .06, 8), R3D.mat('#4a4e52'), w * .2, H + rh * .6 + .5, d * .6, p);   // roof vent stack
      blk(p, w + .02, .2, 1.1, .5, .35, .7, '#cfd2d4'); cylH(p, .13, .06, '#444', w + .27, .55, 1.45, 8);                  // AC unit
      cylH(p, .04, H, '#9a9ea2', w + .02, 0, d - .2, 6);                                                                  // downpipe
      for (let i = 0; i < 6; i++) cylH(p, .07, .5, '#8a5a32', -.4 + (i % 3) * .01, .1 + Math.floor(i / 3) * .15, 4.2 + (i % 3) * .16, 7).rotation.z = Math.PI / 2;   // firewood
      blk(p, -.9, 0, 5.4, .5, .6, 1.4, '#6a4a2a'); blk(p, -.88, .6, 5.4, .54, .06, 1.44, '#8a6a42'); blk(p, -.8, .66, 5.8, .2, .14, .3, '#3a3d40');   // workbench + vice
      panels(p, w, d, H, rh, .8, d - .8, 4);
    },
    greenhouse(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.greenhouse, k = o.k, metal = col('#c8d0d4', k);
      blk(p, -.04, 0, -.04, w + .08, .2, d + .08, col('#7a7f86', k));
      R3D.mesh(R3D.box(w - .1, H, d - .1), R3D.mat('#bfe6f6', { op: .26 }), w / 2, H / 2 + .2, d / 2, p, false);
      R3D.mesh(R3D.prism(w, rh, d), R3D.mat('#cdeefb', { op: .3 }), w / 2, H + .2, d / 2, p, false);
      for (let i = 0; i <= 8; i++) { const x = i * w / 8 - .025; blk(p, x, .2, -.02, .05, H, .05, metal); blk(p, x, .2, d - .03, .05, H, .05, metal); }
      for (let j = 0; j <= 4; j++) { const z = j * d / 4 - .025; blk(p, -.02, .2, z, .05, H, .05, metal); blk(p, w - .03, .2, z, .05, H, .05, metal); }
      for (const y of [.5, .85]) { blk(p, -.02, y, 0, .03, .03, d, metal); blk(p, w - .01, y, 0, .03, .03, d, metal); blk(p, 0, y, -.02, w, .03, .03, metal); blk(p, 0, y, d - .01, w, .03, .03, metal); }
      blk(p, w / 2 - .03, H + rh + .2, 0, .06, .06, d, metal);   // ridge beam
      for (let i = 0; i <= 4; i++) { const x = i * w / 4; const r1 = R3D.mesh(R3D.box(.04, Math.hypot(w / 2, rh) + .02, .04), R3D.mat(metal), x < w / 2 ? 0 : 0, 0, 0); r1.visible = false; }
      blk(p, w / 2 - .45, .2, d - .03, .9, H * .95, .05, '#aab4b8'); R3D.mesh(R3D.sphere(.04, 6), R3D.mat('#222'), w / 2 + .3, .75, d + .04, p, false);   // door + handle
      for (let r = 0; r < 3; r++) {   // raised beds with staked tomato plants and watering pipe
        const z = .55 + r * ((d - 1.1) / 2.5); blk(p, .35, .2, z - .22, w - .7, .22, .44, '#6a4a2a'); blk(p, .38, .4, z - .19, w - .76, .03, .38, '#3a2a1a');
        cylH(p, .02, w - .7, '#2a6aa0', .35 + (w - .7) / 2, .5, z + .05, 6).rotation.z = Math.PI / 2;
        for (let j = 0; j < Math.floor(w - .6); j++) { const hh = .35 + hash(j + b.gx, r + b.gy) * .3, x = .55 + j * (w - 1.1) / Math.max(1, Math.floor(w - .6) - 1); cylH(p, .012, hh + .15, '#7a5a32', x, .42, z, 4); R3D.mesh(R3D.blob(.14, j + r), R3D.mat(k < 1 ? '#4a5a2a' : '#3f9a3a'), x, .42 + hh * .6, z, p); if (k === 1) R3D.mesh(R3D.sphere(.045, 6), R3D.mat('#d03a2a'), x + .08, .42 + hh * .45, z + .06, p, false); }
      }
    },
    gazebo(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.gazebo, k = o.k;
      for (let i = 0; i < 6; i++) blk(p, 0, 0, i * d / 6, w, .1, d / 6 - .01, col(i % 2 ? '#8a6a46' : '#7e5e3c', k));   // plank floor
      for (const [x, z] of [[.1, .1], [w - .1, .1], [.1, d - .1], [w - .1, d - .1]]) { cylH(p, .06, H - .1, col('#8a5a3a', k), x, .1, z, 8); cylH(p, .09, .08, col('#6a4426', k), x, .1, z, 8); cylH(p, .085, .08, col('#6a4426', k), x, H - .08, z, 8); }
      for (const [x0, z0, x1, z1] of [[.1, .1, w - .1, .1], [.1, d - .1, w - .1, d - .1], [.1, .1, .1, d - .1], [w - .1, .1, w - .1, d - .1]]) { blk(p, Math.min(x0, x1) - .02, .55, Math.min(z0, z1) - .02, Math.abs(x1 - x0) + .04, .05, Math.abs(z1 - z0) + .04, col('#7a4e2c', k)); blk(p, Math.min(x0, x1) - .02, H - .1, Math.min(z0, z1) - .02, Math.abs(x1 - x0) + .04, .1, Math.abs(z1 - z0) + .04, col('#6a4426', k)); }
      const r = R3D.mesh(R3D.cone(w * .88, rh, 4), R3D.mat(col('#b0452f', k)), w / 2, H + rh / 2, d / 2, p); r.rotation.y = Math.PI / 4;
      const r2 = R3D.mesh(R3D.cone(w * .9, rh * .1, 4), R3D.mat(col('#8a3322', k)), w / 2, H + .03, d / 2, p); r2.rotation.y = Math.PI / 4; cylH(p, .03, .3, '#d8b030', w / 2, H + rh, d / 2, 6);
      blk(p, .45, .1, .7, w - .9, .28, .32, col('#6a4a2a', k)); blk(p, .4, .38, .62, w - .8, .05, .45, col('#7a5a36', k));   // bench
      blk(p, w / 2 - .3, .1, d / 2 + .1, .6, .42, .6, col('#6a4a2a', k)); R3D.mesh(R3D.cyl(.4, .4, .04, 12), R3D.mat('#8a6a42'), w / 2, .55, d / 2 + .4, p);   // table
      cylH(p, .01, .3, '#222', w / 2, H - .32, d / 2, 4); R3D.mesh(R3D.sphere(.08, 8), g.win, w / 2, H - .36, d / 2, p, false);   // lantern
    },
    barn(b, o, p) {
      const w = b.w, d = b.h, [H, rh] = HT.barn, k = o.k;
      blk(p, -.03, 0, -.03, w + .06, .25, d + .06, col('#7a746a', k)); blk(p, 0, .25, 0, w, H - .25, d, col('#b0a290', k));
      for (let i = 1; i < d; i += 1) blk(p, -.012, .25, i, w + .024, H - .25, .02, col('#9a8c7a', k));   // board seams
      roofOf(p, w, d, H, rh, col('#c4622e', k), .15); eaves(p, w, d, H, rh, k);
      for (let i = 0; i < 6; i++) frameWin(p, w + .03, H * .6, 1 + i * 3.1 + .4, false, .8, .55);
      blk(p, w - .02, 0, 14, .08, 1.3, 2.2, '#5a4a38'); blk(p, w - .04, 0, 14, .04, 1.3, .05, '#2a2a2a'); blk(p, w - .04, 0, 15.15, .04, 1.3, .05, '#2a2a2a'); blk(p, w - .04, .6, 14, .04, .05, 2.2, '#2a2a2a');
      for (let i = 0; i < 4; i++) cylH(p, .05, H + .1, '#8a8e92', w + .02, 0, 4 + i * 5, 6);
      for (let i = 0; i < 3; i++) blk(p, w + .1, .08 * i, 22 - 0, 0, 0, 0, '#000');
    },
    gate(b, o, p) {
      const w = b.w, lvl = b.lvl || 0, H = 1.15, steel = lvl >= 1, pc = lvl >= 2 ? '#46586a' : '#566a7c';
      for (const x of [-.05, w - .17]) { blk(p, x, 0, .33, .22, H + .25, .34, '#c8c8c0'); blk(p, x - .03, H + .25, .3, .28, .07, .4, '#a8a8a0'); blk(p, x + .03, .5, .28, .04, .1, .08, '#222'); }
      for (const half of [0, 1]) {
        const x0 = .2 + half * (w / 2 - .02), x1 = w / 2 - .05 + half * (w / 2 - .02), hx = half ? x1 : x0;
        if (steel) { blk(p, x0, .1, .47, x1 - x0, H - .1, .06, pc); for (let i = 0; i < 5; i++) for (const y of [.18, H - .18]) R3D.mesh(R3D.sphere(.02, 5), R3D.mat('#aab'), x0 + (x1 - x0) * (i + .5) / 5, y, .51, p, false); const br = blk(p, x0, .1, .52, Math.hypot(x1 - x0, H - .3), .04, .03, '#8a98a8'); br.rotation.z = Math.atan2(H - .3, x1 - x0); br.position.set((x0 + x1) / 2, H / 2, .52); }
        else for (let i = 0; i <= 9; i++) { blk(p, x0 + (x1 - x0) * i / 9 - .02, .1, .48, .04, H - .1, .04, '#3a3f46'); R3D.mesh(R3D.cone(.035, .1, 4), R3D.mat('#3a3f46'), x0 + (x1 - x0) * i / 9, H + .04, .5, p); }
        blk(p, x0, .3, .47, x1 - x0, .05, .06, '#8a98a8'); blk(p, x0, H - .15, .47, x1 - x0, .05, .06, '#8a98a8'); blk(p, hx - .03, .55, .44, .1, .12, .12, '#d8b030');
        if (lvl >= 2) for (let i = 0; i < 9; i++) R3D.mesh(R3D.cone(.045, .22, 4), R3D.mat('#ccc'), x0 + (x1 - x0) * (i + .5) / 9, H + .08, .5, p);
        if (lvl >= 3) { for (const i of [0, 1]) blk(p, x0, H + .3 + i * .14, .47, x1 - x0, .035, .035, '#567').material = g.elec; for (let i = 0; i < 4; i++) blk(p, x0 + (x1 - x0) * i / 3 - .02, H + .26, .46, .04, .3, .04, '#eee'); }
      }
    },
    generator(b, o, p) {
      const k = o.k; blk(p, .08, .1, .12, .84, .6, .76, col('#c8861a', k)); blk(p, .02, .06, .08, .96, .06, .84, '#2a2a2a'); for (const [x, z] of [[.12, .12], [.8, .12], [.12, .8], [.8, .8]]) cylH(p, .06, .08, '#111', x, 0, z, 8);
      cylH(p, .12, .08, '#a02020', .7, .7, .3, 8); blk(p, .12, .7, .15, .3, .14, .5, '#8a5a10'); cylH(p, .05, .3, '#444', .25, .7, .72, 6); R3D.mesh(R3D.cyl(.07, .07, .05, 8), R3D.mat('#222'), .25, 1.02, .72, p);
      blk(p, .76, .3, .2, .06, .3, .4, '#222'); R3D.mesh(R3D.sphere(.025, 5), R3D.basic('#3d3'), .8, .56, .3, p, false); blk(p, .84, .12, .55, .12, .26, .1, '#222');
    },
    powerbox(b, o, p) {
      const k = o.k; blk(p, .18, 0, .22, .64, 1.15, .52, col('#cfd4d8', k)); blk(p, .15, 1.15, .2, .7, .06, .56, '#a8acb0'); blk(p, .15, 0, .2, .7, .08, .56, '#7a7e82');
      for (let i = 0; i < 6; i++) blk(p, .25, .22 + i * .05, .745, .5, .02, .02, '#8a8e92');
      blk(p, .3, .78, .745, .28, .17, .02, '#0a1a10'); blk(p, .33, .85, .76, .2, .03, .01, '#3d3').material = new THREE.MeshBasicMaterial({ color: '#4f6' }); blk(p, .62, .55, .745, .05, .1, .03, '#555');
      cylH(p, .04, .9, '#3a3d40', .2, 0, .2, 6); cylH(p, .04, .5, '#3a3d40', .2, 1.0, .2, 6).rotation.z = Math.PI / 2;
    },
    well(b, o, p) {
      const k = o.k; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; blk(p, .5 + Math.cos(a) * .4 - .1, 0, .5 + Math.sin(a) * .4 - .09, .2, .28, .18, col(i % 2 ? '#8a8d90' : '#797c80', k)).rotation.y = -a; blk(p, .5 + Math.cos(a) * .4 - .1, .28, .5 + Math.sin(a) * .4 - .09, .2, .26, .18, col(i % 2 ? '#797c80' : '#8a8d90', k)).rotation.y = -a; }
      R3D.mesh(R3D.cyl(.3, .3, .02, 12), R3D.mat('#07151c'), .5, .5, .5, p);
      for (const x of [.04, .86]) blk(p, x, 0, .44, .1, 1.1, .12, col('#7a5a3a', k)); blk(p, .02, 1.05, .43, .96, .1, .14, col('#6a4a2a', k));
      const r1 = R3D.mesh(R3D.box(.7, .04, .95), R3D.mat(col('#8a5a3a', k)), .27, 1.28, .5, p); r1.rotation.z = .75; const r2 = R3D.mesh(R3D.box(.7, .04, .95), R3D.mat(col('#8a5a3a', k)), .73, 1.28, .5, p); r2.rotation.z = -.75;
      cylH(p, .03, .9, '#5a4020', .5, .4, .5, 5).rotation.z = Math.PI / 2; blk(p, .93, .8, .52, .18, .04, .04, '#5a4020'); cylH(p, .06, .12, '#aaa', .5, .38, .5, 8); cylH(p, .008, .5, '#c8b890', .5, .55, .5, 4);
    },
    tank(b, o, p) {
      const k = o.k, c = col('#4a6a8a', k); for (const [x, z] of [[.2, .2], [.8, .2], [.2, .8], [.8, .8]]) blk(p, x - .03, 0, z - .03, .06, .22, .06, '#5a5e62');
      cylH(p, .4, 1.0, c, .5, .2, .5, 20); for (const y of [.4, .75, 1.05]) R3D.mesh(R3D.cyl(.415, .415, .035, 20), R3D.mat(col('#3a5a7a', k)), .5, y, .5, p);
      R3D.mesh(R3D.cone(.4, .18, 20), R3D.mat(col('#7aa0c4', k)), .5, 1.29, .5, p); cylH(p, .07, .06, '#222', .5, 1.37, .5, 8);
      cylH(p, .03, .16, '#222', .5, .28, .93, 6).rotation.x = Math.PI / 2; blk(p, .46, .22, .9, .08, .06, .08, '#c03a2a'); blk(p, .84, .35, .4, .03, .7, .06, '#e8e8e0'); blk(p, .84, .35 + .35, .4, .04, .02, .08, '#3a8ad0');
    },
    floodlight(b, o, p) {
      cylH(p, .13, .06, '#666', .5, 0, .5, 8); cylH(p, .05, 2.3, '#8a8f96', .5, .06, .5, 8); for (const [dx, dz] of [[.17, 0], [-.17, 0], [0, .17], [0, -.17]]) { const br = blk(p, .5 + dx - .015, .1, .5 + dz - .015, .03, .55, .03, '#7a7e84'); br.rotation.z = dz ? 0 : (dx > 0 ? .5 : -.5); br.rotation.x = dx ? 0 : (dz > 0 ? -.5 : .5); }
      blk(p, .3, 2.3, .3, .4, .06, .4, '#555'); blk(p, .32, 2.36, .55, .36, .26, .22, '#2e3237'); for (let i = 0; i < 4; i++) blk(p, .34 + i * .08, 2.62, .56, .03, .04, .2, '#3a3e44'); blk(p, .34, 2.38, .76, .32, .2, .03, '#fff').material = g.lamp;
    },
    wire(b, o, p) {
      for (const x of [.04, .5, .96]) { cylH(p, .025, .45, '#6a6a6a', x, 0, .5, 6); R3D.mesh(R3D.sphere(.035, 5), R3D.mat('#555'), x, .46, .5, p, false); }
      for (let i = 0; i < 7; i++) { const t = R3D.mesh(new THREE.TorusGeometry(.14, .012, 5, 12), R3D.mat('#b8b8b8'), .08 + i * .14, .17, .5 + (i % 2 ? .05 : -.05), p, false); t.rotation.y = Math.PI / 2; }
      for (let i = 0; i < 12; i++) { const sp = R3D.mesh(R3D.box(.012, .06, .012), R3D.mat('#999'), .06 + i * .08, .17 + .14 * ((i % 3) - 1) * .5, .5 + (i % 2) * .08 - .04, p, false); sp.rotation.z = i; }
    },
    pit(b, o, p) {
      blk(p, .05, 0, .05, .9, .03, .9, '#0a0604'); for (const [x, z, w2, d2] of [[0, 0, 1, .07], [0, .93, 1, .07], [0, 0, .07, 1], [.93, 0, .07, 1]]) blk(p, x, 0, z, w2, .08, d2, '#6a5236');
      for (let i = 0; i < 9; i++) R3D.mesh(R3D.cone(.04, .3, 4), R3D.mat('#9aa0a6'), .2 + (i % 3) * .3, .06, .2 + Math.floor(i / 3) * .3, p, false);
      for (let i = 0; i < 4; i++) { const br = blk(p, .12 + i * .22, .08, .45, .1, .02, .1, '#6a4a2a'); br.rotation.y = i * .7; }
    },
    mine(b, o, p) {
      cylH(p, .26, .06, '#444', .5, 0, .5, 14); cylH(p, .2, .05, '#6a6e72', .5, .06, .5, 14); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; R3D.mesh(R3D.cone(.025, .08, 4), R3D.mat('#222'), .5 + Math.cos(a) * .15, .14, .5 + Math.sin(a) * .15, p, false); }
      R3D.mesh(R3D.sphere(.04, 6), R3D.basic('#f33'), .5, .12, .5, p, false);
    },
    garden(b, o, p) {
      blk(p, 0, 0, 0, 1, .14, 1, '#6a4a2a'); blk(p, .05, .12, .05, .9, .04, .9, '#3a2a1a');
      for (let i = 0; i < 6; i++) { const x = .22 + (i % 2) * .56, z = .16 + Math.floor(i / 2) * .34, hh = .22 + hash(b.gx * 3 + i, b.gy) * .2; cylH(p, .012, hh, '#4a7a2a', x, .15, z, 4); for (let l = 0; l < 3; l++) { const lf = R3D.mesh(R3D.box(.14, .01, .06), R3D.mat(o.k < 1 ? '#5a6a2a' : '#3f9a3a'), x + Math.cos(l * 2.1) * .06, .15 + hh * (.5 + l * .15), z + Math.sin(l * 2.1) * .06, p, false); lf.rotation.y = l * 2.1; lf.rotation.z = .3; } R3D.mesh(R3D.sphere(.04, 6), R3D.mat(['#d03a2a', '#e8b030', '#8a3ab0'][i % 3]), x, .15 + hh, z, p, false); }
    },
    fence(b, o, p) {
      const lvl = b.lvl || 0, k = o.k, along = b.dir === 'y', q = new THREE.Group(); q.position.set(.5, 0, .5); if (along) q.rotation.y = Math.PI / 2; p.add(q);
      const X = (x, y, z, w, h, d, c, op) => R3D.mesh(R3D.box(w, h, d), R3D.mat(c, op), x, y + h / 2, z, q);
      if (lvl === 0) {
        const tone = ['#7a5a36', '#6e4f2e', '#85633c'][Math.floor(hash(b.gx, b.gy) * 3)];
        for (let i = 0; i < 6; i++) { const hh = .7 + hash(b.gx + i, b.gy) * .12; X(-.4 + i * .16, .03, 0, .13, hh, .05, col(i % 2 ? tone : '#6a4a2a', k)); R3D.mesh(R3D.cone(.065, .08, 4), R3D.mat(col(i % 2 ? tone : '#6a4a2a', k)), -.4 + i * .16, .03 + hh + .04, 0, q).rotation.y = Math.PI / 4; }
        X(0, .18, .045, 1, .06, .04, col('#4a3220', k)); X(0, .5, .045, 1, .06, .04, col('#4a3220', k)); X(-.5, 0, 0, .1, .95, .1, col('#5a3e20', k)); X(-.5, .95, 0, .12, .04, .12, col('#4a3220', k));
      } else if (lvl === 1) {
        X(0, .05, 0, 1, .85, .012, col('#c0ccd4', k), { op: .3 });
        for (let i = 0; i < 6; i++) { const d1 = X(-.4 + i * .17, .05, 0, .012, .95, .014, col('#b8c2ca', k)); d1.rotation.z = .8; }
        X(0, .9, 0, 1, .04, .04, col('#b8c2ca', k)); X(0, .04, 0, 1, .025, .03, col('#b8c2ca', k)); X(-.5, 0, 0, .06, 1, .06, col('#9aa4ac', k)); R3D.mesh(R3D.sphere(.04, 6), R3D.mat('#9aa4ac'), -.5, 1.02, 0, q);
      } else {
        X(0, 0, 0, 1, 1.15, .13, col('#a4a6a8', k)); for (const y of [.3, .6, .9]) X(0, y, .067, 1, .015, .01, '#6a6c6e'); X(0, 0, .067, .02, 1.15, .01, '#6a6c6e'); X(0, 0, 0, 1.0, .1, .16, col('#8a8c8e', k)); X(0, 1.12, 0, 1.02, .06, .16, col('#8a8c8e', k));
        X(-.5, 0, 0, .12, 1.3, .16, col('#6a6e74', k));
        if (lvl === 2) { for (let i = 0; i < 4; i++) { const c2 = R3D.mesh(new THREE.TorusGeometry(.07, .008, 4, 10), R3D.mat('#b8b8b8'), -.36 + i * .24, 1.28, 0, q, false); c2.rotation.y = Math.PI / 2; } X(0, 1.22, 0, 1, .015, .015, '#b8b8b8'); X(0, 1.34, 0, 1, .015, .015, '#b8b8b8'); }
        else { for (const y of [1.28, 1.42]) X(0, y, 0, 1, .03, .03, '#567').material = g.elec; for (const x of [-.5, 0, .5]) X(x - .015, 1.2, 0, .03, .27, .03, '#eee'); X(-.1, .7, .075, .2, .12, .01, '#e8c020'); }
      }
    },
    wall(b, o, p) {
      const lvl = b.lvl || 0, hh = [.65, .95, 1.2][lvl], t = .34, k = o.k, c = [col('#b9a272', k), col('#9a9ea4', k), col('#4c545e', k)][lvl], top = [col('#d6c08c', k), col('#b6bac0', k), col('#707a85', k)][lvl];
      const arms = [[0, -1, .5 - t / 2, 0, t, .5 - t / 2], [0, 1, .5 - t / 2, .5 + t / 2, t, .5 - t / 2], [-1, 0, 0, .5 - t / 2, .5 - t / 2, t], [1, 0, .5 + t / 2, .5 - t / 2, .5 - t / 2, t]];
      const seg = (x, z, w, d) => {
        if (lvl === 0) { const n = Math.max(2, Math.round(hh / .17)); for (let i = 0; i < n; i++) blk(p, x + (i % 2 ? .02 : -.02) * (w > d ? 1 : 0), i * .17, z + (i % 2 ? .02 : -.02) * (w > d ? 0 : 1), w, .17, d, col(i % 2 ? '#b9a272' : '#a99262', k)); }
        else if (lvl === 1) { blk(p, x, 0, z, w, hh, d, c); blk(p, x - .02, hh - .08, z - .02, w + .04, .08, d + .04, top); if (w > d) blk(p, x + w / 2 - .012, 0, z - .002, .024, hh, d + .004, '#7a7e84'); else blk(p, x - .002, 0, z + d / 2 - .012, w + .004, hh, .024, '#7a7e84'); }
        else { blk(p, x, 0, z, w, hh, d, c); for (const y of [.25, .6, .95]) blk(p, x - .008, y, z - .008, w + .016, .04, d + .016, '#3a4048'); }
      };
      seg(.5 - t / 2, .5 - t / 2, t, t);
      for (const [dx, dy, x, z, w, d] of arms) if (nbr(b, dx, dy)) seg(x, z, w, d);
      blk(p, .5 - t / 2 - .02, hh, .5 - t / 2 - .02, t + .04, .05, t + .04, top);
      if (lvl === 2) { for (let i = 0; i < 4; i++) R3D.mesh(R3D.cone(.04, .24, 4), R3D.mat('#c8ccd0'), .4 + (i % 2) * .2, hh + .17, .4 + Math.floor(i / 2) * .2, p); for (const [x, z] of [[.36, .36], [.64, .36], [.36, .64], [.64, .64]]) R3D.mesh(R3D.sphere(.018, 5), R3D.mat('#aab'), x, hh * .7, z, p, false); }
    },
    turret(b, o, p) {
      const k = o.k; cylH(p, .42, .1, '#4a4e52', .5, 0, .5, 14); cylH(p, .3, .45, col('#6a3a3a', k), .5, .1, .5, 14); cylH(p, .34, .06, col('#8a8e92', k), .5, .55, .5, 14);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; blk(p, .5 + Math.cos(a) * .42 - .1, 0, .5 + Math.sin(a) * .42 - .08, .2, .22, .16, '#b9a272').rotation.y = -a; }   // sandbag ring
      blk(p, .78, .1, .35, .16, .22, .3, '#566a2e'); blk(p, .8, .32, .4, .12, .03, .2, '#d8b050');   // ammo box + belt
      const head = new THREE.Group(); head.position.set(.5, .78, .5); p.add(head);
      blk(head, -.26, -.15, -.26, .52, .3, .52, col('#8a4a4a', k)); blk(head, -.26, .15, -.2, .46, .05, .4, col('#6a3a3a', k)); blk(head, -.12, .2, -.1, .24, .14, .2, '#2a2d30');
      for (const z of [-.1, .1]) { blk(head, .1, -.04, z - .035, .7, .08, .07, '#2a2d30'); blk(head, .78, -.06, z - .05, .1, .12, .1, '#1a1c1e'); }
      R3D.mesh(R3D.sphere(.06, 8), R3D.mat('#c55', { em: '#c33', ei: .8 }), -.1, .24, .12, head, false); blk(head, -.04, .34, -.2, .02, .1, .02, '#888');
      p.userData.head = head;
    },
  });
  const dmgOf = (frac) => frac < .3 ? 2 : frac < .6 ? 1 : 0;
  const makeBuilding = (b, ghost) => {
    const grp = new THREE.Group(); grp.position.set(b.gx, 0, b.gy);
    const fn = MODELS[b.t]; if (!fn) return grp;
    const frac = b.t === 'house' ? save.houseHp / 100 : b.hp / maxHp(b), d = ghost ? 0 : dmgOf(frac);
    fn(b, { k: d === 2 ? .55 : d === 1 ? .78 : 1 }, grp);
    if (!ghost) { const hd = grp.userData.head; R3D.merge(grp, { skip: hd ? o => { for (let q = o.parent; q; q = q.parent) if (q === hd) return true; return false; } : null }); }
    if (ghost) grp.traverse(c => { if (c.isMesh) { const m = c.material.clone(); m.transparent = true; m.opacity = Math.min(m.opacity, .6); m.depthWrite = false; c.material = m; c.castShadow = false; c.userData.own = true; } });
    return grp;
  };
  const sigOf = b => {
    const frac = b.t === 'house' ? save.houseHp / 100 : b.hp / maxHp(b);
    let s = `${b.t}|${b.gx},${b.gy}|${b.lvl || 0}|${b.dir || ''}|${dmgOf(frac)}`;
    if (b.t === 'wall') s += `|${+nbr(b, 0, -1)}${+nbr(b, 0, 1)}${+nbr(b, -1, 0)}${+nbr(b, 1, 0)}`;
    return s;
  };

  // All static building parts are drawn from one batch (a handful of draw calls); the per-building meshes stay, hidden, for picking.
  const rebuildBatch = () => {
    g.dirty = false; if (g.batch) { g.scene.remove(g.batch); R3D.disposeTree(g.batch); }
    const list = [];
    for (const r of g.recs.values()) { r.grp.updateMatrixWorld(true); const hd = r.head; r.grp.traverse(o => { if (!o.isMesh) return; let inHead = false; for (let q = o.parent; q; q = q.parent) if (q === hd) inHead = true; if (inHead) return; o.visible = false; list.push(o); }); }
    g.batch = R3D.batch(list); g.scene.add(g.batch);
  };

  // vehicles parked on the street
  const makeVehicle = v => R3D.vehicle(v.type, v.color || '#2f4a7a', VEHICLE_TYPES[v.type].len * GSCALE, 1.2);
  const ROLE_LOOK = { fighter: { variant: 'soldier', shirt: '#5a6a48', pants: '#3a4a30' }, engineer: { variant: 'hardhat', shirt: '#e8742a', pants: '#2a2e38' }, medic: { variant: 'medic', shirt: '#f2f2f0', pants: '#2a2e38' }, farmer: { variant: 'strawhat', shirt: '#6a8a3a', pants: '#3a4a6a' }, scout: { variant: 'hoodie', shirt: '#3a5a6a', pants: '#2a3a30' }, mechanic: { variant: 'vest', shirt: '#3a4a6a', pants: '#2a2e38' }, cook: { variant: 'chef', shirt: '#f2f2f0', pants: '#2a2a30' } };
  const crewMesh = c => R3D.humanoid({ skin: ['#caa07a', '#e0b890', '#a8785a', '#8a5a3a'][c.name.length % 4], hat: ['#2a2018', '#5a4030', '#8a7a5a', '#1a1a1a'][c.name.charCodeAt(0) % 4], pants: '#2f3440', ...(ROLE_LOOK[c.role] || {}), gun: 'pistol', scale: 1.15, pose: 'idle' });
  const ZB = { walker: [1.15, 1], runner: [1.1, .95], brute: [1.5, 1.45], spitter: [1.15, 1.05], armored: [1.22, 1.12] };
  const ZSKIN = { walker: '#7d9468', brute: '#8c946a', runner: '#a3ad84', spitter: '#97c93f', armored: '#6f8a6c' };
  const CLOTH = ['#5a5348', '#3f4a56', '#6a4a3a', '#4a5a4a', '#6a6a6a', '#4a3a5a'];
  const attackerMesh = z => {
    if (z.raider) return R3D.humanoid({ skin: '#c89a74', shirt: '#8a4a28', pants: '#2a2420', hat: ['#2a2420', '#3a2a1a', '#15110e'][Math.floor(z.ph * 3) % 3], variant: 'raider', scale: 1.2, gun: 'old_rifle', pose: 'aim', twoHand: true });
    const [s, bulk] = ZB[z.kind] || ZB.walker, base = ZSKIN[z.kind] || ZSKIN.walker, L = R3D.zombieLook(z.kind, z.ph, (z.ph * 7.7) % 1), skin = z.kind === 'walker' || z.kind === 'runner' ? L.skin : base, h = R3D.humanoid({ skin, shirt: z.kind === 'spitter' && L.variant === 'plain' ? '#566a2a' : L.shirt, pants: L.pants, hat: z.kind === 'armored' ? '#40464c' : L.bald && L.variant === 'plain' ? skin : L.hair, variant: z.kind === 'armored' ? undefined : L.variant, extra: '#3a4046', scale: s, bulk, pose: 'zombie', belly: z.kind === 'spitter', plates: z.kind === 'armored', lean: z.kind === 'runner' ? .22 : 0 });
    for (const sg of [-1, 1]) { const e = new THREE.Mesh(R3D.box(.02, .025, .03), R3D.basic('#ff2a1e')); e.position.set(.07, .016, sg * .04); h.userData.head.add(e); }
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
    if (!g) return null; const strong = typeof SET !== 'undefined' && SET.assist === 'strong'; let best = null, bd = TOUCH.on && SET.assist !== 'off' ? (strong ? 400 : 110) : 48;   // touch assist: a fat finger still hits the nearest attacker
    for (const z of raid.zombies) { const q = R3D.toUI(z.x, .65, z.y, g.camera); if (!q) continue; const d = Math.hypot(q.x - mouse.x, q.y - mouse.y); if (d < bd) { bd = d; best = z; } }
    return best;
  };

  // ---------------------------------------------------------------- camera
  B.fit = () => { if (!g) init(); g.tx = GX / 2 - 1; g.tz = GY / 2 + 1; g.dist = Math.max(30, Math.min(60, 62 * Math.min(1.15, innerWidth / innerHeight) ** -.3)); g.yaw = .55; g.pitch = .95; };
  B.scene = () => g && g.scene;
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
  // touch: two fingers pinch to zoom, twist to rotate and drag to pan (one finger builds / shoots, handled in base.js)
  B.touchGesture = sc => {
    if (!g) return; const pts = [...touchPts.values()];
    if (pts.length < 2) { sc.gest = null; return; }
    const [a, b] = pts, d = Math.hypot(a.x - b.x, a.y - b.y) || 1, ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, G = sc.gest;
    sc.gesture = true; sc.tp = null; sc.paint = null; sc.pan = null; sc.rot = null;
    if (G) {
      g.dist = Math.max(8, Math.min(90, g.dist * G.d / d));
      let da = ang - G.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); g.yaw += da;
      const k = 2 * g.dist * Math.tan(19 * Math.PI / 180) / innerHeight * UI.scale, fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), rx = Math.cos(g.yaw), rz = -Math.sin(g.yaw), dx = mx - G.mx, dy = my - G.my, sp = Math.sin(g.pitch);
      g.tx = Math.max(-14, Math.min(GX + 14, g.tx - rx * dx * k + fx * dy * k / sp)); g.tz = Math.max(-14, Math.min(GY + 14, g.tz - rz * dx * k + fz * dy * k / sp));
    }
    sc.gest = { d, ang, mx, my };
  };
  B.startPan = sc => { if (!g) init(); g.camera.updateMatrixWorld(); const p = R3D.ground(g.camera, 0); sc.pan = { g: p }; };
  B.startRot = sc => { if (!g) init(); sc.rot = { x: mouse.x, y: mouse.y, yaw: g.yaw, pitch: g.pitch }; };

  // ---------------------------------------------------------------- one frame
  const sky = { day: new THREE.Color('#8db7dc'), night: new THREE.Color('#04060d'), dusk: new THREE.Color('#e08a5a'), grey: new THREE.Color('#7f8a94'), tmp: new THREE.Color() };

  // ---------------------------------------------------------------- the living base: crew follow a daily routine and walk around the buildings
  // Morning: out of the house to their jobs; day: each role works where it makes sense (farmers water the greenhouses, the engineer repairs the most
  // damaged building, fighters guard the gate and fences...); evening: everyone gathers at the gazebo; night: indoors (windows lit). During the night watch
  // they take the posts the plan gave them: at the house windows, on a turret, repairing or tending the wounded.
  const PASS = new Set(['garden', 'wire', 'pit', 'mine', 'gate']);
  const blockedAt = (x, y) => x < 1 || y < 1 || x >= GX - 1 || y >= GY - 1 || (g.nav ? g.nav[y * GX + x] === 1 : false);
  const refreshNav = () => {
    let sig = save.buildings.length; for (const b of save.buildings) sig = (sig * 31 + b.gx * 7 + b.gy) | 0;
    if (g.navSig === sig) return; g.navSig = sig; g.nav = new Uint8Array(GX * GY);
    for (const b of save.buildings) if (!PASS.has(b.t)) for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) { const x = b.gx + i, y = b.gy + j; if (x >= 0 && y >= 0 && x < GX && y < GY) g.nav[y * GX + x] = 1; }
  };
  const freeNear = (x, y) => {   // the closest open cell to a point
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let r = 0; r <= 5; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !blockedAt(cx + dx, cy + dy)) return [cx + dx, cy + dy];
    return [Math.max(1, Math.min(GX - 2, cx)), Math.max(1, Math.min(GY - 2, cy))];
  };
  const aStar = (sx, sy, tx, ty) => {
    const N = GX * GY, idx = (x, y) => y * GX + x, gS = new Float32Array(N).fill(1e9), from = new Int16Array(N).fill(-1), closed = new Uint8Array(N), open = [idx(sx, sy)]; gS[open[0]] = 0;
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
    let it = 0, found = sx === tx && sy === ty;
    while (open.length && it++ < 900 && !found) {
      let bi = 0, bf = 1e9; for (let i = 0; i < open.length; i++) { const k = open[i], f = gS[k] + h(k % GX, (k / GX) | 0); if (f < bf) { bf = f; bi = i; } }
      const cur = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1; const cx = cur % GX, cy = (cur / GX) | 0; if (cx === tx && cy === ty) { found = true; break; }
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (blockedAt(nx, ny) || (dx && dy && (blockedAt(cx + dx, cy) || blockedAt(cx, cy + dy)))) continue;
        const k = idx(nx, ny), ng = gS[cur] + (dx && dy ? 1.414 : 1); if (ng < gS[k]) { gS[k] = ng; from[k] = cur; open.push(k); }
      }
    }
    if (!found) return null; const path = []; for (let k = idx(tx, ty); k >= 0 && k !== idx(sx, sy); k = from[k]) path.push([k % GX + .5, ((k / GX) | 0) + .5]); return path.reverse();
  };
  const hrOf = c => ((c % 24) + 24) % 24, hsh = (s, k = 0) => { let h = 2166136261 + k; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };
  const planFor = (c, i, br, raid) => {
    const house = save.buildings.find(b => b.t === 'house'); if (!house) return { key: 'none', goal: [9, 18], anim: 'idle' };
    const door = [house.gx + 2.5, house.gy + house.h + .6], bs = t => save.buildings.filter(b => b.t === t), south = (b, k = .5) => [b.gx + b.w * k, b.gy + b.h + .5], hr = hrOf(save.clock), sub = br.sub;
    const inside = { key: 'inside', goal: door, anim: 'enter', hidden: true }, post = raid && !raid.result ? save.posts[c.name] : null;
    if (raid && !raid.result) {   // the night watch
      if (post === 'windows') { const k = Math.floor(i / 2) % 4, side = i % 2; return { key: 'win' + i, goal: [house.gx + (side ? -.8 : house.w + .8), house.gy + (k + .5) * house.h / 4], anim: 'shoot' }; }
      if (post === 'turret') { const tb = [...(raid.manned || new Map()).entries()].find(([, who]) => who === c); if (tb) { const b = tb[0]; return { key: 'tur' + b.gx + b.gy, goal: [b.gx + .5 + Math.sign(house.gx + 2 - b.gx - .5) * 1.1, b.gy + .5 + Math.sign(house.gy + 4 - b.gy - .5) * .3], anim: 'shoot' }; } }
      if (post === 'repair') { let w = null, wr = 1; for (const b of save.buildings) if (b.t !== 'house' && !TRAP_KINDS.has(b.t) && b.hp < maxHp(b) && b.hp / maxHp(b) < wr) { wr = b.hp / maxHp(b); w = b; } if (w) return { key: 'rep' + w.gx + w.gy, goal: [w.gx + w.w / 2, w.gy + w.h + .8], look: [w.gx + w.w / 2, w.gy + w.h / 2], anim: 'hammer' }; }
      if (post === 'medic') return { key: 'med', goal: [house.gx + house.w + 1, house.gy + house.h - 1.5], anim: 'look' };
      return inside;
    }
    if (hr >= 22 || hr < 5.5) return inside;
    if (hr >= 20.5) return inside;
    if (hr >= 17.5) { const gz = bs('gazebo')[0]; if (gz) { const a = (i / Math.max(1, alive().length)) * Math.PI * 2; return { key: 'gather', goal: [gz.gx + gz.w / 2 + Math.cos(a) * 1.7, gz.gy + gz.h / 2 + Math.sin(a) * 1.7], look: [gz.gx + gz.w / 2, gz.gy + gz.h / 2], anim: 'talk' }; } }
    const pick = list => list[Math.floor(hsh(c.name, sub) * list.length) % list.length];
    switch (c.role) {
      case 'fighter': { const t = bs('turret'); return pick([{ key: 'g1', goal: [7.5, GY - 2.4], look: [7.5, GY + 4], anim: 'guard' }, { key: 'g2', goal: [GX / 2, 1.7], look: [GX / 2, -6], anim: 'guard' }, { key: 'g3', goal: [GX - 2.5, GY / 2], look: [GX + 6, GY / 2], anim: 'guard' }, t[0] ? { key: 'g4', goal: [t[0].gx + 1.5, t[0].gy + .5], look: [t[0].gx + 8, t[0].gy], anim: 'guard' } : { key: 'g5', goal: [3, GY - 3], look: [3, GY + 4], anim: 'guard' }]); }
      case 'engineer': { let w = null, wr = 1; for (const b of save.buildings) if (b.t !== 'house' && !TRAP_KINDS.has(b.t) && b.hp / maxHp(b) < wr) { wr = b.hp / maxHp(b); w = b; } if (w && wr < .95) return { key: 'e' + w.gx + w.gy, goal: [w.gx + w.w / 2, w.gy + w.h + .8], look: [w.gx + w.w / 2, w.gy + w.h / 2], anim: 'hammer' }; const ws = bs('workshop')[0]; return ws ? { key: 'ew', goal: south(ws, .3), look: [ws.gx + 1, ws.gy + ws.h], anim: 'hammer' } : { key: 'ei', goal: [9, 18], anim: 'idle' }; }
      case 'medic': return pick([{ key: 'm1', goal: [house.gx + house.w + 1, house.gy + house.h - 1.5], anim: 'look' }, { key: 'm2', goal: [door[0] + 2, door[1]], anim: 'talk' }]);
      case 'farmer': { const gh = bs('greenhouse'), gd = bs('garden'); const opts = [...gh.map(b => ({ key: 'f' + b.gx + b.gy, goal: south(b, .5 + hsh(c.name) * .1), look: [b.gx + b.w / 2, b.gy + b.h / 2], anim: 'water' })), ...gd.slice(0, 3).map(b => ({ key: 'fg' + b.gx + b.gy, goal: [b.gx + .5, b.gy + 1.4], look: [b.gx + .5, b.gy + .5], anim: 'water' }))]; return opts.length ? pick(opts) : { key: 'fi', goal: [10, 14], anim: 'look' }; }
      case 'scout': return pick([{ key: 's1', goal: [7.5, GY - 2.4], look: [8, GY + 8], anim: 'look' }, { key: 's2', goal: [GX / 2, 1.7], look: [GX / 2, -8], anim: 'look' }, { key: 's3', goal: [GX - 2.5, 5], look: [GX + 8, 5], anim: 'look' }]);
      case 'mechanic': { const gen = bs('generator')[0], pb = bs('powerbox')[0]; return pick([gen ? { key: 'mg', goal: [gen.gx + 1.5, gen.gy + .5], look: [gen.gx + .5, gen.gy + .5], anim: 'hammer' } : { key: 'mi', goal: [3, 20], anim: 'idle' }, pb ? { key: 'mp', goal: [pb.gx + 1.5, pb.gy + .5], look: [pb.gx + .5, pb.gy + .5], anim: 'hammer' } : { key: 'mj', goal: [3, 21], anim: 'idle' }]); }
      case 'cook': { const gz = bs('gazebo')[0]; return pick([gz ? { key: 'c1', goal: [gz.gx + gz.w / 2, gz.gy + gz.h + .9], look: [gz.gx + gz.w / 2, gz.gy + gz.h / 2], anim: 'water' } : { key: 'c0', goal: door, anim: 'idle' }, { key: 'c2', goal: [door[0] + 1.5, door[1] + .5], anim: 'look' }]); }
      default: return { key: 'w' + sub, goal: [4 + hsh(c.name, sub) * 12, 12 + hsh(c.name, sub + 5) * 12], anim: 'idle' };
    }
  };
  B.life = (sc, dt, crew, raid) => {
    refreshNav(); const house = save.buildings.find(b => b.t === 'house'); if (!g.brains) g.brains = new Map();
    for (const [c, br] of g.brains) if (!crew.includes(c)) g.brains.delete(c);
    crew.forEach((c, i) => {
      let m = g.crew.get(c); if (!m) { m = crewMesh(c); g.crew.set(c, m); g.ents.add(m); }
      let br = g.brains.get(c); if (!br) { br = { x: 9, y: 19, path: [], ph: Math.random() * 6, face: 0, sub: 0, t: 8 + Math.random() * 14, key: '', hidden: false, plan: null, wait: 0 }; g.brains.set(c, br); }
      br.t -= dt; if (br.t <= 0) { br.t = 14 + hsh(c.name, br.sub) * 22; br.sub++; }
      const plan = planFor(c, i, br, raid), fresh = br.key === '';
      if (plan.key !== br.key) {
        br.key = plan.key; br.plan = plan; const [gx, gy] = freeNear(plan.goal[0], plan.goal[1]); br.goal = [gx + .5, gy + .5];
        if (fresh) { br.x = br.goal[0]; br.y = br.goal[1]; br.path = []; br.hidden = !!plan.hidden; if (plan.hidden && house) { br.x = house.gx + 2.5; br.y = house.gy + house.h + .6; } }
        else { if (br.hidden && !plan.hidden && house) { br.x = house.gx + 2.5; br.y = house.gy + house.h + .6; br.hidden = false; } const [sx, sy] = freeNear(br.x, br.y); br.path = aStar(sx, sy, gx, gy) || [br.goal]; }
      }
      // walk along the path
      const run = raid && !raid.result ? 3 : 1.5; let moving = false;
      if (br.path.length) { const [tx, ty] = br.path[0], dx = tx - br.x, dy = ty - br.y, d = Math.hypot(dx, dy), step = run * dt; moving = true; if (d <= step) { br.x = tx; br.y = ty; br.path.shift(); } else { br.x += dx / d * step; br.y += dy / d * step; } br.fx = dx; br.fy = dy; br.ph += dt * run * .5; }
      else if (plan.hidden && !br.hidden) br.hidden = true;
      m.visible = !br.hidden; if (br.hidden) return;
      // facing: the way it walks, or at what it is doing
      let ax = br.fx, ay = br.fy;
      if (!moving) { if (plan.anim === 'shoot' && raid) { let nz = null, nd = 99; for (const z of raid.zombies) { const d = Math.hypot(z.x - br.x, z.y - br.y); if (d < nd) { nd = d; nz = z; } } if (nz) { ax = nz.x - br.x; ay = nz.y - br.y; } else if (house) { ax = br.x - (house.gx + house.w / 2); ay = br.y - (house.gy + house.h / 2); } } else if (plan.look) { ax = plan.look[0] - br.x; ay = plan.look[1] - br.y; } }
      if (ax !== undefined && (ax || ay)) { const want = -Math.atan2(ay, ax); let dy2 = want - br.face; dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2)); br.face += dy2 * Math.min(1, dt * 8); }
      m.position.set(br.x, 0, br.y); m.rotation.y = br.face;
      const u = m.userData, an = moving ? 'walk' : plan.anim, tt = g.t + i * 1.7;
      u.gun.visible = an === 'shoot' || an === 'guard';
      R3D.pose(m, br.ph, moving ? 1 : 0, an === 'shoot' || an === 'guard' ? { pose: 'aim' } : {});
      if (!moving) {
        if (an === 'hammer') { const s = Math.sin(tt * 8); u.armR.rotation.z = .5 + s * .8; u.elbowR.rotation.z = .7 + s * .4; u.upper.rotation.z = -.18; if (s > .97 && Math.random() < .5 && plan.look) { const b = 1.1; g.fx.push({ x: br.x + Math.cos(-br.face) * .5, y: .9, z: br.y + Math.sin(-br.face) * .5, vx: (Math.random() - .5) * 3, vy: 1.5 + Math.random() * 2, vz: (Math.random() - .5) * 3, l: .35, c: '#ffd070' }); } }
        else if (an === 'water') { u.armL.rotation.z = 1; u.armR.rotation.z = 1.1; u.elbowL.rotation.z = .5; u.elbowR.rotation.z = .5; u.upper.rotation.z = -.22 + Math.sin(tt * 1.5) * .05; u.head.rotation.z = .25; }
        else if (an === 'look' || an === 'guard') { u.head.rotation.y = Math.sin(tt * .7) * 1.0; }
        else if (an === 'talk') { u.armR.rotation.z = .6 + Math.sin(tt * 2.6) * .6; u.elbowR.rotation.z = .5; u.head.rotation.y = Math.sin(tt * .9) * .5; }
        else if (an === 'shoot') { u.head.rotation.y = 0; }
        else u.head.rotation.y = Math.sin(tt * .5) * .4;
      } else u.head.rotation.y = 0;
    });
  };

  B.applyQuality = () => {
    g.qv = R3D.qv; const q = R3D.q, sh = g.sun.shadow;
    g.sun.castShadow = q.shadow > 0; if (q.shadow && sh.mapSize.x !== q.shadow) { sh.mapSize.set(q.shadow, q.shadow); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const minor = [[g.porch, 2], [g.flood[0], 2], [g.flood[1], 2], [g.flood[2], 3], [g.flood[3], 3], [g.fireL[0], 2], [g.fireL[1], 3], [g.blastL, 2]];
    for (const [l, need] of minor) { const keep = q.minor >= need; if (keep && !l.parent) g.scene.add(l); else if (!keep && l.parent) g.scene.remove(l); }
  };
  B.frame = (sc, dt, time, hover) => {
    if (!g) init(); if (g.qv !== R3D.qv) B.applyQuality();
    g.t += dt; const raid = sc.raid, dk = darkness(save.clock), wx = save.weather, wf = { sunny: 1, partly: .85, cloudy: .55, storm: .38 }[wx] || 1, cam = g.camera;
    // sky and light
    const day = 1 - dk, dusk = Math.sin(Math.min(1, dk) * Math.PI) * .35 * (dk < .98 ? 1 : 0);
    sky.tmp.copy(sky.day).lerp(sky.grey, 1 - wf).lerp(sky.night, dk).lerp(sky.dusk, dusk); g.scene.background.copy(sky.tmp); g.scene.fog.color.copy(sky.tmp); g.scene.fog.near = wx === 'storm' ? 40 : wx === 'cloudy' ? 55 : 70; g.scene.fog.far = wx === 'storm' ? 120 : wx === 'cloudy' ? 170 : 200;
    const flash = R3D.lightning(dt, wx === 'storm');
    g.hemi.intensity = .42 + 1.1 * day * wf + flash * 2.6; if (flash) g.scene.background.lerp(sky.dusk.clone().set('#dfe8ff'), flash * .5); g.hemi.color.set(dk > .5 ? '#4a5a96' : '#dfeaf8'); g.hemi.groundColor.set(dk > .5 ? '#05070c' : '#6a6a50');
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
      if (!r || r.sig !== sig) { g.dirty = true; if (r) { g.bldRoot.remove(r.grp); R3D.disposeTree(r.grp); } const grp = makeBuilding(b); grp.userData.b = b; r = { grp, sig, head: grp.userData.head }; g.recs.set(b, r); g.bldRoot.add(grp); }
      if (b.t === 'turret' && r.head) {
        let tgt = null, td = 99; if (raid) for (const z of raid.zombies) { const d = Math.hypot(z.x - b.gx - .5, z.y - b.gy - .5); if (d < td && d < 10) { td = d; tgt = z; } }
        if (tgt) r.head.rotation.y = -Math.atan2(tgt.y - b.gy - .5, tgt.x - b.gx - .5);
      }
      if (b.t === 'floodlight' && lit && powered && flood < 4) { const L = g.flood[flood++]; L.position.set(b.gx + .5, 2.2, b.gy + .5); L.intensity = 3.4; }
    }
    for (; flood < 4; flood++) g.flood[flood].intensity = 0;
    g.lamp.emissiveIntensity = lit && powered ? 1.3 : 0;
    for (const [b, r] of g.recs) if (!seen.has(b)) { g.bldRoot.remove(r.grp); R3D.disposeTree(r.grp); g.recs.delete(b); g.dirty = true; }
    if (g.dirty) rebuildBatch();
    // the house burns when it is nearly gone
    const fires = [];
    for (const b of save.buildings) if (b.t !== 'house' && b.t !== 'garden' && !TRAP_KINDS.has(b.t) && b.hp / maxHp(b) < .3) fires.push([b.gx + b.w / 2, (HT[b.t] ? HT[b.t][0] : 1) + .3, b.gy + b.h / 2, .7]);   // badly damaged buildings burn
    g.smokeT = (g.smokeT || 0) - dt; const hs = save.buildings.find(b => b.t === 'house'); if (hs && g.smokeT <= 0 && !(raid && raid.result)) { g.smokeT = .45; g.fx.push({ x: hs.gx + hs.w * .6 + .22, y: 3.3, z: hs.gy + hs.h * .25 + .22, vx: .25 + Math.random() * .2, vy: .7, vz: .1, l: 2.4, c: '#8a8a88', smoke: 1 }); }   // chimney smoke
    if (save.houseHp < 30) { const h = save.buildings.find(b => b.t === 'house'); if (h) fires.push([h.gx + 1, 2.4, h.gy + 3, 1.3], [h.gx + 3, 2.2, h.gy + 6, 1.1]); }
    // vehicles
    const vl = save.vehicles.slice(0, FLEET_MAX);
    for (const [v, m] of g.vehs) if (!vl.includes(v)) { g.ents.remove(m); g.vehs.delete(v); }
    vl.forEach((v, i) => { let m = g.vehs.get(v); if (!m) { m = makeVehicle(v); g.vehs.set(v, m); g.ents.add(m); } const [cx, cy] = FLEET_SLOTS[i]; m.position.set((cx + VEHICLE_TYPES[v.type].len / 2) * GSCALE, 0, (cy + .45) * GSCALE); });
    // the crew, standing about in the yard
    const crew = alive();
    for (const [c, m] of g.crew) if (!crew.includes(c)) { g.ents.remove(m); g.crew.delete(c); }
    B.life(sc, dt, crew, raid);

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
    for (const p of g.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (!p.smoke) p.vy -= 9 * dt; p.l -= dt; if (!p.smoke && p.y < .05) { p.y = .05; p.vy = 0; p.vx *= .8; p.vz *= .8; } }
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
