'use strict';

// ---------- Language ----------
// Hebrew (right to left) or Swedish (left to right), picked in settings. Switching reloads the app.
const LANG_KEY = 'gym-tracker-lang';
const LANG = (() => { try { return localStorage.getItem(LANG_KEY) === 'sv' ? 'sv' : 'he'; } catch { return 'he'; } })();
const SV = LANG === 'sv';
const L = (he, sv) => (SV ? sv : he);
const LOC = L('he-IL', 'sv-SE');
const DIR = L('rtl', 'ltr');
document.documentElement.lang = LANG;
document.documentElement.dir = DIR;
// Errors whose message is already written for the user (the rest get a generic one).
const uiErr = (msg) => Object.assign(new Error(msg), { ui: true });

// Body areas are stored by their Hebrew name; this is how they're shown.
const GROUP_SV = { 'חזה': 'Bröst', 'גב': 'Rygg', 'כתפיים': 'Axlar', 'רגליים': 'Ben', 'יד קדמית': 'Biceps', 'יד אחורית': 'Triceps', 'בטן': 'Mage', 'אחר': 'Övrigt' };
const gName = (g) => (SV && GROUP_SV[g]) || g;
// The app's own exercise names in both languages. Names are stored as typed; known ones are shown in the current
// language, and the matching rules (body area, muscles, demo search) run on the Hebrew name.
const EX_PAIRS = [
  ['לחיצת חזה במוט', 'Bänkpress med skivstång'], ['לחיצת חזה במשקולות', 'Bänkpress med hantlar'],
  ['לחיצת חזה בשיפוע במשקולות', 'Lutande bänkpress med hantlar'], ['לחיצת חזה במכונה', 'Bröstpress i maskin'],
  ['פרפר בכבל', 'Flyes i kabel'], ['פק דק', 'Pec deck'], ['מקבילים', 'Dips'], ['שכיבות סמיכה', 'Armhävningar'],
  ['חתירה במוט', 'Skivstångsrodd'], ['חתירה במשקולת', 'Hantelrodd'], ['פולי עליון', 'Latsdrag'], ['פולי תחתון', 'Sittande kabelrodd'],
  ['מתח', 'Chins'], ['חתירה במכונה', 'Rodd i maskin'], ['פול אובר בכבל', 'Pullover i kabel'],
  ['לחיצת כתפיים במשקולות', 'Axelpress med hantlar'], ['לחיצת כתפיים במכונה', 'Axelpress i maskin'], ['לחיצה צבאית', 'Militärpress'],
  ['הרחקה לצדדים', 'Sidolyft'], ['הרחקה לצדדים בכבל', 'Sidolyft i kabel'], ['פייס פול', 'Face pulls'], ['פרפר הפוך', 'Omvända flyes'],
  ['סקוואט', 'Knäböj'], ['לחיצת רגליים', 'Benpress'], ['סקוואט בסמית', 'Knäböj i smithmaskin'], ['סקוואט גובלט', 'Gobletknäböj'],
  ['מכרעים', 'Utfall'], ['סקוואט בולגרי', 'Bulgarisk splitknäböj'], ['דדליפט רומני', 'Rumänska marklyft'], ['כפיפת ברכיים', 'Lårcurl'],
  ['פשיטת ברכיים', 'Benspark'], ['היפ טראסט', 'Höftlyft'], ['הרמת עקבים', 'Tåhävningar'],
  ['כפיפת מרפקים', 'Bicepscurl'], ['כפיפת מרפקים במשקולות', 'Bicepscurl med hantlar'], ['כפיפת מרפקים בכבל', 'Bicepscurl i kabel'], ['פטיש', 'Hammarcurl'],
  ['פשיטת מרפקים בכבל', 'Triceps pushdown'], ['פרנץ', 'Fransk press'], ['סקאל קראשר', 'Skullcrushers'], ['פשיטת מרפקים מעל הראש בכבל', 'Triceps overhead i kabel'],
  ['פלאנק', 'Plankan'], ['כפיפות בטן', 'Crunches'], ['הרמות רגליים בתלייה', 'Hängande benlyft'], ['כפיפות בטן בכבל', 'Crunches i kabel'],
  // From the exercise library
  ['לחיצת חזה בשיפוע במוט', 'Lutande bänkpress med skivstång'], ['פרפר במשקולות', 'Flyes med hantlar'], ['שראג', 'Shrugs'],
  ['ארנולד פרס', 'Arnoldpress'], ['כפיפת מרפקים בשיפוע', 'Lutande hantelcurl'], ['כפיפת מרפקים בכיסא כומר', 'Scottcurl'],
  ['כפיפת מרפקים בריכוז', 'Koncentrationscurl'], ['פשיטת מרפקים לאחור במשקולת', 'Kickback med hantel'],
  ['כפיפות בטן במכונה', 'Crunches i maskin'], ['גלגלת בטן', 'Magrulle'], ['האק סקוואט', 'Hackknäböj'],
  ['כפיפת ברכיים בישיבה', 'Sittande lårcurl'], ['הרמת עקבים בישיבה', 'Sittande tåhävningar'],
  ['פרפר בשיפוע במשקולות', 'Lutande flyes med hantlar'], ['פרפר בשיפוע בכבל', 'Lutande flyes i kabel'],
  ['לחיצת חזה בירידה', 'Nedåtlutande bänkpress'], ['לחיצת חזה בירידה במשקולות', 'Nedåtlutande bänkpress med hantlar'],
  ['מתח באחיזה הפוכה', 'Chins med underhandsgrepp'], ['פולי עליון באחיזה צרה', 'Latsdrag med smalt grepp'],
  ['חתירת טי בר', 'T-bar-rodd'], ['שראג במשקולות', 'Shrugs med hantlar'], ['פשיטת גב', 'Ryggresningar'], ['דדליפט', 'Marklyft'],
  ['הרמה קדמית במשקולות', 'Framåtlyft med hantlar'], ['חתירה לסנטר', 'Upprättstående rodd'],
  ['פרפר הפוך במשקולות', 'Omvända flyes med hantlar'], ['פרפר הפוך בכבל', 'Omvända flyes i kabel'],
  ['כפיפת מרפקים באחיזה צרה', 'Bicepscurl med smalt grepp'], ['כפיפת מרפקים באחיזה הפוכה', 'Omvänd curl'],
  ['כפיפת שורש כף היד', 'Handledscurl'], ['פשיטת מרפקים בכבל עם חבל', 'Triceps pushdown med rep'], ['לחיצת חזה צרה', 'Smal bänkpress'],
  ['הרמות רגליים בשכיבה', 'Liggande benlyft'], ['כפיפות בטן הפוכות', 'Omvända crunches'], ['טוויסט רוסי', 'Rysk twist'],
  ['פלאנק צידי', 'Sidoplanka'], ['כפיפות צד במשקולת', 'Sidoböjningar med hantel'], ['בעיטת ישבן בכבל', 'Kickback för säte i kabel'],
  ['מקרבים במכונה', 'Adduktormaskin'], ['מרחיקים במכונה', 'Abduktormaskin'], ['הרמת עקבים בלחיצת רגליים', 'Tåhävningar i benpress'],
];
const HE2SV = new Map(EX_PAIRS), SV2HE = new Map(EX_PAIRS.map(([he, sv]) => [sv, he]));
const stockName = (he) => (SV && HE2SV.get(he)) || he; // one of the app's own names, in the current language
const exName = (n) => (SV ? HE2SV.get(n) : SV2HE.get(n)) || n; // a stored name as shown
const canon = (n) => SV2HE.get(n) || n;

