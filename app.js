'use strict';
/* ---------- plan registry ---------- */
const PLANS = {};
function registerPlan(p) { PLANS[p.id] = p; }
function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('Failed to load ' + src)); document.head.appendChild(s); }); }

/* ---------- storage (per-plan, keyed by plan id) ---------- */
const K = { settings: 'wk:settings', plan: id => 'wk:plan:' + id };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let settings, plan, st;
function blankState() { return { start: iso(new Date()), checks: {}, complete: {}, seenWeek: 0, retests: {}, dismissed: {} }; }
function loadPlanState() { st = load(K.plan(plan.id), null) || blankState(); saveState(); }
function saveState() { save(K.plan(plan.id), st); }

/* ---------- dates ---------- */
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const now = () => new Date();
const todayIso = () => iso(now());
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekOf(dateIso) { const days = Math.round((parseIso(dateIso) - parseIso(st.start)) / 864e5); return days < 0 ? 0 : Math.floor(days / 7) + 1; }
const maxWeek = () => plan.progression.weeks.length;

/* ---------- prescriptions ---------- */
function rule(week) { const ws = plan.progression.weeks; return ws[Math.min(Math.max(week, 1), ws.length) - 1]; }
function rx(ex, week, dayNum) {
  const d = ex.dose; if (!d || d.text !== undefined || d.sets === undefined) return { text: d ? d.text : '', changed: false };
  const progresses = dayNum !== null && plan.progression.progressDays.includes(dayNum);
  const r = progresses ? rule(week) : { holdAdd: 0, repAdd: 0, setAdd: 0 };
  const add = d.unit === 's' ? r.holdAdd : r.repAdd;
  const sets = d.sets + r.setAdd > Math.max(plan.progression.maxSets, d.sets) ? Math.max(plan.progression.maxSets, d.sets) : d.sets + r.setAdd;
  const lo = d.lo + add, hi = d.hi + add;
  const amt = (lo === hi ? lo : lo + '–' + hi) + (d.unit === 's' ? ' s' : '');
  return { text: `${sets} x ${amt}${d.suffix ? ' ' + d.suffix : ''}`, changed: sets !== d.sets || add !== 0 };
}
function sessionFor(dateIso) {
  const n = parseIso(dateIso).getDay(), day = plan.days[String(n)] || { label: '', exercises: [] };
  return { n, day, items: day.exercises.length ? [...plan.warmup.map(e => ({ ...e, wu: true })), ...day.exercises] : [] };
}

/* ---------- completion / streaks ---------- */
function isComplete(dateIso) { const s = sessionFor(dateIso); return s.items.length === 0 || !!st.complete[dateIso]; }
function updateComplete(dateIso) {
  const s = sessionFor(dateIso), c = st.checks[dateIso] || {};
  st.complete[dateIso] = s.items.length > 0 && s.items.every(e => c[e.id]); saveState();
}
function dayStreak() {
  let d = now(), n = 0; if (!isComplete(iso(d))) d.setDate(d.getDate() - 1);
  while (iso(d) >= st.start && isComplete(iso(d))) { if (sessionFor(iso(d)).items.length) n++; d.setDate(d.getDate() - 1); }
  return n;
}
function exStreak(exId, dayNum, beforeIso) { // consecutive scheduled sessions (same weekday) with this exercise checked
  let d = parseIso(beforeIso), n = 0;
  d.setDate(d.getDate() - ((d.getDay() - dayNum + 7) % 7 || 7));
  while (iso(d) >= st.start) { if ((st.checks[iso(d)] || {})[exId]) { n++; d.setDate(d.getDate() - 7); } else break; }
  return n;
}

