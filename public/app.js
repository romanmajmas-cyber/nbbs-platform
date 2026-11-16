const S = {
  token: localStorage.getItem('token') || '',
  user: null, data: null,
  tab: 'overview', authMode: 'login', filter: 'open', err: '',
  pending: {}, editMode: false
};
const root = document.getElementById('screen');

// Экранирование HTML (защита от XSS-атак)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Утилиты для работы с датами
const pad = n => String(n).padStart(2, '0');
const toDate = iso => { if (!iso) return null; const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); };
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
const daysLeft = iso => iso ? Math.round((toDate(iso) - today()) / 86400000) : null;
const isOverdue = t => t.due && toDate(t.due) < today();
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const fmtDate = iso => { const d = toDate(iso); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const fmtDateShort = iso => { const d = toDate(iso); return d ? pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.' + d.getFullYear() : ''; };
const countWord = n => n === 1 ? '1 задание' : (n < 5 ? n + ' задания' : n + ' заданий');
const themeIcon = () => document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';

// Название курса по его ID
const courseTitle = id => {
  const c = (S.data.courses || []).find(x => x.id === id);
  return c ? c.title : 'Без курса';
};

// Получаем начало и конец текущей недели (Пн-Вс)
function getCurrentWeekRange() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: isoDate(monday), end: isoDate(sunday) };
}

// Обертка над fetch для работы с API
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
  
  // Если сессия истекла - разлогиниваем
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

async function boot() {
  applyTheme();
  if (!S.token) return renderAuth();
  try {
    const me = await api('/api/me');
    S.user = me.user;
    S.data = await fetchBootstrap();
    renderApp();
  } catch {
    renderAuth();
  }
}

