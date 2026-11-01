'use strict';

// ---------- Storage ----------
const KEY = 'gym-tracker-v1';
const TIMER_KEY = 'gym-tracker-timer';
const DEFAULT_SETTINGS = { defaultRest: 90, lastSetFail: true, musicApp: 'spotify' };
const WEIGHT_STEP = 2.5;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);

function seed() {
  const ex = (name, sets, reps, rest) => ({ id: uid(), name, sets, reps, rest });
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    templates: [
      {
        id: uid(), name: 'אימון A – פלג גוף עליון', exercises: [
          ex('לחיצת חזה במוט', 4, 8, 120), ex('חתירה במוט', 4, 8, 120), ex('לחיצת כתפיים במשקולות', 3, 10, 90),
          ex('מתח', 3, 8, 90), ex('כפיפת מרפקים', 3, 12, 60), ex('פשיטת מרפקים בכבל', 3, 12, 60),
        ],
      },
      {
        id: uid(), name: 'אימון B – פלג גוף תחתון', exercises: [
          ex('סקוואט', 4, 6, 150), ex('דדליפט רומני', 3, 8, 120), ex('לחיצת רגליים', 3, 10, 90),
          ex('מכרעים', 3, 10, 90), ex('הרמת עקבים', 4, 12, 60),
        ],
      },
    ],
    workouts: [],
    metrics: [],
    active: null,
  };
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.templates) && Array.isArray(d.workouts)) {
      d.settings = { ...DEFAULT_SETTINGS, ...d.settings };
      return d;
    }
  } catch { /* fall through to seed */ }
  return seed();
}

let db = load();
if (!Array.isArray(db.metrics)) db.metrics = [];
if (!db.muscles || typeof db.muscles !== 'object') db.muscles = {}; // exercise name -> body area, when set by hand
if (!db.demos || typeof db.demos !== 'object') db.demos = {}; // exercise name -> chosen technique demo
if (!db.alts || typeof db.alts !== 'object') db.alts = {}; // exercise name -> alternatives used when it's taken

// ---------- Body areas ----------
const GROUPS = ['חזה', 'גב', 'כתפיים', 'רגליים', 'יד קדמית', 'יד אחורית', 'בטן', 'אחר'];
const GROUP_HINTS = [
  ['רגליים', /סקוואט|רגל|מכרע|עקב|ירך|לאנג|דדליפט|היפ|ישבן|תאומ|גובלט/],
  ['חזה', /חזה|פרפר|מקבילים|שכיבות סמיכה|פלאי/],
  ['גב', /חתיר|מתח|פולי|גב|פול ?אובר|שראג|משיכ/],
  ['כתפיים', /כתפ|הרחק|פייס|ארנולד/],
  ['יד קדמית', /כפיפת מרפק|כפיפות מרפק|בייספס|יד קדמית|פטיש/],
  ['יד אחורית', /פשיטת מרפק|פשיטות מרפק|טרייספס|יד אחורית|פרנץ|סקאל/],
  ['בטן', /בטן|פלאנק|כפיפות גו|קראנץ|הרמות רגליים בתלייה/],
];
// Common exercises per area, offered as alternatives when the station for an exercise is taken.
const ALT_POOL = {
  'חזה': ['לחיצת חזה במוט', 'לחיצת חזה במשקולות', 'לחיצת חזה בשיפוע במשקולות', 'לחיצת חזה במכונה', 'פרפר בכבל', 'פק דק', 'מקבילים', 'שכיבות סמיכה'],
  'גב': ['חתירה במוט', 'חתירה במשקולת', 'פולי עליון', 'פולי תחתון', 'מתח', 'חתירה במכונה', 'פול אובר בכבל'],
  'כתפיים': ['לחיצת כתפיים במשקולות', 'לחיצת כתפיים במכונה', 'לחיצה צבאית', 'הרחקה לצדדים', 'הרחקה לצדדים בכבל', 'פייס פול', 'פרפר הפוך'],
  'רגליים': ['סקוואט', 'לחיצת רגליים', 'סקוואט בסמית', 'סקוואט גובלט', 'מכרעים', 'סקוואט בולגרי', 'דדליפט רומני', 'כפיפת ברכיים', 'פשיטת ברכיים', 'היפ טראסט', 'הרמת עקבים'],
  'יד קדמית': ['כפיפת מרפקים', 'כפיפת מרפקים במשקולות', 'כפיפת מרפקים בכבל', 'פטיש'],
  'יד אחורית': ['פשיטת מרפקים בכבל', 'פרנץ', 'סקאל קראשר', 'מקבילים', 'פשיטת מרפקים מעל הראש בכבל'],
  'בטן': ['פלאנק', 'כפיפות בטן', 'הרמות רגליים בתלייה', 'כפיפות בטן בכבל'],
};
// Stretches per area: dynamic ones to warm up before the workout, static holds to cool down after it.
// img is the free-exercise-db id (its two photos play like a GIF); hold is in seconds; sides: done on each
// side, so it takes twice as long.
const st = (img, name, hold, how, sides = false) => ({ id: img, img, name, hold, how, sides });
const STRETCHES = {
  pre: {
    'חזה': [
      st('Dynamic_Chest_Stretch', 'פתיחת ידיים דינמית', 30, 'ידיים ישרות קדימה, פתח אותן לאחור כמה שאפשר וחזור – כמו מחיאת כפיים מוגזמת.'),
      st('Arm_Circles', 'סיבובי ידיים', 30, 'ידיים ישרות לצדדים, עיגולים קטנים שהולכים וגדלים. החלף כיוון באמצע.'),
    ],
    'גב': [
      st('Dynamic_Back_Stretch', 'הנפות ידיים למעלה', 30, 'ידיים ישרות, הנף אותן מלפנים עד מעל הראש, כל פעם קצת יותר גבוה.'),
      st('Cat_Stretch', 'חתול-פרה', 30, 'על שש, עגל גב למעלה ואז קשת למטה, לאט עם הנשימה.'),
    ],
    'כתפיים': [
      st('Shoulder_Circles', 'סיבובי כתפיים', 30, 'ידיים רפויות, גלגל כתפיים קדימה, למעלה, אחורה ולמטה. ואז הפוך.'),
      st('Arm_Circles', 'סיבובי ידיים', 30, 'ידיים ישרות לצדדים, עיגולים קטנים שהולכים וגדלים. החלף כיוון באמצע.'),
      st('Round_The_World_Shoulder_Stretch', 'העברת מקל מעל הראש', 30, 'אחיזה רחבה במקל, העבר אותו לאט מלפנים אל מאחורי הגב וחזרה.'),
    ],
    'רגליים': [
      st('Front_Leg_Raises', 'הנפות רגל', 20, 'החזק במשהו, הנף רגל ישרה קדימה ואחורה, כל פעם קצת יותר רחוק.', true),
      st('Standing_Hip_Circles', 'סיבובי ירך', 20, 'עמוד על רגל אחת, הרם ברך ל־90° וצייר איתה עיגול גדול החוצה.', true),
      st('Worlds_Greatest_Stretch', 'המתיחה הכי טובה בעולם', 30, 'לאנג׳ עמוק, מרפק לכיוון הקרסול הקדמי, ואז סובב ופתח את היד לתקרה.', true),
    ],
    'יד קדמית': [
      st('Elbow_Circles', 'סיבובי מרפקים', 30, 'ידיים על הכתפיים, מרפקים לצדדים, צייר עיגולים גדולים עם המרפקים.'),
      st('Wrist_Circles', 'סיבובי שורש כף יד', 20, 'ידיים לצדדים, סובב את כפות הידיים בעיגולים לשני הכיוונים.'),
    ],
    'יד אחורית': [
      st('Elbow_Circles', 'סיבובי מרפקים', 30, 'ידיים על הכתפיים, מרפקים לצדדים, צייר עיגולים גדולים עם המרפקים.'),
      st('Arm_Circles', 'סיבובי ידיים', 30, 'ידיים ישרות לצדדים, עיגולים קטנים שהולכים וגדלים. החלף כיוון באמצע.'),
    ],
    'בטן': [
      st('Torso_Rotation', 'סיבובי גו', 30, 'ידיים ישרות קדימה (אפשר עם כדור), סובב את הגו מצד לצד, אגן נשאר במקום.'),
      st('Windmills', 'טחנות רוח בשכיבה', 30, 'על הגב, ידיים לצדדים. העבר רגל מעל הגוף לכיוון היד הנגדית, וחזור.'),
    ],
  },
  post: {
    'חזה': [
      st('Elbows_Back', 'מרפקים לאחור', 30, 'ידיים על הגב התחתון, משוך מרפקים לאחור כאילו הם נוגעים זה בזה.'),
      st('Chest_And_Front_Of_Shoulder_Stretch', 'מקל מאחורי הראש', 30, 'אחיזה רחבה במקל, הרם אותו לאט למעלה ומאחורי הראש עד מתיחה בחזה.'),
    ],
    'גב': [
      st('Childs_Pose', 'תנוחת הילד', 40, 'ברכיים על הרצפה, ישבן לעקבים, ידיים מושטות קדימה.'),
      st('One_Arm_Against_Wall', 'לטס על הקיר', 30, 'מרפק כפוף על הקיר או המשקוף, השען את הגוף לכיוונו עד מתיחה בצד הגב.', true),
      st('Upper_Back_Stretch', 'עיגול גב עליון', 30, 'שלב אצבעות, עגל כתפיים ודחוף את הידיים קדימה.'),
    ],
    'כתפיים': [
      st('Shoulder_Stretch', 'יד על החזה', 30, 'משוך יד ישרה לרוחב החזה עם היד השנייה, כתף למטה.', true),
      st('Overhead_Stretch', 'מתיחה למעלה', 30, 'שלב אצבעות, כפות לתקרה, ידיים ישרות למעלה וכתפיים למטה.'),
    ],
    'רגליים': [
      st('Standing_Elevated_Quad_Stretch', 'ארבע ראשי על ספסל', 30, 'גב לספסל, כף רגל אחורית עליו, כופף קלות את הרגל הקדמית ודחוף אגן קדימה.', true),
      st('Seated_Floor_Hamstring_Stretch', 'המסטרינג בישיבה', 30, 'רגל אחת ישרה, השנייה כפופה, גב ישר והתכופף מהירך לכיוון הקרסול.', true),
      st('Kneeling_Hip_Flexor', 'כופף ירך בכריעה', 30, 'ברך אחורית על הרצפה, כווץ ישבן והעבר משקל קדימה.', true),
      st('Ankle_On_The_Knee', 'ישבן בשכיבה (ארבע)', 30, 'קרסול על הברך השנייה, משוך את הירך התחתונה לחזה.', true),
      st('Calf_Stretch_Hands_Against_Wall', 'תאומים על הקיר', 30, 'ידיים על הקיר, רגל אחורית ישרה ועקב צמוד לרצפה.', true),
    ],
    'יד קדמית': [
      st('Standing_Biceps_Stretch', 'ידיים שלובות מאחור', 30, 'שלב ידיים מאחורי הגב, ישר מרפקים, סובב כפות למטה והרם לאט.'),
      st('Kneeling_Forearm_Stretch', 'אמה בכריעה', 20, 'כפות על הרצפה ואצבעות לכיוון הברכיים, השען לאחור לאט.'),
    ],
    'יד אחורית': [
      st('Triceps_Stretch', 'יד אחורית מאחורי הראש', 30, 'יד מאחורי הראש, משוך את המרפק בעדינות עם היד השנייה.', true),
    ],
    'בטן': [
      st('Overhead_Stretch', 'מתיחת גו למעלה', 30, 'שלב אצבעות, כפות לתקרה, ידיים ישרות למעלה וכתפיים למטה.'),
      st('Standing_Lateral_Stretch', 'כפיפה צידית', 20, 'יד אחת על המותן, השנייה מאחורי הראש, התכופף לצד בלי להסתובב.', true),
    ],
  },
};
const STRETCH_DEFAULT = { pre: ['Arm_Circles', 'Front_Leg_Raises', 'Cat_Stretch'], post: ['Childs_Pose', 'Seated_Floor_Hamstring_Stretch', 'Elbows_Back'] };
const findStretch = (phase, id) => Object.values(STRETCHES[phase]).flat().find((x) => x.id === id);
const stretchSecs = (x) => (x ? x.hold * (x.sides ? 2 : 1) : 0);
const stretchImages = (x) => [`${x.img}/0.jpg`, `${x.img}/1.jpg`];

// Stretches for the areas worked in this workout, in exercise order: two per area, three for legs.
function stretchesFor(w, phase) {
  const groups = [...new Set(w.exercises.map((e) => groupOf(e.swapOf || e.name)))].filter((g) => STRETCHES[phase][g]);
  const list = groups.length
    ? groups.flatMap((g) => STRETCHES[phase][g].slice(0, g === 'רגליים' ? 3 : 2))
    : STRETCH_DEFAULT[phase].map((id) => findStretch(phase, id));
  return [...new Map(list.map((x) => [x.id, x])).values()].slice(0, 9);
}

// Per-phase state on the active workout: which stretches are done, and whether the section is folded away.
function stretchState(w) {
  if (!w.stretch || Array.isArray(w.stretch)) w.stretch = { pre: [], post: [] };
  if (!w.fold) w.fold = { pre: false, post: false };
  return w.stretch;
}

// Check a stretch off (or back on). Finishing the last one folds the section away.
function markStretch(w, phase, id, on) {
  const s = stretchState(w);
  s[phase] = on ? [...new Set([...s[phase], id])] : s[phase].filter((x) => x !== id);
  if (on && stretchesFor(w, phase).every((x) => s[phase].includes(x.id))) w.fold[phase] = true;
}
const guessGroup = (name) => (GROUP_HINTS.find(([, re]) => re.test(name || '')) || ['אחר'])[0];
const groupOf = (name) => db.muscles[name] || guessGroup(name);
// Template-editor exercises can carry an area picked in the editor before it's saved.
const draftGroup = (e) => e.group || groupOf(e.name);
// Indices grouped by body area, areas in order of first appearance, exercise order kept within each area.
function areaRuns(list, areaOf) {
  const runs = new Map();
  list.forEach((x, i) => { const a = areaOf(x); if (!runs.has(a)) runs.set(a, []); runs.get(a).push(i); });
  return [...runs];
}
const areaDivider = (area, n) => `<div class="area-div"><b>${area}</b><span>${n === 1 ? 'תרגיל אחד' : `${n} תרגילים`}</span></div>`;

// ---------- Muscles worked ----------
// Muscle keys are free-exercise-db's, so a picked demo's own muscle list can be used as is.
const MUSCLE_NAMES = {
  chest: 'חזה', shoulders: 'כתפיים', triceps: 'יד אחורית', biceps: 'יד קדמית', forearms: 'אמות', abdominals: 'בטן',
  lats: 'רחב גבי', 'middle back': 'גב אמצעי', 'lower back': 'גב תחתון', traps: 'טרפזים', neck: 'צוואר',
  quadriceps: 'ארבע ראשי', hamstrings: 'המסטרינג', glutes: 'ישבן', calves: 'תאומים', adductors: 'מקרבים', abductors: 'מרחיקים',
};
// [name pattern, primary, secondary], most specific first.
const MUSCLE_HINTS = [
  [/פרפר הפוך|פייס פול/, ['shoulders'], ['traps', 'middle back']],
  [/מקבילים/, ['triceps', 'chest'], ['shoulders']],
  [/פרפר|פק דק|פלאי/, ['chest'], ['shoulders']],
  [/חזה|שכיבות סמיכה/, ['chest'], ['shoulders', 'triceps']],
  [/הרחק/, ['shoulders'], ['traps']],
  [/כתפ|צבאית|ארנולד/, ['shoulders'], ['triceps', 'traps']],
  [/שראג/, ['traps'], ['forearms']],
  [/פול ?אובר/, ['lats'], ['chest', 'triceps']],
  [/מתח|פולי עליון/, ['lats'], ['biceps', 'middle back']],
  [/חתיר|פולי תחתון/, ['middle back', 'lats'], ['biceps', 'traps', 'shoulders']],
  [/פלאנק/, ['abdominals'], ['shoulders', 'lower back']],
  [/בטן|כפיפות גו|קראנץ|הרמות רגליים/, ['abdominals'], []],
  [/רומני|RDL|גוד מורנינג/i, ['hamstrings', 'glutes'], ['lower back']],
  [/דדליפט/, ['lower back', 'glutes', 'hamstrings'], ['quadriceps', 'traps', 'forearms']],
  [/היפ|גשר/, ['glutes'], ['hamstrings']],
  [/פשיטת ברכ/, ['quadriceps'], []],
  [/כפיפת ברכ/, ['hamstrings'], ['calves']],
  [/עקב|תאומ/, ['calves'], []],
  [/מקרב/, ['adductors'], []],
  [/מרחיק/, ['abductors'], ['glutes']],
  [/סקוואט|לחיצת רגליים|מכרע|לאנג|האק|גובלט/, ['quadriceps', 'glutes'], ['hamstrings', 'adductors']],
  [/פטיש/, ['biceps', 'forearms'], []],
  [/כפיפת מרפק|כפיפות מרפק|בייספס/, ['biceps'], ['forearms']],
  [/פשיטת מרפק|פשיטות מרפק|טרייספס|פרנץ|סקאל/, ['triceps'], []],
];
// When the name says nothing more specific: what the body area mostly works.
const AREA_MUSCLES = {
  'חזה': [['chest'], ['shoulders', 'triceps']], 'גב': [['lats', 'middle back'], ['biceps', 'traps']],
  'כתפיים': [['shoulders'], ['triceps', 'traps']], 'רגליים': [['quadriceps', 'glutes'], ['hamstrings', 'calves']],
  'יד קדמית': [['biceps'], ['forearms']], 'יד אחורית': [['triceps'], []], 'בטן': [['abdominals'], []],
};
// The chosen demo's muscles if it has them, else the name's, else the body area's.
function musclesFor(name, area = groupOf(name)) {
  const d = db.demos[name];
  if (d?.pm?.length) return { p: d.pm, s: (d.sm || []).filter((m) => !d.pm.includes(m)) };
  const hit = MUSCLE_HINTS.find(([re]) => re.test(name || ''));
  const [p, s] = hit ? hit.slice(1) : AREA_MUSCLES[area] || [[], []];
  return { p, s };
}

