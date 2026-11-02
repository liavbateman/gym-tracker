'use strict';

// Body metrics: measurements, charts and reading a report photo with Claude.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Body metrics ----------
// better: 1 = higher is better, -1 = lower is better, 0 = neutral (colors the change vs. last measurement).
const MFIELDS = [
  { k: 'weight', l: L('משקל', 'Vikt'), u: L('ק״ג', 'kg'), better: 0 },
  { k: 'height', l: L('גובה', 'Längd'), u: L('ס״מ', 'cm'), better: 0 },
  { k: 'pbf', l: L('אחוז שומן', 'Fettprocent'), u: '%', better: -1 },
  { k: 'smm', l: L('מסת שריר', 'Muskelmassa'), u: L('ק״ג', 'kg'), better: 1 },
  { k: 'fat', l: L('מסת שומן', 'Fettmassa'), u: L('ק״ג', 'kg'), better: -1 },
  { k: 'bmi', l: 'BMI', u: '', better: -1 },
  { k: 'visceral', l: L('שומן ויסצרלי', 'Visceralt fett'), u: L('רמה', 'nivå'), better: -1 },
  { k: 'score', l: L('ציון InBody', 'InBody-poäng'), u: '', better: 1 },
  { k: 'bmr', l: L('חילוף חומרים (BMR)', 'Basalmetabolism (BMR)'), u: L('קק״ל', 'kcal'), better: 1 },
  { k: 'ffm', l: L('מסה רזה', 'Fettfri massa'), u: L('ק״ג', 'kg'), better: 1 },
  { k: 'tbw', l: L('מים בגוף', 'Kroppsvatten'), u: L('ליטר', 'liter'), better: 0 },
  { k: 'protein', l: L('חלבון', 'Protein'), u: L('ק״ג', 'kg'), better: 1 },
  { k: 'mineral', l: L('מינרלים', 'Mineraler'), u: L('ק״ג', 'kg'), better: 0 },
];
const MF = Object.fromEntries(MFIELDS.map((f) => [f.k, f]));
const CHART_METRICS = [['pbf', L('אחוז שומן', 'Fettprocent')], ['weight', L('משקל', 'Vikt')], ['smm', L('שריר', 'Muskler')], ['fat', L('שומן ק״ג', 'Fett kg')]];

const API_KEY_KEY = 'gym-tracker-apikey';
const getApiKey = () => { try { return localStorage.getItem(API_KEY_KEY) || ''; } catch { return ''; } };
const setApiKey = (v) => { try { v ? localStorage.setItem(API_KEY_KEY, v) : localStorage.removeItem(API_KEY_KEY); } catch { /* ignore */ } };

