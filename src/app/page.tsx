// Экран прохождения теста.
//
// "use client" - обязательная первая строка. По умолчанию страницы в Next.js
// собираются на сервере и приезжают в браузер готовым текстом: быстро, но
// мертво - никаких нажатий. Эта строка говорит: страницу нужно оживить в
// браузере, потому что она должна реагировать на человека и что-то помнить.
"use client";

import { useRef, useState } from "react";
import {
  questions,
  typePriority,
  boundaryThreshold,
  type Option,
  type TypeCode,
} from "@/data/questions";
import { resultTexts } from "@/data/results";

/**
 * Перемешать список. Алгоритм Фишера-Йетса: идём с конца и меняем каждый
 * элемент со случайным из тех, что левее. Все порядки получаются одинаково
 * вероятными - в отличие от наивного sort со случайным сравнением, который
 * даёт заметный перекос.
 *
 * Зачем это нужно: если вариант «своя граница» всегда стоит последним,
 * люди начинают выбирать по месту в списке, а не по смыслу.
 * См. test-design.md, раздел «Что учесть при сборке».
 */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Посчитать результат. Правило целиком - в test-design.md, раздел «Как
 * считается результат». Здесь оно же в двух шагах:
 *
 *   1. сколько раз выбрана «своя граница». Дотянуло до порога - пятый экран;
 *   2. иначе - самый частый среди четырёх типов, без учёта границы.
 *
 * Возвращает null, если считать не из чего: ни одного ответа не дано. В обычном
 * прохождении так не бывает, но экран не должен от этого падать.
 */
