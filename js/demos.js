'use strict';

// Exercise technique demos from free-exercise-db.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

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
  ['כבלים', 'cable'], ['כבל', 'cable'], ['מכונה', 'machine'], ['מכונת', 'machine'], ['סמית', 'smith'], ['קטלבל', 'kettlebell'],
  ['עליות על ספסל', 'step up'], ['עליות על קופסה', 'step up'], ['אחיזה רחבה', 'wide grip'], ['אחיזה צרה', 'close grip'],
  ['רחבה', 'wide'], ['רחב', 'wide'], ['צרה', 'narrow close'], ['צר', 'narrow close'],
  ['גומי', 'bands'], ['ישיבה', 'seated'], ['עמידה', 'standing'], ['שכיבה', 'lying'], ['יד אחת', 'one arm'],
  // Body parts last, so the exercise phrases above that contain them ("לחיצת חזה", "פשיטת גב") win.
  ['יד קדמית', 'biceps'], ['יד אחורית', 'triceps'], ['ביספס', 'biceps'], ['טרייספס', 'triceps'], ['טריספס', 'triceps'],
  ['ארבע ראשי', 'quads'], ['ארבעה ראשי', 'quads'], ['המסטרינג', 'hamstrings'], ['מסטרינג', 'hamstrings'], ['ירך אחורית', 'hamstrings'],
  ['גב תחתון', 'lower back'], ['גב עליון', 'upper back'], ['גב', 'back'], ['חזה', 'chest'], ['כתפיים', 'shoulders'], ['כתף', 'shoulders'],
  ['רגליים', 'legs'], ['רגל', 'legs'], ['ישבן', 'glutes'], ['עכוז', 'glutes'], ['תאומים', 'calves'], ['שוקיים', 'calves'],
  ['בטן', 'abs'], ['זרועות', 'arms'], ['ידיים', 'arms'], ['אמות', 'forearms'], ['טרפז', 'traps'], ['צוואר', 'neck'], ['מתיחה', 'stretch'], ['מתיחות', 'stretch'],
];
// Swedish → English for names typed by hand in Swedish (the app's own Swedish names go through the Hebrew list).
const SV_EN = [
  ['rumänska marklyft', 'romanian deadlift'], ['rumänsk marklyft', 'romanian deadlift'], ['marklyft', 'deadlift'],
  ['lutande bänkpress', 'incline bench press'], ['bänkpress', 'bench press'], ['bröstpress', 'chest press'], ['axelpress', 'shoulder press'],
  ['militärpress', 'military press'], ['benpress', 'leg press'], ['knäböj', 'squat'], ['utfall', 'lunge'], ['tåhävningar', 'calf raise'],
  ['tåhävning', 'calf raise'], ['lårcurl', 'leg curl'], ['benspark', 'leg extensions'], ['höftlyft', 'hip thrust'], ['hammarcurl', 'hammer curl'],
  ['bicepscurl', 'curl'], ['fransk press', 'triceps extension'], ['sidolyft', 'lateral raise'], ['latsdrag', 'lat pulldown'],
  ['kabelrodd', 'seated cable rows'], ['rodd', 'row'], ['armhävningar', 'pushups'], ['plankan', 'plank'], ['planka', 'plank'],
  ['hängande', 'hanging'], ['benlyft', 'leg raise'], ['skivstång', 'barbell'], ['hantlar', 'dumbbell'], ['hantel', 'dumbbell'],
  ['kabel', 'cable'], ['maskin', 'machine'], ['sittande', 'seated'], ['stående', 'standing'], ['liggande', 'lying'], ['omvända', 'reverse'],
];
const hasHebrew = (s) => /[֐-׿]/.test(s);
const HE_STOP = ['עם', 'של', 'על', 'את', 'או', 'ו', 'ב', 'ל', 'ה', 'תרגיל', 'תרגילים', 'אימון'];
// Dictionary translation, plus the Hebrew words it didn't know (left for the automatic translator).
function splitHebrew(q) {
  q = String(q || '');
  const out = [];
  for (const [he, en] of HE_EN) {
    // Short words only match as whole words (with an optional ו/ב/ל/ה prefix), so גב doesn't match inside גבוה.
    const re = he.length <= 3 ? new RegExp(`(^|[^א-ת])[ובלה]?${he}(?![א-ת])`, 'g') : null;
    if (re ? re.test(q) : q.includes(he)) { out.push(en); q = re ? q.replace(re, '$1 ') : q.split(he).join(' '); }
  }
  const rest = (q.match(/[֐-׿]+/g) || []).filter((w) => !HE_STOP.includes(w));
  // Keep any Latin words the name already had (e.g. "לחיצת חזה Smith").
  return { dict: [...out, ...(q.match(/[a-z0-9]+/gi) || [])].join(' '), rest: rest.join(' ') };
}

