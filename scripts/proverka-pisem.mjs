// Проверка всех пяти писем: собирается ли каждое так, как задумано.
//
// Запуск из папки udobnost:
//   node --experimental-strip-types scripts/proverka-pisem.mjs
//
// Проверяет структуру, а не красоту: заголовок, врезку с результатом,
// чередование полос, карточку приглашения с ценой и кнопкой, подпись,
// отсутствие следов разметки. Красоту смотрим глазами на снимках.

import { sobratPisma } from "./sobrat-pisma.mjs";

const { pisma, pismoVHtml, ubrat } = await sobratPisma();

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

  // Адреса в письме стоят ТЕКСТОМ, а не ссылками. Причина - сервис рассылки
  // подменяет содержимое ссылок на свой домен geteml.com, который не
  // открывается у получателей. Текст он не трогает, а почтовые программы сами
  // делают такой адрес нажимаемым. Разбор - plans/2026-09-28-ssylki-v-pismah.md
  proverit("адрес сайта в подвале", html.includes("kustova-psy.ru"));

  proverit("короткий адрес записи в карточке", html.includes("kustova-psy.ru/tg"));

  proverit("адрес записи стоит текстом, а не ссылкой",
    !/<a[^>]+href="[^"]*kustova-psy\.ru/.test(html));

  proverit("ник телеграма стоит текстом, а не ссылкой",
    html.includes("@ukusto") && !/<a[^>]+href="[^"]*t\.me/.test(html.replace(/<a href="https:\/\/t\.me\/ukusto"[^>]*>Записаться в телеграме<\/a>/, "")));
  proverit("тёмная тема описана", html.includes("prefers-color-scheme: dark"));
}

await ubrat();

const plohih = itogi.filter((x) => !x).length;
console.log(`\nИтого: прошло ${itogi.length - plohih} из ${itogi.length}`);
process.exit(plohih === 0 ? 0 : 1);
