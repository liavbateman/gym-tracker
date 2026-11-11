'use strict';

// render(), the set keypad, event handling and boot. Loaded last.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// Sticky elements below the top bar need its real height (it grows with the iPhone notch).
const topbarObs = new ResizeObserver(([e]) => document.documentElement.style.setProperty('--top-h', `${e.target.offsetHeight}px`));
topbarObs.observe(document.querySelector('.topbar'));

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  let title, html;
  document.querySelector('.gear').classList.toggle('on', ui.tab === 'settings');
  switch (ui.tab) {
    case 'settings': title = L('הגדרות', 'Inställningar'); html = viewSettings(); break;
    case 'history': title = L('היסטוריה', 'Historik'); html = viewHistory(); break;
    case 'progress': title = L('התקדמות', 'Framsteg'); html = viewProgress(); break;
    case 'body':
      title = ui.mdraft ? (ui.mdraft.isNew ? L('מדידה חדשה', 'Ny mätning') : L('עריכת מדידה', 'Redigera mätning')) : L('מדדי גוף', 'Kropp');
      html = viewMetrics();
      break;
    // Templates live inside the workout tab: the editor opens over the start screen or the active workout and returns to it.
    default:
      if (ui.cdraft) { title = L('אירובי', 'Kondition'); html = viewCardioForm(); }
      else if (ui.draft) { title = ui.draft.isNew ? L('תבנית חדשה', 'Ny mall') : L('עריכת תבנית', 'Ändra mall'); html = viewEditor(); }
      else { title = db.active ? L('אימון פעיל', 'Aktivt pass') : L('אימון', 'Träning'); html = db.active ? viewActive() : viewStart(); }
  }
  $('#title').textContent = title;
  $('#view').innerHTML = html;
  openRow = null;
  if (kp.el) kpReattach();
  tick();
}

// ---------- Set keypad ----------
// Weight and reps open a small in-app keypad instead of the phone keyboard. While it's up the page doesn't scroll;
// the first key replaces the value, "הבא" moves on to the next field, and a tap anywhere else closes it.
const kp = { el: null, fresh: false };
const kpBox = $('#keypad');

function kpOpen(input) {
  if (kp.el && kp.el !== input) kp.el.classList.remove('kp-on', 'kp-fresh');
  kp.el = input;
  kp.fresh = true;
  input.blur();
  input.classList.add('kp-on', 'kp-fresh');
  const ex = db.active?.exercises[+input.dataset.e];
  $('#kp-ex').textContent = ex ? exName(ex.name) : '';
  $('#kp-f').textContent = input.dataset.f === 'w' ? L('משקל (ק״ג)', 'Vikt (kg)') : L('חזרות', 'Reps');
  kpBox.querySelectorAll('[data-k="."], [data-k=".5"]').forEach((b) => { b.disabled = input.dataset.kp !== 'decimal'; });
  kpBox.classList.remove('hidden');
  document.documentElement.classList.add('kp-open');
  const h = kpBox.offsetHeight;
  document.documentElement.style.setProperty('--kp-h', `${h}px`);
  // Bring the field above the keypad (and below the top bar) before the page is locked.
  const r = input.getBoundingClientRect(), top = $('.topbar').getBoundingClientRect().bottom;
  const bottom = innerHeight - h - 12;
  if (r.bottom > bottom) window.scrollBy(0, r.bottom - bottom);
  else if (r.top < top + 8) window.scrollBy(0, r.top - top - 8);
}

function kpClose() {
  if (!kp.el) return;
  kp.el.classList.remove('kp-on', 'kp-fresh');
  kp.el = null;
  kpBox.classList.add('hidden');
  document.documentElement.classList.remove('kp-open');
}

// After a re-render the field is a new element: pick it up again, or close if it's gone.
function kpReattach() {
  const { f, e, s } = kp.el.dataset;
  const next = document.querySelector(`input[data-kp][data-f="${f}"][data-e="${e}"][data-s="${s}"]`);
  if (!next) { kpClose(); return; }
  kp.el = next;
  next.classList.add('kp-on');
  if (kp.fresh) next.classList.add('kp-fresh');
}

function kpKey(k) {
  const el = kp.el;
  if (!el) return;
  if (k === 'done') { kpClose(); return; }
  if (k === 'next') {
    const all = [...document.querySelectorAll('input[data-kp]')];
    const nxt = all[all.indexOf(el) + 1];
    if (nxt) kpOpen(nxt); else kpClose();
    return;
  }
  let v = kp.fresh ? '' : el.value;
  if (k === 'back') v = v.slice(0, -1);
  else if (k === '.') { if (el.dataset.kp !== 'decimal' || v.includes('.')) return; v = (v || '0') + '.'; }
  // Half a kilo in one tap: "12" → "12.5", "12." → "12.5".
  else if (k === '.5') { if (el.dataset.kp !== 'decimal' || /\.\d/.test(v)) return; v = (v.replace(/\.$/, '') || '0') + '.5'; }
  else if (v.replace('.', '').length >= 5) return;
  else v = v === '0' ? k : v + k;
  kp.fresh = false;
  el.classList.remove('kp-fresh');
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

kpBox.addEventListener('pointerdown', (ev) => ev.preventDefault()); // keep taps on the keypad from moving focus
kpBox.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-k]');
  if (b && !b.disabled) kpKey(b.dataset.k);
});
document.addEventListener('pointerdown', (ev) => {
  if (!kp.el) return;
  const t = ev.target;
  if (t.closest('#keypad') || t.matches('input[data-kp]') || t.closest('.stepper') === kp.el.parentElement) return;
  kpClose();
}, true);

// ---------- Note editor ----------
// A note is edited in place, on a strip of ruled paper inside its exercise's card, with the phone's own keyboard.
// Like the set keypad, the exercise is brought to the top and the page stays put until the note is saved:
// Save, Enter, the keyboard's done key or a tap anywhere else all save; Cancel drops the change.
const NOTE_MAX = 120;