// ---------- Storage ----------
const KEY = 'gym-tracker-v1';
const TIMER_KEY = 'gym-tracker-timer';
const DEFAULT_SETTINGS = { defaultRest: 90, exRest: 150, lastSetFail: true, musicApp: 'spotify', showMusic: true, weeklyGoal: 4 };
const WEIGHT_STEP = 2.5;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);

function seed() {
  const ex = (name, sets, reps, rest) => ({ id: uid(), name: stockName(name), sets, reps, rest });
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    templates: [
      {
        id: uid(), name: L('אימון A – פלג גוף עליון', 'Pass A – överkropp'), exercises: [
          ex('לחיצת חזה במוט', 4, 8, 120), ex('חתירה במוט', 4, 8, 120), ex('לחיצת כתפיים במשקולות', 3, 10, 90),
          ex('מתח', 3, 8, 90), ex('כפיפת מרפקים', 3, 12, 60), ex('פשיטת מרפקים בכבל', 3, 12, 60),
        ],
      },
      {
        id: uid(), name: L('אימון B – פלג גוף תחתון', 'Pass B – underkropp'), exercises: [
          ex('סקוואט', 4, 6, 150), ex('דדליפט רומני', 3, 8, 120), ex('לחיצת רגליים', 3, 10, 90),
          ex('מכרעים', 3, 10, 90), ex('הרמת עקבים', 4, 12, 60),
        ],
      },
    ],
    workouts: [],
    metrics: [],
    cardio: [],
    rest: [],
    notes: {},
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
if (!Array.isArray(db.cardio)) db.cardio = []; // { id, t, type, mins, km?, kcal }
if (!Array.isArray(db.rest)) db.rest = []; // days marked as rest days, as YYYY-MM-DD
if (!db.muscles || typeof db.muscles !== 'object') db.muscles = {}; // exercise name -> body area, when set by hand
if (!db.demos || typeof db.demos !== 'object') db.demos = {}; // exercise name -> chosen technique demo
if (!db.alts || typeof db.alts !== 'object') db.alts = {}; // exercise name -> alternatives used when it's taken
if (!db.notes || typeof db.notes !== 'object') db.notes = {}; // exercise name -> standing note ("seat on 4"), shown every workout
// Injury periods { id, from, to, note }: YYYY-MM-DD, `to` is the last injured day and null while it's ongoing.
// Injury days don't count against the weekly goal, the streak or the per-week averages.
if (!Array.isArray(db.injuries)) db.injuries = [];
const activeInjury = () => db.injuries.find((x) => !x.to) || null;
const injuredOn = (iso) => db.injuries.some((x) => iso >= x.from && (!x.to || iso <= x.to));

// ---------- Body areas ----------
const GROUPS = ['חזה', 'גב', 'כתפיים', 'רגליים', 'יד קדמית', 'יד אחורית', 'בטן', 'אחר'];
const GROUP_HINTS = [
  ['בטן', /הרמות רגליים|כפיפות בטן|טוויסט|אלכסונ/],
  ['כתפיים', /חתירה לסנטר|הרמה קדמית/],
  ['יד אחורית', /לחיצת חזה צרה/],
  ['רגליים', /סקוואט|רגל|מכרע|עקב|ירך|לאנג|דדליפט|היפ|ישבן|תאומ|גובלט|מקרב|מרחיק/],
  ['חזה', /חזה|פרפר|מקבילים|שכיבות סמיכה|פלאי/],
  ['גב', /חתיר|מתח|פולי|גב|פול ?אובר|שראג|משיכ/],
  ['כתפיים', /כתפ|הרחק|פייס|ארנולד/],
  ['יד קדמית', /כפיפת מרפק|כפיפות מרפק|בייספס|יד קדמית|פטיש/],
  ['יד אחורית', /פשיטת מרפק|פשיטות מרפק|טרייספס|יד אחורית|פרנץ|סקאל/],
  ['בטן', /בטן|פלאנק|כפיפות גו|קראנץ|הרמות רגליים בתלייה/],
  // Swedish and English names typed by hand
  ['רגליים', /knäböj|benpress|benspark|utfall|tåhäv|vad|lår|höft|marklyft|squat|lunge|leg press|calf|glute|deadlift/i],
  ['חזה', /bröst|bänk|flyes|armhävning|pec|bench|chest|push.?up/i],
  ['גב', /rodd|chins|latsdrag|rygg|pullover|shrug|row|pull.?up|pulldown/i],
  ['כתפיים', /axel|sidolyft|militärpress|face ?pull|arnold|shoulder|lateral/i],
  ['יד קדמית', /biceps|hammarcurl|hammer|curl/i],
  ['יד אחורית', /triceps|fransk press|skull|pushdown|dips/i],
  ['בטן', /mage|plank|crunch|situp|benlyft/i],
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
const STRETCH_SV = {
  Dynamic_Chest_Stretch: ['Dynamisk armöppning', 'Raka armar framåt, för dem bakåt så långt det går och tillbaka – som en överdriven klapp.'],
  Arm_Circles: ['Armcirklar', 'Raka armar ut åt sidorna, små cirklar som blir större. Byt håll halvvägs.'],
  Dynamic_Back_Stretch: ['Armsving uppåt', 'Raka armar, sving dem framifrån upp över huvudet, lite högre varje gång.'],
  Cat_Stretch: ['Katt-ko', 'På alla fyra, runda ryggen uppåt och svanka sedan nedåt, långsamt i takt med andningen.'],
  Shoulder_Circles: ['Axelrullningar', 'Avslappnade armar, rulla axlarna framåt, uppåt, bakåt och nedåt. Sedan åt andra hållet.'],
  Round_The_World_Shoulder_Stretch: ['Stav över huvudet', 'Brett grepp om en stav, för den långsamt framifrån till bakom ryggen och tillbaka.'],
  Front_Leg_Raises: ['Bensving', 'Håll i något, sving ett rakt ben fram och bak, lite längre varje gång.'],
  Standing_Hip_Circles: ['Höftcirklar', 'Stå på ett ben, lyft knät till 90° och rita en stor cirkel utåt med det.'],
  Worlds_Greatest_Stretch: ['Världens bästa stretch', 'Djupt utfall, armbågen mot den främre fotleden, vrid sedan och öppna armen mot taket.'],
  Elbow_Circles: ['Armbågscirklar', 'Händerna på axlarna, armbågarna ut åt sidorna, rita stora cirklar med armbågarna.'],
  Wrist_Circles: ['Handledscirklar', 'Armarna ut åt sidorna, rotera händerna i cirklar åt båda hållen.'],
  Torso_Rotation: ['Bålrotation', 'Raka armar framåt (gärna med en boll), vrid överkroppen från sida till sida, höften stilla.'],
  Windmills: ['Liggande väderkvarn', 'På rygg, armarna ut åt sidorna. För ett ben över kroppen mot motsatt hand, och tillbaka.'],
  Elbows_Back: ['Armbågar bakåt', 'Händerna på ländryggen, dra armbågarna bakåt som om de ska nudda varandra.'],
  Chest_And_Front_Of_Shoulder_Stretch: ['Stav bakom huvudet', 'Brett grepp om en stav, lyft den långsamt upp och bakom huvudet tills det sträcker i bröstet.'],
  Childs_Pose: ['Barnets position', 'Knäna i golvet, rumpan mot hälarna, armarna sträckta framåt.'],
  One_Arm_Against_Wall: ['Lats mot väggen', 'Böjd armbåge mot väggen eller dörrkarmen, luta kroppen mot den tills det sträcker i sidan av ryggen.'],
  Upper_Back_Stretch: ['Rund övre rygg', 'Fläta fingrarna, runda axlarna och tryck armarna framåt.'],
  Shoulder_Stretch: ['Arm över bröstet', 'Dra en rak arm tvärs över bröstet med andra handen, axeln nere.'],
  Overhead_Stretch: ['Sträck uppåt', 'Fläta fingrarna, handflatorna mot taket, raka armar uppåt och axlarna nere.'],
  Standing_Elevated_Quad_Stretch: ['Framsida lår mot bänk', 'Ryggen mot bänken, bakre foten på den, böj det främre benet lätt och skjut höften framåt.'],
  Seated_Floor_Hamstring_Stretch: ['Sittande baksida lår', 'Ett ben rakt, det andra böjt, rak rygg och fäll framåt från höften mot fotleden.'],
  Kneeling_Hip_Flexor: ['Höftböjare på knä', 'Bakre knät i golvet, spänn rumpan och för vikten framåt.'],
  Ankle_On_The_Knee: ['Liggande säte (fyran)', 'Fotleden på andra knät, dra det undre låret mot bröstet.'],
  Calf_Stretch_Hands_Against_Wall: ['Vader mot väggen', 'Händerna mot väggen, bakre benet rakt och hälen i golvet.'],
  Standing_Biceps_Stretch: ['Händer bakom ryggen', 'Fläta händerna bakom ryggen, sträck armbågarna, vrid handflatorna nedåt och lyft långsamt.'],
  Kneeling_Forearm_Stretch: ['Underarmar på knä', 'Handflatorna i golvet med fingrarna mot knäna, luta dig långsamt bakåt.'],
  Triceps_Stretch: ['Triceps bakom huvudet', 'Handen bakom huvudet, dra armbågen försiktigt med andra handen.'],
  Standing_Lateral_Stretch: ['Sidoböj', 'En hand på höften, den andra bakom huvudet, böj åt sidan utan att vrida dig.'],
};
const st = (img, name, hold, how, sides = false) => {
  const [svName, svHow] = (SV && STRETCH_SV[img]) || [name, how];
  return { id: img, img, name: svName, hold, how: svHow, sides };
};
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
  // Starts folded the way the sections were last left (someone who always skips the stretches isn't shown them open each time).
  if (!w.fold) w.fold = { pre: !!db.settings.stretchFold?.pre, post: !!db.settings.stretchFold?.post };
  return w.stretch;
}

// Check a stretch off (or back on). Finishing the last one folds the section away.
function markStretch(w, phase, id, on) {
  const s = stretchState(w);
  s[phase] = on ? [...new Set([...s[phase], id])] : s[phase].filter((x) => x !== id);
  if (on && stretchesFor(w, phase).every((x) => s[phase].includes(x.id))) w.fold[phase] = true;
}
const guessGroup = (name) => (GROUP_HINTS.find(([, re]) => re.test(canon(name || ''))) || ['אחר'])[0];
const groupOf = (name) => db.muscles[name] || guessGroup(name);
// Template-editor exercises can carry an area picked in the editor before it's saved.
const draftGroup = (e) => e.group || groupOf(e.name);
// Indices grouped by body area, areas in order of first appearance, exercise order kept within each area.
// contiguous: group only neighbors, so an area can show up more than once (the live workout, where order is the user's).
function areaRuns(list, areaOf, contiguous) {
  if (contiguous) {
    const runs = [];
    list.forEach((x, i) => { const a = areaOf(x), last = runs[runs.length - 1]; if (last && last[0] === a) last[1].push(i); else runs.push([a, [i]]); });
    return runs;
  }
  const runs = new Map();
  list.forEach((x, i) => { const a = areaOf(x); if (!runs.has(a)) runs.set(a, []); runs.get(a).push(i); });
  return [...runs];
}
const areaDivider = (area, n) => `<div class="area-div"><b>${gName(area)}</b><span>${n === 1 ? L('תרגיל אחד', '1 övning') : `${n} ${L('תרגילים', 'övningar')}`}</span></div>`;

// ---------- Muscles worked ----------
// Muscle keys are free-exercise-db's, so a picked demo's own muscle list can be used as is.
const MUSCLE_NAMES = SV ? {
  chest: 'Bröst', shoulders: 'Axlar', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Underarmar', abdominals: 'Mage',
  lats: 'Lats', 'middle back': 'Mellersta ryggen', 'lower back': 'Ländrygg', traps: 'Trapezius', neck: 'Nacke',
  quadriceps: 'Framsida lår', hamstrings: 'Baksida lår', glutes: 'Säte', calves: 'Vader', adductors: 'Adduktorer', abductors: 'Abduktorer',
  'chest:upper': 'Övre bröst', 'chest:mid': 'Mellersta bröst', 'chest:lower': 'Nedre bröst',
  'shoulders:front': 'Främre axel', 'shoulders:side': 'Sidoaxel', 'shoulders:rear': 'Bakre axel',
  'biceps:long': 'Biceps, långa huvudet', 'biceps:short': 'Biceps, korta huvudet',
  'triceps:long': 'Triceps, långa huvudet', 'triceps:lat': 'Triceps, laterala huvudet',
  'abdominals:upper': 'Övre mage', 'abdominals:lower': 'Nedre mage', 'abdominals:obliques': 'Sneda bukmuskler',
} : {
  chest: 'חזה', shoulders: 'כתפיים', triceps: 'יד אחורית', biceps: 'יד קדמית', forearms: 'אמות', abdominals: 'בטן',
  lats: 'רחב גבי', 'middle back': 'גב אמצעי', 'lower back': 'גב תחתון', traps: 'טרפזים', neck: 'צוואר',
  quadriceps: 'ארבע ראשי', hamstrings: 'המסטרינג', glutes: 'ישבן', calves: 'תאומים', adductors: 'מקרבים', abductors: 'מרחיקים',
  // Parts of a muscle ("muscle:part"); the figures light just that part.
  'chest:upper': 'חזה עליון', 'chest:mid': 'חזה אמצעי', 'chest:lower': 'חזה תחתון',
  'shoulders:front': 'כתף קדמית', 'shoulders:side': 'כתף צידית', 'shoulders:rear': 'כתף אחורית',
  'biceps:long': 'יד קדמית, ראש ארוך', 'biceps:short': 'יד קדמית, ראש קצר',
  'triceps:long': 'יד אחורית, ראש ארוך', 'triceps:lat': 'יד אחורית, ראש צידי',
  'abdominals:upper': 'בטן עליונה', 'abdominals:lower': 'בטן תחתונה', 'abdominals:obliques': 'אלכסונים',
};
// [name pattern, primary, secondary], most specific first.
const MUSCLE_HINTS = [
  [/פרפר הפוך|פייס פול/, ['shoulders:rear'], ['traps', 'middle back']],
  [/חתירה לסנטר/, ['shoulders:side', 'traps'], ['shoulders:front']],
  [/הרמה קדמית/, ['shoulders:front'], ['shoulders:side']],
  [/לחיצת חזה צרה/, ['triceps'], ['chest', 'shoulders:front']],
  [/מקבילים/, ['triceps', 'chest:lower'], ['shoulders:front', 'chest:mid']],
  [/(חזה|פרפר) בשיפוע/, ['chest:upper'], ['shoulders:front', 'triceps']],
  [/חזה בירידה/, ['chest:lower', 'chest:mid'], ['triceps', 'shoulders:front']],
  [/פרפר|פק דק|פלאי/, ['chest'], ['shoulders:front']],
  [/חזה|שכיבות סמיכה/, ['chest'], ['shoulders:front', 'triceps']],
  [/הרחק/, ['shoulders:side'], ['traps']],
  [/כתפ|צבאית|ארנולד/, ['shoulders:front', 'shoulders:side'], ['triceps', 'traps']],
  [/שראג/, ['traps'], ['forearms']],
  [/פול ?אובר/, ['lats'], ['chest', 'triceps']],
  [/מתח|פולי עליון/, ['lats'], ['biceps', 'middle back']],
  [/חתיר|פולי תחתון/, ['middle back', 'lats'], ['biceps', 'traps', 'shoulders:rear']],
  [/פשיטת גב|היפראקסט/, ['lower back'], ['glutes', 'hamstrings']],
  [/פלאנק/, ['abdominals'], ['shoulders', 'lower back']],
  [/טוויסט|אלכסונ/, ['abdominals:obliques'], ['abdominals']],
  [/הרמות רגליים|כפיפות בטן הפוכות/, ['abdominals:lower'], ['abdominals:upper']],
  [/כפיפות בטן|קראנץ/, ['abdominals:upper'], ['abdominals:lower']],
  [/בטן|כפיפות גו/, ['abdominals'], []],
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
  [/מעל הראש|פרנץ/, ['triceps:long'], ['triceps:lat']],
  [/פשיטת מרפק|פשיטות מרפק|טרייספס|סקאל/, ['triceps'], []],
];
// When the name says nothing more specific: what the body area mostly works.
const AREA_MUSCLES = {
  'חזה': [['chest'], ['shoulders:front', 'triceps']], 'גב': [['lats', 'middle back'], ['biceps', 'traps']],
  'כתפיים': [['shoulders'], ['triceps', 'traps']], 'רגליים': [['quadriceps', 'glutes'], ['hamstrings', 'calves']],
  'יד קדמית': [['biceps'], ['forearms']], 'יד אחורית': [['triceps'], []], 'בטן': [['abdominals'], []],
};
// The chosen demo's muscles if it has them, else the name's, else the body area's.
function musclesFor(name, area = groupOf(name)) {
  const d = db.demos[name];
  if (d?.pm?.length) return { p: d.pm, s: (d.sm || []).filter((m) => !d.pm.includes(m)) };
  const hit = MUSCLE_HINTS.find(([re]) => re.test(canon(name || '')));
  const [p, s] = hit ? hit.slice(1) : AREA_MUSCLES[area] || [[], []];
  return { p, s };
}

// Front and back figures. Each part is [muscle, part of it, outline of the left half]; the right half is the same
// outline mirrored unless the fourth item is false. A muscle lights up when the list names it ("chest") or this
// part of it ("chest:upper"). Parts with no muscle are skin: head, hands, knees and feet.
// The whole body's outline, under the muscles, so the seams between them read as body and not as holes.
const BODY_SIL = ['', '', 'M50 26L45.2 27.2L44.6 31.2L36 33.8L27.2 35.2L22 40L19.8 48L19.4 58L19 70L20.4 79L16 90L14.6 104L16 106.2L19.8 106L25 90L27 80L29.4 66L30 56L32 58L33.2 68L34.5 80L36.4 88L31.4 100L30.4 116L31.4 130L35 140L35.4 146L33.2 160L34 175L36.8 192L41.8 192L44 178L45 162L45 148L46 140L47.6 125L48.8 105L49.6 99.4L50 99.4z'];
const BODY_FIG = {
  front: [
    BODY_SIL,
    ['', '', 'M50 3.6c-5.6 0-9.3 4.4-9.3 10.6 0 4.2 1.6 7.6 4 9.6l.3 4.6h10l.3-4.6c2.4-2 4-5.4 4-9.6 0-6.2-3.7-10.6-9.3-10.6z', false],
    ['', '', 'M15.4 105.6c-2.4 2.6-3.4 6.2-2.8 9.8.4 2.4 1.6 4 3.2 4 1.9 0 3.3-2.3 3.6-5.4l.4-8.2z'],
    ['', '', 'M36 139.8c-.6 3.2.6 6.4 3 7.9 2.6 1.3 5 .2 6-2.7l.7-5c-3 1.6-6.4 1.6-9.7-.2z'],
    ['', '', 'M37.2 192l4.6.2c.9 3 2.2 6.2 2 8.8-.2 1.4-1.6 2.2-3.4 2.2h-6c-1.4 0-2-1.2-1.2-2.8z'],
    ['traps', '', 'M45.2 27.6Q41 31.6 34.5 34.2L44.6 35.2z'],
    ['shoulders', 'front', 'M34.5 34.6Q27.5 34.4 24.6 39.2Q27.6 44 28.4 51.6Q30.6 44.6 35.6 41.4z'],
    ['shoulders', 'side', 'M24.3 39.5Q20.4 43.4 20.6 50.4Q21.8 54.6 24.3 57Q27 55 28.1 52.2Q27.2 44.2 24.3 39.5z'],
    ['chest', 'upper', 'M49.3 36.4L36.8 36.3Q33.6 38.6 32.6 42.6Q41 41 49.3 41.6z'],
    ['chest', 'mid', 'M49.3 42.3Q41 41.7 32.5 43.3Q31.4 47 32 50.2Q41 48.8 49.3 49.4z'],
    ['chest', 'lower', 'M49.3 50.1Q41 49.5 32.2 50.9Q33.4 54.6 36.4 56.4Q43 58.4 49.3 55.8z'],
    ['biceps', 'long', 'M24.6 57.6Q21.2 59.6 20.4 66.4Q20 73.6 21.8 78.6L24.6 77.6Q24.4 68 26 58.2z'],
    ['biceps', 'short', 'M26.3 57.6Q24.8 68 24.9 77.6Q27.6 76.6 28.6 70.6Q29.6 62.6 28.6 53.4Q27.4 55.6 26.3 57.6z'],
    ['forearms', '', 'M21.2 80.4Q17.4 84 16.2 92Q15.2 99.6 15.4 105.6L19.8 106Q23 98.4 25.2 90.2Q26.8 84.4 26.2 79Q23.6 79 21.2 80.4z'],
    ['abdominals', 'obliques', 'M36.4 57.4Q33.4 60.8 33.6 68.4Q34.2 78.4 37.2 86Q40 89.6 42.6 90.6L42.4 57.8Q39.4 57 36.4 57.4z'],
    ['abdominals', 'upper', 'M43.6 57.6Q46.4 56.8 49.3 57.2V64.2H43.6z'],
    ['abdominals', 'upper', 'M43.6 65.2H49.3V71.8H43.6z'],
    ['abdominals', 'lower', 'M43.6 72.8H49.3V80H43.7z'],
    ['abdominals', 'lower', 'M43.7 81H49.3V96.6Q45.4 93.4 43.7 88z'],
    ['quadriceps', '', 'M37.2 91Q31.2 100 31 116Q31.6 130 35.8 139.4Q41 142.6 45.8 138.4Q47.6 125 46.6 111L43.8 97.6Q41 92.6 37.2 91z'],
    ['quadriceps', '', 'M45.6 125.6Q42.4 130.6 42.2 136.6Q44.2 139.4 45.8 138.4Q47.2 132 45.6 125.6z'],
    ['adductors', '', 'M44 97.6L46.6 111Q47.8 104.6 49 99.6V96.6Q46.2 95.2 44 97.6z'],
    ['calves', '', 'M36.2 150Q33 160 33.8 172Q35.4 184 37.4 191.6L41.4 191.8Q44 178.4 44.6 165Q44.8 155 42.6 148.4Q39 147.6 36.2 150z'],
  ],
  back: [
    BODY_SIL,
    ['', '', 'M50 3.6c-5.6 0-9.3 4.4-9.3 10.6 0 4.2 1.6 7.6 4 9.6l.3 4.6h10l.3-4.6c2.4-2 4-5.4 4-9.6 0-6.2-3.7-10.6-9.3-10.6z', false],
    ['', '', 'M15.4 105.6c-2.4 2.6-3.4 6.2-2.8 9.8.4 2.4 1.6 4 3.2 4 1.9 0 3.3-2.3 3.6-5.4l.4-8.2z'],
    ['', '', 'M36.8 144.6Q40.8 146.8 44.8 145L44.4 148Q40.6 149.4 37.2 147.8z'],
    ['', '', 'M37 192L42 192Q43 197 42 202L36.6 202Q35.6 197 37 192z'],
    ['traps', '', 'M50 26.6L44.6 29.8Q39.4 33 33.6 35.4Q39.8 39.4 44.2 45.6L50 58.6z'],
    ['shoulders', 'rear', 'M33.4 35.8Q26.4 35.6 23 40.6Q22.6 46.4 23.6 52Q27.4 46.4 31.6 44Q34.6 41.4 33.4 35.8z'],
    ['shoulders', 'side', 'M22.8 40.8Q19.6 45.6 20.6 52.8L23.4 52.4Q22.4 46.6 22.8 40.8z'],
    ['middle back', '', 'M31.6 44.6Q28.4 48.6 30.2 53.4Q35.4 55.4 40.4 53.6L43.8 46.4Q38.4 41.8 31.6 44.6z'],
    ['middle back', '', 'M44.4 47Q42.6 51.4 41.2 54.6Q45.4 59.6 49.3 61.4V59.6z'],
    ['lats', '', 'M30.4 54.6Q29.2 62.4 32 72Q35.6 81.6 41.6 88L44.4 86.6V66.4Q42.6 60 40.8 55Q35.4 56.6 30.4 54.6z'],
    ['lower back', '', 'M45 64.4Q44.4 77 45 91.4Q47.4 93.4 49.3 93.4V62.6Q47 62.8 45 64.4z'],
    ['triceps', 'lat', 'M23.4 53.4Q20 58.4 19.6 66Q19.8 73.2 21.8 78.2L24.8 76.4Q24.4 66 26.4 56.4z'],
    ['triceps', 'long', 'M26.6 56.2Q24.6 66 25.1 76.2L28.4 78.8Q30 70 29.4 58.4Q28.2 55.2 26.6 56.2z'],
    ['forearms', '', 'M21.2 80.4Q17.4 84 16.2 92Q15.2 99.6 15.4 105.6L19.8 106Q23 98.4 25.2 90.2Q26.8 84.4 26.2 79Q23.6 79 21.2 80.4z'],
    ['abductors', '', 'M36.4 87.6Q32.4 91.6 32.6 99.6Q35.2 95 38.2 92.8Q40.2 90.4 42.2 89.2Q39.4 87 36.4 87.6z'],
    ['glutes', '', 'M49.3 94.4Q44 91 38.2 93.2Q33.2 98 33.6 106Q36 114 43 114.4Q47.6 113.6 49.3 110.4z'],
    ['hamstrings', '', 'M34.2 115.4Q31.6 125 33 136Q35 142 38.6 144L41 140Q40 128 41 116.2Q37.6 116.6 34.2 115.4z'],
    ['hamstrings', '', 'M41.4 116.2Q40.4 128 41.4 140L44.6 143Q47.2 135 47.1 124Q47 117.4 45.2 114.4Q43.4 115.8 41.4 116.2z'],
    ['adductors', '', 'M47.4 116Q48.4 122 47.6 130L49 128V113.6z'],
    ['calves', '', 'M34.6 170.8Q36.2 182 37.6 191.6L41.8 191.8Q43.8 182 45 171Q43 176 40.8 173.4Q38.6 176 34.6 170.8z'],
    ['calves', '', 'M35.6 148.2Q32.2 155.6 33 165Q34.8 172 38.6 174.2L40.6 168.4V149.2Q38 147.6 35.6 148.2z'],
    ['calves', '', 'M41 149.2V168.4L42.8 174.4Q46.2 168.4 46.2 158.4Q45.8 150.4 43 147.6Q42 148.6 41 149.2z'],
  ],
};
// Hair and spine on the back figure, so the two sides read apart at a glance.
// Thin lines inside the muscles (where one head meets the next), both sides, so the figure reads like an anatomy chart.
const BODY_DETAIL = {
  front: 'M26.4 41.4Q24.8 46.4 25.6 52.4M22.6 84Q20 92 18 102M35 62.4L39.6 63.8M34.6 68.4L39.8 69.8M35.2 74.4L40.2 75.8'
    + 'M38.8 98.4Q36.6 114 37.8 132M43.2 100.4Q42.6 112 43.8 124M39.4 154Q38.4 168 39.4 186',
  back: 'M33.2 62Q37 68 42 72M34.6 72Q38.6 77 43 80M22.6 84Q20 92 18 102M37.4 104Q42.4 108 48.6 107.4M28.2 42.6Q27 46 27.4 49',
};
const detail = (side) => ['', ' transform="matrix(-1 0 0 1 100 0)"'].map((t) => `<path class="det" d="${BODY_DETAIL[side]}"${t}/>`).join('');
const BODY_MARKS = {
  front: detail('front'),
  back: detail('back') + '<path class="hair" d="M41 12.6Q41.2 4 50 3.6Q58.8 4 59 12.6Q55 9.4 50 9.4Q45 9.4 41 12.6z"/><path class="spine" d="M50 27V93"/>',
};
const figHit = (list, mu, part) => list.includes(mu) || (!!part && list.includes(`${mu}:${part}`));
// The figure's SVG. m: {p, s}, the muscles (or muscle parts) to light as primary and secondary.
// tap: each muscle becomes a button for the exercise library's body map.
function bodyFig(side, m, tap = false) {
  const flip = ' transform="matrix(-1 0 0 1 100 0)"';
  return `<svg class="fig${tap ? ' tap' : ''}" viewBox="0 0 100 206" aria-hidden="true">${BODY_FIG[side].map(([mu, part, d, both = true]) => {
    const c = mu ? `mu${figHit(m.p, mu, part) ? ' mp' : figHit(m.s || [], mu, part) ? ' ms' : ''}` : 'sk';
    const a = tap && mu ? ` data-act="lib-map" data-mu="${mu}" data-part="${part}"` : '';
    return `<path class="${c}" d="${d}"${a}/>${both ? `<path class="${c}" d="${d}"${flip}${a}/>` : ''}`;
  }).join('')}${BODY_MARKS[side]}</svg>`;
}
const bodySvg = (side, m, label) => `<figure class="body-fig">${bodyFig(side, m)}<figcaption>${label}</figcaption></figure>`;
const muscleNames = (list) => list.map((k) => MUSCLE_NAMES[k] || k).join(', ');
const muscleMap = (name, area) => muscleMapOf(musclesFor(name, area));
function muscleMapOf(m) {
  if (!m.p.length) return '';
  return `
    <div class="muscles">
      <div class="muscle-figs" aria-hidden="true">${bodySvg('front', m, L('קדימה', 'Framsida'))}${bodySvg('back', m, L('אחורה', 'Baksida'))}</div>
      <div class="muscle-list">
        <div><i class="dot mp"></i><b>${L('ראשי:', 'Primära:')}</b> ${esc(muscleNames(m.p))}</div>
        ${m.s.length ? `<div><i class="dot ms"></i><b>${L('משני:', 'Sekundära:')}</b> ${esc(muscleNames(m.s))}</div>` : ''}
      </div>
    </div>`;
}

// Saved alternatives first, then exercises from the same body area (ones done before ahead of the stock list).
function altsFor(name) {
  const g = groupOf(name);
  const inWorkout = new Set((db.active?.exercises || []).map((e) => e.name));
  const known = allExerciseNames().filter((n) => groupOf(n) === g);
  const list = [...(db.alts[name] || []), ...known, ...(ALT_POOL[g] || []).map(stockName)];
  return [...new Set(list)].filter((n) => n && n !== name && !inWorkout.has(n)).slice(0, 10);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast(L('שגיאה בשמירת הנתונים', 'Kunde inte spara datan')); }
}

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- Helpers ----------
const ui = { tab: 'workout', draft: null, progEx: null, progMetric: 'e1rm', mdraft: null, bodyMetric: 'pbf', reading: false, pasteOpen: false, pasteText: '', recsOpen: false, recLoading: false, histOpen: new Set() };

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmtW = (w) => (Math.round(w * 100) / 100).toString();
const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const setLabel = (s) => (s.w ? `${fmtW(s.w)} × ${s.r}` : `${s.r} ${L('חזרות', 'reps')}`);

