'use strict';

// BATEMAN ARC, concept SCRATCH: the record deck itself.
// A variable-speed reader over a 32-beat stereo loop of the song. It can run at any rate, backwards included,
// which is what makes scratching, the tape-stop brake and the reverse pad possible.
//
// This one file is the only copy of the reader. Normally it is loaded as an AudioWorklet module and
// registers the 'arc-decks' processor. Where AudioWorklet is missing, js/bateman-decks.js loads it as an
// ordinary script instead; then it only publishes the ArcDeck class, which is driven from a
// ScriptProcessorNode on the main thread.
(() => {
  const PLAY = 0, BRAKE = 1, STUTTER = 2, REVERSE = 3;
  const SPIN = 0.09;  // seconds the motor takes to bring the record up to speed
  const GRIP = 0.03;  // seconds in which the record closes the gap to the finger
  const MAX = 8;      // top speed under a hand: well above a fast flick, so the record can always catch up

  class ArcDeck {
    constructor(rate) {
      this.sr = rate;
      this.L = this.R = null;
      this.n = 0;            // loop length in samples (32 beats)
      this.pos = 0;          // the needle
      this.rate = 0;         // current speed; starts at 0 so the record audibly spins up
      this.amp = 0;          // output gain, closed while the record stands still
      this.mode = PLAY;
      this.hand = false;     // a finger is on the record
      this.trav = 0;         // how far the needle has travelled since the finger came down, in samples...
      this.want = 0;         // ...and how far the finger has turned the record by now
      this.step = 0;         // the finger reports once a frame; want glides to each report at this much a sample
      this.left = 0;         // samples of that glide still to go
      this.slip = false;     // a pad is taking the needle off course...
      this.ghost = 0;        // ...and this is where the song would be without it
      this.pend = 0;         // the pad was let go: slip back at the next sample that is free (2 = after the brake)
      this.late = false;     // the motor is spinning up after a brake, so the needle runs ahead of the song
      this.frac = 0.5;       // stutter slice, in beats
      this.a = 0;            // stutter slice start
      this.len = 0;          // stutter slice length
      this.wraps = 0;        // stutter repeats so far (the visuals count them)
      this.xf = Math.max(8, Math.round(rate * 0.005)); // crossfade length for every jump of the needle
      this.xpos = 0;         // the old needle, fading out after a jump
      this.xn = 0;
      this.lpL = this.lpR = 0;
      this.dead = false;
    }

    set(m) {
      if (m.buf) { this.L = m.buf[0]; this.R = m.buf[1] || m.buf[0]; this.n = this.L.length; }
      if (m.hand !== undefined) {
        this.hand = !!m.hand; this.trav = this.want = this.left = 0;
        // A hand on the record owns the position: nothing to slip back to.
        if (this.hand) { this.slip = this.late = false; this.pend = 0; }
        else if (this.mode === STUTTER) this.slice();
      }
      if (this.hand && Number.isFinite(m.turn)) {
        // The finger's total angle since it came down (one turn of the record is four beats), reached over
        // the frame that follows. Following the position, not the speed, keeps the picture under the finger.
        const span = Math.max(1, Math.round((m.dt > 0 ? Math.min(m.dt, 0.05) : 0.016) * this.sr));
        this.step = (m.turn * this.n / (16 * Math.PI) - this.want) / span;
        this.left = span;
      }
      if (m.mode !== undefined) this.setMode(m.mode, m.frac);
      if (m.stop) this.dead = true;
    }

    setMode(mode, frac) {
      const was = this.mode;
      this.mode = mode;
      if (frac > 0) this.frac = frac;
      if (mode === was) { if (mode === STUTTER) this.slice(); return; }
      if (mode === PLAY) {
        // Slip mode: come back in where the song would have been. After the brake the motor still has to
        // spin up; after the other pads the record is already turning.
        if (this.slip) { this.pend = was === BRAKE ? 2 : 1; if (was !== BRAKE) this.rate = 1; }
        return;
      }
      // Caught again before the needle slipped back: the song's place is still being kept.
      if (this.pend) this.pend = 0;
      else if (was === PLAY && !this.hand) {
        this.slip = true;
        this.ghost = this.pos - (this.late ? SPIN * this.sr * (1 - this.rate) : 0);
        if (this.ghost < 0) this.ghost += this.n; else if (this.ghost >= this.n) this.ghost -= this.n;
      }
      if (mode === STUTTER) this.slice();
    }

    // The slice of the beat grid the needle is in right now; it repeats until the pad is let go.
    slice() {
      if (!this.n) return;
      this.len = this.n / 32 * this.frac;
      this.a = Math.floor(this.pos / this.len) * this.len;
    }

    // Fills one block. Returns false once it has been told to stop and has faded to silence.
    process(outL, outR, frames) {
      const n = this.n, L = this.L, R = this.R;
      if (!n) { outL.fill(0); if (outR !== outL) outR.fill(0); return !this.dead; }
      const mode = this.mode, dead = this.dead, sr = this.sr, hand = this.hand && !dead;
      // How fast the speed follows: a hand is immediate, the motor has inertia, the brake is a tape stop.
      // (Against GRIP, the hand's 8 ms lets the record settle on the finger without overshooting it.)
      const tau = dead ? 0.004 : hand ? 0.008 : mode === BRAKE ? 0.13 : mode === PLAY ? SPIN : 0.012;
      const k = 1 - Math.exp(-1 / (tau * sr)), kAmp = 1 - Math.exp(-1 / (0.003 * sr)), grip = 1 / (GRIP * sr);
      const stut = mode === STUTTER && !hand, a = this.a, len = this.len, xf = this.xf, mid = n / 2, step = this.step;
      let { pos, rate, amp, ghost, xpos, xn, lpL, lpR, trav, want, left, slip, pend } = this;
      let target = dead || mode === BRAKE ? 0 : mode === REVERSE ? -1 : 1;
      if (!(rate === rate) || !(pos === pos)) { rate = 0; pos = 0; }
      for (let i = 0; i < frames; i++) {
        if (hand) {
          // Chase the finger: a still finger ends at speed 0 and silence, a fast flick is caught up with.
          if (left > 0) { want += step; left--; }
          target = (want - trav) * grip;
          if (target > MAX) target = MAX; else if (target < -MAX) target = -MAX;
        }
        rate += (target - rate) * k;
        pos += rate;
        if (hand) trav += rate;
        // The needle only jumps while no crossfade is running (a second jump would cut the first one dead
        // and click); until then it reads on for at most a few milliseconds.
        if (xn === 0) {
          if (pend) {
            // After the brake the needle lands ahead by exactly what the spin-up will lose, so the song is
            // back on its own timeline once the motor is up to speed.
            xpos = pos; xn = xf; pos = ghost + (pend === 2 ? SPIN * sr * (1 - rate) : 0);
            this.late = pend === 2; pend = 0; slip = false;
          } else if (stut) {
            // Measured from the slice start the short way round, so a slice at either end of the loop works.
            let d = pos - a;
            if (d > mid) d -= n; else if (d < -mid) d += n;
            if (d >= len) { xpos = pos; xn = xf; pos -= len; this.wraps++; }
            else if (d < 0) { xpos = pos; xn = xf; pos += len; }
          }
        }
        if (pos >= n) pos -= n; else if (pos < 0) pos += n;
        if (slip && ++ghost >= n) ghost -= n;

        let i0 = pos | 0;
        const f = pos - i0;
        if (i0 >= n) i0 = 0;
        const i1 = i0 + 1 < n ? i0 + 1 : 0;
        let l = L[i0] + (L[i1] - L[i0]) * f, r = R[i0] + (R[i1] - R[i0]) * f;

        if (xn > 0) {
          // The old needle keeps reading for a few milliseconds, so a jump never lands as a click.
          if (xpos >= n) xpos -= n; else if (xpos < 0) xpos += n;
          let j0 = xpos | 0;
          const g = xpos - j0, w = xn / xf;
          if (j0 >= n) j0 = 0;
          const j1 = j0 + 1 < n ? j0 + 1 : 0;
          l += (L[j0] + (L[j1] - L[j0]) * g - l) * w;
          r += (R[j0] + (R[j1] - R[j0]) * g - r) * w;
          xpos += rate; xn--;
        }

        const ar = rate < 0 ? -rate : rate;
        // Fast scratches read far fewer samples than they skip; a little low-pass keeps that from turning
        // into harsh aliasing. At normal speed it is wide open.
        const c = ar > 1.5 ? 1.5 / ar : 1;
        lpL += (l - lpL) * c; lpR += (r - lpR) * c;
        // A record that stands still is silent, not stuck on one sample.
        const open = dead ? 0 : ar < 0.015 ? 0 : ar > 0.048 ? 1 : (ar - 0.015) * 30;
        amp += (open - amp) * kAmp;
        outL[i] = lpL * amp; outR[i] = lpR * amp;
      }
      if (amp < 1e-4) amp = 0;
      this.pos = pos; this.rate = rate; this.amp = amp; this.ghost = ghost;
      this.xpos = xpos; this.xn = xn; this.lpL = lpL; this.lpR = lpR;
      this.trav = trav; this.want = want; this.left = left; this.slip = slip; this.pend = pend;
      return !(dead && amp === 0);
    }
  }

  if (typeof registerProcessor !== 'function') { globalThis.ArcDeck = ArcDeck; return; }

  registerProcessor('arc-decks', class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.deck = new ArcDeck(sampleRate);
      this.since = 0;
      this.port.onmessage = (e) => this.deck.set(e.data);
    }

    process(inputs, outputs) {
      const out = outputs[0], d = this.deck, frames = out[0].length;
      const alive = d.process(out[0], out[1] || out[0], frames);
      // The needle position, about 50 times a second, for the picture of the record.
      this.since += frames;
      if (this.since >= sampleRate * 0.018) {
        this.since = 0;
        this.port.postMessage({ pos: d.pos, rate: d.rate, ghost: d.ghost, slip: d.slip, wraps: d.wraps });
      }
      return alive;
    }
  });
})();