function noteOpen(name, attrs) {
  kpClose();
  ui.noteEdit = { name, attrs, text: db.notes[name] || '' };
  render();
  const ta = $('#note-in');
  if (!ta) { ui.noteEdit = null; return; }
  // Pin the page where it is. The body itself is fixed in place, so neither a finger nor iOS bringing up its
  // keyboard can scroll it; any shift iOS makes anyway is undone (notePin). Only when the note sits low enough
  // for the keyboard to cover it is the exercise's card brought up under the top bar.
  const box = ta.closest('.card, .tex') || ta;
  const bar = $('.topbar').offsetHeight;
  noteBackY = window.scrollY;
  const edBottom = (ta.closest('.note-edit') || ta).getBoundingClientRect().bottom;
  noteLockY = edBottom <= window.innerHeight * 0.5 ? noteBackY
    : Math.max(0, box.getBoundingClientRect().top + window.scrollY - bar - 8);
  document.documentElement.style.setProperty('--tb-h', `${bar}px`);
  document.body.style.top = `-${noteLockY}px`;
  document.documentElement.classList.add('note-open');
  window.scrollTo(0, 0);
  // Focus inside the tap itself, or iOS won't bring up the keyboard.
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(ta.value.length, ta.value.length);
  const until = Date.now() + 900; // ride out the keyboard's slide-up
  (function hold() { notePin(); if (ui.noteEdit && Date.now() < until) requestAnimationFrame(hold); })();
}

let noteLockY = 0, noteBackY = 0, noteBackUntil = 0;
function notePin() {
  // Just after a note closes, keep the page where it was while iOS slides its keyboard away.
  if (!ui.noteEdit && Date.now() < noteBackUntil && Math.abs(window.scrollY - noteBackY) > 1) window.scrollTo(0, noteBackY);
  if (ui.noteEdit && (window.scrollY || visualViewport?.offsetTop)) window.scrollTo(0, 0);
}
window.addEventListener('scroll', notePin);
visualViewport?.addEventListener('scroll', notePin);
visualViewport?.addEventListener('resize', notePin);

function noteClose(keep) {
  const n = ui.noteEdit;
  if (!n) return;
  ui.noteEdit = null;
  if (keep) {
    const t = n.text.trim().replace(/\s+/g, ' ');
    if (t) db.notes[n.name] = t; else delete db.notes[n.name];
    save();
  }
  document.documentElement.classList.remove('note-open');
  document.body.style.top = '';
  document.activeElement?.blur();
  render();
  // Back to exactly where the page was before the note was opened.
  window.scrollTo(0, noteBackY);
  noteBackUntil = Date.now() + 800;
  (function hold() { notePin(); if (!ui.noteEdit && Date.now() < noteBackUntil) requestAnimationFrame(hold); })();
}
// A finger on the page ends that hold at once, so it never fights a real scroll.
document.addEventListener('touchmove', () => { noteBackUntil = 0; }, { capture: true, passive: true });

let noteSwallow = 0, noteBtnDown = false;
document.addEventListener('pointerdown', (ev) => {
  if (!ui.noteEdit) return;
  // Pressing Save/Cancel blurs the field first; don't let that blur save before Cancel gets its say.
  if (ev.target.closest('.note-btns')) { noteBtnDown = true; return; }
  if (ev.target.closest('.note-edit')) return;
  // A tap elsewhere only saves the note; it doesn't also press whatever was under the finger.
  noteSwallow = Date.now();
  noteClose(true);
}, true);
document.addEventListener('click', (ev) => {
  noteBtnDown = false;
  if (Date.now() - noteSwallow > 700) return;
  noteSwallow = 0;
  ev.preventDefault();
  ev.stopPropagation();
}, true);
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'note-in' || !ui.noteEdit) return;
  ui.noteEdit.text = ev.target.value;
  $('#note-count').textContent = `${ev.target.value.length}/${NOTE_MAX}`;
});
document.addEventListener('keydown', (ev) => {
  if (ev.target.id !== 'note-in') return;
  if (ev.key === 'Enter') { ev.preventDefault(); noteClose(true); }
  if (ev.key === 'Escape') { ev.preventDefault(); noteClose(false); }
}, true);
// The keyboard's own done key just blurs the field: save then too.
document.addEventListener('focusout', (ev) => {
  if (ev.target.id === 'note-in' && ui.noteEdit && !noteBtnDown) setTimeout(() => { if (ui.noteEdit && document.activeElement?.id !== 'note-in') noteClose(true); }, 0);
});

