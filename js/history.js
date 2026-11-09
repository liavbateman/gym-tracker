'use strict';

// Progress photos, history and the progress tab.
// Loaded as a plain <script> after the files before it in index.html; they all share one global scope.

// ---------- Progress photos ----------
// Photos stay on this device only: they live in IndexedDB (too big for localStorage) and are left out of the JSON backup.
const PHOTO_DB = 'gym-photos';
let photos = []; // { id, ts, wid, blob, url }, oldest first; wid is the workout the photo belongs to
function photoStore(mode) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => res(req.result.transaction('photos', mode).objectStore('photos'));
    req.onerror = () => rej(req.error);
  });
}
const idb = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function loadPhotos() {
  try {
    const all = await idb((await photoStore('readonly')).getAll());
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    photos = all.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })).sort((a, b) => a.ts - b.ts);
    if (ui.tab === 'history') render();
  } catch { /* no IndexedDB (private mode) — the section just stays empty */ }
}

// Shrink to 1600px JPEG so a phone photo takes ~300KB instead of several MB.
async function shrinkPhoto(file) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
}

async function addPhotos(files, wid) {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    for (const f of files) {
      const blob = await shrinkPhoto(f);
      await idb((await photoStore('readwrite')).put({ id: uid(), ts: Date.now(), wid, blob }));
    }
    await loadPhotos();
    toast(files.length > 1 ? L(`${files.length} תמונות נשמרו`, `${files.length} bilder sparade`) : L('התמונה נשמרה', 'Bilden sparad'));
  } catch { toast(L('שגיאה בשמירת התמונה', 'Kunde inte spara bilden')); }
}

async function deletePhoto(...ids) {
  try {
    const store = await photoStore('readwrite');
    await Promise.all(ids.map((id) => idb(store.delete(id))));
    ui.photo = null;
    await loadPhotos();
  } catch { toast(L('שגיאה במחיקת התמונה', 'Kunde inte ta bort bilden')); }
}