// Front and back figures; each part is tagged with the muscle it stands for.
const BODY_FRONT = [
  ['', '<circle cx="25" cy="8" r="5.5"/><rect x="22.5" y="13" width="5" height="4"/><path d="M18 47h14l1.5 6h-17z"/><circle cx="7" cy="56" r="2.3"/><circle cx="43" cy="56" r="2.3"/><ellipse cx="20" cy="83" rx="3" ry="2.5"/><ellipse cx="30" cy="83" rx="3" ry="2.5"/><ellipse cx="19.5" cy="110" rx="3.2" ry="2"/><ellipse cx="30.5" cy="110" rx="3.2" ry="2"/>'],
  ['traps', '<path d="M19.5 18l3-1.5h5l3 1.5-2 1.5h-7z"/>'],
  ['shoulders', '<ellipse cx="13.5" cy="21.5" rx="4.8" ry="4.3"/><ellipse cx="36.5" cy="21.5" rx="4.8" ry="4.3"/>'],
  ['chest', '<rect x="16.5" y="19" width="8.2" height="10.5" rx="3"/><rect x="25.3" y="19" width="8.2" height="10.5" rx="3"/>'],
  ['biceps', '<ellipse cx="10.5" cy="32" rx="3.2" ry="6.8"/><ellipse cx="39.5" cy="32" rx="3.2" ry="6.8"/>'],
  ['forearms', '<ellipse cx="8.3" cy="46" rx="2.8" ry="7"/><ellipse cx="41.7" cy="46" rx="2.8" ry="7"/>'],
  ['abdominals', '<rect x="18.5" y="30.5" width="13" height="16" rx="3"/>'],
  ['quadriceps', '<ellipse cx="20" cy="68" rx="4.6" ry="12"/><ellipse cx="30" cy="68" rx="4.6" ry="12"/>'],
  ['adductors', '<ellipse cx="23.6" cy="62" rx="1.5" ry="6"/><ellipse cx="26.4" cy="62" rx="1.5" ry="6"/>'],
  ['calves', '<ellipse cx="19.8" cy="96" rx="3" ry="10"/><ellipse cx="30.2" cy="96" rx="3" ry="10"/>'],
];
const BODY_BACK = [
  ['', '<circle cx="25" cy="8" r="5.5"/><circle cx="7" cy="56" r="2.3"/><circle cx="43" cy="56" r="2.3"/><ellipse cx="20" cy="83" rx="3" ry="2.5"/><ellipse cx="30" cy="83" rx="3" ry="2.5"/><ellipse cx="19.5" cy="110" rx="3.2" ry="2"/><ellipse cx="30.5" cy="110" rx="3.2" ry="2"/>'],
  ['shoulders', '<ellipse cx="13.5" cy="21.5" rx="4.8" ry="4.3"/><ellipse cx="36.5" cy="21.5" rx="4.8" ry="4.3"/>'],
  ['lats', '<path d="M16.5 24l4.5 3.5 1.5 13-4.5-1.5q-3-7-1.5-15z"/><path d="M33.5 24l-4.5 3.5-1.5 13 4.5-1.5q3-7 1.5-15z"/>'],
  ['middle back', '<rect x="21.5" y="25" width="7" height="11" rx="2"/>'],
  ['traps', '<path d="M22.5 13h5v3l3.5 2-6 8-6-8 3.5-2z"/>'],
  ['lower back', '<rect x="20.5" y="37" width="9" height="9.5" rx="2.5"/>'],
  ['triceps', '<ellipse cx="10.5" cy="32" rx="3.2" ry="6.8"/><ellipse cx="39.5" cy="32" rx="3.2" ry="6.8"/>'],
  ['forearms', '<ellipse cx="8.3" cy="46" rx="2.8" ry="7"/><ellipse cx="41.7" cy="46" rx="2.8" ry="7"/>'],
  ['glutes', '<ellipse cx="21" cy="53" rx="4.6" ry="5.5"/><ellipse cx="29" cy="53" rx="4.6" ry="5.5"/>'],
  ['abductors', '<ellipse cx="15.8" cy="54" rx="1.5" ry="4.5"/><ellipse cx="34.2" cy="54" rx="1.5" ry="4.5"/>'],
  ['hamstrings', '<ellipse cx="20.3" cy="70" rx="4.3" ry="10"/><ellipse cx="29.7" cy="70" rx="4.3" ry="10"/>'],
  ['calves', '<ellipse cx="19.8" cy="94" rx="3.4" ry="9"/><ellipse cx="30.2" cy="94" rx="3.4" ry="9"/>'],
];
// Drawn on top so the two sides read apart at a glance: a face and navel in front, hair and spine behind.
const BODY_MARKS = {
  front: '<circle cx="23" cy="7.5" r=".8"/><circle cx="27" cy="7.5" r=".8"/><path d="M23.3 10.6q1.7 1.2 3.4 0" fill="none"/><circle cx="25" cy="42" r=".7"/>',
  back: '<path class="hair" d="M19.5 8.5a5.5 5.5 0 0 1 11 0q-1 3.5-5.5 4.2-4.5-.7-5.5-4.2z"/><path d="M25 17v30" fill="none"/>',
};
const bodySvg = (parts, m, side, label) => `
  <figure class="body-fig">
    <svg viewBox="0 0 50 114">${parts.map(([k, shapes]) =>
      `<g class="${m.p.includes(k) ? 'mp' : m.s.includes(k) ? 'ms' : ''}">${shapes}</g>`).join('')}<g class="marks">${BODY_MARKS[side]}</g></svg>
    <figcaption>${label}</figcaption>
  </figure>`;
const muscleNames = (list) => list.map((k) => MUSCLE_NAMES[k] || k).join(', ');
function muscleMap(name, area) {
  const m = musclesFor(name, area);
  if (!m.p.length) return '';
  return `
    <div class="muscles">
      <div class="muscle-figs" aria-hidden="true">${bodySvg(BODY_FRONT, m, 'front', 'קדימה')}${bodySvg(BODY_BACK, m, 'back', 'אחורה')}</div>
      <div class="muscle-list">
        <div><i class="dot mp"></i><b>ראשי:</b> ${esc(muscleNames(m.p))}</div>
        ${m.s.length ? `<div><i class="dot ms"></i><b>משני:</b> ${esc(muscleNames(m.s))}</div>` : ''}
      </div>
    </div>`;
}

// Saved alternatives first, then exercises from the same body area (ones done before ahead of the stock list).
function altsFor(name) {
  const g = groupOf(name);
  const inWorkout = new Set((db.active?.exercises || []).map((e) => e.name));
  const known = allExerciseNames().filter((n) => groupOf(n) === g);
  const list = [...(db.alts[name] || []), ...known, ...(ALT_POOL[g] || [])];
  return [...new Set(list)].filter((n) => n && n !== name && !inWorkout.has(n)).slice(0, 10);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('שגיאה בשמירת הנתונים'); }
}

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- Helpers ----------
const ui = { tab: 'workout', draft: null, progEx: null, progMetric: 'e1rm', mdraft: null, bodyMetric: 'pbf', reading: false, pasteOpen: false, pasteText: '', recsOpen: false, recLoading: false };

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmtW = (w) => (Math.round(w * 100) / 100).toString();
const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const setLabel = (s) => (s.w ? `${fmtW(s.w)} × ${s.r}` : `${s.r} חזרות`);

