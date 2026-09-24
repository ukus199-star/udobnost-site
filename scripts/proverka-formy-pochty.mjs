// Проверка формы почты в настоящем Chrome.
//
// Зачем файл лежит в проекте, а не во временной папке: временная папка
// обнуляется между сессиями, и 24.09.2026 прогнать регрессию было нечем -
// скрипт проверки фазы 3 пропал. Теперь он живёт рядом с кодом, который
// проверяет.
//
// Что нужно перед запуском:
//   1. Собранный проект: pnpm build
//   2. Два сервера с ПОДДЕЛЬНЫМ ключом Unisender, чтобы ничего не ушло
//      по-настоящему:
//      UNISENDER_API_KEY=poddelnyy UNISENDER_SENDER_EMAIL=ulyana@kustova-psy.ru \
//        FORMA_POCHTY=vkl DATABASE_URL= pnpm start -p 3000
//      UNISENDER_API_KEY=poddelnyy UNISENDER_SENDER_EMAIL=ulyana@kustova-psy.ru \
//        DATABASE_URL= pnpm start -p 3001
//   3. Chrome с открытым портом отладки:
//      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//        --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-proverka
//
// Запуск: node scripts/proverka-formy-pochty.mjs
//
// Удачная отправка проверяется подменой ответа сервера на 200 прямо в
// странице: настоящая отправка требует подтверждённого отправителя, а он
// появится только в фазе 1.

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PAPKA = join(tmpdir(), "snimki-formy-pochty");
await mkdir(PAPKA, { recursive: true });
const podozhdat = (ms) => new Promise((r) => setTimeout(r, ms));

for (const u of ["http://127.0.0.1:3000/", "http://127.0.0.1:3001/", "http://127.0.0.1:9333/json/version"]) {
  let zhiv = false;
  for (let i = 0; i < 60; i++) {
    try { await fetch(u); zhiv = true; break; } catch { await podozhdat(500); }
  }
  if (!zhiv) {
    console.error(`Не отвечает ${u}. См. список того, что нужно запустить, в шапке файла.`);
    process.exit(2);
  }
}

async function vkladka() {
  const v = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let n = 0;
  const zhdut = new Map();
  const oshibki = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && zhdut.has(m.id)) { zhdut.get(m.id)(m); zhdut.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") oshibki.push(m.params.exceptionDetails.exception?.description?.split("\n")[0]);
  };
  const k = (method, params = {}) => {
    const id = ++n;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => zhdut.set(id, r));
  };
  const v8 = async (kod) => {
    const o = await k("Runtime.evaluate", { expression: kod, awaitPromise: true, returnByValue: true });
    if (o.result?.exceptionDetails) throw new Error("в странице: " + JSON.stringify(o.result.exceptionDetails.exception?.description));
    return o.result?.result?.value;
  };
  await k("Page.enable");
  await k("Runtime.enable");
  return { v, ws, k, v8, oshibki };
}

const itogi = [];
function proverit(nazvanie, uslovie, detali) {
  itogi.push(!!uslovie);
  console.log((uslovie ? "OK   " : "ПЛОХО") + " " + nazvanie);
  if (!uslovie && detali !== undefined) console.log("       детали:", JSON.stringify(detali));
}

