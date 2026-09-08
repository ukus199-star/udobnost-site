// Подключение к базе PostgreSQL.
//
// Строка подключения приходит из переменной окружения DATABASE_URL и в коде
// не появляется никогда - правило репо номер 8. На Amvera она задана в
// кабинете, локально её нет, и это нормально: без неё сайт работает как
// раньше, просто ничего не записывает.
//
// Главное правило этой фазы: база не мешает прохождению теста. Что бы тут ни
// случилось - нет строки подключения, база не отвечает, упал запрос - человек
// проходит тест и ничего не замечает.

import { Pool } from "pg";

// Пул - это несколько заранее открытых соединений с базой, которые
// переиспользуются. Открывать соединение на каждый запрос дорого.
//
// Пул хранится в globalThis, а не в обычной переменной, из-за режима
// разработки: там Next.js перезагружает изменённые файлы на лету, и на каждой
// перезагрузке создавался бы новый пул, а старый висел бы открытым.
const globalForDb = globalThis as unknown as { pool?: Pool | null };

export function getPool(): Pool | null {
  if (globalForDb.pool !== undefined) return globalForDb.pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    globalForDb.pool = null;
    return null;
  }

  const pool = new Pool({
    connectionString,
    // Больше пяти одновременных соединений тесту не нужно, а у базы на
    // минимальном тарифе их запас невелик.
    max: 5,
    // Не ждать вечно: соединение, которое не установилось за пять секунд,
    // считаем неудачей и отпускаем.
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  // Соединение может оборваться само по себе - например, база перезапустилась.
  // Без этого обработчика такая ошибка роняет весь процесс приложения.
  pool.on("error", (error) => {
    console.error("[db] соединение с базой оборвалось:", error.message);
  });

  globalForDb.pool = pool;
  return pool;
}

// Таблица событий. Создаётся при старте приложения, если её ещё нет.
//
// Ни одного поля, по которому можно узнать человека: ни почты, ни имени, ни
// адреса, ни сведений об устройстве. run_id - случайный номер, который
// придумывает браузер на время одного прохождения.
const createEventsTable = `
  CREATE TABLE IF NOT EXISTS events (
    id              BIGSERIAL PRIMARY KEY,
    run_id          TEXT        NOT NULL,
    kind            TEXT        NOT NULL,
    question_number SMALLINT,
    result_type     TEXT,
    boundary_count  SMALLINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

// Возвращает true, если связь с базой есть и таблица на месте.
// Ошибку не выбрасывает: вызывающему достаточно знать да или нет.
export async function ensureSchema(): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    console.warn("[db] DATABASE_URL не задан - статистика не записывается");
    return false;
  }

  try {
    await pool.query(createEventsTable);
    console.log("[db] связь с базой есть, таблица events на месте");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[db] не удалось подготовить таблицу:", message);
    return false;
  }
}
