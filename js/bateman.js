'use strict';

// Logo easter egg: BATEMAN ARC.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.
//
// The song (audio/bateman.mp3: 18.5 s, 130 BPM, a kick on every beat for 32 beats, then an outro with no
// bass) is the raw material, and a concept is one thing done with it. This file is the shared
// shell: it loads and measures the song, owns the overlay with its concept switcher and the explosion
// canvas, and cleans up after whichever concept is running. The concepts live in js/bateman-*.js and add
// themselves to ARC_CONCEPTS as { id, name, start(a) }; start() gets the toolbox built in arcStart() and
// may return a function to run when the concept stops.

const ARC_CONCEPTS = [];
const ARC_KEY = 'bateman-concept';
const ARC_BEAT = 60 / 130.095; // seconds per beat, measured from the file
const arc = { song: null, kicks: null, grid: null, loading: null, raf: 0, live: null, open: false, cardTpl: null,
  g: null, W: 0, H: 0, parts: [], rings: [], volley: null };

// Kick drums: energy of the low end (one-pole low-pass, ~150 Hz) in 10 ms windows every 2 ms; a kick is
// where that energy rises fastest. Strength is relative to the hardest hit.
// The beat grid: the tempo is known, so only where beat 0 falls is fitted (each browser's MP3 decoder
// trims the start a little differently), as the average position of the kicks within one beat.
function analyseSong(buf) {
  const data = buf.getChannelData(0), rate = buf.sampleRate;
  const k = 1 - Math.exp(-2 * Math.PI * 150 / rate);
  const hop = Math.max(1, Math.round(rate * 0.002)), win = hop * 5;
  const sum = new Float64Array(data.length + 1);
  let lp = 0;
  for (let i = 0; i < data.length; i++) { lp += k * (data[i] - lp); sum[i + 1] = sum[i] + lp * lp; }
  const n = Math.max(0, Math.floor((data.length - win) / hop));
  const rise = new Float32Array(n);
  let prev = 0, top = 1e-12;
  for (let i = 0; i < n; i++) {
    const e = (sum[i * hop + win] - sum[i * hop]) / win;
    rise[i] = Math.max(0, e - prev);
    if (i && rise[i] > top) top = rise[i];
    prev = e;
  }
  const kicks = [];
  for (let i = 1; i < n - 1; i++) {
    if (rise[i] < top * 0.2 || rise[i] < rise[i - 1] || rise[i] < rise[i + 1]) continue;
    const t = i * hop / rate;
    if (!kicks.length || t - kicks[kicks.length - 1].t > 0.15) kicks.push({ t, s: Math.min(1, rise[i] / top) });
  }
  let re = 0, im = 0;
  for (const b of kicks) { const ph = 2 * Math.PI * b.t / ARC_BEAT; re += Math.cos(ph); im += Math.sin(ph); }
  let first = 0.027; // where it lands in a plain decode; kept when the fit is poor
  if (kicks.length > 8 && Math.hypot(re, im) / kicks.length > 0.5) {
    first = ((Math.atan2(im, re) / (2 * Math.PI)) * ARC_BEAT + ARC_BEAT) % ARC_BEAT;
    if (first > ARC_BEAT / 2) first -= ARC_BEAT; // beat 0 sits right at the start of the file
  }
  const grid = {
    bpm: 60 / ARC_BEAT, beat: ARC_BEAT, first,
    kickBeats: 32,                 // beats 0..31 carry a kick; extra hits on beats 7.5 and 23.5
    phrase: 16,                    // the pattern repeats every 16 beats, so 0-16 and 16-32 loop cleanly
    dropEnd: first + 32 * ARC_BEAT, // from here on: the outro, no bass
    dur: buf.duration,
    at: (b) => first + b * ARC_BEAT,
    beatOf: (t) => (t - first) / ARC_BEAT,
  };
  return { kicks, grid };
}

function loadSong() {
  arc.loading ||= fetch('audio/bateman.mp3')
    .then((r) => r.arrayBuffer())
    .then((ab) => new Promise((ok, fail) => audioCtx.decodeAudioData(ab, ok, fail)))
    .then((buf) => { const m = analyseSong(buf); arc.kicks = m.kicks; arc.grid = m.grid; arc.song = buf; })
    .catch(() => { arc.loading = null; });
  return arc.loading;
}

function arcSaved() {
  let id = null;
  try { id = localStorage.getItem(ARC_KEY); } catch { /* private mode */ }
  return (ARC_CONCEPTS.find((c) => c.id === id) || ARC_CONCEPTS[0] || {}).id;
}

// The switcher only shows when there is something to switch between.
function arcPicks(id) {
  $('#arc-picks').innerHTML = ARC_CONCEPTS.length < 2 ? '' : ARC_CONCEPTS.map((c, i) =>
    `<button data-act="bateman-pick" data-id="${c.id}" class="${c.id === id ? 'on' : ''}" aria-pressed="${c.id === id}"><b>${i + 1}</b>${c.name}</button>`).join('');
}