function fmtDur(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
const fmtDate = (ts) => new Date(ts).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
const fmtDateShort = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

const sortedWorkouts = () => [...db.workouts].sort((a, b) => b.start - a.start);

// Working sets only — warmup sets (wu: true) don't count toward records, volume or progress.
const work = (sets) => sets.filter((s) => !s.wu);

function lastSetsFor(name) {
  for (const w of sortedWorkouts()) {
    const e = w.exercises.find((x) => x.name === name);
    const sets = e && work(e.sets);
    if (sets && sets.length) return sets;
  }
  return null;
}

function lastWarmupFor(name) {
  for (const w of sortedWorkouts()) {
    const s = w.exercises.find((x) => x.name === name)?.sets.find((x) => x.wu);
    if (s) return s;
  }
  return null;
}

function bestFor(name) {
  let maxW = null, maxE = 0;
  for (const w of db.workouts) {
    for (const e of w.exercises) {
      if (e.name !== name) continue;
      for (const s of work(e.sets)) {
        if (!maxW || s.w > maxW.w || (s.w === maxW.w && s.r > maxW.r)) maxW = s;
        maxE = Math.max(maxE, e1rm(s.w, s.r));
      }
    }
  }
  return { maxW, maxE };
}

function allExerciseNames() {
  const count = new Map();
  for (const w of sortedWorkouts()) for (const e of w.exercises) count.set(e.name, (count.get(e.name) || 0) + 1);
  for (const t of db.templates) for (const e of t.exercises) if (!count.has(e.name)) count.set(e.name, 0);
  return [...count.keys()];
}

const datalist = () => `<datalist id="exnames">${allExerciseNames().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`;

const volume = (w) => w.exercises.reduce((sum, e) => sum + work(e.sets).reduce((a, s) => a + s.w * s.r, 0), 0);
const chip = (s, cls = '') => (s.wu
  ? `<span class="chip wu"><span dir="rtl">חימום</span> ${setLabel(s)}</span>`
  : `<span class="chip ${cls} ${s.fail ? 'fail' : ''}">${setLabel(s)}${s.fail ? ' <span dir="rtl">כשל</span>' : ''}</span>`);
// Inline (non-chip) version for the "last time" line.
const prevLabel = (s) => `<span dir="ltr">${setLabel(s)}</span>${s.fail ? ' <span class="t-fail">כשל</span>' : ''}`;

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- Views ----------
function viewWeek() {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const trained = new Set(db.workouts.map((w) => new Date(w.start).toDateString()));
  let count = 0;
  const cells = days.map((d, i) => {
    const day = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const on = trained.has(day.toDateString());
    if (on) count++;
    const today = day.toDateString() === now.toDateString();
    return `<div class="${today ? 'today' : ''}"><span class="${on ? 'on' : ''}"></span>${d}</div>`;
  }).join('');
  return `<div class="card"><div class="row between"><h3>השבוע</h3><span class="muted small">${count === 1 ? 'אימון אחד' : `${count} אימונים`}</span></div><div class="week">${cells}</div></div>`;
}

// ---------- Workout music ----------
// Each genre opens a playlist search in the chosen app, so the top results are that service's own workout playlists.
const MUSIC_APPS = [['spotify', 'Spotify'], ['apple', 'Apple Music'], ['youtube', 'YouTube']];
const GENRES = [
  ['היפ הופ וראפ', 'hip hop rap workout'],
  ['טכנו', 'techno workout'],
  ['הארדסטייל', 'hardstyle workout'],
  ['מוטיבציה', 'workout motivation'],
  ['EDM', 'edm workout'],
  ['רוק ומטאל', 'rock metal workout'],
  ['פופ', 'pop workout'],
  ['פונק', 'phonk gym'],
];
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
function musicUrl(app, q) {
  const e = encodeURIComponent(q);
  if (app === 'apple') return (isApple ? 'music://music.apple.com' : 'https://music.apple.com') + `/search?term=${e}`;
  if (app === 'youtube') return `https://www.youtube.com/results?search_query=${e}&sp=EgIQAw%3D%3D`;
  return `https://open.spotify.com/search/${e}/playlists`;
}

function viewMusic() {
  const app = db.settings.musicApp;
  return `
    <h2>מוזיקה לאימון</h2>
    <div class="card">
      <div class="seg">${MUSIC_APPS.map(([k, l]) => `<button class="${app === k ? 'on' : ''}" data-act="music-app" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="genres">${GENRES.map(([l, q]) => `<a class="genre" href="${esc(musicUrl(app, q))}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>
    </div>`;
}

// The template after the one used last (cycling A → B → A …).
function nextTemplateId() {
  if (!db.templates.length) return null;
  const last = sortedWorkouts().find((w) => db.templates.some((t) => t.id === w.templateId));
  if (!last) return db.templates[0].id;
  const i = db.templates.findIndex((t) => t.id === last.templateId);
  return db.templates[(i + 1) % db.templates.length].id;
}

function viewStart() {
  const nextId = nextTemplateId();
  const ordered = [...db.templates].sort((a, b) => (b.id === nextId) - (a.id === nextId));
  // Tapping a template starts it; the small button in its corner opens it in the editor.
  const tpls = ordered.map((t) => `
    <div class="tpl-wrap">
      <button class="tpl ${t.id === nextId ? 'next' : ''}" data-act="start" data-id="${t.id}">
        ${t.id === nextId ? '<span class="badge">הבא בתור</span>' : ''}
        <div class="name">${esc(t.name)}</div>
        <div class="sub">${t.exercises.map((e) => esc(e.name)).join(' · ') || 'אין תרגילים'}</div>
      </button>
      <button class="btn sm tpl-edit" data-act="tpl-edit" data-id="${t.id}">עריכה</button>
    </div>`).join('');

  const last = sortedWorkouts()[0];
  const lastCard = last ? `
    <h2>אימון אחרון</h2>
    <div class="card">
      <div class="row between"><b>${esc(last.name)}</b><span class="muted small">${fmtDate(last.start)}</span></div>
      <div class="muted small" style="margin-top:4px">${last.exercises.length} תרגילים · ${fmtDur(last.end - last.start)} · נפח ${Math.round(volume(last)).toLocaleString('he-IL')} ק״ג</div>
    </div>` : '';

  return `
    ${viewWeek()}
    <h2>התחל אימון</h2>
    ${tpls || '<p class="muted">אין עדיין תבניות. צור תבנית כדי להתחיל אימון ממנה.</p>'}
    <div class="row">
      <button class="btn ghost grow" data-act="tpl-new">+ תבנית חדשה</button>
      <button class="btn ghost grow" data-act="start-empty">+ אימון ריק</button>
    </div>
    ${viewMusic()}
    ${lastCard}`;
}

const stepper = (e, s, f, value, placeholder, mode) => `
  <div class="stepper">
    <button data-act="step" data-f="${f}" data-d="1" data-e="${e}" data-s="${s}" aria-label="הוסף">+</button>
    <input type="number" inputmode="${mode}" step="any" data-f="${f}" data-e="${e}" data-s="${s}" value="${esc(value)}" placeholder="${esc(placeholder)}">
    <button data-act="step" data-f="${f}" data-d="-1" data-e="${e}" data-s="${s}" aria-label="הפחת">−</button>
  </div>`;

function viewActive() {
  const w = db.active;
  const tpl = db.templates.find((t) => t.id === w.templateId);
  const card = (e, i) => {
    const prev = lastSetsFor(e.name);
    let n = 0;
    // Each set row slides sideways on swipe to reveal a delete button underneath (see swipe handling below).
    const rows = e.sets.map((s, j) => `
      <div class="set-row ${s.done ? 'done' : ''} ${s.wu ? 'wu' : ''}">
        <div class="set-actions">
          <button data-act="set-del" data-e="${i}" data-s="${j}">מחק</button>
          <button data-act="set-del" data-e="${i}" data-s="${j}">מחק</button>
        </div>
        <div class="set-grid swipe">
          <div class="n">${s.wu
            ? '<span title="סט חימום">ח׳</span>'
            : `<button class="set-n ${s.fail ? 'fail' : ''}" data-act="fail" data-e="${i}" data-s="${j}" aria-label="סמן סט עד כשל" aria-pressed="${!!s.fail}">${++n}${s.fail ? '<small>כשל</small>' : ''}</button>`}</div>
          ${stepper(i, j, 'w', s.w, s.pw, 'decimal')}
          ${stepper(i, j, 'r', s.r, s.pr, 'numeric')}
          <button class="check" data-act="set-done" data-e="${i}" data-s="${j}" aria-label="סמן סט כבוצע" aria-pressed="${!!s.done}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button>
        </div>
      </div>`).join('');
    return `
      <div class="card">
        <div class="row between">
          <div class="grow">
            <div class="ex-name">${esc(e.name)}</div>
            ${e.swapOf ? `<div class="muted small">במקום ${esc(e.swapOf)} · <button class="link-btn" data-act="unswap" data-e="${i}" style="padding:0">התפנה? חזור</button></div>` : ''}
            <button class="link-btn demo-link" data-act="demo" data-e="${i}">▶ ${db.demos[e.name] ? 'הדגמה' : 'חפש הדגמה'}</button>
            <div class="prev">${prev ? 'פעם קודמת: ' + prev.map(prevLabel).join(' · ') : 'תרגיל חדש'}</div>
          </div>
          <button class="rest-pill" data-act="ex-rest" data-e="${i}" aria-label="שנה זמן מנוחה">מנוחה ${e.rest} ש׳</button>
        </div>
        <div class="set-grid set-head"><span>סט</span><span>ק״ג</span><span>חזרות</span><span></span></div>
        ${rows}
        <div class="row between" style="margin-top:8px">
          <div class="row">
            <button class="btn sm" data-act="set-add" data-e="${i}">+ סט</button>
            ${e.sets.some((s) => s.wu) ? '' : `<button class="btn sm" data-act="wu-add" data-e="${i}">+ חימום</button>`}
          </div>
          <div class="row">
            <button class="link-btn" data-act="swap-open" data-e="${i}">${ui.swap === i ? 'סגור' : 'תפוס? החלף'}</button>
            <button class="link-btn" data-act="ex-del" data-e="${i}">הסר תרגיל</button>
          </div>
        </div>
        ${muscleMap(e.name, groupOf(e.swapOf || e.name))}
        ${ui.swap === i ? viewSwap(e, i) : ''}
      </div>`;
  };
  // Shown grouped by body area; data-e indices still point at the exercise's place in the workout.
  const exs = areaRuns(w.exercises, (e) => groupOf(e.name))
    .map(([area, idx]) => areaDivider(area, idx.length) + idx.map((i) => card(w.exercises[i], i)).join('')).join('');

  return `
    <p class="muted small" style="margin:0 0 10px">טיפ: לחיצה על מספר הסט מסמנת שהלכת בו <b class="t-fail">עד כשל</b>. כדי למחוק סט – החלק אותו הצידה.</p>
    <div class="wk-head">
      <input type="text" data-f="wname" value="${esc(w.name)}" aria-label="שם האימון">
      <span class="elapsed" id="elapsed"></span>
    </div>
    <div class="wk-date">
      <input type="date" class="pill-in" data-f="wdate" value="${esc(w.date || isoDay(w.start))}" max="${isoDay(Date.now())}" aria-label="תאריך האימון">
      ${backdated(w) ? `<span class="pill-in mins"><input type="number" inputmode="numeric" data-f="wmins" value="${esc(w.mins ?? 60)}" aria-label="משך בדקות">דק׳</span><span class="muted small">טיימר כבוי</span>` : ''}
      ${tpl ? `<button class="link-btn" data-act="tpl-edit" data-id="${tpl.id}" style="margin-inline-start:auto">ערוך תבנית</button>` : ''}
    </div>
    ${viewStretch(w, 'pre')}
    ${exs}
    <div class="card">
      <div class="row">
        <input type="text" id="new-ex" list="exnames" placeholder="הוסף תרגיל…" class="grow">
        <button class="btn" data-act="ex-add">הוסף</button>
      </div>
      ${datalist()}
    </div>
    ${viewStretch(w, 'post')}
    ${viewMusic()}
    <button class="btn primary block" data-act="finish">סיים ושמור אימון</button>
    <button class="btn danger block" data-act="discard">בטל אימון</button>`;
}

// Stretching before the workout (warm-up, at the top) and after it (cool-down, at the bottom). Shown by default;
// skipping or finishing a section folds it to one line. The workout clock runs through both, so they're part of the total time.
const STRETCH_TITLE = { pre: 'מתיחות פתיחה', post: 'מתיחות סיום' };
function viewStretch(w, phase) {
  const list = stretchesFor(w, phase);
  const done = new Set(stretchState(w)[phase]);
  const left = list.filter((x) => !done.has(x.id));
  if (w.fold[phase]) {
    return `
      <div class="card stretch-fold row between">
        <span><b>${STRETCH_TITLE[phase]}</b> <span class="muted small">· ${left.length ? (done.size ? `${list.length - left.length}/${list.length} בוצעו` : 'דילגת') : 'הושלם ✓'}</span></span>
        <button class="link-btn" data-act="stretch-fold" data-ph="${phase}">הצג</button>
      </div>`;
  }
  const total = list.reduce((a, x) => a + stretchSecs(x), 0);
  const leftSecs = left.reduce((a, x) => a + stretchSecs(x), 0);
  const rows = list.map((x) => `
    <div class="stretch ${done.has(x.id) ? 'done' : ''}">
      ${demoAnim(stretchImages(x))}
      <div class="stretch-body">
        <div class="stretch-name">${esc(x.name)}</div>
        <div class="muted small">${esc(x.how)}</div>
        <div class="row" style="margin-top:6px">
          <button class="rest-pill" data-act="stretch-go" data-ph="${phase}" data-id="${x.id}" aria-label="הפעל טיימר מתיחה">▶ ${x.hold} ש׳${x.sides ? ' לכל צד' : ''}</button>
          <button class="check" data-act="stretch-done" data-ph="${phase}" data-id="${x.id}" aria-label="סמן מתיחה כבוצעה" aria-pressed="${done.has(x.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button>
        </div>
      </div>
    </div>`).join('');
  return `
    <div class="row between" style="margin:${phase === 'pre' ? '0' : '26px'} 0 10px">
      <h2 style="margin:0">${STRETCH_TITLE[phase]}</h2>
      <button class="btn sm" data-act="stretch-fold" data-ph="${phase}">${left.length ? 'דלג' : 'סגור'}</button>
    </div>
    <div class="card">
      <div class="row between">
        <span class="muted small">${phase === 'pre' ? 'חימום דינמי' : 'מתיחות סטטיות'} לאזורים של האימון</span>
        <span class="muted small">${leftSecs ? `נשארו ≈ ${Math.ceil(leftSecs / 60)} מתוך ${Math.ceil(total / 60)} דק׳` : 'הושלם ✓'}</span>
      </div>
      ${rows}
      <p class="muted small" style="margin:8px 0 0">נכלל בזמן הכולל של האימון. ▶ מפעיל טיימר שמחליף צד באמצע ומסמן ✓ בסוף.</p>
    </div>`;
}

function viewSwap(e, i) {
  const alts = altsFor(e.swapOf || e.name).filter((n) => n !== e.name);
  const saved = new Set(db.alts[e.swapOf || e.name] || []);
  const done = e.sets.filter((s) => s.done).length;
  return `
    <div class="swap">
      <div class="muted small">${done ? 'הסטים שכבר בוצעו יישארו כאן, והסטים שנשארו יעברו לתרגיל החלופי.' : 'בחר תרגיל חלופי. מספר הסטים והמנוחה נשמרים, והתבנית לא משתנה.'}</div>
      <div class="demo-variants">${alts.map((n) => `<button class="chip ${saved.has(n) ? 'on' : ''}" data-act="swap-pick" data-e="${i}" data-n="${esc(n)}">${esc(n)}</button>`).join('') || '<span class="muted small">אין הצעות – הקלד תרגיל למטה</span>'}</div>
      <div class="row" style="margin-top:10px">
        <input type="text" id="swap-name" list="exnames" placeholder="תרגיל חלופי אחר…" class="grow">
        <button class="btn sm" data-act="swap-custom" data-e="${i}">החלף</button>
      </div>
      <button class="link-btn" data-act="alt-save" data-e="${i}" style="padding-inline:0">+ שמור כחלופה קבועה בלי להחליף עכשיו</button>
    </div>`;
}

function viewSettings() {
  const hasKey = !!getApiKey();
  return `
    <h2 style="margin-top:0">אימון</h2>
    <div class="card">
      <label class="field">זמן מנוחה ברירת מחדל (שניות)
        <input type="number" inputmode="numeric" data-f="defrest" value="${db.settings.defaultRest}">
      </label>
      <label class="check-row">
        <input type="checkbox" data-f="set-lastfail" ${db.settings.lastSetFail ? 'checked' : ''}>
        <span>הסט האחרון בכל תרגיל הוא עד כשל<br><span class="muted small">מסומן אוטומטית בתחילת אימון. אפשר לבטל לסט מסוים בלחיצה על המספר שלו.</span></span>
      </label>
    </div>

    <h2>גיבוי</h2>
    <div class="card">
      <button class="btn block" data-act="export" style="margin-top:0">ייצוא גיבוי (קובץ JSON)</button>
      <button class="btn block" data-act="import">שחזור מגיבוי</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="muted small" style="margin-bottom:0">הנתונים נשמרים רק בטלפון הזה. מומלץ לייצא גיבוי מדי פעם.</p>
    </div>

    <h2>קריאה אוטומטית עם Claude</h2>
    <div class="card">
      <label class="field">מפתח Claude API ${hasKey ? '<span class="ok">✓ שמור</span>' : ''}
        <input type="password" data-f="apikey" value="${esc(getApiKey())}" placeholder="sk-ant-…" autocomplete="off" dir="ltr">
      </label>
      <p class="muted small" style="margin-bottom:0">אופציונלי, בתשלום לפי שימוש. עם מפתח, האפליקציה קוראת דוחות הרכב גוף מתמונה ומביאה המלצות ישירות מ-Claude בלי העתק-הדבק. זה נפרד מהמנוי ל-Claude ומחויב לפי שימוש (כמה סנטים לדוח). המפתח נשמר רק בטלפון הזה ולא נכלל בקובץ הגיבוי.</p>
    </div>`;
}

function viewEditor() {
  const d = ui.draft;
  // Keep each body area's exercises together, so ▲▼ move within an area (or move the whole area past its neighbor).
  const runs = areaRuns(d.exercises, draftGroup);
  d.exercises = runs.flatMap(([, idx]) => idx.map((i) => d.exercises[i]));
  const firstOf = new Set(); let k = 0;
  for (const [, idx] of runs) { firstOf.add(k); k += idx.length; }
  const exs = d.exercises.map((e, i) => `
    ${firstOf.has(i) ? areaDivider(draftGroup(e), d.exercises.filter((x) => draftGroup(x) === draftGroup(e)).length) : ''}
    <div class="tex">
      <div class="row">
        <input type="text" class="grow" list="exnames" data-f="tex-name" data-i="${i}" value="${esc(e.name)}" placeholder="שם התרגיל">
        <button class="icon-btn" data-act="demo" data-i="${i}" aria-label="הדגמת התרגיל">▶</button>
        <button class="icon-btn" data-act="tex-up" data-i="${i}" aria-label="הזז למעלה">▲</button>
        <button class="icon-btn" data-act="tex-down" data-i="${i}" aria-label="הזז למטה">▼</button>
        <button class="icon-btn" data-act="tex-del" data-i="${i}" aria-label="הסר">✕</button>
      </div>
      ${e.name.trim() ? muscleMap(e.name, draftGroup(e)) : ''}
      <div class="grid">
        <label class="field">סטים<input type="number" inputmode="numeric" data-f="tex-sets" data-i="${i}" value="${esc(e.sets)}"></label>
        <label class="field">חזרות<input type="number" inputmode="numeric" data-f="tex-reps" data-i="${i}" value="${esc(e.reps)}"></label>
        <label class="field">מנוחה (ש׳)<input type="number" inputmode="numeric" data-f="tex-rest" data-i="${i}" value="${esc(e.rest)}"></label>
        <label class="field">משקל (ק״ג)<input type="number" inputmode="decimal" step="any" data-f="tex-w" data-i="${i}" value="${esc(e.w ?? '')}" placeholder="—"></label>
        <label class="field span2">אזור גוף
          <select data-f="tex-group" data-i="${i}">${GROUPS.map((g) => `<option ${g === draftGroup(e) ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </label>
      </div>
    </div>`).join('');

  return `
    ${db.active ? '<p class="muted small" style="margin:0 0 10px">השינויים נשמרים בתבנית לאימונים הבאים. האימון הפעיל לא משתנה – ביטול או שמירה יחזירו אותך אליו.</p>' : ''}
    <label class="field">שם התבנית<input type="text" data-f="tname" value="${esc(d.name)}" placeholder="למשל: אימון A"></label>
    <h2>תרגילים</h2>
    ${exs}
    ${datalist()}
    <button class="btn ghost block" data-act="tex-add">+ הוסף תרגיל</button>
    <button class="btn primary block" data-act="tpl-save">שמור תבנית</button>
    <button class="btn block" data-act="tpl-cancel">ביטול</button>
    ${d.isNew ? '' : d.confirmDel ? `
    <div class="card confirm-del">
      <div><b>למחוק את "${esc(d.name || 'התבנית')}"?</b><br><span class="muted small">אימונים שכבר נשמרו לא יימחקו.</span></div>
      <div class="row" style="margin-top:10px">
        <button class="btn danger-fill grow" data-act="tpl-del-yes">כן, מחק</button>
        <button class="btn grow" data-act="tpl-del-no">לא, השאר</button>
      </div>
    </div>` : '<button class="btn danger block" data-act="tpl-del">מחק תבנית</button>'}`;
}

function viewHistory() {
  const list = sortedWorkouts();
  if (!list.length) return '<div class="empty">עוד לא נשמרו אימונים.<br>אחרי שתסיים אימון הוא יופיע כאן.</div>';
  return list.map((w) => `
    <details class="card hist">
      <summary>
        <div class="row between"><b>${esc(w.name)}</b><span class="muted small">${fmtDate(w.start)} · ${fmtTime(w.start)}</span></div>
        <div class="muted small" style="margin-top:4px">${w.exercises.length} תרגילים · ${fmtDur(w.end - w.start)}${w.stretch ? ` (כולל ${Math.ceil(w.stretch / 60)} דק׳ מתיחות)` : ''} · נפח ${Math.round(volume(w)).toLocaleString('he-IL')} ק״ג</div>
      </summary>
      ${w.exercises.map((e) => `
        <div class="hist-ex">
          <div class="area">${groupOf(e.name)}</div>
          <b>${esc(e.name)}</b>
          <div class="chips">${e.sets.map((s) => chip(s)).join('')}</div>
        </div>`).join('')}
      <div class="row" style="margin-top:12px">
        <input type="date" class="pill-in" data-f="hist-date" data-id="${w.id}" value="${isoDay(w.start)}" max="${isoDay(Date.now())}" aria-label="תאריך האימון">
        <button class="btn sm" data-act="hist-tpl" data-id="${w.id}">שמור כתבנית</button>
        <button class="btn sm danger" data-act="hist-del" data-id="${w.id}">מחק</button>
      </div>
    </details>`).join('');
}

// markBest circles the highest point in red — only where higher means a record.
function chart(points, unit, markBest) {
  const W = 340, H = 190, L = 40, R = 10, T = 12, B = 26;
  if (!points.length) return '';
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  const best = markBest ? max : null;
  if (min === max) { min -= 5; max += 5; }
  const padY = (max - min) * 0.1;
  min = Math.max(0, min - padY); max += padY;
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z` : '';
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="גרף התקדמות">
      ${ticks.map((v) => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${max - min < 10 ? v.toFixed(1) : Math.round(v)}</text>`).join('')}
      ${area ? `<path class="ar" d="${area}"/>` : ''}
      <path class="ln" d="${path}"/>
      ${points.map((p, i) => `<circle class="pt ${p.y === best ? 'best' : ''}" cx="${x(i)}" cy="${y(p.y)}" r="${p.y === best ? 6 : 3.5}"><title>${fmtDateShort(p.t)}: ${fmtW(p.y)} ${unit}</title></circle>`).join('')}
      <text class="ax" x="${L}" y="${H - 6}" text-anchor="start">${fmtDateShort(points[0].t)}</text>
      ${points.length > 1 ? `<text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDateShort(points[points.length - 1].t)}</text>` : ''}
    </svg>`;
}

function viewProgress() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = db.workouts.filter((w) => w.start >= monthStart).length;
  const top = `
    <div class="stats">
      <div class="stat"><div class="v">${thisMonth}</div><div class="l">אימונים החודש</div></div>
      <div class="stat"><div class="v">${db.workouts.length}</div><div class="l">אימונים בסה״כ</div></div>
    </div>`;

  const names = [];
  for (const w of sortedWorkouts()) for (const e of w.exercises) if (!names.includes(e.name)) names.push(e.name);
  if (!names.length) return top + '<div class="empty">אחרי כמה אימונים יופיעו כאן גרפים ושיאים אישיים לכל תרגיל.</div>';

  // Working sets per body area over the chosen period.
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const periods = [['week', 'השבוע', sunday], ['month', 'החודש', monthStart], ['all', 'הכול', 0]];
  if (!periods.some(([k]) => k === ui.areaPeriod)) ui.areaPeriod = 'week';
  const from = periods.find(([k]) => k === ui.areaPeriod)[2];
  const perArea = new Map(GROUPS.map((g) => [g, 0]));
  for (const w of db.workouts) {
    if (w.start < from) continue;
    for (const e of w.exercises) perArea.set(groupOf(e.name), perArea.get(groupOf(e.name)) + work(e.sets).length);
  }
  const maxSets = Math.max(1, ...perArea.values());
  const areaCard = `
    <div class="card">
      <div class="row between"><h3>סטים לפי אזור גוף</h3></div>
      <div class="seg" style="margin-top:10px">${periods.map(([k, l]) => `<button class="${ui.areaPeriod === k ? 'on' : ''}" data-act="area-period" data-k="${k}">${l}</button>`).join('')}</div>
      ${[...perArea].filter(([g, c]) => c || g !== 'אחר').map(([g, c]) => `
        <div class="bar-row ${c ? '' : 'zero'}">
          <span class="bar-l">${g}</span>
          <span class="bar"><span style="width:${(c / maxSets) * 100}%"></span></span>
          <span class="bar-v">${c}</span>
        </div>`).join('')}
    </div>`;
  const byArea = GROUPS.map((g) => [g, names.filter((n) => groupOf(n) === g)]).filter(([, list]) => list.length);
  if (!names.includes(ui.progEx)) ui.progEx = names[0];

  const sessions = [...db.workouts].sort((a, b) => a.start - b.start)
    .map((w) => {
      const e = w.exercises.find((x) => x.name === ui.progEx);
      return { t: w.start, e: e && { ...e, sets: work(e.sets) } };
    })
    .filter((s) => s.e && s.e.sets.length);
  const metricOf = {
    e1rm: (e) => Math.max(...e.sets.map((s) => e1rm(s.w, s.r))),
    max: (e) => Math.max(...e.sets.map((s) => s.w)),
    vol: (e) => e.sets.reduce((a, s) => a + s.w * s.r, 0),
  };
  const points = sessions.map((s) => ({ t: s.t, y: metricOf[ui.progMetric](s.e) }));
  const { maxW, maxE } = bestFor(ui.progEx);
  const metrics = [['e1rm', 'כוח משוער'], ['max', 'משקל מקס׳'], ['vol', 'נפח']];

  return `
    ${top}
    ${areaCard}
    <div class="card ex-pick">
      <div class="area" style="margin-bottom:6px">${groupOf(ui.progEx)}</div>
      <select data-f="prog-ex" aria-label="בחר תרגיל">${byArea.map(([g, list]) => `<optgroup label="${g}">${list.map((n) => `<option ${n === ui.progEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>
    </div>
    <div class="stats">
      <div class="stat"><div class="v" dir="ltr">${maxW ? setLabel(maxW) : '–'}</div><div class="l">שיא משקל</div></div>
      <div class="stat"><div class="v">${maxE ? fmtW(Math.round(maxE * 2) / 2) : '–'}</div><div class="l">1RM משוער (ק״ג)</div></div>
    </div>
    <div class="card">
      <div class="seg">${metrics.map(([k, l]) => `<button class="${ui.progMetric === k ? 'on' : ''}" data-act="metric" data-k="${k}">${l}</button>`).join('')}</div>
      ${chart(points, 'ק״ג', true)}
      <p class="muted small" style="margin:6px 0 0">${ui.progMetric === 'e1rm' ? 'כוח משוער = המשקל המקסימלי שהיית מרים לחזרה אחת, מחושב מהסט הטוב ביותר.' : ui.progMetric === 'vol' ? 'נפח = משקל × חזרות, מסוכם על כל הסטים.' : 'המשקל הכבד ביותר באימון.'}</p>
    </div>
    ${viewExerciseDash(sessions, maxE)}`;
}

// Per-exercise dashboard: momentum, what to aim for next time, rep maxes and the record timeline.
// Bodyweight exercises (no weight logged) are scored by reps instead of estimated strength.
function viewExerciseDash(sessions, maxE) {
  if (!sessions.length) return '';
  const weighted = maxE > 0;
  const score = (s) => (weighted ? e1rm(s.w, s.r) : s.r);
  const topOf = (e) => e.sets.reduce((a, b) => (score(b) > score(a) ? b : a));
  const tops = sessions.map((s) => ({ t: s.t, set: topOf(s.e) }));
  const last = tops[tops.length - 1];

  // Momentum tiles
  const DAY = 86400000;
  const now = Date.now();
  const gain = tops.length > 1 ? (score(last.set) - score(tops[0].set)) / score(tops[0].set) : null;
  const month = sessions.filter((s) => s.t >= now - 30 * DAY).length;
  const ago = Math.round((new Date(isoDay(now)) - new Date(isoDay(last.t))) / DAY);
  const records = [];
  let best = score(tops[0].set);
  for (const x of tops.slice(1)) {
    if (score(x.set) > best) { records.push({ ...x, gain: score(x.set) - best }); best = score(x.set); }
  }
  const tile = (v, l, cls = '') => `<div class="dash-tile ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const tiles = [
    tile(gain === null ? '–' : `<span dir="ltr">${gain > 0 ? '+' : ''}${Math.round(gain * 100)}%</span>`, 'מאז הפעם הראשונה', gain > 0 ? 'up' : gain < 0 ? 'down' : ''),
    tile(month, 'פעמים ב־30 יום'),
    tile(ago === 0 ? 'היום' : ago === 1 ? 'אתמול' : ago, ago > 1 ? 'ימים מהפעם האחרונה' : 'הפעם האחרונה'),
    tile(records.length, records.length === 1 ? 'שיא שנשבר' : 'שיאים שנשברו'),
  ].join('');

  // Next-time targets, built from last session's best set
  const { w, r } = last.set;
  const goal = (l, set, rec) => `<div class="goal ${rec ? 'rec' : ''}"><div class="l">${l}</div><div class="v" dir="ltr">${setLabel(set)}</div></div>`;
  let goals;
  if (weighted) {
    let rw = Math.ceil(maxE / (1 + r / 30) / WEIGHT_STEP) * WEIGHT_STEP;
    if (e1rm(rw, r) <= maxE) rw += WEIGHT_STEP;
    goals = goal('עוד חזרה', { w, r: r + 1 }) + goal('עוד משקל', { w: w + WEIGHT_STEP, r })
      + goal('לשיא חדש', { w: rw, r }, true);
  } else {
    const maxR = Math.max(...tops.map((x) => x.set.r));
    goals = goal('עוד חזרה', { w: 0, r: r + 1 }) + goal('לשיא חדש', { w: 0, r: maxR + 1 }, true);
  }

  // What the current estimated max means at other rep counts
  const repMax = weighted ? `
      <h4 class="dash-h">כמה אתה אמור להרים לפי חזרות</h4>
      <div class="rm-grid">${[1, 3, 5, 8, 10, 12].map((n) => `
        <div><b>${fmtW(n <= 1 ? Math.floor(maxE / WEIGHT_STEP) * WEIGHT_STEP : Math.floor(maxE / (1 + n / 30) / WEIGHT_STEP) * WEIGHT_STEP)}</b><span>${n === 1 ? 'חזרה' : `${n} חזרות`}</span></div>`).join('')}
      </div>
      <p class="muted small" style="margin:6px 0 0">לפי ה־1RM המשוער שלך, מעוגל למטה ל־${fmtW(WEIGHT_STEP)} ק״ג.</p>` : '';

  const timeline = records.length ? `
      <h4 class="dash-h">ציר השיאים</h4>
      ${records.slice(-5).reverse().map((x) => `
        <div class="rec-row">
          <span class="muted small">${fmtDateFull(x.t)}</span>
          <span class="chip pr">${setLabel(x.set)}</span>
          <span class="delta up" dir="ltr">+${weighted ? `${fmtW(Math.round(x.gain * 2) / 2)} ק״ג` : x.gain}</span>
        </div>`).join('')}` : '';

  return `
    <div class="card dash">
      <h3>תמונת מצב</h3>
      <div class="dash-tiles">${tiles}</div>
      <h4 class="dash-h">היעד לפעם הבאה</h4>
      <div class="goals">${goals}</div>
      <p class="muted small" style="margin:6px 0 0">לפי הסט הטוב בפעם האחרונה: <span dir="ltr">${setLabel(last.set)}</span>. בחר אחד.</p>
      ${repMax}
      ${timeline}
    </div>`;
}

// ---------- Body metrics ----------
// better: 1 = higher is better, -1 = lower is better, 0 = neutral (colors the change vs. last measurement).
const MFIELDS = [
  { k: 'weight', l: 'משקל', u: 'ק״ג', better: 0 },
  { k: 'height', l: 'גובה', u: 'ס״מ', better: 0 },
  { k: 'pbf', l: 'אחוז שומן', u: '%', better: -1 },
  { k: 'smm', l: 'מסת שריר', u: 'ק״ג', better: 1 },
  { k: 'fat', l: 'מסת שומן', u: 'ק״ג', better: -1 },
  { k: 'bmi', l: 'BMI', u: '', better: -1 },
  { k: 'visceral', l: 'שומן ויסצרלי', u: 'רמה', better: -1 },
  { k: 'score', l: 'ציון InBody', u: '', better: 1 },
  { k: 'bmr', l: 'חילוף חומרים (BMR)', u: 'קק״ל', better: 1 },
  { k: 'ffm', l: 'מסה רזה', u: 'ק״ג', better: 1 },
  { k: 'tbw', l: 'מים בגוף', u: 'ליטר', better: 0 },
  { k: 'protein', l: 'חלבון', u: 'ק״ג', better: 1 },
  { k: 'mineral', l: 'מינרלים', u: 'ק״ג', better: 0 },
];
const MF = Object.fromEntries(MFIELDS.map((f) => [f.k, f]));
const CHART_METRICS = [['pbf', 'אחוז שומן'], ['weight', 'משקל'], ['smm', 'שריר'], ['fat', 'שומן ק״ג']];

const API_KEY_KEY = 'gym-tracker-apikey';
const getApiKey = () => { try { return localStorage.getItem(API_KEY_KEY) || ''; } catch { return ''; } };
const setApiKey = (v) => { try { v ? localStorage.setItem(API_KEY_KEY, v) : localStorage.removeItem(API_KEY_KEY); } catch { /* ignore */ } };

const sortedMetrics = () => [...db.metrics].sort((a, b) => b.t - a.t);
const latestOf = (k) => sortedMetrics().find((m) => m[k] != null);
const isoDay = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayTs = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y && m && d ? new Date(y, m - 1, d, 12).getTime() : null; };
const fmtDateFull = (ts) => new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });

function deltaHtml(k, cur, prev) {
  if (cur == null || prev == null) return '';
  const d = Math.round((cur - prev) * 10) / 10;
  if (!d) return '<span class="delta">±0</span>';
  const tone = MF[k].better ? (Math.sign(d) === MF[k].better ? 'up' : 'down') : '';
  return `<span class="delta ${tone}" dir="ltr">${d > 0 ? '+' : ''}${fmtW(d)}</span>`;
}

function viewMetricForm() {
  const d = ui.mdraft;
  const hist = d.history.length ? `
    <h2>מדידות קודמות מהדוח</h2>
    <div class="card">
      <p class="muted small" style="margin-top:0">נמצאו בטבלת ההיסטוריה של הדוח. מסומנות יתווספו (רק משקל, שריר ואחוז שומן).</p>
      ${d.history.map((h, i) => `
        <label class="hist-row">
          <input type="checkbox" data-f="m-hist" data-i="${i}" ${h.add ? 'checked' : ''} ${h.exists ? 'disabled' : ''}>
          <span class="grow">${fmtDateFull(dayTs(h.date))}${h.exists ? ' <span class="muted small">(כבר קיימת)</span>' : ''}</span>
          <span class="muted small" dir="ltr">${[h.weight != null ? `${fmtW(h.weight)}kg` : '', h.smm != null ? `SMM ${fmtW(h.smm)}` : '', h.pbf != null ? `${fmtW(h.pbf)}%` : ''].filter(Boolean).join(' · ')}</span>
        </label>`).join('')}
    </div>` : '';

  return `
    ${d.fromImage ? '<div class="card note">הנתונים נקראו מהתמונה. כדאי לעבור עליהם ולתקן אם משהו לא נקרא נכון.</div>' : ''}
    <div class="card">
      <label class="field">תאריך המדידה<input type="date" data-f="m-date" value="${esc(d.date)}"></label>
      <div class="mgrid">
        ${MFIELDS.map((f) => `<label class="field">${f.l}${f.u ? ` <span class="unit">(${f.u})</span>` : ''}<input type="number" inputmode="decimal" step="any" data-f="m-val" data-k="${f.k}" value="${esc(d.vals[f.k])}"></label>`).join('')}
      </div>
    </div>
    ${hist}
    <button class="btn primary block" data-act="m-save">שמור מדידה</button>
    <button class="btn block" data-act="m-cancel">ביטול</button>
    ${d.isNew ? '' : '<button class="btn danger block" data-act="m-del">מחק מדידה</button>'}`;
}

function viewMetrics() {
  if (ui.mdraft) return viewMetricForm();
  const list = sortedMetrics();
  const hasKey = !!getApiKey();

  const paste = ui.pasteOpen ? `
    <div class="card steps">
      <div class="row between"><h3>קליטת נתונים מ-Claude</h3><button class="icon-btn" data-act="paste-close" aria-label="סגור">✕</button></div>
      <ol>
        <li>העתק את ההוראה:<button class="btn sm" data-act="paste-copy">העתק הוראה ל-Claude</button></li>
        <li>פתח את Claude, צרף את תמונת הדוח והדבק את ההוראה.</li>
        <li>העתק את התשובה שתקבל, חזור לכאן והדבק:
          <button class="btn sm" data-act="paste-read">הדבק מהלוח</button>
          <textarea id="paste-text" data-f="paste-text" rows="4" dir="ltr" placeholder="או הדבק כאן ידנית…">${esc(ui.pasteText)}</textarea>
        </li>
      </ol>
      <button class="btn primary block" data-act="paste-parse">קלוט נתונים</button>
    </div>` : '<button class="btn primary block" data-act="paste-open" style="margin-top:0">קליטת נתונים מ-Claude</button>';

  const upload = ui.reading
    ? '<div class="card center reading"><div class="spinner"></div><div style="margin-top:10px">קורא את הנתונים מהדוח…</div><div class="muted small">זה לוקח בדרך כלל כמה שניות</div></div>'
    : `${paste}
       ${hasKey ? '<button class="btn block" data-act="m-upload">קריאה אוטומטית מתמונה</button><input type="file" id="m-file" accept="image/*" hidden>' : ''}
       <button class="btn ghost block" data-act="m-manual">+ הזנה ידנית</button>`;

  let latest = '', chartCard = '', rows = '';
  if (list.length) {
    const [cur, prev] = list;
    const shown = ['weight', 'pbf', 'smm', 'fat', 'visceral', 'score'].filter((k) => cur[k] != null);
    latest = `
      <div class="row between" style="margin:18px 0 10px"><h2 style="margin:0">מדידה אחרונה</h2><span class="muted small">${fmtDateFull(cur.t)}</span></div>
      <div class="stats">${shown.map((k) => `
        <div class="stat">
          <div class="v"><span dir="ltr">${fmtW(cur[k])}<span class="u">${MF[k].u === '%' ? '%' : ''}</span></span> ${prev ? deltaHtml(k, cur[k], prev[k]) : ''}</div>
          <div class="l">${MF[k].l}${MF[k].u && MF[k].u !== '%' ? ` (${MF[k].u})` : ''}</div>
        </div>`).join('')}
      </div>`;

    const points = [...list].reverse().filter((m) => m[ui.bodyMetric] != null).map((m) => ({ t: m.t, y: m[ui.bodyMetric] }));
    chartCard = `
      <div class="card">
        <div class="seg">${CHART_METRICS.map(([k, l]) => `<button class="${ui.bodyMetric === k ? 'on' : ''}" data-act="body-metric" data-k="${k}">${l}</button>`).join('')}</div>
        ${points.length > 1 ? chart(points, MF[ui.bodyMetric].u) : '<p class="muted small center">צריך לפחות שתי מדידות כדי להציג גרף.</p>'}
      </div>`;

    rows = list.map((m) => `
      <details class="card hist">
        <summary class="row between">
          <b>${fmtDateFull(m.t)}</b>
          <span class="muted small" dir="ltr">${[m.weight != null ? `${fmtW(m.weight)} kg` : '', m.pbf != null ? `${fmtW(m.pbf)}%` : ''].filter(Boolean).join(' · ')}</span>
        </summary>
        <div class="mlist">${MFIELDS.filter((f) => m[f.k] != null).map((f) => `<div><span class="muted">${f.l}</span><b dir="ltr">${fmtW(m[f.k])} ${f.u === '%' ? '%' : ''}</b></div>`).join('')}</div>
        <button class="btn sm" data-act="m-edit" data-id="${m.id}" style="margin-top:10px">עריכה</button>
      </details>`).join('');
  }

  const recs = !list.length ? ''
    : ui.recsOpen ? viewRecs()
      : '<button class="btn primary block" data-act="recs-open">המלצות לשיפור האימון</button>';

  return `
    ${upload}
    ${list.length ? latest + recs + chartCard + '<h2>כל המדידות</h2>' + rows : '<div class="empty">עוד אין מדידות.<br>צלם את דוח ה-InBody (או כל דוח הרכב גוף), תן ל-Claude לקרוא אותו והדבק את התשובה כאן.</div>'}`;
}

function newMetricDraft(vals = {}, date = isoDay(Date.now()), history = [], fromImage = false) {
  const days = new Set(db.metrics.map((m) => isoDay(m.t)));
  if (vals.height == null && latestOf('height')) vals = { ...vals, height: latestOf('height').height }; // height rarely changes
  return {
    id: uid(), isNew: true, fromImage, date,
    vals: Object.fromEntries(MFIELDS.map((f) => [f.k, vals[f.k] != null ? String(vals[f.k]) : ''])),
    history: history
      .filter((h) => h.date && dayTs(h.date) && h.date !== date)
      .map((h) => ({ ...h, exists: days.has(h.date), add: !days.has(h.date) })),
  };
}

function saveMetric() {
  const d = ui.mdraft;
  const t = dayTs(d.date);
  if (!t) { toast('בחר תאריך'); return; }
  const entry = { id: d.id, t };
  for (const f of MFIELDS) { const v = num(d.vals[f.k]); if (v != null) entry[f.k] = v; }
  if (Object.keys(entry).length === 2) { toast('לא הוזנו נתונים'); return; }

  // One measurement per day: a new entry on a day that already has one replaces it.
  const sameDay = d.isNew && db.metrics.find((m) => isoDay(m.t) === d.date);
  if (sameDay && !confirm(`כבר קיימת מדידה מ-${fmtDateFull(t)}. להחליף אותה?`)) return;
  db.metrics = db.metrics.filter((m) => m.id !== d.id && m !== sameDay);
  db.metrics.push(entry);

  let added = 0;
  for (const h of d.history) {
    if (!h.add || h.exists) continue;
    const m = { id: uid(), t: dayTs(h.date) };
    for (const k of ['weight', 'smm', 'pbf']) if (h[k] != null) m[k] = h[k];
    db.metrics.push(m);
    added++;
  }
  ui.mdraft = null;
  save(); render();
  window.scrollTo(0, 0);
  toast(added ? `המדידה נשמרה (+${added} מההיסטוריה)` : 'המדידה נשמרה');
}

// Downscale before upload: phone photos are large, and ~1600px is plenty to read the printout.
async function imageToJpegBase64(file, maxDim = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.134.0/+esm';
const numOrNull = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    is_report: { type: 'boolean', description: 'false if the image is not a body composition report' },
    date: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
    ...Object.fromEntries(MFIELDS.map((f) => [f.k, numOrNull])),
    history: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string', format: 'date' }, weight: numOrNull, smm: numOrNull, pbf: numOrNull },
        required: ['date', 'weight', 'smm', 'pbf'],
        additionalProperties: false,
      },
    },
  },
  required: ['is_report', 'date', ...MFIELDS.map((f) => f.k), 'history'],
  additionalProperties: false,
};
const REPORT_PROMPT = `This is a photo of a body composition report (for example an InBody printout). Extract the values of the current test.

Fields:
- date: the test date as YYYY-MM-DD. Printouts from Israel/Europe write dates as DD.MM.YYYY.
- weight (kg), height (cm), pbf (percent body fat, %), smm (skeletal muscle mass, kg), fat (body fat mass, kg), bmi, visceral (visceral fat level), score (InBody score out of 100), bmr (basal metabolic rate, kcal), ffm (fat free mass, kg), tbw (total body water, L), protein (kg), mineral (kg).
- history: every column of the "Body Composition History" table except the current test, with its date and the weight, smm and pbf values printed for it. Empty array if there is no such table.

Read the measured value itself, not the normal range printed next to it in parentheses. Printouts often put a space after the decimal point ("86. 8" means 86.8). Use null for anything not on the report or not legible. Set is_report to false if the image is not a body composition report.`;

// Same instructions for the copy-paste flow through the user's own Claude chat (no API key needed).
const CHAT_PROMPT = `${REPORT_PROMPT}

Reply with only a JSON object and nothing else, in this shape:
{"is_report": true, "date": "YYYY-MM-DD", ${MFIELDS.map((f) => `"${f.k}": 0`).join(', ')}, "history": [{"date": "YYYY-MM-DD", "weight": 0, "smm": 0, "pbf": 0}]}`;

const pad2 = (n) => String(n).padStart(2, '0');
function normDate(s) {
  s = String(s ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return null;
}

// Pull the JSON object out of a pasted chat reply (it may come wrapped in a code block or extra text).
function parseReportText(text) {
  const s = String(text), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  let r;
  try { r = JSON.parse(s.slice(a, b + 1)); } catch { return null; }
  if (!r || typeof r !== 'object') return null;
  const out = { is_report: r.is_report !== false, date: normDate(r.date) };
  for (const f of MFIELDS) out[f.k] = num(r[f.k]);
  out.history = (Array.isArray(r.history) ? r.history : [])
    .map((h) => ({ date: normDate(h?.date), weight: num(h?.weight), smm: num(h?.smm), pbf: num(h?.pbf) }))
    .filter((h) => h.date);
  return out;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function importPasted() {
  const r = parseReportText(ui.pasteText);
  if (!r) { toast('לא נמצאו נתונים בטקסט. ודא שהעתקת את כל התשובה של Claude', 3500); return; }
  if (!r.is_report) { toast('Claude לא זיהה דוח הרכב גוף בתמונה', 3500); return; }
  if (MFIELDS.every((f) => r[f.k] == null)) { toast('לא נמצאו ערכים בתשובה', 3500); return; }
  ui.mdraft = newMetricDraft(r, r.date || isoDay(Date.now()), r.history, true);
  ui.pasteOpen = false;
  ui.pasteText = '';
  render();
  window.scrollTo(0, 0);
}

async function readReport(file) {
  const apiKey = getApiKey();
  const data = await imageToJpegBase64(file);
  const sdk = await import(SDK_URL);
  const client = new sdk.default({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: REPORT_PROMPT },
        ],
      }],
    });
    if (res.stop_reason === 'refusal') throw new Error('לא ניתן היה לעבד את התמונה');
    if (res.stop_reason === 'max_tokens') throw new Error('התשובה נקטעה, נסה שוב');
    const text = res.content.find((b) => b.type === 'text')?.text;
    return JSON.parse(text);
  } catch (e) {
    throw apiError(sdk, e);
  }
}

// Hebrew messages for the SDK's error types.
function apiError(sdk, e) {
  if (e instanceof sdk.AuthenticationError) return new Error('מפתח ה-API לא תקין');
  if (e instanceof sdk.RateLimitError) return new Error('יותר מדי בקשות, נסה שוב בעוד דקה');
  if (e instanceof sdk.APIConnectionError) return new Error('אין חיבור לאינטרנט');
  if (e instanceof sdk.APIError) return new Error(`שגיאה מהשרת (${e.status ?? '?'})`);
  return e;
}

async function handleReportFile(file) {
  ui.reading = true; render();
  try {
    const r = await readReport(file);
    if (!r.is_report) { toast('זה לא נראה כמו דוח הרכב גוף', 3500); return; }
    ui.mdraft = newMetricDraft(r, r.date && dayTs(r.date) ? r.date : isoDay(Date.now()), r.history || [], true);
  } catch (e) {
    toast(e.message && /[֐-׿]/.test(e.message) ? e.message : 'לא הצלחתי לקרוא את התמונה', 3500);
  } finally {
    ui.reading = false;
    render();
    window.scrollTo(0, 0);
  }
}

// ---------- Training recommendations ----------
// Rule-of-thumb guidance from the latest body metrics (height, weight, body fat) and the last four weeks of training.
const DAY_MS = 86400000, WEEK_MS = 7 * DAY_MS;
// Weekly working sets per area that most lifters grow well on.
const AREA_TARGET = { 'חזה': [10, 20], 'גב': [10, 20], 'רגליים': [10, 20], 'כתפיים': [8, 16], 'יד קדמית': [6, 12], 'יד אחורית': [6, 12], 'בטן': [4, 10] };
// Body fat %: below the first number there's room to build, above the second it's worth cutting first.
const FAT_BANDS = { m: [12, 20], f: [21, 30] };
const GOALS = {
  cut: { l: 'חיטוב', d: 'להוריד שומן ולשמור על השריר', en: 'lose fat while keeping muscle' },
  recomp: { l: 'שיפור הרכב גוף', d: 'לבנות שריר בלי לעלות בשומן', en: 'build muscle without gaining fat' },
  bulk: { l: 'מסה נקייה', d: 'לבנות שריר בעודף קלורי קטן', en: 'build muscle in a small calorie surplus' },
};

function bodyProfile() {
  const wM = latestOf('weight');
  if (!wM) return null;
  const weight = wM.weight, height = latestOf('height')?.height ?? null;
  // Composition values only from the same measurement as the weight, so they describe the same body.
  const pbf = wM.pbf ?? (wM.fat != null ? (wM.fat / weight) * 100 : null);
  const ffm = wM.ffm ?? (pbf != null ? weight * (1 - pbf / 100) : null);
  const hm = height ? height / 100 : null;
  const bmi = hm ? weight / hm ** 2 : wM.bmi ?? null;
  const ffmi = hm && ffm ? ffm / hm ** 2 + 6.1 * (1.8 - hm) : null; // normalized to 1.80 m

  // Trend against a measurement at least three weeks back (or the oldest one, if it's two weeks or more).
  const ws = sortedMetrics().filter((m) => m.weight != null);
  const old = ws.find((m) => wM.t - m.t >= 21 * DAY_MS) || ws.at(-1);
  let trend = null;
  if (old && wM.t - old.t >= 14 * DAY_MS) {
    const weeks = (wM.t - old.t) / WEEK_MS;
    trend = {
      weeks,
      perWeek: (weight - old.weight) / weeks,
      pct: ((weight - old.weight) / weeks / old.weight) * 100,
      smm: wM.smm != null && old.smm != null ? wM.smm - old.smm : null,
    };
  }
  return { m: wM, weight, height, pbf, ffm, bmi, ffmi, hm, trend, bmr: wM.bmr ?? null, visceral: wM.visceral ?? null };
}

function trainingSummary() {
  const now = Date.now();
  const recent = db.workouts.filter((w) => w.start >= now - 4 * WEEK_MS);
  if (!recent.length) return null;
  const weeks = Math.min(4, Math.max(1, (now - Math.min(...recent.map((w) => w.start))) / WEEK_MS));
  const sets = new Map(GROUPS.map((g) => [g, 0]));
  for (const w of recent) for (const e of w.exercises) sets.set(groupOf(e.name), sets.get(groupOf(e.name)) + work(e.sets).length);
  return { perWeek: recent.length / weeks, sets: new Map([...sets].map(([g, c]) => [g, c / weeks])) };
}

function pickGoal(p, sex) {
  const [lo, hi] = FAT_BANDS[sex];
  if (p.pbf != null) return p.pbf > hi ? 'cut' : p.pbf < lo ? 'bulk' : 'recomp';
  if (p.bmi != null) return p.bmi >= 27 ? 'cut' : p.bmi < 20 ? 'bulk' : 'recomp';
  return null;
}

const bmiLabel = (b) => (b < 18.5 ? 'תת-משקל' : b < 25 ? 'תקין' : b < 30 ? 'עודף משקל' : 'השמנה');
const round50 = (n) => Math.round(n / 50) * 50;
const r1 = (n) => fmtW(Math.round(n * 10) / 10);

// Movement patterns a balanced program covers, with a stock exercise to suggest when one is missing.
const PATTERNS = [
  { k: 'hpush', l: 'דחיקה אופקית (חזה)', re: /לחיצת חזה|שכיבות סמיכה|מקבילים|bench|chest press|push.?up|\bdips?\b/i, add: 'לחיצת חזה במשקולות' },
  { k: 'vpush', l: 'דחיקה אנכית (כתפיים)', re: /לחיצת כתפיים|לחיצה צבאית|ארנולד|overhead press|shoulder press|military/i, add: 'לחיצת כתפיים במשקולות' },
  { k: 'hpull', l: 'משיכה אופקית (חתירה)', re: /חתיר|פולי תחתון|\brow/i, add: 'חתירה במשקולת' },
  { k: 'vpull', l: 'משיכה אנכית (מתח)', re: /מתח|פולי עליון|pull.?up|chin.?up|pulldown/i, add: 'פולי עליון' },
  { k: 'squat', l: 'סקוואט / לחיצת רגליים', re: /סקוואט|לחיצת רגליים|מכרע|לאנג|squat|leg press|lunge/i, add: 'סקוואט גובלט' },
  { k: 'hinge', l: 'כפיפת ירך (דדליפט)', re: /דדליפט|היפ טראסט|גשר ישבן|deadlift|hip thrust|\brdl\b|good ?morning/i, add: 'דדליפט רומני' },
  { k: 'rear', l: 'כתף אחורית', re: /פייס|פרפר הפוך|face ?pull|rear delt|reverse fly/i, add: 'פייס פול' },
];
const COMPOUND = ['hpush', 'vpush', 'hpull', 'vpull', 'squat', 'hinge'];
const ISOLATION = /הרחק|פרפר|פק דק|כפיפ(ת|ות) מרפק|פשיט(ת|ות)|הרמת עקבים|פטיש|פרנץ|סקאל|כפיפת ברכיים|curl|extension|raise|\bfly/i;
const patternsOf = (name) => PATTERNS.filter((p) => p.re.test(name)).map((p) => p.k);
const isCompound = (name) => !ISOLATION.test(name) && patternsOf(name).some((k) => COMPOUND.includes(k));

// Review the templates' exercise choice: missing movement patterns, push/pull balance, order, reps, rest and length.
function programReview() {
  const tpls = db.templates.filter((t) => t.exercises.length);
  if (!tpls.length) return [];
  const out = [];
  const all = tpls.flatMap((t) => t.exercises);
  const sets = Object.fromEntries(PATTERNS.map((p) => [p.k, 0]));
  for (const e of all) for (const k of patternsOf(e.name)) sets[k] += e.sets;

  const missing = PATTERNS.filter((p) => !sets[p.k]);
  if (missing.length) {
    out.push({
      t: 'דפוסי תנועה חסרים',
      d: `אין בתבניות ${missing.map((p) => `<b>${p.l}</b>`).join(', ')}. תוכנית מאוזנת עובדת על כל דפוסי התנועה הבסיסיים – כדאי להוסיף: ${missing.map((p) => p.add).join(', ')}.`,
    });
  }

  const push = sets.hpush + sets.vpush, pull = sets.hpull + sets.vpull;
  if (push && pull && push > pull * 1.3) {
    out.push({ t: 'יחס דחיקה–משיכה', d: `בתבניות ${push} סטים של דחיקה מול ${pull} של משיכה. עודף דחיקה מושך את הכתפיים קדימה ומגביר סיכון לפציעה – כוון ליחס של 1:1 לפחות, למשל עוד 2–3 סטים של חתירה או פייס פול.` });
  } else if (push && pull && pull > push * 1.6) {
    out.push({ t: 'יחס דחיקה–משיכה', d: `${pull} סטים של משיכה מול ${push} בלבד של דחיקה – אפשר להוסיף סטים של לחיצת חזה או כתפיים.` });
  }

  for (const t of tpls) {
    const notes = [];
    // Big compound lifts first, while fresh; isolation work after.
    const firstIso = t.exercises.findIndex((e) => ISOLATION.test(e.name));
    const lateCompound = firstIso >= 0 && t.exercises.slice(firstIso + 1).find((e) => isCompound(e.name));
    if (lateCompound) notes.push(`הזז את "${esc(lateCompound.name)}" לפני "${esc(t.exercises[firstIso].name)}" – תרגילים מורכבים כדאי לעשות ראשונים, כשהכוח במיטבו.`);
    const heavyShortRest = t.exercises.filter((e) => isCompound(e.name) && e.reps <= 8 && e.rest < 120);
    if (heavyShortRest.length) notes.push(`${heavyShortRest.map((e) => `"${esc(e.name)}"`).join(', ')}: ב-${heavyShortRest[0].reps} חזרות או פחות כדאי לנוח 2–3 דקות, כדי שהסט הבא לא ייחלש.`);
    const oddReps = t.exercises.filter((e) => e.reps > 20 || e.reps < 4);
    if (oddReps.length) notes.push(`${oddReps.map((e) => `"${esc(e.name)}" (${e.reps})`).join(', ')}: טווח חזרות חריג. לרוב התרגילים 5–15 חזרות עובדות הכי טוב לבניית שריר.`);
    const manySets = t.exercises.filter((e) => e.sets > 5);
    if (manySets.length) notes.push(`${manySets.map((e) => `"${esc(e.name)}"`).join(', ')}: יותר מ-5 סטים לתרגיל אחד – עדיף לפצל לשני תרגילים שונים לאותו שריר.`);
    const total = t.exercises.reduce((a, e) => a + e.sets, 0);
    if (t.exercises.length > 8 || total > 28) notes.push(`${t.exercises.length} תרגילים ו-${total} סטים – אימון ארוך מדי. האיכות יורדת אחרי כ-20–25 סטים; כדאי לפצל לאימון נוסף.`);
    if (notes.length) out.push({ t: `תבנית: ${esc(t.name)}`, d: notes.map((n) => `• ${n}`).join('<br>') });
  }

  if (!out.length) out.push({ t: 'התוכנית מאוזנת', d: 'כל דפוסי התנועה הבסיסיים מכוסים, יחס הדחיקה–משיכה תקין והתרגילים המורכבים באים ראשונים. המשך להתקדם בעומסים.' });
  return out;
}

function buildRecs() {
  const p = bodyProfile();
  if (!p) return null;
  const sex = db.settings.sex === 'f' ? 'f' : 'm';
  const tr = trainingSummary();
  const goal = pickGoal(p, sex);
  const recs = [];

  if (goal) {
    let d = `${GOALS[goal].d}. `;
    if (p.pbf != null) d += `אחוז השומן שלך (${r1(p.pbf)}%) ${goal === 'cut' ? 'מעל' : goal === 'bulk' ? 'מתחת ל' : 'בתוך'} הטווח ${FAT_BANDS[sex].join('–')}%.`;
    else d += `לפי BMI ${r1(p.bmi)} (${bmiLabel(p.bmi)}). עם אחוז שומן מהדוח ההמלצה תהיה מדויקת יותר.`;
    if (p.ffmi != null) {
      d += p.ffmi < 19 ? ' מדד השריר (FFMI) נמוך יחסית – יש הרבה מקום לבנות שריר, ובשלב הזה מתקדמים מהר.'
        : p.ffmi >= 23 ? ' מדד השריר (FFMI) גבוה – קרוב לתקרה הטבעית, ההתקדמות תהיה איטית ותלויה בעקביות.'
          : ' מדד השריר (FFMI) טוב – יש עוד מקום לגדול בקצב סביר.';
    }
    recs.push({ t: `מטרה מומלצת: ${GOALS[goal].l}`, d });
  }

  // Calories: measured BMR when the report has it, otherwise Katch-McArdle from lean mass, otherwise a per-kg estimate.
  const bmr = p.bmr ?? (p.ffm ? 370 + 21.6 * p.ffm : p.weight * (sex === 'f' ? 20 : 22));
  const pw = tr ? tr.perWeek : 0;
  const tdee = bmr * (pw < 1.5 ? 1.35 : pw < 3.5 ? 1.5 : pw < 5.5 ? 1.6 : 1.75);
  const target = goal === 'cut' ? Math.max(bmr, tdee - 450) : goal === 'bulk' ? tdee + 250 : tdee;
  // Protein per kg; with a BMI over 30 count it on a BMI-25 weight, not on the extra fat.
  const refW = p.bmi >= 30 && p.hm ? 25 * p.hm ** 2 : p.weight;
  const [gLo, gHi] = goal === 'cut' ? [2, 2.4] : goal === 'bulk' ? [1.6, 2] : [1.8, 2.2];
  recs.push({
    t: 'תזונה',
    d: `כ-<b>${round50(target)} קק״ל</b> ביום (תחזוקה משוערת ${round50(tdee)}${goal === 'cut' ? ', גירעון של כ-450' : goal === 'bulk' ? ', עודף של כ-250' : ''}). חלבון: <b>${Math.round(refW * gLo)}–${Math.round(refW * gHi)} גרם</b> ביום, מחולק ל-3–5 ארוחות.`,
  });

  if (p.trend) {
    const { pct, perWeek, smm, weeks } = p.trend;
    let d = `ב-${Math.round(weeks)} השבועות האחרונים: <span dir="ltr">${perWeek > 0 ? '+' : ''}${fmtW(Math.round(perWeek * 100) / 100)}</span> ק״ג בשבוע. `;
    if (goal === 'cut') d += pct > -0.25 ? 'המשקל כמעט לא יורד – הורד עוד כ-200 קק״ל ביום או הוסף 2,000–3,000 צעדים.'
      : pct < -1 ? 'הירידה מהירה מדי ומסכנת שריר – הוסף כ-200 קק״ל ביום.' : 'קצב ירידה מצוין (0.25%–1% מהמשקל בשבוע), המשך כך.';
    else if (goal === 'bulk') d += pct < 0.1 ? 'המשקל לא עולה – הוסף כ-150–200 קק״ל ביום.'
      : pct > 0.6 ? 'העלייה מהירה מדי וחלק ממנה שומן – הורד כ-150 קק״ל ביום.' : 'קצב עלייה טוב לבניית שריר נקי.';
    else d += Math.abs(pct) > 0.5 ? 'המשקל זז מהר מדי לשיפור הרכב גוף – כוון לשמור עליו יציב.' : 'המשקל יציב, כמו שצריך.';
    if (smm != null) d += smm < -0.5 ? ` מסת השריר ירדה ב-${r1(-smm)} ק״ג – הקפד על חלבון ועל משקלים כבדים.`
      : smm > 0.3 ? ` מסת השריר עלתה ב-${r1(smm)} ק״ג – האימונים עובדים.` : '';
    recs.push({ t: 'מגמה', d });
  }

  if (tr) {
    const low = [], high = [];
    for (const [g, [lo, hi]] of Object.entries(AREA_TARGET)) {
      const v = tr.sets.get(g);
      if (v < lo) low.push(`${g} (${r1(v)})`);
      else if (v > hi) high.push(`${g} (${r1(v)})`);
    }
    let d = `ממוצע ${r1(tr.perWeek)} אימונים בשבוע. `;
    d += low.length ? `<b>מתחת לטווח המומלץ</b> (סטים בשבוע): ${low.join(', ')} – הוסף 2–4 סטים בשבוע לכל אחד. ` : 'כל האזורים בטווח המומלץ של סטים שבועיים. ';
    if (high.length) d += `מעל הטווח: ${high.join(', ')} – אם ההתאוששות קשה, אפשר להוריד. `;
    if (goal === 'cut') d += 'בחיטוב שמור על הנפח – אל תוריד סטים בגלל הגירעון.';
    recs.push({ t: 'נפח אימון', d });
    if (tr.perWeek < 2.5) recs.push({ t: 'תדירות', d: 'כדאי להגיע ל-3–4 אימונים בשבוע, כך שכל שריר יעבוד פעמיים בשבוע. זה בונה יותר מאימון ארוך אחד.' });
  } else {
    recs.push({ t: 'נפח אימון', d: 'אין אימונים מ-4 השבועות האחרונים. התחל ב-3 אימונים בשבוע, 10–12 סטים שבועיים לכל אזור גדול.' });
  }

  recs.push({
    t: 'עצימות',
    d: goal === 'cut'
      ? 'שמור על משקלים כבדים ב-6–10 חזרות, 1–2 חזרות לפני כשל. המשקל הכבד הוא מה שאומר לגוף לשמור על השריר בגירעון.'
      : 'רוב הסטים ב-6–12 חזרות, 1–2 חזרות לפני כשל. כשמגיעים לראש טווח החזרות בכל הסטים – מעלים 2.5 ק״ג.',
  });

  const highVisceral = p.visceral != null && p.visceral >= 10;
  recs.push({
    t: 'אירובי',
    d: goal === 'cut' || highVisceral
      ? `2–3 פעמים בשבוע 20–30 דקות בדופק בינוני (הליכה בשיפוע, אופניים) ו-8,000–10,000 צעדים ביום${highVisceral ? `. השומן הוויסצרלי (רמה ${fmtW(p.visceral)}) מעל 10 – אירובי קבוע הוא הדרך היעילה להוריד אותו` : ''}.`
      : '1–2 פעמים בשבוע 20 דקות אירובי קל לבריאות הלב, בלי לפגוע בהתאוששות.',
  });

  return { p, sex, goal, recs, tdee, tr };
}

function viewRecs() {
  const r = buildRecs();
  if (!r) return '';
  const { p, sex, goal } = r;
  const stats = [
    p.bmi != null && [r1(p.bmi), `BMI · ${bmiLabel(p.bmi)}`],
    p.ffmi != null && [r1(p.ffmi), 'FFMI · מדד שריר'],
    p.pbf != null && [`${r1(p.pbf)}<span class="u">%</span>`, 'אחוז שומן'],
    p.ffm != null && [r1(p.ffm), 'מסה רזה (ק״ג)'],
  ].filter(Boolean);
  const ai = db.aiRec, hasKey = !!getApiKey();
  const review = programReview();

  return `
    <div class="card recs">
      <div class="row between"><h3>המלצות לשיפור האימון</h3><button class="icon-btn" data-act="recs-close" aria-label="סגור">✕</button></div>
      <div class="seg" style="margin-top:10px">${[['m', 'גבר'], ['f', 'אישה']].map(([k, l]) => `<button class="${sex === k ? 'on' : ''}" data-act="rec-sex" data-k="${k}">${l}</button>`).join('')}</div>
      ${p.height ? '' : `<div class="card note">חסר גובה – בלעדיו אי אפשר לחשב BMI ומדד שריר. <button class="btn sm" data-act="m-edit" data-id="${p.m.id}">הוסף גובה למדידה</button></div>`}
      ${stats.length ? `<div class="stats">${stats.map(([n, l]) => `<div class="stat"><div class="v" dir="ltr">${n}</div><div class="l">${l}</div></div>`).join('')}</div>` : ''}
      ${r.recs.map((x) => `<div class="rec"><h4>${x.t}</h4><p>${x.d}</p></div>`).join('')}
      ${review.length ? `<h3 class="rec-head">סקירת התרגילים בתוכנית</h3>${review.map((x) => `<div class="rec"><h4>${x.t}</h4><p>${x.d}</p></div>`).join('')}` : ''}
      <p class="muted small" style="margin-bottom:0">לפי ${p.height ? `גובה ${fmtW(p.height)} ס״מ, ` : ''}משקל ${fmtW(p.weight)} ק״ג${p.pbf != null ? ' והרכב הגוף' : ''} מ-${fmtDateFull(p.m.t)} ומהאימונים של 4 השבועות האחרונים. אלה המלצות כלליות, לא תחליף למאמן או לדיאטנית.</p>
    </div>
    <div class="card">
      <h3>המלצות מותאמות מ-Claude</h3>
      <p class="muted small" style="margin:6px 0 10px">Claude יקבל את המדדים, האימונים והתבניות שלך${goal ? ` (מטרה: ${GOALS[goal].l})` : ''}, יעבור על כל תרגיל בתוכנית ויציע שיפורים – מבוסס על חיפוש באתרי הכושר והמחקר המובילים, עם קישורים למקורות.</p>
      ${ui.recLoading
        ? '<div class="center reading"><div class="spinner"></div><div style="margin-top:10px">Claude מנתח את הנתונים…</div></div>'
        : `<button class="btn primary block" data-act="rec-ai">${hasKey ? (ai ? 'בקש המלצות מחדש' : 'קבל המלצות מ-Claude') : 'העתק בקשה ל-Claude'}</button>`}
      ${hasKey ? '' : '<p class="muted small" style="margin-bottom:0">הבקשה תועתק עם הנתונים שלך – הדבק אותה בצ׳אט עם Claude (עם חיפוש באינטרנט מופעל). עם מפתח API (בהגדרות ⚙ למעלה) התשובה והמקורות יופיעו כאן.</p>'}
      ${ai ? `<div class="ai-text">${aiHtml(ai.text)}</div>
        ${ai.sources?.length ? `<div class="sources"><b>מקורות</b>${ai.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><span dir="auto">${esc(x.title || x.url)}</span><span class="muted small" dir="ltr">${esc(hostOf(x.url))}</span></a>`).join('')}</div>` : ''}
        <p class="muted small" style="margin-bottom:0">התקבל ב-${fmtDateFull(ai.t)}</p>` : ''}
    </div>`;
}

// Leading sites for bodybuilding, fat loss and muscle gain, plus research sources. Claude's web search is limited to these.
const REC_DOMAINS = ['strongerbyscience.com', 'bodybuilding.com', 'muscleandstrength.com', 't-nation.com', 'examine.com', 'menshealth.com',
  'barbellmedicine.com', 'nsca.com', 'acsm.org', 'issaonline.com', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov'];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Light formatting of Claude's reply: headings and **bold** in bold, list markers as bullets, the rest as plain text.
const aiHtml = (text) => esc(text)
  .replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/^\s*[-*]\s+/gm, '• ');

function recPrompt() {
  const { p, sex, goal, tdee, tr } = buildRecs();
  const v = (n) => (n == null ? '?' : r1(n));
  const hist = sortedMetrics().slice(0, 8).map((m) => `- ${isoDay(m.t)}: ${MFIELDS.filter((f) => m[f.k] != null).map((f) => `${f.k}=${fmtW(m[f.k])}`).join(', ')}`).join('\n');
  const sets = tr ? [...tr.sets].filter(([, c]) => c).map(([g, c]) => `${g}: ${v(c)}`).join(', ') : 'no workouts logged';
  const review = programReview();
  const strip = (h) => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  const tpls = db.templates.map((t) => `- ${t.name}: ${t.exercises.map((e) => `${e.name} ${e.sets}x${e.reps}${e.w ? ` @${e.w}kg` : ''}, rest ${e.rest}s`).join('; ')}`).join('\n');
  return `I'm a ${sex === 'f' ? 'woman' : 'man'} who lifts weights. Based on my body metrics and training below, give me concrete recommendations to improve and optimize my training.

Body (latest): height ${v(p.height)} cm, weight ${v(p.weight)} kg, body fat ${v(p.pbf)}%, lean mass ${v(p.ffm)} kg, BMI ${v(p.bmi)}, normalized FFMI ${v(p.ffmi)}, visceral fat level ${v(p.visceral)}, BMR ${v(p.bmr)} kcal.
Suggested goal: ${goal ? GOALS[goal].en : 'unknown'}. Estimated maintenance ~${round50(tdee)} kcal.

Measurement history (newest first; pbf = body fat %, smm = skeletal muscle mass kg):
${hist}

Last 4 weeks: ${tr ? `${v(tr.perWeek)} workouts per week. Working sets per week by body area: ${sets}` : sets}.

My workout templates:
${tpls || '- none'}

The app's own automatic review of my templates flagged:
${review.length ? review.map((x) => `- ${strip(x.t)}: ${strip(x.d)}`).join('\n') : '- nothing'}

Go through my program exercise by exercise. For each template say what works, and where you have reservations (exercise choice, order, sets, reps, rest, redundancy, missing muscles or movement patterns, fit with my goal), suggest a concrete improvement or replacement exercise. Then cover weekly volume per muscle group, progression, training frequency, cardio, and daily calories and protein for my numbers.

Base your recommendations on reliable sources: search the leading bodybuilding, fat loss and muscle gain sites and research summaries (${REC_DOMAINS.slice(0, 8).join(', ')}) and rely on what they say rather than on general impressions. Cite the sources you used.

Answer in Hebrew, short and practical, as a bulleted list under a few short headings (one heading per template). No tables.`;
}

async function fetchAiRecs() {
  ui.recLoading = true; render();
  let sdk = null;
  try {
    sdk = await import(SDK_URL).catch(() => { throw new Error('אין חיבור לאינטרנט'); });
    const client = new sdk.default({ apiKey: getApiKey(), dangerouslyAllowBrowser: true });
    // Long searches can pause the turn; send the partial answer back so Claude continues where it stopped.
    const messages = [{ role: 'user', content: recPrompt() }], blocks = [];
    for (let i = 0; i < 5; i++) {
      const res = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8, allowed_domains: REC_DOMAINS }],
        messages,
      });
      if (res.stop_reason === 'refusal') throw new Error('Claude לא החזיר המלצות');
      blocks.push(...res.content);
      if (res.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: res.content });
    }
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) throw new Error('התקבלה תשובה ריקה, נסה שוב');
    // Sources Claude cited; if it cited none, the pages its searches found.
    let sources = blocks.flatMap((b) => (b.type === 'text' && b.citations) || []).filter((c) => c.url).map((c) => ({ url: c.url, title: c.title }));
    if (!sources.length) sources = blocks.filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content)).flatMap((b) => b.content).map((x) => ({ url: x.url, title: x.title }));
    sources = [...new Map(sources.filter((x) => /^https?:/.test(x.url)).map((x) => [x.url, x])).values()].slice(0, 12);
    db.aiRec = { t: Date.now(), text, sources };
    save();
  } catch (e) {
    const err = sdk ? apiError(sdk, e) : e;
    toast(err.message && /[֐-׿]/.test(err.message) ? err.message : 'לא הצלחתי לקבל המלצות', 3500);
  } finally {
    ui.recLoading = false;
    render();
  }
}

