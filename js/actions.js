'use strict';

// Workout actions, rest timer, wake lock and backup.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Workout actions ----------
// src: { name, sets?, reps?, rest?, w? } — usually a template exercise. Its weight (`w`) is the current working weight.
function makeExercise(src, warmup) {
  const { name } = src;
  const prev = lastSetsFor(name);
  const target = num(src.reps);
  const cur = num(src.w);
  const n = num(src.sets) || (prev ? prev.length : 3);
  const sets = Array.from({ length: n }, (_, j) => {
    const p = prev && (prev[j] || prev[prev.length - 1]);
    const pw = cur ? fmtW(cur) : p ? fmtW(p.w) : '';
    const pr = target ? String(target) : p ? String(p.r) : '';
    return { w: '', r: '', pw, pr, done: false };
  });
  if (db.settings.lastSetFail && sets.length) sets[sets.length - 1].fail = true;
  if (warmup) sets.unshift(makeWarmup(name, cur || (prev && prev[0].w)));
  return { id: uid(), name, rest: num(src.rest) || db.settings.defaultRest, target: target || '', sets };
}

// Suggest last time's warmup, or ~50% of the working weight (rounded to 2.5) for 10 reps.
function makeWarmup(name, workWeight) {
  const last = lastWarmupFor(name);
  const half = workWeight ? Math.round((workWeight * 0.5) / 2.5) * 2.5 : '';
  return { wu: true, w: '', r: '', pw: last ? fmtW(last.w) : (half ? fmtW(half) : ''), pr: last ? String(last.r) : '10', done: false };
}

// Remember `name` as an alternative to the exercise's original, most recent first.
function rememberAlt(ex, name) {
  const origin = ex.swapOf || ex.name;
  db.alts[origin] = [name, ...(db.alts[origin] || []).filter((n) => n !== name)].slice(0, 8);
  return origin;
}

// Replace exercise e with `name` because its station is taken. Sets already done stay on the original;
// the rest move to the alternative.
function swapExercise(e, name) {
  name = String(name || '').trim();
  const ex = db.active.exercises[e];
  if (!name || name === ex.name) { toast(L('בחר או הקלד תרגיל חלופי', 'Välj eller skriv en ersättningsövning')); return; }
  const origin = rememberAlt(ex, name);
  const left = Math.max(1, work(ex.sets).filter((s) => !s.done).length);
  const warmup = ex.sets.some((s) => s.wu && !s.done);
  const alt = makeExercise({ name, sets: left, reps: ex.target, rest: ex.rest }, warmup);
  alt.swapOf = origin;
  alt.planned = ex.planned ?? work(ex.sets).length;
  if (ex.sets.some((s) => s.done)) {
    ex.planned = ex.planned ?? work(ex.sets).length;
    ex.sets = ex.sets.filter((s) => s.done);
    db.active.exercises.splice(e + 1, 0, alt);
  } else {
    db.active.exercises[e] = alt;
  }
  ui.swap = null; ui.order = null;
  save(); render();
  toast(L(`הוחלף ל${name}`, `Bytt till ${exName(name)}`));
}

// The original station freed up: the sets not done yet on the alternative go back to the original exercise.
// If the original is still in the workout (it was swapped mid-way), they're added back to it.
function unswapExercise(e) {
  const alt = db.active.exercises[e];
  const origin = alt.swapOf;
  const left = work(alt.sets).filter((s) => !s.done).length;
  const orig = db.active.exercises.find((x) => x.name === origin);
  if (orig) {
    const sets = makeExercise({ name: origin, sets: Math.max(1, left), reps: orig.target, rest: orig.rest }).sets;
    if (left || !alt.sets.some((s) => s.done)) orig.sets.push(...sets);
  } else {
    const back = makeExercise({ name: origin, sets: Math.max(1, left), reps: alt.target, rest: alt.rest }, alt.sets.some((s) => s.wu && !s.done));
    back.planned = alt.planned;
    if (alt.sets.some((s) => s.done)) db.active.exercises.splice(e + 1, 0, back);
    else db.active.exercises[e] = back;
  }
  if (alt.sets.some((s) => s.done)) alt.sets = alt.sets.filter((s) => s.done);
  else db.active.exercises.splice(db.active.exercises.indexOf(alt), 1);
  ui.swap = null; ui.order = null;
  save(); render();
  toast(L(`חזרת ל${origin}`, `Tillbaka till ${exName(origin)}`));
}

