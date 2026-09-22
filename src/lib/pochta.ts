// Заявка с формы почты: что в ней бывает и как отличить настоящую от мусора.
//
// Файл общий для формы и для сервера, как events.ts: форма берёт отсюда
// проверку адреса, чтобы подсказать человеку ошибку до отправки, а сервер -
// ту же проверку, чтобы не верить форме на слово. Адрес /api/pochta открыт
// всему интернету.

import { typePriority, type TypeCode } from "@/data/questions";

export type Zayavka = {
  email: string;
  resultType: TypeCode;
  // Вторая галочка - согласие на рассылку. По желанию: разбор уходит и без
  // неё. Решение 4а плана формы почты.
  rassylka: boolean;
  // Номер прохождения - только для анонимной статистики «оставил почту».
  // Необязателен: без него письмо всё равно уйдёт.
  runId: string | null;
};

// Что может быть не так. Форма показывает человеку своё сообщение на каждый
// случай, поэтому причины различаются - в отличие от /api/events, где ответ
// на мусор одинаковый. Здесь подсказка нужна живому человеку, а подбирать
// через неё нечего.
export type OshibkaZayavki = "format" | "adres" | "soglasie" | "tip";

// Похоже ли на адрес почты. Проверка намеренно простая: что-то, собака,
// что-то, точка, хотя бы две буквы. Строгие проверки по стандарту отсекают
// настоящие адреса чаще, чем ловят опечатки, - точно адрес проверит только
// письмо, которое на него придёт.
const pohozheNaAdres = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 254 - предел длины адреса по стандарту почты. Ограничение сверху нужно и
// для безопасности: без него на сервер можно прислать строку любой длины.
const maksDlinaAdresa = 254;

const runIdPattern = /^[a-z0-9]{8,40}$/;

export function normalizovatAdres(adres: string): string {
  return adres.trim().toLowerCase();
}

export function adresVPoryadke(adres: string): boolean {
  return adres.length <= maksDlinaAdresa && pohozheNaAdres.test(adres);
}

export function parseZayavka(
  raw: unknown,
): { zayavka: Zayavka } | { oshibka: OshibkaZayavki } {
  if (typeof raw !== "object" || raw === null) return { oshibka: "format" };
  const data = raw as Record<string, unknown>;

  if (typeof data.email !== "string") return { oshibka: "adres" };
  const email = normalizovatAdres(data.email);
  if (!adresVPoryadke(email)) return { oshibka: "adres" };

  // Первая галочка обязательна, и только настоящее true считается согласием:
  // строка "true", единица или отсутствие поля - нет. Согласие не
  // додумывается.
  if (data.soglasie !== true) return { oshibka: "soglasie" };

  const resultType = data.resultType;
  if (
    typeof resultType !== "string" ||
    !typePriority.includes(resultType as TypeCode)
  ) {
    return { oshibka: "tip" };
  }

  // Согласие на рассылку - тоже только настоящее true. Всё прочее - «нет».
  const rassylka = data.rassylka === true;

  const runId =
    typeof data.runId === "string" && runIdPattern.test(data.runId)
      ? data.runId
      : null;

  return {
    zayavka: { email, resultType: resultType as TypeCode, rassylka, runId },
  };
}