// ---------- Exercise demos ----------
// Technique demos come from free-exercise-db (public domain, ~870 exercises, two photos each: start and end position).
// The app alternates the two photos so they play like a short GIF. The chosen demo is saved per exercise name.
const EXDB = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/';
const exImg = (p) => EXDB + 'exercises/' + p;

// Hebrew → English search terms. Checked in order and each match is removed, so specific phrases come before
// the general words they contain.
const HE_EN = [
  ['פשיטת מרפקים בכבל', 'triceps pushdown'], ['פשיטות מרפקים בכבל', 'triceps pushdown'],
  ['לחיצת חזה בשיפוע שלילי', 'decline bench press'], ['לחיצת חזה בשיפוע', 'incline bench press'],
  ['לחיצת חזה', 'bench press'], ['לחיצת כתפיים', 'shoulder press'], ['לחיצה צבאית', 'military press'],
  ['לחיצת רגליים', 'leg press'], ['לחיצה', 'press'],
  ['דדליפט רומני', 'romanian deadlift'], ['דדליפט', 'deadlift'],
  ['סקוואט בולגרי', 'split squat'], ['סקוואט קדמי', 'front squat'], ['גובלט', 'goblet squat'], ['סקוואט', 'squat'],
  ['הרמות רגליים בתלייה', 'hanging leg raise'], ['הרמת רגליים בתלייה', 'hanging leg raise'],
  ['הרמת עקבים', 'calf raise'], ['הרמות עקבים', 'calf raise'],
  ['פשיטת ברכיים', 'leg extensions'], ['פשיטות ברכיים', 'leg extensions'],
  ['כפיפת ברכיים', 'leg curl'], ['כפיפות ברכיים', 'leg curl'],
  ['כפיפת מרפקים', 'curl'], ['כפיפות מרפקים', 'curl'], ['פטיש', 'hammer curl'],
  ['פשיטת מרפקים', 'triceps extension'], ['פשיטות מרפקים', 'triceps extension'], ['פרנץ', 'triceps extension'],
  ['סקאל קראשר', 'skullcrusher'], ['פשיטת גב', 'hyperextensions'], ['היפר', 'hyperextensions'],
  ['פולי עליון', 'lat pulldown'], ['פולי תחתון', 'seated cable rows'], ['פולי', 'lat pulldown'],
  ['חתירה', 'row'], ['מתח', 'pullups'], ['מכרעים', 'lunge'], ['מכרע', 'lunge'], ['לאנג', 'lunge'],
  ['היפ טראסט', 'hip thrust'], ['גשר ישבן', 'glute bridge'],
  ['הרחקת ירכיים', 'thigh abductor'], ['קירוב ירכיים', 'thigh adductor'],
  ['הרחקה לצדדים', 'lateral raise'], ['הרחקות לצדדים', 'lateral raise'], ['הרחקה', 'lateral raise'], ['הרחקות', 'lateral raise'],
  ['הרמה קדמית', 'front raise'], ['ארנולד', 'arnold press'], ['פייס פול', 'face pull'], ['שראג', 'shrug'],
  ['פרפר הפוך', 'reverse fly'], ['פרפר', 'fly'], ['פק דק', 'pec deck'], ['בטרפליי', 'butterfly'],['קרוס אובר', 'crossover'], ['פול אובר', 'pullover'], ['מקבילים', 'dips'],
  ['שכיבות סמיכה', 'pushups'], ['פלאנק', 'plank'], ['כפיפות בטן', 'crunch'], ['קראנץ', 'crunch'], ['כפיפות גו', 'crunch'],
  ['בשיפוע', 'incline'], ['מוט', 'barbell'], ['משקולות', 'dumbbell'], ['משקולת', 'dumbbell'], ['דאמבל', 'dumbbell'],
  ['כבל', 'cable'], ['מכונה', 'machine'], ['מכונת', 'machine'], ['סמית', 'smith'], ['קטלבל', 'kettlebell'],
  ['עליות על ספסל', 'step up'], ['עליות על קופסה', 'step up'], ['אחיזה רחבה', 'wide grip'], ['אחיזה צרה', 'close grip'],
  ['רחבה', 'wide'], ['רחב', 'wide'], ['צרה', 'narrow close'], ['צר', 'narrow close'],
  ['גומי', 'bands'], ['ישיבה', 'seated'], ['עמידה', 'standing'], ['שכיבה', 'lying'], ['יד אחת', 'one arm'],
];
const hasHebrew = (s) => /[֐-׿]/.test(s);
const HE_STOP = ['עם', 'של', 'על', 'את', 'או', 'ו', 'ב', 'ל', 'ה'];
// Dictionary translation, plus the Hebrew words it didn't know (left for the automatic translator).
function splitHebrew(q) {
  q = String(q || '');
  const out = [];
  for (const [he, en] of HE_EN) if (q.includes(he)) { out.push(en); q = q.split(he).join(' '); }
  const rest = (q.match(/[֐-׿]+/g) || []).filter((w) => !HE_STOP.includes(w));
  // Keep any Latin words the name already had (e.g. "לחיצת חזה Smith").
  return { dict: [...out, ...(q.match(/[a-z0-9]+/gi) || [])].join(' '), rest: rest.join(' ') };
}

