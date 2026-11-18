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
    </div>`;
}

// One part of an area: a figure with that part lit, its name, and its exercises.
// Working sets in the last 7 days (the live workout included), per body area and per part of one, so the parts
// you've skipped stand out. A set counts toward a part when the exercise's main muscles name it or its whole muscle.
let libWk = null;
function libWeek() {
  const since = Date.now() - 7 * 86400000, area = new Map(), part = new Map();
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
      for (const k of keys) if (hits(p, k)) part.set(k, (part.get(k) || 0) + n);
    }
  }
  return { area, part };
}
// "8/10": this week's sets against the low end of the area's weekly target; low until it's reached.
function areaWeekTag(a) {
  const n = libWk?.area.get(a) || 0, lo = AREA_TARGET[a]?.[0];
  return lo ? `<span class="lib-wk ${n >= lo ? 'ok' : n ? 'low' : 'none'}" dir="ltr">${n}/${lo}</span>` : '';
}

function libSection(area, [part, side, all], hist) {
  const list = all.filter(([, , eq]) => eqOk(eq));
  if (!list.length) return '';
  return `
    <section class="lib-sec">
      <div class="lib-sec-head">
        <span class="lib-sec-fig">${bodyFig(side, { p: [part], s: [] })}</span>
        <div><h2>${esc(partName(part))}</h2><span class="muted small">${list.length} ${L('תרגילים', 'övningar')}</span>${(() => {
          const n = libWk?.part.get(part) || 0;
          return n ? `<span class="lib-sec-wk">${L(`${n} סטים ב-7 ימים`, `${n} set på 7 dagar`)}</span>`
            : `<span class="lib-sec-wk none">${L('לא אומן ב-7 ימים', 'Inte tränad på 7 dagar')}</span>`;
        })()}</div>
      </div>
      <div class="lib-grid">${list.map(([n, id, eq]) => libCard(n, id, area, EQUIP_KINDS[eq], false, hist)).join('')}</div>
    </section>`;
}

function viewLibrary() {
  const lb = ui.lib, area = lb.area, hist = libHistory();
  libWk = libWeek();
  const strip = `
    <div class="lib-areas" role="tablist">
      <button class="lib-area ${area === 'saved' ? 'on' : ''}" data-act="lib-area" data-a="saved" role="tab" aria-selected="${area === 'saved'}">
        <span class="lib-fig lib-bm">${BOOKMARK}</span><span>${L('שמורים', 'Sparade')}</span>
      </button>
      ${LIB_AREAS.map(([a, side]) => `
        <button class="lib-area ${a === area ? 'on' : ''}" data-act="lib-area" data-a="${a}" role="tab" aria-selected="${a === area}">
          <span class="lib-fig">${bodyFig(side, { p: GROUP_MUSCLES[a] || [], s: [] })}</span><span>${gName(a)}</span>${areaWeekTag(a)}
        </button>`).join('')}
    </div>`;

  let body;
  if (area === 'saved') {
    const list = Object.entries(libSaved());
    body = list.length
      ? `<div class="lib-grid" style="margin-top:14px">${list.map(([n, s]) => {
        const it = LIB_ITEMS.get(s.id);
        return libCard(n, s.id, s.area, it ? partName(it.part) : gName(s.area), !it, hist);
      }).join('')}</div>`
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
    if (!lb.more) more = `<button class="btn ghost block" data-act="lib-more">${L('עוד תרגילים מהמאגר (באנגלית)', 'Fler övningar från databasen (på engelska)')}</button>`;
    else if (lb.moreErr) more = `<p class="muted small">${L('אין חיבור לאינטרנט. המאגר צריך רשת.', 'Ingen internetanslutning. Databasen behöver nätet.')}</p>`;
    else if (!lb.extra) more = '<div class="center" style="padding:24px 0"><div class="spinner"></div></div>';
    else more = `<h2>${L('עוד מהמאגר', 'Mer från databasen')}</h2><div class="lib-grid">${lb.extra.filter((x) => eqOk(DB_EQUIP[x.equipment] || 'w')).map((x) => libCard(x.name, x.id, area, EQUIP_KINDS[DB_EQUIP[x.equipment] || 'w'], true, hist)).join('')}</div>`;
    const none = `<p class="muted" style="margin-top:16px">${L(`אין כאן תרגילים עם ${EQUIP_KINDS[ui.libEq]}.`, `Inga övningar med ${EQUIP_KINDS[ui.libEq]} här.`)} <button class="link-btn" data-act="lib-eq" data-k="${ui.libEq}">${L('הצג הכל', 'Visa alla')}</button></p>`;
    body = `${chips}${sections || none}${lb.part ? '' : more}`;
  }
  return `
    ${strip}
    ${body}
    <button class="btn block" data-act="lib-close">${db.active ? L('חזרה לאימון', 'Tillbaka till passet') : L('חזרה', 'Tillbaka')}</button>`;
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
async function openLibEx(name, id, area) {
  const d = { name, lib: { id, area, x: null } };
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
  const here = inWorkout(d.name), saved = !!libSaved()[d.name];
  return `
    <div class="sheet-panel" data-act="none" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="row between" style="margin-bottom:12px">
        <h3 class="grow" ${english ? 'dir="ltr"' : ''}>${esc(english ? d.name : exName(d.name))}</h3>
        <button class="icon-btn" data-act="demo-close" aria-label="${L('סגור', 'Stäng')}">✕</button>
      </div>
      ${demoAnim(libImages(id), true)}
      <div class="row" style="margin-top:12px">
        <button class="btn sm lib-save-btn ${saved ? 'on' : ''}" data-act="lib-save" data-name="${esc(d.name)}" data-id="${esc(id)}" data-area="${esc(area)}">${BOOKMARK}${saved ? L('נשמר', 'Sparad') : L('שמור', 'Spara')}</button>
        ${here ? `<span class="muted small">${L('✓ כבר באימון', '✓ Redan i passet')}</span>`
          : `<button class="btn sm primary" data-act="lib-add" data-name="${esc(d.name)}" data-id="${esc(id)}" data-area="${esc(area)}">${db.active ? L('+ הוסף לאימון', '+ Lägg till i passet') : L('התחל אימון עם התרגיל', 'Starta ett pass med övningen')}</button>`}
      </div>
      ${libMineBox(d.name)}
      <h3 style="margin-top:16px">${L('שרירי מטרה', 'Målmuskler')}</h3>
      ${m.p.length ? `
        <div class="lib-target">
          ${bodySvg('front', m, L('קדימה', 'Framsida'))}${bodySvg('back', m, L('אחורה', 'Baksida'))}
        </div>
        <div class="muscle-list">
          <div><i class="dot mp"></i><b>${L('ראשי:', 'Primära:')}</b> ${esc(muscleNames(m.p))}</div>
          ${m.s.length ? `<div><i class="dot ms"></i><b>${L('משני:', 'Sekundära:')}</b> ${esc(muscleNames(m.s))}</div>` : ''}
        </div>` : `<p class="muted small">${L('אין מידע על השרירים.', 'Ingen muskelinformation.')}</p>`}
      ${x ? `<div class="demo-en" dir="ltr">${esc(x.name)}${x.equipment ? ` · ${esc(x.equipment)}` : ''}</div>` : ''}
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
      <div class="row between"><b>${L('הפעם האחרונה שלך', 'Senast du gjorde den')}</b><span class="muted small">${mine ? esc(agoText(mine.t)) : ''}</span></div>
      <div class="chips">${last.map((s) => `<span class="chip">${esc(setText(s))}</span>`).join('')}</div>
      <div class="muted small" style="margin-top:6px">
        ${mine ? L(`עשית ${mine.n} פעמים`, `Gjort ${mine.n} gånger`) : ''}${maxW && num(maxW.w) ? ` · ${L('שיא', 'Rekord')} <b dir="ltr">${esc(setText(maxW))}</b>` : ''}${maxE ? ` · 1RM ≈ <b dir="ltr">${Math.round(maxE)}</b>` : ''}
      </div>
    </div>`;
}

function libToggleSave(name, id, area) {
  if (libSaved()[name]) delete libSaved()[name];
  else libSaved()[name] = { id, area };
  save();
}

// Adds an exercise to the live workout, right after the last exercise of its body area so it joins that group.
function addToWorkout(name) {
  const list = db.active.exercises, area = groupOf(name);
  const at = list.map((x) => groupOf(x.name)).lastIndexOf(area);
  list.splice(at < 0 ? list.length : at + 1, 0, makeExercise({ name }, list.length === 0));
}

function libAdd(name, id, area) {
  const isNew = !allExerciseNames().includes(name);
  if (!db.active) startWorkout(null, true); // quick start: no question, a toast with undo
  if (!db.active) return;
  // A first-time exercise counts toward the area it was picked from (dips from the triceps list count as triceps).
  // One done before keeps its area, so its history doesn't move.
  if (isNew && !db.muscles[name] && groupOf(name) !== area) db.muscles[name] = area;
  // The library's demo becomes the exercise's demo, unless one was picked before.
  if (!db.demos[name]) {
    const x = ui.demo?.lib?.x, m = libMuscles(id, x, name, area);
    db.demos[name] = { id, name: x?.name || id.replace(/_/g, ' '), images: libImages(id), instructions: x?.instructions || [], pm: m.p, sm: m.s };
  }
  addToWorkout(name);
  save();
  ui.demo = null; renderSheet();
  render();
  toast(L(`"${exName(name)}" נוסף לאימון`, `"${exName(name)}" lades till i passet`));
}
