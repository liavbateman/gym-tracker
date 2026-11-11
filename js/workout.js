'use strict';

// Workout tab: week strip, today, cardio, music, start screen, active workout, settings, template editor.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Views ----------
// Days with any training (a workout or cardio), as toDateString keys.
const activeDays = () => new Set([...db.workouts.map((w) => w.start), ...db.cardio.map((c) => c.t)].map((t) => new Date(t).toDateString()));
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Weeks start on Sunday in Israel and on Monday in Sweden.
const WEEK_FIRST = SV ? 1 : 0;
const weekStart = (d = new Date()) => addDays(d, -((d.getDay() - WEEK_FIRST + 7) % 7));
const weekCount = (sunday, days) => [0, 1, 2, 3, 4, 5, 6].filter((i) => days.has(addDays(sunday, i).toDateString())).length;
// Weeks in a row that reached the weekly goal. This week counts once it's reached; until then it doesn't break the run.
function weekStreak(goal, days) {
  let sun = weekStart(), n = weekCount(sun, days) >= goal ? 1 : 0;
  for (let k = 0; k < 520; k++) {
    sun = addDays(sun, -7);
    if (weekCount(sun, days) < goal) break;
    n++;
  }
  return n;
}

// Tapping a day marks it as a rest day (or unmarks it). Days with training show a filled box, cardio a dot.
function viewWeek() {
  const now = new Date();
  const sunday = weekStart(now);
  const names = L(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'], ['M', 'T', 'O', 'T', 'F', 'L', 'S']);
  const trained = new Set(db.workouts.map((w) => new Date(w.start).toDateString()));
  const cardio = new Set(db.cardio.map((c) => new Date(c.t).toDateString()));
  const days = activeDays();
  const goal = db.settings.weeklyGoal || 0;
  const count = weekCount(sunday, days);
  const streak = goal ? weekStreak(goal, days) : 0;
  const cells = names.map((d, i) => {
    const day = addDays(sunday, i);
    const k = day.toDateString(), iso = isoDay(day.getTime());
    const rest = db.rest.includes(iso) && !days.has(k);
    const today = k === now.toDateString();
    return `<button class="${today ? 'today' : ''}" data-act="day-rest" data-d="${iso}" aria-label="${day.toLocaleDateString(LOC, { weekday: 'long' })}${rest ? L(', יום מנוחה', ', vilodag') : ''}">
      <span class="${trained.has(k) ? 'on' : ''} ${rest ? 'rest' : ''}">${cardio.has(k) ? '<i></i>' : ''}</span>${d}</button>`;
  }).join('');
  const done = goal && count >= goal;
  return `<div class="card">
    <div class="row between"><h3>${L('השבוע', 'Den här veckan')}</h3><span class="muted small">${goal ? `<b class="${done ? 'goal-done' : ''}">${count}/${goal}</b> ${L('ימי אימון', 'träningsdagar')}` : count === 1 ? L('יום אימון אחד', '1 träningsdag') : `${count} ${L('ימי אימון', 'träningsdagar')}`}</span></div>
    ${goal ? `<div class="goal-bar"><div style="width:${Math.min(100, (count / goal) * 100)}%"></div></div>` : ''}
    <div class="week">${cells}</div>
    <div class="row between muted small week-foot"><span>${L('לחיצה על יום מסמנת יום מנוחה', 'Tryck på en dag för att markera vilodag')}</span>${streak > 1 ? `<span>${L(`רצף <b>${streak}</b> שבועות ביעד`, `<b>${streak}</b> veckor i rad på målet`)}</span>` : done ? `<span>${L('היעד השבועי הושג ✓', 'Veckomålet nått ✓')}</span>` : ''}</div>
  </div>`;
}

// Quick actions for today: log cardio, or call it a rest day.
function viewToday() {
  const today = isoDay(Date.now());
  const rest = db.rest.includes(today);
  const done = db.cardio.filter((c) => isoDay(c.t) === today);
  return `
    <div class="row">
      <button class="btn grow" data-act="c-new">${L('+ אירובי', '+ Kondition')}</button>
      <button class="btn grow ${rest ? 'primary' : ''}" data-act="day-rest" data-d="${today}">${rest ? L('✓ יום מנוחה', '✓ Vilodag') : L('היום יום מנוחה', 'Vilodag idag')}</button>
    </div>
    ${rest ? `<p class="muted small rest-note">${L('השריר נבנה בזמן המנוחה: לישון טוב, לאכול מספיק חלבון ולשתות מים. הליכה קלה או מתיחות לא מקלקלות יום מנוחה.', 'Musklerna byggs under vilan: sov gott, ät tillräckligt med protein och drick vatten. En lugn promenad eller stretching förstör inte en vilodag.')}</p>` : ''}
    ${done.length ? `<p class="muted small rest-note">${L('היום', 'Idag')}: ${done.map((c) => `${CARDIO_BY[c.type].name} ${fmtMins(c.mins)} · ${c.kcal} ${L('קק״ל', 'kcal')}`).join(' | ')}</p>` : ''}`;
}

// ---------- Cardio ----------
// Calories = MET × body weight (kg) × hours, METs from the Compendium of Physical Activities, picked by speed where
// the distance is known. Running with a distance uses ACSM's running equation instead (oxygen cost from speed).
// dist: 'km' or 'm' (swimming is logged in meters); met: fixed MET, or a function of speed in km/h (null when unknown).
const CARDIO = [
  { k: 'run', name: L('ריצה', 'Löpning'), dist: 'km', met: () => 9.8 },
  { k: 'walk', name: L('הליכה', 'Promenad'), dist: 'km', met: (v) => (v == null ? 3.5 : v < 3.2 ? 2.8 : v < 4.8 ? 3.5 : v < 5.6 ? 4.3 : v < 6.4 ? 5 : 7) },
  { k: 'swim', name: L('שחייה', 'Simning'), dist: 'm', met: (v) => (v == null ? 7 : v < 1.5 ? 6 : v < 2.4 ? 8.3 : v < 3.3 ? 9.8 : 10.5) },
  { k: 'bike', name: L('אופניים', 'Cykel'), dist: 'km', met: (v) => (v == null ? 7 : v < 16 ? 4 : v < 19 ? 6.8 : v < 22 ? 8 : v < 25 ? 10 : 12) },
  { k: 'elliptical', name: L('אליפטיקל', 'Crosstrainer'), met: () => 5 },
  { k: 'row', name: L('חתירה', 'Rodd'), met: () => 7 },
  { k: 'stairs', name: L('מדרגות', 'Trappor'), met: () => 9 },
  { k: 'rope', name: L('דילגית', 'Hopprep'), met: () => 11 },
  { k: 'hiit', name: 'HIIT', met: () => 8 },
  { k: 'other', name: L('אחר', 'Övrigt'), met: () => 6 },
];
const CARDIO_BY = Object.fromEntries(CARDIO.map((c) => [c.k, c]));
const bodyWeight = () => latestOf('weight')?.weight || db.settings.bodyWeight || null;
const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')} ${L('ש׳', 'h')}` : `${Math.round(m)} ${L('דק׳', 'min')}`);
const fmtPace = (minsPer) => { const t = Math.round(minsPer * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function cardioKcal(type, mins, km, kg) {
  if (!mins || !kg) return 0;
  const kmh = km ? km / (mins / 60) : null;
  // ACSM, level running: VO2 = 0.2 × speed (m/min) + 3.5 ml/kg/min; ~5 kcal per liter of oxygen.
  if (type === 'run' && kmh) return ((0.2 * (kmh * 1000 / 60) + 3.5) * kg / 1000) * 5 * mins;
  return CARDIO_BY[type].met(kmh) * kg * (mins / 60);
}

// Pace for runs, walks and swims, speed for rides: { v, u }, or null without both time and distance.
function cardioPace(type, mins, km) {
  if (!mins || !km) return null;
  if (type === 'swim') return { v: fmtPace(mins / (km * 10)), u: L('ל-100 מ׳', '/100 m') };
  if (type === 'bike') return { v: r1(km / (mins / 60)), u: L('קמ״ש', 'km/h') };
  return { v: fmtPace(mins / km), u: L('לק״מ', '/km') };
}
const fmtDist = (type, km) => (CARDIO_BY[type].dist === 'm' ? `${Math.round(km * 1000).toLocaleString(LOC)} ${L('מ׳', 'm')}` : `${r1(km)} ${L('ק״מ', 'km')}`);

// The form's numbers, read from the draft: minutes, distance in km, and calories (typed, or worked out).
function cardioCalc(d) {
  const type = CARDIO_BY[d.type];
  const mins = num(d.mins), dist = type.dist ? num(d.dist) : null;
  const km = dist ? (type.dist === 'm' ? dist / 1000 : dist) : null;
  const kg = num(d.bw) || bodyWeight() || 75;
  const auto = Math.round(cardioKcal(d.type, mins, km, kg));
  return { mins, km, auto, kcal: num(d.kcal) != null ? Math.round(num(d.kcal)) : auto };
}

function cardioSummary(d) {
  const { mins, km, kcal } = cardioCalc(d);
  const pace = cardioPace(d.type, mins, km);
  return `<div><b>${kcal || '–'}</b> ${L('קלוריות', 'kalorier')}</div>${pace ? `<div><b dir="ltr">${pace.v}</b> ${pace.u}</div>` : ''}`;
}

function viewCardioForm() {
  const d = ui.cdraft;
  const type = CARDIO_BY[d.type];
  const known = bodyWeight();
  return `
    <div class="card cform">
      <div class="ctypes">${CARDIO.map((c) => `<button class="${c.k === d.type ? 'on' : ''}" data-act="c-type" data-k="${c.k}">${c.name}</button>`).join('')}</div>
      <div class="cgrid">
        <label class="field">${L('זמן (דקות)', 'Tid (minuter)')}<input type="number" inputmode="decimal" step="any" data-f="c-mins" value="${esc(d.mins)}" placeholder="30"></label>
        ${type.dist ? `<label class="field">${type.dist === 'm' ? L('מרחק (מטר)', 'Distans (meter)') : L('מרחק (ק״מ)', 'Distans (km)')}<input type="number" inputmode="decimal" step="any" data-f="c-dist" value="${esc(d.dist)}" placeholder="${type.dist === 'm' ? '1000' : '5'}"></label>` : ''}
      </div>
      <div class="c-sum" id="c-sum">${cardioSummary(d)}</div>
      <label class="field">${L('קלוריות מהשעון (לא חובה)', 'Kalorier från klockan (valfritt)')}<input type="number" inputmode="numeric" data-f="c-kcal" value="${esc(d.kcal)}" placeholder="${L('חישוב אוטומטי', 'Räknas ut automatiskt')}"></label>
      ${known ? '' : `<label class="field">${L('משקל גוף (ק״ג)', 'Kroppsvikt (kg)')}<input type="number" inputmode="decimal" step="any" data-f="c-bw" value="${esc(d.bw)}" placeholder="75"><span class="muted small">${L('נשמר לפעם הבאה. מדידה בלשונית מדדי גוף מעדכנת אותו.', 'Sparas till nästa gång. En mätning under fliken Kropp uppdaterar den.')}</span></label>`}
      <label class="field">${L('תאריך', 'Datum')}<input type="date" data-f="c-date" value="${d.date}" max="${isoDay(Date.now())}"></label>
      <p class="muted small" style="margin-bottom:0">${L(
        `החישוב לפי ${known ? `המשקל שלך (${r1(known)} ק״ג)` : 'משקל הגוף'}, הזמן${type.dist ? ' והקצב' : ''}. זו הערכה; שעון עם דופק מדייק יותר.`,
        `Beräknat på ${known ? `din vikt (${r1(known)} kg)` : 'kroppsvikten'}, tiden${type.dist ? ' och tempot' : ''}. Det är en uppskattning; en klocka med pulsmätning är mer exakt.`)}</p>
    </div>
    <div class="row">
      <button class="btn grow" data-act="c-cancel">${L('ביטול', 'Avbryt')}</button>
      <button class="btn primary grow" data-act="c-save">${L('שמור', 'Spara')}</button>
    </div>`;
}

function saveCardio() {
  const d = ui.cdraft;
  const { mins, km, kcal } = cardioCalc(d);
  if (!mins || mins <= 0) { toast(L('כמה דקות?', 'Hur många minuter?')); return; }
  if (num(d.bw)) db.settings.bodyWeight = num(d.bw);
  const today = d.date === isoDay(Date.now());
  db.cardio.push({ id: uid(), t: today || !dayTs(d.date) ? Date.now() : dayTs(d.date), type: d.type, mins, ...(km ? { km } : {}), kcal });
  // Training that day means it wasn't a rest day after all.
  db.rest = db.rest.filter((x) => x !== d.date);
  ui.cdraft = null;
  save(); render(); window.scrollTo(0, 0);
  toast(L(`נשמר: ${CARDIO_BY[d.type].name}, ${kcal} קלוריות`, `Sparat: ${CARDIO_BY[d.type].name}, ${kcal} kalorier`));
}

function toggleRest(iso) {
  const has = db.rest.includes(iso);
  if (!has && activeDays().has(new Date(dayTs(iso)).toDateString())) { toast(L('ביום הזה כבר יש אימון', 'Den dagen finns redan ett pass')); return; }
  db.rest = has ? db.rest.filter((x) => x !== iso) : [...db.rest, iso];
  save(); render();
  toast(has ? L('בוטל יום המנוחה', 'Vilodagen borttagen') : L('סומן יום מנוחה', 'Markerad som vilodag'));
}

// ---------- Workout music ----------
// Each genre opens a playlist search in the chosen app, so the top results are that service's own workout playlists.
const MUSIC_APPS = [['spotify', 'Spotify'], ['apple', 'Apple Music'], ['youtube', 'YouTube']];
const GENRES = [
  [L('היפ הופ וראפ', 'Hiphop och rap'), 'hip hop rap workout'],
  [L('טכנו', 'Techno'), 'techno workout'],
  [L('הארדסטייל', 'Hardstyle'), 'hardstyle workout'],
  [L('מוטיבציה', 'Motivation'), 'workout motivation'],
  ['EDM', 'edm workout'],
  [L('רוק ומטאל', 'Rock och metal'), 'rock metal workout'],
  [L('פופ', 'Pop'), 'pop workout'],
  [L('פונק', 'Phonk'), 'phonk gym'],
];
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
function musicUrl(app, q) {
  const e = encodeURIComponent(q);
  if (app === 'apple') return (isApple ? 'music://music.apple.com' : 'https://music.apple.com') + `/search?term=${e}`;
  if (app === 'youtube') return `https://www.youtube.com/results?search_query=${e}&sp=EgIQAw%3D%3D`;
  return `https://open.spotify.com/search/${e}/playlists`;
}

function viewMusic() {
  if (db.settings.showMusic === false) return '';
  const app = db.settings.musicApp;
  return `
    <div class="row between" style="margin:26px 0 10px"><h2 style="margin:0">${L('מוזיקה לאימון', 'Träningsmusik')}</h2><button class="btn sm ghost" data-act="music-hide">${L('הסתר', 'Dölj')}</button></div>
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
        ${t.id === nextId ? `<span class="badge">${L('הבא בתור', 'Nästa på tur')}</span>` : ''}
        <div class="name">${esc(t.name)}</div>
        <div class="sub">${t.exercises.map((e) => esc(exName(e.name))).join(' · ') || L('אין תרגילים', 'Inga övningar')}</div>
      </button>
      <button class="btn sm tpl-edit" data-act="tpl-edit" data-id="${t.id}">${L('עריכה', 'Redigera')}</button>
    </div>`).join('');

  const last = sortedWorkouts()[0];
  const lastCard = last ? `
    <h2>${L('אימון אחרון', 'Senaste passet')}</h2>
    <div class="card">
      <div class="row between"><b>${esc(last.name)}</b><span class="muted small">${fmtDate(last.start)}</span></div>
      <div class="muted small" style="margin-top:4px">${last.exercises.length} ${L('תרגילים', 'övningar')} · ${fmtDur(last.end - last.start)} · ${L('נפח', 'volym')} ${Math.round(volume(last)).toLocaleString(LOC)} ${L('ק״ג', 'kg')}</div>
    </div>` : '';

  const backup = backupDue() ? `
    <div class="card note">
      <b>${db.settings.lastBackup ? L('עבר יותר מחודש מהגיבוי האחרון', 'Det har gått över en månad sedan senaste säkerhetskopian') : L('עוד לא גיבית את האימונים', 'Du har inte säkerhetskopierat din träning än')}</b>
      <div class="muted small" style="margin-top:4px">${L(`${db.workouts.length} אימונים שמורים רק בטלפון הזה. גיבוי לוקח כמה שניות.`, `${db.workouts.length} pass finns bara på den här telefonen. En säkerhetskopia tar några sekunder.`)}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm primary" data-act="export">${L('גבה עכשיו', 'Säkerhetskopiera nu')}</button>
        <button class="btn sm" data-act="backup-later">${L('לא עכשיו', 'Inte nu')}</button>
      </div>
    </div>` : '';

  return `
    ${viewWeek()}
    ${viewToday()}
    ${backup}
    <h2>${L('התחל אימון', 'Starta pass')}</h2>
    ${tpls || `<p class="muted">${L('אין עדיין תבניות. צור תבנית כדי להתחיל אימון ממנה.', 'Inga mallar än. Skapa en mall för att starta ett pass från den.')}</p>`}
    <div class="row">
      <button class="btn ghost grow" data-act="tpl-new">${L('+ תבנית חדשה', '+ Ny mall')}</button>
      <button class="btn ghost grow" data-act="start-empty">${L('+ אימון ריק', '+ Tomt pass')}</button>
    </div>
    ${viewMusic()}
    ${lastCard}`;
}

const stepper = (e, s, f, value, placeholder, mode) => {
  const what = f === 'w' ? L('משקל (ק״ג)', 'Vikt (kg)') : L('חזרות', 'Reps');
  return `
  <div class="stepper">
    <button data-act="step" data-f="${f}" data-d="1" data-e="${e}" data-s="${s}" aria-label="${L('הוסף', 'Öka')}: ${what}">+</button>
    <input type="text" inputmode="none" readonly data-kp="${mode}" data-f="${f}" data-e="${e}" data-s="${s}" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${what}">
    <button data-act="step" data-f="${f}" data-d="-1" data-e="${e}" data-s="${s}" aria-label="${L('הפחת', 'Minska')}: ${what}">−</button>
  </div>`;
};

// An exercise's standing note, kept by name so it follows the exercise into every workout and template.
function noteChip(name, attrs) {
  const ed = ui.noteEdit;
  if (ed && ed.name === name && ed.attrs === attrs) {
    return `<div class="note-edit">
      <div class="note-paper">
        <textarea id="note-in" rows="2" maxlength="${NOTE_MAX}" enterkeyhint="done" autocomplete="off" placeholder="${L('למשל: מושב בגובה 4, אחיזה רחבה', 't.ex. sätet på 4, brett grepp')}" aria-label="${L('הערה ל', 'Anteckning för ')}${esc(exName(name))}">${esc(ed.text)}</textarea>
        <span id="note-count" class="note-count">${ed.text.length}/${NOTE_MAX}</span>
      </div>
      <div class="note-btns">
        <button class="link-btn" data-act="note-cancel">${L('ביטול', 'Avbryt')}</button>
        <button class="btn sm note-save" data-act="note-save">${L('שמור', 'Spara')}</button>
      </div>
    </div>`;
  }
  const n = db.notes?.[name];
  return n
    ? `<button class="ex-note" data-act="note" ${attrs} aria-label="${L('ערוך הערה', 'Redigera anteckning')}"><span aria-hidden="true">✎</span>${esc(n)}</button>`
    : `<button class="link-btn note-add" data-act="note" ${attrs}>${L('+ הערה', '+ Anteckning')}</button>`;
}

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
          <button data-act="set-del" data-e="${i}" data-s="${j}">${L('מחק', 'Ta bort')}</button>
          <button data-act="set-del" data-e="${i}" data-s="${j}">${L('מחק', 'Ta bort')}</button>
        </div>
        <div class="set-grid swipe">
          <div class="n">${s.wu
            ? `<span title="${L('סט חימום', 'Uppvärmningsset')}">${L('חימום', 'Uppv.')}</span>`
            : `<button class="set-n ${s.fail ? 'fail' : ''}" data-act="fail" data-e="${i}" data-s="${j}" aria-label="${L('סמן סט עד כשל', 'Markera set till failure')}" aria-pressed="${!!s.fail}">${++n}${s.fail ? `<small>${L('כשל', 'Fail')}</small>` : ''}</button>`}</div>
          ${stepper(i, j, 'w', s.w, s.pw, 'decimal')}
          ${stepper(i, j, 'r', s.r, s.pr, 'numeric')}
          <button class="check" data-act="set-done" data-e="${i}" data-s="${j}" aria-label="${L('סמן סט כבוצע', 'Markera set som klart')}" aria-pressed="${!!s.done}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button>
        </div>
      </div>`).join('');
    return `
      <div class="card">
        <div class="row between">
          <div class="grow">
            <div class="ex-name">${esc(exName(e.name))}</div>
            ${e.swapOf ? `<div class="muted small">${L('במקום', 'I stället för')} ${esc(exName(e.swapOf))} · <button class="link-btn" data-act="unswap" data-e="${i}" style="padding:0">${L('התפנה? חזור', 'Ledig nu? Byt tillbaka')}</button></div>` : ''}
            <button class="link-btn demo-link" data-act="demo" data-e="${i}">▶ ${db.demos[e.name] ? L('הדגמה', 'Demo') : L('חפש הדגמה', 'Hitta demo')}</button>
            <div class="prev">${prev ? L('פעם קודמת: ', 'Förra gången: ') + prev.map(prevLabel).join(' · ') : L('תרגיל חדש', 'Ny övning')}</div>
            ${noteChip(e.name, `data-e="${i}"`)}
          </div>
          <div class="col-end">
            <button class="rest-pill" data-act="ex-rest" data-e="${i}" aria-label="${L('שנה זמן מנוחה', 'Ändra vilotid')}">${L('מנוחה', 'Vila')} ${e.rest} ${L('שנ׳', 's')}</button>
            <div class="row ex-move">
              <button class="icon-btn" data-act="ex-up" data-e="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${L('הזז למעלה', 'Flytta upp')}">▲</button>
              <button class="icon-btn" data-act="ex-down" data-e="${i}" ${i === w.exercises.length - 1 ? 'disabled' : ''} aria-label="${L('הזז למטה', 'Flytta ner')}">▼</button>
            </div>
          </div>
        </div>
        <div class="set-grid set-head"><span>${L('סט', 'Set')}</span><span>${L('ק״ג', 'kg')}</span><span>${L('חזרות', 'Reps')}</span><span></span></div>
        ${rows}
        <div class="row between" style="margin-top:8px">
          <div class="row">
            <button class="btn sm" data-act="set-add" data-e="${i}">${L('+ סט', '+ Set')}</button>
            ${e.sets.some((s) => s.wu) ? '' : `<button class="btn sm" data-act="wu-add" data-e="${i}">${L('+ חימום', '+ Uppvärmning')}</button>`}
          </div>
          <div class="row">
            <button class="link-btn" data-act="swap-open" data-e="${i}">${ui.swap === i ? L('סגור', 'Stäng') : L('תפוס? החלף', 'Upptagen? Byt')}</button>
            <button class="link-btn" data-act="ex-del" data-e="${i}">${L('הסר תרגיל', 'Ta bort övning')}</button>
          </div>
        </div>
        ${muscleMap(e.name, groupOf(e.swapOf || e.name))}
        ${ui.swap === i ? viewSwap(e, i) : ''}
      </div>`;
  };
  // Shown grouped by body area, in workout order (neighbors only, so a reordered workout shows as done);
  // data-e indices point at the exercise's place in the workout.
  const exs = areaRuns(w.exercises, (e) => groupOf(e.name), true)
    .map(([area, idx]) => areaDivider(area, idx.length) + idx.map((i) => card(w.exercises[i], i)).join('')).join('');

  return `
    <p class="muted small" style="margin:0 0 10px">${L('טיפ: לחיצה על מספר הסט מסמנת שהלכת בו <b class="t-fail">עד כשל</b>. כדי למחוק סט – החלק אותו הצידה.', 'Tips: tryck på setets nummer för att markera att du körde det <b class="t-fail">till failure</b>. Svep ett set åt sidan för att ta bort det.')}</p>
    <div class="wk-head">
      <input type="text" data-f="wname" value="${esc(w.name)}" aria-label="${L('שם האימון', 'Passets namn')}">
      <span class="elapsed" id="elapsed"></span>
    </div>
    <div class="wk-date">
      <input type="date" class="pill-in" data-f="wdate" value="${esc(w.date || isoDay(w.start))}" max="${isoDay(Date.now())}" aria-label="${L('תאריך האימון', 'Passets datum')}">
      ${backdated(w) ? `<span class="pill-in mins"><input type="number" inputmode="numeric" data-f="wmins" value="${esc(w.mins ?? 60)}" aria-label="${L('משך בדקות', 'Längd i minuter')}">${L('דק׳', 'min')}</span><span class="muted small">${L('טיימר כבוי', 'Timer av')}</span>` : ''}
      ${tpl ? `<button class="link-btn" data-act="tpl-edit" data-id="${tpl.id}" style="margin-inline-start:auto">${L('ערוך תבנית', 'Redigera mall')}</button>` : ''}
    </div>
    ${viewStretch(w, 'pre')}
    ${exs}
    <div class="card">
      <div class="row">
        <input type="text" id="new-ex" list="exnames" placeholder="${L('הוסף תרגיל…', 'Lägg till övning…')}" class="grow">
        <button class="btn" data-act="ex-add">${L('הוסף', 'Lägg till')}</button>
      </div>
      ${datalist()}
    </div>
    ${viewStretch(w, 'post')}
    <button class="btn primary block" data-act="finish">${L('סיים ושמור אימון', 'Avsluta och spara pass')}</button>
    ${viewMusic()}
    <button class="btn danger block" data-act="discard">${L('בטל אימון', 'Avbryt pass')}</button>`;
}

// Stretching before the workout (warm-up, at the top) and after it (cool-down, at the bottom). Shown by default;
// skipping or finishing a section folds it to one line. The workout clock runs through both, so they're part of the total time.
const STRETCH_TITLE = { pre: L('מתיחות פתיחה', 'Uppvärmning'), post: L('מתיחות סיום', 'Nedvarvning') };
function viewStretch(w, phase) {
  const list = stretchesFor(w, phase);
  const done = new Set(stretchState(w)[phase]);
  const left = list.filter((x) => !done.has(x.id));
  if (w.fold[phase]) {
    return `
      <div class="card stretch-fold row between">
        <span><b>${STRETCH_TITLE[phase]}</b> <span class="muted small">· ${left.length ? (done.size ? `${list.length - left.length}/${list.length} ${L('בוצעו', 'klara')}` : L('דילגת', 'Hoppade över')) : L('הושלם ✓', 'Klart ✓')}</span></span>
        <button class="link-btn" data-act="stretch-fold" data-ph="${phase}">${L('הצג', 'Visa')}</button>
      </div>`;
  }
  const total = list.reduce((a, x) => a + stretchSecs(x), 0);
  const leftSecs = left.reduce((a, x) => a + stretchSecs(x), 0);
  const rows = list.map((x) => `
    <div class="stretch ${done.has(x.id) ? 'done' : ''}">
      <button class="stretch-zoom" data-act="stretch-view" data-ph="${phase}" data-id="${x.id}" aria-label="${L('הגדל הדגמה', 'Förstora demo')}: ${esc(x.name)}">${demoAnim(stretchImages(x))}</button>
      <div class="stretch-body">
        <div class="stretch-name">${esc(x.name)}</div>
        <div class="muted small">${esc(x.how)}</div>
        <div class="row" style="margin-top:6px">
          <button class="rest-pill" data-act="stretch-go" data-ph="${phase}" data-id="${x.id}" aria-label="${L('הפעל טיימר מתיחה', 'Starta stretchtimer')}">▶ ${x.hold} ${L('שנ׳', 's')}${x.sides ? L(' לכל צד', ' per sida') : ''}</button>
          <button class="check" data-act="stretch-done" data-ph="${phase}" data-id="${x.id}" aria-label="${L('סמן מתיחה כבוצעה', 'Markera stretch som klar')}" aria-pressed="${done.has(x.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button>
        </div>
      </div>
    </div>`).join('');
  return stretchViewer(phase, list) + `
    <div class="row between" style="margin:${phase === 'pre' ? '0' : '26px'} 0 10px">
      <h2 style="margin:0">${STRETCH_TITLE[phase]}</h2>
      <button class="btn sm" data-act="stretch-fold" data-ph="${phase}">${left.length ? L('דלג', 'Hoppa över') : L('סגור', 'Stäng')}</button>
    </div>
    <div class="card">
      <div class="row between">
        <span class="muted small">${phase === 'pre' ? L('חימום דינמי לאזורים של האימון', 'Dynamisk uppvärmning för passets kroppsdelar') : L('מתיחות סטטיות לאזורים של האימון', 'Statisk stretch för passets kroppsdelar')}</span>
        <span class="muted small">${leftSecs ? L(`נשארו ≈ ${Math.ceil(leftSecs / 60)} מתוך ${Math.ceil(total / 60)} דק׳`, `≈ ${Math.ceil(leftSecs / 60)} av ${Math.ceil(total / 60)} min kvar`) : L('הושלם ✓', 'Klart ✓')}</span>
      </div>
      ${rows}
      <p class="muted small" style="margin:8px 0 0">${L('נכלל בזמן הכולל של האימון. ▶ מפעיל טיימר שמחליף צד באמצע ומסמן ✓ בסוף.', 'Ingår i passets totala tid. ▶ startar en timer som byter sida halvvägs och bockar av ✓ i slutet.')}</p>
    </div>`;
}

// Tapping a stretch's demo opens it larger in a small window over the workout.
function stretchViewer(phase, list) {
  const x = ui.stretchView?.ph === phase && list.find((s) => s.id === ui.stretchView.id);
  return x ? `
    <div class="stretch-view" data-act="stretch-view-close" role="dialog" aria-modal="true" aria-label="${esc(x.name)}">
      <div class="stretch-view-box" data-act="none">
        <div class="row between">
          <b>${esc(x.name)}</b>
          <button class="icon-btn" data-act="stretch-view-close" aria-label="${L('סגור', 'Stäng')}">✕</button>
        </div>
        ${demoAnim(stretchImages(x), true)}
        <div class="muted small" style="margin-top:8px">${esc(x.how)}</div>
        <div class="muted small" style="margin-top:4px">${x.hold} ${L('שנ׳', 's')}${x.sides ? L(' לכל צד', ' per sida') : ''}</div>
      </div>
    </div>` : '';
}

function viewSwap(e, i) {
  const alts = altsFor(e.swapOf || e.name).filter((n) => n !== e.name);
  const saved = new Set(db.alts[e.swapOf || e.name] || []);
  const done = e.sets.filter((s) => s.done).length;
  return `
    <div class="swap">
      <div class="muted small">${done ? L('הסטים שכבר בוצעו יישארו כאן, והסטים שנשארו יעברו לתרגיל החלופי.', 'Seten du redan har gjort stannar här, och resten flyttas till den nya övningen.') : L('בחר תרגיל חלופי. מספר הסטים והמנוחה נשמרים, והתבנית לא משתנה.', 'Välj en ersättningsövning. Antal set och vila behålls, och mallen ändras inte.')}</div>
      <div class="demo-variants">${alts.map((n) => `<button class="chip ${saved.has(n) ? 'on' : ''}" data-act="swap-pick" data-e="${i}" data-n="${esc(n)}">${esc(exName(n))}</button>`).join('') || `<span class="muted small">${L('אין הצעות – הקלד תרגיל למטה', 'Inga förslag – skriv en övning nedan')}</span>`}</div>
      <div class="row" style="margin-top:10px">
        <input type="text" id="swap-name" list="exnames" placeholder="${L('תרגיל חלופי אחר…', 'Annan ersättningsövning…')}" class="grow">
        <button class="btn sm" data-act="swap-custom" data-e="${i}">${L('החלף', 'Byt')}</button>
      </div>
    </div>`;
}

// Language picker flags, drawn inline so they look the same on every phone.
const FLAG_IL = '<svg viewBox="0 0 30 22" aria-hidden="true"><rect width="30" height="22" fill="#fff"/><rect y="2.1" width="30" height="3.4" fill="#0038b8"/><rect y="16.5" width="30" height="3.4" fill="#0038b8"/><path d="M15 7.2l3.3 5.7h-6.6zM15 14.8l-3.3-5.7h6.6z" fill="none" stroke="#0038b8" stroke-width=".9"/></svg>';
const FLAG_SE = '<svg viewBox="0 0 16 10" aria-hidden="true"><rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc00"/><rect y="4" width="16" height="2" fill="#fecc00"/></svg>';

function viewSettings() {
  const hasKey = !!getApiKey();
  return `
    <h2 style="margin-top:0">${L('שפה · Språk', 'Språk · שפה')}</h2>
    <div class="card lang-pick">
      <button class="${SV ? '' : 'on'}" data-act="lang" data-k="he" lang="he" dir="rtl" aria-pressed="${!SV}">${FLAG_IL}<span>עברית</span></button>
      <button class="${SV ? 'on' : ''}" data-act="lang" data-k="sv" lang="sv" dir="ltr" aria-pressed="${SV}">${FLAG_SE}<span>Svenska</span></button>
    </div>

    <h2>${L('אימון', 'Träning')}</h2>
    <div class="card">
      <label class="field">${L('זמן מנוחה ברירת מחדל (שניות)', 'Standardvila (sekunder)')}
        <input type="number" inputmode="numeric" data-f="defrest" value="${db.settings.defaultRest}">
      </label>
      <label class="field">${L('זמן מנוחה בין תרגילים (שניות)', 'Vila mellan övningar (sekunder)')}
        <input type="number" inputmode="numeric" data-f="exrest" value="${db.settings.exRest}">
        <span class="muted small">${L('מופעל אוטומטית כשמסיימים את הסט האחרון בתרגיל. 0 = בלי טיימר.', 'Startar automatiskt när du avslutar sista setet i en övning. 0 = ingen timer.')}</span>
      </label>
      <label class="field">${L('יעד ימי אימון בשבוע', 'Mål: träningsdagar per vecka')}
        <input type="number" inputmode="numeric" data-f="wgoal" value="${db.settings.weeklyGoal || ''}" placeholder="${L('0 = בלי יעד', '0 = inget mål')}">
        <span class="muted small">${L('אימוני כוח ואירובי נספרים יחד. ימי מנוחה לא שוברים את הרצף, רק שבוע שלא הגיע ליעד.', 'Styrka och kondition räknas tillsammans. Vilodagar bryter inte sviten, bara en vecka som inte når målet.')}</span>
      </label>
      <label class="check-row">
        <input type="checkbox" data-f="set-lastfail" ${db.settings.lastSetFail ? 'checked' : ''}>
        <span>${L('הסט האחרון בכל תרגיל הוא עד כשל', 'Sista setet i varje övning körs till failure')}<br><span class="muted small">${L('מסומן אוטומטית בתחילת אימון. אפשר לבטל לסט מסוים בלחיצה על המספר שלו.', 'Markeras automatiskt när passet startar. Tryck på ett sets nummer för att ändra det.')}</span></span>
      </label>
      <label class="check-row">
        <input type="checkbox" data-f="set-music" ${db.settings.showMusic !== false ? 'checked' : ''}>
        <span>${L('הצג "מוזיקה לאימון"', 'Visa "Träningsmusik"')}</span>
      </label>
    </div>

    <h2>${L('גיבוי', 'Säkerhetskopia')}</h2>
    <div class="card">
      <button class="btn block" data-act="export" style="margin-top:0">${L('ייצוא גיבוי (קובץ JSON)', 'Exportera säkerhetskopia (JSON-fil)')}</button>
      <button class="btn block" data-act="import">${L('שחזור מגיבוי', 'Återställ från säkerhetskopia')}</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="small" style="margin-bottom:0"><b>${db.settings.lastBackup ? L(`גיבוי אחרון: ${fmtDateFull(db.settings.lastBackup)}`, `Senaste säkerhetskopian: ${fmtDateFull(db.settings.lastBackup)}`) : L('עוד לא נעשה גיבוי', 'Ingen säkerhetskopia har gjorts än')}</b></p>
      <p class="muted small" style="margin-bottom:0">${L('הנתונים נשמרים רק בטלפון הזה. מומלץ לייצא גיבוי מדי פעם. תמונות המעקב ומפתח ה-API לא נכללים בגיבוי.', 'Datan sparas bara på den här telefonen. Exportera en säkerhetskopia då och då. Progressbilderna och API-nyckeln ingår inte i säkerhetskopian.')}</p>
    </div>

    <h2>${L('קריאה אוטומטית עם Claude', 'Automatisk avläsning med Claude')}</h2>
    <div class="card">
      <label class="field">${L('מפתח Claude API', 'Claude API-nyckel')} ${hasKey ? `<span class="ok">${L('✓ שמור', '✓ Sparad')}</span>` : ''}
        <input type="password" data-f="apikey" value="${esc(getApiKey())}" placeholder="sk-ant-…" autocomplete="off" dir="ltr">
      </label>
      <p class="muted small" style="margin-bottom:0">${L('אופציונלי, בתשלום לפי שימוש. עם מפתח, האפליקציה קוראת דוחות הרכב גוף מתמונה ומביאה המלצות ישירות מ-Claude בלי העתק-הדבק. זה נפרד מהמנוי ל-Claude ומחויב לפי שימוש (כמה סנטים לדוח). המפתח נשמר רק בטלפון הזה ולא נכלל בקובץ הגיבוי.', 'Valfritt, betalas per användning. Med en nyckel läser appen kroppssammansättningsrapporter från en bild och hämtar råd direkt från Claude utan att kopiera och klistra in. Det är separat från Claude-prenumerationen och debiteras per användning (några ören per rapport). Nyckeln sparas bara på den här telefonen och ingår inte i säkerhetskopian.')}</p>
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
        <input type="text" class="grow" list="exnames" data-f="tex-name" data-i="${i}" value="${esc(e.name)}" placeholder="${L('שם התרגיל', 'Övningens namn')}">
        <button class="icon-btn" data-act="demo" data-i="${i}" aria-label="${L('הדגמת התרגיל', 'Demo av övningen')}">▶</button>
        <button class="icon-btn" data-act="tex-up" data-i="${i}" aria-label="${L('הזז למעלה', 'Flytta upp')}">▲</button>
        <button class="icon-btn" data-act="tex-down" data-i="${i}" aria-label="${L('הזז למטה', 'Flytta ner')}">▼</button>
        <button class="icon-btn" data-act="tex-del" data-i="${i}" aria-label="${L('הסר', 'Ta bort')}">✕</button>
      </div>
      ${e.name.trim() ? muscleMap(e.name, draftGroup(e)) + noteChip(e.name.trim(), `data-i="${i}"`) : ''}
      <div class="grid">
        <label class="field">${L('סטים', 'Set')}<input type="number" inputmode="numeric" data-f="tex-sets" data-i="${i}" value="${esc(e.sets)}"></label>
        <label class="field">${L('חזרות', 'Reps')}<input type="number" inputmode="numeric" data-f="tex-reps" data-i="${i}" value="${esc(e.reps)}"></label>
        <label class="field">${L('מנוחה (ש׳)', 'Vila (s)')}<input type="number" inputmode="numeric" data-f="tex-rest" data-i="${i}" value="${esc(e.rest)}"></label>
        <label class="field">${L('משקל (ק״ג)', 'Vikt (kg)')}<input type="number" inputmode="decimal" step="any" data-f="tex-w" data-i="${i}" value="${esc(e.w ?? '')}" placeholder="—"></label>
        <label class="field span2">${L('אזור גוף', 'Kroppsdel')}
          <select data-f="tex-group" data-i="${i}">${GROUPS.map((g) => `<option value="${g}" ${g === draftGroup(e) ? 'selected' : ''}>${gName(g)}</option>`).join('')}</select>
        </label>
      </div>
    </div>`).join('');

  return `
    ${db.active ? `<p class="muted small" style="margin:0 0 10px">${L('השינויים נשמרים בתבנית לאימונים הבאים. האימון הפעיל לא משתנה – ביטול או שמירה יחזירו אותך אליו.', 'Ändringarna sparas i mallen till kommande pass. Det pågående passet ändras inte – Avbryt eller Spara tar dig tillbaka till det.')}</p>` : ''}
    <label class="field">${L('שם התבנית', 'Mallens namn')}<input type="text" data-f="tname" value="${esc(d.name)}" placeholder="${L('למשל: אימון A', 't.ex. Pass A')}"></label>
    <h2>${L('תרגילים', 'Övningar')}</h2>
    ${exs}
    ${datalist()}
    <button class="btn ghost block" data-act="tex-add">${L('+ הוסף תרגיל', '+ Lägg till övning')}</button>
    <button class="btn primary block" data-act="tpl-save">${L('שמור תבנית', 'Spara mall')}</button>
    <button class="btn block" data-act="tpl-cancel">${L('ביטול', 'Avbryt')}</button>
    ${d.isNew ? '' : d.confirmDel ? `
    <div class="card confirm-del">
      <div><b>${L(`למחוק את "${esc(d.name || 'התבנית')}"?`, `Ta bort "${esc(d.name || 'mallen')}"?`)}</b><br><span class="muted small">${L('אימונים שכבר נשמרו לא יימחקו.', 'Pass som redan sparats tas inte bort.')}</span></div>
      <div class="row" style="margin-top:10px">
        <button class="btn danger-fill grow" data-act="tpl-del-yes">${L('כן, מחק', 'Ja, ta bort')}</button>
        <button class="btn grow" data-act="tpl-del-no">${L('לא, השאר', 'Nej, behåll')}</button>
      </div>
    </div>` : `<button class="btn danger block" data-act="tpl-del">${L('מחק תבנית', 'Ta bort mall')}</button>`}`;
}
