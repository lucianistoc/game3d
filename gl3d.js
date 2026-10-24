// Shared Three.js layer for the 3D scenes (scavenging missions and the base). The game logic is untouched: the scenes
// still own their state, and these files only turn that state into meshes each frame. Menus, the map and every HUD
// stay on the 2D canvas, which is laid transparently over the WebGL canvas.
// If WebGL is missing (or the page is opened with ?2d) R3D.ok is false and the original 2D drawing is used.

const R3D = (() => {
  const R = { ok: false };
  const glc = document.getElementById('gl');
  let renderer = null;
  try {
    if (/[?&]2d\b/.test(location.search) || typeof THREE === 'undefined' || !glc) throw new Error('3D off');
    renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    R.ok = true;
  } catch (e) { R.ok = false; if (glc) glc.style.display = 'none'; }
  R.renderer = renderer;

  // ---------------------------------------------------------------- canvas + camera helpers
  let sizeKey = '';
  R.resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5), key = innerWidth + 'x' + innerHeight + '@' + dpr;
    if (key !== sizeKey) { sizeKey = key; renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); }
  };
  R.show = on => { if (glc) glc.style.visibility = on ? 'visible' : 'hidden'; };
  R.render = (scene, camera) => { R.resize(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
  const _v = new THREE.Vector3();
  // world point -> 2D UI coordinates (the space ctx draws in), or null when it is behind the camera
  R.toUI = (x, y, z, camera) => {
    _v.set(x, y, z).project(camera); if (_v.z > 1) return null;
    return { x: (_v.x + 1) / 2 * innerWidth / UI.scale - UI.ox, y: (1 - _v.y) / 2 * innerHeight / UI.scale - UI.oy };
  };
  const _ray = new THREE.Raycaster(), _pt = new THREE.Vector2();
  R.setRay = camera => { _pt.set(mouse.cx / innerWidth * 2 - 1, -(mouse.cy / innerHeight * 2 - 1)); _ray.setFromCamera(_pt, camera); return _ray; };
  // where the mouse ray meets the horizontal plane y = h
  R.ground = (camera, h = 0) => {
    const r = R.setRay(camera), d = r.ray.direction, o = r.ray.origin;
    if (Math.abs(d.y) < 1e-4) return null; const t = (h - o.y) / d.y; if (t < 0) return null;
    return new THREE.Vector3(o.x + d.x * t, h, o.z + d.z * t);
  };

  // ---------------------------------------------------------------- materials and geometry caches
  const mats = new Map(), geos = new Map();
  R.mat = (color, o = {}) => {
    const k = color + '|' + (o.em || '') + '|' + (o.op || 1) + '|' + (o.side || 0);
    let m = mats.get(k); if (m) return m;
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (o.em) { m.emissive = new THREE.Color(o.em); m.emissiveIntensity = o.ei || 1; }
    if (o.op !== undefined && o.op < 1) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
    if (o.side) m.side = THREE.DoubleSide;
    mats.set(k, m); return m;
  };
  R.basic = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
  R.box = (w, h, d) => { const k = `b${w}|${h}|${d}`; let g = geos.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); geos.set(k, g); } return g; };
  R.cyl = (rt, rb, h, seg = 12) => { const k = `c${rt}|${rb}|${h}|${seg}`; let g = geos.get(k); if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); geos.set(k, g); } return g; };
  R.sphere = (r, seg = 10) => { const k = `s${r}|${seg}`; let g = geos.get(k); if (!g) { g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)); geos.set(k, g); } return g; };
  R.cone = (r, h, seg = 8) => { const k = `n${r}|${h}|${seg}`; let g = geos.get(k); if (!g) { g = new THREE.ConeGeometry(r, h, seg); geos.set(k, g); } return g; };
  // a triangular prism (gable roof): footprint w x d, ridge along x, height h, sitting on y = 0
  R.prism = (w, h, d) => {
    const k = `p${w}|${h}|${d}`; let g = geos.get(k); if (g) return g;
    const hw = w / 2, hd = d / 2;
    const P = (x, y, z) => [x, y, z];
    const A = P(-hw, 0, -hd), B = P(hw, 0, -hd), C = P(hw, 0, hd), D = P(-hw, 0, hd), E = P(-hw, h, 0), F = P(hw, h, 0);
    const tris = [A, E, B, E, F, B, D, C, E, E, C, F, A, D, E, B, F, C, A, B, D, B, C, D];   // two slopes, two gable ends, base
    const pos = []; for (const p of tris) pos.push(...p);
    g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); geos.set(k, g); return g;
  };
  R.mesh = (geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; if (parent) parent.add(m); return m;
  };
  R.canvasTex = (cv, repeatX, repeatY) => {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeatX) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY || repeatX); }
    return t;
  };
  R.disposeTree = o => { o.traverse(c => { if (c.userData && c.userData.own) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } }); };

  // ---------------------------------------------------------------- low-poly people (unit height 1, facing +x, feet at y = 0)
  R.humanoid = o => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const own = {}, M = (k, c) => own[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    M('skin', o.skin || '#caa07a'); M('shirt', o.shirt || '#3a6a9a'); M('pants', o.pants || '#2b3340'); M('hat', o.hat || '#243444'); M('extra', o.extra || '#555');
    const part = (w, h, d, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(R.box(w, h, d), own[mat]); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const limb = (z, mat, len, w) => { const p = new THREE.Group(); p.position.set(0, mat === 'pants' ? .46 : .73, z); body.add(p); part(w, len, w, mat, 0, -len / 2, 0, p); return p; };
    const legL = limb(.065, 'pants', .46, .1), legR = limb(-.065, 'pants', .46, .1);
    part(.12, .06, .12, o.boots ? 'extra' : 'pants', 0, 0, 0, legL).position.set(.02, -.45, 0); part(.12, .06, .12, o.boots ? 'extra' : 'pants', 0, 0, 0, legR).position.set(.02, -.45, 0);
    part(.15, .3, .28, 'shirt', 0, .61, 0);
    const head = part(.15, .15, .15, 'skin', .01, .85, 0); part(.17, .05, .17, 'hat', .005, .93, 0);
    const armL = limb(.17, 'shirt', .3, .08), armR = limb(-.17, 'shirt', .3, .08);
    part(.085, .08, .085, 'skin', 0, -.3, 0, armL); part(.085, .08, .085, 'skin', 0, -.3, 0, armR);
    if (o.pack) part(.1, .2 * o.pack, .22, 'extra', -.13, .62, 0);
    if (o.belly) part(.2, .18, .3, 'skin', .06, .56, 0);
    if (o.plates) { part(.17, .3, .3, 'extra', 0, .61, 0); part(.19, .07, .19, 'extra', .005, .94, 0); part(.1, .1, .1, 'extra', 0, 0, 0, armL).position.set(0, -.02, 0); part(.1, .1, .1, 'extra', 0, 0, 0, armR).position.set(0, -.02, 0); }
    let gun = null;
    if (o.gun) { gun = new THREE.Group(); gun.position.set(0, -.3, 0); armR.add(gun); const gm = new THREE.MeshLambertMaterial({ color: '#2a2d30', flatShading: true }); own.gun = gm; const b = new THREE.Mesh(R.box(.05, o.gun, .05), gm); b.position.set(0, -o.gun / 2 + .06, 0); b.castShadow = true; gun.add(b); }
    const s = o.scale || 1, bx = o.bulk || 1; root.scale.set(s * bx, s, s * bx);
    root.userData = { own, body, legL, legR, armL, armR, head, gun, mats: Object.values(own), lean: o.lean || 0, pose: o.pose || 'idle' };
    return root;
  };
  // ph = walk phase, mv = 0..1 how fast the legs move
  R.pose = (g, ph, mv, extra = {}) => {
    const u = g.userData, sw = Math.sin(ph * 6.2) * mv, pose = extra.pose || u.pose;
    u.legL.rotation.z = sw * .8; u.legR.rotation.z = -sw * .8;
    if (pose === 'zombie') {
      const sway = Math.sin(ph * 3.1) * .12; u.armL.rotation.z = 1.35 + sway; u.armR.rotation.z = 1.25 - sway;
      u.body.rotation.z = -(.16 + (u.lean || 0)) - (extra.chase ? .1 : 0); u.head.rotation.z = .1 + Math.sin(ph * 2) * .06;
    } else if (pose === 'aim') {
      u.armR.rotation.z = 1.5; u.armL.rotation.z = extra.twoHand ? 1.35 : -sw * .6; u.body.rotation.z = 0;
    } else {
      u.armL.rotation.z = -sw * .7; u.armR.rotation.z = sw * .7; u.body.rotation.z = 0;
    }
    if (extra.swing !== undefined) u.armR.rotation.z = -.8 + extra.swing * 2.6;
    u.body.position.y = Math.abs(Math.sin(ph * 6.2)) * .02 * mv - (extra.crouch ? .08 : 0);
    if (extra.crouch) u.body.rotation.z -= .35;
  };
  R.tint = (g, hex, amt) => { for (const m of g.userData.mats) { if (amt > 0) { m.emissive.set(hex); m.emissiveIntensity = amt; } else m.emissiveIntensity = 0; } };

  // ---------------------------------------------------------------- vehicles: car, pickup, van, box truck and three EVs, each its own shape.
  // Length L along x (front is +x), width Wd along z, standing on y = 0. opt: { burnt, cargo (box-truck colour) }
  R.vehicle = (type, color, L, Wd, opt = {}) => {
    const g = new THREE.Group(), H = Wd, wr = Wd * .2, ev = type.startsWith('ev_'), t = type.replace('ev_', ''), burnt = !!opt.burnt;
    const body = burnt ? '#1c1a18' : color, glass = burnt ? '#080808' : '#27333f', cy = '#46e6ff';
    const P = (x, y, z, w, h, d, c, o) => { const m = R.mesh(R.box(w, h, d), R.mat(c, o), x, y + h / 2, z, g); return m; };
    const y0 = wr * .8, accent = !burnt && ev ? { em: cy, ei: 1 } : null;
    if (t === 'car') {
      P(0, y0, 0, L, H * .28, Wd, body); P(-L * .06, y0 + H * .28, 0, L * .48, H * .24, Wd * .86, body); P(-L * .06, y0 + H * .31, 0, L * .48 + .4, H * .16, Wd * .86 + .3, glass);
    } else if (t === 'pickup') {
      P(0, y0, 0, L, H * .26, Wd, body); P(L * .14, y0 + H * .26, 0, L * .36, H * .26, Wd * .9, body); P(L * .14, y0 + H * .3, 0, L * .37, H * .17, Wd * .92, glass);
      P(-L * .5 + .1, y0 + H * .26, 0, .2, H * .14, Wd, body); for (const sz of [-1, 1]) P(-L * .17, y0 + H * .26, sz * (Wd / 2 - .05), L * .66, H * .14, .1, body);
      P(-L * .17, y0 + H * .27, 0, L * .62, .06 * H, Wd * .8, '#2a2a2a');
    } else if (t === 'van') {
      P(0, y0, 0, L, H * .62, Wd, body); P(L * .5 - .05, y0 + H * .3, 0, .12, H * .26, Wd * .88, glass);
      for (const sz of [-1, 1]) { P(L * .2, y0 + H * .34, sz * Wd / 2, L * .22, H * .18, .08, glass); }
    } else if (t === 'truck') {
      P(L * .37, y0, 0, L * .26, H * .5, Wd * .96, body); P(L * .5 - .05, y0 + H * .25, 0, .12, H * .2, Wd * .86, glass);
      P(-L * .13, y0 + H * .06, 0, L * .68, H * .84, Wd, burnt ? '#222' : (opt.cargo || '#d8d8d4')); P(-L * .13, y0 + H * .9, 0, L * .68, .05 * H, Wd * 1.02, '#9a9a96');
    } else if (t === 'suv') {   // electric SUV: taller wagon with roof rails
      P(0, y0, 0, L, H * .34, Wd, body); P(-L * .02, y0 + H * .34, 0, L * .62, H * .3, Wd * .92, body); P(-L * .02, y0 + H * .37, 0, L * .63, H * .2, Wd * .94, glass);
      for (const sz of [-1, 1]) P(-L * .02, y0 + H * .64, sz * Wd * .38, L * .56, .04 * H, .06, '#222');
    } else {   // 'hatchback' (electric car)
      P(0, y0, 0, L, H * .3, Wd, body); P(-L * .1, y0 + H * .3, 0, L * .56, H * .26, Wd * .86, body); P(-L * .1, y0 + H * .33, 0, L * .57, H * .17, Wd * .88, glass);
    }
    if (type === 'ev_van') { P(0, y0 + H * .62, 0, L * .6, .05 * H, Wd * .7, '#15305c'); }   // solar roof panel
    if (accent) { for (const sz of [-1, 1]) P(0, y0 + H * .12, sz * (Wd / 2 + .01), L * .8, .035 * H, .03, cy, accent); P(L / 2 - .03, y0 + H * .12, 0, .06, .05 * H, Wd * .86, cy, accent); P(L * .3, y0 + H * .27, Wd / 2, .08 * L, .07 * H, .04, cy, accent); }
    if (!burnt) { for (const sz of [-1, 1]) { R.mesh(R.box(.06 * L + .05, .09 * H, .2 * Wd), R.basic('#fff2b0'), L / 2, y0 + H * .17, sz * Wd * .33, g, false); R.mesh(R.box(.05 * L + .04, .07 * H, .16 * Wd), R.basic('#d02a2a'), -L / 2, y0 + H * .2, sz * Wd * .36, g, false); } }
    P(L / 2 - .02, y0, 0, .08, .08 * H, Wd * .98, '#2a2a2a'); P(-L / 2 - .06, y0, 0, .08, .08 * H, Wd * .98, '#2a2a2a');
    if (!ev) R.mesh(R.cyl(.03 * Wd, .03 * Wd, .12 * L, 6), R.mat('#444'), -L / 2 - .02, y0 + .02, Wd * .3, g).rotation.z = Math.PI / 2;
    const wx = t === 'truck' ? [.34, -.3, -.4] : [.31, -.31];
    for (const x of wx) for (const sz of [-1, 1]) { const w = R.mesh(R.cyl(wr, wr, Wd * .14, 12), R.mat('#111'), x * L, wr, sz * (Wd / 2 - Wd * .04), g); w.rotation.x = Math.PI / 2; const hub = R.mesh(R.cyl(wr * .5, wr * .5, Wd * .15, 8), R.mat(burnt ? '#222' : '#aab'), x * L, wr, sz * (Wd / 2 - Wd * .035), g, false); hub.rotation.x = Math.PI / 2; }
    return g;
  };

  // ---------------------------------------------------------------- particles (one Points object, a fixed pool)
  R.particles = (max, size) => {
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: .95, depthWrite: false }));
    pts.frustumCulled = false;
    const c = new THREE.Color();
    pts.userData.set = (list, fx) => {   // fx(p) -> [x, y, z, cssColor]
      let n = 0;
      for (const p of list) { if (n >= max) break; const [x, y, z, h] = fx(p); pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; c.set(h); col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b; n++; }
      geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    };
    return pts;
  };

  // ---------------------------------------------------------------- pooled meshes: take the next free one each frame, hide the rest
  R.pool = make => {
    const items = []; let n = 0;
    return { begin() { n = 0; }, next() { let o = items[n]; if (!o) { o = make(); items.push(o); } o.visible = true; n++; return o; }, end() { for (let i = n; i < items.length; i++) items[i].visible = false; }, items };
  };
  // flame: stacked cones with a flickering scale and a warm light
  R.flame = () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(R.cone(1, 2.2, 7), R.basic('#ff7a1a', .85)), b = new THREE.Mesh(R.cone(.6, 1.6, 7), R.basic('#ffd24a', .9)), c = new THREE.Mesh(R.cone(.3, 1, 6), R.basic('#fff6c0', .95));
    a.position.y = 1.1; b.position.y = .8; c.position.y = .5; g.add(a, b, c); g.userData.parts = [a, b, c];
    return g;
  };
  R.flicker = (f, t, seed = 0) => { const k = 1 + Math.sin(t * 17 + seed) * .12 + Math.sin(t * 29 + seed * 3) * .08; f.userData.parts.forEach((p, i) => p.scale.set(k, 1 + Math.sin(t * 13 + seed + i) * .15, k)); };
  return R;
})();