// Automatic Hebrew (or Swedish) → English through MyMemory (free, no key). Returns its translations, best first.
const mtCache = new Map();
async function machineTranslate(text, from = 'he') {
  const key = `${from}|${text}`;
  if (!mtCache.has(key)) {
    const p = fetch(`https://api.mymemory.translated.net/get?langpair=${from}|en&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r) => [r.responseData?.translatedText, ...(r.matches || []).filter((m) => m.match >= 0.5).map((m) => m.translation)]
        .filter((t) => t && !hasHebrew(t) && !/MYMEMORY WARNING/i.test(t)));
    p.catch(() => mtCache.delete(key));
    mtCache.set(key, p);
  }
  return mtCache.get(key).catch(() => []);
}

const cleanQuery = (s) => String(s).toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t && !EN_STOP.includes(t)).join(' ');
// A few English versions of what was typed: the gym dictionary (with the words it didn't know translated
// automatically), then automatic translations of the whole phrase. The first one is searched by default.
async function translateVariants(q) {
  q = canon(String(q || '').trim());
  if (!q) return [];
  if (!hasHebrew(q)) {
    if (!SV) return [q];
    let dict = q.toLowerCase();
    for (const [sv, en] of SV_EN) if (dict.includes(sv)) dict = dict.split(sv).join(` ${en} `);
    const tr = await machineTranslate(q, 'sv');
    return [...new Set([dict, ...tr.slice(0, 2), q].map(cleanQuery).filter(Boolean))].slice(0, 4);
  }
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
// Body-part words (after exTokens) → the database's muscles. These match what the exercise works, not its name,
// so "back" finds rows and pulldowns rather than "Elbows Back" or "Behind the Back Shrug".
const BACK = ['lats', 'middle back'];
const LEGS = ['quadriceps', 'hamstrings', 'glutes'];
const BODY_WORDS = {
  back: BACK, upper: ['lats', 'middle back', 'traps'], lower: ['lower back'], lat: ['lats'], trap: ['traps'],
  chest: ['chest'], pec: ['chest'], shoulder: ['shoulders'], delt: ['shoulders'], deltoid: ['shoulders'],
  leg: LEGS, quad: ['quadriceps'], quadricep: ['quadriceps'], thigh: ['quadriceps', 'hamstrings', 'adductors', 'abductors'],
  hamstring: ['hamstrings'], glute: ['glutes'], butt: ['glutes'], calf: ['calves'], calve: ['calves'],
  arm: ['biceps', 'triceps', 'forearms'], bicep: ['biceps'], tricep: ['triceps'], forearm: ['forearms'],
  ab: ['abdominals'], core: ['abdominals'], neck: ['neck'],
};
// Also worked by the body part, but not what people usually mean by it ("back" means rows and pulldowns, not shrugs).
const BODY_NEAR = { back: ['traps', 'lower back'], leg: ['calves', 'adductors', 'abductors'], arm: ['forearms'] };
// "back machine" should also show cable stations like lat pulldowns and seated rows.
const NEAR_EQUIP = { machine: ['cable'], cable: ['machine'], ez: ['barbell'], barbell: ['e-z curl bar'] };
const STRETCH_WORDS = ['stretch', 'smr', 'foam', 'roll', 'mobility'];
const CARDIO_WORDS = ['cardio', 'bike', 'bicycling', 'treadmill', 'elliptical', 'stairmaster', 'rowing', 'run', 'running', 'jog', 'jogging', 'walk', 'walking'];
// Every word typed should be explained by the exercise: its name, what it works, its equipment or a known alias.
// Results that cover all the words come first; each word left unexplained costs a lot. Without a body-part word
// in the search, exercises for the app's body area of the exercise get a boost. Every name word the search didn't
// ask for costs a little ("Reverse Flyes" for "fly"), and stretches and cardio only show up when asked for.
function searchExercises(list, q, group) {
  const words = exTokens(q);
  if (!words.length) return [];
  const qt = [...new Set(words)];
  const pairs = words.slice(1).map((w, i) => words[i] + w); // "pull up" also finds "Pullups"
  const asked = qt.filter((t) => BODY_WORDS[t]).flatMap((t) => BODY_WORDS[t]);
  const muscles = asked.length ? asked : GROUP_MUSCLES[group] || [];
  const wantStretch = qt.some((t) => STRETCH_WORDS.includes(t));
  const wantCardio = qt.some((t) => CARDIO_WORDS.includes(t));
  return list.map((x) => {
    const nt = exTokens(x.name);
    const extra = exTokens([EQUIP[x.equipment] || '', ...EX_ALIASES.filter(([re]) => re.test(x.name)).map(([, a]) => a)].join(' '));
    const prim = x.primaryMuscles || [], sec = x.secondaryMuscles || [];
    let score = 0, missed = 0;
    for (const t of qt) {
      const pairHit = pairs.some((p) => nt.includes(p) && p.includes(t));
      let s;
      if (BODY_WORDS[t]) {
        // "lower" / "upper" only count as body parts next to "back"; on their own they're ordinary name words.
        const body = (t === 'lower' || t === 'upper') && !qt.includes('back') ? null : BODY_WORDS[t];
        const near = body ? BODY_NEAR[t] || [] : [];
        s = body && prim.some((m) => body.includes(m)) ? 4 : prim.some((m) => near.includes(m)) ? 2.5
          : body && sec.some((m) => body.includes(m)) ? 1.5
          : nt.includes(t) ? (body ? 1 : 3) : 0;
      } else {
        s = nt.includes(t) || pairHit || EQUIP[x.equipment] === t ? 3 : extra.includes(t) ? 2.5
          : (NEAR_EQUIP[t] || []).includes(x.equipment) ? 1.5
          : t.length > 2 && nt.some((n) => n.startsWith(t) || (n.length > 2 && t.startsWith(n))) ? 1 : 0;
      }
      if (s) score += s; else missed++;
    }
    for (const p of pairs) if (nt.includes(p)) score += 1;
    if (!score) return null;
    score -= missed * 5;
    if (!asked.length && prim.some((m) => muscles.includes(m))) score += 2;
    if (!wantStretch && (x.category === 'stretching' || x.equipment === 'foam roll')) score -= 4;
    if (!wantCardio && x.category === 'cardio') score -= 4;
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

// Big demos open in overlays, where Safari can leave lazy images unloaded – so those load right away.
const demoAnim = (images, big) => `
  <div class="demo-anim ${big ? 'big' : ''}" dir="ltr" data-off="${L('אין חיבור – ההדגמה תיטען כשתהיה רשת', 'Ingen anslutning – demon laddas när nätet är tillbaka')}">
    <img src="${esc(exImg(images[0]))}" alt="" loading="${big ? 'eager' : 'lazy'}" crossorigin="anonymous" onerror="this.parentElement.classList.add('demo-off')">
    ${images[1] ? `<img src="${esc(exImg(images[1]))}" alt="" loading="${big ? 'eager' : 'lazy'}" crossorigin="anonymous" onerror="this.parentElement.classList.add('demo-off')">` : ''}
  </div>`;

function openDemo(name) {
  if (!name.trim()) { toast(L('קודם תן שם לתרגיל', 'Ge övningen ett namn först')); return; }
  ui.demo = { name, q: name, variants: [], vi: 0, vq: null, results: null, loading: false, error: '', picking: !db.demos[name] };
  renderSheet();
  if (ui.demo.picking) runDemoSearch();
}

// Translates the search box (only when its text changed) and searches with the chosen translation.
async function runDemoSearch(vi = 0) {
  const d = ui.demo;
  d.picking = true;
  if (!d.q.trim()) {
    d.loading = false; d.results = null; d.variants = []; d.vq = null;
    d.error = L('הקלד שם של תרגיל כדי לחפש.', 'Skriv ett övningsnamn för att söka.');
    renderSheet();
    return;
  }
  d.loading = true; d.error = ''; d.results = null; d.vi = vi;
  renderSheet();
  try {
    const fresh = d.vq !== d.q;
    const [list, variants] = await Promise.all([loadExercises(), fresh ? translateVariants(d.q) : d.variants]);
    // Drop translations that find nothing ("voltage" for מתח), unless none of them find anything.
    const useful = fresh ? variants.filter((v) => searchExercises(list, v, groupOf(d.name)).length) : variants;
    d.variants = useful.length ? useful : variants; d.vq = d.q;
    const q = d.variants[d.vi] || ''; // the filtered list: the one the chips on screen show
    d.results = q ? searchExercises(list, q, groupOf(d.name)) : [];
    if (!d.results.length) d.error = q ? L('לא נמצאו תרגילים. נסה תרגום אחר או מילים אחרות.', 'Inga övningar hittades. Prova en annan översättning eller andra ord.') : L('לא הצלחתי לתרגם. בדוק את החיבור לאינטרנט או כתוב באנגלית.', 'Kunde inte översätta. Kontrollera internetanslutningen eller skriv på engelska.');
  } catch {
    d.error = L('אין חיבור לאינטרנט. החיפוש צריך רשת.', 'Ingen internetanslutning. Sökningen behöver nätet.');
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
        <button class="btn sm" data-act="demo-change">${L('החלף הדגמה', 'Byt demo')}</button>
        <button class="btn sm danger" data-act="demo-clear">${L('הסר', 'Ta bort')}</button>
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
        <input type="search" class="grow" data-f="demo-q" id="demo-q" value="${esc(d.q)}" placeholder="${L('שם התרגיל (עברית או אנגלית)', 'Övningens namn (svenska eller engelska)')}" dir="auto" enterkeyhint="search">
        <button class="btn" data-act="demo-search">${L('חפש', 'Sök')}</button>
      </div>
      ${d.variants.length > 1 || (d.variants.length && hasHebrew(d.vq || '')) ? `
        <div class="muted small" style="margin-top:10px">${L('תרגומים לאנגלית (לחץ כדי לחפש):', 'Engelska översättningar (tryck för att söka):')}</div>
        <div class="demo-variants" dir="ltr">${d.variants.map((v, k) => `<button class="chip ${k === d.vi ? 'on' : ''}" data-act="demo-variant" data-k="${k}">${esc(v)}</button>`).join('')}</div>` : ''}
      <p class="muted small" style="margin:8px 0 0">${L('בחר את ההדגמה המתאימה. היא תישמר לתרגיל הזה.', 'Välj rätt demo. Den sparas för den här övningen.')}</p>
      <div class="demo-grid">${results}</div>
      ${saved ? `<button class="btn block" data-act="demo-back">${L('חזרה להדגמה השמורה', 'Tillbaka till sparad demo')}</button>` : ''}`;
  }
  return `
    <div class="sheet-panel" data-act="none" role="dialog" aria-modal="true" aria-label="${L('הדגמת תרגיל', 'Övningsdemo')}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="row between" style="margin-bottom:12px">
        <h3 class="grow">${esc(exName(d.name))}</h3>
        <button class="icon-btn" data-act="demo-close" aria-label="${L('סגור', 'Stäng')}">✕</button>
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