// In-app camera: up to 3 shots in one session (front / side / back), saved together at the end.
// Lives outside render() so a re-render can't kill the live video. No camera access → the system picker.
const CAM_MAX = 3;
async function openCamera(wid) {
  const pick = () => { ui.photoFor = wid; $('#photo-file').click(); };
  if (!navigator.mediaDevices?.getUserMedia) return pick();
  let facing = 'environment', stream = null;
  const shots = []; // { blob, url }
  const box = document.createElement('div');
  box.className = 'cam';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', L('צילום תמונות מעקב', 'Ta progressbilder'));
  box.innerHTML = `
    <video playsinline muted autoplay></video>
    <div class="cam-top">
      <button class="btn sm" data-k="close">${L('ביטול', 'Avbryt')}</button>
      <span class="cam-count"></span>
      <button class="btn sm" data-k="flip" aria-label="${L('החלף מצלמה', 'Byt kamera')}">⟲</button>
    </div>
    <div class="cam-bottom">
      <div class="cam-shots"></div>
      <div class="cam-row">
        <button class="btn sm" data-k="gallery">${L('מהגלריה', 'Från galleriet')}</button>
        <button class="cam-shutter" data-k="shoot" aria-label="${L('צלם', 'Ta bild')}"></button>
        <button class="btn sm primary" data-k="save">${L('שמור', 'Spara')}</button>
      </div>
    </div>`;
  const video = box.querySelector('video');
  const start = async () => {
    stream?.getTracks().forEach((t) => t.stop());
    // No square/size request: that makes phones crop the sensor, which looks zoomed in. Let the camera use its full frame.
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    // Some phones open at a zoom level above 1x; reset it to the widest view the camera allows.
    const track = stream.getVideoTracks()[0];
    const zoom = track?.getCapabilities?.().zoom;
    if (zoom) await track.applyConstraints({ advanced: [{ zoom: Math.max(zoom.min, Math.min(1, zoom.max)) }] }).catch(() => {});
    video.srcObject = stream;
    video.classList.toggle('mirror', facing === 'user');
    await video.play().catch(() => {});
  };
  const paint = () => {
    box.querySelector('.cam-count').textContent = `${shots.length}/${CAM_MAX}`;
    box.querySelector('.cam-shots').innerHTML = shots.map((s, i) => `
      <button class="cam-shot" data-k="drop" data-i="${i}" aria-label="${L('הסר תמונה', 'Ta bort bild')} ${i + 1}"><img src="${s.url}" alt=""><span>✕</span></button>`).join('');
    box.querySelector('[data-k="shoot"]').disabled = shots.length >= CAM_MAX;
    box.querySelector('[data-k="save"]').disabled = !shots.length;
  };
  // Volume buttons (and Bluetooth selfie remotes, which send volume-up) take a photo too, where the browser passes them on.
  const VOL_KEYS = new Set(['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown']);
  const onVol = (ev) => {
    if (!VOL_KEYS.has(ev.key) && ![24, 25, 174, 175].includes(ev.keyCode)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!ev.repeat) shoot();
  };
  const close = () => {
    window.removeEventListener('keydown', onVol, true);
    stream?.getTracks().forEach((t) => t.stop());
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    box.remove();
    document.body.classList.remove('dlg-open');
  };
  const shoot = () => {
    if (shots.length >= CAM_MAX || !video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    const g = c.getContext('2d');
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); } // keep the selfie as it looked on screen
    g.drawImage(video, 0, 0);
    box.classList.add('flash');
    setTimeout(() => box.classList.remove('flash'), 120);
    c.toBlob((b) => { if (b) { shots.push({ blob: b, url: URL.createObjectURL(b) }); paint(); } }, 'image/jpeg', 0.92);
  };
  box.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const btn = ev.target.closest('[data-k]');
    if (!btn) return;
    const k = btn.dataset.k;
    if (k === 'shoot') shoot();
    else if (k === 'drop') { URL.revokeObjectURL(shots[+btn.dataset.i].url); shots.splice(+btn.dataset.i, 1); paint(); }
    else if (k === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; start().catch(() => toast(L('לא ניתן להחליף מצלמה', 'Kunde inte byta kamera'))); }
    else if (k === 'save') { const files = shots.map((s) => s.blob); close(); addPhotos(files, wid); }
    else if (k === 'gallery') { close(); pick(); }
    else if (k === 'close') {
      if (!shots.length) return close();
      ask({ title: L('לבטל את הצילום?', 'Avbryta fotograferingen?'), msg: L('התמונות שצולמו לא יישמרו.', 'Bilderna du tog sparas inte.'), ok: L('בטל', 'Släng bilderna'), danger: true }).then((yes) => yes && close());
    }
  });
  box.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Escape') box.querySelector('[data-k="close"]').click();
  });
  try { await start(); } catch { toast(L('אין גישה למצלמה', 'Ingen åtkomst till kameran')); return pick(); }
  paint();
  window.addEventListener('keydown', onVol, true);
  document.body.append(box);
  document.body.classList.add('dlg-open');
}

// Photos without a workout (or whose workout is gone) show under the workout closest in time.
function photosOf(w, list) {
  const ids = new Set(list.map((x) => x.id));
  const near = (p) => list.reduce((best, x) => (Math.abs(x.start - p.ts) < Math.abs(best.start - p.ts) ? x : best)).id;
  return photos.filter((p) => (ids.has(p.wid) ? p.wid : near(p)) === w.id);
}

function photoStrip(w, mine) {
  return `
    <div class="hist-photos">
      <div class="row between"><b class="small">${L('תמונות מעקב', 'Progressbilder')}</b><button class="btn sm" data-act="photo-add" data-id="${w.id}">${L('+ צלם תמונות', '+ Ta bilder')}</button></div>
      ${mine.length ? `<div class="photo-grid">${mine.map((p) => `
        <button class="photo-thumb" data-act="photo-open" data-id="${p.id}" aria-label="${L('תמונה מ-', 'Bild från ')}${fmtDateFull(p.ts)}"><img src="${p.url}" alt="" loading="lazy"></button>`).join('')}</div>`
        : `<p class="muted small" style="margin:4px 0 0">${L('נשמרות רק במכשיר הזה ולא נכללות בגיבוי.', 'Sparas bara på den här enheten och ingår inte i säkerhetskopian.')}</p>`}
    </div>`;
}

