const S = {
  token: localStorage.getItem('token') || '',
  user: null, data: null,
  tab: 'overview', authMode: 'login', filter: 'open', err: '',
  pending: {}, editMode: false,
  weekOffset: 0,
  scheduleMode: 'weeks',
  alerts: [],
  planDraft: null
};
const root = document.getElementById('screen');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const pad = n => String(n).padStart(2, '0');
const toDate = iso => { if (!iso) return null; const [y,m,d] = iso.split('-').map(Number); if (!y || !m || !d) return null; return new Date(y, m-1, d); };
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
const daysLeft = iso => { const dt = toDate(iso); return dt ? Math.round((dt - today()) / 86400000) : null; };
const isOverdue = t => t.due && toDate(t.due) && toDate(t.due) < today();
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const fmtDate = iso => { const d = toDate(iso); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const fmtDateShort = iso => { const d = toDate(iso); return d ? pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.' + d.getFullYear() : ''; };
const fmtDayMonth = iso => { const d = toDate(iso); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : ''; };
const themeIcon = () => document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';

const STUDY_PLAN_DEFAULT = [
  { week: 1, start: '2026-11-16', end: '2026-11-22', summary: 'Поварнин; Руководство ЕААА', pages: 140, hours: 7.0, items: [
    { icon: '📖', title: 'Чтение: С.И. Поварнин «Как читать книги»', sub: 'Прочитать книгу (60 стр.)' },
    { icon: '📖', title: 'Чтение: Руководство ЕААА', sub: '«Как писать и оформлять богословские работы» (стр. 16–115)' }
  ]},
  { week: 2, start: '2026-11-23', end: '2026-11-29', summary: 'Отчёт по книге Поварнина; Эссе «Как получить качественное богословское образование?»', pages: 0, hours: 5.3, items: [
    { icon: '✍️', title: 'Отчёт по книге Поварнина', sub: 'Главные мысли, цитаты, комментарий (2–3 тыс. знаков)' },
    { icon: '✍️', title: 'Эссе «Как получить качественное богословское образование?»', sub: 'Подготовка и написание текста (10–12 тыс. знаков)' }
  ]},
  { week: 3, start: '2026-11-30', end: '2026-12-06', summary: 'Эссе; «Жить по Книге»; ДЗ 1 по ОИБ', pages: 38, hours: 5.7, items: [
    { icon: '✍️', title: 'Эссе «Как получить качественное богословское образование?»', sub: 'Продолжение работы над эссе' },
    { icon: '📖', title: 'Чтение: Х. Хендрикс «Жить по Книге»', sub: 'План на неделю: ~38 стр.' },
    { icon: '📝', title: 'ДЗ 1 по ОИБ (книга Ионы)', sub: 'План книги по смысловым блокам, цель книги, ключевой стих' }
  ]},
  { week: 4, start: '2026-12-07', end: '2026-12-13', summary: '«Жить по Книге»; ДЗ 1 по ОИБ', pages: 77, hours: 5.9, items: [
    { icon: '📖', title: 'Чтение: Х. Хендрикс «Жить по Книге»', sub: 'План на неделю: ~77 стр.' },
    { icon: '📝', title: 'ДЗ 1 по ОИБ (книга Ионы)', sub: 'Продолжение выполнения первого домашнего задания' }
  ]},
  { week: 5, start: '2026-12-14', end: '2026-12-20', summary: 'ДЗ 2 по ОИБ; «Жить по Книге»', pages: 58, hours: 5.9, items: [
    { icon: '📝', title: 'ДЗ 2 по ОИБ (книга Ионы)', sub: 'Наблюдения по тексту (10 по методичке и 50 наблюдений) и ответы на вопросы' },
    { icon: '📖', title: 'Чтение: Х. Хендрикс «Жить по Книге»', sub: 'План на неделю: ~58 стр.' }
  ]},
  { week: 6, start: '2026-12-21', end: '2026-12-27', summary: '«Жить по Книге»; ДЗ 3 по ОИБ', pages: 57, hours: 5.9, items: [
    { icon: '📖', title: 'Чтение: Х. Хендрикс «Жить по Книге»', sub: 'План на неделю: ~57 стр.' },
    { icon: '📝', title: 'ДЗ 3 по ОИБ (книга Ионы)', sub: 'Толкование (изучение слов и контекст) и применение' }
  ]},
  { week: 7, start: '2026-12-28', end: '2027-01-03', summary: '«Жить по Книге»; Отчёт', pages: 96, hours: 5.8, items: [
    { icon: '📖', title: 'Чтение: Х. Хендрикс «Жить по Книге»', sub: 'План на неделю: ~96 стр.' },
    { icon: '✍️', title: 'Отчёт по книге «Жить по Книге»', sub: 'Начало составления отчёта по прочитанному' }
  ]},
  { week: 8, start: '2027-01-04', end: '2027-01-10', summary: 'Отчёт; Стотт', pages: 95, hours: 5.5, items: [
    { icon: '✍️', title: 'Отчёт по книге «Жить по Книге»', sub: 'Завершение и оформление отчёта' },
    { icon: '📖', title: 'Чтение: Дж. Стотт «Послание к Ефесянам»', sub: 'Завершение Хендрикса и начало чтения Стотта (всего ~95 стр.)' }
  ]},
  { week: 9, start: '2027-01-11', end: '2027-01-17', summary: 'Стотт', pages: 113, hours: 5.7, items: [
    { icon: '📖', title: 'Чтение: Дж. Стотт «Послание к Ефесянам»', sub: 'План на неделю: ~113 стр.' }
  ]},
  { week: 10, start: '2027-01-18', end: '2027-01-24', summary: 'Стотт', pages: 114, hours: 5.7, items: [
    { icon: '📖', title: 'Чтение: Дж. Стотт «Послание к Ефесянам»', sub: 'План на неделю: ~114 стр.' }
  ]},
  { week: 11, start: '2027-01-25', end: '2027-01-31', summary: 'Стотт; Отчёт; Эссе', pages: 38, hours: 4.9, items: [
    { icon: '📖', title: 'Дочитать: Дж. Стотт «Послание к Ефесянам»', sub: 'Оставшиеся ~38 стр.' },
    { icon: '✍️', title: 'Отчёт по книге Стотта', sub: 'Написание отчёта (2 тыс. знаков)' },
    { icon: '✍️', title: 'Эссе по посланию к Ефесянам', sub: 'Выбор темы из 15 и начало работы над эссе' }
  ]},
  { week: 12, start: '2027-02-01', end: '2027-02-07', summary: 'Эссе по посланию к Ефесянам', pages: 0, hours: 5.5, items: [
    { icon: '✍️', title: 'Эссе по посланию к Ефесянам', sub: 'Написание и оформление работы (10–12 тыс. знаков)' }
  ]},
  { week: 13, start: '2027-02-08', end: '2027-02-14', summary: 'Райт', pages: 109, hours: 5.5, items: [
    { icon: '📖', title: 'Чтение: К. Райт «Ветхий Завет в 7 предложениях»', sub: 'План на неделю: ~109 стр.' }
  ]},
  { week: 14, start: '2027-02-15', end: '2027-02-21', summary: 'Райт; Резерв', pages: 91, hours: 4.6, items: [
    { icon: '📖', title: 'Дочитать: К. Райт «Ветхий Завет в 7 предложениях»', sub: 'План на неделю: ~91 стр.' },
    { icon: '📌', title: 'Резерв времени', sub: 'Доработка и сдача письменных заданий' }
  ]},
  { week: 15, start: '2027-02-22', end: '2027-02-28', summary: 'Резерв (буфер перед сессией)', pages: 0, hours: 0, items: [
    { icon: '📌', title: 'Резерв (буфер перед сессией)', sub: 'Закрытие хвостов, доработка отчётов и эссе' }
  ]},
  { week: 16, start: '2027-03-01', end: '2027-03-07', summary: 'Резерв (буфер перед сессией)', pages: 0, hours: 0, items: [
    { icon: '📌', title: 'Резерв (буфер перед сессией)', sub: 'Проверка готовности всех работ по курсам' }
  ]},
  { week: 17, start: '2027-03-08', end: '2027-03-14', summary: 'Резерв (буфер перед сессией)', pages: 0, hours: 0, items: [
    { icon: '📌', title: 'Резерв (буфер перед сессией)', sub: 'Повторение материала перед сессией' }
  ]},
  { week: 18, start: '2027-03-15', end: '2027-03-21', summary: 'Финальная проверка; Сессия', pages: 0, hours: 0, items: [
    { icon: '🎓', title: 'Финальная проверка и Сессия в семинарии', sub: 'Убедиться, что все работы отправлены преподавателям' }
  ]}
];

function clonePlan(plan) {
  return (plan || []).map(w => ({
    week: w.week, start: w.start, end: w.end,
    summary: w.summary || '',
    pages: Number(w.pages) || 0,
    hours: Number(w.hours) || 0,
    items: (w.items || []).map(it => ({ icon: it.icon || '📌', title: it.title || '', sub: it.sub || '' }))
  }));
}

let STUDY_PLAN = clonePlan(STUDY_PLAN_DEFAULT);

function applyStudyPlanFromSources() {
  const fromServer = S.data && Array.isArray(S.data.study_plan) && S.data.study_plan.length;
  STUDY_PLAN = clonePlan(fromServer ? S.data.study_plan : STUDY_PLAN_DEFAULT);
}

function canEditStudyPlan() {
  return !!(S.user && S.user.role === 'admin');
}

function getPlanForWeek(startIso) {
  return STUDY_PLAN.find(p => p.start === startIso) || null;
}

function dueTone(days) {
  const ratio = Math.max(0, Math.min(1, Number(days) / 21));
  return 'hsl(' + Math.round(ratio * 135) + ', 68%, 42%)';
}

function dueRemain(iso) {
  if (!iso) return null;
  const days = daysLeft(iso);
  if (days === null) return null;
  let text;
  if (days < 0) text = '−' + Math.abs(days) + ' дн.';
  else if (days === 0) text = 'сегодня';
  else text = days + ' дн.';
  return { days, color: dueTone(days), text };
}

function daysPhrase(days) {
  if (days === 0) return 'сегодня последний день';
  if (days === 1) return 'остался 1 день';
  if (days >= 2 && days <= 4) return 'осталось ' + days + ' дня';
  return 'осталось ' + days + ' дней';
}

const courseTitle = id => {
  const c = (S.data.courses || []).find(x => x.id === id);
  return c ? c.title : 'Без курса';
};

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  x.setHours(0,0,0,0);
  return x;
}

function getMondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0,0,0,0);
  return d;
}

