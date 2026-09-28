// Отправить все пять писем теста на проверочный адрес и проследить доставку.
//
// Запуск из папки udobnost:
//   node --experimental-strip-types scripts/otpravit-vse-pisma.mjs
//   KUDA=ulyana@kustova-psy.ru node --experimental-strip-types scripts/otpravit-vse-pisma.mjs
//
// Зачем отдельно от `otpravit-probnoe.mjs`: тот отправляет одно письмо и по
// умолчанию всегда «Спасателя». Из-за этого 26.09.2026 в ящике владелицы
// скопились несколько одинаковых писем, и ей казалось, что письмо повторяется.
// Здесь пять разных писем идут по порядку, с номером в теме.
//
// Пауза 65 секунд: Unisender не отправляет одному адресату чаще одного письма
// в минуту, остальные молча теряются.
//
// Копии файлов делаются заново при каждом запуске - письмо собирается из `src`,
// устареть нечему.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sobratPisma } from "./sobrat-pisma.mjs";

const papkaSkripta = dirname(fileURLToPath(import.meta.url));
const { pisma, pismoVHtml, ubrat } = await sobratPisma();

const nastroyki = await readFile(join(papkaSkripta, "..", ".env" + ".local"), "utf8");
const klyuch = nastroyki.match(/^UNISENDER_API_KEY=(.+)$/m)?.[1]?.trim();
const otpravitel =
  nastroyki.match(/^UNISENDER_SENDER_EMAIL=(.+)$/m)?.[1]?.trim() ?? "ulyana@kustova-psy.ru";
if (!klyuch) {
  console.error("В настройках нет ключа Unisender.");
  process.exit(2);
}

const KUDA = process.env.KUDA ?? "ukus199@gmail.com";

async function vyzvat(metod, parametry) {
  const r = await fetch("https://api.unisender.com/ru/api/" + metod, {
    method: "POST",
    body: new URLSearchParams({ format: "json", api_key: klyuch, ...parametry }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${metod}: ${j.error} ${j.code ?? ""}`);
  return j.result;
}

const NAZVANIYA = {
  rescuer: "Тест: вы спасаете",
  perfectionist: "Тест: вы соответствуете",
  peacemaker: "Тест: вы сглаживаете",
  carrier: "Тест: вы тянете",
  boundary: "Тест: отказывать умеете",
};
const PORYADOK = ["rescuer", "perfectionist", "peacemaker", "carrier", "boundary"];

const spiski = await vyzvat("getLists", {});
const otpravleno = [];

for (let i = 0; i < PORYADOK.length; i++) {
  const tip = PORYADOK[i];
  const pismo = pisma[tip];
  const spisok = String(spiski.find((s) => s.title === NAZVANIYA[tip]).id);

  if (i > 0) await new Promise((r) => setTimeout(r, 65000));

  await vyzvat("subscribe", {
    list_ids: spisok,
    "fields[email]": KUDA,
    "fields[soglasie_rassylka]": "0",
    "fields[soglasie_data]": new Date().toISOString(),
    double_optin: "3",
    overwrite: "2",
  });

  const otvet = await vyzvat("sendEmail", {
    email: KUDA,
    sender_name: "Ульяна Кустова",
    sender_email: otpravitel,
    subject: `[${i + 1} из 5 · ${pismo.tema}] 📘 Результаты теста: подробный разбор`,
    body: pismoVHtml(pismo),
    list_id: spisok,
    lang: "ru",
    error_checking: "1",
    track_links: "0",
    track_read: "0",
  });

  const oshibka = otvet?.[0]?.errors?.[0];
  const id = otvet?.[0]?.id;
  console.log(
    oshibka
      ? `${i + 1}. ${pismo.tema}: НЕ УШЛО ${JSON.stringify(oshibka)}`
      : `${i + 1}. ${pismo.tema}: принято, id ${id}`,
  );
  if (id) otpravleno.push({ nomer: i + 1, tip: pismo.tema, id });
}

await ubrat();

// Статус доставки Unisender проставляет с задержкой: сразу после отправки все
// письма показывают `ok_sent`, и это не значит, что они не дошли. 26.09.2026 я
// на этом построил неверный вывод про фильтрацию Gmail.
await new Promise((r) => setTimeout(r, 30000));
console.log("\nСтатусы доставки:");
for (const p of otpravleno) {
  const j = await vyzvat("checkEmail", { email_id: String(p.id) });
  console.log(`  ${p.nomer}. ${p.tip}: ${j?.statuses?.[0]?.status ?? JSON.stringify(j)}`);
}
console.log(`\nУбрать адрес из списков: ADRES=${KUDA} node ../scripts/ubrat-testovyy-adres.mjs ubrat`);