function photoViewer() {
  const open = photos.find((p) => p.id === ui.photo);
  return open ? `
    <div class="photo-view" data-act="photo-close" role="dialog" aria-modal="true" aria-label="${L('תמונת מעקב', 'Progressbild')}">
      <img src="${open.url}" alt="">
      <div class="row between" data-act="none">
        <span>${fmtDateFull(open.ts)}</span>
        <div class="row">
          <button class="btn sm danger" data-act="photo-del" data-id="${open.id}">${L('מחק', 'Ta bort')}</button>
          <button class="btn sm" data-act="photo-close">${L('סגור', 'Stäng')}</button>
        </div>
      </div>
    </div>` : '';
}

function cardioCard(c) {
  const d = new Date(c.t);
  const pace = cardioPace(c.type, c.mins, c.km);
  return `
    <details class="card hist" data-id="${c.id}" ${ui.histOpen.has(c.id) ? 'open' : ''}>
      <summary>
        <div class="hist-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(LOC, { weekday: 'short' })}</span></div>
        <div class="grow">
          <div class="hist-name">${CARDIO_BY[c.type].name} <span class="muted small">· ${L('אירובי', 'Kondition')}</span></div>
          <div class="hist-stats">
            <span><b>${fmtMins(c.mins)}</b></span>
            ${c.km ? `<span><b>${fmtDist(c.type, c.km)}</b></span>` : ''}
            ${pace ? `<span><b dir="ltr">${pace.v}</b> ${pace.u}</span>` : ''}
            <span><b>${c.kcal}</b> ${L('קלוריות', 'kalorier')}</span>
          </div>
        </div>
        <svg class="hist-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="hist-actions">
        <span class="muted small">${fmtTime(c.t)}</span>
        <button class="btn sm danger" data-act="c-del" data-id="${c.id}">${L('מחק', 'Ta bort')}</button>
      </div>
    </details>`;
}

function viewHistory() {
  const list = sortedWorkouts();
  if (!list.length && !db.cardio.length) return `<div class="empty">${L('עוד לא נשמרו אימונים.<br>אחרי שתסיים אימון הוא יופיע כאן.', 'Inga sparade pass än.<br>När du avslutar ett pass dyker det upp här.')}</div>`;
  // Workouts and cardio together, newest first.
  const items = [...list.map((w) => ({ t: w.start, w })), ...db.cardio.map((c) => ({ t: c.t, c }))].sort((a, b) => b.t - a.t);
  // Month dividers, then one card per workout: a date block, the name and three stats; tap to see every set.
  let month = '';
  return photoViewer() + `<input type="file" id="photo-file" accept="image/*" multiple hidden>` + items.map(({ t, w, c }) => {
    const d = new Date(t);
    const m = d.toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
    const head = m !== month ? `<h3 class="hist-month">${m}</h3>` : '';
    month = m;
    if (c) return head + cardioCard(c);
    const runs = areaRuns(w.exercises, (e) => groupOf(e.name));
    const mine = photosOf(w, list);
    const inten = intensity(w);
    return `${head}
    <details class="card hist" data-id="${w.id}" ${ui.histOpen.has(w.id) ? 'open' : ''}>
      <summary>
        <div class="hist-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(LOC, { weekday: 'short' })}</span></div>
        <div class="grow">
          <div class="hist-name">${esc(w.name)}</div>
          <div class="muted small">${runs.map(([a]) => esc(gName(a))).join(' · ')}</div>
          <div class="hist-stats">
            <span><b>${w.exercises.length}</b> ${L('תרגילים', 'övningar')}</span>
            <span><b>${fmtDur(w.end - w.start)}</b></span>
            <span title="${L('סכום משקל × חזרות בכל הסטים', 'Summan av vikt × reps i alla set')}">${L('נפח', 'Volym')} <b>${Math.round(volume(w)).toLocaleString(LOC)}</b> ${L('ק״ג', 'kg')}</span>
            ${inten != null ? `<span title="${L('ממוצע המשקל בסטים כאחוז מה-1RM המשוער שלך בכל תרגיל', 'Snittvikten i seten i procent av din uppskattade 1RM i varje övning')}">${L('עצימות', 'Intensitet')} <b>${inten}%</b></span>` : ''}
            ${mine.length ? `<span><b>${mine.length}</b> ${L('תמונות', 'bilder')}</span>` : ''}
          </div>
        </div>
        <svg class="hist-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="muted small hist-meta">${L('התחלה', 'Start')} ${fmtTime(w.start)}${w.stretch ? L(` · כולל ${Math.ceil(w.stretch / 60)} דק׳ מתיחות`, ` · inkl. ${Math.ceil(w.stretch / 60)} min stretch`) : ''}</div>
      <p class="muted small hist-meta">${L('נפח = משקל × חזרות בכל הסטים (בלי חימום). עצימות = כמה כבד הרמת בממוצע, באחוזים מה-1RM המשוער שלך בכל תרגיל.', 'Volym = vikt × reps i alla set (utan uppvärmning). Intensitet = hur tungt du lyfte i snitt, i procent av din uppskattade 1RM i varje övning.')}</p>
      ${runs.map(([area, idx]) => areaDivider(area, idx.length) + idx.map((i) => `
        <div class="hist-ex">
          <b>${esc(exName(w.exercises[i].name))}</b>
          <div class="chips">${w.exercises[i].sets.map((s) => chip(s)).join('')}</div>
        </div>`).join('')).join('')}
      ${photoStrip(w, mine)}
      <div class="hist-actions">
        <input type="date" class="pill-in" data-f="hist-date" data-id="${w.id}" value="${isoDay(w.start)}" max="${isoDay(Date.now())}" aria-label="${L('תאריך האימון', 'Passets datum')}">
        <button class="btn sm" data-act="hist-tpl" data-id="${w.id}">${L('שמור כתבנית', 'Spara som mall')}</button>
        <button class="btn sm danger" data-act="hist-del" data-id="${w.id}">${L('מחק', 'Ta bort')}</button>
      </div>
    </details>`;
  }).join('');
}