async function startWorkout(tpl) {
  const free = L('אימון חופשי', 'Fritt pass');
  if (!await ask({ title: L(`להתחיל את "${tpl ? tpl.name : free}"?`, `Starta "${tpl ? tpl.name : free}"?`), msg: L('שעון האימון יתחיל לרוץ.', 'Passets klocka börjar gå.'), ok: L('יאללה, מתחילים', 'Kör igång!'), cancel: L('לא עכשיו', 'Inte nu') })) return;
  db.active = {
    id: uid(),
    templateId: tpl ? tpl.id : null,
    name: tpl ? tpl.name : free,
    start: Date.now(),
    exercises: tpl ? tpl.exercises.map((e, i) => makeExercise(e, i === 0)) : [],
  };
  save();
  requestWakeLock();
  render();
  window.scrollTo(0, 0);
}

// A workout logged after the fact: the user picked a day other than the one it was opened on.
const backdated = (w) => !!w.date && w.date !== isoDay(w.start);

// Workout clock time, minus any paused stretches. w.held is the moment it was paused.
const elapsedMs = (w) => (w.held ?? Date.now()) - w.start - (w.pausedMs || 0);

// Tapping the clock in the top bar offers to pause it or stop and finish the workout; it keeps running until one is picked.
async function clockMenu() {
  const w = db.active;
  if (!w || backdated(w)) return;
  const pick = w.held
    ? await ask({ title: L('השעון מושהה', 'Klockan är pausad'), ok: L('המשך', 'Fortsätt'), extra: L('עצור וסיים', 'Stoppa och avsluta'), cancel: L('סגור', 'Stäng') })
    : await ask({ title: L('שעון האימון', 'Passets klocka'), msg: L('להשהות את השעון או לעצור ולסיים את האימון?', 'Pausa klockan eller stoppa och avsluta passet?'), ok: L('השהה', 'Pausa'), extra: L('עצור וסיים', 'Stoppa och avsluta') });
  if (!pick || db.active !== w) return;
  if (pick === 'extra') { finishWorkout(); return; }
  if (w.held) { w.pausedMs = (w.pausedMs || 0) + (Date.now() - w.held); delete w.held; }
  else w.held = Date.now();
  save();
  tick();
}