// ---------- Events ----------
const tabScroll = {};
const UNDO = { label: L('בטל', 'Ångra') };
document.addEventListener('click', (ev) => {
  unlockAudio();
  const tabBtn = ev.target.closest('[data-tab]');
  if (tabBtn) {
    const t = tabBtn.dataset.tab;
    // The gear toggles: a second tap returns to the tab you came from.
    // Each tab keeps its place on the page, so a look at History mid-workout comes back to the same exercise.
    // Tapping the tab you're already on goes to its top.
    const from = ui.tab;
    tabScroll[from] = window.scrollY;
    if (t === 'settings' && ui.tab === 'settings') ui.tab = ui.prevTab || 'workout';
    else { if (t === 'settings') ui.prevTab = ui.tab; ui.tab = t; }
    render();
    window.scrollTo(0, ui.tab === from ? 0 : tabScroll[ui.tab] || 0);
    return;
  }
  if (ev.target.matches('input[data-kp]')) { kpOpen(ev.target); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const e = +el.dataset.e, s = +el.dataset.s, i = +el.dataset.i;
  const ex = db.active && db.active.exercises[e];

  switch (act) {
    case 'start': startWorkout(db.templates.find((t) => t.id === el.dataset.id), el.classList.contains('next')); break;
    case 'start-empty': startWorkout(null); break;
    case 'finish': finishWorkout(); break;
    case 'note': {
      const name = el.dataset.e != null ? ex?.name : ui.draft?.exercises[i]?.name.trim();
      if (name) noteOpen(name, el.dataset.e != null ? `data-e="${e}"` : `data-i="${i}"`);
      break;
    }
    case 'note-save': noteClose(true); break;
    case 'note-cancel': noteClose(false); break;
    case 'discard': discardWorkout(); break;

    case 'set-done': {
      const set = ex.sets[s];
      if (!set.done) {
        // Empty weight: use last time's value, or carry over the previous set's weight.
        if (set.w === '') set.w = set.pw || (s > 0 && !ex.sets[s - 1].wu ? ex.sets[s - 1].w : '');
        if (set.r === '') set.r = set.pr;
        if (num(set.r) == null) { toast(L('הזן מספר חזרות', 'Ange antal reps')); return; }
        set.done = true;
        // A weight other than the suggested one carries to the sets after it that still show that suggestion.
        const old = set.pw, now = num(set.w) != null ? fmtW(num(set.w)) : '';
        if (!set.wu && now && now !== old) {
          for (const x of ex.sets.slice(s + 1)) if (!x.wu && !x.done && x.w === '' && x.pw === old) x.pw = now;
        }
        if (!backdated(db.active)) {
          // Final set of the exercise: rest before the next exercise instead of between sets (none after the workout's last set).
          const exDone = ex.sets.every((x) => x.done);
          const allDone = db.active.exercises.every((x) => x.sets.every((y) => y.done));
          const exRest = num(db.settings.exRest) ?? DEFAULT_SETTINGS.exRest;
          if (!exDone) startTimer(ex.rest);
          else if (!allDone && exRest > 0) startTimer(exRest, { label: L('מנוחה בין תרגילים', 'Vila mellan övningar') });
        }
      } else {
        set.done = false;
      }
      save(); render();
      break;
    }
    case 'fail': {
      const set = ex.sets[s];
      set.fail = !set.fail;
      delete set.af; // chosen by hand from here on
      save(); render();
      if (set.fail) {
        toast(L('הסט סומן כ"עד כשל" – הזן כמה חזרות עשית', 'Setet är markerat "till failure" – ange hur många reps du gjorde'), 2000);
        const rIn = document.querySelector(`input[data-f="r"][data-e="${e}"][data-s="${s}"]`);
        if (set.r === '' && rIn) kpOpen(rIn);
      }
      break;
    }
    case 'step': {
      // Weight moves by 2.5 kg, reps by 1; an empty field starts from its placeholder.
      const set = ex.sets[s], f = el.dataset.f;
      const step = f === 'w' ? WEIGHT_STEP : 1;
      const cur = num(set[f]) ?? num(f === 'w' ? set.pw : set.pr) ?? 0;
      set[f] = fmtW(Math.max(0, cur + step * +el.dataset.d));
      el.parentElement.querySelector('input').value = set[f];
      kp.fresh = false; kp.el?.classList.remove('kp-fresh');
      save();
      break;
    }
    case 'set-add': {
      const last = ex.sets[ex.sets.length - 1];
      // An automatic "to failure" mark moves on to the new last set.
      const move = last && !last.wu && last.af && !last.done;
      if (move) { delete last.fail; delete last.af; }
      ex.sets.push({ w: '', r: '', pw: last ? (last.w || last.pw) : '', pr: last ? (last.r || last.pr) : '', done: false, ...(move ? { fail: true, af: true } : {}) });
      save(); render();
      break;
    }
    case 'set-del': {
      // The swipe and this tap are the confirmation; a slip is taken back with "undo" in the toast.
      const gone = ex.sets[s], w = db.active;
      ex.sets.splice(s, 1);
      const lw = work(ex.sets).at(-1);
      const moved = gone.af && lw && !lw.done && !lw.fail;
      if (moved) Object.assign(lw, { fail: true, af: true });
      save(); render();
      toast(gone.wu ? L('סט החימום נמחק', 'Uppvärmningssetet togs bort') : L('הסט נמחק', 'Setet togs bort'), 5000, { ...UNDO, run: () => {
        if (db.active !== w || !w.exercises.includes(ex)) return;
        if (moved) { delete lw.fail; delete lw.af; }
        ex.sets.splice(Math.min(s, ex.sets.length), 0, gone);
        save(); render();
      } });
      break;
    }
    case 'wu-add': {
      const first = ex.sets.find((x) => !x.wu);
      ex.sets.unshift(makeWarmup(ex.name, first && (num(first.w) ?? num(first.pw))));
      save(); render();
      break;
    }
    case 'ex-del': {
      const w = db.active;
      w.exercises.splice(e, 1); ui.swap = null; save(); render();
      toast(L(`"${ex.name}" הוסר מהאימון`, `"${exName(ex.name)}" togs bort från passet`), 5000, { ...UNDO, run: () => {
        if (db.active !== w) return;
        w.exercises.splice(Math.min(e, w.exercises.length), 0, ex);
        save(); render();
      } });
      break;
    }
    case 'swap-open': ui.swap = ui.swap === e ? null : e; render(); break;
    case 'ex-up':
    case 'ex-down': {
      const arr = db.active.exercises, j = act === 'ex-up' ? e - 1 : e + 1;
      if (j < 0 || j >= arr.length) return;
      [arr[e], arr[j]] = [arr[j], arr[e]];
      if (ui.swap === e || ui.swap === j) ui.swap = ui.swap === e ? j : e;
      save(); render();
      break;
    }
    case 'unswap': unswapExercise(e); break;
    case 'swap-pick':swapExercise(e, el.dataset.n); break;
    case 'swap-custom': swapExercise(e, $('#swap-name').value); break;
    case 'ex-rest':
      ask({ title: L('זמן מנוחה', 'Vilotid'), msg: L(`בשניות, ל"${ex.name}"`, `I sekunder, för "${exName(ex.name)}"`), ok: L('שמור', 'Spara'), input: { type: 'number', value: ex.rest } }).then((t) => {
        const v = num(t);
        if (v && v > 0) { ex.rest = Math.round(v); save(); render(); }
      });
      break;
    case 'ex-add': {
      const name = $('#new-ex').value.trim();
      if (!name) return;
      // Goes right after the last exercise of its body area, so it joins that area's group.
      const list = db.active.exercises, area = groupOf(name);
      const at = list.map((x) => groupOf(x.name)).lastIndexOf(area);
      list.splice(at < 0 ? list.length : at + 1, 0, makeExercise({ name }, list.length === 0));
      save(); render();
      break;
    }

    case 'stretch-go': {
      const phase = el.dataset.ph, x = findStretch(phase, el.dataset.id);
      const label = `${L('מתיחה', 'Stretch')}: ${x.name}`, end = { stretch: x.id, phase };
      startTimer(x.hold, x.sides
        ? { label: `${label} · ${L('צד', 'sida')} 1`, next: { label: `${label} · ${L('צד', 'sida')} 2`, ...end } }
        : { label, ...end });
      break;
    }
    case 'stretch-done': {
      const phase = el.dataset.ph, id = el.dataset.id;
      markStretch(db.active, phase, id, !stretchState(db.active)[phase].includes(id));
      save(); render();
      break;
    }
    case 'stretch-fold': {
      const phase = el.dataset.ph;
      stretchState(db.active);
      db.active.fold[phase] = !db.active.fold[phase];
      // Skipping or reopening a section by hand is remembered for the next workout.
      db.settings.stretchFold = { ...db.settings.stretchFold, [phase]: db.active.fold[phase] };
      save(); render();
      break;
    }

    case 'timer-add': if (timer) { timer.end = Math.max(timer.end, Date.now()) + 15000; timer.total += 15; timer.beeped = false; saveTimer(); tick(); } break;
    case 'timer-sub': if (timer) { timer.end -= 15000; saveTimer(); tick(); } break;
    case 'timer-stop': stopTimer(); break;

    case 'tpl-new': ui.draft = { id: uid(), name: '', exercises: [{ id: uid(), name: '', sets: 2, reps: 8, rest: db.settings.defaultRest }], isNew: true }; render(); window.scrollTo(0, 0); break;
    case 'tpl-edit': {
      const t = structuredClone(db.templates.find((x) => x.id === el.dataset.id));
      t.exercises.forEach((x) => { x.group = db.muscles[x.name]; }); // only hand-picked areas; others stay auto-guessed
      ui.draft = { ...t, isNew: false };
      render(); window.scrollTo(0, 0);
      break;
    }
    case 'tpl-cancel': ui.draft = null; render(); window.scrollTo(0, 0); break;
    // Deleting takes two taps: the button opens an in-page confirmation, so a stray tap can't remove a template.
    case 'tpl-del': ui.draft.confirmDel = true; render(); break;
    case 'tpl-del-no': ui.draft.confirmDel = false; render(); break;
    case 'tpl-del-yes': db.templates = db.templates.filter((t) => t.id !== ui.draft.id); ui.draft = null; save(); render(); break;
    case 'tpl-save': {
      const d = ui.draft;
      if (!d.name.trim()) { toast(L('תן שם לתבנית', 'Ge mallen ett namn')); return; }
      const tpl = {
        id: d.id,
        name: d.name.trim(),
        exercises: d.exercises.filter((x) => x.name.trim()).map((x) => ({
          id: x.id, name: x.name.trim(), sets: num(x.sets) || 3, reps: num(x.reps) || 10, rest: num(x.rest) || db.settings.defaultRest,
          ...(num(x.w) ? { w: num(x.w) } : {}),
        })),
      };
      for (const x of d.exercises) {
        const name = x.name.trim();
        if (!name || !x.group) continue;
        if (x.group === guessGroup(name)) delete db.muscles[name]; else db.muscles[name] = x.group;
      }
      const idx = db.templates.findIndex((t) => t.id === d.id);
      if (idx >= 0) db.templates[idx] = tpl; else db.templates.push(tpl);
      ui.draft = null; save(); render(); window.scrollTo(0, 0);
      toast(L('התבנית נשמרה', 'Mallen sparad'));
      break;
    }
    case 'tex-add': ui.draft.exercises.push({ id: uid(), name: '', sets: 2, reps: 8, rest: db.settings.defaultRest }); render(); break;
    case 'tex-del': {
      const n = ui.draft.exercises[i].name.trim();
      ask({ title: L('להסיר מהתבנית?', 'Ta bort från mallen?'), msg: n ? L(`"${n}" יוסר מהתבנית.`, `"${n}" tas bort från mallen.`) : '', ok: L('הסר', 'Ta bort'), danger: true })
        .then((yes) => { if (yes) { ui.draft.exercises.splice(i, 1); render(); } });
      break;
    }
    case 'tex-up':
    case 'tex-down': {
      const j = act === 'tex-up' ? i - 1 : i + 1;
      const arr = ui.draft.exercises;
      if (j < 0 || j >= arr.length) return;
      if (draftGroup(arr[i]) === draftGroup(arr[j])) [arr[i], arr[j]] = [arr[j], arr[i]];
      else {
        // At the edge of its area: swap the whole area with the neighboring one.
        const runs = areaRuns(arr, draftGroup);
        const r = runs.findIndex(([a]) => a === draftGroup(arr[i]));
        const o = act === 'tex-up' ? r - 1 : r + 1;
        [runs[r], runs[o]] = [runs[o], runs[r]];
        ui.draft.exercises = runs.flatMap(([, idx]) => idx.map((x) => arr[x]));
      }
      render();
      break;
    }

    case 'hist-del':
      ask({ title: L('למחוק את האימון?', 'Ta bort passet?'), msg: L('הוא יימחק מההיסטוריה, יחד עם תמונות המעקב שלו.', 'Det tas bort från historiken, tillsammans med dess progressbilder.'), ok: L('מחק', 'Ta bort'), danger: true }).then((yes) => {
        if (!yes) return;
        // Everything shown under this card, including photos left over from a workout deleted earlier.
        const w = db.workouts.find((x) => x.id === el.dataset.id);
        const gone = w ? photosOf(w, sortedWorkouts()).map((p) => p.id) : [];
        db.workouts = db.workouts.filter((w) => w.id !== el.dataset.id); save(); render();
        if (gone.length) deletePhoto(...gone);
      });
      break;
    // Fix a mistyped weight or rep count in a saved workout, in place of its set chips.
    case 'hist-edit': {
      const w = db.workouts.find((x) => x.id === el.dataset.id);
      ui.hedit = { id: w.id, ex: w.exercises.map((x) => x.sets.map((s) => ({ w: fmtW(s.w), r: String(s.r) }))) };
      render();
      break;
    }
    case 'hist-edit-cancel': ui.hedit = null; render(); break;
    case 'hist-edit-save': {
      const w = db.workouts.find((x) => x.id === ui.hedit.id);
      if (ui.hedit.ex.some((sets) => sets.some((s) => !(num(s.r) > 0) || num(s.w) < 0))) { toast(L('בכל סט צריך מספר חזרות', 'Varje set behöver ett antal reps')); return; }
      w.exercises.forEach((x, i) => x.sets.forEach((s, j) => { s.w = num(ui.hedit.ex[i][j].w) || 0; s.r = num(ui.hedit.ex[i][j].r); }));
      ui.hedit = null;
      save(); render();
      toast(L('האימון עודכן', 'Passet uppdaterat'));
      break;
    }
    case 'photo-add': openCamera(el.dataset.id); break;
    case 'photo-open': ui.photo = el.dataset.id; ui.photoZoom = false; render(); break;
    case 'photo-close': ui.photo = null; render(); break;
    case 'photo-zoom': {
      ui.photoZoom = !ui.photoZoom; render();
      // Zoomed in on the middle of the photo.
      const st = $('.photo-stage.zoom');
      if (st) { st.scrollLeft = (st.scrollWidth - st.clientWidth) / 2; st.scrollTop = (st.scrollHeight - st.clientHeight) / 2; }
      break;
    }
    case 'photo-nav': photoNav(+el.dataset.d); break;
    case 'stretch-view': ui.stretchView = { ph: el.dataset.ph, id: el.dataset.id }; render(); break;
    case 'stretch-view-close': ui.stretchView = null; render(); break;
    case 'photo-del': ask({ title: L('למחוק את התמונה?', 'Ta bort bilden?'), ok: L('מחק', 'Ta bort'), danger: true }).then((yes) => yes && deletePhoto(el.dataset.id)); break;
    case 'hist-tpl': {
      const w = db.workouts.find((x) => x.id === el.dataset.id);
      ask({ title: L('תבנית חדשה', 'Ny mall'), msg: L('איך לקרוא לה?', 'Vad ska den heta?'), ok: L('שמור תבנית', 'Spara mall'), input: { value: w.name } }).then((name) => {
        if (!name) return;
        db.templates.push({
          id: uid(), name,
          exercises: w.exercises.filter((x) => work(x.sets).length).map((x) => ({
            id: uid(), name: x.name, sets: work(x.sets).length, reps: work(x.sets)[0].r, rest: db.settings.defaultRest,
          })),
        });
        save(); toast(L('נשמרה תבנית חדשה', 'Ny mall sparad'));
      });
      break;
    }

    case 'metric': ui.progMetric = el.dataset.k; render(); break;
    // A touch screen has no hover: tapping a point writes its date and value under the chart.
    case 'chart-pt': {
      const box = el.closest('.card') || $('#view');
      box.querySelectorAll('.pt.on').forEach((p) => p.classList.remove('on'));
      const dot = [...el.closest('svg').querySelectorAll('.pt')][[...el.closest('svg').querySelectorAll('.pt-hit')].indexOf(el)];
      dot?.classList.add('on');
      const out = el.closest('svg').nextElementSibling;
      if (out?.classList.contains('chart-val')) { out.textContent = el.dataset.l; out.classList.remove('muted'); }
      break;
    }
    case 'music-app': db.settings.musicApp = el.dataset.k; save(); render(); break;
    case 'music-hide': db.settings.showMusic = false; save(); render(); toast(L('אפשר להחזיר בהגדרות', 'Kan visas igen i inställningarna')); break;
    case 'area-period': ui.areaPeriod = el.dataset.k; render(); break;

    case 'body-metric': ui.bodyMetric = el.dataset.k; render(); break;
    case 'recs-open': ui.recsOpen = true; render(); break;
    case 'recs-close': ui.recsOpen = false; render(); break;
    case 'rec-sex': db.settings.sex = el.dataset.k; save(); render(); break;
    case 'rec-ai':
      if (getApiKey()) fetchAiRecs();
      else copyText(recPrompt()).then((ok) => toast(ok ? L('הבקשה הועתקה עם הנתונים שלך. הדבק אותה בצ׳אט עם Claude', 'Förfrågan kopierades med din data. Klistra in den i en chatt med Claude') : L('ההעתקה נכשלה', 'Kopieringen misslyckades'), 3500));
      break;
    case 'm-upload':
      if (!getApiKey()) { toast(L('כדי לקרוא תמונות צריך להזין מפתח Claude API בהגדרות', 'För att läsa bilder behöver du ange en Claude API-nyckel i inställningarna'), 3500); ui.tab = 'settings'; render(); window.scrollTo(0, 0); $('[data-f="apikey"]')?.focus(); return; }
      $('#m-file').click();
      break;
    case 'paste-open': ui.pasteOpen = true; render(); break;
    case 'paste-close': ui.pasteOpen = false; ui.pasteText = ''; render(); break;
    case 'paste-copy':
      copyText(CHAT_PROMPT).then((ok) => toast(ok ? L('ההוראה הועתקה. עכשיו פתח את Claude', 'Instruktionen kopierad. Öppna nu Claude') : L('ההעתקה נכשלה', 'Kopieringen misslyckades')));
      break;
    case 'paste-read':
      if (!navigator.clipboard?.readText) { $('#paste-text').focus(); return; }
      navigator.clipboard.readText()
        .then((t) => { ui.pasteText = t; render(); importPasted(); })
        .catch(() => { toast(L('אין גישה ללוח, הדבק ידנית בתיבה', 'Ingen åtkomst till urklipp, klistra in i rutan')); $('#paste-text')?.focus(); });
      break;
    case 'paste-parse': importPasted(); break;
    case 'm-manual': ui.mdraft = newMetricDraft(); render(); window.scrollTo(0, 0); break;
    case 'm-edit': {
      const m = db.metrics.find((x) => x.id === el.dataset.id);
      ui.mdraft = { ...newMetricDraft(m, isoDay(m.t)), id: m.id, isNew: false };
      render(); window.scrollTo(0, 0);
      break;
    }
    case 'm-save': saveMetric(); break;
    case 'm-cancel': ui.mdraft = null; render(); break;
    case 'm-del':
      ask({ title: L('למחוק את המדידה?', 'Ta bort mätningen?'), ok: L('מחק', 'Ta bort'), danger: true })
        .then((yes) => { if (yes) { db.metrics = db.metrics.filter((m) => m.id !== ui.mdraft.id); ui.mdraft = null; save(); render(); } });
      break;
    case 'demo': openDemo(el.dataset.e != null ? ex.name : ui.draft.exercises[i].name); break;
    case 'demo-close': ui.demo = null; renderSheet(); break;
    case 'clock': clockMenu(); break;
    case 'bateman': openBateman(); break;
    case 'bateman-close': closeBateman(); break;
    case 'bateman-pick': pickBateman(el.dataset.id); break;
    case 'demo-search': runDemoSearch(); break;
    case 'demo-variant': runDemoSearch(+el.dataset.k); break;
    case 'demo-change': ui.demo.picking = true; renderSheet(); if (!ui.demo.results) runDemoSearch(); break;
    case 'demo-back': ui.demo.picking = false; renderSheet(); break;
    case 'demo-pick': {
      const x = ui.demo.results.find((r) => r.id === el.dataset.id);
      db.demos[ui.demo.name] = { id: x.id, name: x.name, images: x.images.slice(0, 2), instructions: x.instructions || [], pm: x.primaryMuscles || [], sm: x.secondaryMuscles || [] };
      ui.demo.picking = false;
      save(); render(); renderSheet();
      break;
    }
    case 'demo-clear':
      ask({ title: L('להסיר את ההדגמה?', 'Ta bort demon?'), msg: L(`ההדגמה של "${ui.demo.name}" תוסר.`, `Demon för "${exName(ui.demo.name)}" tas bort.`), ok: L('הסר', 'Ta bort'), danger: true }).then((yes) => {
        if (!yes) return;
        delete db.demos[ui.demo.name];
        ui.demo = null;
        save(); render(); renderSheet();
      });
      break;
    case 'day-rest': toggleRest(el.dataset.d); break;
    case 'c-new': ui.cdraft = { type: db.settings.lastCardio || 'run', mins: '', dist: '', kcal: '', bw: '', date: isoDay(Date.now()) }; render(); window.scrollTo(0, 0); break;
    case 'c-type': ui.cdraft.type = db.settings.lastCardio = el.dataset.k; ui.cdraft.dist = ''; render(); break;
    case 'c-cancel': ui.cdraft = null; render(); window.scrollTo(0, 0); break;
    case 'c-save': saveCardio(); break;
    case 'c-del': {
      const c = db.cardio.find((x) => x.id === el.dataset.id);
      if (!c) break;
      db.cardio = db.cardio.filter((x) => x !== c); save(); render();
      toast(L('האימון האירובי נמחק', 'Konditionspasset togs bort'), 5000, { ...UNDO, run: () => { db.cardio.push(c); save(); render(); } });
      break;
    }
    case 'lang':
      if (el.dataset.k !== LANG) {
        try { localStorage.setItem(LANG_KEY, el.dataset.k); } catch { /* ignore */ }
        location.reload();
      }
      break;
    case 'export': exportData(); break;
    case 'backup-later': db.settings.backupLater = Date.now(); save(); render(); break;
    case 'import': $('#import-file').click(); break;
  }
});

// No page zoom: this is an app, not a web page. iOS Safari ignores user-scalable=no,
// so also swallow its pinch gestures, two-finger moves and ctrl+wheel/trackpad pinch.
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(t, (ev) => ev.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (ev) => {
  // The page also stays put while the set keypad is up or a note is being written.
  if (ev.touches.length > 1 || kp.el || (ui.noteEdit && ev.target.id !== 'note-in')) ev.preventDefault();
}, { passive: false });
document.addEventListener('wheel', (ev) => {
  if (ev.ctrlKey || kp.el) ev.preventDefault();
}, { passive: false });

// iOS shake-to-undo: a phone dropped on the gym floor counts as a shake and wipes what was typed.
// Block the undo/redo itself, and clear a field's undo history once it's left so there's nothing to offer.
document.addEventListener('beforeinput', (ev) => {
  if (ev.inputType === 'historyUndo' || ev.inputType === 'historyRedo') ev.preventDefault();
}, true);
document.addEventListener('focusout', (ev) => {
  const el = ev.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (['checkbox', 'radio', 'file', 'range', 'button', 'submit'].includes(el.type)) return;
  const v = el.value;
  el.value = v + ' ';
  el.value = v;
}, true);

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const f = el.dataset.f;
  if (!f) return;
  const i = +el.dataset.i;
  switch (f) {
    case 'w':
    case 'r': {
      const set = db.active.exercises[+el.dataset.e].sets[+el.dataset.s];
      set[f] = el.value;
      save();
      break;
    }
    case 'he': ui.hedit.ex[+el.dataset.x][+el.dataset.s][el.dataset.k] = el.value; break;
    case 'wname': db.active.name = el.value; save(); break;
    case 'wmins': db.active.mins = el.value; save(); break;
    case 'defrest': { const v = num(el.value); if (v && v > 0) { db.settings.defaultRest = Math.round(v); save(); } break; }
    case 'exrest': { const v = num(el.value); if (v != null && v >= 0) { db.settings.exRest = Math.round(v); save(); } break; }
    case 'tname': ui.draft.name = el.value; break;
    case 'tex-name': ui.draft.exercises[i].name = el.value; break;
    case 'tex-sets': ui.draft.exercises[i].sets = el.value; break;
    case 'tex-reps': ui.draft.exercises[i].reps = el.value; break;
    case 'tex-rest': ui.draft.exercises[i].rest = el.value; break;
    case 'tex-w': ui.draft.exercises[i].w = el.value; break;
    case 'tex-group': ui.draft.exercises[i].group = el.value; break;
    case 'm-date': ui.mdraft.date = el.value; break;
    case 'm-val': ui.mdraft.vals[el.dataset.k] = el.value; break;
    case 'apikey': setApiKey(el.value.trim()); break;
    case 'paste-text': ui.pasteText = el.value; break;
    case 'demo-q': ui.demo.q = el.value; break;
    case 'wgoal': { const v = num(el.value); if (v != null && v >= 0 && v <= 7) { db.settings.weeklyGoal = Math.round(v); save(); } break; }
    // Update the calorie and pace preview in place, so the field keeps focus while typing.
    case 'c-mins': case 'c-dist': case 'c-kcal': case 'c-bw':
      ui.cdraft[f.slice(2)] = el.value;
      $('#c-sum').innerHTML = cardioSummary(ui.cdraft);
      break;
    case 'c-date': ui.cdraft.date = el.value; break;
  }
});