// Automatic Hebrew → English through MyMemory (free, no key). Returns its translations, best first.
const mtCache = new Map();
async function machineTranslate(text) {
  if (!mtCache.has(text)) {
    const p = fetch(`https://api.mymemory.translated.net/get?langpair=he|en&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r) => [r.responseData?.translatedText, ...(r.matches || []).filter((m) => m.match >= 0.5).map((m) => m.translation)]
        .filter((t) => t && !hasHebrew(t) && !/MYMEMORY WARNING/i.test(t)));
    p.catch(() => mtCache.delete(text));
    mtCache.set(text, p);
  }
  return mtCache.get(text).catch(() => []);
}

const cleanQuery = (s) => String(s).toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t && !EN_STOP.includes(t)).join(' ');
// A few English versions of what was typed: the gym dictionary (with the words it didn't know translated
// automatically), then automatic translations of the whole phrase. The first one is searched by default.
async function translateVariants(q) {
  q = String(q || '').trim();
  if (!hasHebrew(q)) return q ? [q] : [];
  const { dict, rest } = splitHebrew(q);
  const [restTr, fullTr] = await Promise.all([rest ? machineTranslate(rest) : [], machineTranslate(q)]);
  const variants = [
    dict && restTr[0] ? `${dict} ${restTr[0]}` : '',
    dict,
    ...fullTr.slice(0, 3),
  ].map(cleanQuery).filter(Boolean);
  return [...new Set(variants)].slice(0, 4);
}

// Plural "s" is dropped on both sides so "pullups" matches "Pullup", and spelling variants share one token.
// Filler words ("in the machine") are dropped so they don't count as matches or misses.
const TOKEN_SYN = { flye: 'fly', flie: 'fly', db: 'dumbbell', bb: 'barbell', chinup: 'pullup', abdominal: 'ab', abs: 'ab' };
const EN_STOP = ['a', 'an', 'the', 'in', 'on', 'of', 'to', 'for', 'and', 'with', 'at', 'by', 'from', 'your'];
const exTokens = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !EN_STOP.includes(t))
  .map((t) => (t.length > 3 ? t.replace(/s$/, '') : t)).map((t) => TOKEN_SYN[t] || t);
// Words people search by that the database's name for the exercise doesn't contain.
const EX_ALIASES = [
  [/butterfly/i, 'fly pec deck chest'], [/pulldown/i, 'lat pull down'], [/pushdown/i, 'push down'],
  [/^pullup|^v-bar pullup/i, 'pull up'], [/^chin-up/i, 'pullup pull up'], [/^push-?up/i, 'pushup'],
  [/skull ?crusher/i, 'lying triceps extension'], [/romanian/i, 'rdl'], [/leg extension/i, 'quad'],
];
const EQUIP = { machine: 'machine', cable: 'cable', barbell: 'barbell', dumbbell: 'dumbbell', kettlebells: 'kettlebell', bands: 'band', 'body only': 'bodyweight', 'e-z curl bar': 'ez', 'exercise ball': 'ball', 'medicine ball': 'ball' };
const GROUP_MUSCLES = {
  'חזה': ['chest'], 'גב': ['lats', 'middle back', 'lower back', 'traps'], 'כתפיים': ['shoulders'],
  'רגליים': ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  'יד קדמית': ['biceps', 'forearms'], 'יד אחורית': ['triceps'], 'בטן': ['abdominals'],
};
const PLAIN_WORDS = ['medium', 'grip', 'version']; // describe the standard form, so no penalty
// Words in the name count most, then equipment and aliases; exercises for the app's body area of the exercise
// get a boost, and every name word the search didn't ask for costs a little ("Reverse Flyes" for "fly").
function searchExercises(list, q, group) {
  const words = exTokens(q);
  if (!words.length) return [];
  const qt = [...new Set(words)];
  const pairs = words.slice(1).map((w, i) => words[i] + w); // "pull up" also finds "Pullups"
  const muscles = GROUP_MUSCLES[group] || [];
  return list.map((x) => {
    const nt = exTokens(x.name);
    const extra = exTokens([EQUIP[x.equipment] || '', ...EX_ALIASES.filter(([re]) => re.test(x.name)).map(([, a]) => a)].join(' '));
    let score = 0;
    for (const t of qt) {
      score += nt.includes(t) ? 3 : extra.includes(t) ? 2 : t.length > 2 && nt.some((n) => n.startsWith(t) || (n.length > 2 && t.startsWith(n))) ? 1 : 0;
    }
    for (const p of pairs) if (nt.includes(p)) score += 3;
    if (!score) return null;
    if ((x.primaryMuscles || []).some((m) => muscles.includes(m))) score += 3;
    score -= nt.filter((n) => !qt.includes(n) && !pairs.includes(n) && !PLAIN_WORDS.includes(n)).length * 0.3;
    return { x, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 20).map((r) => r.x);
}

let exList = null;
function loadExercises() {
  exList ||= fetch(EXDB + 'dist/exercises.json').then((r) => { if (!r.ok) throw new Error(); return r.json(); });
  exList.catch(() => { exList = null; }); // retry on the next search
  return exList;
}

const demoAnim = (images, big) => `
  <div class="demo-anim ${big ? 'big' : ''}" dir="ltr">
    <img src="${esc(exImg(images[0]))}" alt="" loading="lazy" crossorigin="anonymous">
    ${images[1] ? `<img src="${esc(exImg(images[1]))}" alt="" loading="lazy" crossorigin="anonymous">` : ''}
  </div>`;

function openDemo(name) {
  if (!name.trim()) { toast('קודם תן שם לתרגיל'); return; }
  ui.demo = { name, q: name, variants: [], vi: 0, vq: null, results: null, loading: false, error: '', picking: !db.demos[name] };
  renderSheet();
  if (ui.demo.picking) runDemoSearch();
}

// Translates the search box (only when its text changed) and searches with the chosen translation.
async function runDemoSearch(vi = 0) {
  const d = ui.demo;
  d.picking = true;
  d.loading = true; d.error = ''; d.results = null; d.vi = vi;
  renderSheet();
  try {
    const fresh = d.vq !== d.q;
    const [list, variants] = await Promise.all([loadExercises(), fresh ? translateVariants(d.q) : d.variants]);
    // Drop translations that find nothing ("voltage" for מתח), unless none of them find anything.
    const useful = fresh ? variants.filter((v) => searchExercises(list, v, groupOf(d.name)).length) : variants;
    d.variants = useful.length ? useful : variants; d.vq = d.q;
    const q = variants[d.vi] || '';
    d.results = q ? searchExercises(list, q, groupOf(d.name)) : [];
    if (!d.results.length) d.error = q ? 'לא נמצאו תרגילים. נסה תרגום אחר או מילים אחרות.' : 'לא הצלחתי לתרגם. בדוק את החיבור לאינטרנט או כתוב באנגלית.';
  } catch {
    d.error = 'אין חיבור לאינטרנט. החיפוש צריך רשת.';
  }
  d.loading = false;
  if (ui.demo === d) renderSheet();
}

function viewDemo() {
  const d = ui.demo;
  const saved = db.demos[d.name];
  let body;
  if (!d.picking && saved) {
    body = `
      ${demoAnim(saved.images, true)}
      <div class="demo-en" dir="ltr">${esc(saved.name)}</div>
      ${saved.instructions?.length ? `<ol class="demo-steps" dir="ltr">${saved.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <div class="row" style="margin-top:12px">
        <button class="btn sm" data-act="demo-change">החלף הדגמה</button>
        <button class="btn sm danger" data-act="demo-clear">הסר</button>
      </div>`;
  } else {
    const results = d.loading
      ? '<div class="center" style="padding:24px 0"><div class="spinner"></div></div>'
      : d.error ? `<p class="muted small">${esc(d.error)}</p>`
      : (d.results || []).map((x) => `
        <button class="demo-pick" data-act="demo-pick" data-id="${esc(x.id)}">
          ${demoAnim(x.images)}
          <span class="demo-en" dir="ltr">${esc(x.name)}</span>
          <span class="muted small">${esc(x.equipment || '')}</span>
        </button>`).join('');
    body = `
      <div class="row">
        <input type="search" class="grow" data-f="demo-q" id="demo-q" value="${esc(d.q)}" placeholder="שם התרגיל (עברית או אנגלית)" dir="auto" enterkeyhint="search">
        <button class="btn" data-act="demo-search">חפש</button>
      </div>
      ${d.variants.length > 1 || (d.variants.length && hasHebrew(d.vq || '')) ? `
        <div class="muted small" style="margin-top:10px">תרגומים לאנגלית (לחץ כדי לחפש):</div>
        <div class="demo-variants" dir="ltr">${d.variants.map((v, k) => `<button class="chip ${k === d.vi ? 'on' : ''}" data-act="demo-variant" data-k="${k}">${esc(v)}</button>`).join('')}</div>` : ''}
      <p class="muted small" style="margin:8px 0 0">בחר את ההדגמה המתאימה. היא תישמר לתרגיל הזה.</p>
      <div class="demo-grid">${results}</div>
      ${saved ? '<button class="btn block" data-act="demo-back">חזרה להדגמה השמורה</button>' : ''}`;
  }
  return `
    <div class="sheet-panel" data-act="none" role="dialog" aria-modal="true" aria-label="הדגמת תרגיל">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="row between" style="margin-bottom:12px">
        <h3 class="grow">${esc(d.name)}</h3>
        <button class="icon-btn" data-act="demo-close" aria-label="סגור">✕</button>
      </div>
      ${body}
    </div>`;
}

function renderSheet() {
  const el = $('#sheet');
  el.classList.toggle('hidden', !ui.demo);
  document.body.classList.toggle('sheet-open', !!ui.demo);
  el.innerHTML = ui.demo ? viewDemo() : '';
}

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

// Sticky elements below the top bar need its real height (it grows with the iPhone notch).
const topbarObs = new ResizeObserver(([e]) => document.documentElement.style.setProperty('--top-h', `${e.target.offsetHeight}px`));
topbarObs.observe(document.querySelector('.topbar'));

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  let title, html;
  document.querySelector('.gear').classList.toggle('on', ui.tab === 'settings');
  switch (ui.tab) {
    case 'settings': title = 'הגדרות'; html = viewSettings(); break;
    case 'history': title = 'היסטוריה'; html = viewHistory(); break;
    case 'progress': title = 'התקדמות'; html = viewProgress(); break;
    case 'body':
      title = ui.mdraft ? (ui.mdraft.isNew ? 'מדידה חדשה' : 'עריכת מדידה') : 'מדדי גוף';
      html = viewMetrics();
      break;
    // Templates live inside the workout tab: the editor opens over the start screen or the active workout and returns to it.
    default:
      if (ui.draft) { title = ui.draft.isNew ? 'תבנית חדשה' : 'עריכת תבנית'; html = viewEditor(); }
      else { title = db.active ? 'אימון פעיל' : 'אימון'; html = db.active ? viewActive() : viewStart(); }
  }
  $('#title').textContent = title;
  $('#view').innerHTML = html;
  openRow = null;
  tick();
}

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
  if (!name || name === ex.name) { toast('בחר או הקלד תרגיל חלופי'); return; }
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
  ui.swap = null;
  save(); render();
  toast(`הוחלף ל${name}`);
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
  ui.swap = null;
  save(); render();
  toast(`חזרת ל${origin}`);
}