// markBest circles the highest point in red — only where higher means a record.
function chart(points, unit, markBest) {
  const W = 340, H = 190, PL = 40, R = 10, T = 12, B = 26;
  if (!points.length) return '';
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  const best = markBest ? max : null;
  if (min === max) { min -= 5; max += 5; }
  const padY = (max - min) * 0.1;
  min = Math.max(0, min - padY); max += padY;
  const x = (i) => (points.length === 1 ? (PL + W - R) / 2 : PL + (i * (W - PL - R)) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z` : '';
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="${L('גרף התקדמות', 'Progressdiagram')}">
      ${ticks.map((v) => `<line class="grid-l" x1="${PL}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${PL - 6}" y="${y(v) + 4}" text-anchor="end">${max - min < 10 ? v.toFixed(1) : Math.round(v)}</text>`).join('')}
      ${area ? `<path class="ar" d="${area}"/>` : ''}
      <path class="ln" d="${path}"/>
      ${points.map((p, i) => `<circle class="pt ${p.y === best ? 'best' : ''}" cx="${x(i)}" cy="${y(p.y)}" r="${p.y === best ? 6 : 3.5}"><title>${fmtDateShort(p.t)}: ${fmtW(p.y)} ${unit}</title></circle>`).join('')}
      <text class="ax" x="${PL}" y="${H - 6}" text-anchor="start">${fmtDateShort(points[0].t)}</text>
      ${points.length > 1 ? `<text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDateShort(points[points.length - 1].t)}</text>` : ''}
    </svg>`;
}

