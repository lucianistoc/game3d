// Settings (kept apart from saves), key bindings, and procedural sound: every effect and the music are synthesised
// with the Web Audio API, so the game has no audio files.

const KB_DEFAULT = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sneak: 'ShiftLeft', melee: 'Space', use: 'KeyE', leave: 'KeyX', throw: 'KeyG', swap: 'KeyQ' };
const KB_LABEL = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', sneak: 'Sneak', melee: 'Melee', use: 'Use / hotwire', leave: 'Leave site', throw: 'Throw', swap: 'Switch throwable' };
const KB_ALT = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], sneak: ['ShiftRight'] };
const SET = (() => {
  const d = { master: .7, sfx: .8, music: .35, uiScale: 1, shake: 1, tips: true, quality: 'auto', kb: { ...KB_DEFAULT } };
  try { const s = JSON.parse(localStorage.getItem('timisz_settings')); if (s) { Object.assign(d, s); d.kb = { ...KB_DEFAULT, ...(s.kb || {}) }; } } catch {}
  return d;
})();
const saveSettings = () => { try { localStorage.setItem('timisz_settings', JSON.stringify(SET)); } catch {} };
const TOUCH = { on: false, act: {}, stick: null, aim: null };   // virtual input (see mission.js)
const kdown = a => !!(keys[SET.kb[a]] || (KB_ALT[a] && KB_ALT[a].some(k => keys[k])) || TOUCH.act[a]);
const keyName = c => c.replace(/^Key|^Digit/, '').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace(/^Arrow/, 'Arrow ');

// ---------------------------------------------------------------- engine
let AC = null, busMaster, busSfx, busMusic, noiseBuf, musicOn = false, mood = 'calm', muted = false;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    busMaster = AC.createGain(); busMaster.gain.value = SET.master; busMaster.connect(AC.destination);
    busSfx = AC.createGain(); busSfx.gain.value = SET.sfx; busSfx.connect(busMaster);
    busMusic = AC.createGain(); busMusic.gain.value = SET.music; busMusic.connect(busMaster);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  } catch { AC = null; }
}
addEventListener('pointerdown', audioInit); addEventListener('keydown', audioInit);
function applyVolumes() { if (!AC) return; busMaster.gain.value = muted ? 0 : SET.master; busSfx.gain.value = SET.sfx; busMusic.gain.value = SET.music; }
addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) { muted = !muted; applyVolumes(); } });