/* ---------- Авторизация ---------- */
function renderAuth() {
  S.user = null; S.data = null; S.editMode = false;
  const m = S.authMode;
  const icon = themeIcon();
  root.innerHTML = `
    <div class="auth">
      <div class="auth-card">
        <button class="theme-toggle" data-act="theme">${icon}</button>
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
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());
  const url = S.authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const res = await api(url, 'POST', body);
    S.token = res.token;
    localStorage.setItem('token', res.token);
    S.user = res.user;
    S.data = await fetchBootstrap();
    renderApp();
  } catch (ex) {
    S.err = ex.message;
    renderAuth();
  }
}

/* ---------- Каркас приложения ---------- */
function renderApp() {
  if (!S.user || !S.data) return;
  const tabs = [
    { k:'overview', label:'Обзор' },
    { k:'tasks',    label:'Задания' },
    { k:'schedule', label:'График' },
    { k:'profile',  label:'Профиль' }
  ];

  if (!tabs.find(t => t.k === S.tab)) S.tab = 'overview';
  const roleLabel = { participant:'участник', editor:'редактор', admin:'админ' }[S.user.role];

  const bottomHTML = tabs.map(t =>
    '<button data-act="tab" data-tab="' + t.k + '"' + (S.tab === t.k ? ' class="active"' : '') + '>' + t.label + '</button>'
  ).join('');

  root.innerHTML = `
    <header class="top">
      <div class="brand">Платформа<span>Учёба</span></div>
      <div class="me">
        <span class="me-name">${esc(S.user.name)}</span>
        <span class="role role-${S.user.role}">${roleLabel}</span>
        <button class="icon-btn" data-act="theme">${themeIcon()}</button>
        <button class="link" data-act="logout">выйти</button>
      </div>
    </header>
    <main id="content"></main>
    <nav class="bottom bottom-4">${bottomHTML}</nav>`;
  renderTab();
}

function renderTab() {
  document.getElementById('modal-container').innerHTML = ''; // Закрываем модалки при смене вкладки
  const view = document.getElementById('content');
  if (!view) return;
  if (S.tab === 'overview') viewOverview(view);
  else if (S.tab === 'tasks') viewTasks(view);
  else if (S.tab === 'schedule') viewSchedule(view);
  else if (S.tab === 'profile') viewProfile(view);
  
  document.querySelectorAll('.bottom button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === S.tab));
}

/* ---------- Виджет: Ближайший дедлайн ---------- */
function renderDeadlineBanner() {
  const mySet = new Set((S.data.completions || []).filter(c => c.user_id === S.user.id).map(c => c.task_id));
  const upcoming = S.data.tasks
    .filter(t => !mySet.has(t.id) && t.due)
    .sort((a, b) => a.due.localeCompare(b.due));

  if (!upcoming.length) {
    return '<section class="card deadline-card"><h2>Ближайший дедлайн</h2><div class="dl-empty">Все задания выполнены</div></section>';
  }

  const t = upcoming[0];
  const days = daysLeft(t.due);
  const overdue = days < 0;
  
  // Цвет в пределах 7 дней
  const ratio = Math.max(0, Math.min(1, days / 7));
  const hue = Math.round(ratio * 140); 
  const color = 'hsl(' + hue + ', 68%, 42%)';

  let label = overdue ? 'Просрочено на ' + Math.abs(days) + ' дн.' : (days === 0 ? 'Сегодня' : (days === 1 ? 'Остался 1 день' : 'Осталось ' + days + ' дн.'));

  return '<section class="card deadline-card' + (overdue ? ' overdue' : '') + '">' +
    '<h2>Ближайший дедлайн</h2>' +
    '<div class="dl-task">' + esc(t.title) + '</div>' +
    '<div class="dl-subj">' + esc(courseTitle(t.course_id)) + '</div>' +
    '<div class="dl-footer" style="margin-top:12px">' +
      '<span class="dl-date">до ' + fmtDate(t.due) + '</span>' +
      '<span class="dl-remain" style="color:' + color + '">' + label + '</span>' +
    '</div>' +
  '</section>';
}

/* ---------- Вкладка: Обзор ---------- */
function viewOverview(view) {
  const myId = S.user.id;
  const tasks = S.data.tasks;
  const mySet = new Set(S.data.completions.filter(c => c.user_id === myId).map(c => c.task_id));

  // Прогресс за текущую неделю
  const weekRange = getCurrentWeekRange();
  const weekTasks = tasks.filter(t => t.due && t.due >= weekRange.start && t.due <= weekRange.end);
  const weekTotal = weekTasks.length;
  const weekDone = weekTasks.filter(t => mySet.has(t.id)).length;
  const weekPct = weekTotal ? (weekDone / weekTotal) * 100 : 0;
  const weekColor = weekTotal ? 'hsl(' + Math.round((weekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';

  const users = S.data.users;
  const userRowsHTML = users.map(u => {
    const s = new Set(S.data.completions.filter(c => c.user_id === u.id).map(c => c.task_id));
    
    const uWeekDone = weekTasks.filter(t => s.has(t.id)).length;
    const uWeekPct = weekTotal ? (uWeekDone / weekTotal) * 100 : 0;
    const uWeekColor = weekTotal ? 'hsl(' + Math.round((uWeekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';
    
    const roleSuffix = u.role === 'admin' ? 'админ' : u.role === 'editor' ? 'редактор' : 'участник';
    const nameWeight = u.id === myId ? 600 : 500;
    const nameStyle = u.id === myId ? 'color:var(--ink)' : 'color:var(--accent); text-decoration:underline; cursor:pointer;';
    
    return '<div style="display:flex; flex-direction:column; gap:8px; padding:12px 0; border-bottom:1px solid var(--line)">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px">' +
        '<div>' +
          '<div style="font-weight:' + nameWeight + '; line-height:1.3; ' + nameStyle + '" data-act="open-user-modal" data-id="' + u.id + '">' + esc(u.name) + '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:2px">' + roleSuffix + '</div>' +
        '</div>' +
        '<div style="font-size:13px; font-weight:500; flex:none; margin-top:2px">' + uWeekDone + ' / ' + weekTotal + '</div>' +
      '</div>' +
      '<div class="bar" style="margin-top:0; height:6px; background:var(--bg-gray)"><i style="width:' + uWeekPct + '%; background:' + uWeekColor + '"></i></div>' +
    '</div>';
  }).join('');

  let weekBlockHTML = '';
  if (weekTotal) {
    const items = weekTasks.map(t => simpleTaskRow(t, mySet)).join('');
    weekBlockHTML = '<section class="card week-group-card">' +
      '<div class="week-header" style="margin-bottom:12px">' +
        '<div class="week-info">' +
          '<div class="week-dates">Задачи на эту неделю <span class="current-badge">сейчас</span></div>' +
          '<div class="week-hours">' + fmtDate(weekRange.start) + ' – ' + fmtDate(weekRange.end) + ' · ' + countWord(weekTotal) + '</div>' +
          '<div class="bar" style="margin-top:8px; height:6px"><i style="width:' + weekPct + '%; background:' + weekColor + '"></i></div>' +
        '</div>' +
      '</div>' +
      '<div class="ov-week-tasks">' + items + '</div>' +
    '</section>';
  } else {
     weekBlockHTML = '<section class="card"><h2>Текущая неделя</h2><p class="muted" style="margin:0;font-size:14px">На этой неделе нет задач с дедлайном.</p></section>';
  }

  view.innerHTML = renderDeadlineBanner() + weekBlockHTML +
    '<section class="card"><h2>Участники</h2>' + userRowsHTML + '</section>';
}

// Упрощенная карточка задачи для обзора
function simpleTaskRow(t, mySet) {
  const done = mySet.has(t.id);
  const pending = S.pending[t.id];
  const isPending = pending !== undefined;
  const displayChecked = isPending ? pending : done;
  const dl = daysLeft(t.due);

  let badge = '';
  if (displayChecked) badge = '<span class="tag ok">готово</span>';
  else if (isOverdue(t)) badge = '<span class="tag warn">-' + Math.abs(dl) + ' дн.</span>';
  else if (dl <= 7) badge = '<span class="tag warn">' + (dl === 0 ? 'сегодня' : dl + ' дн.') + '</span>';

  const head = '<label class="task ' + (done ? 'done' : '') + '">' +
    '<input type="checkbox" data-task="' + t.id + '"' + (displayChecked ? ' checked' : '') + '>' +
    '<div class="task-body">' +
      '<div class="task-title">' + esc(t.title) + '</div>' +
      '<div class="task-meta">' + esc(courseTitle(t.course_id)) + ' · ' + fmtDateShort(t.due) + '</div>' +
    '</div><div class="task-flags">' + badge + '</div></label>';

  if (isPending) {
    const label = pending ? 'Подтвердить' : 'Отменить';
    return '<div class="task-wrap">' + head + '<div class="task-upload"><button class="confirm-btn" data-act="confirm-task" data-id="' + t.id + '">' + label + '</button></div></div>';
  }
  return head;
}

/* ---------- Вкладка: Задания ---------- */
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
    const activeClass = S.editMode ? 'active' : '';
    const btnStyle = 'margin-left:auto; border-color:var(--accent); color:var(--accent);';
    chipsHTML += '<button class="chip ' + activeClass + '" data-act="toggle-edit-mode" style="' + btnStyle + '">' + (S.editMode ? 'Готово' : '✎ Изменить') + '</button>';
  }

  let bodyHTML = '';
  
  if (S.editMode && canEdit) {
    bodyHTML += '<div style="margin-bottom:16px"><button class="btn" style="width:100%" data-act="open-course-modal">+ Новый курс</button></div>';
  }
  
  if (!S.data.courses.length) {
    bodyHTML += '<section class="card"><p class="muted">Пока нет ни одного курса.</p></section>';
  }

  S.data.courses.forEach(course => {
    const courseTasks = list.filter(t => t.course_id === course.id);
    if (!S.editMode && !courseTasks.length && S.filter !== 'all') return;
    
    let header = '<div style="display:flex; justify-content:space-between; align-items:center; margin:24px 0 8px;">' +
      '<div class="subject" style="margin:0">' + esc(course.title) + '</div>' +
      '<div style="display:flex; gap:8px">' +
        (S.editMode && canEdit ? '<button class="icon-btn" data-act="open-course-modal" data-id="' + course.id + '" style="width:26px;height:26px;font-size:12px">✎</button>' : '') +
        (S.editMode && canEdit ? '<button class="icon-btn" data-act="del-course" data-id="' + course.id + '" style="width:26px;height:26px;font-size:12px">×</button>' : '') +
      '</div></div>';
    
    let itemsHTML = courseTasks.map(t => taskRow(t, mySet)).join('');
    if (!itemsHTML) itemsHTML = '<p class="muted" style="font-size:13px;margin:10px 0">Нет заданий</p>';
    
    let addBtn = (S.editMode && canEdit) ? '<div style="margin-top:12px"><button class="btn-sm" data-act="open-task-modal" data-course="' + course.id + '" style="width:100%; border-style:dashed">+ Добавить задание</button></div>' : '';
    
    bodyHTML += header + '<section class="card" style="padding:4px 16px; margin-bottom:0">' + itemsHTML + addBtn + '</section>';
  });

  view.innerHTML = renderDeadlineBanner() + '<div class="filters">' + chipsHTML + '</div>' + bodyHTML;
}

function taskRow(t, mySet) {
  const done = mySet.has(t.id);
  const pending = S.pending[t.id];
  const isPending = pending !== undefined;
  const displayChecked = isPending ? pending : done;
  const dl = daysLeft(t.due);
  const canEdit = S.editMode && (S.user.role === 'editor' || S.user.role === 'admin');

  let badge = '';
  if (displayChecked) badge = '<span class="tag ok">готово</span>';
  else if (isOverdue(t)) badge = '<span class="tag warn">-' + Math.abs(dl) + ' дн.</span>';
  else if (t.due && dl <= 7) badge = '<span class="tag warn">' + (dl === 0 ? 'сегодня' : dl + ' дн.') + '</span>';

  let actions = '';
  if (canEdit) {
    actions = '<div style="display:flex; gap:4px; margin-top:4px">' +
      '<button class="file-del" data-act="open-task-modal" data-id="' + t.id + '" title="Ред.">✎</button>' +
      '<button class="file-del" data-act="del-task" data-id="' + t.id + '" title="Удал.">×</button>' +
    '</div>';
  }

  const metaParts = [];
  if (t.due) metaParts.push('дедлайн: ' + fmtDateShort(t.due)); else metaParts.push('без дедлайна');
  if (t.detail) metaParts.push(t.detail);
  const meta = metaParts.join(' · ');

  const headHTML = '<label class="task ' + (done ? 'done' : '') + '">' +
    '<input type="checkbox" data-task="' + t.id + '"' + (displayChecked ? ' checked' : '') + '>' +
    '<div class="task-body">' +
      '<div class="task-title">' + esc(t.title) + '</div>' +
      '<div class="task-meta">' + esc(meta) + '</div>' +
    '</div>' +
    '<div class="task-flags">' + badge + actions + '</div>' +
  '</label>';

  let footer = '';
  if (isPending) {
    const label = pending ? 'Подтвердить' : 'Отменить';
    footer = '<div class="task-upload"><button class="confirm-btn" data-act="confirm-task" data-id="' + t.id + '">' + label + '</button></div>';
  }

  return '<div class="task-wrap">' + headHTML + footer + '</div>';
}

/* ---------- Вкладка: График ---------- */
function viewSchedule(view) {
  const tasksWithDue = S.data.tasks.filter(t => t.due).sort((a,b) => a.due.localeCompare(b.due));
  if (!tasksWithDue.length) {
    view.innerHTML = '<section class="card"><p class="muted">Нет заданий с дедлайнами.</p></section>';
    return;
  }

  const groups = {};
  tasksWithDue.forEach(t => {
    const monthKey = t.due.substring(0, 7);
    if (!groups[monthKey]) groups[monthKey] = [];
    groups[monthKey].push(t);
  });

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  
  const html = Object.keys(groups).sort().map(key => {
    const [year, month] = key.split('-');
    const monthName = monthNames[parseInt(month)-1] + ' ' + year;
    
    const items = groups[key].map(t => {
      const isPast = isOverdue(t);
      const dl = daysLeft(t.due);
      const color = isPast ? 'var(--warn)' : (dl <= 7 ? '#d97706' : 'var(--accent)');
      
      return '<div style="display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--line)">' +
        '<div style="flex:1; padding-right:12px">' +
          '<div style="font-weight:500; font-size:14px; line-height:1.3">' + esc(t.title) + '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:2px">' + esc(courseTitle(t.course_id)) + '</div>' +
        '</div>' +
        '<div style="font-size:13px; font-weight:600; color:' + color + '; flex:none; text-align:right">' + 
          fmtDateShort(t.due) + (isPast ? ' • просрочено' : '') + 
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="week-group" style="margin-bottom:24px">' +
      '<div class="week-header" style="margin:0 4px 8px">' +
        '<div class="week-info"><div class="week-dates" style="font-size:15px">' + monthName + '</div></div>' +
      '</div>' +
      '<section class="card week-tasks">' + items + '</section>' +
    '</div>';
  }).join('');

  view.innerHTML = '<h2 style="margin-top:0">График по месяцам</h2>' + html;
}

/* ---------- Вкладка: Профиль ---------- */
async function viewProfile(view) {
  const myId = S.user.id;
  const tasks = S.data.tasks;
  const mySet = new Set(S.data.completions.filter(c => c.user_id === myId).map(c => c.task_id));
  
  const total = tasks.length;
  const done = tasks.filter(t => mySet.has(t.id)).length;
  const pct = total ? (done / total) * 100 : 0;

  // Цвет зависит от ближайшего дедлайна
  const tasksWithDue = tasks.filter(t => t.due);
  let latestDays = 30;
  if (tasksWithDue.length > 0) {
    const latestDue = tasksWithDue.reduce((max, t) => t.due > max ? t.due : max, '1970-01-01');
    latestDays = daysLeft(latestDue);
  }
  const timeRatio = Math.max(0, Math.min(1, latestDays / 30));
  const globalColor = 'hsl(' + Math.round(timeRatio * 140) + ', 68%, 42%)';

  const roleLabel = { participant:'участник', editor:'редактор', admin:'администратор' }[S.user.role];
  
  view.innerHTML =
    '<section class="card">' +
      '<h2>Настройки профиля</h2>' +
      '<div class="field"><label>Имя и фамилия</label><input id="p-name" value="' + esc(S.user.name) + '" autocomplete="name"></div>' +
      '<div class="field"><label>Почта (или логин)</label><input id="p-login" value="' + esc(S.user.login) + '" autocapitalize="none" spellcheck="false" autocomplete="username"></div>' +
      '<div class="field" id="p-password-container" style="display:none">' +
        '<label>Новый пароль</label><input id="p-password" type="password" autocomplete="new-password" placeholder="оставьте пустым">' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn-sm primary" data-act="save-profile">Сохранить</button>' +
        '<button class="btn-sm" data-act="toggle-password">Сменить пароль</button>' +
      '</div>' +
      '<p class="tiny" style="margin-top:10px">Роль: ' + roleLabel + '</p>' +
      '<p class="err" id="p-err" style="display:none;margin-top:10px"></p>' +
      '<p class="tiny" id="p-ok" style="display:none;margin-top:10px;color:var(--accent)">Сохранено</p>' +
    '</section>' +
    
    '<section class="card">' +
      '<h2>Глобальный прогресс</h2>' +
      '<div class="big" style="color:' + (total ? globalColor : 'var(--ink)') + '">' + done + '<span>из ' + total + ' заданий</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%; background:' + (total ? globalColor : 'var(--line)') + '"></i></div>' +
      '<p class="tiny" style="margin:10px 0 0">Цвет шкалы зависит от времени до последнего дедлайна.</p>' +
    '</section>' +
    
    '<section class="card">' +
      '<h2>Сброс прогресса</h2>' +
      '<p class="tiny" style="margin-top:0">Удаляет все ваши отметки. Действие необратимо.</p>' +
      '<div class="actions"><button class="btn-sm danger" data-act="reset-my-progress">Сбросить мой прогресс</button></div>' +
    '</section>' +
    
    '<section class="card">' +
      '<h2>Сессия</h2>' +
      '<p class="tiny" style="margin-top:0">Вход: <b>' + esc(S.user.name) + '</b> (@' + esc(S.user.login) + ').</p>' +
      '<div class="actions"><button class="btn-sm" data-act="logout">Выйти</button></div>' +
    '</section>';
    
  if (S.user.role === 'admin') {
    try {
      const { users } = await api('/api/users');
      const rows = users.map(u => {
        const dis = u.id === S.user.id ? ' disabled' : '';
        const sel = (val) => 'value="' + val + '"' + (u.role === val ? ' selected' : '');
        const delBtn = u.id !== S.user.id ? '<button class="btn-sm danger" style="margin-left:6px" data-act="del-user" data-id="' + u.id + '" data-name="' + esc(u.name) + '">удалить</button>' : '';
        
        return '<div class="users-row">' +
          '<div class="u-name">' + esc(u.name) + '<div class="u-login">@' + esc(u.login) + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex:none">' +
            '<select data-role-for="' + u.id + '"' + dis + '>' +
              '<option ' + sel('participant') + '>участник</option>' +
              '<option ' + sel('editor') + '>редактор</option>' +
              '<option ' + sel('admin') + '>админ</option>' +
            '</select>' + delBtn +
          '</div>' +
        '</div>';
      }).join('');
      view.innerHTML += '<section class="card" style="margin-top:24px"><h2>Пользователи</h2>' + rows + '</section>';
    } catch (ex) {}
  }
}

/* ---------- Модальные окна ---------- */
function openConfirmModal(title, message, act, id, name) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <h2 style="color:var(--warn); font-size:18px;">${title}</h2>
        <p style="margin-bottom:20px; font-size:14px; line-height:1.4;">${message}</p>
        <p class="err" id="modal-err" style="display:none; margin-bottom:10px;"></p>
        <div class="actions">
          <button class="btn-sm danger" data-act="${act}" data-id="${id}" data-name="${name || ''}">Подтвердить</button>
          <button class="btn-sm" data-act="close-modal">Отмена</button>
        </div>
      </div>
    </div>`;
}

