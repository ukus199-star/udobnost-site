// Проверка потолков частоты у формы почты.
//
// Потолков четыре, и три из них проверяются здесь. Суточный потолок в 100
// писем не проверяется: до него раньше срабатывает потолок «20 заявок в
// минуту», а ждать минуты в проверке незачем.
//
// Перед запуском нужен сервер с ПОДДЕЛЬНЫМ ключом Unisender - тогда заявка
// доходит до сервиса и честно получает отказ, а письма никуда не уходят:
//   UNISENDER_API_KEY=poddelnyy UNISENDER_SENDER_EMAIL=ulyana@kustova-psy.ru \
//     FORMA_POCHTY=vkl DATABASE_URL= pnpm start -p 3005
//
// Запуск: node scripts/proverka-potolkov.mjs
//
// Счётчики живут в памяти процесса, поэтому проверку надо запускать на
// свежезапущенном сервере: иначе прошлый прогон съест часть запаса.

const ADRES = "http://127.0.0.1:3005/api/pochta";
const podozhdat = (ms) => new Promise((r) => setTimeout(r, ms));

let zhiv = false;
for (let i = 0; i < 40; i++) {
  try { await fetch(ADRES); zhiv = true; break; } catch { await podozhdat(500); }
}
if (!zhiv) {
  console.error("Сервер на 3005 не отвечает. См. шапку файла.");
  process.exit(2);
}

async function zayavka(ip, email) {
  const r = await fetch(ADRES, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ email, soglasie: true, rassylka: false, resultType: "rescuer" }),
  });
  return r.status;
}

const itogi = [];
function proverit(nazvanie, uslovie, detali) {
  itogi.push(!!uslovie);
  console.log((uslovie ? "OK   " : "ПЛОХО") + " " + nazvanie + (detali !== undefined ? `  [${detali}]` : ""));
}

// 502 - заявка прошла все потолки и упёрлась в поддельный ключ.
// 429 - потолок сработал.
const a = [];
for (let i = 1; i <= 8; i++) a.push(await zayavka(`10.0.0.${i}`, "zhertva@example.ru"));
proverit(
  "одна почта, 8 разных адресов отправителя: прошло 3, дальше отказ",
  a.slice(0, 3).every((s) => s === 502) && a.slice(3).every((s) => s === 429),
  a.join(" "),
);

proverit(
  "тот же адрес большими буквами и с пробелами считается тем же",
  (await zayavka("10.0.0.50", "  ZHERTVA@Example.ru ")) === 429,
);

proverit("другая почта после этого проходит", (await zayavka("10.0.0.51", "drugoy@example.ru")) === 502);

const b = [];
for (let i = 1; i <= 6; i++) b.push(await zayavka("10.0.9.9", `raznye${i}@example.ru`));
proverit(
  "один отправитель, 6 разных почт: прошло 5, шестая отказ",
  b.slice(0, 5).every((s) => s === 502) && b[5] === 429,
  b.join(" "),
);

const plohih = itogi.filter((x) => !x).length;
console.log(`\nИтого: прошло ${itogi.length - plohih} из ${itogi.length}`);
process.exit(plohih === 0 ? 0 : 1);