async function doRezultata(t, sayt, shirina, tema) {
  await t.k("Emulation.setDeviceMetricsOverride", { width: shirina, height: 800, deviceScaleFactor: 2, mobile: true });
  await t.k("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: tema }] });
  await t.k("Page.navigate", { url: sayt });
  await podozhdat(2500);
  await t.v8(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("Начать тест")).click(), 1`);
  for (let i = 0; i < 12; i++) {
    await podozhdat(420);
    await t.v8(`document.querySelectorAll("button[aria-pressed]")[${i % 5}].click(), 1`);
  }
  await podozhdat(1500);
}

const SOSTOYANIE = `(() => {
  const f = document.querySelector("form");
  const pole = document.querySelector('input[type="email"]');
  const galki = [...document.querySelectorAll('input[type="checkbox"]')];
  const knopka = f?.querySelector('button[type="submit"]');
  return {
    forma: !!f,
    pole: !!pole,
    galok: galki.length,
    otmecheny: galki.map(g => g.checked),
    soobshchenie: document.querySelector('[aria-live="polite"]')?.textContent.trim() ?? null,
    invalid: pole?.getAttribute("aria-invalid"),
    knopka: knopka?.textContent.trim() ?? null,
    zanyata: knopka?.disabled ?? null,
    status: document.querySelector('[role="status"]')?.textContent.trim() ?? null,
    skroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ssylki: [...(f?.querySelectorAll("a") ?? [])].map(a => a.getAttribute("href")),
  };
})()`;

// ─── Выключенная форма ───
{
  const t = await vkladka();
  await doRezultata(t, "http://127.0.0.1:3001/", 390, "light");
  const s = await t.v8(SOSTOYANIE);
  const naRezultate = await t.v8(`document.body.textContent.includes("Ваш результат")`);
  proverit("выключено: экран результата открыт, формы нет вовсе", naRezultate && !s.forma && !s.pole, s);
  proverit(`выключено: ошибок в браузере ${t.oshibki.length}`, t.oshibki.length === 0, t.oshibki);
  await fetch(`http://127.0.0.1:9333/json/close/${t.v.id}`); t.ws.close();
}

// ─── Включённая форма ───
{
  const t = await vkladka();
  await doRezultata(t, "http://127.0.0.1:3000/", 390, "light");
  let s = await t.v8(SOSTOYANIE);
  proverit("включено: форма, поле почты, две галочки", s.forma && s.pole && s.galok === 2, s);
  proverit("обе галочки не отмечены заранее", s.otmecheny.every((x) => x === false), s);
  proverit(`ссылки на документы: ${s.ssylki.join(", ")}`, ["/soglasie", "/politika", "/soglasie-rassylka"].every((h) => s.ssylki.includes(h)), s);

  const snimok = async (imya) => {
    const m = await t.k("Page.getLayoutMetrics");
    const { width, height } = m.result.cssContentSize;
    const r = await t.k("Page.captureScreenshot", { format: "jpeg", quality: 70, captureBeyondViewport: true, clip: { x: 0, y: Math.max(0, height - 1300), width, height: Math.min(height, 1300), scale: 1 } });
    await writeFile(`${PAPKA}/${imya}.jpg`, Buffer.from(r.result.data, "base64"));
  };
  await snimok("forma-svetlaya");

  const nazhat = `document.querySelector('form button[type="submit"]').click(), 1`;
  const vvesti = (tekst) => `(() => { const p = document.querySelector('input[type="email"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(p, ${JSON.stringify(tekst)}); p.dispatchEvent(new Event("input", { bubbles: true })); return 1; })()`;

  await t.v8(nazhat); await podozhdat(300);
  s = await t.v8(SOSTOYANIE);
  proverit(`пустой адрес: подсказка про опечатку, поле помечено (${s.soobshchenie})`, /опечатка/.test(s.soobshchenie) && s.invalid === "true", s);

  await t.v8(vvesti("ne adres")); await t.v8(nazhat); await podozhdat(300);
  s = await t.v8(SOSTOYANIE);
  proverit("кривой адрес: та же подсказка", /опечатка/.test(s.soobshchenie), s);

  await t.v8(vvesti("  UKUS199@Gmail.com ")); await podozhdat(100);
  s = await t.v8(SOSTOYANIE);
  proverit("начали исправлять адрес - подсказка исчезла", s.soobshchenie === "", s);
  await t.v8(nazhat); await podozhdat(300);
  s = await t.v8(SOSTOYANIE);
  proverit(`без первой галочки: просит согласие (${s.soobshchenie})`, /галочка/.test(s.soobshchenie), s);

  // Первая галочка кликом по тексту строки - зона нажатия вся строка.
  await t.v8(`[...document.querySelectorAll("form label")].find(l => l.textContent.includes("Я даю")).querySelector("span").click(), 1`);
  s = await t.v8(SOSTOYANIE);
  proverit("клик по тексту первой строки ставит галочку", s.otmecheny[0] === true && s.otmecheny[1] === false, s);

  // Настоящая отправка: ключ поддельный -> сервис не примет -> честная ошибка.
  //
  // Ответ сервера задерживаем на секунду. Сам запрос при этом настоящий:
  // задержка нужна, чтобы успеть посмотреть на кнопку во время отправки.
  // Без неё проверка зависела от того, как быстро ответит Unisender, и
  // 24.09.2026 она упала именно по этой причине, а не из-за формы.
  await t.v8(`(() => { const o = window.fetch.bind(window); window.fetch = async (u, p) => { const r = await o(u, p); if (String(u).includes("/api/pochta") && p?.method === "POST") await new Promise(z => setTimeout(z, 1000)); return r; }; return 1; })()`);
  await t.v8(nazhat);
  await podozhdat(300);
  s = await t.v8(SOSTOYANIE);
  proverit(`во время отправки кнопка занята и пишет «Отправляю…» (${s.knopka})`, s.zanyata === true && /Отправляю/.test(s.knopka), s);
  for (let i = 0; i < 40; i++) { await podozhdat(250); s = await t.v8(SOSTOYANIE); if (!s.zanyata) break; }
  proverit(`сервис не принял: «Не получилось отправить…», кнопка снова доступна (${s.soobshchenie})`, /Не получилось/.test(s.soobshchenie) && s.zanyata === false && s.knopka === "Прислать разбор", s);
  await snimok("forma-oshibka");

  // Удачная отправка: подменяем ответ сервера на 200, чтобы увидеть экран успеха.
  await t.v8(`(() => { const o = window.fetch.bind(window); window.__telo = null; window.fetch = (u, p) => { if (String(u).includes("/api/pochta") && p?.method === "POST") { window.__telo = JSON.parse(p.body); return new Promise(r => setTimeout(() => r(new Response(JSON.stringify({ ok: true }), { status: 200 })), 400)); } return o(u, p); }; return 1; })()`);
  await t.v8(`[...document.querySelectorAll("form label")].find(l => l.textContent.includes("Хочу получать")).querySelector("input").click(), 1`);
  await t.v8(nazhat); await podozhdat(900);
  s = await t.v8(SOSTOYANIE);
  const telo = await t.v8("window.__telo");
  proverit("в запрос ушли адрес в нижнем регистре без пробелов, согласие, рассылка, тип и номер прохождения",
    telo?.email === "ukus199@gmail.com" && telo?.soglasie === true && telo?.rassylka === true && typeof telo?.resultType === "string" && /^[a-z0-9]{8,40}$/.test(telo?.runId ?? ""), telo);
  proverit(`успех: «Готово, письмо уже в пути», адрес и совет про «Спам» (${s.status?.slice(0, 60)})`, /Готово/.test(s.status ?? "") && s.status.includes("ukus199@gmail.com") && /Спам/.test(s.status), s);
  proverit("после успеха формы с полем больше нет", !s.pole, s);
  await snimok("forma-gotovo");
  proverit(`ошибок в браузере: ${t.oshibki.length}`, t.oshibki.length === 0, t.oshibki);
  await fetch(`http://127.0.0.1:9333/json/close/${t.v.id}`); t.ws.close();
}

// ─── Узкий экран и тёмная тема ───
for (const [shirina, tema] of [[320, "dark"], [375, "light"]]) {
  const t = await vkladka();
  await doRezultata(t, "http://127.0.0.1:3000/", shirina, tema);
  const s = await t.v8(SOSTOYANIE);
  const vysoty = await t.v8(`(() => { const f = document.querySelector("form"); return { pole: Math.round(f.querySelector('input[type="email"]').getBoundingClientRect().height), knopka: Math.round(f.querySelector('button[type="submit"]').getBoundingClientRect().height) }; })()`);
  proverit(`${shirina}px, ${tema}: форма есть, ничего не вылезает вбок, поле ${vysoty.pole} и кнопка ${vysoty.knopka} точек`, s.forma && !s.skroll && vysoty.pole >= 44 && vysoty.knopka >= 44, { s, vysoty });
  await fetch(`http://127.0.0.1:9333/json/close/${t.v.id}`); t.ws.close();
}

const plohih = itogi.filter((x) => !x).length;
console.log(`\nСнимки: ${PAPKA}`);
console.log(`Итого: прошло ${itogi.length - plohih} из ${itogi.length}`);
process.exit(plohih === 0 ? 0 : 1);
