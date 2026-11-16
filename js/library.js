'use strict';

// Exercise library: recommended exercises per body area, each with its demo and the muscles it works.
// Loaded as a plain <script> after demos.js; all the files share one global scope.

// Body areas in the strip at the top, and which side of the figure shows each one best.
const LIB_AREAS = [['חזה', 'front'], ['גב', 'back'], ['כתפיים', 'front'], ['יד קדמית', 'front'], ['יד אחורית', 'back'], ['בטן', 'front'], ['רגליים', 'front']];
// [the app's name, free-exercise-db id], the staples of each area first.
const LIBRARY = {
  'חזה': [['לחיצת חזה במוט', 'Barbell_Bench_Press_-_Medium_Grip'], ['לחיצת חזה במשקולות', 'Dumbbell_Bench_Press'],
    ['לחיצת חזה בשיפוע במשקולות', 'Incline_Dumbbell_Press'], ['לחיצת חזה בשיפוע במוט', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
    ['לחיצת חזה במכונה', 'Machine_Bench_Press'], ['פרפר בכבל', 'Cable_Crossover'], ['פק דק', 'Butterfly'],
    ['פרפר במשקולות', 'Dumbbell_Flyes'], ['מקבילים', 'Dips_-_Chest_Version'], ['שכיבות סמיכה', 'Pushups']],
  'גב': [['מתח', 'Pullups'], ['פולי עליון', 'Wide-Grip_Lat_Pulldown'], ['חתירה במוט', 'Bent_Over_Barbell_Row'],
    ['חתירה במשקולת', 'One-Arm_Dumbbell_Row'], ['פולי תחתון', 'Seated_Cable_Rows'], ['חתירה במכונה', 'Leverage_Iso_Row'],
    ['פול אובר בכבל', 'Straight-Arm_Pulldown'], ['שראג', 'Barbell_Shrug']],
  'כתפיים': [['לחיצת כתפיים במשקולות', 'Dumbbell_Shoulder_Press'], ['לחיצה צבאית', 'Standing_Military_Press'],
    ['לחיצת כתפיים במכונה', 'Machine_Shoulder_Military_Press'], ['ארנולד פרס', 'Arnold_Dumbbell_Press'],
    ['הרחקה לצדדים', 'Side_Lateral_Raise'], ['הרחקה לצדדים בכבל', 'Cable_Seated_Lateral_Raise'],
    ['פייס פול', 'Face_Pull'], ['פרפר הפוך', 'Reverse_Machine_Flyes']],
  'יד קדמית': [['כפיפת מרפקים', 'Barbell_Curl'], ['כפיפת מרפקים במשקולות', 'Dumbbell_Bicep_Curl'],
    ['כפיפת מרפקים בכבל', 'Standing_Biceps_Cable_Curl'], ['פטיש', 'Hammer_Curls'], ['כפיפת מרפקים בשיפוע', 'Incline_Dumbbell_Curl'],
    ['כפיפת מרפקים בכיסא כומר', 'Preacher_Curl'], ['כפיפת מרפקים בריכוז', 'Concentration_Curls']],
  'יד אחורית': [['פשיטת מרפקים בכבל', 'Triceps_Pushdown'], ['פשיטת מרפקים מעל הראש בכבל', 'Cable_Rope_Overhead_Triceps_Extension'],
    ['פרנץ', 'Standing_Dumbbell_Triceps_Extension'], ['סקאל קראשר', 'EZ-Bar_Skullcrusher'], ['מקבילים', 'Dips_-_Triceps_Version'],
    ['פשיטת מרפקים לאחור במשקולת', 'Tricep_Dumbbell_Kickback']],
  'בטן': [['פלאנק', 'Plank'], ['כפיפות בטן', 'Crunches'], ['הרמות רגליים בתלייה', 'Hanging_Leg_Raise'],
    ['כפיפות בטן בכבל', 'Cable_Crunch'], ['כפיפות בטן במכונה', 'Ab_Crunch_Machine'], ['גלגלת בטן', 'Ab_Roller']],
  'רגליים': [['סקוואט', 'Barbell_Squat'], ['לחיצת רגליים', 'Leg_Press'], ['סקוואט בסמית', 'Smith_Machine_Squat'],
    ['האק סקוואט', 'Hack_Squat'], ['סקוואט גובלט', 'Goblet_Squat'], ['מכרעים', 'Dumbbell_Lunges'],
    ['סקוואט בולגרי', 'Split_Squat_with_Dumbbells'], ['דדליפט רומני', 'Romanian_Deadlift'], ['כפיפת ברכיים', 'Lying_Leg_Curls'],
    ['כפיפת ברכיים בישיבה', 'Seated_Leg_Curl'], ['פשיטת ברכיים', 'Leg_Extensions'], ['היפ טראסט', 'Barbell_Hip_Thrust'],
    ['הרמת עקבים', 'Standing_Calf_Raises'], ['הרמת עקבים בישיבה', 'Seated_Calf_Raise']],
};
const LIB_IDS = new Set(Object.values(LIBRARY).flat().map(([, id]) => id));
const libImages = (id) => [`${id}/0.jpg`, `${id}/1.jpg`];
// Bookmarked library exercises: name -> {id, area}. Created on first use, so an imported backup without it still works.
function libSaved() {
  if (!db.libSaved || typeof db.libSaved !== 'object') db.libSaved = {};
  return db.libSaved;
}

const BOOKMARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';

// A small figure with the area's muscles lit up, for the strip at the top.
function areaFig(area, side) {
  const mus = GROUP_MUSCLES[area] || [];
  const parts = side === 'back' ? BODY_BACK : BODY_FRONT;
  return `<svg viewBox="0 0 50 114" aria-hidden="true">${parts.map(([k, s]) => `<g class="${k && mus.includes(k) ? 'mp' : ''}">${s}</g>`).join('')}</svg>`;
}

function openLibrary(area) {
  const last = db.active?.exercises.at(-1);
  const guess = last && LIBRARY[groupOf(last.name)] ? groupOf(last.name) : null;
  ui.lib = { area: area || guess || ui.libArea || 'חזה', more: false };
  render();
  window.scrollTo(0, 0);
}

function closeLibrary() {
  ui.lib = null;
  render();
  window.scrollTo(0, 0);
}

const inWorkout = (name) => !!db.active?.exercises.some((x) => x.name === name);

function libCard(name, id, area, sub, english) {
  const saved = !!libSaved()[name], here = inWorkout(name);
  return `
    <div class="lib-card ${here ? 'here' : ''}">
      <button class="lib-open" data-act="lib-ex" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}">
        ${demoAnim(libImages(id))}
        <span class="lib-name" ${english ? 'dir="ltr"' : ''}>${esc(english ? name : exName(name))}</span>
        <span class="muted small">${here ? L('✓ באימון', '✓ I passet') : esc(sub)}</span>
      </button>
      <button class="lib-save ${saved ? 'on' : ''}" data-act="lib-save" data-name="${esc(name)}" data-id="${esc(id)}" data-area="${esc(area)}" aria-pressed="${saved}" aria-label="${L('שמור', 'Spara')}">${BOOKMARK}</button>
    </div>`;
}

function viewLibrary() {
  const lb = ui.lib, area = lb.area;
  const strip = `
    <div class="lib-areas" role="tablist">
      <button class="lib-area ${area === 'saved' ? 'on' : ''}" data-act="lib-area" data-a="saved" role="tab" aria-selected="${area === 'saved'}">
        <span class="lib-fig lib-bm">${BOOKMARK}</span><span>${L('שמורים', 'Sparade')}</span>
      </button>
      ${LIB_AREAS.map(([a, side]) => `
        <button class="lib-area ${a === area ? 'on' : ''}" data-act="lib-area" data-a="${a}" role="tab" aria-selected="${a === area}">
          <span class="lib-fig">${areaFig(a, side)}</span><span>${gName(a)}</span>
        </button>`).join('')}
    </div>`;

  let body;
  if (area === 'saved') {
    const list = Object.entries(libSaved());
    body = list.length
      ? `<div class="lib-grid">${list.map(([n, s]) => libCard(n, s.id, s.area, gName(s.area), !LIB_IDS.has(s.id))).join('')}</div>`
      : `<p class="muted">${L('עוד לא שמרת תרגילים. לחץ על הסימנייה בכרטיס של תרגיל כדי לשמור אותו כאן.', 'Inga sparade övningar än. Tryck på bokmärket på en övning för att spara den här.')}</p>`;
  } else {
    const rec = LIBRARY[area].map(([n, id]) => libCard(n, id, area, gName(area))).join('');
    let more = '';
    if (!lb.more) more = `<button class="btn ghost block" data-act="lib-more">${L('עוד תרגילים מהמאגר (באנגלית)', 'Fler övningar från databasen (på engelska)')}</button>`;
    else if (lb.moreErr) more = `<p class="muted small">${L('אין חיבור לאינטרנט. המאגר צריך רשת.', 'Ingen internetanslutning. Databasen behöver nätet.')}</p>`;
    else if (!lb.extra) more = '<div class="center" style="padding:24px 0"><div class="spinner"></div></div>';
    else more = `<h2>${L('עוד מהמאגר', 'Mer från databasen')}</h2><div class="lib-grid">${lb.extra.map((x) => libCard(x.name, x.id, area, x.equipment || '', true)).join('')}</div>`;
    body = `<h2>${L('מומלצים', 'Rekommenderade')}: ${gName(area)}</h2><div class="lib-grid">${rec}</div>${more}`;
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

function viewLibEx(d) {
  const { id, area, x } = d.lib;
  const english = !LIB_IDS.has(id);
  const m = x?.primaryMuscles?.length ? { p: x.primaryMuscles, s: (x.secondaryMuscles || []).filter((k) => !x.primaryMuscles.includes(k)) } : musclesFor(d.name, area);
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
      <h3 style="margin-top:16px">${L('שרירי מטרה', 'Målmuskler')}</h3>
      ${muscleMapOf(m) || `<p class="muted small">${L('אין מידע על השרירים.', 'Ingen muskelinformation.')}</p>`}
      ${x ? `<div class="demo-en" dir="ltr">${esc(x.name)}${x.equipment ? ` · ${esc(x.equipment)}` : ''}</div>` : ''}
      ${x?.instructions?.length ? `<ol class="demo-steps" dir="ltr">${x.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
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
  if (!db.active) startWorkout(null, true); // quick start: no question, a toast with undo
  if (!db.active) return;
  // Picked from this area's list, so it counts toward this area (dips from the triceps list count as triceps).
  if (!db.muscles[name] && groupOf(name) !== area) db.muscles[name] = area;
  // The library's demo becomes the exercise's demo, unless one was picked before.
  if (!db.demos[name]) {
    const x = ui.demo?.lib?.x;
    db.demos[name] = { id, name: x?.name || id.replace(/_/g, ' '), images: libImages(id), instructions: x?.instructions || [], pm: x?.primaryMuscles || [], sm: x?.secondaryMuscles || [] };
  }
  addToWorkout(name);
  save();
  ui.demo = null; renderSheet();
  render();
  toast(L(`"${exName(name)}" נוסף לאימון`, `"${exName(name)}" lades till i passet`));
}