// Remember which history cards are open so a re-render (a new photo, a date change) keeps them open.
document.addEventListener('toggle', (ev) => {
  const d = ev.target;
  if (!d.matches || !d.matches('details.hist[data-id]')) return;
  if (d.open) ui.histOpen.add(d.dataset.id); else ui.histOpen.delete(d.dataset.id);
}, true);

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.f === 'prog-ex') { ui.progEx = el.value; render(); }
  if (el.dataset.f === 'tex-group') render(); // regroup under the new area
  if (el.dataset.f === 'wdate' && dayTs(el.value)) {
    db.active.date = el.value;
    if (backdated(db.active)) stopTimer();
    save(); render();
  }
  if (el.dataset.f === 'hist-date' && dayTs(el.value)) {
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    const t = new Date(w.start), d = new Date(dayTs(el.value));
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes()).getTime();
    w.end = start + (w.end - w.start);
    w.start = start;
    save(); render(); toast(L('התאריך עודכן', 'Datumet uppdaterat'));
  }
  if (el.dataset.f === 'set-lastfail') { db.settings.lastSetFail = el.checked; save(); }
  if (el.dataset.f === 'set-music') { db.settings.showMusic = el.checked; save(); }
  if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
  if (el.id === 'm-file' && el.files[0]) { handleReportFile(el.files[0]); el.value = ''; }
  if (el.id === 'photo-file' && el.files.length) { addPhotos([...el.files], ui.photoFor); el.value = ''; }
  if (el.dataset.f === 'm-hist') ui.mdraft.history[+el.dataset.i].add = el.checked;
  if (el.dataset.f === 'apikey') render(); // refresh the "saved" mark
});