/* ---------- banners / reminders ---------- */
function weekChanges(week) {
  const out = [];
  for (const [k, day] of Object.entries(plan.days)) for (const ex of day.exercises) {
    const a = rx(ex, week - 1, +k).text, b = rx(ex, week, +k).text;
    if (a !== b) out.push(`${DAYN[k].slice(0, 3)} · ${ex.name}: ${a} → <b>${b}</b>`);
  }
  return out;
}
function modal(html) { document.getElementById('modalBody').innerHTML = html; const m = document.getElementById('modal'); if (m.open) return; m.showModal ? m.showModal() : m.setAttribute('open', ''); }
function checkReminders() {
  const today = todayIso(), wk = weekOf(today), b = [];
  // new progression week (first open)
  if (wk >= 1 && wk > (st.seenWeek || 0)) {
    const prev = st.seenWeek || 0; st.seenWeek = wk; saveState();
    if (wk > 1 && wk <= maxWeek()) {
      const ch = weekChanges(wk);
      modal(`<h2>Week ${wk} starts</h2><p>${rule(wk).summary}</p>${ch.length ? '<ul>' + ch.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '<p>No prescription changes this week.</p>'}`);
      notify(`Week ${wk}: ${rule(wk).summary}`);
    } else if (wk > maxWeek() && prev <= maxWeek()) modal(`<h2>Program complete</h2><p>You finished all ${maxWeek()} weeks. Prescriptions stay at week ${maxWeek()}. Retest and consider a new plan or harder versions.</p>`);
  }
  // retest
  const ev = plan.retest.everyWeeks;
  if (wk > 1 && (wk - 1) % ev === 0 && !st.retests['w' + wk])
    b.push(`<b>Retest due (week ${wk}).</b> ${plan.retest.items.join(' · ')} <br><button id="logRetest">Log retest</button>`);
  // harder-version prompts
  const s = sessionFor(today), N = plan.progression.harderAfterSessions;
  for (const ex of s.day.exercises) if (ex.harder) {
    const n = exStreak(ex.id, s.n, today);
    if (n >= N && !st.dismissed[ex.id + '@' + Math.floor(n / N)])
      b.push(`<b>${ex.name}</b>: done ${n} sessions in a row. If every set hit the top of the range with clean tempo, try: ${ex.harder}. <button data-dis="${ex.id}@${Math.floor(n / N)}">Got it</button>`);
  }
  const ban = document.getElementById('banner'); ban.innerHTML = b.join('<hr>'); ban.hidden = !b.length;
  ban.querySelectorAll('[data-dis]').forEach(x => x.onclick = () => { st.dismissed[x.dataset.dis] = 1; saveState(); checkReminders(); });
  const lr = document.getElementById('logRetest'); if (lr) lr.onclick = () => {
    const res = {}; for (const it of plan.retest.items) { const v = prompt(it); if (v === null) return; res[it] = v; }
    st.retests['w' + wk] = { date: today, results: res }; saveState(); checkReminders();
  };
}