function getWeekRangeFromMonday(monday) {
  const sunday = addDays(monday, 6);
  return { start: isoDate(monday), end: isoDate(sunday), monday, sunday };
}

function getWeekRange(offset = 0) {
  return getWeekRangeFromMonday(addDays(getMondayOf(today()), offset * 7));
}

function getCurrentWeekRange() { return getWeekRange(0); }

function weekMonthLabel(monday, sunday) {
  const m1 = monday.getMonth();
  const m2 = sunday.getMonth();
  return m1 === m2 ? MONTHS_NOM[m1] : MONTHS_NOM[m1] + ' – ' + MONTHS_NOM[m2];
}

function getOverviewWeeks() {
  const curMonday = getMondayOf(today());
  const planFirstMonday = toDate(STUDY_PLAN[0]?.start) || curMonday;
  const planLastMonday = toDate(STUDY_PLAN[STUDY_PLAN.length - 1]?.start) || curMonday;
  const startMonday = curMonday < planFirstMonday ? curMonday : planFirstMonday;
  const halfYearEnd = addDays(curMonday, 26 * 7);
  const endMonday = halfYearEnd > planLastMonday ? halfYearEnd : planLastMonday;
  const weeks = [];
  let m = startMonday;
  let safety = 0;
  while (m <= endMonday && safety < 80) {
    weeks.push(getWeekRangeFromMonday(m));
    m = addDays(m, 7);
    safety++;
  }
  return weeks;
}

function getNotifConfig() {
  return { enabled: localStorage.getItem('notif_enabled') === '1', days: Number(localStorage.getItem('notif_days') || 2) };
}
function saveNotifConfig(enabled, days) {
  localStorage.setItem('notif_enabled', enabled ? '1' : '0');
  localStorage.setItem('notif_days', String(days));
}
function sendBrowserNotification(text) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Напоминание о дедлайне', { body: text }); } catch (e) {}
  }
}
function checkDeadlineNotifications(forceTest = false) {
  if (!S.user || !S.data) return;
  const cfg = getNotifConfig();
  if (!cfg.enabled && !forceTest) { S.alerts = []; return; }
  const mySet = new Set((S.data.completions || []).filter(c => c.user_id === S.user.id).map(c => c.task_id));
  const todayStr = isoDate(today());
  const shownKey = 'notif_shown_' + S.user.id + '_' + todayStr;
  let shownIds = [];
  try { shownIds = JSON.parse(localStorage.getItem(shownKey) || '[]'); } catch (e) {}
  const dueSoon = (S.data.tasks || []).filter(t => {
    if (mySet.has(t.id) || !t.due) return false;
    const d = daysLeft(t.due);
    return d !== null && d >= 0 && d <= cfg.days;
  });
  const messages = [];
  dueSoon.forEach(t => {
    const msg = 'До сдачи «' + t.title + '» ' + daysPhrase(daysLeft(t.due));
    messages.push(msg);
    if (forceTest || !shownIds.includes(t.id)) {
      sendBrowserNotification(msg);
      if (!shownIds.includes(t.id)) shownIds.push(t.id);
    }
  });
  localStorage.setItem(shownKey, JSON.stringify(shownIds));
  S.alerts = messages;
  if (forceTest && !messages.length) {
    const sample = 'До сдачи «Пример задачи» ' + daysPhrase(cfg.days);
    sendBrowserNotification(sample);
    alert(sample);
  }
}

async function api(url, method = 'GET', body) {
  const headers = {};
  if (S.token) headers.authorization = 'Bearer ' + S.token;
  const opts = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) {
    S.token = ''; localStorage.removeItem('token');
    S.user = null; S.data = null; S.pending = {};
  }
  if (!r.ok) throw new Error(data.error || ('Ошибка (' + r.status + ')'));
  return data;
}

async function fetchBootstrap() {
  const d = await api('/api/bootstrap');
  d.users = d.users || [];
  d.courses = d.courses || [];
  d.tasks = d.tasks || [];
  d.completions = d.completions || [];
  d.study_plan = Array.isArray(d.study_plan) ? d.study_plan : [];
  return d;
}

function applyTheme() {
  let theme = localStorage.getItem('theme');
  if (!theme || theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#141716' : '#f4f4f1';
}

function initCurrentWeekOffset() {
  const curIso = getCurrentWeekRange().start;
  const weeks = getOverviewWeeks();
  const idx = weeks.findIndex(w => w.start === curIso);
  S.weekOffset = idx >= 0 ? idx : 0;
}

async function boot() {
  applyTheme();
  if (!S.token) return renderAuth();
  try {
    const me = await api('/api/me');
    S.user = me.user;
    S.data = await fetchBootstrap();
    applyStudyPlanFromSources();
    initCurrentWeekOffset();
    checkDeadlineNotifications();
    renderApp();
  } catch {
    renderAuth();
  }
}

function renderAuth() {
  S.user = null; S.data = null; S.editMode = false; S.planDraft = null;
  const m = S.authMode;
  root.innerHTML = `
    <div class="auth">
      <div class="auth-card">
        <button class="theme-toggle" data-act="theme">${themeIcon()}</button>
        <div class="auth-brand">Платформа</div>
        <div class="auth-sub">Управление заданиями</div>
        <div class="auth-tabs">
          <button data-act="auth-mode" data-mode="login" class="${m==='login'?'active':''}">Вход</button>
          <button data-act="auth-mode" data-mode="register" class="${m==='register'?'active':''}">Регистрация</button>
        </div>
        <form id="authForm" novalidate>
          ${m==='register' ? '<label>Имя и фамилия<input name="name" required autocomplete="name" autocapitalize="words"></label>' : ''}
          <label>Почта (или логин)<input name="login" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@mail.com"></label>
          <label>Пароль<input name="password" type="password" required minlength="6" autocomplete="${m==='login'?'current-password':'new-password'}"></label>
          <button class="btn" type="submit">${m==='login'?'Войти':'Создать аккаунт'}</button>
          <p class="err">${esc(S.err)}</p>
        </form>
      </div>
    </div>`;
}

async function onAuthSubmit(e) {
  e.preventDefault();
  S.err = '';
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    const res = await api(S.authMode === 'login' ? '/api/login' : '/api/register', 'POST', body);
    S.token = res.token;
    localStorage.setItem('token', res.token);
    S.user = res.user;
    S.data = await fetchBootstrap();
    applyStudyPlanFromSources();
    initCurrentWeekOffset();
    checkDeadlineNotifications();
    renderApp();
  } catch (ex) {
    S.err = ex.message;
    renderAuth();
  }
}