function fmtDur(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
const fmtDate = (ts) => new Date(ts).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'numeric' });
const fmtDateShort = (ts) => new Date(ts).toLocaleDateString(LOC, { day: 'numeric', month: 'numeric' });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });

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
// Intensity: the average working-set weight as a % of the exercise's best estimated 1RM up to that workout.
// Bodyweight sets (no weight) are left out; null when nothing in the workout was weighted.
function intensity(w) {
  const best = (name) => Math.max(0, ...db.workouts.filter((x) => x.start <= w.start)
    .flatMap((x) => x.exercises.filter((e) => e.name === name).flatMap((e) => work(e.sets)))
    .filter((s) => s.w > 0).map((s) => e1rm(s.w, s.r)));
  const pct = w.exercises.flatMap((e) => {
    const b = best(e.name);
    return b ? work(e.sets).filter((s) => s.w > 0).map((s) => s.w / b) : [];
  });
  return pct.length ? Math.round(100 * pct.reduce((a, x) => a + x, 0) / pct.length) : null;
}
const chip = (s, cls = '') => (s.wu
  ? `<span class="chip wu"><span dir="${DIR}">${L('חימום', 'Uppv.')}</span> ${setLabel(s)}</span>`
  : `<span class="chip ${cls} ${s.fail ? 'fail' : ''}">${setLabel(s)}${s.fail ? ` <span dir="${DIR}">${L('כשל', 'Fail')}</span>` : ''}</span>`);