function openTaskModal(task, courseId) {
  const isEdit = !!task;
  const title = isEdit ? task.title : '';
  const detail = isEdit ? task.detail : '';
  const due = isEdit && task.due ? task.due : '';
  
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <h2>${isEdit ? 'Редактировать' : 'Новое задание'}</h2>
        <div class="field"><label>Название</label><input id="m-title" value="${esc(title)}" placeholder="Например: Прочитать книгу"></div>
        <div class="field"><label>Уточнение</label><input id="m-detail" value="${esc(detail)}" placeholder="2 тыс. знаков"></div>
        <div class="field"><label>Дедлайн</label><input type="date" id="m-due" value="${due}"></div>
        <div class="actions">
          <button class="btn-sm primary" data-act="save-modal-task" data-id="${task ? task.id : ''}" data-course="${courseId}">Сохранить</button>
          <button class="btn-sm" data-act="close-modal">Отмена</button>
        </div>
      </div>
    </div>`;
}

function openCourseModal(course) {
  const isEdit = !!course;
  const title = isEdit ? course.title : '';
  
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <h2>${isEdit ? 'Редактировать курс' : 'Новый курс'}</h2>
        <div class="field"><label>Название курса</label><input id="m-course-title" value="${esc(title)}" placeholder="Например: Богословие"></div>
        <div class="actions">
          <button class="btn-sm primary" data-act="save-modal-course" data-id="${course ? course.id : ''}">Сохранить</button>
          <button class="btn-sm" data-act="close-modal">Отмена</button>
        </div>
      </div>
    </div>`;
}

