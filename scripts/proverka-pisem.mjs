// Проверка всех пяти писем: собирается ли каждое так, как задумано.
//
// Запуск из папки udobnost:
//   node --experimental-strip-types scripts/proverka-pisem.mjs
//
// Проверяет структуру, а не красоту: заголовок, врезку с результатом,
// чередование полос, карточку приглашения с ценой и кнопкой, подпись,
// отсутствие следов разметки. Красоту смотрим глазами на снимках.

import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const papkaSkripta = dirname(fileURLToPath(import.meta.url));
const korni = join(papkaSkripta, "..", "src");
const kopii = join(tmpdir(), "proverka-pisem-" + Date.now());
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

const itogi = [];
function proverit(imya, uslovie, detali) {
  itogi.push(!!uslovie);
  console.log((uslovie ? "  OK    " : "  ПЛОХО ") + imya + (detali !== undefined ? `  [${detali}]` : ""));
}

for (const [kod, pismo] of Object.entries(pisma)) {
  console.log(`\n${kod} - «${pismo.tema}»`);
  const html = pismoVHtml(pismo);

  const zagolovkov = (html.match(/<h1/g) ?? []).length;
  proverit("один заголовок письма", zagolovkov === 1, zagolovkov);

  proverit("врезка «ВАШ РЕЗУЛЬТАТ» с типом результата",
    html.includes("Ваш результат") && html.includes(pismo.tema));

  const polosKremovyh = (html.match(/polosa-kremovaya/g) ?? []).length;
  const polosZelyonyh = (html.match(/polosa-zelyonaya/g) ?? []).length;
  proverit(`разделов полосами: ${polosKremovyh} кремовых, ${polosZelyonyh} зелёных`,
    polosKremovyh + polosZelyonyh >= 3 && Math.abs(polosKremovyh - polosZelyonyh) <= 1);

  proverit("карточка приглашения с ценой", /(\d[\d\s]{2,7})\s*₽/.test(html), html.match(/(\d[\d\s]{2,7})\s*₽/)?.[1]);

  proverit("цена не осталась второй раз в тексте", !/\d+\s*рублей/.test(html));

  proverit("кнопка ведёт в телеграм владелицы", html.includes('href="https://t.me/ukusto"'));

  proverit("запасной путь - ответить на письмо", html.includes("или просто ответьте на это письмо"));

  proverit("подпись автора на месте",
    html.includes("Ульяна Кустова, гештальт-терапевт"));

  // Считаем только видимый текст: в блоке стилей звёздочки - это символы
  // комментариев, и раньше проверка спотыкалась именно о них.
  const vidimyy = html.replace(/<style[\s\S]*?<\/style>/g, "");
  const zvyozdochek = (vidimyy.match(/\*/g) ?? []).length;
  proverit("следов разметки не осталось", zvyozdochek === 0, zvyozdochek);

  const emodzi = (html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  proverit(`эмодзи в письме: ${emodzi} (не больше трёх)`, emodzi <= 3);

  proverit("ссылка на сайт в подвале", html.includes("https://kustova-psy.ru"));
  proverit("тёмная тема описана", html.includes("prefers-color-scheme: dark"));
}

await rm(kopii, { recursive: true, force: true });

const plohih = itogi.filter((x) => !x).length;
console.log(`\nИтого: прошло ${itogi.length - plohih} из ${itogi.length}`);
process.exit(plohih === 0 ? 0 : 1);
