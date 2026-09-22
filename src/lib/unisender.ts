// Разговор с сервисом рассылки Unisender. Только для сервера: здесь ключ
// доступа, а ключ в браузер попасть не должен - кто его получит, сможет
// рассылать письма от имени владелицы.
//
// Что происходит, когда человек оставил почту:
//   1. subscribe - адрес кладётся в список своего типа результата вместе с
//      отметкой о согласии на рассылку и временем согласия;
//   2. sendEmail - на адрес уходит письмо с разбором.
//
// Почему письмо шлём мы, а не сценарий в кабинете Unisender - см. план
// формы почты, фаза 1: один вызов вместо пяти сценариев, собранных кликами, и
// тексты писем живут в одном месте.
//
// Настройки - в переменных окружения, в коде их нет:
//   UNISENDER_API_KEY       ключ доступа, секрет
//   UNISENDER_SENDER_EMAIL  адрес отправителя - только на своём домене,
//                           gmail.com Unisender не пропускает
//   UNISENDER_SENDER_NAME   имя отправителя, по умолчанию «Ульяна Кустова»

import type { TypeCode } from "@/data/questions";
import { pisma } from "@/data/pisma";
import { pismoVHtml } from "@/lib/pisma";
import type { Zayavka } from "@/lib/pochta";

const ADRES_API = "https://api.unisender.com/ru/api/";

// Сколько ждать ответа сервиса. Человек в это время смотрит на кнопку со
// значком загрузки - дольше восьми секунд ждать нечестно, лучше сказать «не
// получилось» и дать попробовать ещё раз.
const TAYMAUT_MS = 8000;

// Списки ищем по названию, а не по номеру. Номера выдаёт Unisender, и если
// список когда-нибудь пересоздадут, номер сменится, а название - нет. Списки
// созданы 22.09.2026, при фазе 1 плана формы почты.
const NAZVANIYA_SPISKOV: Record<TypeCode, string> = {
  rescuer: "Тест: вы спасаете",
  perfectionist: "Тест: вы соответствуете",
  peacemaker: "Тест: вы сглаживаете",
  carrier: "Тест: вы тянете",
  boundary: "Тест: отказывать умеете",
};

// Ошибка сервиса. Наружу уходит только код - без адреса человека и без
// подробностей, в журнал сервера пишется тоже только он.
export class OshibkaUnisender extends Error {
  constructor(public kod: string) {
    super(`Unisender: ${kod}`);
  }
}

export type NastroykiUnisender = {
  klyuch: string;
  otpravitel: string;
  imyaOtpravitelya: string;
};

// Настройки из окружения. null - чего-то не хватает, отправлять нельзя.
export function nastroykiIzOkruzheniya(): NastroykiUnisender | null {
  const klyuch = process.env.UNISENDER_API_KEY?.trim();
  const otpravitel = process.env.UNISENDER_SENDER_EMAIL?.trim();
  if (!klyuch || !otpravitel) return null;
  return {
    klyuch,
    otpravitel,
    imyaOtpravitelya:
      process.env.UNISENDER_SENDER_NAME?.trim() || "Ульяна Кустова",
  };
}

async function vyzvat(
  metod: string,
  klyuch: string,
  parametry: Record<string, string>,
): Promise<unknown> {
  // Ключ - в теле запроса, а не в адресе. Адреса оседают в журналах
  // серверов по дороге, тело запроса - нет.
  const telo = new URLSearchParams({
    format: "json",
    api_key: klyuch,
    ...parametry,
  });

  let otvet: Response;
  try {
    otvet = await fetch(ADRES_API + metod, {
      method: "POST",
      body: telo,
      signal: AbortSignal.timeout(TAYMAUT_MS),
    });
  } catch (oshibka) {
    const imya = oshibka instanceof Error ? oshibka.name : "neizvestno";
    throw new OshibkaUnisender(imya === "TimeoutError" ? "timeout" : "set");
  }

  let json: { result?: unknown; error?: unknown; code?: unknown };
  try {
    json = await otvet.json();
  } catch {
    throw new OshibkaUnisender(`http-${otvet.status}`);
  }

  if (json.error !== undefined) {
    throw new OshibkaUnisender(String(json.code ?? "error"));
  }
  return json.result;
}

// Номера списков, найденные по названиям. Запоминаются на всё время работы
// сервера: список ищется один раз, а не при каждой заявке.
let keshSpiskov: Promise<Record<TypeCode, number>> | null = null;

async function najtiSpiski(klyuch: string): Promise<Record<TypeCode, number>> {
  const spiski = (await vyzvat("getLists", klyuch, {})) as {
    id: number;
    title: string;
  }[];

  const nomera = {} as Record<TypeCode, number>;
  for (const [kod, nazvanie] of Object.entries(NAZVANIYA_SPISKOV)) {
    const nayden = spiski.find((s) => s.title === nazvanie);
    if (!nayden) throw new OshibkaUnisender(`net-spiska-${kod}`);
    nomera[kod as TypeCode] = nayden.id;
  }
  return nomera;
}

function nomeraSpiskov(klyuch: string): Promise<Record<TypeCode, number>> {
  if (!keshSpiskov) {
    keshSpiskov = najtiSpiski(klyuch).catch((oshibka) => {
      // Не нашли - не запоминаем неудачу, в следующий раз попробуем снова.
      keshSpiskov = null;
      throw oshibka;
    });
  }
  return keshSpiskov;
}

export async function otpravitRazbor(
  zayavka: Zayavka,
  nastroyki: NastroykiUnisender,
): Promise<void> {
  const nomera = await nomeraSpiskov(nastroyki.klyuch);
  const spisok = String(nomera[zayavka.resultType]);

  // 1. В список своего типа. double_optin=3 - без письма «подтвердите
  // адрес»: решение 4 плана формы почты, разбор уходит сразу.
  // overwrite=2 - если адрес уже был, обновить только переданные поля.
  await vyzvat("subscribe", nastroyki.klyuch, {
    list_ids: spisok,
    "fields[email]": zayavka.email,
    "fields[soglasie_rassylka]": zayavka.rassylka ? "1" : "0",
    "fields[soglasie_data]": new Date().toISOString(),
    double_optin: "3",
    overwrite: "2",
  });

  // 2. Само письмо.
  const pismo = pisma[zayavka.resultType];
  const rezultat = (await vyzvat("sendEmail", nastroyki.klyuch, {
    email: zayavka.email,
    sender_name: nastroyki.imyaOtpravitelya,
    sender_email: nastroyki.otpravitel,
    subject: pismo.tema,
    body: pismoVHtml(pismo),
    list_id: spisok,
    lang: "ru",
    error_checking: "1",
  })) as { errors?: { code?: string }[] }[] | undefined;

  // sendEmail отвечает «успешно» даже тогда, когда письмо не ушло, а причину
  // кладёт внутрь ответа. Так было с адресом отправителя на gmail.com.
  const oshibkaPisma = rezultat?.[0]?.errors?.[0];
  if (oshibkaPisma) {
    throw new OshibkaUnisender(oshibkaPisma.code ?? "sendEmail");
  }
}