function openUserModal(userId) {
  const u = S.data.users.find(x => x.id === userId);
  if (!u) return;
  
  const tasks = S.data.tasks;
  const uSet = new Set(S.data.completions.filter(c => c.user_id === userId).map(c => c.task_id));
  
  const total = tasks.length;
  const done = tasks.filter(t => uSet.has(t.id)).length;
  const pct = total ? (done / total) * 100 : 0;
  const color = 'hsl(' + Math.round((pct / 100) * 120) + ', 68%, 42%)';

  const weekRange = getCurrentWeekRange();
  const weekTasks = tasks.filter(t => t.due && t.due >= weekRange.start && t.due <= weekRange.end);
  const weekTotal = weekTasks.length;
  const weekDone = weekTasks.filter(t => uSet.has(t.id)).length;
  const weekPct = weekTotal ? (weekDone / weekTotal) * 100 : 0;
  const weekColor = weekTotal ? 'hsl(' + Math.round((weekPct / 100) * 120) + ', 68%, 42%)' : 'var(--line)';

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card">
        <h2>Профиль: ${esc(u.name)}</h2>
        
        <div style="margin-bottom:20px">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span class="tiny" style="font-weight:600">Глобальный прогресс</span>
            <span style="font-weight:600; font-size:14px">${done} из ${total}</span>
          </div>
          <div class="bar" style="margin-top:0"><i style="width:${pct}%; background:${color}"></i></div>
        </div>

        <div style="margin-bottom:24px">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span class="tiny" style="font-weight:600">На этой неделе</span>
            <span style="font-weight:600; font-size:14px">${weekDone} из ${weekTotal}</span>
          </div>
          <div class="bar" style="margin-top:0"><i style="width:${weekPct}%; background:${weekColor}"></i></div>
        </div>

        <div class="actions">
          <button class="btn-sm primary" data-act="close-modal" style="width:100%">Закрыть</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Обработчики событий ---------- */
document.addEventListener('click', async e => {
  if (e.target.classList.contains('modal-overlay')) {
    document.getElementById('modal-container').innerHTML = '';
    return;
  }

  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;

  // Управление интерфейсом
  if (act === 'toggle-edit-mode') { S.editMode = !S.editMode; renderTab(); return; }
  if (act === 'close-modal') { document.getElementById('modal-container').innerHTML = ''; return; }
  if (act === 'auth-mode') { S.authMode = t.dataset.mode; S.err = ''; renderAuth(); return; }
  if (act === 'tab') { S.tab = t.dataset.tab; S.editMode = false; renderTab(); return; }
  if (act === 'filter') { S.filter = t.dataset.f; renderTab(); return; }

  // Тема
  if (act === 'theme') {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme();
    document.querySelectorAll('[data-act="theme"]').forEach(b => b.textContent = next === 'dark' ? '☀' : '☾');
    return;
  }

  // Выход
  if (act === 'logout') {
    try { await api('/api/logout', 'POST'); } catch (e) {}
    S.token = ''; localStorage.removeItem('token'); S.user = null; S.data = null; S.pending = {};
    renderAuth(); return;
  }

  // Открытие модалок
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
    const course = courseId ? S.data.courses.find(x => x.id === courseId) : null;
    openCourseModal(course);
    return;
  }

  // Сохранение модалок
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
      document.getElementById('modal-container').innerHTML = '';
      S.filter = 'all';
      await reloadData();
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
      document.getElementById('modal-container').innerHTML = '';
      S.filter = 'all';
      await reloadData();
    } catch (ex) { alert(ex.message); }
    return;
  }

  // Переключение поля пароля
  if (act === 'toggle-password') {
    const container = document.getElementById('p-password-container');
    if (container.style.display === 'none') {
      container.style.display = 'block';
      t.textContent = 'Отмена';
      document.getElementById('p-password').focus();
    } else {
      container.style.display = 'none';
      t.textContent = 'Сменить пароль';
      document.getElementById('p-password').value = '';
    }
    return;
  }

  // Чекбоксы (отметка задач)
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
      renderTab();
    } catch (ex) { t.disabled = false; alert(ex.message); }
    return;
  }

  // Вызовы окон удаления
  if (act === 'del-task') {
    openConfirmModal('Удалить задание?', 'Задание будет убрано из плана.', 'confirm-del-task', t.dataset.id);
    return;
  }
  if (act === 'del-course') {
    openConfirmModal('Удалить курс?', 'Все задания внутри этого курса также будут удалены.', 'confirm-del-course', t.dataset.id);
    return;
  }
  if (act === 'del-user') {
    openConfirmModal('Удалить пользователя?', 'Пользователь «' + t.dataset.name + '» и все его результаты будут стерты.', 'confirm-del-user', t.dataset.id);
    return;
  }
  if (act === 'reset-my-progress') {
    openConfirmModal('Сбросить прогресс?', 'Все ваши галочки будут удалены. Это действие нельзя отменить.', 'confirm-reset-my-progress', '');
    return;
  }

  // Подтверждения удаления
  if (act === 'confirm-del-task') {
    t.disabled = true;
    try { 
      await api('/api/tasks/' + t.dataset.id, 'DELETE'); 
      document.getElementById('modal-container').innerHTML = '';
      await reloadData(); 
    } catch (ex) { 
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false; 
    }
    return;
  }
  if (act === 'confirm-del-course') {
    t.disabled = true;
    try { 
      await api('/api/courses/' + t.dataset.id, 'DELETE'); 
      document.getElementById('modal-container').innerHTML = '';
      await reloadData(); 
    } catch (ex) { 
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false; 
    }
    return;
  }
  if (act === 'confirm-del-user') {
    t.disabled = true;
    try { 
      await api('/api/users/' + t.dataset.id, 'DELETE'); 
      document.getElementById('modal-container').innerHTML = '';
      await reloadData(); 
    } catch (ex) { 
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false; 
    }
    return;
  }
  if (act === 'confirm-reset-my-progress') {
    t.disabled = true;
    try { 
      await api('/api/me/progress', 'DELETE'); 
      document.getElementById('modal-container').innerHTML = '';
      S.pending = {}; 
      S.data = await fetchBootstrap(); 
      renderTab(); 
    } catch (ex) { 
      const errEl = document.getElementById('modal-err');
      if (errEl) { errEl.textContent = 'Ошибка: ' + ex.message; errEl.style.display = 'block'; }
      t.disabled = false; 
    }
    return;
  }

  // Сохранение профиля
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
      
      if (password) {
        const pContainer = document.getElementById('p-password-container');
        const pBtn = document.querySelector('[data-act="toggle-password"]');
        if (pContainer) pContainer.style.display = 'none';
        if (pBtn) pBtn.textContent = 'Сменить пароль';
        if (passwordInput) passwordInput.value = '';
      }
      
      okEl.style.display = 'block';
      renderApp();
      const ok2 = document.getElementById('p-ok');
      if (ok2) ok2.style.display = 'block';
    } catch (ex) {
      errEl.textContent = ex.message; errEl.style.display = 'block'; t.disabled = false;
    }
    return;
  }
});

document.addEventListener('change', async e => {
  // Клик по чекбоксу (переводит задачу в статус "ожидает подтверждения")
  const cb = e.target.closest('input[data-task]');
  if (cb) {
    const taskId = Number(cb.dataset.task);
    const checked = cb.checked;
    const mySet = new Set(S.data.completions.filter(c => c.user_id === S.user.id).map(c => c.task_id));
    const serverDone = mySet.has(taskId);
    
    if (checked === serverDone) delete S.pending[taskId];
    else S.pending[taskId] = checked;
    renderTab();
    return;
  }

  // Смена ролей пользователей
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
  renderTab();
}

// Запуск приложения
boot();