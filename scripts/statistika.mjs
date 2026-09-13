// Статистика прохождений теста.
//
// Запуск: bash scripts/stats.sh (из корня рабочей папки)
//
// Скрипт задаёт базе четыре вопроса и печатает ответы по-русски. Ничего не
// меняет и не удаляет - только читает. Запускать можно сколько угодно раз.
//
// Строка подключения берётся из файла udobnost/.env.local, он не попадает в
// репозиторий. Что в каждом запросе происходит - написано перед ним.

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Нет строки подключения.");
  console.error("Создайте файл udobnost/.env.local - как, написано в scripts/zaprosy.md");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // Amvera требует шифрования при подключении снаружи. Проверку сертификата
  // выключаем: он у них внутренний, и обычной проверке не соответствует.
  // Шифрование при этом работает - перехватить по дороге ничего нельзя.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

// Сколько прохождений начато.
//
// Считаем не строки, а РАЗНЫЕ номера прохождений: DISTINCT убирает повторы.
// Если бы человек нажал «Начать» дважды в одной вкладке, номер был бы тот же,
// и мы посчитали бы его один раз.
const nachato = `
  SELECT COUNT(DISTINCT run_id) AS skolko
  FROM events
  WHERE kind = 'start'
`;

// Сколько дошли до результата.
//
// То же самое, только событие другое. Отношение второго числа к первому и есть
// главная цифра теста: сколько людей доходит до конца.
const doshli = `
  SELECT COUNT(DISTINCT run_id) AS skolko
  FROM events
  WHERE kind = 'result'
`;

// На каком вопросе уходят чаще всего.
//
// Читается изнутри наружу. Внутренний запрос берёт каждое прохождение,
// у которого НЕТ события 'result' - то есть брошенное, - и находит
// последний вопрос, до которого человек дошёл: MAX(question_number).
// Внешний считает, сколько раз каждый номер вопроса оказался последним.
const gde_uhodyat = `
  SELECT posledniy_vopros, COUNT(*) AS skolko
  FROM (
    SELECT run_id, MAX(question_number) AS posledniy_vopros
    FROM events
    WHERE kind = 'answer'
      AND run_id NOT IN (SELECT run_id FROM events WHERE kind = 'result')
    GROUP BY run_id
  ) AS broshennye
  GROUP BY posledniy_vopros
  ORDER BY skolko DESC, posledniy_vopros
  LIMIT 5
`;

// Какие типы выпадают.
//
// Ради этого числа статистика и затевалась: по подписавшимся распределение
// видно с перекосом, а здесь - по всем, кто дошёл до результата.
const tipy = `
  SELECT result_type, COUNT(*) AS skolko
  FROM events
  WHERE kind = 'result'
  GROUP BY result_type
  ORDER BY skolko DESC
`;

// Первая и последняя запись. Нужны, чтобы понимать, за какой срок цифры.
const period = `
  SELECT
    COUNT(*) AS vsego_zapisey,
    MIN(created_at) AS pervaya,
    MAX(created_at) AS poslednyaya
  FROM events
`;

const nazvaniyaTipov = {
  rescuer: "Спасатель",
  carrier: "Тот, на ком всё держится",
  perfectionist: "Отличница",
  peacemaker: "Миротворец",
  boundary: "С границами в порядке",
};

function moskovskoeVremya(date) {
  if (!date) return "нет";
  return date.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

try {
  const [a, b, c, d, e] = await Promise.all([
    pool.query(nachato),
    pool.query(doshli),
    pool.query(gde_uhodyat),
    pool.query(tipy),
    pool.query(period),
  ]);

  const nachatoSkolko = Number(a.rows[0].skolko);
  const doshliSkolko = Number(b.rows[0].skolko);
  const svodka = e.rows[0];

  console.log("");
  console.log("СТАТИСТИКА ТЕСТА «НАСКОЛЬКО ВЫ УДОБНЫ»");
  console.log("");
  console.log("Прохождений начато:            ", nachatoSkolko);
  console.log("Дошли до результата:           ", doshliSkolko);

  if (nachatoSkolko > 0) {
    const dolya = Math.round((doshliSkolko / nachatoSkolko) * 100);
    console.log("Доходит до конца:              ", dolya + "%");
  }

  console.log("");
  console.log("Где бросают тест:");
  if (c.rows.length === 0) {
    console.log("   никто не бросал");
  } else {
    for (const row of c.rows) {
      console.log(`   вопрос ${row.posledniy_vopros} - ушли ${row.skolko}`);
    }
  }

  console.log("");
  console.log("Какие типы выпадают:");
  if (d.rows.length === 0) {
    console.log("   до результата ещё никто не дошёл");
  } else {
    for (const row of d.rows) {
      const nazvanie = nazvaniyaTipov[row.result_type] ?? row.result_type;
      console.log(`   ${nazvanie}: ${row.skolko}`);
    }
  }

  console.log("");
  console.log("Всего записей в базе:          ", svodka.vsego_zapisey);
  console.log("Первая:                        ", moskovskoeVremya(svodka.pervaya));
  console.log("Последняя:                     ", moskovskoeVremya(svodka.poslednyaya));
  console.log("");
} catch (error) {
  console.error("");
  console.error("Не получилось:", error.message);
  console.error("");
  if (error.message.includes("timeout") || error.message.includes("ENOTFOUND")) {
    console.error("Похоже на VPN. Выключите его и попробуйте снова:");
    console.error("Amvera не пускает подключения с зарубежных адресов.");
  }
  if (error.message.includes("password") || error.message.includes("authentication")) {
    console.error("Не подошёл пароль в udobnost/.env.local.");
  }
  console.error("");
  process.exitCode = 1;
} finally {
  await pool.end();
}
