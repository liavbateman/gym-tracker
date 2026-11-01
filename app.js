'use strict';

// ---------- Storage ----------
const KEY = 'gym-tracker-v1';
const TIMER_KEY = 'gym-tracker-timer';
const DEFAULT_SETTINGS = { defaultRest: 90, increment: 2.5, lastSetFail: true };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);

function seed() {
  const ex = (name, sets, reps, rest, inc = 2.5) => ({ id: uid(), name, sets, reps, rest, inc });
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
          ex('סקוואט', 4, 6, 150, 5), ex('דדליפט רומני', 3, 8, 120, 5), ex('לחיצת רגליים', 3, 10, 90, 5),
          ex('מכרעים', 3, 10, 90), ex('הרמת עקבים', 4, 12, 60),
        ],
      },
    ],
    workouts: [],
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

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('שגיאה בשמירת הנתונים'); }
}

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- Helpers ----------
const ui = { tab: 'workout', draft: null, progEx: null, progMetric: 'e1rm' };

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
    return `<div><span class="${on ? 'on' : ''}"></span>${d}</div>`;
  }).join('');
  return `<div class="card"><div class="row between"><h3>השבוע</h3><span class="muted small">${count} אימונים</span></div><div class="week">${cells}</div></div>`;
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
  const tpls = ordered.map((t) => `
    <button class="tpl ${t.id === nextId ? 'next' : ''}" data-act="start" data-id="${t.id}">
      ${t.id === nextId ? '<span class="badge">הבא בתור</span>' : ''}
      <div class="name">${esc(t.name)}</div>
      <div class="sub">${t.exercises.map((e) => esc(e.name)).join(' · ') || 'אין תרגילים'}</div>
    </button>`).join('');

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
    ${tpls || '<p class="muted">אין עדיין תבניות. אפשר ליצור בלשונית "תבניות".</p>'}
    <button class="btn ghost block" data-act="start-empty">+ אימון ריק</button>
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
  const exs = w.exercises.map((e, i) => {
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
          <button class="check" data-act="set-done" data-e="${i}" data-s="${j}" aria-label="סמן סט כבוצע">✓</button>
        </div>
      </div>`).join('');
    return `
      <div class="card">
        <div class="row between">
          <div class="grow">
            <div class="ex-name">${esc(e.name)}</div>
            <div class="prev">${prev ? 'פעם קודמת: ' + prev.map(prevLabel).join(' · ') : 'תרגיל חדש'}</div>
            ${e.up ? `<div class="up">⬆ עמדת ביעד – המשקל הועלה ב-${fmtW(e.up)} ק״ג</div>` : ''}
          </div>
          <button class="rest-pill" data-act="ex-rest" data-e="${i}">⏱ ${e.rest} ש׳</button>
        </div>
        <div class="set-grid set-head"><span>סט</span><span>ק״ג</span><span>חזרות</span><span></span></div>
        ${rows}
        <div class="row between" style="margin-top:8px">
          <button class="btn sm" data-act="set-add" data-e="${i}">+ סט</button>
          <button class="link-btn" data-act="ex-del" data-e="${i}">הסר תרגיל</button>
        </div>
      </div>`;
  }).join('');

  return `
    <p class="muted small" style="margin:0 0 10px">טיפ: לחיצה על מספר הסט מסמנת שהלכת בו <b class="t-fail">עד כשל</b>. כדי למחוק סט – החלק אותו הצידה.</p>
    <div class="wk-head">
      <input type="text" data-f="wname" value="${esc(w.name)}" aria-label="שם האימון">
      <span class="elapsed" id="elapsed"></span>
    </div>
    ${exs}
    <div class="card">
      <div class="row">
        <input type="text" id="new-ex" list="exnames" placeholder="הוסף תרגיל…" class="grow">
        <button class="btn" data-act="ex-add">הוסף</button>
      </div>
      ${datalist()}
    </div>
    <button class="btn primary block" data-act="finish">סיים ושמור אימון</button>
    <button class="btn danger block" data-act="discard">בטל אימון</button>`;
}

function viewTemplates() {
  const list = db.templates.map((t) => `
    <div class="card">
      <div class="row between">
        <h3 class="grow">${esc(t.name)}</h3>
        <button class="btn sm" data-act="tpl-edit" data-id="${t.id}">עריכה</button>
      </div>
      <div class="muted small" style="margin-top:8px;line-height:1.6">
        ${t.exercises.map((e) => `${esc(e.name)} – <span dir="ltr">${e.sets}×${e.reps}</span>`).join('<br>') || 'אין תרגילים'}
      </div>
    </div>`).join('');

  return `
    ${list || '<div class="empty">אין תבניות עדיין</div>'}
    <button class="btn primary block" data-act="tpl-new">+ תבנית חדשה</button>

    <h2>הגדרות וגיבוי</h2>
    <div class="card">
      <label class="field">זמן מנוחה ברירת מחדל (שניות)
        <input type="number" inputmode="numeric" data-f="defrest" value="${db.settings.defaultRest}">
      </label>
      <label class="field" style="margin-top:10px">קפיצת משקל ברירת מחדל (ק״ג)
        <input type="number" inputmode="decimal" step="any" data-f="set-inc" value="${db.settings.increment}">
      </label>
      <p class="muted small">כשעומדים ביעד החזרות בכל הסטים, המשקל בפעם הבאה עולה בקפיצה הזו. אפשר לקבוע קפיצה שונה לכל תרגיל בעריכת התבנית.</p>
      <label class="check-row">
        <input type="checkbox" data-f="set-lastfail" ${db.settings.lastSetFail ? 'checked' : ''}>
        <span>הסט האחרון בכל תרגיל הוא עד כשל<br><span class="muted small">מסומן אוטומטית בתחילת אימון. אפשר לבטל לסט מסוים בלחיצה על המספר שלו.</span></span>
      </label>
      <button class="btn block" data-act="export">⬇️ ייצוא גיבוי (קובץ JSON)</button>
      <button class="btn block" data-act="import">⬆️ שחזור מגיבוי</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="muted small" style="margin-bottom:0">הנתונים נשמרים רק בטלפון הזה. מומלץ לייצא גיבוי מדי פעם.</p>
    </div>`;
}

function viewEditor() {
  const d = ui.draft;
  const exs = d.exercises.map((e, i) => `
    <div class="tex">
      <div class="row">
        <input type="text" class="grow" list="exnames" data-f="tex-name" data-i="${i}" value="${esc(e.name)}" placeholder="שם התרגיל">
        <button class="icon-btn" data-act="tex-up" data-i="${i}" aria-label="הזז למעלה">▲</button>
        <button class="icon-btn" data-act="tex-down" data-i="${i}" aria-label="הזז למטה">▼</button>
        <button class="icon-btn" data-act="tex-del" data-i="${i}" aria-label="הסר">✕</button>
      </div>
      <div class="grid">
        <label class="field">סטים<input type="number" inputmode="numeric" data-f="tex-sets" data-i="${i}" value="${esc(e.sets)}"></label>
        <label class="field">חזרות<input type="number" inputmode="numeric" data-f="tex-reps" data-i="${i}" value="${esc(e.reps)}"></label>
        <label class="field">מנוחה (ש׳)<input type="number" inputmode="numeric" data-f="tex-rest" data-i="${i}" value="${esc(e.rest)}"></label>
        <label class="field">קפיצה (ק״ג)<input type="number" inputmode="decimal" step="any" data-f="tex-inc" data-i="${i}" value="${esc(e.inc ?? db.settings.increment)}"></label>
      </div>
    </div>`).join('');

  return `
    <label class="field">שם התבנית<input type="text" data-f="tname" value="${esc(d.name)}" placeholder="למשל: אימון A"></label>
    <h2>תרגילים</h2>
    ${exs}
    ${datalist()}
    <button class="btn ghost block" data-act="tex-add">+ הוסף תרגיל</button>
    <button class="btn primary block" data-act="tpl-save">שמור תבנית</button>
    <button class="btn block" data-act="tpl-cancel">ביטול</button>
    ${d.isNew ? '' : '<button class="btn danger block" data-act="tpl-del">מחק תבנית</button>'}`;
}

function viewHistory() {
  const list = sortedWorkouts();
  if (!list.length) return '<div class="empty">עוד לא נשמרו אימונים.<br>אחרי שתסיים אימון הוא יופיע כאן.</div>';
  return list.map((w) => `
    <details class="card hist">
      <summary>
        <div class="row between"><b>${esc(w.name)}</b><span class="muted small">${fmtDate(w.start)} · ${fmtTime(w.start)}</span></div>
        <div class="muted small" style="margin-top:4px">${w.exercises.length} תרגילים · ${fmtDur(w.end - w.start)} · נפח ${Math.round(volume(w)).toLocaleString('he-IL')} ק״ג</div>
      </summary>
      ${w.exercises.map((e) => `
        <div class="hist-ex">
          <b>${esc(e.name)}</b>
          <div class="chips">${e.sets.map((s) => chip(s)).join('')}</div>
        </div>`).join('')}
      <div class="row" style="margin-top:12px">
        <button class="btn sm" data-act="hist-tpl" data-id="${w.id}">שמור כתבנית</button>
        <button class="btn sm danger" data-act="hist-del" data-id="${w.id}">מחק</button>
      </div>
    </details>`).join('');
}

function chart(points, unit) {
  const W = 340, H = 190, L = 40, R = 10, T = 12, B = 26;
  if (!points.length) return '';
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
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
      ${ticks.map((v) => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('')}
      ${area ? `<path class="ar" d="${area}"/>` : ''}
      <path class="ln" d="${path}"/>
      ${points.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.y)}" r="3.5"><title>${fmtDateShort(p.t)}: ${fmtW(p.y)} ${unit}</title></circle>`).join('')}
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

  const recent = sessions.slice(-8).reverse().map((s) => {
    const best = s.e.sets.reduce((a, b) => (e1rm(b.w, b.r) > e1rm(a.w, a.r) ? b : a));
    return `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)">
      <span class="muted small">${fmtDate(s.t)}</span>
      <span class="chips" style="margin:0">${s.e.sets.map((x) => chip(x, x === best ? 'pr' : '')).join('')}</span>
    </div>`;
  }).join('');

  return `
    ${top}
    <div class="card">
      <select data-f="prog-ex" aria-label="בחר תרגיל">${names.map((n) => `<option ${n === ui.progEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    </div>
    <div class="stats">
      <div class="stat"><div class="v" dir="ltr">${maxW ? setLabel(maxW) : '–'}</div><div class="l">שיא משקל</div></div>
      <div class="stat"><div class="v">${maxE ? fmtW(Math.round(maxE * 2) / 2) : '–'}</div><div class="l">1RM משוער (ק״ג)</div></div>
    </div>
    <div class="card">
      <div class="seg">${metrics.map(([k, l]) => `<button class="${ui.progMetric === k ? 'on' : ''}" data-act="metric" data-k="${k}">${l}</button>`).join('')}</div>
      ${chart(points, 'ק״ג')}
      <p class="muted small" style="margin:6px 0 0">${ui.progMetric === 'e1rm' ? 'כוח משוער = המשקל המקסימלי שהיית מרים לחזרה אחת, מחושב מהסט הטוב ביותר.' : ui.progMetric === 'vol' ? 'נפח = משקל × חזרות, מסוכם על כל הסטים.' : 'המשקל הכבד ביותר באימון.'}</p>
    </div>
    <div class="card"><h3>אימונים אחרונים</h3><div style="margin-top:8px">${recent}</div></div>`;
}

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  let title, html;
  switch (ui.tab) {
    case 'templates':
      title = ui.draft ? (ui.draft.isNew ? 'תבנית חדשה' : 'עריכת תבנית') : 'תבניות';
      html = ui.draft ? viewEditor() : viewTemplates();
      break;
    case 'history': title = 'היסטוריה'; html = viewHistory(); break;
    case 'progress': title = 'התקדמות'; html = viewProgress(); break;
    default: title = db.active ? 'אימון פעיל' : 'אימון'; html = db.active ? viewActive() : viewStart();
  }
  $('#title').textContent = title;
  $('#view').innerHTML = html;
  openRow = null;
  tick();
}

// ---------- Workout actions ----------
// If every working set last time hit the target reps at the same weight, suggest going up by `inc`.
function suggestIncrease(prev, target, inc) {
  if (!prev || !target || !inc) return null;
  const top = prev[0].w;
  if (!top || !prev.every((s) => s.w === top && s.r >= target)) return null;
  return top + inc;
}

// src: { name, sets?, reps?, rest?, inc? } — usually a template exercise.
function makeExercise(src, warmup) {
  const { name } = src;
  const prev = lastSetsFor(name);
  const target = num(src.reps);
  const inc = num(src.inc) || db.settings.increment;
  const up = suggestIncrease(prev, target, inc);
  const n = num(src.sets) || (prev ? prev.length : 3);
  const sets = Array.from({ length: n }, (_, j) => {
    const p = prev && (prev[j] || prev[prev.length - 1]);
    const pw = up ? fmtW(up) : p ? fmtW(p.w) : '';
    const pr = up && target ? String(target) : p ? String(p.r) : (target ? String(target) : '');
    return { w: '', r: '', pw, pr, done: false };
  });
  if (db.settings.lastSetFail && sets.length) sets[sets.length - 1].fail = true;
  if (warmup) {
    // Suggest last time's warmup, or ~50% of the working weight (rounded to 2.5) for 10 reps.
    const last = lastWarmupFor(name);
    const base = up || (prev && prev[0].w);
    const half = base ? Math.round((base * 0.5) / 2.5) * 2.5 : '';
    sets.unshift({ wu: true, w: '', r: '', pw: last ? fmtW(last.w) : (half ? fmtW(half) : ''), pr: last ? String(last.r) : '10', done: false });
  }
  return { id: uid(), name, rest: num(src.rest) || db.settings.defaultRest, target: target || '', inc, up: up ? inc : 0, sets };
}

function startWorkout(tpl) {
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
    const updated = w.exercises.filter((e) => work(e.sets).length).map((e) => {
      const old = tpl.exercises.find((x) => x.name === e.name);
      return {
        id: old ? old.id : uid(),
        name: e.name,
        sets: work(e.sets).length,
        reps: old ? old.reps : (num(e.target) || num(work(e.sets)[0].r) || num(work(e.sets)[0].pr) || 10),
        rest: e.rest,
        inc: old ? old.inc : e.inc,
      };
    });
    const sig = (list) => list.map((x) => `${x.name}|${x.sets}|${x.rest}`).join(';');
    if (sig(updated) !== sig(tpl.exercises) && confirm(`שינית את המבנה של "${tpl.name}" באימון הזה (תרגילים, סטים או מנוחה). לעדכן את התבנית?`)) {
      tpl.exercises = updated;
    }
  }

  db.workouts.push({ id: w.id, templateId: w.templateId, name: w.name || 'אימון', start: w.start, end: Date.now(), exercises });
  db.active = null;
  stopTimer();
  save();
  releaseWakeLock();
  render();
  window.scrollTo(0, 0);
  toast(prs.length ? `🏆 שיא חדש: ${prs.join(', ')}` : 'כל הכבוד! האימון נשמר 💪', prs.length ? 4000 : 2600);
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

function startTimer(sec) {
  timer = { end: Date.now() + sec * 1000, total: sec, beeped: false };
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
  if (el && db.active) el.textContent = fmtDur(Date.now() - db.active.start);

  const box = $('#timer');
  if (!timer) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const leftMs = timer.end - Date.now();
  const left = Math.ceil(leftMs / 1000);
  const over = left <= 0;
  box.classList.toggle('over', over);
  $('#timer-time').textContent = over ? 'יאללה!' : fmtDur(left * 1000);
  $('#timer-fill').style.width = `${over ? 100 : Math.max(0, Math.min(100, (leftMs / (timer.total * 1000)) * 100))}%`;
  if (over && !timer.beeped) {
    timer.beeped = true;
    saveTimer();
    if (Date.now() - timer.end < 5000) beep(); // don't beep for a timer that ran out while the app was closed
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
    ui.tab = tabBtn.dataset.tab;
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
        startTimer(ex.rest);
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
      // Weight moves by the exercise's increment, reps by 1; an empty field starts from its placeholder.
      const set = ex.sets[s], f = el.dataset.f;
      const step = f === 'w' ? (ex.inc || db.settings.increment) : 1;
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
    case 'set-del': ex.sets.splice(s, 1); save(); render(); break;
    case 'ex-del':
      if (confirm(`להסיר את "${ex.name}" מהאימון?`)) { db.active.exercises.splice(e, 1); save(); render(); }
      break;
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

    case 'timer-add': if (timer) { timer.end = Math.max(timer.end, Date.now()) + 15000; timer.total += 15; timer.beeped = false; saveTimer(); tick(); } break;
    case 'timer-sub': if (timer) { timer.end -= 15000; saveTimer(); tick(); } break;
    case 'timer-stop': stopTimer(); break;

    case 'tpl-new': ui.draft = { id: uid(), name: '', exercises: [{ id: uid(), name: '', sets: 2, reps: 8, rest: db.settings.defaultRest }], isNew: true }; render(); window.scrollTo(0, 0); break;
    case 'tpl-edit': ui.draft = { ...structuredClone(db.templates.find((t) => t.id === el.dataset.id)), isNew: false }; render(); window.scrollTo(0, 0); break;
    case 'tpl-cancel': ui.draft = null; render(); break;
    case 'tpl-del':
      if (confirm('למחוק את התבנית? (אימונים שכבר נשמרו לא יימחקו)')) { db.templates = db.templates.filter((t) => t.id !== ui.draft.id); ui.draft = null; save(); render(); }
      break;
    case 'tpl-save': {
      const d = ui.draft;
      if (!d.name.trim()) { toast('תן שם לתבנית'); return; }
      const tpl = {
        id: d.id,
        name: d.name.trim(),
        exercises: d.exercises.filter((x) => x.name.trim()).map((x) => ({
          id: x.id, name: x.name.trim(), sets: num(x.sets) || 3, reps: num(x.reps) || 10, rest: num(x.rest) || db.settings.defaultRest,
          inc: num(x.inc) ?? db.settings.increment,
        })),
      };
      const idx = db.templates.findIndex((t) => t.id === d.id);
      if (idx >= 0) db.templates[idx] = tpl; else db.templates.push(tpl);
      ui.draft = null; save(); render();
      toast('התבנית נשמרה');
      break;
    }
    case 'tex-add': ui.draft.exercises.push({ id: uid(), name: '', sets: 2, reps: 8, rest: db.settings.defaultRest }); render(); break;
    case 'tex-del': ui.draft.exercises.splice(i, 1); render(); break;
    case 'tex-up':
    case 'tex-down': {
      const j = act === 'tex-up' ? i - 1 : i + 1;
      const arr = ui.draft.exercises;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
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
    case 'defrest': { const v = num(el.value); if (v && v > 0) { db.settings.defaultRest = Math.round(v); save(); } break; }
    case 'tname': ui.draft.name = el.value; break;
    case 'tex-name': ui.draft.exercises[i].name = el.value; break;
    case 'tex-sets': ui.draft.exercises[i].sets = el.value; break;
    case 'tex-reps': ui.draft.exercises[i].reps = el.value; break;
    case 'tex-rest': ui.draft.exercises[i].rest = el.value; break;
    case 'tex-inc': ui.draft.exercises[i].inc = el.value; break;
    case 'set-inc': { const v = num(el.value); if (v && v > 0) { db.settings.increment = v; save(); } break; }
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.f === 'prog-ex') { ui.progEx = el.value; render(); }
  if (el.dataset.f === 'set-lastfail') { db.settings.lastSetFail = el.checked; save(); }
  if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.id === 'new-ex') $('[data-act="ex-add"]').click();
});

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

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
