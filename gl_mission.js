// 3D view of a scavenging run. The mission keeps simulating on a flat 960x640 stage (x, y in px); here that stage becomes
// the XZ plane (x -> x, y -> z, y is up), the pre-rendered 2D floor becomes the ground texture, and every wall becomes a box
// whose top face shows the same floor art.

R3D.mission = (() => {
  const M = {};
  const SW = 960, SH = 640;
  const WALL_H = { shelf: 30, rack: 46, prack: 42, fridge: 36, container: 40, house: 40, showroom: 34, coldroom: 50, cage: 26, locker: 40, counter: 24, desk: 20, chair: 12, bed: 14, gurney: 16, bench: 14, benchrow: 14, pallet: 8, pump: 32, water: 1.5, paint: 1.5, rubble: 12, sandbag: 14, lumber: 20, luggage: 9, carousel: 9, forklift: 26, boat: 16, cart: 14, tower: 80, cell: 30 };
  const GUN_LEN = { pistol: .26, old_rifle: .8, shotgun: .75, smg: .42, hunting: .92, assault: .78 };
  const ZSKIN = { walker: '#7d9468', brute: '#8c946a', runner: '#a3ad84', spitter: '#97c93f', armored: '#6f8a6c', mutant: '#b04a3a' };
  const CLOTH = ['#5a5348', '#3f4a56', '#6a4a3a', '#4a5a4a', '#6a6a6a', '#4a3a5a'];
  const ZLOOK = { walker: [40, 1], brute: [54, 1.5], runner: [38, .95], spitter: [40, 1.05], armored: [42, 1.1], mutant: [78, 1.7] };
  const probe = document.createElement('canvas'); probe.width = probe.height = 1; const pctx = probe.getContext('2d', { willReadFrequently: true });

  const avgColor = (cv, x, y, w, h) => {   // average colour of a patch of the floor art: gives walls a side colour that matches their top
    try { pctx.clearRect(0, 0, 1, 1); pctx.drawImage(cv, Math.max(0, x), Math.max(0, y), Math.max(1, Math.min(w, SW - x)), Math.max(1, Math.min(h, SH - y)), 0, 0, 1, 1); const d = pctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }
    catch (e) { return [120, 120, 120]; }
  };
  const rgb = ([r, g, b], k = 1) => `rgb(${Math.round(Math.min(255, r * k))},${Math.round(Math.min(255, g * k))},${Math.round(Math.min(255, b * k))})`;

  // ---------------------------------------------------------------- build
  M.build = (m, town) => {
    const g = m.gl = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(40, 1, 20, 3500), tx: m.p.x, tz: m.p.y, dist: 700, pitch: 1.0, walls: new Map(), zs: new Map(), hs: new Map(), crates: new Map(), t0: 0 };
    const sc = g.scene, night = m.night, indoor = m.indoor;
    sc.background = new THREE.Color(night ? '#02040a' : indoor ? '#14181a' : '#8fb2c8');
    sc.fog = night ? new THREE.Fog('#02040a', 620, 1500) : new THREE.Fog(indoor ? '#14181a' : '#9db9c8', 900, 2600);
    // lights: a fixed set (switching lights on and off would recompile shaders), intensities do the work
    g.hemi = new THREE.HemisphereLight(night ? '#4a5a96' : '#e6eefb', night ? '#05070c' : '#6b6a5c', night ? .5 : indoor ? 1.5 : 1.7); sc.add(g.hemi);
    g.sun = new THREE.DirectionalLight(night ? '#7a92ff' : '#fff1d6', night ? .45 : indoor ? 1.2 : 2.3);
    g.sun.position.set(SW / 2 - 320, 760, SH / 2 + 220); g.sun.target.position.set(SW / 2, 0, SH / 2); sc.add(g.sun, g.sun.target);
    g.sun.castShadow = !night; const sh = g.sun.shadow; sh.mapSize.set(2048, 2048); sh.camera.left = -720; sh.camera.right = 720; sh.camera.top = 560; sh.camera.bottom = -560; sh.camera.near = 100; sh.camera.far = 2000; sh.bias = -.0006;
    g.torch = new THREE.SpotLight('#fff0c4', night ? 5 : 0, 640, .56, .75, 0); g.torch.castShadow = night; g.torch.shadow.mapSize.set(1024, 1024); g.torch.shadow.camera.near = 10; g.torch.shadow.bias = -.001; sc.add(g.torch, g.torch.target);
    g.glow = new THREE.PointLight('#ffe9b8', night ? 1.7 : 0, 200, 0); sc.add(g.glow);
    g.muzzle = new THREE.PointLight('#ffc060', 0, 240, 0); sc.add(g.muzzle);
    g.fireL = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ff8a30', 0, 300, 0); sc.add(l); return l; });
    g.blastL = new THREE.PointLight('#ffb050', 0, 480, 0); sc.add(g.blastL);

    // ground: the pre-rendered floor on the stage, a plain plane around it
    g.floorCv = m.floor; g.floorTex = R3D.canvasTex(m.floor); g.floorTex.wrapS = g.floorTex.wrapT = THREE.MirroredRepeatWrapping;
    g.floorMat = new THREE.MeshLambertMaterial({ map: g.floorTex });
    // the floor art fills the stage and is mirrored outwards so the ground reaches the horizon (walls use the middle tile only)
    const T = 7, fgeo = new THREE.PlaneGeometry(SW * T, SH * T), fuv = fgeo.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) - .5) * T + .5, (fuv.getY(i) - .5) * T + .5);
    const floor = new THREE.Mesh(fgeo, g.floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(SW / 2, 0, SH / 2); floor.receiveShadow = true; sc.add(floor);
    g.root = new THREE.Group(); sc.add(g.root);

    // outer wall ring (indoor) / chain-link fence (lots and depots), with openings where the doors are
    const B = m.bounds, edges = [['t', 0, 0, SW, B.y0], ['b', 0, B.y1, SW, SH - B.y1], ['l', 0, B.y0, B.x0, B.y1 - B.y0], ['r', B.x1, B.y0, SW - B.x1, B.y1 - B.y0]];
    if (indoor || m.fenced) {
      const tall = indoor ? 54 : 20;
      for (const [side, x, y, w, h] of edges) {
        const horiz = side === 't' || side === 'b', len = horiz ? w : h, a0 = horiz ? x : y;
        let spans = [[a0, a0 + len]];
        for (const gp of m.gaps.filter(q => q.s === side)) { const next = []; for (const [s0, s1] of spans) { const c0 = gp.c - gp.w / 2, c1 = gp.c + gp.w / 2; if (c1 <= s0 || c0 >= s1) next.push([s0, s1]); else { if (c0 > s0) next.push([s0, c0]); if (c1 < s1) next.push([c1, s1]); } } spans = next; }
        for (const [s0, s1] of spans) {
          const bx = horiz ? s0 : x, by = horiz ? y : s0, bw = horiz ? s1 - s0 : w, bh = horiz ? h : s1 - s0;
          if (bw < 2 || bh < 2) continue;
          if (indoor) { const wall = { x: bx, y: by, w: bw, h: bh, style: 'ring' }; g.root.add(M.wallMesh(m, g, wall, side === 'b' ? 9 : tall)); }   // the near wall stays low so it never hides the floor
          else { const fx = horiz ? bx : (side === 'l' ? B.x0 - 2 : B.x1), fy = horiz ? (side === 't' ? B.y0 - 2 : B.y1) : by, fw = horiz ? bw : 2, fh = horiz ? 2 : bh; const f = R3D.mesh(R3D.box(fw, tall, fh), R3D.mat('#aab4ba', { op: .45 }), fx + fw / 2, tall / 2, fy + fh / 2, g.root, false); }
        }
      }
    }
    // everything else that moves or changes
    g.ents = new THREE.Group(); sc.add(g.ents);
    g.bullets = R3D.pool(() => { const o = R3D.mesh(R3D.box(16, 1.8, 1.8), R3D.basic('#ffe8a0'), 0, 0, 0, g.ents, false); return o; });
    g.ebullets = R3D.pool(() => R3D.mesh(R3D.box(14, 2.4, 2.4), R3D.basic('#ff7a30'), 0, 0, 0, g.ents, false));
    g.flames = R3D.pool(() => { const f = R3D.flame(); g.ents.add(f); return f; });
    g.rings = R3D.pool(() => { const o = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffe8aa', transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false })); o.rotation.x = -Math.PI / 2; o.position.y = 1; g.ents.add(o); return o; });
    g.acid = R3D.pool(() => { const o = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#a8e63a', transparent: true, opacity: .6, depthWrite: false })); o.rotation.x = -Math.PI / 2; o.position.y = 1.2; g.ents.add(o); return o; });
    g.spits = R3D.pool(() => R3D.mesh(R3D.sphere(4.5, 8), R3D.basic('#b8f04a'), 0, 0, 0, g.ents, false));
    g.blasts = R3D.pool(() => { const o = R3D.mesh(R3D.sphere(1, 14), new THREE.MeshBasicMaterial({ color: '#ffb44a', transparent: true, opacity: .8, depthWrite: false }), 0, 0, 0, g.ents, false); return o; });
    g.thrown = R3D.pool(() => { const o = new THREE.Group(); o.add(R3D.mesh(R3D.cyl(3, 3, 11, 8), R3D.mat('#3a8a52'), 0, 0, 0, null)); o.add(R3D.mesh(R3D.box(7, 5, 14), R3D.mat('#6a6e76'), 0, 0, 0, null)); g.ents.add(o); return o; });
    g.parts = R3D.particles(500, 3.2); g.ents.add(g.parts);
    g.swing = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 28, 1, 0, 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false })); g.swing.rotation.x = Math.PI / 2; g.swing.position.y = 20; g.swing.visible = false; g.ents.add(g.swing);
    g.blade = R3D.mesh(R3D.box(1, 3, 5), R3D.mat('#9aa'), 0, 0, 0, g.ents, false); g.blade.visible = false;
    g.cracks = R3D.pool(() => { const o = new THREE.Group(); const mat = new THREE.LineBasicMaterial({ color: '#1a120a' }); const pts = []; for (let i = 0; i < 6; i++) { const a = i * 1.05 + .3; pts.push(0, 0, 0, Math.cos(a) * 24, 0, Math.sin(a) * 24); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const ls = new THREE.LineSegments(geo, mat); ls.position.y = 1.3; o.add(ls); g.ents.add(o); return o; });
    // player
    const L = gearLook();
    g.player = R3D.humanoid({ skin: '#d4a77f', shirt: L.coat, pants: '#2b3340', hat: '#243444', extra: L.pack || '#4a4438', boots: !!L.boot, scale: 40, pack: .6 + .8 * 0, gun: m.wR.id, pose: 'aim' });
    g.ents.add(g.player); g.player.userData.own.extra.color.set(L.pack || '#4a4438');
    g.gunId = m.wR.id;
    g.blade.material.color.set(m.wM.col || '#9aa');
    g.ready = true; g.lastTown = town;
  };

  // a wall as a box: sides take the colour of the art, the top shows the art itself
  M.wallMesh = (m, g, w, forceH) => {
    const grp = new THREE.Group(), st = w.style;
    const px = w.x, py = w.y, ww = w.w, hh = w.h, cx = px + ww / 2, cz = py + hh / 2;
    const avg = avgColor(g.floorCv, px, py, ww, hh);
    const tex = (geo, x0, y0, x1, y1) => { const uv = geo.attributes.uv; const u0 = x0 / SW, u1 = x1 / SW, v0 = 1 - y0 / SH, v1 = 1 - y1 / SH; uv.setXY(8, u0, v0); uv.setXY(9, u1, v0); uv.setXY(10, u0, v1); uv.setXY(11, u1, v1); uv.needsUpdate = true; };
    if (st === 'car') {
      const long = ww >= hh, L = long ? ww : hh, Wd = long ? hh : ww;
      const car = R3D.vehicle(w.veh || 'car', w.col || '#666', L, Wd, { burnt: w.burnt, cargo: w.military ? '#4a5a2a' : undefined }); car.position.set(cx, 0, cz); if (!long) car.rotation.y = Math.PI / 2;
      grp.add(car); grp.userData.sig = (w.burnt ? 1 : 0) + (w.alarmOn ? 2 : 0); return grp;
    }
    if (st === 'tree') {
      const r = Math.min(ww, hh) / 2;
      grp.add(R3D.mesh(R3D.cyl(r * .2, r * .32, 36, 9), R3D.mat('#5a3d22'), cx, 18, cz));
      for (let i = 0; i < 6; i++) { const a = i * 2.4 + px, rr = i ? r * .55 : 0; const c = R3D.mesh(R3D.blob((i ? .55 : .85) * r, i + 3), R3D.mat(rgb(avg, .7 + (i % 3) * .1)), cx + Math.cos(a) * rr, 44 + (i % 3) * 5 + (i ? 0 : 6), cz + Math.sin(a) * rr); c.rotation.y = i; grp.add(c); }
      return grp;
    }
    if (st === 'tent') {
      const t = R3D.mesh(R3D.prism(ww, 38, hh), R3D.mat(rgb(avg, .95)), cx, 0, cz); grp.add(t); return grp;
    }
    if (st === 'house') {
      const bh = 40, geo = new THREE.BoxGeometry(ww, bh, hh); tex(geo, px, py, px + ww, py + hh);
      const side = R3D.mat(rgb(avg, .85)); const body = new THREE.Mesh(geo, [side, side, R3D.mat('#000'), side, side, side]); body.position.set(cx, bh / 2, cz); body.castShadow = body.receiveShadow = true; grp.add(body);
      const roof = R3D.mesh(R3D.prism(ww + 6, 20, hh + 6), R3D.mat('#8a4a3a'), cx, bh, cz); if (hh > ww) roof.rotation.y = Math.PI / 2, roof.geometry = R3D.prism(hh + 6, 20, ww + 6); grp.add(roof); return grp;
    }
    if (st === 'ring') {
      const geo = new THREE.BoxGeometry(ww, forceH, hh); tex(geo, px, py, px + ww, py + hh);
      const side = R3D.mat(rgb(avg, .7)); const mesh = new THREE.Mesh(geo, [side, side, new THREE.MeshLambertMaterial({ color: rgb(avg, .75) }), side, side, side]); mesh.position.set(cx, forceH / 2, cz); mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh); return grp;
    }
    if (st === 'inv') {
      if (w.vault) { grp.add(R3D.mesh(R3D.box(ww, 44, hh), R3D.mat('#2a3642'), cx, 22, cz)); grp.add(R3D.mesh(R3D.cyl(11, 11, 4, 14), R3D.mat('#d8b030'), cx, 24, cz + hh / 2 + 1)).rotation.x = Math.PI / 2; grp.userData.vault = true; }
      else if (w.hole) { const d = new THREE.Mesh(new THREE.CircleGeometry(27, 20), new THREE.MeshBasicMaterial({ color: '#050403' })); d.rotation.x = -Math.PI / 2; d.position.set(cx, 1.4, cz); grp.add(d); }
      else if (w.cage) { for (let i = -2; i <= 2; i++) { grp.add(R3D.mesh(R3D.cyl(1.2, 1.2, 34, 6), R3D.mat('#8a8f96'), cx + i * 9, 17, cz - 22)); grp.add(R3D.mesh(R3D.cyl(1.2, 1.2, 34, 6), R3D.mat('#8a8f96'), cx + i * 9, 17, cz + 22)); grp.add(R3D.mesh(R3D.cyl(1.2, 1.2, 34, 6), R3D.mat('#8a8f96'), cx - 22, 17, cz + i * 9)); grp.add(R3D.mesh(R3D.cyl(1.2, 1.2, 34, 6), R3D.mat('#8a8f96'), cx + 22, 17, cz + i * 9)); } grp.add(R3D.mesh(R3D.box(46, 2, 46), R3D.mat('#8a8f96'), cx, 35, cz)); }
      return grp;
    }
    const h = WALL_H[st] || 20, geo = new THREE.BoxGeometry(ww, h, hh); tex(geo, px, py, px + ww, py + hh);
    const k = st === 'container' || st === 'counter' || st === 'locker' ? 1 : .92, side = new THREE.MeshLambertMaterial({ color: rgb(w.col ? hexToRgb(w.col) : avg, k), flatShading: true });
    const mesh = new THREE.Mesh(geo, [side, side, g.floorMat, side, side, side]); mesh.position.set(cx, h / 2, cz); mesh.castShadow = h > 3; mesh.receiveShadow = true; grp.add(mesh);
    return grp;
  };
  const hexToRgb = c => { const n = parseInt(c.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  // loot is drawn as the thing itself: cans, bottles, ammo boxes, jerrycans, packs, guns...
  const GEAR_LEN = { pistol: 13, old_rifle: 26, shotgun: 26, smg: 16, hunting: 30, assault: 26 };
  const crateMesh = c => {
    const g = new THREE.Group(), k = c.keys ? 'keys' : c.relay ? 'relay' : c.card ? 'card' : c.drive ? 'drive' : c.k, col = CRATE_COL[k] || '#c8c8d0';
    const it = new THREE.Group(); g.add(it);
    const bx = (w, h, d, color, x, y, z, o) => R3D.mesh(R3D.box(w, h, d), R3D.mat(color, o), x, y + h / 2, z, it);
    const cy = (r, h, color, x, y, z, o, seg = 10) => R3D.mesh(R3D.cyl(r, r, h, seg), R3D.mat(color, o), x, y + h / 2, z, it);
    const lay = (m, rz, ry = 0) => { m.rotation.z = rz; m.rotation.y = ry; return m; };
    if (k === 'food') {
      for (const [x, z, c2] of [[-5, -2, '#c0392b'], [3, -4, '#d9822b'], [2, 5, '#3a8a4a']]) { cy(3.6, 7, c2, x, 0, z); cy(3.7, 1, '#cfd3d6', x, 7, z); cy(3.7, 1, '#cfd3d6', x, 0, z); }
      bx(12, 4, 6, '#c8985a', -4, 0, 7).rotation.y = .3;
    } else if (k === 'water') {
      for (const x of [-6, 0, 6]) { cy(3.3, 13, '#7ec8f0', x, 0, 0, { op: .75 }); cy(1.6, 3, '#2a6ab0', x, 13, 0); cy(3.3, 4, '#2a6ab0', x, 4, 0, { op: .9 }); }
    } else if (k === 'ammo') {
      bx(16, 8, 10, '#566a2e', -2, 0, 0); bx(16.5, 1.5, 10.5, '#3a4a20', -2, 8, 0); bx(3, 3, 1.5, '#aaa', -2, 4, 5.5);
      for (const x of [8, 11]) { cy(1.2, 5, '#d8b050', x, 0, 8, {}, 6); cy(1, 2.4, '#b87333', x, 5, 8, {}, 6); }
    } else if (k === 'shells') {
      for (const [x, z] of [[-6, -3], [-2, 3], [3, -3], [7, 3]]) { cy(2.3, 8, '#c8362a', x, 0, z, {}, 8); cy(2.4, 2.6, '#d8b050', x, 0, z, {}, 8); }
    } else if (k === 'meds') {
      bx(16, 10, 11, '#f2f2f2', 0, 0, 0); bx(4, 1, 10, '#d02a2a', 0, 10, 0); bx(10, 1, 4, '#d02a2a', 0, 10, 0); bx(17, 1.5, 11.5, '#cfcfcf', 0, 4.5, 0); bx(4, 3, 1.5, '#888', 0, 7, 6);
    } else if (k === 'scrap') {
      for (const [x, z, w, h, d, r, c2] of [[-5, -3, 9, 2, 5, .3, '#8a8f96'], [3, 2, 7, 3, 6, -.5, '#6a6e74'], [-2, 5, 10, 1.5, 3, .9, '#a8acb2'], [6, -4, 4, 6, 4, .2, '#7a5a3a']]) bx(w, h, d, c2, x, 0, z).rotation.y = r;
      cy(5, 2, '#9aa0a6', -1, 3, -1, {}, 12).rotation.x = .15; cy(1.5, 2.4, '#3a3d40', -1, 3, -1, {}, 8);
    } else if (k === 'wood') {
      for (const [y, z] of [[0, -4], [0, 0], [0, 4], [6, -2], [6, 2]]) lay(cy(3.2, 18, '#8a5a32', 0, y + 3, z, {}, 8), Math.PI / 2, 0);
      for (const [y, z] of [[0, -4], [0, 0], [0, 4], [6, -2], [6, 2]]) { const e = cy(2.4, .5, '#d8b070', 9.1, y + 3, z, {}, 8); e.rotation.z = Math.PI / 2; }
    } else if (k === 'diesel') {
      bx(12, 15, 6, '#c8302a', -1, 0, 0); bx(5, 3, 5, '#a02020', -4, 15, 0); cy(1.4, 3, '#e8c020', 3, 15, 0, {}, 8); bx(8, 1.5, 2, '#a02020', -2, 16, 0); bx(7, 5, .6, '#e8e0c0', -1, 5, 3.2);
    } else if (k === 'gear') {
      const gi = GEAR_BY_ID[c.g] || {}, gc = gi.col || '#888', sl = gi.slot;
      if (sl === 'pack') { bx(13, 16, 8, gc, 0, 0, 0); bx(11, 6, 2, shadeHex(gc, .7), 0, 2, 5); bx(10, 3, 8.4, shadeHex(gc, .8), 0, 13, 0); bx(2, 9, 1, '#222', -4, 4, -4.4); bx(2, 9, 1, '#222', 4, 4, -4.4); }
      else if (sl === 'body') { bx(14, 3, 16, gc, 0, 0, 0); bx(5, 3.2, 8, gc, -9.5, 0, -4).rotation.y = .5; bx(5, 3.2, 8, gc, 9.5, 0, -4).rotation.y = -.5; bx(4, 3.4, 4, shadeHex(gc, .6), 0, 0, -7); bx(.8, 3.4, 14, '#ddd', 0, 0, 0); }
      else if (sl === 'boots') { for (const x of [-5, 5]) { bx(6, 7, 14, gc, x, 0, 0); bx(6.4, 2, 6, shadeHex(gc, .55), x, 0, -4); bx(6, 4, 6, gc, x, 7, 4); } }
      else if (sl === 'ranged') { const L = GEAR_LEN[gi.id] || 22; bx(L, 3, 3, '#2a2d30', 0, 2, 0); bx(L * .4, 4, 3.4, '#6a4a2a', -L * .3, 1, 0); bx(3, 7, 3, '#2a2d30', L * .1, -3, 0); if (L > 20) bx(L * .3, 2, 2, '#444', L * .5, 3, 0); it.rotation.y = .6; }
      else if (sl === 'melee') { const mc = gi.col || '#9aa'; if (gi.id === 'axe') { bx(22, 2.4, 2.4, '#7a5a3a', 0, 1, 0); bx(7, 7, 2, '#c0c4c8', 8, 1, 0); } else if (gi.id === 'machete') { bx(5, 2.4, 2.4, '#222', -9, 1, 0); bx(20, 1.2, 4, '#c0c4c8', 3, 1, 0); } else if (gi.id === 'bat') { lay(cy(1.4, 24, '#b08a5a', 0, 1, 0, {}, 8), Math.PI / 2); } else { bx(24, 2.6, 2.6, mc, 0, 1, 0); bx(3, 2.6, 6, mc, -11, 1, 0); } it.rotation.y = .5; }
      else { bx(16, 11, 12, '#4a2a66', 0, 0, 0, { em: '#8a4ad0', ei: .5 }); bx(17, 3, 13, '#d8b030', 0, 8, 0); }
    } else if (c.keys) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4, .9, 6, 14), R3D.mat('#cfe4ff')); ring.rotation.x = Math.PI / 2; ring.position.set(-4, 1.5, 0); it.add(ring); bx(10, 3, 7, '#1a2a3a', 4, 0, 0, { em: '#7ab8ff', ei: .6 }); bx(5, 3.4, 3, '#7ab8ff', 5, 0, 0, { em: '#7ab8ff', ei: .8 });
    } else if (c.card) { bx(14, 1.4, 9, '#1c2a32', 0, 0, 0, { em: '#6fe', ei: .5 }); bx(12, 1.6, 2, '#6fe', 0, 0, -1.5, { em: '#6fe', ei: 1 }); bx(5, 1.6, 2, '#6fe', -3, 0, 2, { em: '#6fe', ei: 1 }); }
    else if (c.drive) { bx(14, 3, 7, '#2a1c3a', 0, 0, 0, { em: '#c8f', ei: .5 }); bx(5, 2, 5, '#cfd3d6', 9, .5, 0); bx(2, 3.4, 4, '#c8f', -3, 0, 0, { em: '#c8f', ei: 1 }); }
    else if (c.relay) { bx(14, 8, 10, '#1c2a32', 0, 0, 0, { em: '#6fe', ei: .4 }); bx(4, 2, 2, '#6fe', -3, 8, 0, { em: '#6fe', ei: 1 }); bx(4, 2, 2, '#6fe', 3, 8, 0, { em: '#6fe', ei: 1 }); cy(.7, 14, '#6fe', 6, 8, 0, { em: '#6fe', ei: 1 }, 5); }
    else { bx(15, 12, 15, col, 0, 0, 0); }   // anything unknown stays a plain crate
    if (c.drop) it.scale.setScalar(.85); else it.scale.setScalar(1.15);
    it.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const special = c.keys || c.card || c.drive || c.relay; if (special) { it.position.y = 0; g.userData.float = true; it.traverse(o => { if (o.isMesh && o.userData) o.userData.bob = false; }); it.userData.bob = true; }
    const ring = new THREE.Mesh(new THREE.RingGeometry(15, 17, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 1; g.add(ring); g.userData.ring = ring; g.userData.it = it;
    g.rotation.y = ((c.x * 7 + c.y * 3) % 40 - 20) * Math.PI / 180; return g;
  };
  const shadeHex = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

  const zombieMesh = z => {
    const [s, bulk] = ZLOOK[z.kind] || ZLOOK.walker, skin = ZSKIN[z.kind] || ZSKIN.walker;
    const h = R3D.humanoid({ skin, shirt: z.kind === 'spitter' ? '#566a2a' : CLOTH[z.vi % CLOTH.length], pants: '#303236', hat: z.kind === 'armored' ? '#40464c' : skin, extra: '#3a4046', scale: s, bulk, pose: 'zombie', belly: z.kind === 'spitter', plates: z.kind === 'armored', lean: z.kind === 'runner' ? .22 : 0 });
    for (const sg of [-1, 1]) { const e = new THREE.Mesh(R3D.box(.02, .025, .03), R3D.basic('#ff2a1e')); e.position.set(.07, .016, sg * .04); h.userData.head.add(e); }
    if (z.kind === 'mutant') { for (const sg of [-1, 1]) { const sp = new THREE.Mesh(R3D.cone(.03, .14, 5), R3D.mat('#d8cfae')); sp.position.set(0, .12, sg * .07); h.userData.head.add(sp); } }
    return h;
  };
  const humanMesh = h => R3D.humanoid({ skin: '#c89a74', shirt: h.leader ? '#6a1a1a' : '#8a4a28', pants: '#2a2420', hat: '#2a2420', extra: '#5a2a1a', scale: h.leader ? 46 : 40, bulk: h.leader ? 1.25 : 1, gun: h.leader ? 'assault' : 'old_rifle', pose: 'aim', twoHand: true });
  const npcMesh = () => R3D.humanoid({ skin: '#caa07a', shirt: '#c0792b', pants: '#3a3a40', hat: '#5a3a1a', scale: 38, pose: 'idle' });

  const sync = (map, list, make, upd) => {
    const seen = new Set();
    for (const o of list) { let r = map.get(o); if (!r) { r = make(o); map.set(o, r); M.cur.ents.add(r); } upd(r, o); seen.add(o); }
    for (const [o, r] of map) if (!seen.has(o)) { M.cur.ents.remove(r); const mt = r.userData && r.userData.mats; if (mt) mt.forEach(x => x.dispose()); map.delete(o); }
  };
  const faceTo = (obj, a) => { obj.rotation.y = -a; };

  // ---------------------------------------------------------------- camera + aim
  M.wheel = (m, f) => { if (m.gl) m.gl.dist = Math.max(300, Math.min(900, m.gl.dist / f)); };
  M.aim = m => {   // the mouse ray at chest height becomes the 2D aim point the mission logic already understands
    const g = m.gl; if (!g || !g.ready) return;
    const p = R3D.ground(g.camera, 18); if (p) { mouse.x = p.x; mouse.y = p.z; }
  };

  // ---------------------------------------------------------------- one frame
  M.frame = (m, town, dt, t) => {
    if (!m.gl) M.build(m, town);
    const g = m.gl; M.cur = g;
    if (g.floorCv !== m.floor) { g.floorCv = m.floor; g.floorTex.image = m.floor; }
    if (m.floorDirty) { g.floorTex.needsUpdate = true; m.floorDirty = false; }
    const p = m.p, night = m.night;
    // walls: add new, drop taken cars and opened vaults
    const seenW = new Set();
    for (const w of m.walls) {
      seenW.add(w); const sig = (w.burnt ? 1 : 0), rec = g.walls.get(w);
      if (rec && rec.userData.sig !== sig) { g.root.remove(rec); g.walls.delete(w); }
      if (!g.walls.has(w)) { const mesh = M.wallMesh(m, g, w); mesh.userData.sig = sig; g.root.add(mesh); g.walls.set(w, mesh); }
    }
    for (const [w, mesh] of g.walls) if (!seenW.has(w)) { g.root.remove(mesh); g.walls.delete(w); }
    // crates
    sync(g.crates, m.crates, crateMesh, (r, c) => {
      const sp = r.userData.float, bob = sp ? 10 + Math.sin(t * 3 + c.x) * 2 : 0; r.position.set(c.x, bob, c.y);
      if (sp) r.userData.it.rotation.y = t * 1.6; if (r.userData.ring) r.userData.ring.material.opacity = .35 + Math.sin(t * 4 + c.y) * .15;
    });
    // the infected
    sync(g.zs, m.zombies, zombieMesh, (r, z) => {
      const u = r.userData, sp = Math.hypot(z.x - (u.lx ?? z.x), z.y - (u.ly ?? z.y)) / Math.max(.001, dt); u.lx = z.x; u.ly = z.y;
      r.position.set(z.x, 0, z.y); faceTo(r, z.a || 0);
      R3D.pose(r, z.walk + z.wob, Math.min(1, sp / 45), { chase: z.state === 'chase' });
      const burn = z.burnT > 0, hit = z.hit > 0; R3D.tint(r, burn ? '#ff7a20' : '#ff3a2a', burn ? .8 : hit ? .9 : 0);
    });
    sync(g.hs, m.humans, humanMesh, (r, h) => {
      r.position.set(h.x, 0, h.y); faceTo(r, h.a || 0);
      R3D.pose(r, h.walk || 0, h.moving ? 1 : 0, {}); R3D.tint(r, '#ffcf60', h.flash > 0 ? .9 : 0);
    });
    if (m.npc && m.npc.state !== 'dead') {
      if (!g.npc) { g.npc = npcMesh(); g.ents.add(g.npc); }
      const n = m.npc; g.npc.position.set(n.x, 0, n.y); faceTo(g.npc, n.a || 0); R3D.pose(g.npc, n.walk || 0, n.moving ? 1 : 0, {});
    } else if (g.npc) { g.ents.remove(g.npc); g.npc = null; }
    // the player
    const pl = g.player; pl.position.set(p.x, 0, p.y); faceTo(pl, p.a || 0);
    if (g.gunId !== m.wR.id) { g.gunId = m.wR.id; pl.userData.setGun(m.wR.id); }
    const bag = Math.min(1, Object.values(m.carried).reduce((s, n) => s + n, 0) / m.cap);
    pl.userData.own.extra.color.set(bag > .85 ? '#6a4a2a' : bag > .4 ? '#54482e' : '#3d3a30');
    R3D.pose(pl, p.walk || 0, p.moving ? 1 : 0, { crouch: m.sneak, swing: m.swing ? 1 - m.swing.t / .2 : undefined });
    R3D.tint(pl, '#ff3030', m.hurtT > 0 ? .8 : 0);
    // projectiles and effects
    g.bullets.begin(); for (const b of m.bullets) { const o = g.bullets.next(); o.position.set(b.x, 22, b.y); o.rotation.y = -Math.atan2(b.vy, b.vx); } g.bullets.end();
    g.ebullets.begin(); for (const b of m.ebullets) { const o = g.ebullets.next(); o.position.set(b.x, 22, b.y); o.rotation.y = -Math.atan2(b.vy, b.vx); } g.ebullets.end();
    g.spits.begin(); for (const s of m.spits) g.spits.next().position.set(s.x, 20, s.y); g.spits.end();
    g.acid.begin(); for (const a of m.acid) { const o = g.acid.next(); o.position.set(a.x, 1.2, a.y); o.scale.set(a.r, a.r, 1); o.material.opacity = Math.min(.6, a.l / 1.2 * .6); } g.acid.end();
    g.rings.begin(); for (const r of m.rings) { const pr = Math.min(1, r.t / .6), o = g.rings.next(); o.position.set(r.x, 1, r.y); o.scale.set(r.r * pr, r.r * pr, 1); o.material.opacity = (1 - pr) * .4; } g.rings.end();
    g.blasts.begin(); let bl = 0; for (const b of m.blasts) { const pr = 1 - b.l / .45, o = g.blasts.next(), rr = b.r * (.4 + pr * .6); o.position.set(b.x, 14, b.y); o.scale.setScalar(rr * .7); o.material.opacity = Math.max(0, .85 * (1 - pr)); bl = Math.max(bl, 1 - pr); g.blastL.position.set(b.x, 50, b.y); } g.blasts.end();
    g.blastL.intensity = bl * 14;
    g.thrown.begin(); for (const o of m.thrown) { const q = g.thrown.next(); q.position.set(o.x, 8 + o.h, o.y); q.rotation.set(t * 12, t * 9, 0); q.children[0].visible = o.type === 'molotov'; q.children[1].visible = o.type !== 'molotov'; } g.thrown.end();
    // fire: flames on every patch and on burning infected, the first three patches also light the scene
    g.flames.begin(); let fi = 0;
    for (const f of m.fires) {
      const k = Math.min(1, f.l / 1.2), n = Math.max(3, Math.round(f.r / 7));
      for (let i = 0; i < n; i++) { const an = i * 2.4 + f.x * .1, rr = f.r * .6 * ((i % 3) + 1) / 3, fl = g.flames.next(); fl.position.set(f.x + Math.cos(an) * rr, 0, f.y + Math.sin(an) * rr); const sz = f.r * .17 * k; fl.scale.set(sz, sz * 1.5, sz); R3D.flicker(fl, t, i); }
      if (fi < 3) { const L = g.fireL[fi++]; L.position.set(f.x, 36, f.y); L.intensity = 3.2 * k; }
    }
    for (const z of m.zombies) if (z.burnT > 0) { const fl = g.flames.next(), s = (ZLOOK[z.kind] || ZLOOK.walker)[0]; fl.position.set(z.x, s * .35, z.y); fl.scale.setScalar(s * .09); R3D.flicker(fl, t, z.wob); }
    if (m.thrown.length) for (const o of m.thrown) if (o.type === 'molotov') { const fl = g.flames.next(); fl.position.set(o.x, 8 + o.h, o.y); fl.scale.setScalar(3); R3D.flicker(fl, t, 1); }
    g.flames.end(); for (; fi < 3; fi++) g.fireL[fi].intensity = 0;
    // sparks and blood
    g.parts.userData.set(m.parts, q => [q.x, 6 + Math.max(0, .7 - q.l) * 34, q.y, q.c]);
    // melee swing
    if (m.swing) {
      const pr = 1 - m.swing.t / .2, a0 = m.swing.a - 1.0 + pr * 2.0; g.swing.visible = g.blade.visible = true;
      g.swing.position.set(p.x, 22, p.y); g.swing.scale.setScalar(m.swing.reach); g.swing.rotation.z = m.swing.a - 1.0; g.swing.material.opacity = .5 * (1 - pr);
      const rr = m.swing.reach - 4; g.blade.position.set(p.x + Math.cos(a0) * rr * .6, 24, p.y + Math.sin(a0) * rr * .6); g.blade.scale.x = rr * .9; g.blade.rotation.y = -a0;
    } else g.swing.visible = g.blade.visible = false;
    // cracks that have not collapsed yet
    g.cracks.begin(); for (const c of m.cracks || []) if (c.st === 'idle') g.cracks.next().position.set(c.x, 0, c.y); g.cracks.end();

    // lighting follows the player
    g.glow.position.set(p.x, 34, p.y);
    g.torch.position.set(p.x, 36, p.y); g.torch.target.position.set(p.x + Math.cos(p.a || 0) * 220, 0, p.y + Math.sin(p.a || 0) * 220); g.torch.target.updateMatrixWorld();
    const fl = m.flashT > 0 ? 1 : 0; g.muzzle.position.set(p.x + Math.cos(p.a || 0) * 34, 30, p.y + Math.sin(p.a || 0) * 34); g.muzzle.intensity = fl * 5;
    if (!night && m.indoor) g.hemi.intensity = 1.45 + (Math.sin(t * 23) * Math.sin(t * 7.3) > .85 ? -.35 : 0);

    // camera: chase the player from the south, keep the stage mostly in frame
    const k = 1 - Math.pow(.0005, dt || .016);
    g.tx += (Math.max(260, Math.min(SW - 260, p.x)) - g.tx) * k; g.tz += (Math.max(190, Math.min(SH - 170, p.y)) - g.tz) * k;
    const sh = m.shake > 0 && SET.shake ? m.shake * 10 * SET.shake : 0, cam = g.camera;
    cam.position.set(g.tx + (sh ? (Math.random() - .5) * sh : 0), Math.sin(g.pitch) * g.dist + (sh ? (Math.random() - .5) * sh : 0), g.tz + Math.cos(g.pitch) * g.dist);
    cam.lookAt(g.tx, 0, g.tz);
    R3D.show(true);
    R3D.render(g.scene, cam);
    M.overlay(m, g, t);
  };

  // ---------------------------------------------------------------- 2D drawn over the 3D view (labels, alert marks, the reticle, damage)
  M.overlay = (m, g, t) => {
    const cam = g.camera, P = (x, h, sy) => R3D.toUI(x, h, sy, cam);   // (stage x, height, stage y)
    for (const f of m.floats) { const q = P(f.x, 40 + (f.y0 - f.y), f.y0); if (q) { ctx.globalAlpha = Math.min(1, f.l * 1.6); text(f.txt, q.x, q.y, 12, f.col, 'center'); } } ctx.globalAlpha = 1;
    for (const z of m.zombies) if (z.icoT > 0 && z.state !== 'idle') { const s = (ZLOOK[z.kind] || ZLOOK.walker)[0], q = P(z.x, s + 14, z.y); if (q) text(z.state === 'chase' ? '!' : '?', q.x, q.y, 18, z.state === 'chase' ? '#ff4a3a' : '#ffcf40', 'center'); }
    for (const h of m.humans) if (h.icoT > 0 && h.alert) { const q = P(h.x, 58, h.y); if (q) text('!', q.x, q.y, 18, '#ff4a3a', 'center'); }
    if (m.hot) { const c = m.hot.car, q = P(c.x + c.w / 2, 34, c.y + c.h / 2), pr = Math.min(1, m.hot.t / m.hot.need); if (q) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(q.x - 32, q.y - 4, 64, 9); ctx.fillStyle = c.alarm && m.hot.t > .3 ? '#ff5a3a' : '#7ab8ff'; ctx.fillRect(q.x - 31, q.y - 3, 62 * pr, 7); ctx.strokeStyle = '#fff'; ctx.strokeRect(q.x - 32.5, q.y - 4.5, 65, 10); } }
    if (m.nearCar && !m.hot) { const c = m.nearCar, q = P(c.x + c.w / 2, 40, c.y + c.h / 2); if (q) text(`HOLD E: hotwire ${VEHICLE_TYPES[c.veh].label}`, q.x, q.y, 11, '#bfe0ff', 'center'); }
    const v = vaultRect(m);
    if (v) { const q = P(v.x + v.w / 2, 54, v.y + v.h / 2); if (q) { text('VAULT', q.x, q.y, 11, '#9ab', 'center'); if (v.open) { ctx.fillStyle = '#000'; ctx.fillRect(q.x - v.w / 2, q.y + 8, v.w, 5); ctx.fillStyle = '#6fe'; ctx.fillRect(q.x - v.w / 2, q.y + 8, v.w * Math.min(1, v.open / 1.4), 5); } } }
    const n = m.npc;
    if (n && n.state === 'caged' && Math.hypot(m.p.x - n.x, m.p.y - n.y) < 52) { const q = P(n.x, 52, n.y); if (q) { ctx.fillStyle = '#000'; ctx.fillRect(q.x - 22, q.y, 44, 5); ctx.fillStyle = '#6fe'; ctx.fillRect(q.x - 22, q.y, 44 * Math.min(1, n.free / 2.5), 5); text('HOLD E', q.x, q.y - 8, 11, '#fff', 'center'); } }
    // damage flash + vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2 + 20, H * .4, W / 2, H / 2 + 20, H * .98); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg; ctx.fillRect(-UI.ox, -UI.oy, UI.lw, UI.lh);
    if (m.hurtT > 0) { const hv = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .85); hv.addColorStop(0, 'rgba(160,0,0,0)'); hv.addColorStop(1, `rgba(190,10,10,${Math.min(.6, m.hurtT * 2.2)})`); ctx.fillStyle = hv; ctx.fillRect(-UI.ox, -UI.oy, UI.lw, UI.lh); }
    if (!m.done) {   // reticle at the real cursor
      const rx = mouse.cx / UI.scale - UI.ox, ry = mouse.cy / UI.scale - UI.oy;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx, ry, 9, 0, 7); ctx.moveTo(rx - 15, ry); ctx.lineTo(rx - 5, ry); ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 15, ry); ctx.moveTo(rx, ry - 15); ctx.lineTo(rx, ry - 5); ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 15); ctx.stroke();
    }
  };
  return M;
})();
