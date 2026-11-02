'use strict';

// Logo easter egg.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Logo easter egg: BATEMAN ARC with the song, beat-synced shake and explosions ----------
const arc = { song: null, beats: null, src: null, raf: 0, burst: null, loading: null };

// Kick drums: energy of the low end (one-pole low-pass, ~150 Hz) in 20 ms windows, picked where it jumps
// well above the recent average. Strength is relative to the loudest hit, so the drops come out near 1.
function findBeats(buf) {
  const data = buf.getChannelData(0), rate = buf.sampleRate, win = Math.round(rate * 0.02);
  const k = 1 - Math.exp(-2 * Math.PI * 150 / rate);
  const energy = [];
  let lp = 0;
  for (let i = 0; i < data.length; i += win) {
    let e = 0;
    for (let j = i; j < Math.min(i + win, data.length); j++) { lp += k * (data[j] - lp); e += lp * lp; }
    energy.push(e / win);
  }
  const beats = [];
  let last = -1;
  for (let i = 1; i < energy.length; i++) {
    const from = Math.max(0, i - 25);
    let avg = 0;
    for (let j = from; j < i; j++) avg += energy[j];
    avg /= i - from;
    const t = i * 0.02;
    if (energy[i] > avg * 1.6 && energy[i] > energy[i - 1] && (last < 0 || t - last > 0.22)) { beats.push({ t, e: energy[i] }); last = t; }
  }
  const max = Math.max(...beats.map((b) => b.e), 1e-9);
  return beats.map((b) => ({ t: b.t, s: b.e / max })).filter((b) => b.s > 0.12);
}

function loadSong() {
  arc.loading ||= fetch('audio/bateman.mp3')
    .then((r) => r.arrayBuffer())
    .then((ab) => new Promise((ok, fail) => audioCtx.decodeAudioData(ab, ok, fail)))
    .then((buf) => { arc.song = buf; arc.beats = findBeats(buf); })
    .catch(() => { arc.loading = null; });
  return arc.loading;
}

function openBateman() {
  const el = $('#bateman');
  el.classList.remove('hidden', 'go');
  void el.offsetWidth; // restart the CSS animations on every tap
  el.classList.add('go');
  stopSong();
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  startBooms($('#boom'), calm);
  if (!audioCtx) return;
  loadSong().then(() => {
    if (!arc.song || el.classList.contains('hidden')) return;
    const src = audioCtx.createBufferSource();
    src.buffer = arc.song;
    src.connect(audioCtx.destination);
    src.start();
    arc.src = src;
    arc.t0 = audioCtx.currentTime;
    arc.next = 0;
    src.onended = () => { if (arc.src === src) arc.src = null; };
  });
}

function stopSong() {
  if (arc.src) { try { arc.src.stop(); } catch { /* already stopped */ } arc.src = null; }
}

function closeBateman() {
  $('#bateman').classList.add('hidden');
  stopSong();
  cancelAnimationFrame(arc.raf);
}

// One beat: shake the picture and blow things up, harder on the drops.
function hit(s, calm) {
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
  if (calm || !arc.burst) return;
  const W = el.clientWidth, H = el.clientHeight;
  const n = s > 0.7 ? 4 : s > 0.4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    // Mostly around the edges, where the picture doesn't hide them.
    const side = Math.random() < 0.5;
    const x = side ? (Math.random() < 0.5 ? 0.05 + Math.random() * 0.2 : 0.75 + Math.random() * 0.2) : 0.1 + Math.random() * 0.8;
    const y = side ? 0.1 + Math.random() * 0.8 : (Math.random() < 0.5 ? 0.04 + Math.random() * 0.18 : 0.78 + Math.random() * 0.18);
    arc.burst(x * W, y * H, Math.min(W, H) / 3 * (0.5 + s * 0.9));
  }
}

// Fireballs, sparks, smoke and shock rings on a full-screen canvas. Opens with a volley, then follows the beat.
function startBooms(cv, calm) {
  cancelAnimationFrame(arc.raf);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  let parts = [], rings = [];
  arc.burst = (x, y, size) => {
    rings.push({ x, y, r: 4, max: size * 2.4, life: 1 });
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * size / 14;
      const kind = k < 34 ? 'fire' : k < 50 ? 'spark' : 'smoke';
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind, life: 1,
        decay: kind === 'spark' ? 0.012 + Math.random() * 0.01 : kind === 'smoke' ? 0.01 : 0.02 + Math.random() * 0.02,
        r: kind === 'smoke' ? size / 5 : kind === 'fire' ? size / 7 + Math.random() * size / 6 : 2 });
    }
  };
  if (calm) return;
  // [delay ms, x, y (fractions of the screen), size] for the opening volley before the song kicks in.
  const plan = [[0, .5, .45, 1.3], [180, .2, .2, .8], [330, .82, .3, .9], [480, .25, .75, 1], [620, .78, .78, 1.1]];
  const scale = Math.min(W, H) / 3;
  const start = performance.now();
  let next = 0;
  const frame = (now) => {
    while (next < plan.length && now - start >= plan[next][0]) { const [, px, py, s] = plan[next++]; arc.burst(px * W, py * H, scale * s); }
    if (arc.src && arc.beats) {
      const t = audioCtx.currentTime - arc.t0;
      while (arc.next < arc.beats.length && arc.beats[arc.next].t <= t) hit(arc.beats[arc.next++].s, calm);
    }
    parts = parts.filter((p) => p.life > 0);
    rings = rings.filter((g) => g.life > 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of rings) {
      g.r += (g.max - g.r) * 0.12; g.life -= 0.035;
      ctx.strokeStyle = `rgba(255,200,120,${Math.max(g.life, 0) * 0.8})`; ctx.lineWidth = 6 * Math.max(g.life, 0);
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy = p.vy * 0.95 + (p.kind === 'smoke' ? -0.05 : p.kind === 'spark' ? 0.12 : -0.02);
      p.life -= p.decay;
      const l = Math.max(p.life, 0);
      if (p.kind === 'spark') {
        ctx.strokeStyle = `rgba(255,230,150,${l})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
        continue;
      }
      const r = p.r * (p.kind === 'smoke' ? 2 - l : 0.6 + l * 0.6);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      if (p.kind === 'fire') {
        grad.addColorStop(0, `rgba(255,255,220,${l})`); grad.addColorStop(0.35, `rgba(255,170,30,${l * 0.9})`);
        grad.addColorStop(0.7, `rgba(220,40,0,${l * 0.5})`); grad.addColorStop(1, 'rgba(120,0,0,0)');
      } else {
        ctx.globalCompositeOperation = 'source-over';
        grad.addColorStop(0, `rgba(60,50,45,${l * 0.35})`); grad.addColorStop(1, 'rgba(30,25,20,0)');
      }
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
    arc.raf = requestAnimationFrame(frame);
  };
  arc.raf = requestAnimationFrame(frame);
}
