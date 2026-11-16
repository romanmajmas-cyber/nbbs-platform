import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Данные админа по умолчанию (в идеале задать через переменные окружения на сервере)
const ADMIN_LOGIN = (process.env.ADMIN_LOGIN || 'admin').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';
const SESSION_DAYS = 90; // Сколько живет сессия (в днях)

// Подключаем встроенную базу данных SQLite
const db = new DatabaseSync(path.join(__dirname, 'data.db'));
db.exec('PRAGMA journal_mode = WAL'); // Ускоряет работу с базой
db.exec('PRAGMA foreign_keys = ON'); // Включаем проверку связей между таблицами

// Создаем таблицы, если их еще нет
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  pass TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  due TEXT,
  kind TEXT NOT NULL DEFAULT 'written',
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  done_at TEXT DEFAULT (datetime('now')),
  UNIQUE(task_id, user_id)
);
`);

// Базовые данные для первого запуска
const SEED_COURSES = [
  [1, '1. Основы изучения Библии (Иона)', 0],
  [2, '2. Экспозиция послания к Ефесянам', 1],
  [3, '3. Основы самообразования', 2],
  [4, '4. Обзор Ветхого Завета', 3],
  [5, '5. Общая книга и общие задания', 4]
];

const SEED_TASKS = [
  [1,'Прочитать книгу Ионы 30 раз','','2026-11-05','reading'],
  [1,'План книги по смысловым блокам, цель книги, ключевой стих','','2027-02-01','written'],
  [1,'Наблюдения: 10 (методичка) и 50 наблюдений','','2027-02-10','written'],
  [1,'Ответы на вопросы','','2027-02-05','written'],
  [1,'Толкование: изучение слов и контекст','','2027-02-15','written'],
  [1,'Применение: характер Бога и характер служителя','','2027-02-25','written'],
  [1,'Проверить, что работы по Ионе отправлены преподавателю','ku_serg@mail.ru','2026-11-22','check'],
  [2,'Читать: Дж. Стотт, «Послание к Ефесянам»','279 стр.','2027-01-03','reading'],
  [2,'Отчёт по Стотту','2 тыс. знаков','2027-01-10','written'],
  [2,'Эссе по Ефесянам (тема из 15)','10–12 тыс. знаков','2027-01-31','written'],
  [3,'Установить и настроить Zotero и Anki, найти 1 словарную и 1 журнальную статью','','2026-11-22','admin'],
  [3,'Годовой план чтения: 10–12 книг по четырём группам','10–12 книг','2026-11-22','admin'],
  [3,'Прочитать руководство ЕААА «Как писать и оформлять богословские работы»','стр. 16–115','2026-11-29','reading'],
  [3,'Читать: С.И. Поварнин, «Как читать книги»','60 стр.','2026-11-29','reading'],
  [3,'Отчёт по Поварнину: главные мысли, цитаты, комментарий','2–3 тыс. знаков','2026-12-06','written'],
  [3,'Эссе «Как получить качественное богословское образование»','10–12 тыс. знаков','2026-12-27','written'],
  [4,'Читать: «Ветхий Завет в 7 предложениях»','~160 стр.','2027-02-21','reading'],
  [4,'Читать: А. Прокопенко, «Ветхий Завет говорит»','объём уточняется',null,'reading'],
  [5,'Читать: Х.Дж. Хендрикс, «Жить по книге»','446 стр.','2027-02-14','reading'],
  [5,'Отчёт по «Жить по книге»','объём уточняется','2027-02-21','written'],
  [5,'Составить недельное расписание (5–6 ч в неделю)','','2026-11-22','admin'],
  [5,'Внести в календарь сроки сдачи работ первого семестра','','2026-11-22','admin']
];

if (!db.prepare('SELECT COUNT(*) c FROM courses').get().c) {
  const insC = db.prepare('INSERT INTO courses (id, title, position) VALUES (?,?,?)');
  SEED_COURSES.forEach(c => insC.run(...c));
  
  const insT = db.prepare(`INSERT INTO tasks (course_id,title,detail,due,kind,position) VALUES (?,?,?,?,?,?)`);
  SEED_TASKS.forEach((t, i) => insT.run(...t, i));
}

// Функции для работы с паролями и сессиями
const hashPw = pw => {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
};

const checkPw = (pw, stored) => {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const cur = crypto.scryptSync(pw, salt, 64);
  const ref = Buffer.from(h, 'hex');
  return ref.length === cur.length && crypto.timingSafeEqual(ref, cur);
};

function issueSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(token, userId, exp);
  const user = db.prepare('SELECT id,name,login,role FROM users WHERE id=?').get(userId);
  res.json({ token, user });
}

// Создаем админа, если база пустая
if (!db.prepare('SELECT id FROM users WHERE login=?').get(ADMIN_LOGIN)) {
  db.prepare('INSERT INTO users (name,login,pass,role) VALUES (?,?,?,?)')
    .run('Администратор', ADMIN_LOGIN, hashPw(ADMIN_PASSWORD), 'admin');
  console.log(`Создан администратор: логин «${ADMIN_LOGIN}», пароль из ADMIN_PASSWORD`);
}

/* ---------- Настройка Express ---------- */
const app = express();
app.use(express.json({ limit: '10kb' })); // Ограничиваем размер входящих данных
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для проверки авторизации
function auth(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Требуется вход' });
  
  const row = db.prepare(`
    SELECT s.expires_at, u.id, u.name, u.login, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id 
    WHERE s.token = ?
  `).get(token);
  
  if (!row || new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
  
  req.user = { id: Number(row.id), name: row.name, login: row.login, role: row.role };
  req.token = token;
  next();
}

// Проверки прав
const canEdit = u => u.role === 'editor' || u.role === 'admin';
const requireEdit = (req, res, next) => canEdit(req.user) ? next() : res.status(403).json({ error: 'Нет прав' });
const requireAdmin = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Только админ' });

/* ---------- Маршруты (API) ---------- */

// Регистрация
app.post('/api/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  const login = String(req.body.login || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  
  if (!name) return res.status(400).json({ error: 'Укажите имя и фамилию' });
  if (!login || login.length < 3) return res.status(400).json({ error: 'Укажите логин или почту (от 3 символов)' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль от 6 символов' });
  
  if (db.prepare('SELECT id FROM users WHERE login=?').get(login))
    return res.status(409).json({ error: 'Этот логин или почта уже заняты' });
    
  const info = db.prepare('INSERT INTO users (name,login,pass,role) VALUES (?,?,?,?)')
    .run(name, login, hashPw(password), 'participant');
  issueSession(res, Number(info.lastInsertRowid));
});

// Вход
app.post('/api/login', (req, res) => {
  const login = String(req.body.login || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE login=?').get(login);
  
  if (!u || !checkPw(password, u.pass))
    return res.status(401).json({ error: 'Неверный логин или пароль' });
    
  issueSession(res, Number(u.id));
});

// Выход
app.post('/api/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token=?').run(req.token);
  res.json({ ok: true });
});

// Получить текущего пользователя
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

// Загрузить всё сразу (для экономии запросов)
app.get('/api/bootstrap', auth, (req, res) => {
  res.json({
    users: db.prepare('SELECT id,name,role FROM users ORDER BY name').all().map(u => ({ id: Number(u.id), name: u.name, role: u.role })),
    courses: db.prepare('SELECT * FROM courses ORDER BY position, id').all().map(c => ({ ...c, id: Number(c.id) })),
    tasks: db.prepare('SELECT * FROM tasks WHERE archived=0 ORDER BY position, id').all().map(t => ({ ...t, id: Number(t.id), course_id: Number(t.course_id) })),
    completions: db.prepare('SELECT task_id,user_id,done_at FROM completions').all().map(c => ({ task_id: Number(c.task_id), user_id: Number(c.user_id), done_at: c.done_at }))
  });
});

// Поставить/снять галочку
app.post('/api/toggle', auth, (req, res) => {
  const taskId = Number(req.body.taskId);
  const done = !!req.body.done;
  if (done) db.prepare('INSERT OR IGNORE INTO completions (task_id,user_id) VALUES (?,?)').run(taskId, req.user.id);
  else db.prepare('DELETE FROM completions WHERE task_id=? AND user_id=?').run(taskId, req.user.id);
  res.json({ ok: true });
});

// --- Управление курсами (только редакторы и админ) ---
app.post('/api/courses', auth, requireEdit, (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Нужно название' });
  const pos = (db.prepare('SELECT MAX(position) m FROM courses').get().m ?? 0) + 1;
  const info = db.prepare('INSERT INTO courses (title, position) VALUES (?,?)').run(title, pos);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/courses/:id', auth, requireEdit, (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Нужно название' });
  db.prepare('UPDATE courses SET title=? WHERE id=?').run(title, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/courses/:id', auth, requireEdit, (req, res) => {
  db.prepare('DELETE FROM courses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// --- Управление задачами (только редакторы и админ) ---
app.post('/api/tasks', auth, requireEdit, (req, res) => {
  const b = req.body;
  if (!b.course_id || !b.title) return res.status(400).json({ error: 'Нужны курс и задание' });
  const pos = (db.prepare('SELECT MAX(position) m FROM tasks').get().m ?? 0) + 1;
  const info = db.prepare(`INSERT INTO tasks (course_id,title,detail,due,position) VALUES (?,?,?,?,?)`)
    .run(b.course_id, b.title, b.detail || '', b.due || null, pos);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/tasks/:id', auth, requireEdit, (req, res) => {
  const b = req.body;
  db.prepare(`UPDATE tasks SET title=?, detail=?, due=? WHERE id=?`)
    .run(b.title, b.detail || '', b.due || null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', auth, requireEdit, (req, res) => {
  db.prepare('UPDATE tasks SET archived=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// --- Управление пользователями (только админ) ---
app.get('/api/users', auth, requireAdmin, (req, res) => {
  res.json({ users: db.prepare('SELECT id,name,login,role FROM users ORDER BY role DESC, name').all().map(u => ({ id: Number(u.id), name: u.name, login: u.login, role: u.role })) });
});

app.put('/api/users/:id/role', auth, requireAdmin, (req, res) => {
  const role = req.body.role;
  if (!['participant','editor','admin'].includes(role)) return res.status(400).json({ error: 'Неверная роль' });
  if (Number(req.params.id) === req.user.id && role !== 'admin') return res.status(400).json({ error: 'Нельзя снять себя' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/users/:id', auth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
});

// Редактирование своего профиля
app.put('/api/me/profile', auth, (req, res) => {
  const { name, login, password } = req.body || {};
  const updates = {};
  
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) return res.status(400).json({ error: 'Имя не может быть пустым' });
    updates.name = n.slice(0, 60);
  }
  
  if (login !== undefined) {
    const l = String(login).trim().toLowerCase();
    if (!l || l.length < 3) return res.status(400).json({ error: 'Логин или почта должны быть от 3 символов' });
    if (l !== req.user.login) {
      if (db.prepare('SELECT id FROM users WHERE login=? AND id!=?').get(l, req.user.id)) return res.status(409).json({ error: 'Логин занят' });
      updates.login = l;
    }
  }
  
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'Пароль от 6 символов' });
    updates.pass = hashPw(String(password));
  }
  
  if (!Object.keys(updates).length) return res.json({ user: req.user });
  
  const keys = Object.keys(updates);
  const sets = keys.map(k => k + '=?').join(', ');
  db.prepare('UPDATE users SET ' + sets + ' WHERE id=?').run(...keys.map(k => updates[k]), req.user.id);
  
  const u = db.prepare('SELECT id,name,login,role FROM users WHERE id=?').get(req.user.id);
  res.json({ user: { id: Number(u.id), name: u.name, login: u.login, role: u.role } });
});

// Сброс своего прогресса
app.delete('/api/me/progress', auth, (req, res) => {
  db.prepare('DELETE FROM completions WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

// Глобальный обработчик ошибок (чтобы сервер не падал)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => console.log(`Сервер: http://localhost:${PORT}`));