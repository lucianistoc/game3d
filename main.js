// Bootstrap and the main loop. Loaded last, once every scene exists.
initTextures(); initSiteTextures();
go(titleScene);
let last = performance.now(), clock = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  btns = [];
  applyLayout();
  if (curSlot && scene !== titleScene && scene !== menuScene) save.playSec += dt;
  if (scene.update) scene.update(dt);
  scene.draw(dt, clock);
  drawNotice(dt);
  if (TOUCH.on && scene && scene.fixed && scene.update && innerHeight > innerWidth * 1.1) { ctx.fillStyle = 'rgba(3,8,6,.8)'; ctx.fillRect(-UI.ox, -UI.oy, UI.lw, UI.lh); text('Turn your phone sideways to play', W / 2, H / 2, 20, AMBER, 'center'); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(() => { if (curSlot) persist(); }, 30000);
addEventListener('beforeunload', () => { if (curSlot) persist(); });
