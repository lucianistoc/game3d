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
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(() => { if (curSlot) persist(); }, 30000);
addEventListener('beforeunload', () => { if (curSlot) persist(); });
