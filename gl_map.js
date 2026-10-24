// 3D county map. The 2D map code keeps doing the interface (labels, site icons, tooltips, buttons, the amber route); here the
// map becomes a tilted perspective view of a raised county slab with real road and river ribbons, a glowing border, and a
// building for every settlement. The trick that keeps hover, clicks and zoom-to-cursor working: map.js's mproj / munproj are
// redirected to this camera, so everything the 2D code draws at a projected point lands on the right spot of the 3D ground.
// World units are kilometres, x east, z south, y up; the ground top sits at y = T (a few screen pixels' worth of km).

R3D.map = (() => {
  const M = {};
  const FOV = 40, TANF = Math.tan(FOV / 2 * Math.PI / 180);
  let g = null, key = '', vp = null, inv = null, T = 1, kpp = 1, D = 100;
  const LON0 = HOME.lon, LAT0 = HOME.lat, KX = 111 * Math.cos(45.8 * Math.PI / 180);
  const wx = lon => (lon - LON0) * KX, wz = lat => -(lat - LAT0) * 111;
  const inside = (poly, lon, lat) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; };

  M.active = () => R3D.ok && typeof scene !== 'undefined' && scene === mapScene;
  // the camera follows cam.lon / cam.lat / cam.z (from map.js) plus a yaw and pitch of its own
  cam.yaw = cam.yaw || 0; cam.pitch = cam.pitch || .82;
  const sync = () => {
    if (!g) M.init();
    const k = `${cam.lon}|${cam.lat}|${cam.z}|${cam.yaw}|${cam.pitch}|${W}|${H}`; if (k === key) return; key = k;
    kpp = 111 / (BASEPX * cam.z); T = 9 * kpp;                        // km per screen pixel at the target; slab thickness
    D = H * kpp / (2 * TANF);                                          // distance along the view that gives the same zoom as the flat map
    const c = g.camera, tx = wx(cam.lon), tz = wz(cam.lat), hd = Math.cos(cam.pitch) * D;
    c.fov = FOV; c.aspect = W / H; c.near = D * .04; c.far = D * 14; c.updateProjectionMatrix();
    c.position.set(tx + Math.sin(cam.yaw) * hd, T + Math.sin(cam.pitch) * D, tz + Math.cos(cam.yaw) * hd); c.lookAt(tx, T, tz); c.updateMatrixWorld();
    vp = new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); inv = vp.clone().invert(); g.dirty = true;
  };
  // lon / lat (+ height above the ground in km) -> UI pixels, and back to lon / lat on the ground
  M.project = (lon, lat, h = 0) => {
    sync(); const e = vp.elements, X = wx(lon), Y = T + h, Z = wz(lat);
    const w = e[3] * X + e[7] * Y + e[11] * Z + e[15], cx = (e[0] * X + e[4] * Y + e[8] * Z + e[12]) / w, cy = (e[1] * X + e[5] * Y + e[9] * Z + e[13]) / w;
    return [(cx * .5 + .5) * W, (1 - (cy * .5 + .5)) * H];
  };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  M.unproject = (x, y) => {
    sync(); const nx = x / W * 2 - 1, ny = 1 - y / H * 2; _a.set(nx, ny, -1).applyMatrix4(inv); _b.set(nx, ny, 1).applyMatrix4(inv);
    const t = (T - _a.y) / (_b.y - _a.y), X = _a.x + (_b.x - _a.x) * t, Z = _a.z + (_b.z - _a.z) * t;
    return [LON0 + X / KX, LAT0 - Z / 111];
  };

  // ---------------------------------------------------------------- one-time scene
  M.init = () => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#02060a');
    g = { scene: sc, camera: new THREE.PerspectiveCamera(FOV, 1, 1, 1000), dirty: true, zKey: -1, dayKey: -1 };
    sc.add(new THREE.HemisphereLight('#9fe8c0', '#06140c', 1.4)); const sun = new THREE.DirectionalLight('#d8ffe8', 2.2); sun.position.set(-1, 2, -1.2); sc.add(sun);
    const ring = GEO.county.map(([lo, la]) => [wx(lo), wz(la)]);
    // the county slab: dim top, bright sides (built one km tall, scaled to the current thickness)
    const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }); sg.rotateX(-Math.PI / 2);
    g.slab = new THREE.Mesh(sg, [new THREE.MeshBasicMaterial({ color: '#0a2415' }), new THREE.MeshBasicMaterial({ color: '#1f9d58' })]); sc.add(g.slab);
    g.floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: '#03080a' })); g.floor.rotation.x = -Math.PI / 2; sc.add(g.floor);
    const lineObj = (pts, color, loop, op = 1) => { const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))); const o = loop ? new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op })) : new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op })); sc.add(o); return o; };
    g.border = lineObj(ring, '#d6ffe4', true); g.neigh = GEO.neigh.map(n => lineObj(n.p.map(([lo, la]) => [wx(lo), wz(la)]), '#17402a', false, .8));
    // roads and rivers as polylines in km, roads split into runs inside / outside the county
    g.rivers = GEO.rivers.map(r => r.p.map(([lo, la]) => [wx(lo), wz(la)]));
    g.roadRuns = [];
    for (const r of GEO.roads) { let run = [], was = null; for (const [lo, la] of r.p) { const ins = inside(GEO.county, lo, la), pt = [wx(lo), wz(la)]; if (was !== null && ins !== was) { run.push(pt); if (run.length > 1) g.roadRuns.push({ t: r.t, ins: was, p: run }); run = [pt]; } else run.push(pt); was = ins; } if (run.length > 1) g.roadRuns.push({ t: r.t, ins: was, p: run }); }
    g.localRuns = typeof LOCAL_ROADS !== 'undefined' ? LOCAL_ROADS.map(r => ({ t: r.t, ins: true, p: r.p.map(([lo, la]) => [wx(lo), wz(la)]) })) : [];
    g.ribbons = new THREE.Group(); sc.add(g.ribbons);
    g.grat = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#0d2c1a' })); g.grat.frustumCulled = false; sc.add(g.grat);
    // settlements: one instanced box mesh; cities get a cluster of towers
    g.cap = 700; g.bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshLambertMaterial({ flatShading: true }), g.cap); g.bld.count = 0; g.bld.frustumCulled = false; sc.add(g.bld);
    g.bld.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(g.cap * 3), 3);
    g.home = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); sc.add(g.home);
    g.homeRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); g.homeRing.rotation.x = -Math.PI / 2; sc.add(g.homeRing);
  };

  // ---------------------------------------------------------------- ribbons (width in screen pixels, so they are rebuilt when the zoom changes)
  const ribbon = (runs, wpx, y) => {
    const w = wpx * kpp, pos = []; let idx = [], base = 0;
    for (const { p } of runs) {
      const n = p.length; const off = [];
      for (let i = 0; i < n; i++) {
        const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(n - 1, i + 1)];
        let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1], l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1; d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
        let nx = -(d1z + d2z), nz = d1x + d2x, nl = Math.hypot(nx, nz); if (nl < 1e-6) { nx = -d2z; nz = d2x; nl = 1; } nx /= nl; nz /= nl;
        const miter = Math.min(2.2, 1 / Math.max(.45, nx * -d1z + nz * d1x)); off.push([nx * w / 2 * miter, nz * w / 2 * miter]);
      }
      for (let i = 0; i < n; i++) { pos.push(p[i][0] + off[i][0], y, p[i][1] + off[i][1], p[i][0] - off[i][0], y, p[i][1] - off[i][1]); }
      for (let i = 0; i < n - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      base += n * 2;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); return geo;
  };
  const roadStyle = { major: ['#8dffae', 3.2], sec: ['#3fe070', 2.2], road: ['#2b9a52', 1.2] };
  const rebuildRibbons = () => {
    while (g.ribbons.children.length) { const o = g.ribbons.children[0]; g.ribbons.remove(o); o.geometry.dispose(); o.material.dispose(); }
    const z = cam.z, mul = z > 5 ? 1.4 : 1, add = (runs, wpx, y, mat) => { if (!runs.length) return; const m = new THREE.Mesh(ribbon(runs, wpx, y), mat); m.renderOrder = 2; g.ribbons.add(m); };
    const mat = (c, op = 1, additive = false) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: op < 1 || additive, opacity: op, depthWrite: op >= 1 && !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    add(g.rivers.map(p => ({ p })), 1.6, T + 1 * kpp, mat('#3c8cd2', .6));
    for (const t of ['road', 'sec', 'major']) {
      if (t === 'road' && z < 1.5) continue; const [c, w] = roadStyle[t], y0 = T + (t === 'road' ? 2 : t === 'sec' ? 3 : 4) * kpp;
      add(g.roadRuns.filter(r => r.t === t && !r.ins), w * mul, y0, mat(c, .3));
      add(g.roadRuns.filter(r => r.t === t && r.ins), w * mul + 5, y0 - .5 * kpp, mat('#3f6', .16, true));   // glow
      add(g.roadRuns.filter(r => r.t === t && r.ins), w * mul, y0 + .5 * kpp, mat(c));
    }
    for (const t of ['sec', 'road']) { const runs = g.localRuns.filter(r => (r.t || 'road') === t && z >= (t === 'sec' ? 1.6 : 3)); add(runs, 1.2, T + 2.5 * kpp, mat('#2fbf62')); }
  };
  const rebuildGraticule = () => {
    const steps = [1, .5, .2, .1, .05, .02, .01], px = s => s * BASEPX * cam.z, stp = steps.find((s, i) => px(s) < 140 && (px(s) >= 55 || i === steps.length - 1)) || .01;
    let lo0 = 1e9, lo1 = -1e9, la0 = 1e9, la1 = -1e9; for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0]]) { const [lo, la] = M.unproject(x, y); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); la0 = Math.min(la0, la); la1 = Math.max(la1, la); }
    const pts = [], yv = T + .4 * kpp; let n = 0;
    for (let lo = Math.ceil(lo0 / stp) * stp; lo <= lo1 && n < 260; lo += stp, n++) pts.push(wx(lo), yv, wz(la0), wx(lo), yv, wz(la1));
    for (let la = Math.ceil(la0 / stp) * stp; la <= la1 && n < 260; la += stp, n++) pts.push(wx(lo0), yv, wz(la), wx(lo1), yv, wz(la));
    g.grat.geometry.dispose(); g.grat.geometry = new THREE.BufferGeometry(); g.grat.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const rebuildBuildings = () => {
    let n = 0; const inf = t => Math.min(1, (t.danger + save.day * .3) / 6);
    const put = (x, z, w, h, d, color, ry = 0) => { if (n >= g.cap) return; _q.setFromAxisAngle(_s.set(0, 1, 0), ry); _p.set(x, T, z); _m.compose(_p, _q, _s.set(w, h, d)); g.bld.setMatrixAt(n, _m); g.bld.setColorAt(n, color); n++; };
    for (const t of TOWNS) {
      if (t.type === 'spot' || !mapScene.visible(t)) continue;
      const x = wx(t.lon), z = wz(t.lat), r = mapScene.size(t) * (cam.z > 6 ? 1.3 : 1), i = inf(t); _c.setRGB((80 + i * 175) / 255, (220 - i * 160) / 255, 80 / 255);
      const s = r * 2 * kpp, big = t.type === 'city';
      if (big) { put(x, z, s * 1.4, 20 * kpp, s * 1.4, _c, .3); for (let k = 0; k < 8; k++) { const a = k * .8 + .3, rr = s * (.8 + (k % 3) * .35); put(x + Math.cos(a) * rr, z + Math.sin(a) * rr, s * .55, (7 + (k * 5) % 11) * kpp, s * .55, _c, a); } }
      else if (t.type === 'town') { put(x, z, s, 10 * kpp, s, _c, .2); put(x + s * .7, z + s * .3, s * .55, 6 * kpp, s * .55, _c, .6); }
      else put(x, z, s, (t.pop > 600 ? 6 : 4.5) * kpp, s, _c, (t.lon * 997 % 1) * 3);
    }
    g.bld.count = n; g.bld.instanceMatrix.needsUpdate = true; if (g.bld.instanceColor) g.bld.instanceColor.needsUpdate = true;
  };

  // ---------------------------------------------------------------- one frame
  M.frame = (dt, time) => {
    sync();
    if (g.dirty || g.zKey !== cam.z) { g.zKey = cam.z; g.dirty = false;
      g.slab.scale.set(1, T, 1); g.floor.position.y = -T * .3;
      const yb = T + 1.5 * kpp; g.border.position.y = yb; g.neigh.forEach(o => { o.position.y = T + .3 * kpp; });
      rebuildRibbons(); rebuildGraticule(); rebuildBuildings(); g.dayKey = save.day + ':' + save.reapers.state; }
    else if (g.dayKey !== save.day + ':' + save.reapers.state) { g.dayKey = save.day + ':' + save.reapers.state; rebuildBuildings(); }
    // the home beacon
    const hx = wx(HOME.lon), hz = wz(HOME.lat), pulse = 1 + Math.sin(time * 4) * .12;
    g.home.position.set(hx, T, hz); g.home.scale.set(5 * kpp * pulse, 80 * kpp, 5 * kpp * pulse); g.homeRing.position.set(hx, T + 1.2 * kpp, hz); g.homeRing.scale.setScalar(14 * kpp * pulse);
    g.border.material.color.set(time % 4 < .1 ? '#ffffff' : '#d6ffe4');
    R3D.show(true); R3D.render(g.scene, g.camera);
  };
  M.reset = () => { key = ''; };
  return M;
})();