function openBateman() {
  const el = $('#bateman');
  arcStop();
  arc.cardTpl ||= el.querySelector('.bateman-card').cloneNode(true);
  arcReset(el, arcSaved(), true);
  arc.open = true;
  arcCanvas();
  arc.parts = []; arc.rings = [];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // [delay ms, x, y (fractions of the screen), size] for the opening volley before the song kicks in.
  arc.volley = calm ? null : { start: performance.now(), next: 0, plan: [[0, .5, .45, 1.3], [180, .2, .2, .8], [330, .82, .3, .9], [480, .25, .75, 1], [620, .78, .78, 1.1]] };
  cancelAnimationFrame(arc.raf);
  arc.raf = requestAnimationFrame(arcFrame);
  if (!audioCtx) return;
  loadSong().then(() => { if (arc.open && !arc.live) arcStart(arcSaved()); });
}

// Switch concept while the overlay is up.
function pickBateman(id) {
  try { localStorage.setItem(ARC_KEY, id); } catch { /* private mode */ }
  if (!arc.open) return;
  arcStop();
  arcReset($('#bateman'), id, false);
  if (arc.song && audioCtx) arcStart(id);
}

function closeBateman() {
  if (!arc.open) return;
  arc.open = false;
  arcStop();
  $('#bateman').classList.add('hidden');
  cancelAnimationFrame(arc.raf);
}

// Back to a clean overlay: fresh picture and title, empty stage, no classes or inline styles left behind.
function arcReset(el, id, intro) {
  el.className = `bateman c-${id}`;
  el.style.cssText = '';
  el.querySelector('.bateman-card').replaceWith(arc.cardTpl.cloneNode(true));
  const stage = $('#arc-stage');
  stage.className = 'arc-stage';
  stage.style.cssText = '';
  stage.innerHTML = '';
  arcPicks(id);
  if (intro) { void el.offsetWidth; el.classList.add('go'); } // restart the CSS animations on every open
}

function arcCanvas() {
  const cv = $('#boom'), dpr = Math.min(devicePixelRatio || 1, 2);
  arc.W = cv.clientWidth; arc.H = cv.clientHeight;
  cv.width = arc.W * dpr; cv.height = arc.H * dpr;
  arc.g = cv.getContext('2d');
  arc.g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => { if (arc.open) arcCanvas(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') closeBateman(); });

// ---------- Running a concept ----------
function arcStart(id) {
  const c = ARC_CONCEPTS.find((x) => x.id === id) || ARC_CONCEPTS[0];
  if (!c || !arc.song || !audioCtx) return;
  const ctx = audioCtx, el = $('#bateman'), card = el.querySelector('.bateman-card');
  // Everything a concept plays goes into `out`; the limiter after it keeps boosted bass from clipping.
  const out = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  out.connect(limiter).connect(ctx.destination);
  const live = { out, limiter, nodes: [], timers: [], offs: [], stop: null };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const a = {
    ctx, buf: arc.song, grid: arc.grid, kicks: arc.kicks, out, calm,
    el, card, img: card.querySelector('img'), title: card.querySelector('h2'), stage: $('#arc-stage'),
    get W() { return arc.W; }, get H() { return arc.H; },
    draw: null, // set to (g, W, H, now) => {} to paint on the full-screen canvas each frame, under the explosions
    // A source for the song (or another buffer), stopped for you when the concept ends. Connect and start it yourself.
    source(buffer) { const s = ctx.createBufferSource(); s.buffer = buffer || arc.song; live.nodes.push(s); return s; },
    // Any other node that keeps running (oscillator, worklet, script processor): stopped and disconnected for you.
    track(node) { live.nodes.push(node); return node; },
    after(ms, fn) { const id = setTimeout(fn, ms); live.timers.push(() => clearTimeout(id)); return id; },
    every(ms, fn) { const id = setInterval(fn, ms); live.timers.push(() => clearInterval(id)); return id; },
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); live.offs.push(() => target.removeEventListener(type, fn, opts)); },
    css(text) {
      if (document.getElementById(`arc-css-${c.id}`)) return;
      const st = document.createElement('style');
      st.id = `arc-css-${c.id}`; st.textContent = text;
      document.head.append(st);
    },
    load() { try { return JSON.parse(localStorage.getItem(`bateman-${c.id}`)) || {}; } catch { return {}; } },
    save(v) { try { localStorage.setItem(`bateman-${c.id}`, JSON.stringify(v)); } catch { /* private mode */ } },
    burst(x, y, size) { if (!calm) arcBurst(x, y, size); },
    hit(s) { arcHit(s, calm); },
    buzz(ms) { if (navigator.vibrate) navigator.vibrate(ms); },
  };
  live.a = a;
  arc.live = live;
  try { live.stop = c.start(a) || null; } catch (err) { console.error('bateman concept', c.id, err); }
}

function arcStop() {
  const live = arc.live;
  if (!live) return;
  arc.live = null;
  live.a.draw = null;
  try { if (live.stop) live.stop(); } catch (err) { console.error('bateman concept stop', err); }
  live.timers.forEach((f) => f());
  live.offs.forEach((f) => f());
  // A short fade so the cut doesn't click, then everything is stopped and unplugged.
  const t = audioCtx.currentTime;
  try {
    live.out.gain.cancelScheduledValues(t);
    live.out.gain.setValueAtTime(live.out.gain.value, t);
    live.out.gain.linearRampToValueAtTime(0, t + 0.04);
  } catch { /* context closed */ }
  setTimeout(() => {
    for (const n of live.nodes) {
      try { if (n.stop) n.stop(); } catch { /* never started, or already stopped */ }
      try { n.disconnect(); } catch { /* not connected */ }
    }
    try { live.out.disconnect(); live.limiter.disconnect(); } catch { /* not connected */ }
  }, 80);
}

// ---------- Shared visuals ----------
// One beat: shake the picture and blow things up around the edges, harder the stronger the hit (s: 0..1).
function arcHit(s, calm) {
  const el = $('#bateman'), card = el.querySelector('.bateman-card');
  if (!calm) {
    card.style.setProperty('--amp', `${4 + s * 22}px`);
    card.style.setProperty('--zoom', 1 + s * 0.08);
    card.classList.remove('hit');
    void card.offsetWidth;
    card.classList.add('hit');
  }
  if (s > 0.7) {
    el.classList.remove('drop');
    void el.offsetWidth;
    el.classList.add('drop');
    if (navigator.vibrate) navigator.vibrate(80);
  }
  if (calm) return;
  const W = arc.W, H = arc.H;
  const n = s > 0.7 ? 4 : s > 0.4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    // Mostly around the edges, where the picture doesn't hide them.
    const side = Math.random() < 0.5;
    const x = side ? (Math.random() < 0.5 ? 0.05 + Math.random() * 0.2 : 0.75 + Math.random() * 0.2) : 0.1 + Math.random() * 0.8;
    const y = side ? 0.1 + Math.random() * 0.8 : (Math.random() < 0.5 ? 0.04 + Math.random() * 0.18 : 0.78 + Math.random() * 0.18);
    arcBurst(x * W, y * H, Math.min(W, H) / 3 * (0.5 + s * 0.9));
  }
}