function scoreAnswers(answers: (TypeCode | null)[]): TypeCode | null {
  // Сколько раз выбран каждый вариант. Пустые ячейки пропускаем: ответ, которого
  // нет, - это отсутствие голоса, а не голос за шестой тип.
  const counts = new Map<TypeCode, number>();
  for (const answer of answers) {
    if (answer === null) continue;
    counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  // Шаг 1. Выборов «своей границы» набралось на порог - пятый экран.
  const boundaryCount = counts.get("boundary") ?? 0;
  if (boundaryCount >= boundaryThreshold) return "boundary";

  // Шаг 2. Иначе - самый частый среди четырёх типов.
  return leadingType(counts);
}

/**
 * Самый частый среди ЧЕТЫРЁХ типов, «своя граница» не участвует.
 *
 * Ничья разрешается сама собой, без отдельной проверки: идём по typePriority
 * сверху вниз и меняем лидера только при строго большем числе. Значит при
 * равенстве лидером остаётся тот, кто встретился раньше, то есть стоит выше
 * в списке приоритета.
 */
function leadingType(counts: Map<TypeCode, number>): TypeCode | null {
  let leader: TypeCode | null = null;
  let leaderCount = 0;
  for (const type of typePriority) {
    if (type === "boundary") continue;
    const count = counts.get(type) ?? 0;
    if (count > leaderCount) {
      leader = type;
      leaderCount = count;
    }
  }
  return leader;
}

export default function Home() {
  // useState - это память страницы. Каждый вызов даёт две вещи: текущее
  // значение и способ его изменить. Меняем значение - страница
  // перерисовывается сама, руками ничего обновлять не надо.

  // Начат ли тест. Пока false - показываем приветствие.
  const [started, setStarted] = useState(false);

  // Номер вопроса на экране. Считаем с нуля, как принято в списках.
  // Значение 12 (столько же, сколько вопросов) означает «вопросы кончились».
  const [current, setCurrent] = useState(0);

  // Ответы. Ячейка на каждый вопрос, null - «ещё не отвечено».
  // Массив создаём заранее целиком, чтобы ответ на седьмой вопрос лёг
  // именно в седьмую ячейку, даже если на пятый ответа ещё нет.
  const [answers, setAnswers] = useState<(TypeCode | null)[]>(() =>
    questions.map(() => null),
  );

  // Перемешанные варианты, свой порядок для каждого вопроса.
  //
  // Почему перемешиваем не сразу, а по нажатию «Начать»: страница сначала
  // собирается на сервере, потом оживает в браузере. Случайные числа там и
  // там выпадут разные, и React пожалуется, что видит не то, что ожидал.
  // После нажатия сервера в этой истории уже нет, и проблема не возникает.
  const [shuffledOptions, setShuffledOptions] = useState<Option[][]>([]);

  // Время последнего ответа. Нужно, чтобы отсеять двойное нажатие: два быстрых
  // клика - это два разных события, между ними React успевает показать следующий
  // вопрос, и второй клик попадает по кнопке, оказавшейся под пальцем. Человек
  // хотел ответить один раз, а отвечает дважды, причём второй ответ случайный:
  // варианты перемешаны.
  //
  // useRef, а не useState: от этого значения ничего на экране не зависит, а
  // useState заставлял бы страницу перерисовываться лишний раз на каждый ответ.
  const lastAnswerAt = useRef(0);

  function start() {
    setShuffledOptions(questions.map((question) => shuffle(question.options)));
    setStarted(true);
  }

  // clickedAt - время самого клика, оно приходит вместе с событием. Спрашивать
  // время у системы здесь нельзя: React требует, чтобы внутри компонента не было
  // ничего, что возвращает разное при каждом вызове.
  function choose(type: TypeCode, clickedAt: number) {
    // Треть секунды. Прочитать ситуацию и осознанно выбрать быстрее нельзя,
    // поэтому всё, что приходит раньше, - промах пальцем, а не ответ.
    if (clickedAt - lastAnswerAt.current < 350) return;
    lastAnswerAt.current = clickedAt;

    // Массив не меняем на месте, а делаем новый с одной изменённой ячейкой.
    // React сравнивает старое значение с новым по ссылке: если подправить
    // существующий массив, ссылка останется прежней, и перерисовки не будет.
    const next = [...answers];
    next[current] = type;
    setAnswers(next);
    setCurrent(current + 1);
  }

  function goBack() {
    setCurrent(current - 1);
  }

  // ─── Экран 1. Приветствие ───────────────────────────────────────────────
  if (!started) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Насколько вы удобны
        </h1>
        <p className="mt-4 text-zinc-600">
          Двенадцать обычных ситуаций. В каждой выберите то, что ближе к тому,
          как вы поступаете на самом деле, а не к тому, как считаете правильным.
        </p>
        <button
          onClick={start}
          className="mt-8 rounded-lg bg-zinc-900 px-6 py-3 text-white transition hover:bg-zinc-700"
        >
          Начать
        </button>
      </main>
    );
  }

  // ─── Экран 3. Результат ─────────────────────────────────────────────────
  //
  // Результат считается заново при каждой отрисовке, а не запоминается: человек
  // может вернуться «Назад» и сменить ответ, и запомненный результат остался бы
  // старым. Тот же приём, что у счётчика прогресса ниже.
  //
  // Экран не центрируется по вертикали, в отличие от двух других: текст здесь
  // длинный, и центрирование увело бы его начало выше видимой области.
  if (current >= questions.length) {
    const screen = scoreAnswers(answers);
    if (screen === null) {
      return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
          <p className="text-zinc-600">Считать нечего: ответов нет.</p>
        </main>
      );
    }

    const text = resultTexts[screen];

    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col p-6 py-12">
        {/* Блок 1 - результат. Про почту в нём ни слова: так решено в
            test-results.md. Блок 2 с полем ввода встанет ниже в фазе 4. */}
        <h2 className="text-xl font-semibold sm:text-2xl">{text.title}</h2>
        {text.paragraphs.map((paragraph, index) => (
          <p key={index} className="mt-4 text-zinc-600">
            {paragraph}
          </p>
        ))}
      </main>
    );
  }

  // ─── Экран 2. Вопрос ────────────────────────────────────────────────────
  const question = questions[current];
  const options = shuffledOptions[current];

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
      {/* Прогресс. Своего useState не заводит: оба числа уже есть - current
          помнит текущий вопрос, questions.length знает, сколько их всего.
          Отсюда два следствия. Кнопка «Назад» отматывает счётчик сама, потому
          что она меняет current. И общее число не написано цифрой: добавится
          тринадцатый вопрос - строка поедет следом, править её не придётся.

          current + 1 потому, что внутри счёт идёт с нуля, а человеку привычно
          с единицы. */}
      <p className="text-sm text-zinc-500">
        Вопрос {current + 1} из {questions.length}
      </p>

      <p className="mt-3 text-lg font-medium sm:text-xl">{question.situation}</p>

      <div className="mt-6 flex flex-col gap-3">
        {options.map((option) => (
          // key нужен React, чтобы отличать пункты списка друг от друга.
          // Берём тип ответа: в каждом вопросе он встречается ровно один раз.
          <button
            key={option.type}
            onClick={(event) => choose(option.type, event.timeStamp)}
            className={`rounded-lg border p-4 text-left transition hover:border-zinc-900 ${
              answers[current] === option.type
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200"
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>

      {current > 0 && (
        <button
          onClick={goBack}
          className="mt-6 self-start text-sm text-zinc-500 underline"
        >
          Назад
        </button>
      )}
    </main>
  );
}
