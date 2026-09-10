// Что такое событие прохождения и как отличить настоящее от мусора.
//
// Этот файл общий для страницы и для сервера, поэтому в нём нет ничего от
// базы данных: только описание формы события и проверка. Библиотека pg живёт
// в db.ts и в браузер не попадает.
//
// Адрес приёма событий открыт всему интернету - туда может прийти что угодно.
// Поэтому доверия к содержимому нет: каждое поле проверяется по отдельности,
// всё непонятное отбрасывается молча, без объяснений отправителю.

import { questions, typePriority, type TypeCode } from "@/data/questions";

// Три момента прохождения, которые мы записываем.
//
// start  - человек нажал «Начать»
// answer - ответил на вопрос с таким-то номером
// result - дошёл до результата
export const eventKinds = ["start", "answer", "result"] as const;
export type EventKind = (typeof eventKinds)[number];

export type TestEvent = {
  // Номер прохождения. Придумывается в браузере, живёт в памяти вкладки,
  // ни с какой личностью не связан. Нужен только чтобы сложить события
  // одного прохождения вместе.
  runId: string;
  kind: EventKind;
  // Только у answer. Считается от единицы, как видит человек.
  questionNumber?: number;
  // Только у result.
  resultType?: TypeCode;
  boundaryCount?: number;
};

// Длина номера прохождения. Ограничение сверху важнее, чем кажется: без него
// в базу можно положить строку любой длины и раздуть таблицу.
const runIdPattern = /^[a-z0-9]{8,40}$/;

/**
 * Проверить пришедшее снаружи. Возвращает событие, если всё в порядке, и null,
 * если хоть что-то не сходится.
 *
 * Проверяется каждое поле, а не только наличие: «answer» без номера вопроса,
 * номер вопроса тринадцатый при двенадцати вопросах, выдуманный тип результата
 * - всё это отбрасывается. Лишние поля не переносятся: в базу уходит только то,
 * что перечислено здесь.
 */
export function parseEvent(raw: unknown): TestEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const runId = data.runId;
  if (typeof runId !== "string" || !runIdPattern.test(runId)) return null;

  const kind = data.kind;
  if (typeof kind !== "string") return null;
  if (!eventKinds.includes(kind as EventKind)) return null;

  if (kind === "start") {
    return { runId, kind: "start" };
  }

  if (kind === "answer") {
    const questionNumber = data.questionNumber;
    if (!isWholeNumber(questionNumber)) return null;
    if (questionNumber < 1 || questionNumber > questions.length) return null;
    return { runId, kind: "answer", questionNumber };
  }

  // Остался result.
  const resultType = data.resultType;
  if (typeof resultType !== "string") return null;
  if (!typePriority.includes(resultType as TypeCode)) return null;

  const boundaryCount = data.boundaryCount;
  if (!isWholeNumber(boundaryCount)) return null;
  if (boundaryCount < 0 || boundaryCount > questions.length) return null;

  return {
    runId,
    kind: "result",
    resultType: resultType as TypeCode,
    boundaryCount,
  };
}

// Целое число и ничего кроме. typeof number пропускает дробные, бесконечность
// и NaN - для номера вопроса всё это бессмыслица.
function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