function saveAlt(e, name) {
  name = String(name || '').trim();
  const ex = db.active.exercises[e];
  if (!name || name === ex.name) { toast('הקלד שם של תרגיל חלופי'); return; }
  const origin = rememberAlt(ex, name);
  save(); render();
  toast(`נשמר כחלופה ל${origin}`);
}

function startWorkout(tpl) {
  if (!confirm(`להתחיל את "${tpl ? tpl.name : 'אימון חופשי'}"? שעון האימון יתחיל לרוץ.`)) return;
  db.active = {
    id: uid(),
    templateId: tpl ? tpl.id : null,
    name: tpl ? tpl.name : 'אימון חופשי',
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

function finishWorkout() {
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
    if (confirm('לא סומן אף סט כבוצע (✓). לבטל את האימון בלי לשמור?')) discardWorkout(true);
    return;
  }
  if (undone && !confirm(`${undone} סטים מולאו אבל לא סומנו ב-✓, והם לא יישמרו. לסיים בכל זאת?`)) return;

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
    if (sig(updated) !== sig(tpl.exercises) && confirm(`שינית את המבנה של "${tpl.name}" באימון הזה (תרגילים, סטים או מנוחה). לעדכן את התבנית?`)) {
      tpl.exercises = updated;
    }
    // Keep each template exercise's weight at the heaviest working weight just done.
    for (const x of tpl.exercises) {
      const done = exercises.find((e) => e.name === x.name);
      const top = done && Math.max(0, ...work(done.sets).map((s) => s.w));
      if (top) x.w = top;
    }
  }

  let start = w.start, end = Date.now();
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
  db.workouts.push({ id: w.id, templateId: w.templateId, name: w.name || 'אימון', start, end, exercises, ...(stretch ? { stretch } : {}) });
  db.active = null;
  stopTimer();
  save();
  releaseWakeLock();
  render();
  window.scrollTo(0, 0);
  toast(prs.length ? `שיא חדש: ${prs.join(', ')}` : 'האימון נשמר', prs.length ? 4000 : 2600);
}