function renderApp() {
  if (!S.user || !S.data) return;
  const tabs = [
    { k:'overview', label:'Обзор' },
    { k:'tasks',    label:'Задания' },
    { k:'schedule', label:'График' },
    { k:'profile',  label:'Профиль' }
  ];
  if (!tabs.find(t => t.k === S.tab)) S.tab = 'overview';
  const roleLabel = { participant:'участник', editor:'редактор', admin:'админ' }[S.user.role] || S.user.role;
  const bottomHTML = tabs.map(t =>
    '<button data-act="tab" data-tab="' + t.k + '"' + (S.tab === t.k ? ' class="active"' : '') + '>' + t.label + '</button>'
  ).join('');

  root.innerHTML = `
    <header class="top">
      <div class="brand">NBBS<span>Семинария</span></div>
      <div class="me">
        <span class="me-name">${esc(S.user.name)}</span>
        <span class="role role-${esc(S.user.role)}">${roleLabel}</span>
        <button class="icon-btn" data-act="theme" title="Тема">${themeIcon()}</button>
        <button class="logout-btn" data-act="logout" type="button">Выйти</button>
      </div>
    </header>
    <main id="content"></main>
    <nav class="bottom bottom-4">${bottomHTML}</nav>`;
  renderTab();
}

function closeModal() {
  S.planDraft = null;
  const box = document.getElementById('modal-container');
  if (box) box.innerHTML = '';
}

