'use strict';

// Training recommendations: the app's own rules and the Claude review.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Training recommendations ----------
// Rule-of-thumb guidance from the latest body metrics (height, weight, body fat) and the last four weeks of training.
const DAY_MS = 86400000, WEEK_MS = 7 * DAY_MS;
// Weekly working sets per area that most lifters grow well on.
const AREA_TARGET = { 'חזה': [10, 20], 'גב': [10, 20], 'רגליים': [10, 20], 'כתפיים': [8, 16], 'יד קדמית': [6, 12], 'יד אחורית': [6, 12], 'בטן': [4, 10] };
// Body fat %: below the first number there's room to build, above the second it's worth cutting first.
const FAT_BANDS = { m: [12, 20], f: [21, 30] };
const GOALS = {
  cut: { l: L('חיטוב', 'Deff'), d: L('להוריד שומן ולשמור על השריר', 'Gå ner i fett och behålla musklerna'), en: 'lose fat while keeping muscle' },
  recomp: { l: L('שיפור הרכב גוף', 'Bättre kroppssammansättning'), d: L('לבנות שריר בלי לעלות בשומן', 'Bygga muskler utan att gå upp i fett'), en: 'build muscle without gaining fat' },
  bulk: { l: L('מסה נקייה', 'Ren bulk'), d: L('לבנות שריר בעודף קלורי קטן', 'Bygga muskler med ett litet kaloriöverskott'), en: 'build muscle in a small calorie surplus' },
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

const bmiLabel = (b) => (b < 18.5 ? L('תת-משקל', 'Undervikt') : b < 25 ? L('תקין', 'Normal') : b < 30 ? L('עודף משקל', 'Övervikt') : L('השמנה', 'Fetma'));
const round50 = (n) => Math.round(n / 50) * 50;
const r1 = (n) => fmtW(Math.round(n * 10) / 10);

// Movement patterns a balanced program covers, with a stock exercise to suggest when one is missing.
const PATTERNS = [
  { k: 'hpush', l: L('דחיקה אופקית (חזה)', 'Horisontell press (bröst)'), re: /לחיצת חזה|שכיבות סמיכה|מקבילים|bänkpress|bröstpress|armhävning|bench|chest press|push.?up|\bdips?\b/i, add: stockName('לחיצת חזה במשקולות') },
  { k: 'vpush', l: L('דחיקה אנכית (כתפיים)', 'Vertikal press (axlar)'), re: /לחיצת כתפיים|לחיצה צבאית|ארנולד|axelpress|militärpress|overhead press|shoulder press|military/i, add: stockName('לחיצת כתפיים במשקולות') },
  { k: 'hpull', l: L('משיכה אופקית (חתירה)', 'Horisontellt drag (rodd)'), re: /חתיר|פולי תחתון|rodd|\brow/i, add: stockName('חתירה במשקולת') },
  { k: 'vpull', l: L('משיכה אנכית (מתח)', 'Vertikalt drag (chins)'), re: /מתח|פולי עליון|chins|latsdrag|pull.?up|chin.?up|pulldown/i, add: stockName('פולי עליון') },
  { k: 'squat', l: L('סקוואט / לחיצת רגליים', 'Knäböj / benpress'), re: /סקוואט|לחיצת רגליים|מכרע|לאנג|knäböj|benpress|utfall|squat|leg press|lunge/i, add: stockName('סקוואט גובלט') },
  { k: 'hinge', l: L('כפיפת ירך (דדליפט)', 'Höftfällning (marklyft)'), re: /דדליפט|היפ טראסט|גשר ישבן|marklyft|höftlyft|deadlift|hip thrust|\brdl\b|good ?morning/i, add: stockName('דדליפט רומני') },
  { k: 'rear', l: L('כתף אחורית', 'Bakre axel'), re: /פייס|פרפר הפוך|face ?pull|omvända flyes|rear delt|reverse fly/i, add: stockName('פייס פול') },
];
const COMPOUND = ['hpush', 'vpush', 'hpull', 'vpull', 'squat', 'hinge'];
const ISOLATION = /הרחק|פרפר|פק דק|כפיפ(ת|ות) מרפק|פשיט(ת|ות)|הרמת עקבים|פטיש|פרנץ|סקאל|כפיפת ברכיים|sidolyft|flyes|tåhäv|benspark|pushdown|fransk press|curl|extension|raise|\bfly/i;
const patternsOf = (name) => PATTERNS.filter((p) => p.re.test(canon(name))).map((p) => p.k);
const isCompound = (name) => !ISOLATION.test(canon(name)) && patternsOf(name).some((k) => COMPOUND.includes(k));

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
      t: L('דפוסי תנועה חסרים', 'Saknade rörelsemönster'),
      d: L(`אין בתבניות ${missing.map((p) => `<b>${p.l}</b>`).join(', ')}. תוכנית מאוזנת עובדת על כל דפוסי התנועה הבסיסיים – כדאי להוסיף: ${missing.map((p) => p.add).join(', ')}.`,
        `Mallarna saknar ${missing.map((p) => `<b>${p.l}</b>`).join(', ')}. Ett balanserat program tränar alla grundläggande rörelsemönster – lägg gärna till: ${missing.map((p) => p.add).join(', ')}.`),
    });
  }

  const push = sets.hpush + sets.vpush, pull = sets.hpull + sets.vpull;
  if (push && pull && push > pull * 1.3) {
    out.push({ t: L('יחס דחיקה–משיכה', 'Balans press–drag'), d: L(`בתבניות ${push} סטים של דחיקה מול ${pull} של משיכה. עודף דחיקה מושך את הכתפיים קדימה ומגביר סיכון לפציעה – כוון ליחס של 1:1 לפחות, למשל עוד 2–3 סטים של חתירה או פייס פול.`,
      `Mallarna har ${push} set press mot ${pull} set drag. För mycket press drar axlarna framåt och ökar skaderisken – sikta på minst 1:1, till exempel 2–3 set rodd eller face pulls till.`) });
  } else if (push && pull && pull > push * 1.6) {
    out.push({ t: L('יחס דחיקה–משיכה', 'Balans press–drag'), d: L(`${pull} סטים של משיכה מול ${push} בלבד של דחיקה – אפשר להוסיף סטים של לחיצת חזה או כתפיים.`,
      `${pull} set drag mot bara ${push} set press – du kan lägga till set bänkpress eller axelpress.`) });
  }

  for (const t of tpls) {
    const notes = [];
    // Big compound lifts first, while fresh; isolation work after.
    const firstIso = t.exercises.findIndex((e) => ISOLATION.test(canon(e.name)));
    const nm = (e) => `"${esc(exName(e.name))}"`;
    const lateCompound = firstIso >= 0 && t.exercises.slice(firstIso + 1).find((e) => isCompound(e.name));
    if (lateCompound) notes.push(L(`הזז את ${nm(lateCompound)} לפני ${nm(t.exercises[firstIso])} – תרגילים מורכבים כדאי לעשות ראשונים, כשהכוח במיטבו.`,
      `Flytta ${nm(lateCompound)} före ${nm(t.exercises[firstIso])} – flerledsövningar görs bäst först, när du är som starkast.`));
    const heavyShortRest = t.exercises.filter((e) => isCompound(e.name) && e.reps <= 8 && e.rest < 120);
    if (heavyShortRest.length) notes.push(`${heavyShortRest.map(nm).join(', ')}: ${L(`ב-${heavyShortRest[0].reps} חזרות או פחות כדאי לנוח 2–3 דקות, כדי שהסט הבא לא ייחלש.`, `vid ${heavyShortRest[0].reps} reps eller färre är det bra att vila 2–3 minuter, så att nästa set inte blir sämre.`)}`);
    const oddReps = t.exercises.filter((e) => e.reps > 20 || e.reps < 4);
    if (oddReps.length) notes.push(`${oddReps.map((e) => `${nm(e)} (${e.reps})`).join(', ')}: ${L('טווח חזרות חריג. לרוב התרגילים 5–15 חזרות עובדות הכי טוב לבניית שריר.', 'ovanligt repintervall. För de flesta övningar fungerar 5–15 reps bäst för att bygga muskler.')}`);
    const manySets = t.exercises.filter((e) => e.sets > 5);
    if (manySets.length) notes.push(`${manySets.map(nm).join(', ')}: ${L('יותר מ-5 סטים לתרגיל אחד – עדיף לפצל לשני תרגילים שונים לאותו שריר.', 'fler än 5 set för en övning – dela hellre upp på två olika övningar för samma muskel.')}`);
    const total = t.exercises.reduce((a, e) => a + e.sets, 0);
    if (t.exercises.length > 8 || total > 28) notes.push(L(`${t.exercises.length} תרגילים ו-${total} סטים – אימון ארוך מדי. האיכות יורדת אחרי כ-20–25 סטים; כדאי לפצל לאימון נוסף.`,
      `${t.exercises.length} övningar och ${total} set – för långt pass. Kvaliteten sjunker efter ungefär 20–25 set; dela gärna upp på ett pass till.`));
    if (notes.length) out.push({ t: `${L('תבנית', 'Mall')}: ${esc(t.name)}`, d: notes.map((n) => `• ${n}`).join('<br>') });
  }

  if (!out.length) out.push({ t: L('התוכנית מאוזנת', 'Programmet är balanserat'), d: L('כל דפוסי התנועה הבסיסיים מכוסים, יחס הדחיקה–משיכה תקין והתרגילים המורכבים באים ראשונים. המשך להתקדם בעומסים.', 'Alla grundläggande rörelsemönster täcks, balansen press–drag är bra och flerledsövningarna kommer först. Fortsätt öka belastningen.') });
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
    if (p.pbf != null) d += L(`אחוז השומן שלך (${r1(p.pbf)}%) ${goal === 'cut' ? 'מעל' : goal === 'bulk' ? 'מתחת ל' : 'בתוך'} הטווח ${FAT_BANDS[sex].join('–')}%.`,
      `Din fettprocent (${r1(p.pbf)} %) ligger ${goal === 'cut' ? 'över' : goal === 'bulk' ? 'under' : 'inom'} intervallet ${FAT_BANDS[sex].join('–')} %.`);
    else d += L(`לפי BMI ${r1(p.bmi)} (${bmiLabel(p.bmi)}). עם אחוז שומן מהדוח ההמלצה תהיה מדויקת יותר.`, `Utifrån BMI ${r1(p.bmi)} (${bmiLabel(p.bmi)}). Med fettprocent från rapporten blir rådet mer exakt.`);
    if (p.ffmi != null) {
      d += p.ffmi < 19 ? L(' מדד השריר (FFMI) נמוך יחסית – יש הרבה מקום לבנות שריר, ובשלב הזה מתקדמים מהר.', ' Ditt muskelindex (FFMI) är relativt lågt – det finns mycket utrymme att bygga muskler, och i det här skedet går det fort.')
        : p.ffmi >= 23 ? L(' מדד השריר (FFMI) גבוה – קרוב לתקרה הטבעית, ההתקדמות תהיה איטית ותלויה בעקביות.', ' Ditt muskelindex (FFMI) är högt – nära det naturliga taket, så framstegen blir långsamma och hänger på kontinuitet.')
          : L(' מדד השריר (FFMI) טוב – יש עוד מקום לגדול בקצב סביר.', ' Ditt muskelindex (FFMI) är bra – det finns fortfarande utrymme att växa i rimlig takt.');
    }
    recs.push({ t: `${L('מטרה מומלצת', 'Rekommenderat mål')}: ${GOALS[goal].l}`, d });
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
    t: L('תזונה', 'Kost'),
    d: L(`כ-<b>${round50(target)} קק״ל</b> ביום (תחזוקה משוערת ${round50(tdee)}${goal === 'cut' ? ', גירעון של כ-450' : goal === 'bulk' ? ', עודף של כ-250' : ''}). חלבון: <b>${Math.round(refW * gLo)}–${Math.round(refW * gHi)} גרם</b> ביום, מחולק ל-3–5 ארוחות.`,
      `Cirka <b>${round50(target)} kcal</b> per dag (uppskattat underhåll ${round50(tdee)}${goal === 'cut' ? ', ett underskott på cirka 450' : goal === 'bulk' ? ', ett överskott på cirka 250' : ''}). Protein: <b>${Math.round(refW * gLo)}–${Math.round(refW * gHi)} gram</b> per dag, fördelat på 3–5 måltider.`),
  });

  if (p.trend) {
    const { pct, perWeek, smm, weeks } = p.trend;
    const kgWeek = `<span dir="ltr">${perWeek > 0 ? '+' : ''}${fmtW(Math.round(perWeek * 100) / 100)}</span>`;
    let d = L(`ב-${Math.round(weeks)} השבועות האחרונים: ${kgWeek} ק״ג בשבוע. `, `De senaste ${Math.round(weeks)} veckorna: ${kgWeek} kg per vecka. `);
    if (goal === 'cut') d += pct > -0.25 ? L('המשקל כמעט לא יורד – הורד עוד כ-200 קק״ל ביום או הוסף 2,000–3,000 צעדים.', 'Vikten går knappt ner – dra ner ytterligare cirka 200 kcal per dag eller lägg till 2 000–3 000 steg.')
      : pct < -1 ? L('הירידה מהירה מדי ומסכנת שריר – הוסף כ-200 קק״ל ביום.', 'Viktnedgången är för snabb och riskerar musklerna – lägg till cirka 200 kcal per dag.') : L('קצב ירידה מצוין (0.25%–1% מהמשקל בשבוע), המשך כך.', 'Utmärkt takt (0,25–1 % av vikten per vecka), fortsätt så.');
    else if (goal === 'bulk') d += pct < 0.1 ? L('המשקל לא עולה – הוסף כ-150–200 קק״ל ביום.', 'Vikten går inte upp – lägg till cirka 150–200 kcal per dag.')
      : pct > 0.6 ? L('העלייה מהירה מדי וחלק ממנה שומן – הורד כ-150 קק״ל ביום.', 'Uppgången är för snabb och en del är fett – dra ner cirka 150 kcal per dag.') : L('קצב עלייה טוב לבניית שריר נקי.', 'Bra takt för att bygga muskler utan mycket fett.');
    else d += Math.abs(pct) > 0.5 ? L('המשקל זז מהר מדי לשיפור הרכב גוף – כוון לשמור עליו יציב.', 'Vikten ändras för snabbt för en bättre kroppssammansättning – sikta på att hålla den stabil.') : L('המשקל יציב, כמו שצריך.', 'Vikten är stabil, precis som den ska.');
    if (smm != null) d += smm < -0.5 ? L(` מסת השריר ירדה ב-${r1(-smm)} ק״ג – הקפד על חלבון ועל משקלים כבדים.`, ` Muskelmassan har minskat med ${r1(-smm)} kg – se till att få i dig protein och träna med tunga vikter.`)
      : smm > 0.3 ? L(` מסת השריר עלתה ב-${r1(smm)} ק״ג – האימונים עובדים.`, ` Muskelmassan har ökat med ${r1(smm)} kg – träningen fungerar.`) : '';
    recs.push({ t: L('מגמה', 'Trend'), d });
  }

  if (tr) {
    const low = [], high = [];
    for (const [g, [lo, hi]] of Object.entries(AREA_TARGET)) {
      const v = tr.sets.get(g);
      if (v < lo) low.push(`${gName(g)} (${r1(v)})`);
      else if (v > hi) high.push(`${gName(g)} (${r1(v)})`);
    }
    let d = L(`ממוצע ${r1(tr.perWeek)} אימונים בשבוע. `, `I snitt ${r1(tr.perWeek)} pass per vecka. `);
    d += low.length ? L(`<b>מתחת לטווח המומלץ</b> (סטים בשבוע): ${low.join(', ')} – הוסף 2–4 סטים בשבוע לכל אחד. `, `<b>Under rekommenderat intervall</b> (set per vecka): ${low.join(', ')} – lägg till 2–4 set per vecka för var och en. `)
      : L('כל האזורים בטווח המומלץ של סטים שבועיים. ', 'Alla kroppsdelar ligger inom rekommenderat antal set per vecka. ');
    if (high.length) d += L(`מעל הטווח: ${high.join(', ')} – אם ההתאוששות קשה, אפשר להוריד. `, `Över intervallet: ${high.join(', ')} – om återhämtningen känns tung kan du dra ner. `);
    if (goal === 'cut') d += L('בחיטוב שמור על הנפח – אל תוריד סטים בגלל הגירעון.', 'Behåll volymen under deffen – dra inte ner på set på grund av underskottet.');
    recs.push({ t: L('נפח אימון', 'Träningsvolym'), d });
    if (tr.perWeek < 2.5) recs.push({ t: L('תדירות', 'Frekvens'), d: L('כדאי להגיע ל-3–4 אימונים בשבוע, כך שכל שריר יעבוד פעמיים בשבוע. זה בונה יותר מאימון ארוך אחד.', 'Sikta på 3–4 pass per vecka, så att varje muskel tränas två gånger i veckan. Det bygger mer än ett långt pass.') });
  } else {
    recs.push({ t: L('נפח אימון', 'Träningsvolym'), d: L('אין אימונים מ-4 השבועות האחרונים. התחל ב-3 אימונים בשבוע, 10–12 סטים שבועיים לכל אזור גדול.', 'Inga pass de senaste 4 veckorna. Börja med 3 pass per vecka, 10–12 set per vecka för varje stor muskelgrupp.') });
  }

  recs.push({
    t: L('עצימות', 'Intensitet'),
    d: goal === 'cut'
      ? L('שמור על משקלים כבדים ב-6–10 חזרות, 1–2 חזרות לפני כשל. המשקל הכבד הוא מה שאומר לגוף לשמור על השריר בגירעון.', 'Behåll tunga vikter på 6–10 reps, 1–2 reps från failure. Den tunga vikten är det som säger åt kroppen att behålla musklerna under ett underskott.')
      : L('רוב הסטים ב-6–12 חזרות, 1–2 חזרות לפני כשל. כשמגיעים לראש טווח החזרות בכל הסטים – מעלים 2.5 ק״ג.', 'De flesta set på 6–12 reps, 1–2 reps från failure. När du når toppen av repintervallet i alla set – öka med 2,5 kg.'),
  });

  const highVisceral = p.visceral != null && p.visceral >= 10;
  recs.push({
    t: L('אירובי', 'Kondition'),
    d: goal === 'cut' || highVisceral
      ? L(`2–3 פעמים בשבוע 20–30 דקות בדופק בינוני (הליכה בשיפוע, אופניים) ו-8,000–10,000 צעדים ביום${highVisceral ? `. השומן הוויסצרלי (רמה ${fmtW(p.visceral)}) מעל 10 – אירובי קבוע הוא הדרך היעילה להוריד אותו` : ''}.`,
        `2–3 gånger i veckan 20–30 minuter på måttlig puls (gång i lutning, cykel) och 8 000–10 000 steg om dagen${highVisceral ? `. Ditt viscerala fett (nivå ${fmtW(p.visceral)}) är över 10 – regelbunden kondition är det effektivaste sättet att få ner det` : ''}.`)
      : L('1–2 פעמים בשבוע 20 דקות אירובי קל לבריאות הלב, בלי לפגוע בהתאוששות.', '1–2 gånger i veckan 20 minuter lätt kondition för hjärtat, utan att störa återhämtningen.'),
  });

  return { p, sex, goal, recs, tdee, tr };
}