function discardWorkout(skipConfirm) {
  if (!skipConfirm && !confirm('לבטל את האימון? מה שהוזן לא יישמר.')) return;
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
  if (el && db.active) el.textContent = backdated(db.active) ? '' : fmtDur(Date.now() - db.active.start);

  const box = $('#timer');
  if (!timer) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const leftMs = timer.end - Date.now();
  const left = Math.ceil(leftMs / 1000);
  const over = left <= 0;
  box.classList.toggle('over', over);
  $('#timer-label').textContent = timer.label || 'מנוחה';
  $('#timer-time').textContent = over ? (timer.stretch ? 'כל הכבוד!' : 'יאללה!') : fmtDur(left * 1000);
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
setInterval(tick, 250);

// Keep the screen awake during a workout (supported on recent iOS versions).
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && db.active && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { wakeLock = null; }
}
function releaseWakeLock() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { requestWakeLock(); tick(); } });

// ---------- Backup ----------
async function exportData() {
  const json = JSON.stringify(db, null, 2);
  const name = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'גיבוי אימונים' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.templates) || !Array.isArray(d.workouts)) throw new Error('bad');
      if (!confirm(`לשחזר ${d.workouts.length} אימונים ו-${d.templates.length} תבניות? הנתונים הנוכחיים יוחלפו.`)) return;
      db = { ...seed(), ...d, settings: { ...seed().settings, ...(d.settings || {}) } };
      save();
      render();
      toast('הגיבוי שוחזר');
    } catch { toast('הקובץ לא תקין'); }
  };
  reader.readAsText(file);
}

