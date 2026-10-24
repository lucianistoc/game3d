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
  R.sphere = (r, seg = 14) => { const k = `s${r}|${seg}`; let g = geos.get(k); if (!g) { g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)); geos.set(k, g); } return g; };
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

  // ---------------------------------------------------------------- people (unit height 1, facing +x, feet at y = 0).
  // Articulated: hips and knees, shoulders and elbows, a hip-pivoting upper body, rounded limbs, a face, belt and kit.
  const caps = new Map();
  R.cap = (r, len, seg = 8) => { const k = `${r}|${len}|${seg}`; let g = caps.get(k); if (!g) { g = new THREE.CapsuleGeometry(r, len, 4, seg); caps.set(k, g); } return g; };
  R.blob = (r, seed = 0) => {   // a lumpy low-poly ball for foliage and bushes
    const k = `blob${r}|${seed}`; let g = geos.get(k); if (g) return g;
    g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const f = 1 + (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1) * .22 - .11; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * .92, p.getZ(i) * f); }
    g.computeVertexNormals(); geos.set(k, g); return g;
  };
  // gun models lie along -y from the hand so they follow the raised arm; lengths in unit-height fractions
  const gunBuild = (grp, id) => {
    while (grp.children.length) grp.remove(grp.children[0]);
    const metal = grp.userData.metal, wood = grp.userData.wood, add = (w, len, d, pos, mat, x = 0, z = 0) => { const m = new THREE.Mesh(R.box(w, len, d), mat); m.position.set(x, -pos - len / 2 + .04, z); m.castShadow = true; grp.add(m); return m; };
    const cyl = (r, len, pos, mat) => { const m = new THREE.Mesh(R.cyl(r, r, len, 8), mat); m.position.set(0, -pos - len / 2 + .04, 0); grp.add(m); return m; };
    if (id === 'pistol') { add(.032, .12, .03, 0, metal); add(.024, .06, .026, -.045, wood, 0, 0).rotation.z = .25; add(.02, .04, .02, .07, metal, 0, 0); }
    else if (id === 'smg') { add(.04, .22, .04, 0, metal); add(.02, .1, .02, .06, metal, 0, 0).position.x = .03; add(.03, .1, .026, -.06, wood); cyl(.01, .1, .2, metal); }
    else if (id === 'shotgun') { add(.04, .22, .04, 0, wood); cyl(.014, .5, .1, metal); add(.036, .12, .036, .22, wood); add(.034, .14, .034, -.1, wood); }
    else if (id === 'hunting') { add(.036, .2, .04, 0, wood); cyl(.011, .55, .12, metal); add(.026, .09, .026, .04, metal).position.x = 0; const sc = new THREE.Mesh(R.cyl(.016, .016, .12, 8), metal); sc.position.set(0, -.2, .035); grp.add(sc); add(.032, .16, .036, -.12, wood); }
    else if (id === 'assault') { add(.044, .26, .044, 0, metal); cyl(.011, .36, .2, metal); add(.03, .1, .026, .06, metal, 0, 0).position.x = .03; add(.036, .16, .04, -.1, metal); add(.04, .05, .03, .0, wood, 0, 0); add(.012, .12, .012, .02, metal, 0, 0).position.x = -.03; }
    else { add(.036, .22, .04, 0, wood); cyl(.012, .46, .1, metal); add(.026, .08, .026, .05, metal); add(.034, .16, .038, -.1, wood); }   // old rifle
  };
  R.humanoid = o => {
    const root = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group(); root.add(body); body.add(upper); upper.position.y = .5;
    const own = {}, M = (k, c) => own[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    M('skin', o.skin || '#caa07a'); M('shirt', o.shirt || '#3a6a9a'); M('pants', o.pants || '#2b3340'); M('hat', o.hat || '#243444'); M('extra', o.extra || '#555'); M('boot', o.boots ? (typeof o.boots === 'string' ? o.boots : '#2a2420') : '#2a2420'); M('dark', '#15161a'); M('metal', '#2a2d30'); M('wood', '#6a4a2a');
    const zomb = o.pose === 'zombie';
    if (zomb) M('blood', '#5a1010');
    const part = (geo, mat, x, y, z, parent, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, own[mat]); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
    const bx = (w, h, d, mat, x, y, z, parent) => part(R.box(w, h, d), mat, x, y, z, parent);
    // legs: thigh (hip pivot) -> shin (knee pivot) -> boot
    const leg = sd => {
      const hip = new THREE.Group(); hip.position.set(0, .5, sd * .062); body.add(hip); part(R.cap(.05, .14, 8), 'pants', 0, -.125, 0, hip);
      const knee = new THREE.Group(); knee.position.y = -.245; hip.add(knee); part(R.cap(.04, .14, 8), 'pants', 0, -.11, 0, knee);
      part(R.cyl(.046, .042, .1, 9), 'boot', 0, -.17, 0, knee); bx(.15, .05, .09, 'boot', .035, -.225, 0, knee); bx(.04, .05, .092, 'dark', .095, -.225, 0, knee);
      return [hip, knee];
    };
    const [legL, kneeL] = leg(1), [legR, kneeR] = leg(-1);
    // pelvis, torso, belt
    part(R.cap(.085, .03, 8), 'pants', 0, .035, 0, upper, .9, 1, 1.5);
    part(R.cap(.09, .1, 8), 'shirt', 0, .17, 0, upper, .86, 1, 1.5);
    bx(.158, .028, .272, 'dark', 0, .07, 0, upper); bx(.03, .03, .04, 'extra', .08, .07, 0, upper);
    part(R.cyl(.027, .03, .06, 8), 'skin', 0, .335, 0, upper);
    // head with a face
    const head = new THREE.Group(); head.position.set(0, .4, 0); upper.add(head);
    part(R.sphere(.075, 14), 'skin', 0, 0, 0, head, .95, 1.05, .92); bx(.02, .026, .02, 'skin', .075, -.01, 0, head);
    if (!zomb) for (const sg of [-1, 1]) part(R.sphere(.011, 6), 'dark', .066, .014, sg * .032, head);
    const hatM = part(new THREE.SphereGeometry(.081, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'hat', -.004, .008, 0, head, 1, zomb ? .8 : 1, 1);
    if (!zomb) bx(.05, .01, .13, 'hat', .075, .026, 0, head);
    if (zomb) { bx(.035, .022, .05, 'blood', .05, .045, .02, head); bx(.04, .03, .02, 'dark', .071, -.032, 0, head); }   // gash on the scalp, open mouth
    // arms: shoulder -> elbow -> hand
    const arm = sd => {
      const sh = new THREE.Group(); sh.position.set(0, .29, sd * .152); upper.add(sh);
      part(R.sphere(.04, 8), 'shirt', 0, 0, 0, sh); part(R.cap(.034, .1, 8), 'shirt', 0, -.095, 0, sh);
      const el = new THREE.Group(); el.position.y = -.185; sh.add(el);
      part(R.cap(.03, .09, 8), zomb ? 'skin' : 'shirt', 0, -.07, 0, el); part(R.sphere(.034, 8), 'skin', 0, -.165, 0, el);
      if (zomb) bx(.04, .05, .04, 'blood', .02, -.07, sd * .01, el);
      return [sh, el];
    };
    const [armL, elbowL] = arm(1), [armR, elbowR] = arm(-1);
    // kit: backpack, straps, plates, belly
    if (o.pack) { bx(.1, .2 * o.pack, .21, 'extra', -.125, .17, 0, upper); bx(.09, .05, .19, 'dark', -.125, .17 + .1 * o.pack + .025, 0, upper); for (const sg of [-1, 1]) bx(.17, .02, .03, 'dark', -.01, .24, sg * .07, upper); }
    if (o.belly) part(R.sphere(.12, 10), 'skin', .06, .1, 0, upper, 1, .9, 1.1);
    if (o.plates) { bx(.17, .26, .3, 'extra', 0, .16, 0, upper); for (const sg of [-1, 1]) part(R.sphere(.06, 8), 'extra', 0, .3, sg * .155, upper, 1, .7, 1); bx(.19, .09, .19, 'extra', .004, .04, 0, head); }
    if (!zomb && !o.plates) bx(.04, .08, .05, 'extra', .02, .02, -.1, upper);   // pouch / holster on the belt
    if (zomb) { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; bx(.03, .06 + (i % 2) * .03, .012, 'shirt', Math.cos(a) * .075, -.01, Math.sin(a) * .125, upper).rotation.z = (i % 2 ? .1 : -.1); } bx(.02, .09, .09, 'blood', .082, .17, -.04, upper); bx(.02, .06, .06, 'dark', .082, .13, .07, upper); }
    // gun
    let gun = null;
    if (o.gun) { gun = new THREE.Group(); gun.position.set(0, -.165, 0); elbowR.add(gun); gun.userData.metal = own.metal; gun.userData.wood = own.wood; gunBuild(gun, typeof o.gun === 'string' ? o.gun : 'old_rifle'); }
    const s = o.scale || 1, bxs = o.bulk || 1; root.scale.set(s * bxs, s, s * bxs);
    root.userData = { own, body, upper, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, head, gun, mats: Object.values(own), lean: o.lean || 0, pose: o.pose || 'idle', setGun: id => { if (gun) gunBuild(gun, id); } };
    return root;
  };
  // ph = walk phase, mv = 0..1 how fast the legs move
  R.pose = (g, ph, mv, extra = {}) => {
    const u = g.userData, a = ph * 6.2, sw = Math.sin(a) * mv, cs = Math.cos(a) * mv, pose = extra.pose || u.pose;
    u.legL.rotation.z = sw * .8; u.legR.rotation.z = -sw * .8;
    u.kneeL.rotation.z = -(.06 + Math.max(0, cs) * .95 * (mv > 0 ? 1 : 0)); u.kneeR.rotation.z = -(.06 + Math.max(0, -cs) * .95 * (mv > 0 ? 1 : 0));
    u.upper.rotation.z = 0; u.head.rotation.z = 0;
    if (pose === 'zombie') {
      const sway = Math.sin(ph * 3.1) * .12; u.armL.rotation.z = 1.35 + sway; u.armR.rotation.z = 1.25 - sway; u.elbowL.rotation.z = .3 + sway; u.elbowR.rotation.z = .4 - sway;
      u.upper.rotation.z = -(.2 + (u.lean || 0)) - (extra.chase ? .12 : 0); u.head.rotation.z = .25 + Math.sin(ph * 2) * .08;
    } else if (pose === 'aim') {
      u.armR.rotation.z = 1.5; u.elbowR.rotation.z = .04; u.armL.rotation.z = extra.twoHand ? 1.25 : -sw * .6; u.elbowL.rotation.z = extra.twoHand ? .75 : .15;
    } else {
      u.armL.rotation.z = -sw * .7; u.armR.rotation.z = sw * .7; u.elbowL.rotation.z = .15 + Math.max(0, -sw) * .6; u.elbowR.rotation.z = .15 + Math.max(0, sw) * .6;
    }
    if (extra.swing !== undefined) { u.armR.rotation.z = -.8 + extra.swing * 2.6; u.elbowR.rotation.z = .2; }
    u.body.position.y = Math.abs(sw) * .018;
    if (extra.crouch) { u.legL.rotation.z = .75; u.legR.rotation.z = .45; u.kneeL.rotation.z = -1.35; u.kneeR.rotation.z = -1.05; u.body.position.y = -.115; u.upper.rotation.z -= .35; }
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
    // finer detail: door seams and handles, mirrors, grille, plates, wheel arches, tyres with spoked rims
    const dh = ({ car: .5, pickup: .52, van: .62, truck: .5, suv: .64, hatch: .54 }[t] || .5) * H, seam = burnt ? '#050505' : '#12141a', xs = t === 'truck' ? [.3, .12] : [.12, -.14];
    for (const sz of [-1, 1]) {
      for (const x of xs) { P(x * L, y0 + H * .04, sz * (Wd / 2 + .004), .014 * L + .01, dh * .92, .012, seam); P(x * L + .06 * L, y0 + dh * .55, sz * (Wd / 2 + .012), .05 * L, .018 * H, .02, burnt ? '#222' : '#c8ccd0'); }
      P(L * (t === 'truck' ? .3 : .2), y0 + dh * .86, sz * (Wd / 2 + .06), .05 * L, .05 * H, .06 * Wd, '#15161a');   // mirror
      P(L * .31, y0, sz * (Wd / 2 - .02), .22 * L, .02 * H, .02, '#0a0a0c');                                          // sill
    }
    if (!burnt) {
      P(L / 2 + .005, y0 + H * .1, 0, .03, H * .11, Wd * .5, '#0d0e12'); for (let i = 0; i < 3; i++) P(L / 2 + .02, y0 + H * (.12 + i * .03), 0, .012, .008 * H, Wd * .5, '#9aa0a6');
      P(L / 2 + .03, y0 + .01, 0, .012, H * .07, Wd * .26, '#e8e8e0'); P(-L / 2 - .03, y0 + .01, 0, .012, H * .07, Wd * .26, '#e8e8e0');
    }
    if (t === 'truck') { for (const sz of [-1, 1]) P(-L * .46, y0 + H * .03, sz * Wd * .46, .02, H * .12, .12 * Wd, '#15161a'); P(-L * .5 - .01, y0 + H * .1, 0, .02, H * .78, .02, seam); if (!burnt) P(L * .37, y0 + H * .52, 0, L * .08, .04 * H, Wd * .5, '#e8a020', { em: '#e8a020', ei: .6 }); }
    if (t === 'van') P(-L * .5 - .01, y0 + H * .05, 0, .02, H * .5, .02, seam);
    if (t === 'pickup') for (let i = 0; i < 4; i++) P(-L * .32 + i * L * .13, y0 + H * .27, 0, .03, .015 * H, Wd * .8, '#1c1c1c');   // bed ribs
    const wx = t === 'truck' ? [.34, -.3, -.4] : [.31, -.31];
    for (const x of wx) for (const sz of [-1, 1]) {
      const wz = sz * (Wd / 2 - Wd * .04);
      const arch = R.mesh(R.cyl(wr * 1.22, wr * 1.22, Wd * .06, 14), R.mat('#0a0a0c'), x * L, wr, sz * (Wd / 2 - Wd * .005), g, false); arch.rotation.x = Math.PI / 2;
      const w = R.mesh(R.cyl(wr, wr, Wd * .15, 16), R.mat('#0e0e10'), x * L, wr, wz, g); w.rotation.x = Math.PI / 2;
      const rim = R.mesh(R.cyl(wr * .62, wr * .62, Wd * .16, 12), R.mat(burnt ? '#222' : '#b4bac2'), x * L, wr, wz + sz * .004, g, false); rim.rotation.x = Math.PI / 2;
      for (let k = 0; k < 5; k++) { const sp = R.mesh(R.box(wr * 1.0, wr * .12, Wd * .17), R.mat(burnt ? '#111' : '#7a8088'), x * L, wr, wz + sz * .006, g, false); sp.rotation.z = k * Math.PI / 5; }
      R.mesh(R.cyl(wr * .14, wr * .14, Wd * .18, 6), R.mat('#2a2c30'), x * L, wr, wz + sz * .01, g, false).rotation.x = Math.PI / 2;
    }
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