async function finishWorkout() {
  const w = db.active;
  const exercises = w.exercises
    .map((e) => ({
      name: e.name,
      sets: e.sets.filter((s) => s.done).map((s) => ({
        w: num(s.w) || 0, r: num(s.r) || 0, ...(s.wu ? { wu: true } : {}), ...(s.fail ? { fail: true } : {}),
      })),
    }))
    .filter((e) => e.sets.length);
  const undone = w.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.done && (s.w !== '' || s.r !== '')).length, 0);

  if (!exercises.length) {
    if (await ask({ title: L('לבטל את האימון?', 'Avbryta passet?'), msg: L('לא סומן אף סט כבוצע (✓), אז אין מה לשמור.', 'Inget set är markerat som klart (✓), så det finns inget att spara.'), ok: L('בטל אימון', 'Avbryt pass'), cancel: L('חזרה לאימון', 'Tillbaka till passet'), danger: true })) discardWorkout(true);
    return;
  }
  if (undone && !await ask({ title: L('לסיים את האימון?', 'Avsluta passet?'), msg: L(`${undone} סטים מולאו אבל לא סומנו ב-✓, והם לא יישמרו.`, `${undone} set är ifyllda men inte markerade med ✓, och de sparas inte.`), ok: L('סיים בכל זאת', 'Avsluta ändå'), cancel: L('חזרה לאימון', 'Tillbaka till passet') })) return;

  const prs = exercises.filter((e) => {
    const { maxE } = bestFor(e.name);
    const sets = work(e.sets);
    return maxE > 0 && sets.length && Math.max(...sets.map((s) => e1rm(s.w, s.r))) > maxE;
  }).map((e) => e.name);

  // If exercises, set counts or rest times changed during the workout, offer to carry that into the template.
  const tpl = db.templates.find((t) => t.id === w.templateId);
  if (tpl) {
    // A swap for a taken station counts as the original exercise, so the template keeps its plan.
    const names = new Set(w.exercises.filter((e) => work(e.sets).length).map((e) => e.name));
    const updated = w.exercises.filter((e) => work(e.sets).length && !(e.swapOf && names.has(e.swapOf))).map((e) => {
      const name = e.swapOf || e.name;
      const old = tpl.exercises.find((x) => x.name === name);
      return {
        id: old ? old.id : uid(),
        name,
        sets: e.planned ?? work(e.sets).length,
        reps: old ? old.reps : (num(e.target) || num(work(e.sets)[0].r) || num(work(e.sets)[0].pr) || 10),
        rest: e.rest,
        ...(old && old.w ? { w: old.w } : {}),
      };
    });
    const sig = (list) => list.map((x) => `${x.name}|${x.sets}|${x.rest}`).join(';');
    if (sig(updated) !== sig(tpl.exercises) && await ask({ title: L('לעדכן את התבנית?', 'Uppdatera mallen?'), msg: L(`שינית את המבנה של "${tpl.name}" באימון הזה (תרגילים, סטים או מנוחה).`, `Du ändrade upplägget för "${tpl.name}" under passet (övningar, set eller vila).`), ok: L('עדכן תבנית', 'Uppdatera mall'), cancel: L('השאר כמו שהיא', 'Behåll som den är') })) {
      tpl.exercises = updated;
    }
    // Keep each template exercise's weight at the heaviest working weight just done.
    for (const x of tpl.exercises) {
      const done = exercises.find((e) => e.name === x.name);
      const top = done && Math.max(0, ...work(done.sets).map((s) => s.w));
      if (top) x.w = top;
    }
  }

  let start = w.start, end = start + elapsedMs(w);
  if (backdated(w)) {
    // Keep the time of day it was entered at, on the chosen day; the duration comes from the field.
    const t = new Date(w.start), d = new Date(dayTs(w.date));
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes()).getTime();
    end = start + Math.max(1, num(w.mins) ?? 60) * 60000;
  }
  // Seconds of stretching done. A live workout's clock already ran through it; a backdated one adds it on top.
  const stretched = stretchState(w);
  const stretch = ['pre', 'post'].reduce((a, ph) => a + stretched[ph].reduce((b, id) => b + stretchSecs(findStretch(ph, id)), 0), 0);
  if (backdated(w)) end += stretch * 1000;
  db.workouts.push({ id: w.id, templateId: w.templateId, name: w.name || L('אימון', 'Pass'), start, end, exercises, ...(stretch ? { stretch } : {}) });
  db.active = null;
  stopTimer();
  save();
  releaseWakeLock();
  render();
  window.scrollTo(0, 0);
  toast(prs.length ? `${L('שיא חדש', 'Nytt rekord')}: ${prs.map(exName).join(', ')}` : L('האימון נשמר', 'Passet sparat'), prs.length ? 4000 : 2600);
}

async function discardWorkout(skipConfirm) {
  if (!skipConfirm && !await ask({ title: L('לבטל את האימון?', 'Avbryta passet?'), msg: L('מה שהוזן לא יישמר.', 'Det du har fyllt i sparas inte.'), ok: L('בטל אימון', 'Avbryt pass'), cancel: L('המשך להתאמן', 'Fortsätt träna'), danger: true })) return;
  db.active = null;
  stopTimer();
  save();
  releaseWakeLock();
  render();
}

