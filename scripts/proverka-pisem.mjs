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

  // Цены в письме быть не должно. Ответ юриста на вопрос 12 от 29.09.2026:
  // реклама своих услуг в первом письме с результатами теста рискованна, «со
  // стоимостью точно не нужно это делать». Условия работы живут на /zapis.
  proverit("цены в письме нет", !/₽|\d+\s*рублей/.test(html));

  proverit("есть оговорка, что разбор не заменяет специалиста",
    html.includes("не заменяет работу со специалистом"));

  proverit("указано, где смотреть условия работы",
    html.includes("kustova-psy.ru/zapis"));

  // Кнопка ведёт прямо в телеграм: она рассчитана на читателей с VPN, у
  // которых не открывается сайт на российском хостинге. Для тех, кто без VPN,
  // в строке ниже стоит короткий адрес сайта. Разбор - в комментарии к
  // kartochkaPriglasheniya.
  proverit("кнопка ведёт в телеграм", html.includes('href="https://t.me/ukusto"'));

  // Под кнопкой адрес и ник написаны словами - это путь на случай, когда
  // ссылка не срабатывает. Сейчас такой случай постоянный: сервис рассылки
  // подменяет ссылки на geteml.com, который у получателей не открывается.
  proverit("под кнопкой ник телеграма словами",
    /Не открылось[\s\S]{0,80}@ukusto/.test(html));

  proverit("запасной путь - ответить на письмо", /ответ(ить|ьте) на это письмо/.test(html));

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

  // Единственная ссылка в письме - кнопка записи. Всё остальное написано
  // словами: адрес сайта в подвале, короткий адрес и ник под кнопкой.
  proverit("ссылка в письме одна - кнопка записи",
    (html.match(/<a\s[^>]*href=/g) ?? []).length === 1);

  proverit("ник телеграма стоит текстом, а не ссылкой",
    html.includes("@ukusto") &&
      !/<a[^>]+href="[^"]*t\.me[^"]*"[^>]*>(?!Написать мне<)/.test(html));
  proverit("тёмная тема описана", html.includes("prefers-color-scheme: dark"));
}

await ubrat();

const plohih = itogi.filter((x) => !x).length;
console.log(`\nИтого: прошло ${itogi.length - plohih} из ${itogi.length}`);
process.exit(plohih === 0 ? 0 : 1);