// ---------- Events ----------
document.addEventListener('click', (ev) => {
  unlockAudio();
  const tabBtn = ev.target.closest('[data-tab]');
  if (tabBtn) {
    const t = tabBtn.dataset.tab;
    // The gear toggles: a second tap returns to the tab you came from.
    if (t === 'settings' && ui.tab === 'settings') ui.tab = ui.prevTab || 'workout';
    else { if (t === 'settings') ui.prevTab = ui.tab; ui.tab = t; }
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const e = +el.dataset.e, s = +el.dataset.s, i = +el.dataset.i;
  const ex = db.active && db.active.exercises[e];

  switch (act) {
    case 'start': startWorkout(db.templates.find((t) => t.id === el.dataset.id)); break;
    case 'start-empty': startWorkout(null); break;
    case 'finish': finishWorkout(); break;
    case 'discard': discardWorkout(); break;

    case 'set-done': {
      const set = ex.sets[s];
      if (!set.done) {
        // Empty weight: use last time's value, or carry over the previous set's weight.
        if (set.w === '') set.w = set.pw || (s > 0 && !ex.sets[s - 1].wu ? ex.sets[s - 1].w : '');
        if (set.r === '') set.r = set.pr;
        if (num(set.r) == null) { toast('הזן מספר חזרות'); return; }
        set.done = true;
        if (!backdated(db.active)) startTimer(ex.rest);
      } else {
        set.done = false;
      }
      save(); render();
      break;
    }
    case 'fail': {
      const set = ex.sets[s];
      set.fail = !set.fail;
      save(); render();
      if (set.fail) {
        toast('הסט סומן כ"עד כשל" – הזן כמה חזרות עשית', 2000);
        if (set.r === '') document.querySelector(`input[data-f="r"][data-e="${e}"][data-s="${s}"]`)?.focus();
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
      save();
      break;
    }
    case 'set-add': {
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({ w: '', r: '', pw: last ? (last.w || last.pw) : '', pr: last ? (last.r || last.pr) : '', done: false });
      save(); render();
      break;
    }
    case 'set-del':
      if (confirm(`למחוק את סט ${s + 1} של "${ex.name}"?`)) { ex.sets.splice(s, 1); save(); render(); }
      break;
    case 'wu-add': {
      const first = ex.sets.find((x) => !x.wu);
      ex.sets.unshift(makeWarmup(ex.name, first && (num(first.w) ?? num(first.pw))));
      save(); render();
      break;
    }
    case 'ex-del':
      if (confirm(`להסיר את "${ex.name}" מהאימון?`)) { db.active.exercises.splice(e, 1); ui.swap = null; save(); render(); }
      break;
    case 'swap-open': ui.swap = ui.swap === e ? null : e; render(); break;
    case 'unswap': unswapExercise(e); break;
    case 'swap-pick':swapExercise(e, el.dataset.n); break;
    case 'swap-custom': swapExercise(e, $('#swap-name').value); break;
    case 'alt-save': saveAlt(e, $('#swap-name').value); break;
    case 'ex-rest': {
      const v = num(prompt('זמן מנוחה בשניות לתרגיל הזה:', ex.rest));
      if (v && v > 0) { ex.rest = Math.round(v); save(); render(); }
      break;
    }
    case 'ex-add': {
      const name = $('#new-ex').value.trim();
      if (!name) return;
      db.active.exercises.push(makeExercise({ name }, db.active.exercises.length === 0));
      save(); render();
      break;
    }

    case 'stretch-go': {
      const phase = el.dataset.ph, x = findStretch(phase, el.dataset.id);
      const label = `מתיחה: ${x.name}`, end = { stretch: x.id, phase };
      startTimer(x.hold, x.sides
        ? { label: `${label} · צד 1`, next: { label: `${label} · צד 2`, ...end } }
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
      if (!d.name.trim()) { toast('תן שם לתבנית'); return; }
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
      toast('התבנית נשמרה');
      break;
    }
    case 'tex-add': ui.draft.exercises.push({ id: uid(), name: '', sets: 2, reps: 8, rest: db.settings.defaultRest }); render(); break;
    case 'tex-del': {
      const n = ui.draft.exercises[i].name.trim();
      if (confirm(n ? `להסיר את "${n}" מהתבנית?` : 'להסיר את התרגיל מהתבנית?')) { ui.draft.exercises.splice(i, 1); render(); }
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
      if (confirm('למחוק את האימון מההיסטוריה?')) { db.workouts = db.workouts.filter((w) => w.id !== el.dataset.id); save(); render(); }
      break;
    case 'hist-tpl': {
      const w = db.workouts.find((x) => x.id === el.dataset.id);
      const name = prompt('שם לתבנית החדשה:', w.name);
      if (!name) return;
      db.templates.push({
        id: uid(), name: name.trim(),
        exercises: w.exercises.filter((x) => work(x.sets).length).map((x) => ({
          id: uid(), name: x.name, sets: work(x.sets).length, reps: work(x.sets)[0].r, rest: db.settings.defaultRest,
        })),
      });
      save(); toast('נשמרה תבנית חדשה');
      break;
    }

    case 'metric': ui.progMetric = el.dataset.k; render(); break;
    case 'music-app': db.settings.musicApp = el.dataset.k; save(); render(); break;
    case 'area-period': ui.areaPeriod = el.dataset.k; render(); break;

    case 'body-metric': ui.bodyMetric = el.dataset.k; render(); break;
    case 'recs-open': ui.recsOpen = true; render(); break;
    case 'recs-close': ui.recsOpen = false; render(); break;
    case 'rec-sex': db.settings.sex = el.dataset.k; save(); render(); break;
    case 'rec-ai':
      if (getApiKey()) fetchAiRecs();
      else copyText(recPrompt()).then((ok) => toast(ok ? 'הבקשה הועתקה עם הנתונים שלך. הדבק אותה בצ׳אט עם Claude' : 'ההעתקה נכשלה', 3500));
      break;
    case 'm-upload':
      if (!getApiKey()) { toast('כדי לקרוא תמונות צריך להזין מפתח Claude API בהגדרות', 3500); ui.tab = 'settings'; render(); window.scrollTo(0, 0); $('[data-f="apikey"]')?.focus(); return; }
      $('#m-file').click();
      break;
    case 'paste-open': ui.pasteOpen = true; render(); break;
    case 'paste-close': ui.pasteOpen = false; ui.pasteText = ''; render(); break;
    case 'paste-copy':
      copyText(CHAT_PROMPT).then((ok) => toast(ok ? 'ההוראה הועתקה. עכשיו פתח את Claude' : 'ההעתקה נכשלה'));
      break;
    case 'paste-read':
      if (!navigator.clipboard?.readText) { $('#paste-text').focus(); return; }
      navigator.clipboard.readText()
        .then((t) => { ui.pasteText = t; render(); importPasted(); })
        .catch(() => { toast('אין גישה ללוח, הדבק ידנית בתיבה'); $('#paste-text')?.focus(); });
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
      if (confirm('למחוק את המדידה?')) { db.metrics = db.metrics.filter((m) => m.id !== ui.mdraft.id); ui.mdraft = null; save(); render(); }
      break;
    case 'demo': openDemo(el.dataset.e != null ? ex.name : ui.draft.exercises[i].name); break;
    case 'demo-close': ui.demo = null; renderSheet(); break;
    case 'bateman': openBateman(); break;
    case 'bateman-close': closeBateman(); break;
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
      if (!confirm(`להסיר את ההדגמה של "${ui.demo.name}"?`)) return;
      delete db.demos[ui.demo.name];
      ui.demo = null;
      save(); render(); renderSheet();
      break;
    case 'export': exportData(); break;
    case 'import': $('#import-file').click(); break;
  }
});

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
    case 'wname': db.active.name = el.value; save(); break;
    case 'wmins': db.active.mins = el.value; save(); break;
    case 'defrest': { const v = num(el.value); if (v && v > 0) { db.settings.defaultRest = Math.round(v); save(); } break; }
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
  }
});

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
    save(); render(); toast('התאריך עודכן');
  }
  if (el.dataset.f === 'set-lastfail') { db.settings.lastSetFail = el.checked; save(); }
  if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
  if (el.id === 'm-file' && el.files[0]) { handleReportFile(el.files[0]); el.value = ''; }
  if (el.dataset.f === 'm-hist') ui.mdraft.history[+el.dataset.i].add = el.checked;
  if (el.dataset.f === 'apikey') render(); // refresh the "saved" mark
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.id === 'new-ex') $('[data-act="ex-add"]').click();
  if (ev.key === 'Enter' && ev.target.id === 'swap-name') $('[data-act="swap-custom"]').click();
  if (ev.key === 'Enter' && ev.target.id === 'demo-q') { ev.target.blur(); runDemoSearch(); }
  if (ev.key === 'Escape' && ui.demo) { ui.demo = null; renderSheet(); }
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
// Drag a set row sideways (either direction). Past the threshold it stays open over a "מחק" button;
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
  swipe = { g, id: ev.pointerId, x: ev.clientX, y: ev.clientY, base: g === openRow ? +g.dataset.off : 0, off: 0, active: false };
});

document.addEventListener('pointermove', (ev) => {
  if (!swipe || ev.pointerId !== swipe.id) return;
  const dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
  if (!swipe.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; } // vertical scroll
    if (Math.abs(dx) < 10) return;
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

// ---------- Boot ----------
if (db.active) requestWakeLock();
render();
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
