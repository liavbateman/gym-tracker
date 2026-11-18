'use strict';

// Exercise library: recommended exercises per body area and per part of it (upper chest, rear delts…),
// each with its demo and the muscles it works.
// Loaded as a plain <script> after demos.js; all the files share one global scope.

// Body areas in the strip at the top, and which side of the figure shows each one best.
const LIB_AREAS = [['חזה', 'front'], ['גב', 'back'], ['כתפיים', 'front'], ['יד קדמית', 'front'], ['יד אחורית', 'back'], ['בטן', 'front'], ['רגליים', 'front']];
// Per area: [part, figure side, exercises]. The part is a muscle or a "muscle:part" key (MUSCLE_NAMES names it).
// Each exercise: [the app's name, free-exercise-db id, equipment (EQUIP_KINDS key), primary muscles, secondary muscles],
// muscles comma-separated.
const LIBRARY = {
  'חזה': [
    ['chest:upper', 'front', [
      ['לחיצת חזה בשיפוע במשקולות', 'Incline_Dumbbell_Press', 'd', 'chest:upper', 'chest:mid,shoulders:front,triceps'],
      ['לחיצת חזה בשיפוע במוט', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'b', 'chest:upper', 'chest:mid,shoulders:front,triceps'],
      ['פרפר בשיפוע במשקולות', 'Incline_Dumbbell_Flyes', 'd', 'chest:upper', 'shoulders:front'],
      ['פרפר בשיפוע בכבל', 'Incline_Cable_Flye', 'c', 'chest:upper', 'shoulders:front']]],
    ['chest:mid', 'front', [
      ['לחיצת חזה במוט', 'Barbell_Bench_Press_-_Medium_Grip', 'b', 'chest:mid', 'chest:upper,chest:lower,shoulders:front,triceps'],
      ['לחיצת חזה במשקולות', 'Dumbbell_Bench_Press', 'd', 'chest:mid', 'chest:upper,chest:lower,shoulders:front,triceps'],
      ['לחיצת חזה במכונה', 'Machine_Bench_Press', 'm', 'chest:mid', 'chest:upper,chest:lower,shoulders:front,triceps'],
      ['פק דק', 'Butterfly', 'm', 'chest:mid', 'chest:upper,chest:lower,shoulders:front'],
      ['פרפר במשקולות', 'Dumbbell_Flyes', 'd', 'chest:mid', 'chest:upper,chest:lower,shoulders:front'],
      ['שכיבות סמיכה', 'Pushups', 'w', 'chest:mid', 'chest:upper,chest:lower,shoulders:front,triceps,abdominals']]],
    ['chest:lower', 'front', [
      ['מקבילים', 'Dips_-_Chest_Version', 'w', 'chest:lower', 'chest:mid,triceps,shoulders:front'],
      ['לחיצת חזה בירידה', 'Decline_Barbell_Bench_Press', 'b', 'chest:lower', 'chest:mid,triceps,shoulders:front'],
      ['לחיצת חזה בירידה במשקולות', 'Decline_Dumbbell_Bench_Press', 'd', 'chest:lower', 'chest:mid,triceps,shoulders:front'],
      ['פרפר בכבל', 'Cable_Crossover', 'c', 'chest:lower', 'chest:mid,shoulders:front']]],
  ],
  'גב': [
    ['lats', 'back', [
      ['מתח', 'Pullups', 'w', 'lats', 'middle back,biceps,shoulders:rear'],
      ['מתח באחיזה הפוכה', 'Chin-Up', 'w', 'lats,biceps', 'middle back'],
      ['פולי עליון', 'Wide-Grip_Lat_Pulldown', 'c', 'lats', 'middle back,biceps'],
      ['פולי עליון באחיזה צרה', 'Close-Grip_Front_Lat_Pulldown', 'c', 'lats', 'middle back,biceps'],
      ['פול אובר בכבל', 'Straight-Arm_Pulldown', 'c', 'lats', 'triceps:long,chest']]],
    ['middle back', 'back', [
      ['חתירה במוט', 'Bent_Over_Barbell_Row', 'b', 'middle back,lats', 'shoulders:rear,biceps,lower back'],
      ['חתירה במשקולת', 'One-Arm_Dumbbell_Row', 'd', 'middle back,lats', 'shoulders:rear,biceps'],
      ['פולי תחתון', 'Seated_Cable_Rows', 'c', 'middle back', 'lats,shoulders:rear,biceps'],
      ['חתירה במכונה', 'Leverage_Iso_Row', 'm', 'middle back', 'lats,shoulders:rear,biceps'],
      ['חתירת טי בר', 'T-Bar_Row_with_Handle', 'b', 'middle back,lats', 'shoulders:rear,biceps,lower back']]],
    ['traps', 'back', [
      ['שראג', 'Barbell_Shrug', 'b', 'traps', 'forearms'],
      ['שראג במשקולות', 'Dumbbell_Shrug', 'd', 'traps', 'forearms']]],
    ['lower back', 'back', [
      ['פשיטת גב', 'Hyperextensions_Back_Extensions', 'w', 'lower back', 'glutes,hamstrings'],
      ['דדליפט', 'Barbell_Deadlift', 'b', 'lower back,glutes,hamstrings', 'quadriceps,traps,forearms,lats']]],
  ],
  'כתפיים': [
    ['shoulders:front', 'front', [
      ['לחיצת כתפיים במשקולות', 'Dumbbell_Shoulder_Press', 'd', 'shoulders:front', 'shoulders:side,triceps,traps'],
      ['לחיצה צבאית', 'Standing_Military_Press', 'b', 'shoulders:front', 'shoulders:side,triceps,traps'],
      ['לחיצת כתפיים במכונה', 'Machine_Shoulder_Military_Press', 'm', 'shoulders:front', 'shoulders:side,triceps'],
      ['ארנולד פרס', 'Arnold_Dumbbell_Press', 'd', 'shoulders:front', 'shoulders:side,triceps'],
      ['הרמה קדמית במשקולות', 'Front_Dumbbell_Raise', 'd', 'shoulders:front', 'shoulders:side,chest:upper']]],
    ['shoulders:side', 'front', [
      ['הרחקה לצדדים', 'Side_Lateral_Raise', 'd', 'shoulders:side', 'shoulders:front,traps'],
      ['הרחקה לצדדים בכבל', 'Cable_Seated_Lateral_Raise', 'c', 'shoulders:side', 'traps'],
      ['חתירה לסנטר', 'Upright_Barbell_Row', 'b', 'shoulders:side,traps', 'shoulders:front,biceps']]],
    ['shoulders:rear', 'back', [
      ['פרפר הפוך', 'Reverse_Machine_Flyes', 'm', 'shoulders:rear', 'middle back,traps'],
      ['פייס פול', 'Face_Pull', 'c', 'shoulders:rear', 'middle back,traps'],
      ['פרפר הפוך במשקולות', 'Seated_Bent-Over_Rear_Delt_Raise', 'd', 'shoulders:rear', 'middle back,traps'],
      ['פרפר הפוך בכבל', 'Cable_Rear_Delt_Fly', 'c', 'shoulders:rear', 'middle back']]],
  ],
  'יד קדמית': [
    ['biceps', 'front', [
      ['כפיפת מרפקים', 'Barbell_Curl', 'b', 'biceps', 'forearms'],
      ['כפיפת מרפקים במשקולות', 'Dumbbell_Bicep_Curl', 'd', 'biceps', 'forearms'],
      ['כפיפת מרפקים בכבל', 'Standing_Biceps_Cable_Curl', 'c', 'biceps', 'forearms']]],
    ['biceps:long', 'front', [
      ['כפיפת מרפקים בשיפוע', 'Incline_Dumbbell_Curl', 'd', 'biceps:long', 'biceps:short,forearms'],
      ['כפיפת מרפקים באחיזה צרה', 'Close-Grip_Standing_Barbell_Curl', 'b', 'biceps:long', 'biceps:short,forearms']]],
    ['biceps:short', 'front', [
      ['כפיפת מרפקים בכיסא כומר', 'Preacher_Curl', 'b', 'biceps:short', 'biceps:long'],
      ['כפיפת מרפקים בריכוז', 'Concentration_Curls', 'd', 'biceps:short', 'biceps:long']]],
    ['forearms', 'front', [
      ['פטיש', 'Hammer_Curls', 'd', 'forearms,biceps:long', 'biceps:short'],
      ['כפיפת מרפקים באחיזה הפוכה', 'Reverse_Barbell_Curl', 'b', 'forearms', 'biceps'],
      ['כפיפת שורש כף היד', 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', 'b', 'forearms', '']]],
  ],
  'יד אחורית': [
    ['triceps:long', 'back', [
      ['פשיטת מרפקים מעל הראש בכבל', 'Cable_Rope_Overhead_Triceps_Extension', 'c', 'triceps:long', 'triceps:lat'],
      ['פרנץ', 'Standing_Dumbbell_Triceps_Extension', 'd', 'triceps:long', 'triceps:lat'],
      ['סקאל קראשר', 'EZ-Bar_Skullcrusher', 'b', 'triceps:long,triceps:lat', '']]],
    ['triceps:lat', 'back', [
      ['פשיטת מרפקים בכבל', 'Triceps_Pushdown', 'c', 'triceps:lat', 'triceps:long'],
      ['פשיטת מרפקים בכבל עם חבל', 'Triceps_Pushdown_-_Rope_Attachment', 'c', 'triceps:lat', 'triceps:long'],
      ['פשיטת מרפקים לאחור במשקולת', 'Tricep_Dumbbell_Kickback', 'd', 'triceps:lat', 'triceps:long']]],
    ['triceps', 'back', [
      ['מקבילים', 'Dips_-_Triceps_Version', 'w', 'triceps', 'chest:lower,shoulders:front'],
      ['לחיצת חזה צרה', 'Close-Grip_Barbell_Bench_Press', 'b', 'triceps', 'chest,shoulders:front']]],
  ],
  'בטן': [
    ['abdominals:upper', 'front', [
      ['כפיפות בטן', 'Crunches', 'w', 'abdominals:upper', 'abdominals:lower'],
      ['כפיפות בטן בכבל', 'Cable_Crunch', 'c', 'abdominals:upper', 'abdominals:lower,abdominals:obliques'],
      ['כפיפות בטן במכונה', 'Ab_Crunch_Machine', 'm', 'abdominals:upper', 'abdominals:lower']]],
    ['abdominals:lower', 'front', [
      ['הרמות רגליים בתלייה', 'Hanging_Leg_Raise', 'w', 'abdominals:lower', 'abdominals:upper,abdominals:obliques'],
      ['הרמות רגליים בשכיבה', 'Flat_Bench_Lying_Leg_Raise', 'w', 'abdominals:lower', 'abdominals:upper'],
      ['כפיפות בטן הפוכות', 'Reverse_Crunch', 'w', 'abdominals:lower', 'abdominals:upper']]],
    ['abdominals:obliques', 'front', [
      ['טוויסט רוסי', 'Russian_Twist', 'w', 'abdominals:obliques', 'abdominals:upper,abdominals:lower'],
      ['פלאנק צידי', 'Side_Bridge', 'w', 'abdominals:obliques', 'abdominals,shoulders:side'],
      ['כפיפות צד במשקולת', 'Dumbbell_Side_Bend', 'd', 'abdominals:obliques', 'lower back']]],
    ['abdominals', 'front', [
      ['פלאנק', 'Plank', 'w', 'abdominals', 'shoulders:front,lower back'],
      ['גלגלת בטן', 'Ab_Roller', 'w', 'abdominals', 'lats,shoulders:front']]],
  ],
  'רגליים': [
    ['quadriceps', 'front', [
      ['סקוואט', 'Barbell_Squat', 'b', 'quadriceps,glutes', 'hamstrings,adductors,lower back,calves'],
      ['לחיצת רגליים', 'Leg_Press', 'm', 'quadriceps', 'glutes,hamstrings,adductors'],
      ['סקוואט בסמית', 'Smith_Machine_Squat', 'm', 'quadriceps', 'glutes,hamstrings'],
      ['האק סקוואט', 'Hack_Squat', 'm', 'quadriceps', 'glutes'],
      ['סקוואט גובלט', 'Goblet_Squat', 'd', 'quadriceps,glutes', 'adductors,abdominals'],
      ['פשיטת ברכיים', 'Leg_Extensions', 'm', 'quadriceps', '']]],
    ['glutes', 'back', [
      ['היפ טראסט', 'Barbell_Hip_Thrust', 'b', 'glutes', 'hamstrings'],
      ['סקוואט בולגרי', 'Split_Squat_with_Dumbbells', 'd', 'glutes,quadriceps', 'hamstrings,adductors'],
      ['מכרעים', 'Dumbbell_Lunges', 'd', 'quadriceps,glutes', 'hamstrings,calves'],
      ['בעיטת ישבן בכבל', 'One-Legged_Cable_Kickback', 'c', 'glutes', 'hamstrings']]],
    ['hamstrings', 'back', [
      ['דדליפט רומני', 'Romanian_Deadlift', 'b', 'hamstrings,glutes', 'lower back'],
      ['כפיפת ברכיים', 'Lying_Leg_Curls', 'm', 'hamstrings', 'calves'],
      ['כפיפת ברכיים בישיבה', 'Seated_Leg_Curl', 'm', 'hamstrings', 'calves']]],
    ['adductors', 'front', [
      ['מקרבים במכונה', 'Thigh_Adductor', 'm', 'adductors', ''],
      ['מרחיקים במכונה', 'Thigh_Abductor', 'm', 'abductors', 'glutes']]],
    ['calves', 'back', [
      ['הרמת עקבים', 'Standing_Calf_Raises', 'm', 'calves', ''],
      ['הרמת עקבים בישיבה', 'Seated_Calf_Raise', 'm', 'calves', ''],
      ['הרמת עקבים בלחיצת רגליים', 'Calf_Press_On_The_Leg_Press_Machine', 'm', 'calves', '']]],
  ],
};
// Section names where the muscle's own name says too little.
const PART_LABEL = {
  biceps: L('שני הראשים', 'Båda huvudena'), triceps: L('כל הראשים', 'Alla huvudena'),
  forearms: L('ברכיאליס ואמות', 'Brachialis och underarmar'), abdominals: L('ליבה', 'Bål'),
  adductors: L('מקרבים ומרחיקים', 'Adduktorer och abduktorer'),
};
// Equipment, so you can pick what's free at the gym right now.
const EQUIP_KINDS = { m: L('מכונה', 'Maskin'), c: L('כבל', 'Kabel'), d: L('משקולות', 'Hantlar'), b: L('מוט', 'Skivstång'), w: L('משקל גוף', 'Kroppsvikt') };
const DB_EQUIP = { machine: 'm', cable: 'c', dumbbell: 'd', kettlebells: 'd', barbell: 'b', 'e-z curl bar': 'b', 'body only': 'w', other: 'w' };
const eqOk = (eq) => !ui.libEq || ui.libEq === eq;
const partName = (k) => PART_LABEL[k] || MUSCLE_NAMES[k] || k;
const splitMus = (s) => (s ? s.split(',') : []);
// id -> {name, area, part, side, eq, p, s}
const LIB_ITEMS = new Map(Object.entries(LIBRARY).flatMap(([area, parts]) => parts.flatMap(([part, side, list]) =>
  list.map(([name, id, eq, p, s]) => [id, { name, area, part, side, eq, p: splitMus(p), s: splitMus(s) }]))));
const LIB_IDS = new Set(LIB_ITEMS.keys());
// A stored exercise name (either language) -> its library id; a name listed in two areas (dips) takes the one
// in the exercise's own area.
function libIdFor(name) {
  const he = canon(name), g = groupOf(name);
  let first = null;
  for (const [id, it] of LIB_ITEMS) {
    if (it.name !== he) continue;
    if (it.area === g) return id;
    first ||= id;
  }
  return first;
}
const libImages = (id) => [`${id}/0.jpg`, `${id}/1.jpg`];
// Bookmarked library exercises: name -> {id, area}. Created on first use, so an imported backup without it still works.
function libSaved() {
  if (!db.libSaved || typeof db.libSaved !== 'object') db.libSaved = {};
  return db.libSaved;
}

const BOOKMARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';

function openLibrary(area) {
  const last = db.active?.exercises.at(-1);
  const guess = last && LIBRARY[groupOf(last.name)] ? groupOf(last.name) : null;
  ui.lib = { area: area || guess || ui.libArea || 'חזה', part: null, more: false };
  render();
  window.scrollTo(0, 0);
}

function closeLibrary() {
  ui.lib = null;
  render();
  window.scrollTo(0, 0);
}

const inWorkout = (name) => !!db.active?.exercises.some((x) => x.name === name);

// Your own record with each exercise, gathered once per screen: name -> {n: workouts, t: last time, top: that day's heaviest set}.
function libHistory() {
  const h = new Map();
  for (const w of sortedWorkouts()) {
    for (const e of w.exercises) {
      const sets = work(e.sets).filter((s) => num(s.r) != null);
      if (!sets.length) continue;
      const cur = h.get(e.name);
      if (cur) { cur.n++; continue; }
      const top = sets.reduce((a, s) => ((num(s.w) || 0) > (num(a.w) || 0) || ((num(s.w) || 0) === (num(a.w) || 0) && num(s.r) > num(a.r)) ? s : a));
      h.set(e.name, { n: 1, t: w.start, top });
    }
  }
  return h;
}
const setText = (s) => (num(s.w) ? `${fmtW(num(s.w))}×${num(s.r)}` : `${num(s.r)} ${L('חזרות', 'reps')}`);
function agoText(t) {
  const d = Math.round((Date.now() - t) / 86400000);
  if (d <= 0) return L('היום', 'i dag');
  if (d === 1) return L('אתמול', 'i går');
  if (d < 14) return L(`לפני ${d} ימים`, `för ${d} dagar sedan`);
  if (d < 60) return L(`לפני ${Math.round(d / 7)} שבועות`, `för ${Math.round(d / 7)} veckor sedan`);
  return L(`לפני ${Math.round(d / 30)} חודשים`, `för ${Math.round(d / 30)} månader sedan`);
}

function libCard(name, id, area, sub, english, hist) {
  const saved = !!libSaved()[name], here = inWorkout(name), mine = hist?.get(name);
  return `
    <div class="lib-card ${here ? 'here' : ''} ${mine ? 'mine' : ''}">
      <button class="lib-open" data-act="lib-ex" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}">
        ${demoAnim(libImages(id))}
        <span class="lib-name" ${english ? 'dir="ltr"' : ''}>${esc(english ? name : exName(name))}</span>
        <span class="muted small">${here ? L('✓ באימון', '✓ I passet') : esc(sub)}</span>
        ${mine ? `<span class="lib-mine"><b dir="ltr">${esc(setText(mine.top))}</b> · ${esc(agoText(mine.t))}</span>` : ''}
      </button>
      <button class="lib-save ${saved ? 'on' : ''}" data-act="lib-save" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}" aria-pressed="${saved}" aria-label="${L('שמור', 'Spara')}">${BOOKMARK}</button>
      ${db.active && !here ? `<button class="lib-quick" data-act="lib-add" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}" aria-label="${L('הוסף לאימון', 'Lägg till i passet')}: ${esc(english ? name : exName(name))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
      ${here ? '<span class="lib-here" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' : ''}
    </div>`;
}

// One part of an area: a figure with that part lit, its name, and its exercises.
// Working sets in the last 7 days (the live workout included), per body area and per part of one, so the parts
// you've skipped stand out. A set counts toward a part when the exercise's main muscles name it or its whole muscle.
let libWk = null;
function libWeek() {
  const since = Date.now() - 7 * 86400000, fresh = Date.now() - 2 * 86400000, area = new Map(), part = new Map(), recent = new Set();
  const keys = Object.values(LIBRARY).flat().map(([k]) => k);
  const hits = (p, k) => {
    const mu = k.split(':')[0];
    return p.some((x) => x === k || x === mu || (!k.includes(':') && x.startsWith(`${mu}:`)));
  };
  for (const w of [...db.workouts.filter((x) => x.start >= since), ...(db.active ? [db.active] : [])]) {
    for (const e of w.exercises) {
      const n = work(e.sets).filter((s) => db.active === w ? s.done : true).length;
      if (!n) continue;
      const g = groupOf(e.name), { p } = musclesFor(e.name, g);
      area.set(g, (area.get(g) || 0) + n);
      if (w.start >= fresh) recent.add(g);
      for (const k of keys) if (hits(p, k)) part.set(k, (part.get(k) || 0) + n);
    }
  }
  return { area, part, recent };
}

// Body map: tap a muscle to open its part of the library. Colored by this week's sets, so it doubles as a
// picture of what's been trained: red = a full week's worth, orange = some, grey = none.
function libMap() {
  const p = [], s = [];
  for (const [k, n] of libWk.part) (n >= 6 ? p : n > 0 ? s : []).push(k);
  const m = { p, s };
  return `
    <div class="lib-map-card">
      <div class="lib-map-head">
        <h2>${L('מפת גוף', 'Kroppskarta')}</h2>
        <span>${L('לחץ על שריר כדי לראות את התרגילים שלו', 'Tryck på en muskel för att se dess övningar')}</span>
      </div>
      <div class="lib-map">
        <figure>${bodyFig('front', m, true)}<figcaption>${L('קדימה', 'Framsida')}</figcaption></figure>
        <figure>${bodyFig('back', m, true)}<figcaption>${L('אחורה', 'Baksida')}</figcaption></figure>
      </div>
      <div class="lib-map-key">
        <span class="muted">${L('7 ימים אחרונים:', 'Senaste 7 dagarna:')}</span>
        <span><i class="dot mp"></i>${L('6+ סטים', '6+ set')}</span>
        <span><i class="dot ms"></i>${L('מעט', 'Lite')}</span>
        <span><i class="dot"></i>${L('לא אומן', 'Inte tränad')}</span>
      </div>
    </div>`;
}

// The library part a tapped muscle belongs to: its own part ("chest:upper") if the library has one, else the muscle.
function libPartOf(mu, part) {
  const want = mu === 'abductors' ? 'adductors' : mu;
  for (const pass of [0, 1]) {
    for (const [area, parts] of Object.entries(LIBRARY)) {
      for (const [k] of parts) {
        if (pass === 0 ? k === `${want}:${part}` || (!part && k === want) : k === want || k.split(':')[0] === want) return [area, k];
      }
    }
  }
  return null;
}

// "Recommended now": the three parts with the fewest sets this week, from areas not trained in the last 48 hours
// (they're still recovering), at most one per area. For each, an exercise you've done before if there is one.
function libForMe(hist) {
  const cand = [];
  for (const [area, parts] of Object.entries(LIBRARY)) {
    if (libWk.recent.has(area)) continue;
    for (const [part, , list] of parts) {
      const ok = list.filter(([, , eq]) => eqOk(eq));
      if (!ok.length) continue;
      const pick = ok.find(([n]) => hist.has(n)) || ok[0];
      const lo = AREA_TARGET[area]?.[0] || 6;
      cand.push({ area, part, n: libWk.part.get(part) || 0, fill: (libWk.area.get(area) || 0) / lo, pick });
    }
  }
  cand.sort((a, b) => a.n - b.n || a.fill - b.fill);
  const out = [], used = new Set();
  for (const c of cand) {
    if (out.length === 3) break;
    if (used.has(c.area)) continue;
    used.add(c.area); out.push(c);
  }
  if (!out.length) return '';
  return `
    <div class="lib-forme">
      <div class="lib-forme-head"><b>${L('מומלץ לך עכשיו', 'Rekommenderat nu')}</b><span>${L('הכי פחות אומן השבוע', 'Minst tränat i veckan')}</span></div>
      <div class="lib-recs">${out.map(({ area, part, n, pick: [name, id] }) => `
        <button class="lib-rec" data-act="lib-ex" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}">
          <span class="lib-rec-img">${demoAnim(libImages(id))}</span>
          <span class="lib-rec-text">
            <span class="lib-rec-part">${esc(partName(part))}</span>
            <span class="lib-rec-name">${esc(exName(name))}</span>
            <span class="lib-rec-wk ${n ? '' : 'none'}">${n ? L(`${n} סטים השבוע`, `${n} set i veckan`) : L('לא אומן השבוע', 'Inte tränad i veckan')}</span>
          </span>
        </button>`).join('')}
      </div>
    </div>`;
}
// "8/10": this week's sets against the low end of the area's weekly target; low until it's reached.
function areaWeekTag(a) {
  const n = libWk?.area.get(a) || 0, lo = AREA_TARGET[a]?.[0];
  return lo ? `<span class="lib-wk ${n >= lo ? 'ok' : n ? 'low' : 'none'}" dir="ltr">${n}/${lo}</span>` : '';
}

// The figure crop that frames a part: torso, arm, thigh or lower leg.
const PART_VIEWS = { torso: '10 20 80 80', arm: '2 32 50 50', thigh: '20 84 60 60', shin: '20 138 60 60' };
// The same for the area tiles at the top; legs show from the hips to below the knees.
const AREA_VIEWS = { 'חזה': PART_VIEWS.torso, 'גב': PART_VIEWS.torso, 'כתפיים': PART_VIEWS.torso, 'בטן': '14 30 72 72',
  'יד קדמית': PART_VIEWS.arm, 'יד אחורית': PART_VIEWS.arm, 'רגליים': '6 84 88 88' };
function partView(part) {
  const mu = part.split(':')[0];
  if (['biceps', 'triceps', 'forearms'].includes(mu)) return PART_VIEWS.arm;
  if (mu === 'calves') return PART_VIEWS.shin;
  if (['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors'].includes(mu)) return PART_VIEWS.thigh;
  return PART_VIEWS.torso;
}

function libSection(area, [part, side, all], hist) {
  const list = all.filter(([, , eq]) => eqOk(eq));
  if (!list.length) return '';
  return `
    <section class="lib-sec">
      <div class="lib-sec-head">
        <span class="lib-sec-fig">${bodyFig(side, { p: [part], s: [] }, false, partView(part))}</span>
        <div><h2>${esc(partName(part))}</h2><span class="muted small">${list.length} ${L('תרגילים', 'övningar')}</span>${(() => {
          const n = libWk?.part.get(part) || 0;
          return n ? `<span class="lib-sec-wk">${L(`${n} סטים ב-7 ימים`, `${n} set på 7 dagar`)}</span>`
            : `<span class="lib-sec-wk none">${L('לא אומן ב-7 ימים', 'Inte tränad på 7 dagar')}</span>`;
        })()}</div>
      </div>
      <div class="lib-grid">${list.map(([n, id, eq]) => libCard(n, id, area, EQUIP_KINDS[eq], false, hist)).join('')}</div>
    </section>`;
}

// Search across every area: each word has to appear in the name (either language), the part or the area.
function libSearch(q, hist) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  for (const [area, parts] of Object.entries(LIBRARY)) {
    for (const [part, , list] of parts) {
      for (const [name, id, eq] of list) {
        const text = [name, exName(name), partName(part), gName(area), area, EQUIP_KINDS[eq]].join(' ').toLowerCase();
        if (words.every((w) => text.includes(w))) hits.push(libCard(name, id, area, `${gName(area)} · ${partName(part)}`, false, hist));
      }
    }
  }
  return hits.length ? `<div class="lib-grid" style="margin-top:14px">${hits.join('')}</div>`
    : `<p class="muted" style="margin-top:16px">${L('לא נמצאו תרגילים. נסה מילה אחרת, למשל "פרפר" או "כבל".', 'Inga övningar hittades. Prova ett annat ord, t.ex. "flyes" eller "kabel".')}</p>`;
}

function viewLibrary() {
  libWk = libWeek();
  return `
    ${libStrip()}
    <label class="lib-q-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" class="lib-q" data-f="lib-q" value="${esc(ui.libQ || '')}" placeholder="${L('חיפוש תרגיל, ציוד או שריר…', 'Sök övning, utrustning eller muskel…')}" enterkeyhint="search" autocomplete="off" aria-label="${L('חיפוש תרגיל', 'Sök övning')}"></label>
    <div id="lib-body">${libBody()}</div>
    <div class="lib-offline" id="lib-offline">${libOfflineHtml()}</div>
    <button class="btn block" data-act="lib-close">${db.active ? L('חזרה לאימון', 'Tillbaka till passet') : L('חזרה', 'Tillbaka')}</button>`;
}

function libStrip() {
  const area = ui.lib.area;
  const strip = `
    <div class="lib-areas" role="tablist">
      <button class="lib-area ${area === 'saved' ? 'on' : ''}" data-act="lib-area" data-a="saved" role="tab" aria-selected="${area === 'saved'}">
        <span class="lib-fig lib-bm">${BOOKMARK}</span><span>${L('שמורים', 'Sparade')}</span>
      </button>
      <button class="lib-area ${area === 'map' ? 'on' : ''}" data-act="lib-area" data-a="map" role="tab" aria-selected="${area === 'map'}">
        <span class="lib-fig lib-mapfig">${bodyFig('front', { p: [], s: [] })}</span><span>${L('מפת גוף', 'Kroppskarta')}</span>
      </button>
      ${LIB_AREAS.map(([a, side]) => `
        <button class="lib-area ${a === area ? 'on' : ''}" data-act="lib-area" data-a="${a}" role="tab" aria-selected="${a === area}">
          <span class="lib-fig">${bodyFig(side, { p: GROUP_MUSCLES[a] || [], s: [] }, false, AREA_VIEWS[a])}</span><span>${gName(a)}</span>${areaWeekTag(a)}
        </button>`).join('')}
    </div>`;
  return strip;
}

// Everything below the search box; typing redraws just this part, so the keyboard stays up.
function libBody() {
  const lb = ui.lib, area = lb.area, hist = libHistory();
  if (ui.libQ?.trim()) return libSearch(ui.libQ.trim(), hist);
  if (area === 'map') return libMap();
  let body;
  if (area === 'saved') {
    const list = Object.entries(libSaved());
    body = list.length
      ? `<div class="lib-grid" style="margin-top:14px">${list.map(([n, s]) => {
        const it = LIB_ITEMS.get(s.id);
        return libCard(n, s.id, s.area, it ? partName(it.part) : gName(s.area), !it, hist);
      }).join('')}</div>
      <button class="btn primary block" data-act="lib-saved-tpl">${L(`צור תבנית מ-${list.length} השמורים`, `Skapa en mall av de ${list.length} sparade`)}</button>`
      : `<p class="muted">${L('עוד לא שמרת תרגילים. לחץ על הסימנייה בכרטיס של תרגיל כדי לשמור אותו כאן.', 'Inga sparade övningar än. Tryck på bokmärket på en övning för att spara den här.')}</p>`;
  } else {
    const parts = LIBRARY[area];
    const shown = lb.part ? parts.filter(([k]) => k === lb.part) : parts;
    const chips = `
      <div class="lib-parts">
        <button class="lib-part ${!lb.part ? 'on' : ''}" data-act="lib-part" data-k="">${L('הכל', 'Alla')}</button>
        ${parts.map(([k]) => `<button class="lib-part ${lb.part === k ? 'on' : ''}" data-act="lib-part" data-k="${esc(k)}">${esc(partName(k))}</button>`).join('')}
      </div>
      <div class="lib-eqs">
        <span class="muted small">${L('ציוד:', 'Utrustning:')}</span>
        ${Object.entries(EQUIP_KINDS).map(([k, label]) => `<button class="lib-eq ${ui.libEq === k ? 'on' : ''}" data-act="lib-eq" data-k="${k}" aria-pressed="${ui.libEq === k}">${label}</button>`).join('')}
      </div>`;
    const sections = shown.map((p) => libSection(area, p, hist)).join('');
    let more = '';
    if (!lb.more) more = `<button class="lib-more" data-act="lib-more"><span><b>${L('עוד תרגילים מהמאגר', 'Fler övningar från databasen')}</b><small>${L('מאות תרגילים נוספים, בשמות באנגלית', 'Hundratals till, med engelska namn')}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
    else if (lb.moreErr) more = `<p class="muted small">${L('אין חיבור לאינטרנט. המאגר צריך רשת.', 'Ingen internetanslutning. Databasen behöver nätet.')}</p>`;
    else if (!lb.extra) more = '<div class="center" style="padding:24px 0"><div class="spinner"></div></div>';
    else more = `<h2>${L('עוד מהמאגר', 'Mer från databasen')}</h2><div class="lib-grid">${lb.extra.filter((x) => eqOk(DB_EQUIP[x.equipment] || 'w')).map((x) => libCard(x.name, x.id, area, EQUIP_KINDS[DB_EQUIP[x.equipment] || 'w'], true, hist)).join('')}</div>`;
    const none = `<p class="muted" style="margin-top:16px">${L(`אין כאן תרגילים עם ${EQUIP_KINDS[ui.libEq]}.`, `Inga övningar med ${EQUIP_KINDS[ui.libEq]} här.`)} <button class="link-btn" data-act="lib-eq" data-k="${ui.libEq}">${L('הצג הכל', 'Visa alla')}</button></p>`;
    body = `${lb.part ? '' : libForMe(hist)}${chips}${sections || none}${lb.part ? '' : more}`;
  }
  return body;
}

async function libMore() {
  const lb = ui.lib, area = lb.area;
  lb.more = true; lb.extra = null; lb.moreErr = false;
  render();
  try {
    const list = await loadExercises();
    const mus = GROUP_MUSCLES[area] || [];
    const extra = list.filter((x) => x.category === 'strength' && !LIB_IDS.has(x.id) && (x.primaryMuscles || []).some((m) => mus.includes(m)) && x.images?.length)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (ui.lib === lb && lb.area === area) lb.extra = extra;
  } catch {
    if (ui.lib === lb) lb.moreErr = true;
  }
  if (ui.lib === lb) render();
}

// The exercise sheet: its demo, the muscles it works and how to do it. Uses the demo sheet's slot, so it closes the same ways.
// Opened from inside another exercise's sheet (its alternatives): remember that one, for the back button.
async function openLibEx(name, id, area) {
  const from = ui.demo?.lib ? { name: ui.demo.name, id: ui.demo.lib.id, area: ui.demo.lib.area } : null;
  const d = { name, lib: { id, area, x: null, from } };
  ui.demo = d;
  renderSheet();
  try {
    const x = (await loadExercises()).find((r) => r.id === id);
    if (x && ui.demo === d) { d.lib.x = x; renderSheet(); }
  } catch { /* offline: the photos may still be cached */ }
}

// The library's own muscle lists (with parts like upper chest) first, then the database's.
function libMuscles(id, x, name, area) {
  const it = LIB_ITEMS.get(id);
  if (it) return { p: it.p, s: it.s };
  if (x?.primaryMuscles?.length) return { p: x.primaryMuscles, s: (x.secondaryMuscles || []).filter((k) => !x.primaryMuscles.includes(k)) };
  return musclesFor(name, area);
}

function viewLibEx(d) {
  const { id, area, x } = d.lib;
  const english = !LIB_IDS.has(id);
  const m = libMuscles(id, x, d.name, area);
  const here = inWorkout(d.name), saved = !!libSaved()[d.name], it = LIB_ITEMS.get(id);
  // Under the name: where it sits in the library and what it takes.
  const meta = it ? [gName(it.area), partName(it.part), EQUIP_KINDS[it.eq]] : [gName(area), x?.equipment].filter(Boolean);
  return `
    <div class="sheet-panel lib-sheet" data-act="none" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="lib-sheet-head">
        ${d.lib.from ? `<button class="icon-btn lib-back" data-act="lib-back" aria-label="${L('חזרה ל', 'Tillbaka till ')}${esc(exName(d.lib.from.name))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>` : ''}
        <div class="grow">
          <h2 class="lib-sheet-title" ${english ? 'dir="ltr"' : ''}>${esc(english ? d.name : exName(d.name))}</h2>
          <div class="lib-sheet-meta">${meta.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        </div>
        <button class="icon-btn" data-act="demo-close" aria-label="${L('סגור', 'Stäng')}">✕</button>
      </div>
      ${demoAnim(libImages(id), true)}
      <div class="lib-actions">
        ${here ? `<span class="lib-in">${L('✓ כבר באימון', '✓ Redan i passet')}</span>`
          : `<button class="btn primary" data-act="lib-add" data-name="${esc(d.name)}" data-id="${esc(id)}" data-area="${esc(area)}">${db.active ? L('+ הוסף לאימון', '+ Lägg till i passet') : L('התחל אימון עם התרגיל', 'Starta ett pass med övningen')}</button>`}
        <button class="btn lib-save-btn ${saved ? 'on' : ''}" data-act="lib-save" data-name="${esc(d.name)}" data-id="${esc(id)}" data-area="${esc(area)}" aria-pressed="${saved}" aria-label="${saved ? L('נשמר', 'Sparad') : L('שמור', 'Spara')}">${BOOKMARK}</button>
      </div>
      ${libHowBox(id)}
      ${libTplRow(d.name, id)}
      ${libMineBox(d.name)}
      ${libSimilar(id)}
      <div class="lib-h">${L('שרירי מטרה', 'Målmuskler')}</div>
      ${m.p.length ? `
        <div class="lib-target-box">
          <div class="lib-target">
            ${bodySvg('front', m, L('קדימה', 'Framsida'))}${bodySvg('back', m, L('אחורה', 'Baksida'))}
          </div>
          <div class="muscle-list">
            <div><i class="dot mp"></i><b>${L('ראשי:', 'Primära:')}</b> ${esc(muscleNames(m.p))}</div>
            ${m.s.length ? `<div><i class="dot ms"></i><b>${L('משני:', 'Sekundära:')}</b> ${esc(muscleNames(m.s))}</div>` : ''}
          </div>
        </div>` : `<p class="muted small">${L('אין מידע על השרירים.', 'Ingen muskelinformation.')}</p>`}
      ${x ? `<div class="lib-h" dir="ltr">${esc(x.name)}${x.equipment ? ` · ${esc(x.equipment)}` : ''}</div>` : ''}
      ${x?.instructions?.length ? `<ol class="demo-steps" dir="ltr">${x.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    </div>`;
}

// In the sheet: what you did last time and your best, so you know what to load before you walk to the station.
function libMineBox(name) {
  const last = lastSetsFor(name);
  if (!last) return '';
  const mine = libHistory().get(name), { maxW, maxE } = bestFor(name);
  return `
    <div class="lib-mine-box">
      <div class="row between"><span class="lib-h" style="margin:0">${L('הפעם האחרונה שלך', 'Senast du gjorde den')}</span><span class="muted small">${mine ? esc(agoText(mine.t)) : ''}</span></div>
      <div class="chips">${last.map((s) => `<span class="chip">${esc(setText(s))}</span>`).join('')}</div>
      <div class="muted small" style="margin-top:6px">
        ${mine ? (mine.n === 1 ? L('עשית פעם אחת', 'Gjort en gång') : L(`עשית ${mine.n} פעמים`, `Gjort ${mine.n} gånger`)) : ''}${maxW && num(maxW.w) ? ` · ${L('שיא', 'Rekord')} <b dir="ltr">${esc(setText(maxW))}</b>` : ''}${maxE ? ` · 1RM ≈ <b dir="ltr">${Math.round(maxE)}</b>` : ''}
      </div>
    </div>`;
}

// ---------- How to do it ----------
// Sets, reps and rest by kind of exercise: heavy compound lifts low reps and long rests, isolation more reps and short rests.
const HEAVY_IDS = new Set(['Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Decline_Barbell_Bench_Press',
  'Standing_Military_Press', 'Barbell_Squat', 'Barbell_Deadlift', 'Romanian_Deadlift', 'Bent_Over_Barbell_Row', 'Leg_Press', 'Hack_Squat',
  'Smith_Machine_Squat', 'Barbell_Hip_Thrust', 'T-Bar_Row_with_Handle', 'Close-Grip_Barbell_Bench_Press', 'Pullups', 'Chin-Up']);
const ISO_IDS = new Set(['Incline_Dumbbell_Flyes', 'Incline_Cable_Flye', 'Butterfly', 'Dumbbell_Flyes', 'Cable_Crossover', 'Straight-Arm_Pulldown',
  'Barbell_Shrug', 'Dumbbell_Shrug', 'Front_Dumbbell_Raise', 'Side_Lateral_Raise', 'Cable_Seated_Lateral_Raise', 'Reverse_Machine_Flyes',
  'Face_Pull', 'Seated_Bent-Over_Rear_Delt_Raise', 'Cable_Rear_Delt_Fly', 'Leg_Extensions', 'Lying_Leg_Curls', 'Seated_Leg_Curl',
  'One-Legged_Cable_Kickback', 'Thigh_Adductor', 'Thigh_Abductor', 'Standing_Calf_Raises', 'Seated_Calf_Raise',
  'Calf_Press_On_The_Leg_Press_Machine', 'Hyperextensions_Back_Extensions']);
const HOLD_IDS = new Set(['Plank', 'Side_Bridge']);
const PRESC = {
  heavy: { sets: 4, reps: 8, range: '6–8', rest: 150 },
  compound: { sets: 3, reps: 10, range: '8–12', rest: 120 },
  iso: { sets: 3, reps: 12, range: '10–15', rest: 75 },
  core: { sets: 3, reps: 15, range: '12–20', rest: 60 },
  hold: { sets: 3, reps: null, range: L('30–60 שנ׳', '30–60 s'), rest: 60 },
};
function prescFor(id) {
  const it = LIB_ITEMS.get(id);
  if (!it) return null;
  if (HOLD_IDS.has(id)) return PRESC.hold;
  if (it.area === 'בטן') return PRESC.core;
  if (HEAVY_IDS.has(id)) return PRESC.heavy;
  if (ISO_IDS.has(id) || ((it.area === 'יד קדמית' || it.area === 'יד אחורית') && it.part !== 'triceps')) return PRESC.iso;
  return PRESC.compound;
}
const restText = (s) => (s >= 120 ? L(`${s / 60} דק׳`, `${s / 60} min`).replace('2.5', '2:30') : L(`${s} שנ׳`, `${s} s`));

// The one or two things that make each exercise work, in Hebrew (the database's own steps are in English).
const CUES = {
  Incline_Dumbbell_Press: 'ספסל בשיפוע 30°. שכמות צמודות לספסל, מרפקים בזווית 45° מהגוף.',
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 'המוט יורד לחזה העליון, מתחת לעצם הבריח. כפות רגליים יציבות על הרצפה.',
  Incline_Dumbbell_Flyes: 'מרפקים כפופים מעט וקבועים. לרדת עד מתיחה בחזה, לא מעבר לכתף.',
  Incline_Cable_Flye: 'לחבק מלמטה למעלה ולחבר ידיים מול הסנטר.',
  'Barbell_Bench_Press_-_Medium_Grip': 'שכמות מכווצות ולמטה, קשת קלה בגב. המוט נוגע בפטמות, מרפקים 45°.',
  Dumbbell_Bench_Press: 'להוריד עמוק עד מתיחה בחזה, לדחוף למעלה ולמרכז.',
  Machine_Bench_Press: 'ידיות בגובה אמצע החזה. לא לנעול מרפקים למעלה.',
  Butterfly: 'חזה קדימה, לחבר ידיים לאט ולהחזיק שנייה בכיווץ.',
  Dumbbell_Flyes: 'קשת רחבה, מרפקים כפופים מעט. לעלות עד שהמשקולות כמעט נוגעות.',
  Pushups: 'גוף ישר מהראש עד העקבים, חזה כמעט נוגע ברצפה.',
  'Dips_-_Chest_Version': 'גוף נוטה קדימה ומרפקים פתוחים מעט, כדי שהחזה יעבוד. לרדת עד 90° במרפק.',
  Decline_Barbell_Bench_Press: 'המוט יורד לחזה התחתון. רגליים נעולות היטב בספסל.',
  Decline_Dumbbell_Bench_Press: 'לדחוף למעלה ומעט פנימה, כתפיים צמודות לספסל.',
  Cable_Crossover: 'גלגלות גבוהות, צעד קדימה. למשוך למטה ופנימה עד מול המותניים.',
  Pullups: 'להתחיל מתלייה מלאה, למשוך מרפקים למטה לכיוון המותניים, חזה לבר.',
  'Chin-Up': 'אחיזה ברוחב כתפיים, כפות אליך. לעלות עד שהסנטר מעל הבר.',
  'Wide-Grip_Lat_Pulldown': 'למשוך לחזה העליון, לא מאחורי הראש. חזה גבוה, לא להתנדנד.',
  'Close-Grip_Front_Lat_Pulldown': 'מרפקים צמודים לגוף, למשוך עד החזה ולכווץ את הגב.',
  'Straight-Arm_Pulldown': 'ידיים כמעט ישרות, למשוך את המוט עד הירכיים בקשת.',
  Bent_Over_Barbell_Row: 'גו מקביל כמעט לרצפה, גב ישר. למשוך לבטן התחתונה.',
  'One-Arm_Dumbbell_Row': 'יד וברך על הספסל, למשוך את המרפק לכיוון הירך, לא לסובב את הגו.',
  Seated_Cable_Rows: 'גב זקוף, למשוך לבטן ולקרב שכמות. לא להישען אחורה.',
  Leverage_Iso_Row: 'חזה צמוד לכרית, למשוך מרפקים אחורה ולהחזיק שנייה.',
  'T-Bar_Row_with_Handle': 'ברכיים כפופות, גב ישר, למשוך את הידית לחזה התחתון.',
  Barbell_Shrug: 'להרים כתפיים ישר למעלה לאוזניים, בלי לסובב. החזקה קצרה למעלה.',
  Dumbbell_Shrug: 'ידיים ישרות לצד הגוף, להרים כתפיים ולהוריד לאט.',
  Hyperextensions_Back_Extensions: 'לעלות עד קו ישר עם הרגליים, לא לקשת יותר מדי.',
  Barbell_Deadlift: 'מוט צמוד לשוקיים, גב ניטרלי. לדחוף את הרצפה ברגליים, ירכיים וכתפיים עולות יחד.',
  Dumbbell_Shoulder_Press: 'משקולות בגובה האוזניים, לדחוף למעלה בלי לקשת את הגב.',
  Standing_Military_Press: 'בטן וישבן מכווצים. המוט עובר קרוב לפנים ונגמר מעל הראש.',
  Machine_Shoulder_Military_Press: 'מושב בגובה שהידיות מול הכתפיים. גב צמוד למשענת.',
  Arnold_Dumbbell_Press: 'להתחיל עם כפות אליך ולסובב החוצה תוך כדי לחיצה.',
  Front_Dumbbell_Raise: 'להרים קדימה עד גובה העיניים, בלי תנופה מהגב.',
  Side_Lateral_Raise: 'להרים לצדדים עד גובה הכתף, מרפקים מובילים. משקל קל ושליטה.',
  Cable_Seated_Lateral_Raise: 'הכבל מעביר מתח לאורך כל הטווח. להרים עד הכתף ולהוריד לאט.',
  Upright_Barbell_Row: 'אחיזה רחבה, למשוך עד גובה החזה בלבד כדי לשמור על הכתף.',
  Reverse_Machine_Flyes: 'חזה לכרית, לפתוח ידיים לאחור בקשת עד קו הגוף.',
  Face_Pull: 'חבל בגובה הפנים, למשוך לכיוון המצח ולפתוח ידיים החוצה.',
  'Seated_Bent-Over_Rear_Delt_Raise': 'גו רכון על הירכיים, להרים לצדדים עם מרפקים כפופים מעט.',
  Cable_Rear_Delt_Fly: 'כבלים מוצלבים בגובה הכתף, למשוך לאחור בקשת רחבה.',
  Barbell_Curl: 'מרפקים צמודים לגוף ולא זזים. בלי תנופה מהגב.',
  Dumbbell_Bicep_Curl: 'לסובב את כף היד כלפי מעלה תוך כדי עלייה, להוריד לאט.',
  Standing_Biceps_Cable_Curl: 'הכבל שומר על מתח למטה, לכווץ למעלה שנייה.',
  Incline_Dumbbell_Curl: 'ספסל בשיפוע 45°, ידיים תלויות מאחורי הגוף למתיחה של הראש הארוך.',
  'Close-Grip_Standing_Barbell_Curl': 'אחיזה צרה מכתפיים מדגישה את הראש הארוך.',
  Preacher_Curl: 'בית שחי צמוד לכרית. לא לנעול את המרפק למטה.',
  Concentration_Curls: 'מרפק על פנים הירך, להרים לאט ולכווץ חזק למעלה.',
  Hammer_Curls: 'כפות פונות זו לזו לאורך כל התנועה.',
  Reverse_Barbell_Curl: 'אחיזה מלמעלה, משקל קל יותר מכפיפה רגילה. שורש כף יד ישר.',
  'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench': 'אמות על הספסל, רק שורש כף היד זז.',
  Cable_Rope_Overhead_Triceps_Extension: 'גב לגלגלת, מרפקים ליד הראש ומצביעים קדימה. לפשוט עד הסוף.',
  Standing_Dumbbell_Triceps_Extension: 'משקולת מאחורי הראש, מרפקים צמודים ולא נפתחים לצדדים.',
  'EZ-Bar_Skullcrusher': 'להוריד את המוט מאחורי המצח, הזרוע העליונה כמעט לא זזה.',
  Triceps_Pushdown: 'מרפקים צמודים לצלעות, לפשוט עד הסוף ולהחזיק שנייה.',
  'Triceps_Pushdown_-_Rope_Attachment': 'בסוף התנועה לפתוח את החבל לצדדים.',
  Tricep_Dumbbell_Kickback: 'זרוע עליונה מקבילה לרצפה, רק האמה זזה לאחור.',
  'Dips_-_Triceps_Version': 'גוף זקוף ומרפקים צמודים, כדי שהיד האחורית תעבוד.',
  'Close-Grip_Barbell_Bench_Press': 'אחיזה ברוחב כתפיים, מרפקים צמודים לגוף בירידה.',
  Crunches: 'להרים את השכמות מהרצפה ולכווץ, לא למשוך בצוואר.',
  Cable_Crunch: 'לכופף את הגב ולקרב צלעות לאגן. הירכיים לא זזות.',
  Ab_Crunch_Machine: 'לכווץ את הבטן, לא לדחוף בידיים.',
  Hanging_Leg_Raise: 'בלי תנופה. להרים את האגן קצת למעלה בסוף התנועה.',
  Flat_Bench_Lying_Leg_Raise: 'גב תחתון צמוד לספסל, להוריד רגליים לאט.',
  Reverse_Crunch: 'להרים את האגן מהרצפה ולקרב ברכיים לחזה.',
  Russian_Twist: 'גב ישר בזווית 45°, לסובב את הכתפיים, לא רק את הידיים.',
  Side_Bridge: 'גוף בקו ישר, אגן לא צונח. מרפק מתחת לכתף.',
  Dumbbell_Side_Bend: 'משקולת ביד אחת, לרדת לצד ולעלות מהאלכסונים בלי להסתובב.',
  Plank: 'גוף ישר, ישבן ובטן מכווצים, לא להוריד אגן.',
  Ab_Roller: 'לגלגל קדימה רק כל עוד הגב התחתון לא שוקע.',
  Barbell_Squat: 'חזה גבוה, ברכיים בכיוון האצבעות. לרדת לפחות עד שהירך מקבילה.',
  Leg_Press: 'כפות רגליים ברוחב כתפיים, לא לנעול ברכיים למעלה. גב תחתון צמוד.',
  Smith_Machine_Squat: 'רגליים מעט לפני המוט, לרדת עמוק בשליטה.',
  Hack_Squat: 'גב צמוד למשענת, לרדת עמוק בלי שהעקבים יתרוממו.',
  Goblet_Squat: 'משקולת צמודה לחזה, מרפקים בין הברכיים בתחתית.',
  Leg_Extensions: 'להחזיק שנייה למעלה ולהוריד לאט.',
  Barbell_Hip_Thrust: 'גב עליון על הספסל, סנטר למטה. לנעול את הישבן למעלה בלי לקשת את הגב.',
  Split_Squat_with_Dumbbells: 'רגל אחורית על ספסל. נטייה קלה קדימה מדגישה את הישבן.',
  Dumbbell_Lunges: 'צעד ארוך, ברך אחורית כמעט נוגעת ברצפה. לדחוף מהעקב.',
  'One-Legged_Cable_Kickback': 'לבעוט אחורה מהישבן, בלי לקשת את הגב.',
  Romanian_Deadlift: 'ברכיים כפופות מעט, לדחוף את הישבן אחורה עד מתיחה במסטרינג.',
  Lying_Leg_Curls: 'אגן צמוד לכרית, לכופף עד הסוף ולהוריד לאט.',
  Seated_Leg_Curl: 'כרית מעל הברכיים מהודקת, למשוך את העקבים מתחת למושב.',
  Thigh_Adductor: 'לסגור לאט ולהחזיק שנייה, בלי לזרוק את המשקל.',
  Thigh_Abductor: 'לפתוח עד הסוף, גו נוטה מעט קדימה לישבן.',
  Standing_Calf_Raises: 'לרדת עד מתיחה מלאה בעקב, לעלות על קצות האצבעות ולהחזיק.',
  Seated_Calf_Raise: 'ברך כפופה מדגישה את הסולאוס. טווח מלא ולאט.',
  Calf_Press_On_The_Leg_Press_Machine: 'רק כריות כף הרגל על הפלטה, ברכיים כמעט ישרות.',
};

// In the sheet: how many sets and reps, how long to rest, and what to watch for.
function libHowBox(id) {
  const pr = prescFor(id), cue = !SV && CUES[id];
  if (!pr && !cue) return '';
  return `
    <div class="lib-how">
      ${pr ? `<div class="lib-presc">
        <span><b>${pr.sets}</b>${L('סטים', 'set')}</span>
        <span><b dir="ltr">${pr.range}</b>${pr.reps ? L('חזרות', 'reps') : L('החזקה', 'håll')}</span>
        <span><b>${restText(pr.rest)}</b>${L('מנוחה', 'vila')}</span>
      </div>` : ''}
      ${cue ? `<p class="lib-cue">${esc(cue)}</p>` : ''}
    </div>`;
}

// Other exercises for the same part, other equipment first: what to do when this station is taken.
function libSimilar(id) {
  const it = LIB_ITEMS.get(id);
  if (!it) return '';
  const list = LIBRARY[it.area].find(([k]) => k === it.part)[2].filter(([, x]) => x !== id)
    .sort((a, b) => (a[2] === it.eq) - (b[2] === it.eq));
  if (!list.length) return '';
  return `
    <div class="lib-h">${L('תפוס? אפשר במקום', 'Upptagen? Gör i stället')}</div>
    <div class="lib-similar">${list.map(([n, x, eq]) => `
      <button class="lib-sim" data-act="lib-ex" data-name="${esc(n)}" data-id="${esc(x)}" data-area="${esc(it.area)}">
        ${demoAnim(libImages(x))}
        <span class="lib-sim-name">${esc(exName(n))}</span>
        <span class="muted small">${EQUIP_KINDS[eq]}${inWorkout(n) ? ` · ${L('באימון', 'i passet')}` : ''}</span>
      </button>`).join('')}
    </div>`;
}

// Add to a template, for planning the next workouts: one chip per template, a check on the ones that have it.
function libTplRow(name, id) {
  if (!db.templates.length) return '';
  return `
    <div class="lib-h">${L('הוסף לתבנית', 'Lägg till i mall')}</div>
    <div class="lib-tpls">
      ${db.templates.map((t) => {
        const has = t.exercises.some((e) => e.name === name);
        return `<button class="lib-tpl ${has ? 'on' : ''}" data-act="lib-tpl" data-tpl="${esc(t.id)}" data-name="${esc(name)}" data-id="${esc(id)}" ${has ? 'disabled' : ''}>${has ? '✓ ' : '+ '}${esc(t.name)}</button>`;
      }).join('')}
    </div>`;
}

// Goes after the template's last exercise of the same body area, like in a workout. Undo in the toast.
function libAddToTemplate(tplId, name, id) {
  const t = db.templates.find((x) => x.id === tplId);
  if (!t || t.exercises.some((e) => e.name === name)) return;
  const pr = prescFor(id) || PRESC.compound;
  const row = { id: uid(), name, sets: pr.sets, reps: pr.reps || '', rest: pr.rest };
  const area = groupOf(name), at = t.exercises.map((e) => e.group || groupOf(e.name)).lastIndexOf(area);
  t.exercises.splice(at < 0 ? t.exercises.length : at + 1, 0, row);
  libKeepDemo(name, id);
  save(); renderSheet(); render();
  toast(L(`"${exName(name)}" נוסף ל"${t.name}"`, `"${exName(name)}" lades till i "${t.name}"`), 5000, { label: L('בטל', 'Ångra'), run: () => {
    const i = t.exercises.indexOf(row);
    if (i >= 0) { t.exercises.splice(i, 1); save(); renderSheet(); render(); }
  } });
}

// The library's demo becomes the exercise's demo, unless one was picked before.
function libKeepDemo(name, id, area) {
  if (db.demos[name]) return;
  const x = ui.demo?.lib?.x, m = libMuscles(id, x, name, area);
  db.demos[name] = { id, name: x?.name || id.replace(/_/g, ' '), images: libImages(id), instructions: x?.instructions || [], pm: m.p, sm: m.s };
}

// The area strip shrinks to small figures once the page scrolls, leaving room for the exercises.
window.addEventListener('scroll', () => {
  document.documentElement.classList.toggle('lib-compact', !!ui.lib && window.scrollY > 90);
}, { passive: true });

// ---------- Demos without a signal ----------
// Gym basements often have no reception. One tap saves every library demo photo and the exercise data to the
// phone, into the service worker's media cache, which it serves first and keeps across app updates.
const LIB_MEDIA = 'gym-tracker-media';
const libMediaUrls = () => [EXDB + 'dist/exercises.json', ...[...LIB_IDS].flatMap((id) => libImages(id).map(exImg))];
const libOff = { have: null, busy: false, done: 0, failed: 0 };

async function libOfflineCount() {
  if (!('caches' in window)) return;
  try {
    const c = await caches.open(LIB_MEDIA), urls = libMediaUrls();
    const hits = await Promise.all(urls.map((u) => c.match(u)));
    libOff.have = hits.filter(Boolean).length;
  } catch { libOff.have = null; }
  libOfflinePaint();
}

function libOfflineHtml() {
  if (!('caches' in window)) return '';
  const total = libMediaUrls().length;
  if (libOff.have == null && !libOff.busy) { libOfflineCount(); return ''; }
  if (libOff.busy) return `<span class="muted small">${L('שומר הדגמות…', 'Sparar demos…')} <b dir="ltr">${libOff.done}/${total}</b></span><div class="lib-off-bar"><i style="width:${Math.round(libOff.done / total * 100)}%"></i></div>`;
  if (libOff.have >= total) return `<span class="lib-off-done">✓ ${L('כל ההדגמות שמורות בטלפון ויעבדו גם בלי רשת', 'Alla demos finns på telefonen och fungerar utan nät')}</span>`;
  return `
    <div><b>${L('הדגמות בלי רשת', 'Demos utan nät')}</b><div class="muted small">${L(`${libOff.have} מתוך ${total} שמורות. שמור את כולן כדי לראות אותן גם במרתף בלי קליטה.`, `${libOff.have} av ${total} sparade. Spara alla för att se dem även utan mottagning.`)}${libOff.failed ? ` ${L(`(${libOff.failed} נכשלו)`, `(${libOff.failed} misslyckades)`)}` : ''}</div></div>
    <button class="btn sm" data-act="lib-offline">${L('שמור הכל', 'Spara alla')}</button>`;
}
const libOfflinePaint = () => { const el = $('#lib-offline'); if (el) el.innerHTML = libOfflineHtml(); };

async function libSaveOffline() {
  if (libOff.busy) return;
  const c = await caches.open(LIB_MEDIA), urls = libMediaUrls();
  libOff.busy = true; libOff.done = 0; libOff.failed = 0;
  libOfflinePaint();
  let i = 0;
  // Six at a time, in CORS mode like the <img> tags, so the cached copies serve them.
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        if (!await c.match(u)) { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) throw new Error(); await c.put(u, r); }
      } catch { libOff.failed++; }
      libOff.done++;
      if (libOff.done % 6 === 0) libOfflinePaint();
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  libOff.busy = false;
  await libOfflineCount();
  if (libOff.failed) toast(L('חלק מההדגמות לא נשמרו. נסה שוב כשיש רשת טובה.', 'Vissa demos sparades inte. Försök igen med bättre nät.'));
}

// The saved exercises as a new template, in the body-area order the app uses everywhere, each with the library's
// sets, reps and rest. Opens in the template editor, where it gets a name and can be changed before it's saved.
function libSavedToTemplate() {
  const known = new Set(allExerciseNames());
  const rows = Object.entries(libSaved()).map(([name, s]) => {
    libKeepDemo(name, s.id, s.area);
    const pr = prescFor(s.id) || PRESC.compound;
    // A new exercise takes the area it was saved from; one done before keeps its own, so its history stays put.
    return { id: uid(), name, sets: pr.sets, reps: pr.reps || '', rest: pr.rest, ...(known.has(name) ? {} : { group: s.area }) };
  }).sort((a, b) => GROUPS.indexOf(draftGroup(a)) - GROUPS.indexOf(draftGroup(b)));
  if (!rows.length) return;
  save();
  ui.lib = null;
  ui.draft = { id: uid(), name: '', exercises: rows, isNew: true };
  render(); window.scrollTo(0, 0);
}

function libToggleSave(name, id, area) {
  if (libSaved()[name]) delete libSaved()[name];
  else libSaved()[name] = { id, area };
  save();
}

// Adds an exercise to the live workout, right after the last exercise of its body area so it joins that group.
function addToWorkout(name, src = {}) {
  const list = db.active.exercises, area = groupOf(name);
  const at = list.map((x) => groupOf(x.name)).lastIndexOf(area);
  const ex = makeExercise({ ...src, name }, list.length === 0);
  list.splice(at < 0 ? list.length : at + 1, 0, ex);
  return ex;
}

function libAdd(name, id, area) {
  const isNew = !allExerciseNames().includes(name);
  if (!db.active) startWorkout(null, true); // quick start: no question, a toast with undo
  if (!db.active) return;
  // A first-time exercise counts toward the area it was picked from (dips from the triceps list count as triceps).
  // One done before keeps its area, so its history doesn't move.
  if (isNew && !db.muscles[name] && groupOf(name) !== area) db.muscles[name] = area;
  libKeepDemo(name, id, area);
  // A first time: the library's sets, reps and rest. Done before: your own last workout leads, as everywhere.
  const pr = !lastSetsFor(name) && prescFor(id);
  const ex = addToWorkout(name, pr ? { sets: pr.sets, reps: pr.reps || '', rest: pr.rest } : {}), w = db.active, y = window.scrollY;
  save();
  ui.demo = null; renderSheet();
  render();
  window.scrollTo(0, y); // stay at the card, so several can be added in a row
  // Undo takes it out again, as long as no set of it was done yet.
  toast(L(`"${exName(name)}" נוסף לאימון`, `"${exName(name)}" lades till i passet`), 5000, { label: L('בטל', 'Ångra'), run: () => {
    const i = w.exercises.indexOf(ex);
    if (db.active !== w || i < 0 || ex.sets.some((s) => s.done)) return;
    w.exercises.splice(i, 1);
    save(); render(); window.scrollTo(0, y);
  } });
}