// ---------- Rest timer ----------
let timer = null;
try { timer = JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { timer = null; }
const saveTimer = () => { try { timer ? localStorage.setItem(TIMER_KEY, JSON.stringify(timer)) : localStorage.removeItem(TIMER_KEY); } catch { /* ignore */ } };

// opts: { label, stretch (id marked done when it runs out), next (a second side to run right after) }
function startTimer(sec, opts = {}) {
  timer = { end: Date.now() + sec * 1000, total: sec, beeped: false, ...opts };
  saveTimer();
  tick();
}
function stopTimer() { timer = null; saveTimer(); tick(); }

let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio */ }
}
function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.25, 0.5].forEach((d, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + d);
    o.stop(t0 + d + 0.2);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function tick() {
  const el = $('#elapsed');
  if (el && db.active) el.textContent = backdated(db.active) ? '' : fmtDur(elapsedMs(db.active));
  if (el) el.classList.toggle('held', !!db.active?.held);
  // Mirror it in the top bar while the page's own clock is scrolled out of view (or on another tab).
  const top = $('#top-elapsed');
  const live = db.active && !backdated(db.active);
  const seen = el && el.getBoundingClientRect().bottom > $('.topbar').offsetHeight;
  top.classList.toggle('hidden', !live || !!seen);
  top.classList.toggle('held', !!(live && db.active.held));
  if (live && !seen) top.textContent = fmtDur(elapsedMs(db.active));

  const box = $('#timer');
  if (!timer) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const leftMs = timer.end - Date.now();
  const left = Math.ceil(leftMs / 1000);
  const over = left <= 0;
  box.classList.toggle('over', over);
  $('#timer-label').textContent = timer.label || L('מנוחה', 'Vila');
  $('#timer-time').textContent = over ? (timer.stretch ? L('כל הכבוד!', 'Snyggt!') : L('יאללה!', 'Kör!')) : fmtDur(left * 1000);
  $('#timer-fill').style.width = `${over ? 100 : Math.max(0, Math.min(100, (leftMs / (timer.total * 1000)) * 100))}%`;
  if (over && !timer.beeped) {
    timer.beeped = true;
    saveTimer();
    if (Date.now() - timer.end < 5000) beep(); // don't beep for a timer that ran out while the app was closed
    if (timer.next) { startTimer(timer.total, timer.next); return; }
    if (timer.stretch && db.active) { markStretch(db.active, timer.phase, timer.stretch, true); save(); render(); }
  }
  if (leftMs < -30000) stopTimer();
}

// Keep the screen awake during a workout (supported on recent iOS versions).
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && db.active && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { wakeLock = null; }
}
function releaseWakeLock() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

// ---------- Backup ----------
async function exportData() {
  const json = JSON.stringify(db, null, 2);
  const name = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: L('גיבוי אימונים', 'Säkerhetskopia av träningen') }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.templates) || !Array.isArray(d.workouts)) throw new Error('bad');
      if (!await ask({ title: L('לשחזר את הגיבוי?', 'Återställa säkerhetskopian?'), msg: L(`${d.workouts.length} אימונים ו-${d.templates.length} תבניות. הנתונים הנוכחיים יוחלפו.`, `${d.workouts.length} pass och ${d.templates.length} mallar. Nuvarande data ersätts.`), ok: L('שחזר', 'Återställ'), danger: true })) return;
      db = { ...seed(), ...d, settings: { ...seed().settings, ...(d.settings || {}) } };
      save();
      render();
      toast(L('הגיבוי שוחזר', 'Säkerhetskopian återställd'));
    } catch { toast(L('הקובץ לא תקין', 'Ogiltig fil')); }
  };
  reader.readAsText(file);
}
