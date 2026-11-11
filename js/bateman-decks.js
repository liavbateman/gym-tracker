'use strict';

// BATEMAN ARC, concept 2: SCRATCH. The picture is a record and the user is the DJ.
// Loaded as a plain <script> after js/bateman.js; registers itself in ARC_CONCEPTS.
//
// The song's 32 beats with a kick are cut into one seamless loop and handed to a variable-speed reader
// (js/bateman-decks-worklet.js). A finger on the record drags that reader's needle along with the finger's
// angle, forwards and backwards; the pads below (brake, stutter, reverse) take the needle off course while
// held and the song slips back in where it would have been. The record on screen is turned by the needle
// position the reader reports, so what you see is always what you hear.
(() => {
  const PLAY = 0, BRAKE = 1, STUTTER = 2, REVERSE = 3;
  const MODES = { brake: BRAKE, stutter: STUTTER, reverse: REVERSE };
  const TITLES = ['BATEMAN ARC', 'BATEMAN ARC', 'B-B-BATEMAN', 'CRA NAMETAB'];
  const PADS = [['stutter', 'STUTTER', 'HOLD + SLIDE'], ['reverse', 'REVERSE', 'HOLD'], ['brake', 'BRAKE', 'HOLD'], ['filter', 'FILTER', 'HOLD + SLIDE']];
  const KEYS = { s: 'stutter', r: 'reverse', b: 'brake', f: 'filter' };
  const MODULE = 'js/bateman-decks-worklet.js';
  const FX_PAD = 40; // the spark canvas reaches this far beyond the record
  let modCtx = null, modReady = null, deckClass = null;

  const CSS = `
.bateman.c-decks .bateman-card { display: none; }
.arc-decks {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  padding: calc(var(--safe-t) + 70px) max(16px, env(safe-area-inset-right, 0px)) calc(var(--safe-b) + 14px) max(16px, env(safe-area-inset-left, 0px));
  --arc-decks-d: max(150px, min(var(--arc-decks-w, 100vw) - 44px, var(--arc-decks-h, 100vh) - var(--safe-t) - var(--safe-b) - 316px, 420px));
}
.arc-decks-deck { position: relative; flex: none; width: var(--arc-decks-d); height: var(--arc-decks-d); margin-bottom: 24px; }
.arc-decks-plate {
  position: absolute; inset: 0; border-radius: 50%; animation: arc-decks-in .5s cubic-bezier(.2, 1.4, .4, 1) both;
  box-shadow: 0 0 0 3px #111, 0 0 0 5px rgba(255, 90, 31, .6), 0 0 70px rgba(255, 90, 0, .5);
}
.arc-decks-disc { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; background: #000; will-change: transform; touch-action: none; cursor: grab; }
.arc-decks-held .arc-decks-disc { cursor: grabbing; }
.arc-decks-pic {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; pointer-events: none;
  -webkit-user-drag: none; transition: filter .12s;
}
.arc-decks-m1 .arc-decks-pic { filter: brightness(.5) saturate(.6); }
.arc-decks-m2 .arc-decks-pic { filter: contrast(1.5) saturate(1.9); }
.arc-decks-m3 .arc-decks-pic { filter: invert(1) hue-rotate(180deg); }
.arc-decks-filt .arc-decks-pic { filter: grayscale(.85) brightness(.8); }
.arc-decks-grooves {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background:
    repeating-radial-gradient(circle, rgba(0, 0, 0, 0) 0 2px, rgba(0, 0, 0, .36) 2.5px 3.5px),
    radial-gradient(circle, rgba(0, 0, 0, 0) 0 37%, rgba(0, 0, 0, .5) 43% 95%, #0a0a0a 97%);
}
.arc-decks-mark {
  position: absolute; left: 50%; top: 1.5%; width: 6px; height: 13%; margin-left: -3px; border-radius: 3px; pointer-events: none;
  background: linear-gradient(#fff, #ff5a1f); box-shadow: 0 0 10px #ff5a1f;
}
.arc-decks-hole {
  position: absolute; left: 50%; top: 50%; width: 7%; height: 7%; margin: -3.5% 0 0 -3.5%; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, #000 0 30%, #ffd9a0 34% 52%, #e02400 56%); box-shadow: 0 0 0 2px rgba(0, 0, 0, .7);
}
.arc-decks-sheen {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 20deg, rgba(255, 255, 255, 0) 0 7%, rgba(255, 255, 255, .17) 13%, rgba(255, 255, 255, 0) 19% 56%, rgba(255, 255, 255, .12) 63%, rgba(255, 255, 255, 0) 70%);
}
.arc-decks-arm {
  position: absolute; right: 1%; top: 1%; width: 13%; height: 13%; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, #ffd9a0 0 18%, #2b2b2b 21% 60%, #111 63%); box-shadow: 0 2px 10px #000;
}
.arc-decks-arm::before, .arc-decks-arm::after { content: ''; position: absolute; left: 50%; top: 50%; transform-origin: 50% 0; }
.arc-decks-arm::before {
  width: 12%; height: 154%; margin-left: -6%; border-radius: 3px; transform: rotate(28deg);
  background: linear-gradient(90deg, #777, #eee 45%, #888); box-shadow: 0 2px 6px rgba(0, 0, 0, .8);
}
.arc-decks-arm::after {
  width: 30%; height: 44%; margin-left: -15%; border-radius: 3px; transform: rotate(28deg) translateY(330%);
  background: #e02400; box-shadow: 0 0 0 1.5px #ffd9a0, 0 2px 8px #000;
}
.arc-decks-fx { position: absolute; left: -${FX_PAD}px; top: -${FX_PAD}px; width: calc(100% + ${FX_PAD * 2}px); height: calc(100% + ${FX_PAD * 2}px); pointer-events: none; }
.arc-decks-hint, .arc-decks-title {
  position: absolute; left: -24px; right: -24px; margin: 0; display: flex; justify-content: center; white-space: nowrap; pointer-events: none;
  font-family: var(--display); font-weight: 700; line-height: 1; letter-spacing: .04em; color: #fff; -webkit-text-stroke: 2px #b00000;
  text-shadow: 0 0 12px #ff3b00, 0 0 34px #ff7a00, 0 4px 0 #600;
}
.arc-decks-hint { top: 50%; margin-top: -.5em; font-size: calc(var(--arc-decks-d) * .2); animation: arc-decks-hint .42s ease-in-out infinite alternate; transition: opacity .25s; }
.arc-decks-hint.arc-decks-gone { opacity: 0; }
.arc-decks-title { bottom: -.42em; font-size: calc(var(--arc-decks-d) * .21); will-change: transform; transition: opacity .3s; }
.arc-decks-m1 .arc-decks-title { opacity: .5; }
.arc-decks-pads { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: min(100%, 440px); }
.arc-decks-pad {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 76px; padding: 0;
  overflow: hidden; border: 2px solid rgba(255, 255, 255, .3); border-radius: 12px; background: linear-gradient(#1c0b06, #0a0403); color: #fff;
  font-family: var(--display); font-weight: 700; font-size: 34px; line-height: 1; letter-spacing: .06em;
  touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.arc-decks-pad > * { position: relative; pointer-events: none; }
.arc-decks-pad b { font-weight: 700; -webkit-text-stroke: 1px #b00000; text-shadow: 0 0 10px #ff3b00; }
.arc-decks-pad small { font-family: var(--body); font-size: 11px; font-weight: 700; letter-spacing: .14em; color: #ffd9a0; }
.arc-decks-pad i { position: absolute; inset: 0; transform-origin: 50% 100%; transform: scaleY(var(--arc-decks-lv, 0)); background: rgba(255, 217, 160, .32); }
.arc-decks-pad.arc-decks-on {
  background: #e02400; border-color: #ffd9a0; transform: scale(.96);
  box-shadow: 0 0 26px rgba(255, 70, 0, .85), inset 0 0 18px rgba(255, 217, 160, .35);
}
.arc-decks-pad.arc-decks-on small { color: #fff; }
.arc-decks-pad:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@keyframes arc-decks-in { from { opacity: 0; transform: scale(.6) rotate(-40deg); } to { opacity: 1; transform: none; } }
@keyframes arc-decks-hint { from { transform: rotate(-7deg) scale(.96); } to { transform: rotate(7deg) scale(1.06); } }
@media (orientation: landscape) and (max-height: 560px) {
  .arc-decks { flex-direction: row; gap: 30px; --arc-decks-d: max(140px, min(var(--arc-decks-h, 100vh) - var(--safe-t) - var(--safe-b) - 118px, 44vw)); }
  .arc-decks-deck { margin-bottom: 0; }
  .arc-decks-pads { width: min(42vw, 360px); }
  .arc-decks-pad { height: 68px; }
}
@media (prefers-reduced-motion: reduce) {
  .arc-decks-plate, .arc-decks-hint { animation: none; }
  .arc-decks-m3 .arc-decks-pic { filter: grayscale(1) brightness(.7); }
}`;

  const mk = (tag, cls, parent, text) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (text) el.textContent = text;
    if (parent) parent.append(el);
    return el;
  };

  // One seamless 32-beat loop, cut from the song with beat 0 at sample 0.
  function cutLoop(a) {
    const { buf, grid } = a, sr = buf.sampleRate;
    const n = Math.round(32 * grid.beat * sr), phrase = Math.round(16 * grid.beat * sr), off = Math.round(grid.first * sr);
    const fade = Math.round(sr * 0.006), out = [];
    for (let c = 0; c < 2; c++) {
      const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), dst = new Float32Array(n);
      // Some decoders put beat 0 a hair before the start of the file; the phrase repeats every 16 beats,
      // so what is missing there is taken from one phrase later.
      const at = (j) => src[j < 0 ? j + phrase : j] || 0;
      for (let i = 0; i < n; i++) dst[i] = at(off + i);
      // The seam: the last few milliseconds run into the outro in the file, but here they are followed by
      // beat 0 again, so they are blended into the lead-in of the same kick one phrase earlier.
      for (let i = 0; i < fade; i++) { const j = n - fade + i; dst[j] += (at(off + j - phrase) - dst[j]) * (i + 1) / fade; }
      out.push(dst);
    }
    return out;
  }

  // The worklet module may only be added once per context: a second registerProcessor would throw.
  function addModule(ctx) {
    if (!ctx.audioWorklet || typeof AudioWorkletNode !== 'function') return Promise.reject(new Error('no worklet'));
    if (modCtx !== ctx) {
      modCtx = ctx;
      modReady = ctx.audioWorklet.addModule(MODULE);
      modReady.catch(() => { modCtx = null; }); // e.g. offline before the file was cached: try again next time
    }
    return modReady;
  }

  // No AudioWorklet: the same file, run as an ordinary script, hands over the reader class instead.
  function loadDeckClass() {
    if (!deckClass) {
      deckClass = new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = MODULE;
        s.onload = () => (globalThis.ArcDeck ? ok(globalThis.ArcDeck) : fail(new Error('no deck')));
        s.onerror = () => { s.remove(); fail(new Error('no deck')); };
        document.head.append(s);
      });
      deckClass.catch(() => { deckClass = null; });
    }
    return deckClass;
  }

  function start(a) {
    a.css(CSS);
    const { ctx } = a, sr = ctx.sampleRate;
    const loop = cutLoop(a), n = loop[0].length, spb = n / 32;
    const OMEGA = 2 * Math.PI / (4 * a.grid.beat); // the record's own speed in rad/s: one turn is four beats
    const OPEN = Math.min(20000, sr * 0.45);

    // ---------- The deck on screen ----------
    const root = mk('div', 'arc-decks', a.stage);
    root.dir = 'ltr';
    const deckEl = mk('div', 'arc-decks-deck', root);
    const plate = mk('div', 'arc-decks-plate', deckEl), disc = mk('div', 'arc-decks-disc', plate);
    a.img.className = 'arc-decks-pic';
    a.img.draggable = false;
    disc.append(a.img);
    mk('i', 'arc-decks-grooves', disc); mk('i', 'arc-decks-mark', disc); mk('i', 'arc-decks-hole', disc);
    mk('i', 'arc-decks-sheen', plate); mk('i', 'arc-decks-arm', deckEl);
    const fx = mk('canvas', 'arc-decks-fx', deckEl), fg = fx.getContext('2d');
    const hint = mk('div', 'arc-decks-hint', deckEl, 'SCRATCH IT');
    const title = a.title;
    title.className = 'arc-decks-title';
    deckEl.append(title);
    const padsEl = mk('div', 'arc-decks-pads', root), pads = {};
    for (const [name, label, sub] of PADS) {
      const el = mk('button', 'arc-decks-pad', padsEl);
      el.type = 'button';
      mk('i', '', el); mk('b', '', el, label);
      pads[name] = { el, sub, small: mk('small', '', el, sub), down: null };
    }

    // Where the record is, in overlay coordinates (the canvas and the pointer both use them).
    const geo = { x: 0, y: 0, r: 0 };
    let fxSize = 0;
    const measure = () => {
      root.style.setProperty('--arc-decks-w', `${a.W}px`);
      root.style.setProperty('--arc-decks-h', `${a.H}px`);
      const b = deckEl.getBoundingClientRect(), o = a.el.getBoundingClientRect();
      geo.r = b.width / 2; geo.x = b.left - o.left + geo.r; geo.y = b.top - o.top + geo.r;
      const size = Math.round(b.width + FX_PAD * 2), dpr = Math.min(devicePixelRatio || 1, 2);
      if (size === fxSize) return;
      fxSize = size;
      fx.width = size * dpr; fx.height = size * dpr;
      fg.setTransform(dpr, 0, 0, dpr, 0, 0);
      fg.globalCompositeOperation = 'lighter'; fg.strokeStyle = '#ffd9a0'; fg.lineWidth = 2; fg.lineCap = 'round';
    };
    measure();
    a.on(window, 'resize', measure);
    a.after(900, measure); // once more when the overlay's opening shake is over

    // ---------- Sound: reader -> resonant low-pass -> trim -> the shell's output ----------
    // The trim takes back what the resonance adds, or the peak on the kick would slam the shell's limiter.
    const lp = a.track(ctx.createBiquadFilter()), trim = a.track(ctx.createGain());
    lp.type = 'lowpass'; lp.frequency.value = OPEN; lp.Q.value = 0;
    lp.connect(trim);
    trim.connect(a.out);
    const rep = { pos: 0, rate: 0, ghost: 0, slip: false, wraps: 0, at: performance.now() };
    const report = (m) => { rep.pos = m.pos; rep.rate = m.rate; rep.ghost = m.ghost; rep.slip = m.slip; rep.wraps = m.wraps; rep.at = performance.now(); };
    let send = () => {}, stopped = false, wired = false;
    let mode = PLAY, frac = 0.5;
    // acc is the angle the finger has turned since it came down; was is acc as of the last frame.
    const hand = { id: null, ang: 0, acc: 0, was: 0, x: 0, y: 0, v: 0, prev: 0, dir: 0, mid: false };
    const filt = { want: OPEN, set: OPEN };
    const held = []; // the pads that bend the playback, in the order they went down; the newest one rules

    // Whatever is held when the engine comes up (the module loads asynchronously) applies from the start.
    const grab = () => { hand.acc = hand.was = 0; send({ hand: 1 }); };
    const plug = () => { send({ mode, frac }); if (hand.id !== null) grab(); };
    addModule(ctx).then(() => {
      if (stopped) return;
      const node = a.track(new AudioWorkletNode(ctx, 'arc-decks', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }));
      node.port.onmessage = (e) => report(e.data);
      node.connect(lp);
      wired = true;
      node.port.postMessage({ buf: loop }, [loop[0].buffer, loop[1].buffer]);
      send = (m) => node.port.postMessage(m);
      plug();
    }).catch(() => loadDeckClass().then((Deck) => {
      if (stopped || wired) return;
      const deck = new Deck(sr), sp = a.track(ctx.createScriptProcessor(1024, 1, 2));
      deck.set({ buf: loop });
      sp.onaudioprocess = (e) => {
        const o = e.outputBuffer;
        if (!deck.process(o.getChannelData(0), o.getChannelData(1), o.length)) sp.onaudioprocess = null;
        report(deck);
      };
      sp.connect(lp);
      send = (m) => deck.set(m);
      plug();
    })).catch(() => { /* no engine at all: the record just sits there */ });

    // ---------- Pads ----------
    const sync = () => {
      const m = held.length ? MODES[held[held.length - 1]] : PLAY;
      send({ mode: m, frac });
      if (m === mode) return;
      root.classList.remove(`arc-decks-m${mode}`);
      if (m) root.classList.add(`arc-decks-m${m}`);
      title.textContent = TITLES[m];
      mode = m;
    };
    const setFrac = (f) => {
      frac = f;
      pads.stutter.small.textContent = f === 0.5 ? '1/2 BEAT' : f === 0.25 ? '1/4 BEAT' : '1/8 BEAT';
    };
    // The sweep: where the finger lands is already dark, sliding up opens it, sliding down closes it further.
    const sweep = (dy) => {
      const hz = Math.max(90, Math.min(OPEN * 0.6, 420 * Math.pow(2, dy / 28)));
      filt.want = hz;
      pads.filter.el.style.setProperty('--arc-decks-lv', (Math.log(hz / 90) / Math.log(OPEN * 0.6 / 90)).toFixed(3));
    };
    const press = (name, id, y) => {
      const p = pads[name];
      if (p.down) return;
      p.down = { id, y };
      p.el.classList.add('arc-decks-on');
      a.buzz(6);
      if (name === 'filter') { root.classList.add('arc-decks-filt'); sweep(0); return; }
      held.push(name);
      if (name === 'stutter') setFrac(0.5);
      sync();
    };
    const release = (name) => {
      const p = pads[name];
      if (!p.down) return;
      p.down = null;
      p.el.classList.remove('arc-decks-on');
      p.small.textContent = p.sub;
      if (name === 'filter') {
        root.classList.remove('arc-decks-filt');
        filt.want = OPEN;
        p.el.style.setProperty('--arc-decks-lv', 0);
        return;
      }
      held.splice(held.indexOf(name), 1);
      sync();
    };
    const slide = (name, y) => {
      const dy = pads[name].down.y - y; // up is positive
      if (name === 'filter') sweep(dy);
      if (name !== 'stutter') return;
      const f = dy > 78 ? 0.125 : dy > 34 ? 0.25 : 0.5;
      if (f === frac) return;
      setFrac(f);
      if (mode === STUTTER) send({ mode, frac });
    };
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* not supported, or the pointer is already gone */ } };
    const unhint = () => hint.classList.add('arc-decks-gone');
    for (const name in pads) {
      a.on(pads[name].el, 'pointerdown', (e) => {
        e.preventDefault();
        unhint();
        capture(pads[name].el, e);
        press(name, e.pointerId, e.clientY);
      });
    }
    a.on(document, 'keydown', (e) => { const name = KEYS[e.key]; if (name && !e.repeat) { unhint(); press(name, 'key', 0); } });
    a.on(document, 'keyup', (e) => { const name = KEYS[e.key]; if (name && pads[name].down && pads[name].down.id === 'key') release(name); });

    // ---------- The hand on the record ----------
    a.on(disc, 'pointerdown', (e) => {
      if (hand.id !== null) return;
      measure();
      const dx = e.clientX - geo.x, dy = e.clientY - geo.y;
      if (dx * dx + dy * dy > geo.r * geo.r) return;
      e.preventDefault();
      unhint();
      capture(disc, e);
      hand.id = e.pointerId; hand.ang = Math.atan2(dy, dx); hand.v = 0; hand.prev = 0; hand.dir = 0; hand.mid = false;
      hand.x = e.clientX; hand.y = e.clientY;
      root.classList.add('arc-decks-held');
      grab();
    });
    a.on(window, 'pointermove', (e) => {
      if (e.pointerId === hand.id) {
        const dx = e.clientX - geo.x, dy = e.clientY - geo.y;
        hand.x = e.clientX; hand.y = e.clientY;
        // Right at the spindle the angle is meaningless: a millimetre of finger would be half a turn.
        if (dx * dx + dy * dy < geo.r * geo.r * 0.012) { hand.mid = true; return; }
        const ang = Math.atan2(dy, dx);
        let d = ang - hand.ang;
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
        if (!hand.mid) hand.acc += d;
        hand.ang = ang; hand.mid = false;
        return;
      }
      for (const name in pads) if (pads[name].down && pads[name].down.id === e.pointerId) slide(name, e.clientY);
    });
    const lift = (e) => {
      if (e.pointerId === hand.id) {
        hand.id = null;
        root.classList.remove('arc-decks-held');
        send({ hand: 0 });
        return;
      }
      for (const name in pads) if (pads[name].down && pads[name].down.id === e.pointerId) release(name);
    };
    a.on(window, 'pointerup', lift);
    a.on(window, 'pointercancel', lift);
    a.on(window, 'blur', () => {
      for (const name in pads) release(name);
      if (hand.id !== null) lift({ pointerId: hand.id });
    });

    // ---------- Every frame ----------
    const sparks = Array.from({ length: 48 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
    let sparkAt = 0, fxLive = false;
    const spray = (count, dir, speed) => {
      // From under the finger, along the way the record is being dragged and a little outwards.
      const lx = hand.x - geo.x, ly = hand.y - geo.y, d = Math.hypot(lx, ly) || 1;
      const tx = -ly / d * dir, ty = lx / d * dir;
      for (let k = 0; k < count; k++) {
        const s = sparks[sparkAt++ % sparks.length], out = 0.2 + Math.random() * 0.9, v = speed * (0.5 + Math.random());
        s.x = lx + geo.r + FX_PAD; s.y = ly + geo.r + FX_PAD;
        s.vx = (tx + lx / d * out + (Math.random() - 0.5) * 0.6) * v;
        s.vy = (ty + ly / d * out + (Math.random() - 0.5) * 0.6) * v;
        s.life = 1;
      }
    };
    const pulse = (s) => {
      if (a.calm) return;
      glow = Math.max(glow, s);
      if (!plate.animate) return;
      plate.animate([{ transform: `scale(${1 + s * 0.05})` }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
      title.animate([{ transform: `scale(${1 + s * 0.14})` }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
    };
    let last = performance.now(), vis = 0, lastHalf = -1, lastHit = 0, lastWraps = 0, glow = 0, turn = '', skew = 0, skewSet = 0;

    a.draw = (g, W, H, now) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - last) / 1000));
      last = now;

      // The needle now: the last report, carried forward at the reported speed.
      let p = (rep.pos + rep.rate * Math.min(60, Math.max(0, now - rep.at)) / 1000 * sr) % n;
      if (p < 0) p += n;
      // Reports arrive in bursts on devices with a big audio buffer, which would make the record judder.
      // So the picture turns on its own at the reported speed and is only pulled towards the reports;
      // under a finger, and after a jump of the needle, it follows them directly.
      let gap = p - (vis + rep.rate * dt * sr) % n;
      if (gap > n / 2) gap -= n; else if (gap < -n / 2) gap += n;
      if (hand.id === null && Math.abs(gap) < spb * 0.1) p = ((p - gap * 0.85) % n + n) % n;
      vis = p;
      const t = `rotate(${(p / spb * 90 % 360).toFixed(2)}deg)`;
      if (t !== turn) disc.style.transform = turn = t;

      // The hand: the engine gets the finger's angle and drags the needle to it. The speed (the angle
      // covered this frame as a multiple of the record's own speed, averaged over two frames because
      // pointer events and frames do not line up one to one) only drives the sparks and the title.
      if (hand.id !== null) {
        const raw = Math.max(-4, Math.min(4, (hand.acc - hand.was) / dt / OMEGA)), v = (raw + hand.prev) / 2;
        if (hand.acc !== hand.was) send({ turn: hand.acc, dt });
        hand.was = hand.acc; hand.prev = raw;
        hand.v = v;
        const dir = v > 0.3 ? 1 : v < -0.3 ? -1 : 0;
        if (dir && dir !== hand.dir) {
          if (hand.dir) { a.buzz(8); if (!a.calm) spray(6, dir, 7); }
          hand.dir = dir;
        }
        if (!a.calm && Math.abs(v) > 0.45) spray(Math.abs(v) > 2 ? 2 : 1, v > 0 ? 1 : -1, 3 + Math.abs(v) * 2);
      }

      // Kicks, from the needle crossing the beat grid while the record plays on its own.
      const half = Math.floor(p / spb * 2);
      if (lastHalf < 0) {
        // The record starts to turn: the opening downbeat gets its hit here, not one beat late.
        if (rep.rate > 0) {
          lastHalf = half;
          if (mode === PLAY && hand.id === null && half === 0) { a.hit(0.85); pulse(0.85); lastHit = now; }
        }
      } else if (half !== lastHalf) {
        const step = (half - lastHalf + 64) % 64;
        if (rep.rate > 0.6 && mode === PLAY && hand.id === null && step <= 2 && now - lastHit > 120) {
          const beat = half >> 1;
          // Every beat carries a kick; the two fills sit half a beat before beats 8 and 24.
          const s = half & 1 ? (half === 15 || half === 47 ? 0.45 : 0) : beat % 16 === 0 ? 0.85 : beat % 4 === 0 ? 0.55 : 0.32;
          if (s) { a.hit(s); pulse(s); lastHit = now; }
        }
        lastHalf = half;
      }
      if (rep.wraps !== lastWraps) {
        lastWraps = rep.wraps;
        if (now - lastHit > 90) { a.hit(0.3); pulse(0.3); lastHit = now; }
      }

      // The filter, at most once a frame.
      if (filt.want !== filt.set) {
        const open = filt.want === OPEN, tc = open ? 0.09 : 0.025;
        lp.frequency.setTargetAtTime(filt.want, ctx.currentTime, tc);
        if (open !== (filt.set === OPEN)) {
          lp.Q.setTargetAtTime(open ? 0 : 9, ctx.currentTime, tc);
          trim.gain.setTargetAtTime(open ? 1 : 0.6, ctx.currentTime, tc);
        }
        filt.set = filt.want;
      }

      // The title leans the way the record is being dragged.
      if (!a.calm) {
        skew += ((hand.id !== null ? hand.v : 0) - skew) * 0.3;
        if (Math.abs(skew) < 0.01) skew = 0;
        if (Math.abs(skew - skewSet) > 0.02 || (!skew && skewSet)) {
          skewSet = skew;
          title.style.transform = skew ? `skewX(${(-skew * 7).toFixed(1)}deg) scale(${(1 + Math.abs(skew) * 0.03).toFixed(3)})` : '';
        }
      }

      // Around the record: a glow that breathes with the kicks and the 32 beats of the loop as a dial.
      const { x, y, r } = geo;
      if (r > 1) {
        glow *= 0.9;
        const halo = g.createRadialGradient(x, y, r * 0.9, x, y, r * 1.5);
        halo.addColorStop(0, `rgba(255,90,31,${(0.22 + glow * 0.5).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(224,36,0,0)');
        g.fillStyle = halo;
        g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
        const beat = Math.floor(p / spb);
        g.lineCap = 'round';
        for (let pass = 0; pass < 3; pass++) {
          g.strokeStyle = pass === 0 ? 'rgba(255,255,255,.18)' : pass === 1 ? '#e02400' : '#ffd9a0';
          g.lineWidth = pass === 2 ? 5 : 3;
          g.beginPath();
          for (let i = 0; i < 32; i++) {
            if ((pass === 0 && i <= beat) || (pass === 1 && i >= beat) || (pass === 2 && i !== beat)) continue;
            const ang = i / 32 * 2 * Math.PI - Math.PI / 2, c = Math.cos(ang), s = Math.sin(ang);
            const r1 = r + 9, r2 = r1 + (i % 4 ? 6 : 11);
            g.moveTo(x + c * r1, y + s * r1); g.lineTo(x + c * r2, y + s * r2);
          }
          g.stroke();
        }
        // While a pad holds the needle off course: where the song is by now, and where it will come back in.
        if (rep.slip) {
          const ang = ((rep.ghost + (now - rep.at) / 1000 * sr) / n) * 2 * Math.PI - Math.PI / 2;
          g.fillStyle = '#fff';
          g.beginPath(); g.arc(x + Math.cos(ang) * (r + 15), y + Math.sin(ang) * (r + 15), 5, 0, 2 * Math.PI); g.fill();
        }
      }

      // Sparks, on their own canvas above the record (the shell's canvas lies under it).
      if (fxLive) fg.clearRect(0, 0, fxSize, fxSize);
      fxLive = false;
      for (const s of sparks) {
        if (s.life <= 0) continue;
        fxLive = true;
        s.x += s.vx; s.y += s.vy; s.vy += 0.22;
        fg.globalAlpha = s.life;
        fg.beginPath(); fg.moveTo(s.x, s.y); fg.lineTo(s.x - s.vx * 2.5, s.y - s.vy * 2.5); fg.stroke();
        s.life -= 0.05;
      }
    };

    return () => { stopped = true; send({ stop: 1 }); };
  }

  ARC_CONCEPTS.push({ id: 'decks', name: 'SCRATCH', start });
})();
