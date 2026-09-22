// Адрес формы почты: POST /api/pochta
//
// Человек оставил почту на экране результата - адрес приходит сюда, уходит в
// Unisender, и оттуда человеку уходит письмо с разбором его типа.
//
// Почта здесь только проходит транзитом. Её нет ни в базе, ни в журнале
// сервера - даже при ошибке в журнал пишется только код ошибки сервиса.
// Решение из business/products/test-design.md: почты хранятся только у
// сервиса рассылки.
//
// Ответы:
//   200 { ok: true }                    письмо ушло
//   400 { oshibka: "adres" | ... }      заявка с ошибкой, форма объяснит какой
//   429 { oshibka: "chasto" }           слишком много заявок подряд
//   503 { oshibka: "vyklyucheno" }      форма ещё не включена
//   502 { oshibka: "servis" }           Unisender не принял или не ответил

import { parseZayavka } from "@/lib/pochta";
import {
  nastroykiIzOkruzheniya,
  OshibkaUnisender,
  otpravitRazbor,
} from "@/lib/unisender";
import { insertEvent } from "@/lib/db";

// ─── Ограничение частоты ────────────────────────────────────────────────────
//
// Здесь оно важнее, чем у /api/events. Каждая заявка отправляет настоящее
// письмо на любой указанный адрес. Без потолка через нашу форму можно было бы
// засыпать письмами чужой ящик, израсходовать бесплатные 1500 писем месяца за
// минуту и получить блокировку аккаунта Unisender за рассылку без согласия.
//
// Два потолка:
//   - с одного адреса отправителя - 5 заявок за 10 минут. Человеку, который
//     ошибся в почте и переотправил, хватит с запасом;
//   - на всех - 20 заявок в минуту. Больше, чем мы ждём за день.
//
// Адрес отправителя запроса (IP) живёт только в памяти процесса, пока идёт
// окно в 10 минут, не записывается ни в базу, ни в журнал и стирается при
// перезапуске. Без него ограничение по одному отправителю не построить: номер
// прохождения придумывает браузер, и его можно менять на каждый запрос.
const oknoIpMs = 10 * 60_000;
const maksSIp = 5;
const oknoObsheeMs = 60_000;
const maksObshee = 20;

let nachaloOknaIp = 0;
const poIp = new Map<string, number>();
let nachaloOknaObshego = 0;
let obsheeVOkne = 0;

function propustit(ip: string, seychas: number): boolean {
  if (seychas - nachaloOknaIp >= oknoIpMs) {
    nachaloOknaIp = seychas;
    poIp.clear();
  }
  if (seychas - nachaloOknaObshego >= oknoObsheeMs) {
    nachaloOknaObshego = seychas;
    obsheeVOkne = 0;
  }

  const sEtogoIp = poIp.get(ip) ?? 0;
  if (sEtogoIp >= maksSIp || obsheeVOkne >= maksObshee) return false;

  poIp.set(ip, sEtogoIp + 1);
  obsheeVOkne += 1;
  return true;
}

// Адрес отправителя. Amvera стоит перед нашим сервером посредником и
// передаёт настоящий адрес в заголовке x-forwarded-for - первым в списке.
// Нет заголовка - считаем всех неизвестных одним отправителем: потолок
// строже, но форма не ломается.
function adresOtpravitelya(zapros: Request): string {
  const cherez = zapros.headers.get("x-forwarded-for");
  return cherez?.split(",")[0]?.trim() || "neizvestno";
}

function otvet(status: number, telo: object): Response {
  return Response.json(telo, { status });
}

export async function POST(zapros: Request) {
  // Выключатель. Пока в переменных окружения нет FORMA_POCHTY=vkl, адрес ничего
  // не делает. Так форму можно выложить заранее, а включить одной переменной -
  // после документов от юриста (фаза 4 плана формы почты).
  if (process.env.FORMA_POCHTY !== "vkl") {
    return otvet(503, { oshibka: "vyklyucheno" });
  }

  const nastroyki = nastroykiIzOkruzheniya();
  if (!nastroyki) {
    console.error("[pochta] не настроены UNISENDER_API_KEY или UNISENDER_SENDER_EMAIL");
    return otvet(503, { oshibka: "vyklyucheno" });
  }

  let syroe: unknown;
  try {
    syroe = await zapros.json();
  } catch {
    return otvet(400, { oshibka: "format" });
  }

  const razbor = parseZayavka(syroe);
  if ("oshibka" in razbor) return otvet(400, { oshibka: razbor.oshibka });
  const { zayavka } = razbor;

  if (!propustit(adresOtpravitelya(zapros), Date.now())) {
    return otvet(429, { oshibka: "chasto" });
  }

  try {
    await otpravitRazbor(zayavka, nastroyki);
  } catch (oshibka) {
    const kod = oshibka instanceof OshibkaUnisender ? oshibka.kod : "neizvestno";
    // Только код. Ни адреса почты, ни текста заявки.
    console.error(`[pochta] письмо не ушло: ${kod}`);
    return otvet(502, { oshibka: "servis" });
  }

  // Анонимная статистика: «оставил почту» - без адреса, только номер
  // прохождения. Решение 5 плана формы почты. Письмо уже ушло, поэтому сбой
  // записи не должен превратиться в ошибку для человека - insertEvent сама
  // ничего не выбрасывает.
  if (zayavka.runId) {
    await insertEvent({ runId: zayavka.runId, kind: "pochta" });
  }

  return otvet(200, { ok: true });
}