// Inline (non-chip) version for the "last time" line.
const prevLabel = (s) => `<span dir="ltr">${setLabel(s)}</span>${s.fail ? ` <span class="t-fail">${L('כשל', 'Fail')}</span>` : ''}`;

let toastTimer;
// action: { label, run } adds a button to the toast, e.g. "undo" after a delete.
function toast(msg, ms = 2600, action = null) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => { t.classList.add('hidden'); action.run(); });
    t.append(b);
  }
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// In-app dialog in place of the browser's confirm() / prompt(), which look like iOS system alerts.
// Resolves true / false, or with `input` the typed text (null when cancelled).
// extra: a third button's label; picking it resolves to 'extra'.
function ask({ title, msg = '', ok = L('אישור', 'OK'), cancel = L('ביטול', 'Avbryt'), danger = false, input = null, extra = null }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const box = document.createElement('div');
    box.className = 'dlg';
    box.innerHTML = `<div class="dlg-card${danger ? ' danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"${msg ? ' aria-describedby="dlg-m"' : ''}>
      <h2 id="dlg-t">${esc(title)}</h2>
      ${msg ? `<p id="dlg-m">${esc(msg)}</p>` : ''}
      ${input ? `<input type="${input.type === 'number' ? 'number" inputmode="numeric' : input.type === 'date' ? `date" max="${esc(input.max || '')}` : 'text'}" value="${esc(input.value)}" aria-labelledby="dlg-t">` : ''}
      <div class="dlg-btns">
        <button class="btn" data-k="no">${esc(cancel)}</button>
        ${extra ? `<button class="btn" data-k="extra">${esc(extra)}</button>` : ''}
        <button class="btn ${danger ? 'danger-fill' : 'primary'}" data-k="yes">${esc(ok)}</button>
      </div>
    </div>`;
    const field = box.querySelector('input');
    const done = (yes, k) => {
      box.classList.add('out');
      document.body.classList.remove('dlg-open');
      setTimeout(() => box.remove(), 140);
      prev?.focus?.({ preventScroll: true });
      resolve(k === 'extra' ? 'extra' : input ? (yes ? field.value.trim() : null) : yes);
    };
    // Handled here and kept from the app's own click / key handlers underneath.
    box.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (box.classList.contains('out')) return;
      const k = ev.target.closest('[data-k]')?.dataset.k;
      if (k) done(k === 'yes', k);
      else if (ev.target === box) done(false);
    });
    box.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (box.classList.contains('out')) return;
      if (ev.key === 'Escape') done(false);
      else if (ev.key === 'Enter' && ev.target === field) done(true);
      else if (ev.key === 'Tab') {
        const els = [...box.querySelectorAll('input, button')];
        const i = els.indexOf(document.activeElement);
        const j = (i + (ev.shiftKey ? -1 : 1) + els.length) % els.length;
        ev.preventDefault();
        els[j].focus();
      }
    });
    document.body.append(box);
    document.body.classList.add('dlg-open');
    // A destructive action starts on "cancel", so Enter alone can't delete anything.
    const first = field || box.querySelector(danger ? '[data-k="no"]' : '[data-k="yes"]');
    first.focus({ preventScroll: true });
    if (field && field.type !== 'date') field.select();
  });
}