/* ---------- notifications ---------- */
async function notify(body) {
  if (!settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { const reg = await navigator.serviceWorker?.ready; reg ? reg.showNotification(plan.name, { body, icon: 'icons/icon-192.png', tag: 'workout' }) : new Notification(plan.name, { body }); } catch (e) { console.warn(e); }
}
function dailyTick() {
  if (!settings.notify || !settings.notifyTime) return;
  const t = now(), hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  if (hm >= settings.notifyTime && settings.lastNotified !== todayIso() && !isComplete(todayIso())) {
    settings.lastNotified = todayIso(); save(K.settings, settings);
    const s = sessionFor(todayIso()); notify(`Today: ${DAYN[s.n]} — ${s.day.label}. Tap to start.`);
  }
}

/* ---------- views ---------- */
const V = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function header() {
  document.getElementById('planName').textContent = plan.name;
  const wk = weekOf(todayIso());
  document.getElementById('weekInfo').textContent = wk < 1 ? `Starts ${st.start}` : `Week ${wk}${wk > maxWeek() ? ' (maintenance)' : ' of ' + maxWeek()} · Streak ${dayStreak()} day(s)`;
}
function exHtml(ex, dateIso, dayNum, interactive) {
  const r = rx(ex, weekOf(dateIso), ex.wu ? null : dayNum), on = (st.checks[dateIso] || {})[ex.id];
  return `<div class="ex ${on ? 'done' : ''}" data-id="${ex.id}">${interactive ? `<input type="checkbox" aria-label="Done: ${esc(ex.name)}" ${on ? 'checked' : ''}>` : ''}
  <div class="body"><div class="nm">${esc(ex.name)}</div><div class="rx"><b>${esc(r.text)}</b>${r.changed ? '<span class="chg">wk ' + weekOf(dateIso) + '</span>' : ''} · ${esc(ex.tempo)}</div>
  <div class="note">${mediaHtml(ex.media)}${esc(ex.note)}${ex.harder ? '<br><i>Harder: ' + esc(ex.harder) + '</i>' : ''}</div></div></div>`;
}
const lnk = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : t;
function mediaHtml(m) {
  if (!m || !m.frames) return '';
  const n = m.frames.length, lab = i => m.frames[i].label || (i ? 'End position' : 'Start position');
  const imgs = m.frames.map((f, i) => `<img src="${esc(f.file)}" alt="" class="${i ? '' : 'on'}" loading="lazy" decoding="async">`).join('');
  const box = n > 1
    ? `<div class="mbox" role="button" tabindex="0" data-i="0" data-n="${n}" style="aspect-ratio:${m.width}/${m.height}" aria-label="Demonstration, ${esc(lab(0))} (1 of ${n}). Press to show ${esc(lab(1))}." data-labels="${esc(JSON.stringify(m.frames.map((f, i) => lab(i))))}">${imgs}<span class="badge" aria-hidden="true">1/${n} ⇄</span></div>`
    : `<div class="mbox single" style="aspect-ratio:${m.width}/${m.height}" role="img" aria-label="Demonstration image">${imgs}</div>`;
  return `<figure class="media">${box}
  ${m.variant ? `<div class="variant">⚠ ${esc(m.variant)}</div>` : ''}
  <figcaption>${esc(m.author)} · ${lnk(m.licenseUrl, esc(m.license))} · <a href="#" class="credlink">Credits</a></figcaption></figure>`;
}
function flip(box) {
  const n = +box.dataset.n, i = (+box.dataset.i + 1) % n, labels = JSON.parse(box.dataset.labels);
  box.dataset.i = i; box.querySelectorAll('img').forEach((im, k) => im.classList.toggle('on', k === i));
  box.querySelector('.badge').textContent = `${i + 1}/${n} ⇄`;
  box.setAttribute('aria-label', `Demonstration, ${labels[i]} (${i + 1} of ${n}). Press to show ${labels[(i + 1) % n]}.`);
}
document.addEventListener('click', e => { const b = e.target.closest('.mbox[data-n]'); if (b) { e.stopPropagation(); flip(b); } }, true);
document.addEventListener('keydown', e => { const b = e.target.closest && e.target.closest('.mbox[data-n]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); flip(b); } }, true);
function allMedia() {
  const seen = new Map();
  for (const ex of [...plan.warmup, ...Object.values(plan.days).flatMap(d => d.exercises)])
    if (ex.media) { const k = ex.media.frames[0].file, r = seen.get(k) || { ...ex.media, used: [] }; if (!r.used.includes(ex.name)) r.used.push(ex.name); seen.set(k, r); }
  return [...seen.values()];
}
function renderCredits() {
  const ms = allMedia(), nf = ms.reduce((a, m) => a + m.frames.length, 0);
  const short = u => esc(u.replace(/^https?:\/\//, '').slice(0, 60));
  V.innerHTML = `<h2>Credits</h2><p class="muted">${esc(plan.credit || '')} Exercise media: ${ms.length} items (${nf} image files), bundled for offline use. Public-domain and Unlicense items need no attribution; CC BY-SA items are credited here, and their resized derivatives are shared under the same license.</p>` +
    ms.map(m => `<div class="credit" data-file="${esc(m.frames[0].file)}"><img src="${esc(m.frames[0].file)}" alt="" loading="lazy"><div><b>${esc(m.used.join(', '))}</b><br>
    Author: ${esc(m.author)}<br>License: ${lnk(m.licenseUrl, esc(m.license))}<br>
    ${m.frames.map((f, i) => `${m.frames.length > 1 ? 'Frame ' + (i + 1) + (f.label ? ' (' + esc(f.label) + ')' : '') + ' source' : 'Source'}: ${f.sourceUrl ? lnk(f.sourceUrl, short(f.sourceUrl)) : 'original (generated for this app)'}<br>`).join('')}
    Changes: ${esc(m.changes)}${m.frames.slice(1).map(f => f.changes ? ' ' + esc(f.changes) : '').join('')}${m.variant ? '<br>Note: ' + esc(m.variant) : ''}</div></div>`).join('') +
    `<p class="muted">App code and plan text: personal use. Icons generated for this app.</p>`;
}
function renderToday() {
  const d = todayIso(), s = sessionFor(d);
  let h = `<h2>${DAYN[s.n]} — ${esc(s.day.label)}</h2><p class="muted">Tap an exercise for cues & common mistakes.</p>`;
  if (weekOf(d) < 1) h += `<p class="muted">Program starts ${st.start}; showing week 1 prescriptions.</p>`;
  if (!s.items.length) h += `<p>${esc(s.day.text || 'Rest day.')}</p>`;
  else {
    if (st.complete[d]) h += `<div class="complete" id="doneMsg">✓ Session complete</div>`;
    h += '<h3>Warm-up</h3>' + plan.warmup.map(e => exHtml({ ...e, wu: true }, d, s.n, true)).join('');
    h += '<h3>Session</h3>' + s.day.exercises.map(e => exHtml(e, d, s.n, true)).join('');
    h += `<div class="row"><button class="primary" id="markAll">Mark session complete</button></div>`;
  }
  V.innerHTML = h;
  V.querySelectorAll('.ex .body').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
  V.querySelectorAll('.ex input').forEach(cb => cb.onchange = () => {
    const id = cb.closest('.ex').dataset.id; (st.checks[d] ||= {})[id] = cb.checked; if (!cb.checked) delete st.checks[d][id];
    updateComplete(d); render();
  });
  const m = document.getElementById('markAll'); if (m) m.onclick = () => { st.checks[d] = Object.fromEntries(s.items.map(e => [e.id, true])); updateComplete(d); render(); };
}
function renderWeek() {
  const t = now(), mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  let h = `<h2>This week</h2>`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i); const di = iso(d), s = sessionFor(di);
    h += `<h3>${DAYN[s.n]} ${di.slice(5)} — ${esc(s.day.label)} ${s.items.length && st.complete[di] ? '✓' : ''}</h3>`;
    h += s.day.exercises.length ? s.day.exercises.map(e => exHtml(e, di, s.n, false)).join('') : `<p class="muted">${esc(s.day.text)}</p>`;
  }
  V.innerHTML = h; V.querySelectorAll('.ex .body').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
}
function renderHistory() {
  const dates = Object.keys(st.checks).filter(d => Object.keys(st.checks[d]).length).sort().reverse();
  let h = `<h2>History</h2><p>Current streak: <b>${dayStreak()}</b> training day(s) · Sessions completed: <b>${Object.values(st.complete).filter(Boolean).length}</b></p>`;
  h += '<table><tr><th>Date</th><th>Wk</th><th>Session</th><th>Done</th></tr>' + dates.map(d => { const s = sessionFor(d); return `<tr><td>${d}</td><td>${weekOf(d)}</td><td>${DAYN[s.n].slice(0, 3)} ${esc(s.day.label)}</td><td>${st.complete[d] ? '✓' : Object.keys(st.checks[d]).length + '/' + s.items.length}</td></tr>`; }).join('') + '</table>';
  const rt = Object.entries(st.retests); if (rt.length) h += '<h3>Retests</h3>' + rt.map(([w, r]) => `<p><b>${w} (${r.date})</b><br>${Object.entries(r.results).map(([k, v]) => esc(k) + ': ' + esc(v)).join('<br>')}</p>`).join('');
  h += `<h3>Progression rule</h3><ul>${(plan.progression.text || []).map(x => '<li>' + esc(x) + '</li>').join('')}</ul><h3>Safety</h3><ul>${plan.safety.map(x => '<li>' + esc(x) + '</li>').join('')}</ul><p class="muted">${esc(plan.credit || '')}</p>`;
  V.innerHTML = h;
}
function renderSettings() {
  V.innerHTML = `<h2>Settings</h2>
  <label for="planSel">Plan</label><select id="planSel">${Object.values(PLANS).map(p => `<option value="${p.id}" ${p.id === plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
  <p class="muted">Each plan keeps its own start date, checkmarks, and history.</p>
  <label for="startDate">Start date (this plan)</label><input type="date" id="startDate" value="${st.start}">
  <label>Reminders</label><div class="row"><button id="notifBtn">${settings.notify ? 'Disable' : 'Enable'} notifications</button></div>
  <label for="notifTime">Daily reminder time</label><input type="time" id="notifTime" value="${settings.notifyTime || '07:00'}">
  <p class="muted">Notifications fire only while the app (or its browser) is running; there is no server push. Week-change and retest reminders appear when you open the app.</p>
  <label>Backup</label><div class="row"><button id="exportBtn">Export JSON</button><button id="importBtn">Import JSON</button><input type="file" id="importFile" accept="application/json" hidden></div>
  <div class="row"><button id="printBtn">Print this week</button><button id="creditsBtn">Credits</button></div>`;
  planSel.onchange = () => { settings.activePlan = planSel.value; save(K.settings, settings); boot(); };
  startDate.onchange = () => { if (startDate.value) { st.start = startDate.value; st.seenWeek = 0; saveState(); checkReminders(); header(); } };
  notifTime.onchange = () => { settings.notifyTime = notifTime.value; save(K.settings, settings); };
  notifBtn.onclick = async () => {
    if (!settings.notify) { if (!('Notification' in window)) return alert('Notifications are not supported in this browser.'); const p = await Notification.requestPermission(); if (p !== 'granted') return alert('Permission not granted.'); }
    settings.notify = !settings.notify; settings.notifyTime ||= notifTime.value; save(K.settings, settings); renderSettings();
  };
  exportBtn.onclick = () => {
    const data = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('wk:')) data[k] = JSON.parse(localStorage.getItem(k)); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'workout-pwa', version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' }));
    a.download = `workout-backup-${todayIso()}.json`; a.click();
  };
  importBtn.onclick = () => importFile.click();
  importFile.onchange = async () => {
    try { const j = JSON.parse(await importFile.files[0].text()); if (!j.data) throw 0; if (!confirm('Replace saved data with this backup?')) return;
      for (const [k, v] of Object.entries(j.data)) if (k.startsWith('wk:')) save(k, v); settings = load(K.settings, {}); boot(); alert('Imported.'); }
    catch { alert('Not a valid backup file.'); }
  };
  creditsBtn.onclick = () => show('credits');
  printBtn.onclick = () => { show('week'); setTimeout(() => window.print(), 100); };
}
let cur = 'today';
function render() { header(); ({ today: renderToday, week: renderWeek, history: renderHistory, settings: renderSettings, credits: renderCredits })[cur]();
  V.querySelectorAll('.credlink').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); show('credits'); });
  V.querySelectorAll('.note a').forEach(a => a.addEventListener('click', e => e.stopPropagation())); }
function show(v) { cur = v; document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); render(); window.scrollTo(0, 0); }

/* ---------- boot ---------- */
function boot() {
  settings = load(K.settings, {});
  plan = PLANS[settings.activePlan] || Object.values(PLANS)[0];
  settings.activePlan = plan.id; save(K.settings, settings);
  loadPlanState(); render(); checkReminders();
}
(async () => {
  // sequential: index order = default order
  try { for (const f of PLAN_FILES) await loadScript(f); } catch (e) { V.innerHTML = '<p>' + esc(e.message) + '</p>'; }
  if (!Object.keys(PLANS).length) { V.innerHTML = '<p>No plans found in plans/index.js.</p>'; return; }
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.v));
  document.getElementById('modalClose').onclick = () => { const m = document.getElementById('modal'); m.close ? m.close() : m.removeAttribute('open'); };
  boot(); window.__ready = true;
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(console.warn);
  setInterval(dailyTick, 30000); dailyTick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders(); } });
})();