document.addEventListener('keydown', (ev) => {
  if (kp.el) {
    const k = /^[0-9.]$/.test(ev.key) ? ev.key : { Backspace: 'back', Enter: 'next', Tab: 'next', Escape: 'done' }[ev.key];
    if (k) { ev.preventDefault(); kpKey(k); return; }
  }
  if (ev.key === 'Enter' && ev.target.id === 'new-ex') $('[data-act="ex-add"]').click();
  if (ev.key === 'Enter' && ev.target.id === 'swap-name') $('[data-act="swap-custom"]').click();
  if (ev.key === 'Enter' && ev.target.id === 'demo-q') { ev.target.blur(); runDemoSearch(); }
  if (ev.key === 'Escape' && ui.demo) { ui.demo = null; renderSheet(); }
  if (ev.key === 'Escape' && ui.stretchView) { ui.stretchView = null; render(); }
  if (ev.key === 'Escape' && ui.photo) { ui.photo = null; render(); }
  if (ev.key === 'Escape') closeBateman();
});

// ---------- Pull the demo sheet down to close it ----------
// Once the panel is scrolled to the top, dragging further down moves the whole sheet with the finger
// (iPhone style). Let go far enough or with a quick flick and it slides away; otherwise it springs back.
let sheetDrag = null;
const sheetEl = $('#sheet');
sheetEl.addEventListener('touchstart', (ev) => {
  const panel = ev.target.closest('.sheet-panel');
  if (!panel || ev.touches.length > 1) { sheetDrag = null; return; }
  const y = ev.touches[0].clientY;
  sheetDrag = { panel, y, t: ev.timeStamp, origin: null, dy: 0, v: 0 };
}, { passive: true });