function tone(type, f0, f1, dur, vol, delay = 0, bus) {
  if (!AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || busSfx); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, vol, ftype, f0, f1, delay = 0, bus, q = 1) {
  if (!AC) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || busSfx); s.start(t, Math.random()); s.stop(t + dur + .05);
}
const lastPlay = {};
const SFX = {
  click:    () => tone('square', 900, 700, .05, .08),
  ok:       () => { tone('triangle', 520, 520, .08, .12); tone('triangle', 780, 780, .12, .12, .07); },
  bad:      () => tone('sawtooth', 200, 120, .18, .12),
  build:    () => { noise(.12, .25, 'bandpass', 900, 500); tone('square', 180, 90, .1, .12); },
  pickup:   () => { tone('triangle', 660, 660, .06, .14); tone('triangle', 990, 990, .1, .14, .06); },
  gear:     () => { tone('triangle', 520, 520, .08, .14); tone('triangle', 660, 660, .08, .14, .08); tone('triangle', 880, 880, .16, .14, .16); },
  shot_pistol:  () => { noise(.12, .55, 'highpass', 1800, 700); tone('square', 220, 60, .09, .35); },
  shot_rifle:   () => { noise(.2, .7, 'highpass', 1400, 400); tone('sawtooth', 160, 45, .16, .45); },
  shot_shotgun: () => { noise(.3, .95, 'lowpass', 3000, 300); tone('sawtooth', 110, 38, .24, .6); },
  shot_smg:     () => { noise(.07, .45, 'highpass', 2200, 900); tone('square', 260, 90, .05, .25); },
  turret:   () => { noise(.06, .2, 'highpass', 2500, 1200); tone('square', 300, 120, .04, .1); },
  melee:    () => { noise(.14, .3, 'bandpass', 600, 1800, 0, null, 2); },
  hit:      () => { noise(.1, .35, 'lowpass', 900, 200); tone('sine', 120, 60, .12, .3); },
  zdie:     () => { tone('sawtooth', 160, 50, .35, .22); noise(.2, .2, 'lowpass', 500, 120); },
  groan:    () => { const f = 70 + Math.random() * 40; tone('sawtooth', f, f * .7, .7, .1); tone('sawtooth', f * 1.5, f, .7, .05); },
  scream:   () => { tone('sawtooth', 600, 1100, .5, .16); tone('square', 640, 1200, .5, .08); },
  spit:     () => { noise(.18, .25, 'bandpass', 1500, 400, 0, null, 3); },
  hurt:     () => { tone('sawtooth', 240, 80, .22, .3); noise(.14, .25, 'lowpass', 800, 200); },
  boom:     () => { noise(.8, 1, 'lowpass', 1200, 80); tone('sine', 90, 30, .6, .8); },
  fire:     () => noise(.35, .18, 'bandpass', 1500, 900, 0, null, .6),
  hotwire:  () => { tone('square', 1200, 1200, .03, .1); tone('square', 1500, 1500, .03, .1, .1); },
  alarm:    () => { for (let i = 0; i < 6; i++) tone('square', i % 2 ? 900 : 650, i % 2 ? 900 : 650, .22, .1, i * .25); },
  horde:    () => { tone('sawtooth', 60, 55, 1.6, .25); tone('sawtooth', 62, 57, 1.6, .2); noise(1.4, .18, 'lowpass', 300, 150); },
  engine:   () => { tone('sawtooth', 55, 90, .9, .18); tone('square', 110, 160, .9, .06); },
  dawn:     () => { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 1.2, .14, i * .25, busMusic)); },
  night:    () => { [330, 262, 220].forEach((f, i) => tone('triangle', f, f * .98, 1.4, .14, i * .3, busMusic)); },
  wall:     () => { noise(.12, .3, 'lowpass', 500, 150); tone('sine', 80, 50, .14, .3); },
  report:   () => { tone('triangle', 440, 440, .1, .12); tone('triangle', 554, 554, .2, .12, .1); },
};
function sfx(name, vol = 1, gap = 0) {
  if (!AC || muted || !SFX[name]) return;
  const now = performance.now(); if (gap && lastPlay[name] && now - lastPlay[name] < gap) return; lastPlay[name] = now;
  if (vol < 1) { const g = busSfx.gain.value; busSfx.gain.value = g * vol; setTimeout(() => { busSfx.gain.value = SET.sfx; }, 120); }
  try { SFX[name](); } catch {}
}
const sfxAt = (name, x, y, px, py, gap) => { const d = Math.hypot(x - px, y - py); if (d < 650) sfx(name, Math.max(.25, 1 - d / 700), gap); };

// ---------------------------------------------------------------- music: a slow generative pad plus ambience
const SCALES = { calm: [220, 261.6, 329.6, 392, 440], night: [196, 233.1, 261.6, 311.1, 349.2], tense: [174.6, 207.7, 233.1, 277.2, 311.1] };
function startMusic() {
  if (musicOn || !AC) return; musicOn = true;
  const step = () => {
    if (!AC) return;
    const sc = SCALES[mood] || SCALES.calm, root = sc[Math.floor(Math.random() * sc.length)];
    for (const m of [1, 1.5, 2]) { if (Math.random() < .8) tone('triangle', root * m * (Math.random() < .5 ? .5 : 1), root * m * (Math.random() < .5 ? .5 : 1), 6, .07, Math.random() * 1.5, busMusic); }
    if (mood === 'tense' || mood === 'night') tone('sine', 55, 52, 3.5, .12, 0, busMusic);
    if (mood === 'calm' && Math.random() < .5) for (let i = 0; i < 2; i++) tone('sine', 1800 + Math.random() * 900, 2200, .12, .02, Math.random() * 4, busMusic);   // birds
    if (mood !== 'calm') for (let i = 0; i < 5; i++) tone('square', 4200, 4200, .03, .008, Math.random() * 5, busMusic);   // crickets
    setTimeout(step, 4200 + Math.random() * 2500);
  };
  step();
  const pulse = () => { if (AC && !muted && mood === 'tense') { tone('sine', 52, 40, .25, .16, 0, busMusic); tone('sine', 52, 40, .25, .12, .35, busMusic); } setTimeout(pulse, 1100); };
  pulse();
}
const setMood = m => { mood = m; };