function viewProgress() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = db.workouts.filter((w) => w.start >= monthStart).length;
  const cMonth = db.cardio.filter((c) => c.t >= monthStart);
  const sum = (k) => cMonth.reduce((a, c) => a + (c[k] || 0), 0);
  const top = `
    <div class="stats">
      <div class="stat"><div class="v">${thisMonth}</div><div class="l">${L('אימונים החודש', 'Pass denna månad')}</div></div>
      <div class="stat"><div class="v">${db.workouts.length}</div><div class="l">${L('אימונים בסה״כ', 'Pass totalt')}</div></div>
      ${db.cardio.length ? `
      <div class="stat"><div class="v">${Math.round(sum('kcal')).toLocaleString(LOC)}</div><div class="l">${L('קלוריות באירובי החודש', 'Konditionskalorier denna månad')}</div></div>
      <div class="stat"><div class="v">${r1(sum('km'))}<span class="u"> ${L('ק״מ', 'km')}</span></div><div class="l">${L(`${cMonth.length} אימוני אירובי · ${Math.round(sum('mins'))} דק׳ החודש`, `${cMonth.length} konditionspass · ${Math.round(sum('mins'))} min denna månad`)}</div></div>` : ''}
    </div>`;

  const names = [];
  for (const w of sortedWorkouts()) for (const e of w.exercises) if (!names.includes(e.name)) names.push(e.name);
  if (!names.length) return top + `<div class="empty">${L('אחרי כמה אימונים יופיעו כאן גרפים ושיאים אישיים לכל תרגיל.', 'Efter några pass visas diagram och personliga rekord för varje övning här.')}</div>`;

  // Working sets per body area over the chosen period.
  const periods = [['week', L('השבוע', 'Vecka'), weekStart(now).getTime()], ['month', L('החודש', 'Månad'), monthStart], ['all', L('הכול', 'Allt'), 0]];
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
      <div class="row between"><h3>${L('סטים לפי אזור גוף', 'Set per kroppsdel')}</h3></div>
      <div class="seg" style="margin-top:10px">${periods.map(([k, l]) => `<button class="${ui.areaPeriod === k ? 'on' : ''}" data-act="area-period" data-k="${k}">${l}</button>`).join('')}</div>
      ${[...perArea].filter(([g, c]) => c || g !== 'אחר').map(([g, c]) => `
        <div class="bar-row ${c ? '' : 'zero'}">
          <span class="bar-l">${gName(g)}</span>
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
  const metrics = [['e1rm', L('כוח משוער', 'Uppskattad styrka')], ['max', L('משקל מקס׳', 'Maxvikt')], ['vol', L('נפח', 'Volym')]];

  return `
    ${top}
    ${areaCard}
    <div class="card ex-pick">
      <div class="area" style="margin-bottom:6px">${gName(groupOf(ui.progEx))}</div>
      <select data-f="prog-ex" aria-label="${L('בחר תרגיל', 'Välj övning')}">${byArea.map(([g, list]) => `<optgroup label="${gName(g)}">${list.map((n) => `<option value="${esc(n)}" ${n === ui.progEx ? 'selected' : ''}>${esc(exName(n))}</option>`).join('')}</optgroup>`).join('')}</select>
    </div>
    <div class="stats">
      <div class="stat"><div class="v" dir="ltr">${maxW ? setLabel(maxW) : '–'}</div><div class="l">${L('שיא משקל', 'Viktrekord')}</div></div>
      <div class="stat"><div class="v">${maxE ? fmtW(Math.round(maxE * 2) / 2) : '–'}</div><div class="l">${L('1RM משוער (ק״ג)', 'Uppskattad 1RM (kg)')}</div></div>
    </div>
    <div class="card">
      <div class="seg">${metrics.map(([k, l]) => `<button class="${ui.progMetric === k ? 'on' : ''}" data-act="metric" data-k="${k}">${l}</button>`).join('')}</div>
      ${chart(points, L('ק״ג', 'kg'), true)}
      <p class="muted small" style="margin:6px 0 0">${ui.progMetric === 'e1rm' ? L('כוח משוער = המשקל המקסימלי שהיית מרים לחזרה אחת, מחושב מהסט הטוב ביותר.', 'Uppskattad styrka = den tyngsta vikt du skulle klara en repetition med, beräknad från ditt bästa set.') : ui.progMetric === 'vol' ? L('נפח = משקל × חזרות, מסוכם על כל הסטים.', 'Volym = vikt × reps, summerat över alla set.') : L('המשקל הכבד ביותר באימון.', 'Den tyngsta vikten under passet.')}</p>
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
    tile(gain === null ? '–' : `<span dir="ltr">${gain > 0 ? '+' : ''}${Math.round(gain * 100)}%</span>`, L('מאז הפעם הראשונה', 'Sedan första gången'), gain > 0 ? 'up' : gain < 0 ? 'down' : ''),
    tile(month, L('פעמים ב־30 יום', 'Gånger på 30 dagar')),
    tile(ago === 0 ? L('היום', 'Idag') : ago === 1 ? L('אתמול', 'Igår') : ago, ago > 1 ? L('ימים מהפעם האחרונה', 'Dagar sedan senast') : L('הפעם האחרונה', 'Senast')),
    tile(records.length, records.length === 1 ? L('שיא שנשבר', 'Slaget rekord') : L('שיאים שנשברו', 'Slagna rekord')),
  ].join('');

  // Next-time targets, built from last session's best set
  const { w, r } = last.set;
  const goal = (l, set, rec) => `<div class="goal ${rec ? 'rec' : ''}"><div class="l">${l}</div><div class="v" dir="ltr">${setLabel(set)}</div></div>`;
  let goals;
  if (weighted) {
    let rw = Math.ceil(maxE / (1 + r / 30) / WEIGHT_STEP) * WEIGHT_STEP;
    if (e1rm(rw, r) <= maxE) rw += WEIGHT_STEP;
    goals = goal(L('עוד חזרה', 'En rep till'), { w, r: r + 1 }) + goal(L('עוד משקל', 'Mer vikt'), { w: w + WEIGHT_STEP, r })
      + goal(L('לשיא חדש', 'Nytt rekord'), { w: rw, r }, true);
  } else {
    const maxR = Math.max(...tops.map((x) => x.set.r));
    goals = goal(L('עוד חזרה', 'En rep till'), { w: 0, r: r + 1 }) + goal(L('לשיא חדש', 'Nytt rekord'), { w: 0, r: maxR + 1 }, true);
  }

  // What the current estimated max means at other rep counts
  const repMax = weighted ? `
      <h4 class="dash-h">${L('כמה אתה אמור להרים לפי חזרות', 'Vad du borde klara per antal reps')}</h4>
      <div class="rm-grid">${[1, 3, 5, 8, 10, 12].map((n) => `
        <div><b>${fmtW(n <= 1 ? Math.floor(maxE / WEIGHT_STEP) * WEIGHT_STEP : Math.floor(maxE / (1 + n / 30) / WEIGHT_STEP) * WEIGHT_STEP)}</b><span>${n === 1 ? L('חזרה', '1 rep') : `${n} ${L('חזרות', 'reps')}`}</span></div>`).join('')}
      </div>
      <p class="muted small" style="margin:6px 0 0">${L(`לפי ה־1RM המשוער שלך, מעוגל למטה ל־${fmtW(WEIGHT_STEP)} ק״ג.`, `Utifrån din uppskattade 1RM, avrundat nedåt till ${fmtW(WEIGHT_STEP)} kg.`)}</p>` : '';

  const timeline = records.length ? `
      <h4 class="dash-h">${L('ציר השיאים', 'Rekordhistorik')}</h4>
      ${records.slice(-5).reverse().map((x) => `
        <div class="rec-row">
          <span class="muted small">${fmtDateFull(x.t)}</span>
          <span class="chip pr">${setLabel(x.set)}</span>
          <span class="delta up" dir="ltr">+${weighted ? `${fmtW(Math.round(x.gain * 2) / 2)} ${L('ק״ג', 'kg')}` : x.gain}</span>
        </div>`).join('')}` : '';

  return `
    <div class="card dash">
      <h3>${L('תמונת מצב', 'Läget just nu')}</h3>
      <div class="dash-tiles">${tiles}</div>
      <h4 class="dash-h">${L('היעד לפעם הבאה', 'Mål till nästa gång')}</h4>
      <div class="goals">${goals}</div>
      <p class="muted small" style="margin:6px 0 0">${L('לפי הסט הטוב בפעם האחרונה', 'Utifrån ditt bästa set förra gången')}: <span dir="ltr">${setLabel(last.set)}</span>. ${L('בחר אחד.', 'Välj ett.')}</p>
      ${repMax}
      ${timeline}
    </div>`;
}