sheetEl.addEventListener('touchmove', (ev) => {
  const d = sheetDrag;
  if (!d) return;
  const y = ev.touches[0].clientY;
  if (d.origin == null) {
    // Start pulling the moment a downward move happens with nothing left to scroll up to.
    if (y > d.y && d.panel.scrollTop <= 0) { d.origin = y; d.panel.style.transition = sheetEl.style.transition = 'none'; }
  } else {
    d.dy = Math.max(0, y - d.origin);
    if (d.dy === 0 && y < d.y) { d.origin = null; d.panel.style.transform = ''; return; } // back to scrolling
    ev.preventDefault();
    d.panel.style.transform = `translateY(${d.dy}px)`;
    sheetEl.style.backgroundColor = `rgba(15, 20, 28, ${0.45 * Math.max(0, 1 - d.dy / d.panel.offsetHeight)})`;
  }
  const dt = ev.timeStamp - d.t;
  if (dt > 0) d.v = (y - d.y) / dt;
  d.y = y; d.t = ev.timeStamp;
}, { passive: false });

function endSheetDrag() {
  const d = sheetDrag;
  sheetDrag = null;
  if (!d || d.origin == null) return;
  const { panel } = d;
  const ease = 'transform .28s cubic-bezier(.2, .8, .2, 1), background-color .28s';
  panel.style.transition = sheetEl.style.transition = ease;
  if (d.dy > Math.min(140, panel.offsetHeight * 0.3) || (d.v > 0.5 && d.dy > 24)) {
    panel.style.transform = 'translateY(100%)';
    sheetEl.style.backgroundColor = 'rgba(15, 20, 28, 0)';
    setTimeout(() => {
      sheetEl.style.transition = sheetEl.style.backgroundColor = '';
      if (ui.demo) { ui.demo = null; renderSheet(); }
    }, 280);
  } else {
    panel.style.transform = '';
    sheetEl.style.backgroundColor = '';
  }
}
sheetEl.addEventListener('touchend', endSheetDrag);
sheetEl.addEventListener('touchcancel', endSheetDrag);