function viewRecs() {
  const r = buildRecs();
  if (!r) return '';
  const { p, sex, goal } = r;
  const stats = [
    p.bmi != null && [r1(p.bmi), `BMI · ${bmiLabel(p.bmi)}`],
    p.ffmi != null && [r1(p.ffmi), L('FFMI · מדד שריר', 'FFMI · muskelindex')],
    p.pbf != null && [`${r1(p.pbf)}<span class="u">%</span>`, L('אחוז שומן', 'Fettprocent')],
    p.ffm != null && [r1(p.ffm), L('מסה רזה (ק״ג)', 'Fettfri massa (kg)')],
  ].filter(Boolean);
  const ai = db.aiRec, hasKey = !!getApiKey();
  const review = programReview();

  return `
    <div class="card recs">
      <div class="row between"><h3>${L('המלצות לשיפור האימון', 'Råd för bättre träning')}</h3><button class="icon-btn" data-act="recs-close" aria-label="${L('סגור', 'Stäng')}">✕</button></div>
      <div class="seg" style="margin-top:10px">${[['m', L('גבר', 'Man')], ['f', L('אישה', 'Kvinna')]].map(([k, l]) => `<button class="${sex === k ? 'on' : ''}" data-act="rec-sex" data-k="${k}">${l}</button>`).join('')}</div>
      ${p.height ? '' : `<div class="card note">${L('חסר גובה – בלעדיו אי אפשר לחשב BMI ומדד שריר.', 'Längd saknas – utan den går det inte att räkna ut BMI och muskelindex.')} <button class="btn sm" data-act="m-edit" data-id="${p.m.id}">${L('הוסף גובה למדידה', 'Lägg till längd i mätningen')}</button></div>`}
      ${stats.length ? `<div class="stats">${stats.map(([n, l]) => `<div class="stat"><div class="v" dir="ltr">${n}</div><div class="l">${l}</div></div>`).join('')}</div>` : ''}
      ${r.recs.map((x) => `<div class="rec"><h4>${x.t}</h4><p>${x.d}</p></div>`).join('')}
      ${review.length ? `<h3 class="rec-head">${L('סקירת התרגילים בתוכנית', 'Genomgång av programmets övningar')}</h3>${review.map((x) => `<div class="rec"><h4>${x.t}</h4><p>${x.d}</p></div>`).join('')}` : ''}
      <p class="muted small" style="margin-bottom:0">${L(
        `לפי ${p.height ? `גובה ${fmtW(p.height)} ס״מ, ` : ''}משקל ${fmtW(p.weight)} ק״ג${p.pbf != null ? ' והרכב הגוף' : ''} מ-${fmtDateFull(p.m.t)} ומהאימונים של 4 השבועות האחרונים. אלה המלצות כלליות, לא תחליף למאמן או לדיאטנית.`,
        `Utifrån ${p.height ? `längd ${fmtW(p.height)} cm, ` : ''}vikt ${fmtW(p.weight)} kg${p.pbf != null ? ' och kroppssammansättning' : ''} från ${fmtDateFull(p.m.t)} och passen de senaste 4 veckorna. Det här är allmänna råd, ingen ersättning för en tränare eller dietist.`)}</p>
    </div>
    <div class="card">
      <h3>${L('המלצות מותאמות מ-Claude', 'Personliga råd från Claude')}</h3>
      <p class="muted small" style="margin:6px 0 10px">${L(
        `Claude יקבל את המדדים, האימונים והתבניות שלך${goal ? ` (מטרה: ${GOALS[goal].l})` : ''}, יעבור על כל תרגיל בתוכנית ויציע שיפורים – מבוסס על חיפוש באתרי הכושר והמחקר המובילים, עם קישורים למקורות.`,
        `Claude får dina mätvärden, pass och mallar${goal ? ` (mål: ${GOALS[goal].l})` : ''}, går igenom varje övning i programmet och föreslår förbättringar – baserat på sökningar på ledande tränings- och forskningssajter, med länkar till källorna.`)}</p>
      ${ui.recLoading
        ? `<div class="center reading"><div class="spinner"></div><div style="margin-top:10px">${L('Claude מנתח את הנתונים…', 'Claude analyserar datan…')}</div></div>`
        : `<button class="btn primary block" data-act="rec-ai">${hasKey ? (ai ? L('בקש המלצות מחדש', 'Be om nya råd') : L('קבל המלצות מ-Claude', 'Få råd från Claude')) : L('העתק בקשה ל-Claude', 'Kopiera förfrågan till Claude')}</button>`}
      ${hasKey ? '' : `<p class="muted small" style="margin-bottom:0">${L('הבקשה תועתק עם הנתונים שלך – הדבק אותה בצ׳אט עם Claude (עם חיפוש באינטרנט מופעל). עם מפתח API (בהגדרות ⚙ למעלה) התשובה והמקורות יופיעו כאן.', 'Förfrågan kopieras med din data – klistra in den i en chatt med Claude (med webbsökning påslagen). Med en API-nyckel (i inställningarna ⚙ uppe) visas svaret och källorna här.')}</p>`}
      ${ai ? `<div class="ai-text">${aiHtml(ai.text)}</div>
        ${ai.sources?.length ? `<div class="sources"><b>${L('מקורות', 'Källor')}</b>${ai.sources.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener"><span dir="auto">${esc(x.title || x.url)}</span><span class="muted small" dir="ltr">${esc(hostOf(x.url))}</span></a>`).join('')}</div>` : ''}
        <p class="muted small" style="margin-bottom:0">${L('התקבל ב-', 'Mottaget ')}${fmtDateFull(ai.t)}</p>` : ''}
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
  const sets = tr ? [...tr.sets].filter(([, c]) => c).map(([g, c]) => `${gName(g)}: ${v(c)}`).join(', ') : 'no workouts logged';
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