const sortedMetrics = () => [...db.metrics].sort((a, b) => b.t - a.t);
const latestOf = (k) => sortedMetrics().find((m) => m[k] != null);
const isoDay = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayTs = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y && m && d ? new Date(y, m - 1, d, 12).getTime() : null; };
const fmtDateFull = (ts) => new Date(ts).toLocaleDateString(LOC, { day: 'numeric', month: 'numeric', year: '2-digit' });

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
    <h2>${L('מדידות קודמות מהדוח', 'Tidigare mätningar från rapporten')}</h2>
    <div class="card">
      <p class="muted small" style="margin-top:0">${L('נמצאו בטבלת ההיסטוריה של הדוח. מסומנות יתווספו (רק משקל, שריר ואחוז שומן).', 'Hittades i rapportens historiktabell. De markerade läggs till (bara vikt, muskler och fettprocent).')}</p>
      ${d.history.map((h, i) => `
        <label class="hist-row">
          <input type="checkbox" data-f="m-hist" data-i="${i}" ${h.add ? 'checked' : ''} ${h.exists ? 'disabled' : ''}>
          <span class="grow">${fmtDateFull(dayTs(h.date))}${h.exists ? ` <span class="muted small">${L('(כבר קיימת)', '(finns redan)')}</span>` : ''}</span>
          <span class="muted small" dir="ltr">${[h.weight != null ? `${fmtW(h.weight)}kg` : '', h.smm != null ? `SMM ${fmtW(h.smm)}` : '', h.pbf != null ? `${fmtW(h.pbf)}%` : ''].filter(Boolean).join(' · ')}</span>
        </label>`).join('')}
    </div>` : '';

  return `
    ${d.fromImage ? `<div class="card note">${L('הנתונים נקראו מהתמונה. כדאי לעבור עליהם ולתקן אם משהו לא נקרא נכון.', 'Värdena lästes från bilden. Gå igenom dem och rätta om något blev fel.')}</div>` : ''}
    <div class="card">
      <label class="field">${L('תאריך המדידה', 'Mätdatum')}<input type="date" data-f="m-date" value="${esc(d.date)}"></label>
      <div class="mgrid">
        ${MFIELDS.map((f) => `<label class="field">${f.l}${f.u ? ` <span class="unit">(${f.u})</span>` : ''}<input type="number" inputmode="decimal" step="any" data-f="m-val" data-k="${f.k}" value="${esc(d.vals[f.k])}"></label>`).join('')}
      </div>
    </div>
    ${hist}
    <button class="btn primary block" data-act="m-save">${L('שמור מדידה', 'Spara mätning')}</button>
    <button class="btn block" data-act="m-cancel">${L('ביטול', 'Avbryt')}</button>
    ${d.isNew ? '' : `<button class="btn danger block" data-act="m-del">${L('מחק מדידה', 'Ta bort mätning')}</button>`}`;
}

function viewMetrics() {
  if (ui.mdraft) return viewMetricForm();
  const list = sortedMetrics();
  const hasKey = !!getApiKey();

  const paste = ui.pasteOpen ? `
    <div class="card steps">
      <div class="row between"><h3>${L('קליטת נתונים מ-Claude', 'Hämta värden från Claude')}</h3><button class="icon-btn" data-act="paste-close" aria-label="${L('סגור', 'Stäng')}">✕</button></div>
      <ol>
        <li>${L('העתק את ההוראה:', 'Kopiera instruktionen:')}<button class="btn sm" data-act="paste-copy">${L('העתק הוראה ל-Claude', 'Kopiera instruktion till Claude')}</button></li>
        <li>${L('פתח את Claude, צרף את תמונת הדוח והדבק את ההוראה.', 'Öppna Claude, bifoga bilden av rapporten och klistra in instruktionen.')}</li>
        <li>${L('העתק את התשובה שתקבל, חזור לכאן והדבק:', 'Kopiera svaret du får, kom tillbaka hit och klistra in:')}
          <button class="btn sm" data-act="paste-read">${L('הדבק מהלוח', 'Klistra in från urklipp')}</button>
          <textarea id="paste-text" data-f="paste-text" rows="4" dir="ltr" placeholder="${L('או הדבק כאן ידנית…', 'eller klistra in här manuellt…')}">${esc(ui.pasteText)}</textarea>
        </li>
      </ol>
      <button class="btn primary block" data-act="paste-parse">${L('קלוט נתונים', 'Läs in värden')}</button>
    </div>` : `<button class="btn primary block" data-act="paste-open" style="margin-top:0">${L('קליטת נתונים מ-Claude', 'Hämta värden från Claude')}</button>`;

  const upload = ui.reading
    ? `<div class="card center reading"><div class="spinner"></div><div style="margin-top:10px">${L('קורא את הנתונים מהדוח…', 'Läser värdena från rapporten…')}</div><div class="muted small">${L('זה לוקח בדרך כלל כמה שניות', 'Det brukar ta några sekunder')}</div></div>`
    : `${paste}
       ${hasKey ? `<button class="btn block" data-act="m-upload">${L('קריאה אוטומטית מתמונה', 'Läs automatiskt från bild')}</button><input type="file" id="m-file" accept="image/*" hidden>` : ''}
       <button class="btn ghost block" data-act="m-manual">${L('+ הזנה ידנית', '+ Mata in manuellt')}</button>`;

  let latest = '', chartCard = '', rows = '';
  if (list.length) {
    const [cur, prev] = list;
    const shown = ['weight', 'pbf', 'smm', 'fat', 'visceral', 'score'].filter((k) => cur[k] != null);
    latest = `
      <div class="row between" style="margin:18px 0 10px"><h2 style="margin:0">${L('מדידה אחרונה', 'Senaste mätningen')}</h2><span class="muted small">${fmtDateFull(cur.t)}</span></div>
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
        ${points.length > 1 ? chart(points, MF[ui.bodyMetric].u) : `<p class="muted small center">${L('צריך לפחות שתי מדידות כדי להציג גרף.', 'Det behövs minst två mätningar för att visa ett diagram.')}</p>`}
      </div>`;

    rows = list.map((m) => `
      <details class="card hist">
        <summary class="row between">
          <b>${fmtDateFull(m.t)}</b>
          <span class="muted small" dir="ltr">${[m.weight != null ? `${fmtW(m.weight)} kg` : '', m.pbf != null ? `${fmtW(m.pbf)}%` : ''].filter(Boolean).join(' · ')}</span>
        </summary>
        <div class="mlist">${MFIELDS.filter((f) => m[f.k] != null).map((f) => `<div><span class="muted">${f.l}</span><b dir="ltr">${fmtW(m[f.k])} ${f.u === '%' ? '%' : ''}</b></div>`).join('')}</div>
        <button class="btn sm" data-act="m-edit" data-id="${m.id}" style="margin-top:10px">${L('עריכה', 'Redigera')}</button>
      </details>`).join('');
  }

  const recs = !list.length ? ''
    : ui.recsOpen ? viewRecs()
      : `<button class="btn primary block" data-act="recs-open">${L('המלצות לשיפור האימון', 'Råd för bättre träning')}</button>`;

  return `
    ${upload}
    ${list.length ? latest + recs + chartCard + `<h2>${L('כל המדידות', 'Alla mätningar')}</h2>` + rows : `<div class="empty">${L('עוד אין מדידות.<br>צלם את דוח ה-InBody (או כל דוח הרכב גוף), תן ל-Claude לקרוא אותו והדבק את התשובה כאן.', 'Inga mätningar än.<br>Fota din InBody-rapport (eller en annan kroppssammansättningsrapport), låt Claude läsa den och klistra in svaret här.')}</div>`}`;
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

async function saveMetric() {
  const d = ui.mdraft;
  const t = dayTs(d.date);
  if (!t) { toast(L('בחר תאריך', 'Välj ett datum')); return; }
  const entry = { id: d.id, t };
  for (const f of MFIELDS) { const v = num(d.vals[f.k]); if (v != null) entry[f.k] = v; }
  if (Object.keys(entry).length === 2) { toast(L('לא הוזנו נתונים', 'Inga värden ifyllda')); return; }

  // One measurement per day: a new entry on a day that already has one replaces it.
  const sameDay = d.isNew && db.metrics.find((m) => isoDay(m.t) === d.date);
  if (sameDay && !await ask({ title: L('להחליף את המדידה?', 'Ersätta mätningen?'), msg: L(`כבר קיימת מדידה מ-${fmtDateFull(t)}. החדשה תחליף אותה.`, `Det finns redan en mätning från ${fmtDateFull(t)}. Den nya ersätter den.`), ok: L('החלף', 'Ersätt') })) return;
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
  toast(added ? L(`המדידה נשמרה (+${added} מההיסטוריה)`, `Mätningen sparad (+${added} från historiken)`) : L('המדידה נשמרה', 'Mätningen sparad'));
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
  if (!r) { toast(L('לא נמצאו נתונים בטקסט. ודא שהעתקת את כל התשובה של Claude', 'Hittade inga värden i texten. Kontrollera att du kopierade hela svaret från Claude'), 3500); return; }
  if (!r.is_report) { toast(L('Claude לא זיהה דוח הרכב גוף בתמונה', 'Claude hittade ingen kroppssammansättningsrapport i bilden'), 3500); return; }
  if (MFIELDS.every((f) => r[f.k] == null)) { toast(L('לא נמצאו ערכים בתשובה', 'Inga värden i svaret'), 3500); return; }
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
    if (res.stop_reason === 'refusal') throw uiErr(L('לא ניתן היה לעבד את התמונה', 'Bilden kunde inte bearbetas'));
    if (res.stop_reason === 'max_tokens') throw uiErr(L('התשובה נקטעה, נסה שוב', 'Svaret klipptes av, försök igen'));
    const text = res.content.find((b) => b.type === 'text')?.text;
    return JSON.parse(text);
  } catch (e) {
    throw apiError(sdk, e);
  }
}

// User-facing messages for the SDK's error types.
function apiError(sdk, e) {
  if (e instanceof sdk.AuthenticationError) return uiErr(L('מפתח ה-API לא תקין', 'API-nyckeln är ogiltig'));
  if (e instanceof sdk.RateLimitError) return uiErr(L('יותר מדי בקשות, נסה שוב בעוד דקה', 'För många förfrågningar, försök igen om en minut'));
  if (e instanceof sdk.APIConnectionError) return uiErr(L('אין חיבור לאינטרנט', 'Ingen internetanslutning'));
  if (e instanceof sdk.APIError) return uiErr(`${L('שגיאה מהשרת', 'Serverfel')} (${e.status ?? '?'})`);
  return e;
}

async function handleReportFile(file) {
  ui.reading = true; render();
  try {
    const r = await readReport(file);
    if (!r.is_report) { toast(L('זה לא נראה כמו דוח הרכב גוף', 'Det här ser inte ut som en kroppssammansättningsrapport'), 3500); return; }
    ui.mdraft = newMetricDraft(r, r.date && dayTs(r.date) ? r.date : isoDay(Date.now()), r.history || [], true);
  } catch (e) {
    toast(e.ui ? e.message : L('לא הצלחתי לקרוא את התמונה', 'Kunde inte läsa bilden'), 3500);
  } finally {
    ui.reading = false;
    render();
    window.scrollTo(0, 0);
  }
}