// ---------- Swipe to delete a set ----------
// Drag a set row sideways (either direction). Past the threshold it stays open over a delete button;
// deleting takes that second tap, so a stray touch can't remove a set.
const SWIPE_OPEN = 76;
let swipe = null, openRow = null, swallowClick = false;

function closeOpenRow() {
  if (openRow) { openRow.style.transform = ''; openRow = null; }
}

document.addEventListener('pointerdown', (ev) => {
  const g = ev.target.closest('.swipe');
  if (openRow && g !== openRow && !ev.target.closest('.set-actions')) closeOpenRow();
  if (!g || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
  swipe = { g, id: ev.pointerId, x: ev.clientX, y: ev.clientY, base: g === openRow ? +g.dataset.off : 0, off: 0, active: false, btn: !!ev.target.closest('button') };
});

document.addEventListener('pointermove', (ev) => {
  if (!swipe || ev.pointerId !== swipe.id) return;
  const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
  if (!swipe.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; } // vertical scroll
    // A press that starts on a button needs a longer, clearly sideways move, so a thumb sliding a little while
    // tapping ✓ or +/− still counts as a tap.
    if (Math.abs(dx) < (swipe.btn ? 22 : 10) || (swipe.btn && Math.abs(dx) < Math.abs(dy) * 2)) return;
    swipe.active = true;
    swipe.g.classList.add('dragging');
  }
  swipe.off = Math.max(-120, Math.min(120, swipe.base + dx));
  swipe.g.style.transform = `translateX(${swipe.off}px)`;
});

document.addEventListener('pointerup', () => {
  if (!swipe) return;
  const { g, active, off } = swipe;
  swipe = null;
  if (!active) return;
  g.classList.remove('dragging');
  swallowClick = true; // the gesture shouldn't also count as a tap on whatever was under the finger
  setTimeout(() => { swallowClick = false; }, 0);
  if (Math.abs(off) > 45) {
    if (openRow !== g) closeOpenRow();
    g.dataset.off = Math.sign(off) * SWIPE_OPEN;
    g.style.transform = `translateX(${g.dataset.off}px)`;
    openRow = g;
  } else {
    g.style.transform = '';
    if (openRow === g) openRow = null;
  }
});