// A fireball with sparks, smoke and a shock ring.
function arcBurst(x, y, size) {
  if (arc.parts.length > 900) return; // a runaway caller can't choke the phone
  arc.rings.push({ x, y, r: 4, max: size * 2.4, life: 1 });
  for (let k = 0; k < 60; k++) {
    const ang = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * size / 14;
    const kind = k < 34 ? 'fire' : k < 50 ? 'spark' : 'smoke';
    arc.parts.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, kind, life: 1,
      decay: kind === 'spark' ? 0.012 + Math.random() * 0.01 : kind === 'smoke' ? 0.01 : 0.02 + Math.random() * 0.02,
      r: kind === 'smoke' ? size / 5 : kind === 'fire' ? size / 7 + Math.random() * size / 6 : 2 });
  }
}

// The full-screen canvas: the running concept paints first, the explosions go on top.
function arcFrame(now) {
  const g = arc.g, W = arc.W, H = arc.H, v = arc.volley;
  if (v) {
    const scale = Math.min(W, H) / 3;
    while (v.next < v.plan.length && now - v.start >= v.plan[v.next][0]) { const [, px, py, s] = v.plan[v.next++]; arcBurst(px * W, py * H, scale * s); }
    if (v.next >= v.plan.length) arc.volley = null;
  }
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  const live = arc.live;
  if (live && live.a.draw) {
    g.save();
    try { live.a.draw(g, W, H, now); } catch (err) { console.error('bateman draw', err); live.a.draw = null; }
    g.restore();
  }
  arc.parts = arc.parts.filter((p) => p.life > 0);
  arc.rings = arc.rings.filter((r) => r.life > 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  for (const r of arc.rings) {
    r.r += (r.max - r.r) * 0.12; r.life -= 0.035;
    g.strokeStyle = `rgba(255,200,120,${Math.max(r.life, 0) * 0.8})`; g.lineWidth = 6 * Math.max(r.life, 0);
    g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
  }
  for (const p of arc.parts) {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy = p.vy * 0.95 + (p.kind === 'smoke' ? -0.05 : p.kind === 'spark' ? 0.12 : -0.02);
    p.life -= p.decay;
    const l = Math.max(p.life, 0);
    if (p.kind === 'spark') {
      g.strokeStyle = `rgba(255,230,150,${l})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); g.stroke();
      continue;
    }
    const r = p.r * (p.kind === 'smoke' ? 2 - l : 0.6 + l * 0.6);
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    if (p.kind === 'fire') {
      grad.addColorStop(0, `rgba(255,255,220,${l})`); grad.addColorStop(0.35, `rgba(255,170,30,${l * 0.9})`);
      grad.addColorStop(0.7, `rgba(220,40,0,${l * 0.5})`); grad.addColorStop(1, 'rgba(120,0,0,0)');
    } else {
      g.globalCompositeOperation = 'source-over';
      grad.addColorStop(0, `rgba(60,50,45,${l * 0.35})`); grad.addColorStop(1, 'rgba(30,25,20,0)');
    }
    g.fillStyle = grad; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'lighter';
  }
  arc.raf = requestAnimationFrame(arcFrame);
}