function renderTab() {
  closeModal();
  const view = document.getElementById('content');
  if (!view) return;
  if (S.tab === 'overview') viewOverview(view);
  else if (S.tab === 'tasks') viewTasks(view);
  else if (S.tab === 'schedule') viewSchedule(view);
  else if (S.tab === 'profile') viewProfile(view);
  document.querySelectorAll('.bottom button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === S.tab));
}

function renderNotifBanner() {
  if (!S.alerts || !S.alerts.length) return '';
  return '<div class="notif-banner"><div class="notif-banner-list">' +
    S.alerts.map(m => '<div>🔔 ' + esc(m) + '</div>').join('') +
    '</div><button class="icon-btn" data-act="dismiss-alerts" title="Скрыть">×</button></div>';
}

function renderDeadlineBanner() {
  const mySet = new Set((S.data.completions || []).filter(c => c.user_id === S.user.id).map(c => c.task_id));
  const upcoming = (S.data.tasks || []).filter(t => !mySet.has(t.id) && t.due).sort((a, b) => a.due.localeCompare(b.due));
  if (!upcoming.length) {
    return renderNotifBanner() + '<section class="card deadline-card"><h2>Ближайший дедлайн</h2><div class="dl-empty">Все задания выполнены</div></section>';
  }
  const t = upcoming[0];
  const days = daysLeft(t.due);
  const overdue = days < 0;
  const label = overdue ? 'Просрочено на ' + Math.abs(days) + ' дн.' : (days === 0 ? 'Сегодня' : (days === 1 ? 'Остался 1 день' : 'Осталось ' + days + ' дн.'));
  return renderNotifBanner() + '<section class="card deadline-card' + (overdue ? ' overdue' : '') + '">' +
    '<h2>Ближайший дедлайн</h2><div class="dl-task">' + esc(t.title) + '</div>' +
    '<div class="dl-subj">' + esc(courseTitle(t.course_id)) + '</div>' +
    '<div class="dl-footer" style="margin-top:12px"><span class="dl-date">до ' + fmtDate(t.due) + '</span>' +
    '<span class="dl-remain" style="color:' + dueTone(days) + '">' + label + '</span></div></section>';
}

function renderPlanItem(it) {
  return '<div class="week-plan-item"><span class="week-plan-icon">' + esc(it.icon || '📌') + '</span>' +
    '<div class="week-plan-text"><div><b>' + esc(it.title) + '</b></div>' +
    (it.sub ? '<div class="week-plan-sub">' + esc(it.sub) + '</div>' : '') + '</div></div>';
}

function renderWeekPlanBlock(range, tasks, mySet) {
  const plan = getPlanForWeek(range.start);
  const nextTwoWeeksLimit = isoDate(addDays(range.sunday, 14));
  const prepTasks = tasks.filter(t => !mySet.has(t.id) && t.due && t.due > range.end && t.due <= nextTwoWeeksLimit)
    .sort((a, b) => a.due.localeCompare(b.due));
  if (!plan && !prepTasks.length) return '';

  let metricsHTML = '';
  if (plan) {
    const pills = [];
    if (plan.pages > 0) pills.push('<span class="week-plan-pill">📖 План: ' + plan.pages + ' стр.</span>');
    if (plan.hours > 0) pills.push('<span class="week-plan-pill">⏱ Нагрузка: ' + plan.hours + ' ч</span>');
    if (pills.length) metricsHTML = '<div class="week-plan-metrics">' + pills.join('') + '</div>';
  }
  const rows = [];
  if (plan) plan.items.forEach(it => rows.push(renderPlanItem(it)));
  prepTasks.slice(0, 3).forEach(t => {
    rows.push('<div class="week-plan-item"><span class="week-plan-icon">📌</span><div class="week-plan-text">' +
      '<div><b>Подготовка: ' + esc(t.title) + '</b></div>' +
      '<div class="week-plan-sub">' + esc(courseTitle(t.course_id)) + ' · сдача ' + fmtDayMonth(t.due) + '</div></div></div>');
  });
  if (!rows.length) return '';
  return '<div class="week-plan-box"><div class="week-plan-top">' +
    '<div class="week-plan-heading">Чем заниматься на этой неделе (по плану)</div>' + metricsHTML +
    '</div><div class="week-plan-items">' + rows.join('') + '</div></div>';
}

function renderWeekSlide(range, currentStartIso, tasks, mySet) {
  const weekTasks = tasks.filter(t => t.due && t.due >= range.start && t.due <= range.end).sort((a, b) => a.due.localeCompare(b.due));
  const weekTotal = weekTasks.length;
  const weekDone = weekTasks.filter(t => mySet.has(t.id)).length;
  const weekPct = weekTotal ? (weekDone / weekTotal) * 100 : 0;
  const weekColor = weekTotal ? 'hsl(' + Math.round((weekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';
  const plan = getPlanForWeek(range.start);
  const titleDates = fmtDayMonth(range.start) + ' – ' + fmtDayMonth(range.end);
  const currentBadge = range.start === currentStartIso ? ' <span class="current-badge">сейчас</span>' : '';
  const planWeekBadge = plan ? ' <span class="week-num-badge">Неделя ' + plan.week + '</span>' : '';
  const planBlockHTML = renderWeekPlanBlock(range, tasks, mySet);
  let tasksHTML = '';
  if (weekTotal) {
    tasksHTML = '<div class="week-sublabel">К сдаче на этой неделе (' + weekDone + '/' + weekTotal + ')</div>' +
      '<div class="ov-week-tasks">' + weekTasks.map(t => simpleTaskRow(t, mySet)).join('') + '</div>';
  } else if (!planBlockHTML) {
    tasksHTML = '<div class="week-empty">На этой неделе задач с дедлайном нет</div>';
  }
  return '<div class="week-slide" data-month="' + esc(weekMonthLabel(range.monday, range.sunday)) + '">' +
    '<section class="card week-card"><div class="week-header"><div class="week-info">' +
    '<div class="week-dates">' + titleDates + currentBadge + planWeekBadge + '</div>' +
    (weekTotal ? '<div class="bar" style="margin-top:10px; height:6px"><i style="width:' + weekPct + '%; background:' + weekColor + '"></i></div>' : '') +
    '</div></div>' + tasksHTML + planBlockHTML + '</section></div>';
}

function updateWeekCarousel(track) {
  const w = track.clientWidth || 1;
  const scroll = track.scrollLeft;
  const slides = Array.from(track.children);
  slides.forEach((slide, i) => {
    const card = slide.firstElementChild;
    if (!card) return;
    const dist = Math.min(1, Math.abs(scroll - i * w) / w);
    card.style.transform = 'scale(' + (1 - dist * 0.045).toFixed(4) + ')';
  });
  const activeIdx = Math.min(Math.max(0, Math.round(scroll / w)), Math.max(0, slides.length - 1));
  S.weekOffset = activeIdx;
  const monthEl = document.getElementById('week-month-title');
  if (monthEl && slides[activeIdx]) monthEl.textContent = slides[activeIdx].dataset.month || '';
}

function bindWeekTrack(view) {
  const track = view.querySelector('.week-track');
  if (!track) return;
  const max = Math.max(0, track.children.length - 1);
  S.weekOffset = Math.min(Math.max(0, S.weekOffset || 0), max);
  const sync = () => { const w = track.clientWidth; if (w) track.scrollLeft = S.weekOffset * w; updateWeekCarousel(track); };
  sync();
  requestAnimationFrame(sync);
  track.addEventListener('scroll', () => updateWeekCarousel(track), { passive: true });
}

function viewOverview(view) {
  const myId = S.user.id;
  const tasks = S.data.tasks;
  const mySet = new Set(S.data.completions.filter(c => c.user_id === myId).map(c => c.task_id));
  const weekRange = getCurrentWeekRange();
  const weekTasks = tasks.filter(t => t.due && t.due >= weekRange.start && t.due <= weekRange.end);
  const weekTotal = weekTasks.length;

  const userRowsHTML = S.data.users.map(u => {
    const s = new Set(S.data.completions.filter(c => c.user_id === u.id).map(c => c.task_id));
    const uWeekDone = weekTasks.filter(t => s.has(t.id)).length;
    const uWeekPct = weekTotal ? (uWeekDone / weekTotal) * 100 : 0;
    const uWeekColor = weekTotal ? 'hsl(' + Math.round((uWeekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';
    const roleSuffix = u.role === 'admin' ? 'админ' : u.role === 'editor' ? 'редактор' : 'участник';
    return '<div style="display:flex; flex-direction:column; gap:8px; padding:12px 0; border-bottom:1px solid var(--line)">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px"><div>' +
      '<div style="font-weight:' + (u.id === myId ? 600 : 500) + '; line-height:1.3; color:var(--accent); text-decoration:underline; cursor:pointer;" data-act="open-user-modal" data-id="' + u.id + '">' +
      esc(u.name) + (u.id === myId ? ' (вы)' : '') + '</div>' +
      '<div style="font-size:12px; color:var(--muted); margin-top:2px">' + roleSuffix + ' · выполнено всего: ' + s.size + '</div></div>' +
      '<div style="font-size:13px; font-weight:500; flex:none; margin-top:2px">' + uWeekDone + ' / ' + weekTotal + '</div></div>' +
      '<div class="bar" style="margin-top:0; height:6px; background:var(--bg-gray)"><i style="width:' + uWeekPct + '%; background:' + uWeekColor + '"></i></div></div>';
  }).join('');

  const weeks = getOverviewWeeks();
  const activeWeek = weeks[Math.min(Math.max(0, S.weekOffset || 0), Math.max(0, weeks.length - 1))] || weekRange;
  view.innerHTML = renderDeadlineBanner() +
    '<div class="week-section"><div class="week-month-bar">' +
    '<button type="button" class="week-nav-btn" data-act="week-scroll" data-dir="-1" aria-label="Предыдущая неделя">‹</button>' +
    '<div class="week-month-title" id="week-month-title">' + esc(weekMonthLabel(activeWeek.monday, activeWeek.sunday)) + '</div>' +
    '<button type="button" class="week-nav-btn" data-act="week-scroll" data-dir="1" aria-label="Следующая неделя">›</button></div>' +
    '<div class="week-track">' + weeks.map(r => renderWeekSlide(r, weekRange.start, tasks, mySet)).join('') + '</div></div>' +
    '<section class="card"><h2>Участники</h2>' + userRowsHTML + '</section>';
  bindWeekTrack(view);
}

function simpleTaskRow(t, mySet) {
  const done = mySet.has(t.id);
  const pending = S.pending[t.id];
  const isPending = pending !== undefined;
  const displayChecked = isPending ? pending : done;
  const remain = dueRemain(t.due);
  let badge = '';
  if (displayChecked) badge = '<span class="tag ok">готово</span>';
  else if (remain) badge = '<span class="due-badge" style="color:' + remain.color + '">' + remain.text + '</span>';
  const d = toDate(t.due);
  const dayLabel = d ? WEEKDAYS_SHORT[d.getDay()] + ', ' + fmtDayMonth(t.due) : '';
  const head = '<label class="task ' + (done ? 'done' : '') + '">' +
    '<input type="checkbox" data-task="' + t.id + '"' + (displayChecked ? ' checked' : '') + '>' +
    '<div class="task-body"><div class="task-title">' + esc(t.title) + '</div>' +
    '<div class="task-meta">' + esc(courseTitle(t.course_id)) + (dayLabel ? ' · ' + dayLabel : '') + '</div></div>' +
    '<div class="task-flags">' + badge + '</div></label>';
  const upload = isPending
    ? '<div class="task-upload"><button class="confirm-btn" data-act="confirm-task" data-id="' + t.id + '">' + (pending ? 'Подтвердить' : 'Отменить') + '</button></div>'
    : '';
  return '<div class="task-box">' + head + upload + '</div>';
}

function viewTasks(view) {
  const mySet = new Set((S.data.completions || []).filter(c => c.user_id === S.user.id).map(c => c.task_id));
  const canEdit = S.user.role === 'editor' || S.user.role === 'admin';
  let list = S.data.tasks;
  if (!S.editMode) {
    if (S.filter === 'open') list = list.filter(t => !mySet.has(t.id));
    if (S.filter === 'overdue') list = list.filter(t => !mySet.has(t.id) && isOverdue(t));
    if (S.filter === 'done') list = list.filter(t => mySet.has(t.id));
  }
  const chips = [['open','Не сделано'],['all','Все'],['overdue','Просрочено'],['done','Готово']];
  let chipsHTML = chips.map(([k, label]) =>
    '<button class="chip ' + (S.filter === k && !S.editMode ? 'active' : '') + '" data-act="filter" data-f="' + k + '">' + label + '</button>'
  ).join('');
  if (canEdit) {
    chipsHTML += '<button class="chip edit-chip ' + (S.editMode ? 'active' : '') + '" data-act="toggle-edit-mode">' + (S.editMode ? 'Готово' : '✎ Изменить') + '</button>';
  }
  let bodyHTML = '';
  if (S.editMode && canEdit) {
    bodyHTML += '<div style="margin-bottom:16px"><button class="btn" style="width:100%" data-act="open-course-modal">+ Новый курс</button></div>';
  }
  if (!S.data.courses.length) bodyHTML += '<section class="card"><p class="muted">Пока нет ни одного курса.</p></section>';
  S.data.courses.forEach(course => {
    const courseTasks = list.filter(t => t.course_id === course.id);
    if (!S.editMode && !courseTasks.length && S.filter !== 'all') return;
    const header = '<div style="display:flex; justify-content:space-between; align-items:center; margin:24px 0 8px;">' +
      '<div class="subject" style="margin:0">' + esc(course.title) + '</div><div style="display:flex; gap:8px">' +
      (S.editMode && canEdit ? '<button class="icon-btn" data-act="open-course-modal" data-id="' + course.id + '" style="width:26px;height:26px;font-size:12px">✎</button>' : '') +
      (S.editMode && canEdit ? '<button class="icon-btn" data-act="del-course" data-id="' + course.id + '" style="width:26px;height:26px;font-size:12px">×</button>' : '') +
      '</div></div>';
    let itemsHTML = courseTasks.map(t => taskRow(t, mySet)).join('');
    if (!itemsHTML) itemsHTML = '<p class="muted" style="font-size:13px;margin:10px 0">Нет заданий</p>';
    const addBtn = (S.editMode && canEdit)
      ? '<div style="margin-top:12px"><button class="btn-sm" data-act="open-task-modal" data-course="' + course.id + '" style="width:100%; border-style:dashed">+ Добавить задание</button></div>'
      : '';
    bodyHTML += header + '<section class="card" style="padding:4px 16px; margin-bottom:0">' + itemsHTML + addBtn + '</section>';
  });
  view.innerHTML = renderDeadlineBanner() + '<div class="filters">' + chipsHTML + '</div>' + bodyHTML;
}

function taskRow(t, mySet) {
  const done = mySet.has(t.id);
  const pending = S.pending[t.id];
  const isPending = pending !== undefined;
  const displayChecked = isPending ? pending : done;
  const remain = dueRemain(t.due);
  const canEdit = S.editMode && (S.user.role === 'editor' || S.user.role === 'admin');
  let badge = '';
  if (displayChecked) badge = '<span class="tag ok">готово</span>';
  else if (remain) badge = '<span class="due-badge" style="color:' + remain.color + '">' + remain.text + '</span>';
  let actions = '';
  if (canEdit) {
    actions = '<div style="display:flex; gap:4px; margin-top:4px">' +
      '<button class="file-del" data-act="open-task-modal" data-id="' + t.id + '" title="Ред.">✎</button>' +
      '<button class="file-del" data-act="del-task" data-id="' + t.id + '" title="Удал.">×</button></div>';
  }
  const metaParts = [];
  if (t.due) metaParts.push('дедлайн: ' + fmtDateShort(t.due));
  else metaParts.push('без дедлайна');
  if (t.detail) metaParts.push(t.detail);
  const headHTML = '<label class="task ' + (done ? 'done' : '') + '">' +
    '<input type="checkbox" data-task="' + t.id + '"' + (displayChecked ? ' checked' : '') + '>' +
    '<div class="task-body"><div class="task-title">' + esc(t.title) + '</div>' +
    '<div class="task-meta">' + esc(metaParts.join(' · ')) + '</div></div>' +
    '<div class="task-flags">' + badge + actions + '</div></label>';
  const footer = isPending
    ? '<div class="task-upload"><button class="confirm-btn" data-act="confirm-task" data-id="' + t.id + '">' + (pending ? 'Подтвердить' : 'Отменить') + '</button></div>'
    : '';
  return '<div class="task-wrap">' + headHTML + footer + '</div>';
}

function viewSchedule(view) {
  const mode = S.scheduleMode || 'weeks';
  const admin = canEditStudyPlan();
  const editing = admin && S.editMode && mode === 'weeks';
  const modeTabs =
    '<div class="filters" style="margin-bottom:14px">' +
      '<button class="chip ' + (mode === 'weeks' ? 'active' : '') + '" data-act="schedule-mode" data-mode="weeks">По неделям (План 1–18)</button>' +
      '<button class="chip ' + (mode === 'months' ? 'active' : '') + '" data-act="schedule-mode" data-mode="months">По месяцам (Дедлайны)</button>' +
      (admin && mode === 'weeks'
        ? '<button class="chip edit-chip ' + (S.editMode ? 'active' : '') + '" data-act="toggle-edit-mode">' + (S.editMode ? 'Готово' : '✎ Изменить') + '</button>'
        : '') +
    '</div>';

  if (mode === 'weeks') {
    const curStart = getCurrentWeekRange().start;
    const hint = editing
      ? '<p class="tiny" style="margin:-4px 2px 12px">Нажмите ✎ у недели, чтобы править карточки. Сохраняется для всех.</p>'
      : '';
    const weeksHTML = STUDY_PLAN.map(p => {
      const dueTasks = (S.data.tasks || []).filter(t => t.due && t.due >= p.start && t.due <= p.end);
      const pills = [];
      if (p.pages > 0) pills.push('<span class="week-plan-pill">📖 ' + p.pages + ' стр.</span>');
      if (p.hours > 0) pills.push('<span class="week-plan-pill">⏱ ' + p.hours + ' ч</span>');
      const dueHTML = dueTasks.length
        ? '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--line)">' +
          '<div class="tiny" style="font-weight:600; margin-bottom:4px">Сдача на этой неделе:</div>' +
          dueTasks.map(t => '<div style="font-size:13px; padding:2px 0">• ' + esc(t.title) + ' <span class="muted">(' + fmtDayMonth(t.due) + ')</span></div>').join('') +
          '</div>' : '';
      return '<section class="card" style="padding:14px 16px">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px">' +
        '<div class="week-dates" style="font-size:14.5px">Неделя ' + p.week + ' · ' + fmtDayMonth(p.start) + ' – ' + fmtDayMonth(p.end) +
        (p.start === curStart ? ' <span class="current-badge">сейчас</span>' : '') + '</div>' +
        '<div style="display:flex; gap:6px; align-items:center">' + pills.join('') +
        (editing
          ? '<button class="icon-btn" data-act="edit-week-plan" data-start="' + esc(p.start) + '" title="Изменить план">✎</button>'
          : '') +
        '</div></div><div class="week-plan-items">' + (p.items || []).map(renderPlanItem).join('') + '</div>' + dueHTML + '</section>';
    }).join('');
    view.innerHTML = modeTabs + hint + weeksHTML;
    return;
  }

  const tasksWithDue = S.data.tasks.filter(t => t.due).sort((a,b) => a.due.localeCompare(b.due));
  if (!tasksWithDue.length) {
    view.innerHTML = modeTabs + '<section class="card"><p class="muted">Нет заданий с дедлайнами.</p></section>';
    return;
  }
  const groups = {};
  tasksWithDue.forEach(t => {
    const monthKey = t.due.substring(0, 7);
    if (!groups[monthKey]) groups[monthKey] = [];
    groups[monthKey].push(t);
  });
  const html = Object.keys(groups).sort().map(key => {
    const [year, month] = key.split('-');
    const monthName = MONTHS_NOM[parseInt(month, 10) - 1] + ' ' + year;
    const items = groups[key].map(t => {
      const remain = dueRemain(t.due);
      const badgeHTML = remain ? '<span class="due-badge" style="color:' + remain.color + '; margin-left:8px">' + remain.text + '</span>' : '';
      return '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--line); gap:10px">' +
        '<div style="flex:1; min-width:0"><div style="font-weight:500; font-size:14px; line-height:1.3">' + esc(t.title) + '</div>' +
        '<div style="font-size:12px; color:var(--muted); margin-top:2px">' + esc(courseTitle(t.course_id)) + ' · ' + fmtDateShort(t.due) + '</div></div>' +
        '<div style="flex:none">' + badgeHTML + '</div></div>';
    }).join('');
    return '<div class="week-group" style="margin-bottom:24px"><div class="week-header" style="margin:0 4px 8px">' +
      '<div class="week-info"><div class="week-dates" style="font-size:15px">' + monthName + '</div></div></div>' +
      '<section class="card week-tasks">' + items + '</section></div>';
  }).join('');
  view.innerHTML = modeTabs + html;
}

async function viewProfile(view) {
  const myId = S.user.id;
  const tasks = S.data.tasks;
  const mySet = new Set(S.data.completions.filter(c => c.user_id === myId).map(c => c.task_id));
  const total = tasks.length;
  const done = tasks.filter(t => mySet.has(t.id)).length;
  const pct = total ? (done / total) * 100 : 0;
  const tasksWithDue = tasks.filter(t => t.due);
  let latestDays = 30;
  if (tasksWithDue.length) {
    latestDays = daysLeft(tasksWithDue.reduce((max, t) => t.due > max ? t.due : max, '1970-01-01'));
  }
  const globalColor = 'hsl(' + Math.round(Math.max(0, Math.min(1, latestDays / 30)) * 140) + ', 68%, 42%)';
  const roleLabel = { participant:'участник', editor:'редактор', admin:'администратор' }[S.user.role];
  const notifCfg = getNotifConfig();
  const dayOptions = [1, 2, 3, 5, 7].map(d =>
    '<option value="' + d + '"' + (notifCfg.days === d ? ' selected' : '') + '>за ' + d + ' ' + (d === 1 ? 'день' : (d < 5 ? 'дня' : 'дней')) + '</option>'
  ).join('');

  view.innerHTML =
    '<section class="card"><h2>Настройки профиля</h2>' +
    '<div class="field"><label>Имя и фамилия</label><input id="p-name" value="' + esc(S.user.name) + '" autocomplete="name"></div>' +
    '<div class="field"><label>Почта (или логин)</label><input id="p-login" value="' + esc(S.user.login) + '" autocapitalize="none" spellcheck="false" autocomplete="username"></div>' +
    '<div class="field" id="p-password-container" style="display:none"><label>Новый пароль</label><input id="p-password" type="password" autocomplete="new-password" placeholder="оставьте пустым"></div>' +
    '<div class="actions"><button class="btn-sm primary" data-act="save-profile">Сохранить</button><button class="btn-sm" data-act="toggle-password">Сменить пароль</button></div>' +
    '<p class="tiny" style="margin-top:10px">Роль: ' + roleLabel + '</p>' +
    '<p class="err" id="p-err" style="display:none;margin-top:10px"></p>' +
    '<p class="tiny" id="p-ok" style="display:none;margin-top:10px;color:var(--accent)">Сохранено</p></section>' +
    '<section class="card"><h2>Уведомления о дедлайнах</h2>' +
    '<p class="tiny" style="margin-top:0">Напоминание вида: «До сдачи "имя_задачи" осталось 2 дня».</p>' +
    '<div class="field"><label>Статус</label><select id="notif-enabled">' +
    '<option value="0"' + (!notifCfg.enabled ? ' selected' : '') + '>Выключены</option>' +
    '<option value="1"' + (notifCfg.enabled ? ' selected' : '') + '>Включены</option></select></div>' +
    '<div class="field"><label>Когда напоминать</label><select id="notif-days">' + dayOptions + '</select></div>' +
    '<div class="actions"><button class="btn-sm primary" data-act="save-notif">Сохранить</button><button class="btn-sm" data-act="test-notif">Проверить</button></div>' +
    '<p class="tiny" id="notif-status" style="display:none;margin-top:10px;color:var(--accent)"></p></section>' +
    '<section class="card"><h2>Глобальный прогресс</h2>' +
    '<div class="big" style="color:' + (total ? globalColor : 'var(--ink)') + '">' + done + '<span>из ' + total + ' заданий</span></div>' +
    '<div class="bar"><i style="width:' + pct + '%; background:' + (total ? globalColor : 'var(--line)') + '"></i></div>' +
    '<p class="tiny" style="margin:10px 0 0">Цвет шкалы зависит от времени до последнего дедлайна.</p></section>' +
    '<section class="card"><h2>Сброс прогресса</h2><p class="tiny" style="margin-top:0">Удаляет все ваши отметки. Действие необратимо.</p>' +
    '<div class="actions"><button class="btn-sm danger" data-act="reset-my-progress">Сбросить мой прогресс</button></div></section>' +
    '<section class="card"><h2>Сессия</h2><p class="tiny" style="margin-top:0">Вход: <b>' + esc(S.user.name) + '</b> (@' + esc(S.user.login) + ').</p>' +
    '<div class="actions"><button class="btn-sm" data-act="logout">Выйти</button></div></section>';

  if (S.user.role === 'admin') {
    try {
      const { users } = await api('/api/users');
      const rows = users.map(u => {
        const dis = u.id === S.user.id ? ' disabled' : '';
        const sel = val => 'value="' + val + '"' + (u.role === val ? ' selected' : '');
        const delBtn = u.id !== S.user.id
          ? '<button class="btn-sm danger" style="margin-left:6px" data-act="del-user" data-id="' + u.id + '" data-name="' + esc(u.name) + '">удалить</button>'
          : '';
        return '<div class="users-row"><div class="u-name">' + esc(u.name) + '<div class="u-login">@' + esc(u.login) + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex:none"><select data-role-for="' + u.id + '"' + dis + '>' +
          '<option ' + sel('participant') + '>участник</option><option ' + sel('editor') + '>редактор</option><option ' + sel('admin') + '>админ</option></select>' +
          delBtn + '</div></div>';
      }).join('');
      view.innerHTML += '<section class="card" style="margin-top:24px"><h2>Пользователи</h2>' + rows + '</section>';
    } catch (ex) {}
  }
}

function readPlanDraftFromModal() {
  if (!S.planDraft) return;
  const pagesEl = document.getElementById('m-plan-pages');
  const hoursEl = document.getElementById('m-plan-hours');
  const summaryEl = document.getElementById('m-plan-summary');
  if (pagesEl) S.planDraft.pages = Number(pagesEl.value) || 0;
  if (hoursEl) S.planDraft.hours = Number(hoursEl.value) || 0;
  if (summaryEl) S.planDraft.summary = summaryEl.value.trim();
  S.planDraft.items = Array.from(document.querySelectorAll('.plan-item-editor')).map(el => ({
    icon: (el.querySelector('.m-plan-icon')?.value || '').trim() || '📌',
    title: (el.querySelector('.m-plan-title')?.value || '').trim(),
    sub: (el.querySelector('.m-plan-sub')?.value || '').trim()
  }));
}

function renderPlanItemsEditor(items) {
  if (!items || !items.length) {
    return '<p class="muted" style="margin:0">Пока нет карточек. Нажмите «+ Карточка».</p>';
  }
  return items.map((it, i) =>
    '<div class="plan-item-editor"><div class="plan-item-editor-row">' +
      '<input class="m-plan-icon" value="' + esc(it.icon || '') + '" maxlength="8" title="Иконка" aria-label="Иконка">' +
      '<input class="m-plan-title" value="' + esc(it.title || '') + '" placeholder="Заголовок карточки">' +
      '<button type="button" class="file-del" data-act="del-plan-item" data-idx="' + i + '" title="Удалить">×</button>' +
    '</div><input class="m-plan-sub" value="' + esc(it.sub || '') + '" placeholder="Пояснение: страницы, объём, детали"></div>'
  ).join('');
}

function draftFromPlan(base) {
  return {
    week: base.week, start: base.start, end: base.end,
    summary: base.summary || '', pages: base.pages || 0, hours: base.hours || 0,
    items: (base.items || []).map(it => ({ icon: it.icon || '📌', title: it.title || '', sub: it.sub || '' }))
  };
}

function openWeekPlanModal(startIso, draft, addEmpty) {
  if (!canEditStudyPlan()) return;
  const monday = toDate(startIso);
  if (!monday) return;
  const range = getWeekRangeFromMonday(monday);
  const existing = getPlanForWeek(range.start);
  const base = existing || {
    week: STUDY_PLAN.reduce((m, p) => Math.max(m, Number(p.week) || 0), 0) + 1,
    start: range.start, end: range.end, summary: '', pages: 0, hours: 0, items: []
  };
  S.planDraft = draft ? { ...draft, items: (draft.items || []).map(it => ({ ...it })) } : draftFromPlan(base);
  if (addEmpty) S.planDraft.items.push({ icon: '📌', title: '', sub: '' });
  const d = S.planDraft;
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card" style="max-width:520px">
        <h2>Карточки недели ${esc(d.week)}</h2>
        <p class="tiny" style="margin:-8px 0 14px">${esc(fmtDayMonth(d.start))} – ${esc(fmtDayMonth(d.end))}</p>
        <div class="field"><label>Кратко</label><input id="m-plan-summary" value="${esc(d.summary)}" placeholder="Что главное на этой неделе"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
          <div class="field"><label>План, стр.</label><input id="m-plan-pages" type="number" min="0" step="1" value="${esc(d.pages)}"></div>
          <div class="field"><label>Нагрузка, ч</label><input id="m-plan-hours" type="number" min="0" step="0.1" value="${esc(d.hours)}"></div>
        </div>
        <div class="field" style="margin-bottom:6px"><label>Карточки под задачами</label></div>
        <div class="plan-items-editor">${renderPlanItemsEditor(d.items)}</div>
        <div class="actions" style="margin-top:4px">
          <button class="btn-sm" data-act="add-plan-item">+ Карточка</button>
          <button class="btn-sm" data-act="reset-week-plan" data-start="${esc(d.start)}">Сбросить неделю</button>
        </div>
        <div class="actions">
          <button class="btn-sm primary" data-act="save-week-plan" data-start="${esc(d.start)}">Сохранить</button>
          <button class="btn-sm" data-act="close-modal">Отмена</button>
        </div>
      </div>
    </div>`;
}

function openConfirmModal(title, message, act, id, name) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay"><div class="modal-card">
      <h2 style="color:var(--warn); font-size:18px;">${title}</h2>
      <p style="margin-bottom:20px; font-size:14px; line-height:1.4;">${message}</p>
      <p class="err" id="modal-err" style="display:none; margin-bottom:10px;"></p>
      <div class="actions">
        <button class="btn-sm danger" data-act="${act}" data-id="${id}" data-name="${name || ''}">Подтвердить</button>
        <button class="btn-sm" data-act="close-modal">Отмена</button>
      </div>
    </div></div>`;
}

function openTaskModal(task, courseId) {
  const isEdit = !!task;
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay"><div class="modal-card">
      <h2>${isEdit ? 'Редактировать' : 'Новое задание'}</h2>
      <div class="field"><label>Название</label><input id="m-title" value="${esc(isEdit ? task.title : '')}" placeholder="Например: Прочитать книгу"></div>
      <div class="field"><label>Уточнение</label><input id="m-detail" value="${esc(isEdit ? (task.detail || '') : '')}" placeholder="2 тыс. знаков"></div>
      <div class="field"><label>Дедлайн</label><input type="date" id="m-due" value="${isEdit && task.due ? task.due : ''}"></div>
      <div class="actions">
        <button class="btn-sm primary" data-act="save-modal-task" data-id="${task ? task.id : ''}" data-course="${courseId || ''}">Сохранить</button>
        <button class="btn-sm" data-act="close-modal">Отмена</button>
      </div>
    </div></div>`;
}

function openCourseModal(course) {
  const isEdit = !!course;
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay"><div class="modal-card">
      <h2>${isEdit ? 'Редактировать курс' : 'Новый курс'}</h2>
      <div class="field"><label>Название курса</label><input id="m-course-title" value="${esc(isEdit ? course.title : '')}" placeholder="Например: Богословие"></div>
      <div class="actions">
        <button class="btn-sm primary" data-act="save-modal-course" data-id="${course ? course.id : ''}">Сохранить</button>
        <button class="btn-sm" data-act="close-modal">Отмена</button>
      </div>
    </div></div>`;
}

function openUserModal(userId) {
  const u = S.data.users.find(x => x.id === userId);
  if (!u) return;
  const tasks = S.data.tasks;
  const uSet = new Set(S.data.completions.filter(c => c.user_id === userId).map(c => c.task_id));
  const total = tasks.length;
  const doneTasks = tasks.filter(t => uSet.has(t.id));
  const done = doneTasks.length;
  const pct = total ? (done / total) * 100 : 0;
  const color = 'hsl(' + Math.round((pct / 100) * 120) + ', 68%, 42%)';
  const weekRange = getCurrentWeekRange();
  const weekTasks = tasks.filter(t => t.due && t.due >= weekRange.start && t.due <= weekRange.end);
  const weekTotal = weekTasks.length;
  const weekDone = weekTasks.filter(t => uSet.has(t.id)).length;
  const weekPct = weekTotal ? (weekDone / weekTotal) * 100 : 0;
  const weekColor = weekTotal ? 'hsl(' + Math.round((weekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';
  const completedListHTML = doneTasks.length
    ? '<div class="user-report-list">' + doneTasks.map(t =>
        '<div class="user-report-item"><div class="user-report-title">✓ ' + esc(t.title) + '</div>' +
        '<div class="user-report-meta">' + esc(courseTitle(t.course_id)) + '</div></div>').join('') + '</div>'
    : '<p class="muted" style="font-size:13.5px; margin:8px 0 0">Пока нет выполненных заданий.</p>';
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay"><div class="modal-card">
      <h2>Отчёт: ${esc(u.name)}</h2>
      <div style="margin-bottom:14px"><div style="display:flex; justify-content:space-between; margin-bottom:6px">
        <span class="tiny" style="font-weight:600">Общий прогресс</span>
        <span style="font-weight:600; font-size:13.5px">${done} из ${total}</span></div>
        <div class="bar" style="margin-top:0"><i style="width:${pct}%; background:${color}"></i></div></div>
      <div style="margin-bottom:16px"><div style="display:flex; justify-content:space-between; margin-bottom:6px">
        <span class="tiny" style="font-weight:600">На текущей неделе</span>
        <span style="font-weight:600; font-size:13.5px">${weekDone} из ${weekTotal}</span></div>
        <div class="bar" style="margin-top:0"><i style="width:${weekPct}%; background:${weekColor}"></i></div></div>
      <div style="font-size:11.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600">Выполнено (${done})</div>
      ${completedListHTML}
      <div class="actions"><button class="btn-sm primary" data-act="close-modal" style="width:100%">Закрыть</button></div>
    </div></div>`;
}

document.addEventListener('click', async e => {
  if (e.target.classList.contains('modal-overlay')) { closeModal(); return; }
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;

  if (act === 'toggle-edit-mode') { S.editMode = !S.editMode; renderTab(); return; }
  if (act === 'close-modal') { closeModal(); return; }
  if (act === 'dismiss-alerts') { S.alerts = []; renderTab(); return; }
  if (act === 'auth-mode') { S.authMode = t.dataset.mode; S.err = ''; renderAuth(); return; }
  if (act === 'tab') { S.tab = t.dataset.tab; S.editMode = false; renderTab(); return; }
  if (act === 'filter') { S.filter = t.dataset.f; renderTab(); return; }
  if (act === 'schedule-mode') { S.scheduleMode = t.dataset.mode; if (t.dataset.mode !== 'weeks') S.editMode = false; renderTab(); return; }
  if (act === 'week-scroll') {
    const track = document.querySelector('.week-track');
    if (!track) return;
    const max = Math.max(0, track.children.length - 1);
    S.weekOffset = Math.min(Math.max(0, (S.weekOffset || 0) + (Number(t.dataset.dir) || 1)), max);
    track.scrollTo({ left: S.weekOffset * track.clientWidth, behavior: 'smooth' });
    return;
  }

  if (act === 'edit-week-plan') {
    if (!canEditStudyPlan() || S.tab !== 'schedule' || !S.editMode) return;
    openWeekPlanModal(t.dataset.start);
    return;
  }
  if (act === 'add-plan-item') {
    readPlanDraftFromModal();
    if (!S.planDraft) return;
    S.planDraft.items.push({ icon: '📌', title: '', sub: '' });
    openWeekPlanModal(S.planDraft.start, S.planDraft);
    return;
  }
  if (act === 'del-plan-item') {
    readPlanDraftFromModal();
    if (!S.planDraft) return;
    S.planDraft.items.splice(Number(t.dataset.idx), 1);
    openWeekPlanModal(S.planDraft.start, S.planDraft);
    return;
  }
  if (act === 'reset-week-plan') {
    const start = t.dataset.start;
    const def = STUDY_PLAN_DEFAULT.find(p => p.start === start);
    if (!S.planDraft) return;
    S.planDraft = def ? draftFromPlan(def) : { ...S.planDraft, summary: '', pages: 0, hours: 0, items: [] };
    openWeekPlanModal(start, S.planDraft);
    return;
  }
  if (act === 'save-week-plan') {
    if (!canEditStudyPlan()) return;
    readPlanDraftFromModal();
    if (!S.planDraft) return;
    const next = {
      week: S.planDraft.week, start: S.planDraft.start, end: S.planDraft.end,
      summary: S.planDraft.summary, pages: S.planDraft.pages, hours: S.planDraft.hours,
      items: S.planDraft.items.filter(it => it.title)
    };
    const snapshot = clonePlan(STUDY_PLAN);
    const idx = snapshot.findIndex(p => p.start === next.start);
    if (idx < 0) snapshot.push(next);
    else snapshot[idx] = { ...snapshot[idx], ...next };
    snapshot.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    t.disabled = true;
    try {
      const res = await api('/api/study-plan', 'PUT', { study_plan: snapshot });
      S.data.study_plan = res.study_plan;
      applyStudyPlanFromSources();
      closeModal();
      renderTab();
    } catch (ex) {
      t.disabled = false;
      alert(ex.message);
    }
    return;
  }

  if (act === 'save-notif') {
    const enabled = document.getElementById('notif-enabled').value === '1';
    const days = Number(document.getElementById('notif-days').value || 2);
    const statusEl = document.getElementById('notif-status');
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (err) {}
    }
    saveNotifConfig(enabled, days);
    checkDeadlineNotifications();
    if (statusEl) {
      statusEl.textContent = enabled ? 'Настройки сохранены (напоминание за ' + days + ' дн.)' : 'Уведомления выключены';
      statusEl.style.display = 'block';
    }
    return;
  }
  if (act === 'test-notif') {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (err) {}
    }
    const days = Number(document.getElementById('notif-days')?.value || 2);
    saveNotifConfig(true, days);
    const en = document.getElementById('notif-enabled');
    if (en) en.value = '1';
    checkDeadlineNotifications(true);
    return;
  }
  if (act === 'theme') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme();
    document.querySelectorAll('[data-act="theme"]').forEach(b => { b.textContent = next === 'dark' ? '☀' : '☾'; });
    return;
  }
  if (act === 'logout') {
    try { await api('/api/logout', 'POST'); } catch (err) {}
    S.token = ''; localStorage.removeItem('token'); S.user = null; S.data = null; S.pending = {};
    renderAuth(); return;
  }
  if (act === 'open-user-modal') { openUserModal(Number(t.dataset.id)); return; }
  if (act === 'open-task-modal') {
    const taskId = t.dataset.id ? Number(t.dataset.id) : null;
    const courseId = t.dataset.course ? Number(t.dataset.course) : null;
    const task = taskId ? S.data.tasks.find(x => x.id === taskId) : null;
    openTaskModal(task, courseId || (task ? task.course_id : null));
    return;
  }
  if (act === 'open-course-modal') {
    const courseId = t.dataset.id ? Number(t.dataset.id) : null;
    openCourseModal(courseId ? S.data.courses.find(x => x.id === courseId) : null);
    return;
  }
  if (act === 'save-modal-task') {
    const id = t.dataset.id ? Number(t.dataset.id) : null;
    const courseId = Number(t.dataset.course);
    const title = document.getElementById('m-title').value.trim();
    const detail = document.getElementById('m-detail').value.trim();
    const due = document.getElementById('m-due').value || null;
    if (!title) return alert('Укажите название');
    try {
      if (id) await api('/api/tasks/' + id, 'PUT', { course_id: courseId, title, detail, due });
      else await api('/api/tasks', 'POST', { course_id: courseId, title, detail, due });
      closeModal(); S.filter = 'all'; await reloadData();
    } catch (ex) { alert(ex.message); }
    return;
  }
  if (act === 'save-modal-course') {
    const id = t.dataset.id ? Number(t.dataset.id) : null;
    const title = document.getElementById('m-course-title').value.trim();
    if (!title) return alert('Укажите название курса');
    try {
      if (id) await api('/api/courses/' + id, 'PUT', { title });
      else await api('/api/courses', 'POST', { title });
      closeModal(); S.filter = 'all'; await reloadData();
    } catch (ex) { alert(ex.message); }
    return;
  }
  if (act === 'toggle-password') {
    const container = document.getElementById('p-password-container');
    if (!container) return;
    if (container.style.display === 'none') {
      container.style.display = 'block'; t.textContent = 'Отмена';
      document.getElementById('p-password').focus();
    } else {
      container.style.display = 'none'; t.textContent = 'Сменить пароль';
      document.getElementById('p-password').value = '';
    }
    return;
  }
  if (act === 'confirm-task') {
    const taskId = Number(t.dataset.id);
    const checked = S.pending[taskId];
    if (checked === undefined) return;
    t.disabled = true;
    try {
      await api('/api/toggle', 'POST', { taskId, done: checked });
      if (checked) S.data.completions.push({ task_id: taskId, user_id: S.user.id, done_at: new Date().toISOString() });
      else S.data.completions = S.data.completions.filter(c => !(c.task_id === taskId && c.user_id === S.user.id));
      delete S.pending[taskId];
      checkDeadlineNotifications();
      renderTab();
    } catch (ex) { t.disabled = false; alert(ex.message); }
    return;
  }
  if (act === 'del-task') { openConfirmModal('Удалить задание?', 'Задание будет убрано из плана.', 'confirm-del-task', t.dataset.id); return; }
  if (act === 'del-course') { openConfirmModal('Удалить курс?', 'Все задания внутри этого курса также будут удалены.', 'confirm-del-course', t.dataset.id); return; }
  if (act === 'del-user') { openConfirmModal('Удалить пользователя?', 'Пользователь «' + t.dataset.name + '» и все его результаты будут стерты.', 'confirm-del-user', t.dataset.id); return; }
  if (act === 'reset-my-progress') { openConfirmModal('Сбросить прогресс?', 'Все ваши галочки будут удалены. Это действие нельзя отменить.', 'confirm-reset-my-progress', ''); return; }

  async function confirmDanger(url) {
    t.disabled = true;
    try { await api(url, 'DELETE'); closeModal(); await reloadData(); }
    catch (ex) {
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false;
    }
  }
  if (act === 'confirm-del-task') { await confirmDanger('/api/tasks/' + t.dataset.id); return; }
  if (act === 'confirm-del-course') { await confirmDanger('/api/courses/' + t.dataset.id); return; }
  if (act === 'confirm-del-user') { await confirmDanger('/api/users/' + t.dataset.id); return; }
  if (act === 'confirm-reset-my-progress') {
    t.disabled = true;
    try {
      await api('/api/me/progress', 'DELETE');
      closeModal(); S.pending = {};
      S.data = await fetchBootstrap();
      applyStudyPlanFromSources();
      checkDeadlineNotifications();
      renderTab();
    } catch (ex) {
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false;
    }
    return;
  }
  if (act === 'save-profile') {
    const name = document.getElementById('p-name').value.trim();
    const login = document.getElementById('p-login').value.trim().toLowerCase();
    const passwordInput = document.getElementById('p-password');
    const password = passwordInput ? passwordInput.value : '';
    const errEl = document.getElementById('p-err');
    const okEl = document.getElementById('p-ok');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    const body = {};
    if (name !== S.user.name) body.name = name;
    if (login !== S.user.login) body.login = login;
    if (password) body.password = password;
    if (!Object.keys(body).length) { okEl.style.display = 'block'; return; }
    t.disabled = true;
    try {
      const res = await api('/api/me/profile', 'PUT', body);
      S.user = res.user;
      renderApp();
      const ok2 = document.getElementById('p-ok');
      if (ok2) ok2.style.display = 'block';
    } catch (ex) {
      errEl.textContent = ex.message; errEl.style.display = 'block'; t.disabled = false;
    }
  }
});

document.addEventListener('change', async e => {
  const cb = e.target.closest('input[data-task]');
  if (cb) {
    const taskId = Number(cb.dataset.task);
    const mySet = new Set(S.data.completions.filter(c => c.user_id === S.user.id).map(c => c.task_id));
    if (cb.checked === mySet.has(taskId)) delete S.pending[taskId];
    else S.pending[taskId] = cb.checked;
    renderTab();
    return;
  }
  const sel = e.target.closest('select[data-role-for]');
  if (sel) {
    try {
      await api('/api/users/' + sel.dataset.roleFor + '/role', 'PUT', { role: sel.value });
      await reloadData();
    } catch (ex) { alert(ex.message); viewProfile(document.getElementById('content')); }
  }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'authForm') onAuthSubmit(e);
});

async function reloadData() {
  S.data = await fetchBootstrap();
  applyStudyPlanFromSources();
  checkDeadlineNotifications();
  renderTab();
}

boot();