document.addEventListener('pointercancel', () => {
  if (!swipe) return;
  swipe.g.classList.remove('dragging');
  swipe.g.style.transform = swipe.base ? `translateX(${swipe.base}px)` : '';
  swipe = null;
});

document.addEventListener('click', (ev) => {
  if (swallowClick) { ev.stopPropagation(); ev.preventDefault(); }
}, true);

// ---------- Photo viewer: previous / next ----------
function photoNav(d) {
  const p = photos[photos.findIndex((x) => x.id === ui.photo) + d];
  if (!p) return;
  ui.photo = p.id; ui.photoZoom = false; render();
}
// A sideways swipe on the photo (not while zoomed in, where a drag moves around it).
let photoSwipe = null;
document.addEventListener('touchstart', (ev) => {
  photoSwipe = ev.touches.length === 1 && ev.target.closest('.photo-stage:not(.zoom)') ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener('touchend', (ev) => {
  if (!photoSwipe) return;
  const t = ev.changedTouches[0], dx = t.clientX - photoSwipe.x, dy = t.clientY - photoSwipe.y;
  photoSwipe = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  swallowClick = true; setTimeout(() => { swallowClick = false; }, 50); // the swipe isn't also a tap to zoom
  photoNav(dx < 0 ? 1 : -1);
});

// ---------- Back button ----------
// Android's back button (and the back swipe) closes whatever is open on top instead of leaving the app.
// While anything is open there's one extra history entry; going back pops it and closes the top layer.
function topLayer() {
  const dlg = document.querySelector('.dlg:not(.out)');
  if (dlg) return () => dlg.querySelector('[data-k="no"]').click();
  const cam = document.querySelector('.cam');
  if (cam) return () => cam.querySelector('[data-k="close"]').click();
  if (!$('#bateman').classList.contains('hidden')) return closeBateman;
  if (ui.photo) return () => { ui.photo = null; render(); };
  if (ui.stretchView) return () => { ui.stretchView = null; render(); };
  if (ui.demo) return () => { ui.demo = null; renderSheet(); };
  if (kp.el) return kpClose;
  if (ui.noteEdit) return () => noteClose(false);
  if (ui.tab === 'history' && ui.hedit) return () => { ui.hedit = null; render(); };
  if (ui.tab === 'body' && ui.mdraft) return () => { ui.mdraft = null; render(); };
  if (ui.tab === 'workout' && ui.cdraft) return () => { ui.cdraft = null; render(); window.scrollTo(0, 0); };
  if (ui.tab === 'workout' && ui.draft) return () => { ui.draft = null; render(); window.scrollTo(0, 0); };
  if (ui.tab === 'settings') return () => { ui.tab = ui.prevTab || 'workout'; render(); window.scrollTo(0, 0); };
  return null;
}
let backEntry = !!history.state?.layer, backSkip = false;
function syncBack() {
  const open = !!topLayer();
  if (open && !backEntry) { history.pushState({ layer: 1 }, ''); backEntry = true; }
  else if (!open && backEntry && !backSkip) { backSkip = true; history.back(); }
}
window.addEventListener('popstate', () => {
  backEntry = false;
  if (backSkip) { backSkip = false; return; } // our own history.back() after everything was closed
  topLayer()?.();
  syncBack();
});
document.addEventListener('click', () => setTimeout(syncBack, 0));

const RESUME_KEY = 'gym-tracker-resume';

// ---------- Boot ----------
// Started here, once every file has loaded, so they never run against a half-loaded app.
setInterval(() => { tick(); syncBack(); }, 250);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { requestWakeLock(); tick(); } });
// index.html is written in Hebrew; in Swedish its fixed labels are swapped here.
if (SV) {
  const set = (sel, text, label) => {
    const el = $(sel);
    if (text != null) el.textContent = text;
    if (label != null) el.setAttribute('aria-label', label);
  };
  set('#top-elapsed', null, 'Passets klocka: pausa eller stoppa');
  set('.topbar .gear', null, 'Inställningar och säkerhetskopia');
  set('#timer [data-act="timer-add"]', null, '15 sekunder till');
  set('#timer [data-act="timer-sub"]', null, '15 sekunder mindre');
  set('#timer [data-act="timer-stop"]', null, 'Stoppa timern');
  set('#keypad', null, 'Sifferknappar');
  set('#keypad [data-k="back"]', null, 'Radera siffra');
  set('#keypad [data-k=".5"]', null, 'Ett halvt kilo');
  set('#keypad [data-k="next"]', 'Nästa');
  set('#keypad [data-k="done"]', 'Klar');
  const tabs = { workout: 'Träning', history: 'Historik', progress: 'Framsteg', body: 'Kropp' };
  document.querySelectorAll('.tabs button').forEach((b) => { b.querySelector('span').textContent = tabs[b.dataset.tab]; });
}
if (db.active) requestWakeLock();
// Back from a reload for a new version: the same tab and place on the page.
let resume = null;
try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY)); sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
if (resume && ['workout', 'history', 'progress', 'body', 'settings'].includes(resume.tab)) ui.tab = resume.tab;
render();
if (resume) window.scrollTo(0, resume.y || 0);
loadPhotos();
// Demos picked before muscles were stored get them from the exercise database.
if (Object.values(db.demos).some((d) => !d.pm)) {
  loadExercises().then((list) => {
    const byId = new Map(list.map((x) => [x.id, x]));
    for (const d of Object.values(db.demos)) {
      const x = byId.get(d.id);
      if (x && !d.pm) { d.pm = x.primaryMuscles || []; d.sm = x.secondaryMuscles || []; }
    }
    save();
    if (!document.activeElement?.matches('input, select, textarea')) render();
  }).catch(() => {});
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // An installed iPhone app is usually resumed, not relaunched, so check for a new version whenever it comes back
  // to the foreground, and reload once the new version takes over (all data lives in localStorage).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  // Not in the middle of something: a reload would drop a draft, a camera session or text being typed.
  // The reload waits until that's over, then comes back to the same tab and scroll position.
  const busy = () => ui.draft || ui.cdraft || ui.mdraft || ui.hedit || ui.demo || ui.noteEdit || ui.photo || ui.pasteOpen || ui.reading || ui.recLoading
    || kp.el || document.querySelector('.cam, .dlg') || document.activeElement?.matches('input, textarea, select');
  const reloadWhenIdle = () => {
    if (busy()) { setTimeout(reloadWhenIdle, 2000); return; }
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ tab: ui.tab, y: window.scrollY })); } catch { /* ignore */ }
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    reloadWhenIdle();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