Answer in ${L('Hebrew', 'Swedish')}, short and practical, as a bulleted list under a few short headings (one heading per template). No tables.`;
}

async function fetchAiRecs() {
  ui.recLoading = true; render();
  let sdk = null;
  try {
    sdk = await import(SDK_URL).catch(() => { throw uiErr(L('אין חיבור לאינטרנט', 'Ingen internetanslutning')); });
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
      if (res.stop_reason === 'refusal') throw uiErr(L('Claude לא החזיר המלצות', 'Claude gav inga råd'));
      blocks.push(...res.content);
      if (res.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: res.content });
    }
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) throw uiErr(L('התקבלה תשובה ריקה, נסה שוב', 'Tomt svar, försök igen'));
    // Sources Claude cited; if it cited none, the pages its searches found.
    let sources = blocks.flatMap((b) => (b.type === 'text' && b.citations) || []).filter((c) => c.url).map((c) => ({ url: c.url, title: c.title }));
    if (!sources.length) sources = blocks.filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content)).flatMap((b) => b.content).map((x) => ({ url: x.url, title: x.title }));
    sources = [...new Map(sources.filter((x) => /^https?:/.test(x.url)).map((x) => [x.url, x])).values()].slice(0, 12);
    db.aiRec = { t: Date.now(), text, sources };
    save();
  } catch (e) {
    const err = sdk ? apiError(sdk, e) : e;
    toast(err.ui ? err.message : L('לא הצלחתי לקבל המלצות', 'Kunde inte hämta råd'), 3500);
  } finally {
    ui.recLoading = false;
    render();
  }
}
