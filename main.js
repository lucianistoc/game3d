// Bootstrap and the main loop. Loaded last, once every scene exists.
initTextures(); initSiteTextures();
go(titleScene);
let last = performance.now(), clock = 0, frameErrs = 0;
// frame-rate counter (Settings > FPS, F3, or ?fps): frames per second and the slowest frame over the last half second
const fpsUrl = /[?&]fps\b/.test(location.search), FPS = { n: 0, sum: 0, worst: 0, t0: performance.now(), val: 0, ms: 0, max: 0, prev: 0 };
addEventListener('keydown', e => { if (e.code === 'F3' && !e.repeat) { e.preventDefault(); SET.fps = !SET.fps; saveSettings(); } });
const debugOn = /[?&]debug\b/.test(location.search);
addEventListener('error', e => { DBG.err = String(e.message || e); });
function frame(now) {
  if (FPS.prev) { const d = now - FPS.prev; FPS.n++; FPS.sum += d; FPS.worst = Math.max(FPS.worst, d); if (now - FPS.t0 >= 500) { FPS.val = FPS.n * 1000 / FPS.sum; FPS.ms = FPS.sum / FPS.n; FPS.max = FPS.worst; FPS.n = 0; FPS.sum = 0; FPS.worst = 0; FPS.t0 = now; } } FPS.prev = now;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  btns = [];
  applyLayout();
  if (curSlot && scene !== titleScene && scene !== menuScene) save.playSec += dt;
  if (scene.update) scene.update(dt);
  scene.draw(dt, clock);
  drawNotice(dt);
  if (TOUCH.on && scene && scene.fixed && scene.update && innerHeight > innerWidth * 1.1) { ctx.fillStyle = 'rgba(3,8,6,.8)'; ctx.fillRect(-UI.ox, -UI.oy, UI.lw, UI.lh); text('Turn your phone sideways to play', W / 2, H / 2, 20, AMBER, 'center'); }
  if (SET.fps || fpsUrl) {
    const k = canvas.width / innerWidth, a = `${Math.round(FPS.val)} FPS  ${FPS.ms.toFixed(1)} ms  (worst ${Math.round(FPS.max)})`, b = R3D.ok ? `3D ${R3D.level.toUpperCase()}${R3D.pref === 'auto' ? ' (auto)' : ''} · ${R3D.renderer.info.render.calls} draw calls` : '2D';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.shadowBlur = 0; ctx.font = `${11 * k}px monospace`; ctx.textAlign = 'right';
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width) + 12 * k, x1 = canvas.width - 4 * k, y1 = canvas.height - 4 * k, h = 31 * k; ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x1 - w, y1 - h, w, h);
    ctx.fillStyle = FPS.val >= 50 ? '#6f6' : FPS.val >= 30 ? '#fc4' : '#f66'; ctx.fillText(a, x1 - 6 * k, y1 - 18 * k); ctx.fillStyle = '#9fb'; ctx.fillText(b, x1 - 6 * k, y1 - 5 * k); ctx.restore();
  }
  if (debugOn) {   // ?debug: what the phone reports, for diagnosing input and graphics problems
    const r = canvas.getBoundingClientRect(), L = [`${innerWidth}x${innerHeight} dpr ${devicePixelRatio} canvas ${Math.round(r.width)}x${Math.round(r.height)} ui ${UI.scale.toFixed(2)}`, `3D can ${R3D.can} ok ${R3D.ok} pref ${R3D.pref} level ${R3D.level} lost ${!!R3D.lost}`, `last pointer: ${DBG.ptr}  buttons ${btns.length}  touch ${TOUCH.on}`, `error: ${DBG.err || 'none'}`];
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, canvas.width, 4 + L.length * 15 * devicePixelRatio); ctx.font = `${11 * devicePixelRatio}px monospace`; ctx.fillStyle = '#9f9'; ctx.textAlign = 'left'; ctx.shadowBlur = 0;
    L.forEach((s, i) => ctx.fillText(s, 4, (14 + i * 15) * devicePixelRatio)); ctx.restore();
  }
}
// the next frame is scheduled first, so one failing frame can never freeze the game; two failures in 3D switch to the flat game
function loop(now) {
  requestAnimationFrame(loop);
  try { frame(now); frameErrs = Math.max(0, frameErrs - .02); }
  catch (e) {
    DBG.err = String(e && e.message || e); console.error(e); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (++frameErrs >= 2 && R3D.ok) { frameErrs = 0; R3D.fail(DBG.err.slice(0, 60)); }
  }
}
requestAnimationFrame(loop);
setInterval(() => { if (curSlot) persist(); }, 30000);
addEventListener('beforeunload', () => { if (curSlot) persist(); });
