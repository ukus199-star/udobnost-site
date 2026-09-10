// Адрес приёма событий: POST /api/events
//
// Это первое место в проекте, куда попадает что-то из внешнего мира. Адрес
// открыт всему интернету - на него может слать кто угодно и что угодно.
// Отсюда три правила, по которым он написан:
//
//   1. Ничему не верим: каждое поле проверяется в parseEvent.
//   2. Ничего не рассказываем: ответ всегда одинаковый, что бы ни пришло.
//      Разные ответы на разные ошибки - это подсказка тому, кто подбирает.
//   3. Ограничиваем поток: без этого таблицу можно засыпать мусором, а счёт
//      за базу вырастет.

import { parseEvent } from "@/lib/events";
import { insertEvent } from "@/lib/db";

// Ограничение частоты. Считаем в окнах по минуте.
//
// Ограничиваем по номеру прохождения, а не по адресу отправителя: адрес - это
// сведения о человеке, хранить их мы не собирались даже в памяти. Номер
// прохождения человека не выдаёт.
const windowMs = 60_000;

// Одно прохождение честно даёт 14 событий: старт, двенадцать ответов,
// результат. Тридцать - запас на возвраты кнопкой «Назад».
const maxPerRun = 30;

// Общий потолок на всех сразу. Сто прохождений в месяц - это примерно два в
// день, так что триста событий в минуту недостижимы при нормальной жизни и
// заметно ограничивают того, кто решит поразвлечься.
const maxPerMinute = 300;

// Счётчики живут в памяти процесса и обнуляются при перезапуске. Для нашей
// задачи этого хватает: цель не в строгом учёте, а в том, чтобы поток нельзя
// было сделать бесконечным.
let windowStartedAt = 0;
let totalInWindow = 0;
const perRun = new Map<string, number>();

function allow(runId: string, now: number): boolean {
  // Минута прошла - начинаем считать заново. Заодно очищается карта: без этого
  // она росла бы, пока не съела бы память.
  if (now - windowStartedAt >= windowMs) {
    windowStartedAt = now;
    totalInWindow = 0;
    perRun.clear();
  }

  if (totalInWindow >= maxPerMinute) return false;

  const forThisRun = perRun.get(runId) ?? 0;
  if (forThisRun >= maxPerRun) return false;

  totalInWindow += 1;
  perRun.set(runId, forThisRun + 1);
  return true;
}

// Ответ без содержимого. 204 значит «принято, показывать нечего».
// Один и тот же ответ и на удачу, и на мусор - см. правило 2 выше.
const accepted = new Response(null, { status: 204 });

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    // Пришло не JSON. Молча выбрасываем.
    return accepted;
  }

  const event = parseEvent(raw);
  if (event === null) return accepted;

  if (!allow(event.runId, Date.now())) return accepted;

  await insertEvent(event);
  return accepted;
}
