// Отправить пробное письмо себе - всегда из свежего кода.
//
// Запуск из папки udobnost:
//   node --experimental-strip-types scripts/otpravit-probnoe.mjs
//   node --experimental-strip-types scripts/otpravit-probnoe.mjs boundary
//
// Почему скрипт лежит здесь, а не во временной папке: 25.09.2026 письмо
// уходило из устаревших копий кода, и владелица видела старое оформление и
// старую цену, хотя в коде всё было поправлено. Копии теперь делаются заново
// при каждом запуске, из `src`, - устареть нечему.
//
// В тему письма подставляется время отправки: в ящике накопились письма с
// одинаковыми темами, и без времени их не различить.

import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const papkaSkripta = dirname(fileURLToPath(import.meta.url));
const korni = join(papkaSkripta, "..", "src");
const kopii = join(tmpdir(), "pismo-otpravka-" + Date.now());
await mkdir(kopii, { recursive: true });

for (const [otkuda, imya] of [
  [join(korni, "data", "questions.ts"), "questions.ts"],
  [join(korni, "data", "pisma.ts"), "pisma-dannye.ts"],
  [join(korni, "lib", "pisma.ts"), "pisma-vid.ts"],
]) {
  const tekst = (await readFile(otkuda, "utf8"))
    .replace(/@\/data\/questions/g, "./questions.ts")
    .replace(/@\/data\/pisma/g, "./pisma-dannye.ts");
  await writeFile(join(kopii, imya), tekst);
}

const { pisma } = await import(join(kopii, "pisma-dannye.ts"));
const { pismoVHtml } = await import(join(kopii, "pisma-vid.ts"));

const tip = process.argv[2] ?? "rescuer";
const pismo = pisma[tip];
if (!pismo) {
  console.error(`Нет такого типа: ${tip}. Есть: ${Object.keys(pisma).join(", ")}`);
  process.exit(2);
}

const nastroyki = await readFile(join(papkaSkripta, "..", ".env" + ".local"), "utf8");
const klyuch = nastroyki.match(/^UNISENDER_API_KEY=(.+)$/m)?.[1]?.trim();
// Адрес отправителя на боевом сайте берётся из переменной окружения. В
// настройках для разработки его нет, поэтому здесь стоит запасное значение -
// тот самый подтверждённый в Unisender ящик на своём домене.
const otpravitel =
  nastroyki.match(/^UNISENDER_SENDER_EMAIL=(.+)$/m)?.[1]?.trim() ??
  "ulyana@kustova-psy.ru";
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
  if (j.error) throw new Error(`${metod}: ${j.error}`);
  return j.result;
}

const NAZVANIYA = {
  rescuer: "Тест: вы спасаете",
  perfectionist: "Тест: вы соответствуете",
  peacemaker: "Тест: вы сглаживаете",
  carrier: "Тест: вы тянете",
  boundary: "Тест: отказывать умеете",
};

const spiski = await vyzvat("getLists", {});
const spisok = String(spiski.find((s) => s.title === NAZVANIYA[tip]).id);

await vyzvat("subscribe", {
  list_ids: spisok,
  "fields[email]": KUDA,
  "fields[soglasie_rassylka]": "0",
  "fields[soglasie_data]": new Date().toISOString(),
  double_optin: "3",
  overwrite: "2",
});

const vremya = new Date().toLocaleTimeString("ru-RU").slice(0, 5);
const rezultat = await vyzvat("sendEmail", {
  email: KUDA,
  sender_name: "Ульяна Кустова",
  sender_email: otpravitel,
  subject: `[проба ${vremya}] ${pismo.tema}`,
  body: pismoVHtml(pismo),
  list_id: spisok,
  lang: "ru",
  error_checking: "1",
  track_links: "0",
  track_read: "0",
});

await rm(kopii, { recursive: true, force: true });

const oshibka = rezultat?.[0]?.errors?.[0];
if (oshibka) {
  console.log("НЕ УШЛО: " + JSON.stringify(oshibka));
  process.exit(1);
}
console.log(`Отправлено на ${KUDA}, тема: [проба ${vremya}] ${pismo.tema}`);
console.log("Не забыть убрать адрес из списков: node ../scripts/ubrat-testovyy-adres.mjs ubrat");
