import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const file = process.env.DB_PATH || 'data.db';
if (!fs.existsSync(file)) {
  console.log('Файл не найден:', file);
  process.exit(1);
}

const db = new DatabaseSync(file);
const all = sql => db.prepare(sql).all();

console.log('Целостность:', all('PRAGMA integrity_check')[0]);

console.log('\nПользователи:');
console.table(all('SELECT id, name, login, role, created_at FROM users ORDER BY id'));

console.log('Активных заданий:', all('SELECT COUNT(*) AS n FROM tasks WHERE archived=0')[0].n);
console.log('Отметок всего:', all('SELECT COUNT(*) AS n FROM completions')[0].n);
console.log('Карточек недель:', all('SELECT COUNT(*) AS n FROM week_cards')[0].n);
console.log('Активных сессий:', all("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')")[0].n);
console.log('Ключи настроек:', all('SELECT key FROM settings').map(r => r.key));

db.close();