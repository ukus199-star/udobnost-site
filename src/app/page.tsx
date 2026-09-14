// Экран прохождения теста.
//
// "use client" - обязательная первая строка. По умолчанию страницы в Next.js
// собираются на сервере и приезжают в браузер готовым текстом: быстро, но
// мертво - никаких нажатий. Эта строка говорит: страницу нужно оживить в
// браузере, потому что она должна реагировать на человека и что-то помнить.
"use client";

import { useEffect, useRef, useState } from "react";
import {
  questions,
  typePriority,
  boundaryThreshold,
  type Option,
  type TypeCode,
} from "@/data/questions";
import { resultTexts } from "@/data/results";
import type { TestEvent } from "@/lib/events";
import { Granica } from "@/components/granica";
import {
  DLITELNOST_UKHODA,
  Slova,
  schitatSlova,
  shagZaderzhki,
} from "@/components/slova";

/**
 * Номер прохождения. Две случайные строки подряд - около двадцати знаков из
 * букв и цифр.
 *
 * Он не секретный и никого не опознаёт: нужен только чтобы события одного
 * прохождения можно было сложить вместе. Живёт в памяти вкладки - обновил
 * страницу, и номер другой.
 */
function makeRunId(): string {
  const half = () => Math.random().toString(36).slice(2);
  return (half() + half()).slice(0, 40);
}

/**
 * Отправить событие на сервер.
 *
 * Ответа не ждём и ошибку глотаем молча - в этом весь смысл. Статистика
 * второстепенна по отношению к тому, ради чего человек пришёл: упади сеть,
 * ляг база - он не должен ни заметить, ни застрять.
 *
 * keepalive говорит браузеру доставить отправленное, даже если страницу
 * закрывают прямо сейчас. Без него последнее событие терялось бы чаще всего.
 */
function sendEvent(event: TestEvent): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // Намеренно пусто.
  });
}

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

  // Номер этого прохождения. Пустая строка до нажатия «Начать».
  // useRef, а не useState: на экране от него ничего не зависит.
  const runId = useRef("");

  // Отправляли ли уже событие результата. Без этого человек, вернувшийся
  // кнопкой «Назад» и снова дошедший до конца, посчитался бы дважды.
  const resultSent = useRef(false);

  // Раскрыт ли блок «Подробнее о тесте» на первом экране. По умолчанию
  // свёрнут - решение владелицы 14.09.2026: объяснение не должно забирать
  // внимание у заголовка, срока и кнопки.
  const [podrobnee, setPodrobnee] = useState(false);

  // Идёт ли переход между вопросами - слова текущего вопроса разлетаются.
  // Пока идёт, нажатия не принимаются, а следующий вопрос ещё не показан.
  //
  // Храним дважды. Состояние - чтобы экран получил класс разлёта. Ссылка -
  // чтобы проверка в обработчике нажатия видела перемену сразу, а не после
  // перерисовки: два быстрых нажатия - два разных события.
  const [perehod, setPerehod] = useState(false);
  const idetPerehod = useRef(false);
  const taymerPerehoda = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Кнопка «назад» браузера и жест назад на телефоне - просьба владелицы
  // 14.09.2026: человек, нажавший «Начать тест», должен суметь вернуться на
  // стартовую страницу, а не вылететь с сайта.
  //
  // Почему вылетал. Экраны теста переключаются внутри одной страницы, адрес
  // при этом не менялся, и браузер не знал, что человек куда-то перешёл. Его
  // «назад» вёл туда, откуда человек пришёл на сайт.
  //
  // Как теперь. При входе в тест в историю браузера записывается шаг: к
  // адресу добавляется ?shag=test. «Назад» снимает этот шаг, браузер
  // сообщает об этом событием popstate, и мы показываем стартовую страницу.
  // Next.js такую запись в историю поддерживает штатно - проверено по его
  // документации в node_modules, раздел «Native History API».
  //
  // «Вперёд» работает так же в обратную сторону, но только если тест уже был
  // начат в этой вкладке: после обновления страницы ответов в памяти нет,
  // и показывать нечего.
  useEffect(() => {
    function priSmeneShaga() {
      // Нажали «назад», пока слова разлетались: переход отменяется, иначе
      // таймер через треть секунды переключил бы вопрос уже на стартовой.
      if (taymerPerehoda.current) {
        clearTimeout(taymerPerehoda.current);
        taymerPerehoda.current = null;
      }
      idetPerehod.current = false;
      setPerehod(false);

      const vTeste =
        new URLSearchParams(window.location.search).get("shag") === "test";
      setStarted(vTeste && shuffledOptions.length > 0);
    }
    window.addEventListener("popstate", priSmeneShaga);
    return () => window.removeEventListener("popstate", priSmeneShaga);
  }, [shuffledOptions.length]);

  // Страницу обновили, стоя в тесте: в адресе осталась метка ?shag=test, а
  // ответов в памяти уже нет. Убираем метку, чтобы адрес не обещал того, чего
  // нет на экране. replaceState, а не pushState: лишний шаг в истории не нужен.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shag") === "test") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function start() {
    // Тест уже начат в этой вкладке, человек вернулся на стартовую и нажал
    // кнопку снова - продолжаем, а не начинаем заново. Ответы остаются,
    // порядок вариантов не перемешивается повторно, номер прохождения прежний.
    //
    // Событие «старт» тоже не отправляем второй раз: иначе в статистике одно
    // прохождение выглядело бы как брошенное плюс новое.
    const uzheNachat = shuffledOptions.length > 0;
    if (!uzheNachat) {
      const id = makeRunId();
      runId.current = id;
      setShuffledOptions(questions.map((question) => shuffle(question.options)));
      sendEvent({ runId: id, kind: "start" });
    }
    setStarted(true);
    window.history.pushState(null, "", "?shag=test");
  }

  // Ссылка «На стартовую страницу» на экранах вопроса и результата. Не
  // переключает экран сама, а делает то же, что кнопка «назад» браузера:
  // так история остаётся честной, и «вперёд» после неё вернёт в тест.
  function naStartovuyu() {
    window.history.back();
  }

  // Переход к другому вопросу: сначала слова текущего разлетаются, потом
  // показывается новый. primenit - что сделать, когда разлёт закончится:
  // перейти вперёд или назад.
  //
  // Время ожидания считается из тех же чисел, что анимация в globals.css:
  // разлёт одного слова плюс волна по всем словам экрана. Выходит не больше
  // 280 мс, а вместе с перерисовкой - около 335: замерено в Chrome.
  //
  // У кого в системе выключены анимации - переход мгновенный. Это не
  // вежливость: при вестибулярных нарушениях движение вызывает тошноту.
  function perehodK(primenit: () => void) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      primenit();
      return;
    }

    const variantyNaEkrane = shuffledOptions[current] ?? [];
    const vsegoSlov =
      schitatSlova(questions[current].situation) +
      variantyNaEkrane.reduce((summa, v) => summa + schitatSlova(v.text), 0);
    const vremya =
      DLITELNOST_UKHODA + shagZaderzhki(vsegoSlov) * Math.max(0, vsegoSlov - 1);

    idetPerehod.current = true;
    setPerehod(true);
    taymerPerehoda.current = setTimeout(() => {
      taymerPerehoda.current = null;
      idetPerehod.current = false;
      setPerehod(false);
      primenit();
    }, vremya);
  }

  // clickedAt - время самого клика, оно приходит вместе с событием. Спрашивать
  // время у системы здесь нельзя: React требует, чтобы внутри компонента не было
  // ничего, что возвращает разное при каждом вызове.
  function choose(type: TypeCode, clickedAt: number) {
    // Слова ещё разлетаются - нажатие по уходящему вопросу не считается.
    if (idetPerehod.current) return;

    // Треть секунды. Прочитать ситуацию и осознанно выбрать быстрее нельзя,
    // поэтому всё, что приходит раньше, - промах пальцем, а не ответ.
    //
    // С переходом эти 350 мс согласованы: разлёт длится до 280 мс, и
    // случайное второе касание сразу после появления нового вопроса тоже
    // отсекается.
    if (clickedAt - lastAnswerAt.current < 350) return;
    lastAnswerAt.current = clickedAt;

    // Массив не меняем на месте, а делаем новый с одной изменённой ячейкой.
    // React сравнивает старое значение с новым по ссылке: если подправить
    // существующий массив, ссылка останется прежней, и перерисовки не будет.
    //
    // Ответ записывается сразу, а вопрос переключается после разлёта: пока
    // слова уходят, выбранная карточка уже подсвечена - человек видит, что
    // нажатие принято.
    const next = [...answers];
    next[current] = type;
    setAnswers(next);
    perehodK(() => setCurrent(current + 1));

    // Номер вопроса отправляем от единицы - так же, как его видит человек.
    // Какой именно вариант выбран, не отправляем: нам важно, докуда дошли,
    // а не что ответили. Ответы на конкретные вопросы - уже не статистика.
    sendEvent({
      runId: runId.current,
      kind: "answer",
      questionNumber: current + 1,
    });

    // Ответ на последний вопрос и есть момент, когда человек увидит результат.
    // Считаем его здесь, по свежему массиву next: значение в answers обновится
    // только к следующей отрисовке.
    const isLastQuestion = current + 1 >= questions.length;
    if (!isLastQuestion || resultSent.current) return;

    const screen = scoreAnswers(next);
    if (screen === null) return;

    resultSent.current = true;
    sendEvent({
      runId: runId.current,
      kind: "result",
      resultType: screen,
      boundaryCount: next.filter((answer) => answer === "boundary").length,
    });
  }

  function goBack() {
    if (idetPerehod.current) return;
    perehodK(() => setCurrent(current - 1));
  }

  // ─── Экран 1. Приветствие ───────────────────────────────────────────────
  //
  // Устройство экрана взято у теста на slozhno.live («Всё сложно») - референс
  // владелицы 14.09.2026. Экран разделён на две зоны цветом фона, а не
  // рамками:
  //
  //   1. тонированная полоса - о чём тест: рисунок, заголовок, данные о тесте;
  //   2. светлая зона - что делать: подробности, кнопка, сноска.
  //
  // Граница зон проходит там, где меняется фон, и глаз сразу видит, где «про
  // что», а где «что делать». Картинка у референса своя и нам не нужна -
  // взято только устройство.
  //
  // Что у референса иначе и оставлено по прежним решениям владелицы: у них всё
  // по левому краю, у нас по центру; у них описание открыто, у нас свёрнуто в
  // «Подробнее о тесте».
  //
  // Экран выровнен по верху, а не по центру высоты: при раскрытии «Подробнее»
  // верхняя зона остаётся на месте, вниз уходит только то, что под блоком.
  //
  // Блоки появляются по очереди, с шагом 70 мс. Шаг маленький намеренно:
  // это не представление, а ощущение, что страница собирается спокойно,
  // а не выпрыгивает целиком.
  if (!started) {
    return (
      <main className="flex min-h-screen flex-col bg-poverhnost">
        {/* ── Зона 1: о чём тест ─────────────────────────────────────────── */}
        <section className="bg-akcent-myagkiy px-6 pb-12 pt-12 sm:pt-16">
          <div className="mx-auto w-full max-w-chtenie text-center">
            {/* Рисунок на скруглённой плашке, слегка повёрнутой, - как у
                референса, но с мягкими углами вместо острых: мотив «мягкая
                форма, ясная граница». Сам рисунок повёрнут обратно, чтобы
                стоял ровно, а наклонённой читалась только плашка.

                Край плашки держит тень ten-myagkaya, а не цвет: плашка и
                полоса близки по тону, в тёмной теме их различимость всего
                1.19, и без тени плашка растворилась бы. Рисунок сам скрыт от
                экранного диктора - см. components/granica.tsx. */}
            <div className="animate-proyavlenie mx-auto mb-10 w-fit">
              <div className="ten-myagkaya -rotate-2 rounded-myagkiy bg-poverhnost px-8 py-6">
                <Granica className="block h-auto w-52 rotate-2 sm:w-60" />
              </div>
            </div>

            {/* Заголовок - правки владелицы 14.09.2026: без слова «тест» и
                крупно. text-balance выравнивает длину строк при переносе. */}
            <h1
              className="animate-proyavlenie text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
              style={{ animationDelay: "70ms" }}
            >
              Узнайте, насколько вы удобны
            </h1>

            {/* Данные о тесте - как у референса: мелкая подпись, под ней
                значение, в две колонки, без иконок. Подписи строчными: это
                справка, а не заголовки.

                Число вопросов не вписано цифрой, а берётся из списка вопросов:
                добавится тринадцатый - поменяется само. Правило репо номер 1.

                dl - список «название: значение». Экранный диктор так его и
                зачитает: «на прохождение - 3 минуты». */}
            <dl
              className="animate-proyavlenie mx-auto mt-10 grid max-w-xs grid-cols-2 gap-6"
              style={{ animationDelay: "140ms" }}
            >
              <div>
                <dt className="text-sm text-priglushennyy">на прохождение</dt>
                <dd className="mt-1 text-lg font-medium text-tekst">3 минуты</dd>
              </div>
              <div>
                <dt className="text-sm text-priglushennyy">вопросов</dt>
                <dd className="mt-1 text-lg font-medium text-tekst">
                  {questions.length}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ── Зона 2: что делать ─────────────────────────────────────────── */}
        <section className="px-6 pb-16 pt-8">
          <div className="mx-auto w-full max-w-chtenie text-center">
            {/* «Подробнее о тесте» - свёрнутый блок. Решения владелицы
                14.09.2026: объяснение не должно забирать внимание у
                заголовка, данных и кнопки и стоит перед кнопкой.

                Раскрывается только нажатием - и на телефоне, и на компьютере.
                Предпросмотр при наведении мыши был и убран намеренно: блок
                стоит над кнопкой и, раскрываясь, сдвигает её вниз. Мышь,
                идущая от ссылки к кнопке, выходила бы из блока, он схлопывался,
                кнопка прыгала обратно под курсор - и всё дёргалось по кругу.

                Высота анимируется через grid-template-rows от 0fr к 1fr.
                Высоту «auto» напрямую анимировать нельзя, а строку сетки -
                можно, и без подсчёта высоты в JavaScript. */}
            <div
              className="animate-proyavlenie"
              style={{ animationDelay: "210ms" }}
            >
              <button
                type="button"
                aria-expanded={podrobnee}
                aria-controls="podrobnee-o-teste"
                onClick={() => setPodrobnee(!podrobnee)}
                className="group inline-flex items-center gap-1.5 rounded-myagkiy px-3 py-2 text-sm font-medium text-akcent transition-colors duration-200 hover:text-akcent-naveden"
              >
                Подробнее о тесте
                {/* Стрелка разворачивается, когда блок открыт. При наведении
                    чуть опускается - подсказка, что здесь что-то раскроется. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className={`size-4 fill-none stroke-current transition-transform duration-300 ${
                    podrobnee ? "rotate-180" : "group-hover:translate-y-0.5"
                  }`}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>

              <div
                id="podrobnee-o-teste"
                aria-hidden={!podrobnee}
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  podrobnee ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                {/* overflow-hidden прячет текст, пока строка сетки нулевая.
                    Отступы внутри - запас для тени блока: без них её обрезало
                    бы по краю. */}
                <div className="overflow-hidden">
                  <div className="px-3 pb-6 pt-3 sm:px-4">
                    {/* Содержание продиктовано владелицей 14.09.2026. Две
                        формулировки сверены с документами проекта:
                        - удобность описана как выбор («выбираем комфорт
                          других»), а не как изъян. test-design.md: удобный
                          человек не чувствует себя больным, он чувствует себя
                          хорошим;
                        - происхождение названо «часто ещё в детстве», без
                          слова «родители». test-results.md: не обвинять
                          окружение - человек в такой момент защищает своих.
                        «Поможет определить» допустимо по voice/stop-words.md:
                        это участие, а не обещание результата. */}
                    <div className="ten-myagkaya rounded-myagkiy bg-poverhnost px-6 py-7 text-left sm:px-9">
                      <p className="text-base leading-relaxed text-priglushennyy">
                        Я подготовила для вас двенадцать вопросов о самых обычных
                        ситуациях.
                      </p>
                      <p className="mt-3 text-base leading-relaxed text-priglushennyy">
                        У каждого человека есть личные границы - место, где
                        заканчиваются наши желания, силы и время и начинаются
                        чужие.
                      </p>
                      <p className="mt-3 text-base leading-relaxed text-priglushennyy">
                        Удобность - это когда мы раз за разом выбираем комфорт
                        других людей, а не свой. Она складывается по разным
                        причинам, часто ещё в детстве, и у каждого устроена
                        по-своему.
                      </p>
                      {/* Итог - тёмным: это ответ на «зачем мне это
                          проходить», его должны дочитать. */}
                      <p className="mt-5 text-base font-medium leading-relaxed text-tekst">
                        Тест поможет вам определить, как устроена ваша удобность.
                      </p>
                      {/* Инструкция перенесена сюда из-под кнопки - решение
                          владелицы 14.09.2026. Она защищает от главного риска
                          теста из test-design.md - социальной желательности:
                          человек отвечает не как живёт, а как хотел бы. В
                          свёрнутом блоке её прочтут не все, поэтому в фазе 3
                          она повторится над первым вопросом, где выбор и
                          делается. */}
                      <p className="mt-3 text-sm leading-relaxed text-priglushennyy">
                        Выбирайте то, как вы поступаете на самом деле, а не то,
                        как было бы правильно.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Кнопка во всю ширину колонки и выше обычной - как у референса:
                это главное действие экрана, и по нему попадают не целясь.

                Отклик в три ступени. Навели - кнопка темнеет и приподнимается
                на точку. Нажали - вдавливается. Это важно для телефона:
                наведения там нет, и нажатие - единственный отклик, который
                увидят. */}
            <button
              onClick={start}
              style={{ animationDelay: "280ms" }}
              className="animate-proyavlenie mt-6 block w-full rounded-myagkiy bg-akcent px-8 py-4 text-base font-medium text-poverhnost shadow-sm transition duration-200 hover:-translate-y-px hover:bg-akcent-naveden hover:shadow-md active:translate-y-0 active:scale-[0.98] active:shadow-sm"
            >
              {/* Подпись зависит от того, был ли тест уже начат в этой
                  вкладке: человек, вернувшийся на стартовую, должен понимать,
                  что его ответы никуда не делись. */}
              {current >= questions.length
                ? "Посмотреть результат"
                : shuffledOptions.length > 0
                  ? "Продолжить тест"
                  : "Начать тест"}
            </button>

            {/* Сноска - просьба владелицы 14.09.2026. Видна всегда и не
                прячется под «Подробнее»: это оговорка о том, чем тест является,
                а чем нет, и её должен увидеть каждый, кто нажимает кнопку.

                Размер тот же, что у мелких подписей, - в шкале шести ступеней
                меньше не заводим. Отличается сноска отступом и узкой колонкой:
                стоит отдельно и не спорит с кнопкой за внимание. */}
            <p
              className="animate-proyavlenie mx-auto mt-8 max-w-sm text-sm leading-relaxed text-priglushennyy"
              style={{ animationDelay: "280ms" }}
            >
              Тест носит исключительно информационный характер и не является
              диагностикой. Для подробной диагностики обратитесь к специалисту.
            </p>
          </div>
        </section>
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
          <p className="text-priglushennyy">Считать нечего: ответов нет.</p>
        </main>
      );
    }

    const text = resultTexts[screen];

    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col p-6 py-12">
        {/* Ссылка на стартовую - см. naStartovuyu выше. */}
        <button
          type="button"
          onClick={naStartovuyu}
          className="mb-8 inline-flex items-center gap-1.5 self-start text-sm text-priglushennyy transition-colors duration-200 hover:text-tekst"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 fill-none stroke-current"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 4L6 8l4 4" />
          </svg>
          На стартовую страницу
        </button>

        {/* Блок 1 - результат. Про почту в нём ни слова: так решено в
            test-results.md. Блок 2 с полем ввода встанет ниже в фазе 4. */}
        <h2 className="text-xl font-semibold sm:text-2xl">{text.title}</h2>
        {text.paragraphs.map((paragraph, index) => (
          <p key={index} className="mt-4 text-priglushennyy">
            {paragraph}
          </p>
        ))}
      </main>
    );
  }

  // ─── Экран 2. Вопрос ────────────────────────────────────────────────────
  //
  // Фаза 3 плана дизайна. Двенадцать вопросов не должны утомлять: видно,
  // сколько осталось; варианты читаются с телефона одной рукой; выбранный
  // отличается однозначно.
  //
  // Экран выровнен по верху, а не по центру высоты: вопросы разной длины, и
  // при центрировании полоса прогресса прыгала бы вверх-вниз на каждом.
  const question = questions[current];
  const options = shuffledOptions[current];

  // Порядковый номер первого слова каждого варианта среди всех слов экрана -
  // сначала слова вопроса, потом вариантов по порядку. По нему считается
  // задержка: слова уходят и проявляются одной волной сверху вниз.
  const slovVoprosa = schitatSlova(question.situation);
  const nachalaVariantov: number[] = [];
  let schetSlov = slovVoprosa;
  for (const option of options) {
    nachalaVariantov.push(schetSlov);
    schetSlov += schitatSlova(option.text);
  }
  const shag = shagZaderzhki(schetSlov);

  return (
    <main className="min-h-screen bg-poverhnost px-6 pb-16 pt-8 sm:pt-12">
      <div className="mx-auto w-full max-w-chtenie">
        {/* Ссылка на стартовую - см. naStartovuyu выше. Тихая, чтобы не
            спорить с вопросом за внимание, но находимая: вверху, где её ищут. */}
        <button
          type="button"
          onClick={naStartovuyu}
          className="inline-flex items-center gap-1.5 text-sm text-priglushennyy transition-colors duration-200 hover:text-tekst"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4 fill-none stroke-current"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 4L6 8l4 4" />
          </svg>
          На стартовую страницу
        </button>

        {/* Прогресс: строка и полоса. Строка - точная цифра, полоса - чтобы
            «сколько осталось» читалось не глядя. Своего состояния не
            заводит: current помнит вопрос, questions.length знает, сколько
            их всего. Добавится тринадцатый - поедет сам.

            Полоса заполняется по отвеченным: на первом вопросе пуста, как у
            референса («прогресс 0%»). Ширина меняется плавно. */}
        <div className="mt-8">
          <p className="text-sm text-priglushennyy">
            Вопрос {current + 1} из {questions.length}
          </p>
          <div
            role="progressbar"
            aria-label="Пройдено вопросов"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={current}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-akcent-myagkiy"
          >
            <div
              className="h-full rounded-full bg-akcent transition-[width] duration-300 ease-out"
              style={{ width: `${(current / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Над первым вопросом - строка про честные ответы. На стартовой
            странице она спрятана в «Подробнее о тесте», и её прочтут не все,
            а это защита от главного риска теста из test-design.md -
            социальной желательности. Здесь её видит каждый, в момент, когда
            выбор и делается. Со второго вопроса уже не нужна. */}
        {current === 0 && (
          <p className="mt-6 text-sm leading-relaxed text-priglushennyy">
            Выбирайте то, как вы поступаете на самом деле, а не то, как было бы
            правильно.
          </p>
        )}

        {/* Вопрос и варианты - одним блоком, который разлетается при
            переходе.

            key={current}: у каждого вопроса свой блок. Сменился вопрос - React
            ставит новый блок, и его слова проявляются с нуля.

            razlet - слова уходят вразлёт, см. globals.css.
            pointer-events-none - по уходящим карточкам не нажать. */}
        <div
          key={current}
          className={perehod ? "razlet pointer-events-none" : undefined}
        >
          <h2 className="mt-6 text-lg font-medium leading-snug text-tekst sm:text-xl">
            <Slova tekst={question.situation} nachalo={0} shag={shag} />
          </h2>

          <div className="mt-6 flex flex-col gap-3">
            {options.map((option, i) => {
              const vybran = answers[current] === option.type;
              return (
                // key нужен React, чтобы отличать пункты списка друг от друга.
                // Берём тип ответа: в каждом вопросе он встречается ровно раз.
                //
                // Состояния карточки:
                // - обычное: светлый фон, граница палитры;
                // - наведение (только там, где есть мышь): граница оливковая,
                //   карточка приподнимается на 2 точки;
                // - нажатие: карточка вдавливается - отклик для пальца, на
                //   телефоне наведения нет, и это единственный отклик;
                // - выбранное: оливковая граница и фон плюс заполненный
                //   кружок слева. Отличается однозначно, а не оттенком.
                //
                // min-h-14 - 56 точек: по карточке попадают большим пальцем,
                // не целясь. Минимум по плану - 44.
                <button
                  key={option.type}
                  type="button"
                  aria-pressed={vybran}
                  onClick={(event) => choose(option.type, event.timeStamp)}
                  className={`group flex min-h-14 w-full items-center gap-3 rounded-myagkiy border px-4 py-3.5 text-left text-base leading-snug text-tekst transition duration-200 hover:-translate-y-0.5 hover:border-akcent hover:shadow-sm active:translate-y-0 active:scale-[0.99] active:shadow-none ${
                    vybran
                      ? "border-akcent bg-akcent-myagkiy"
                      : "border-granica bg-poverhnost"
                  }`}
                >
                  {/* Кружок выбора, как у референса. Сам по себе не кнопка -
                      смысл «выбрано» уже передан через aria-pressed. */}
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                      vybran
                        ? "border-akcent"
                        : "border-granica-yarkaya group-hover:border-akcent"
                    }`}
                  >
                    <span
                      className={`size-2.5 rounded-full bg-akcent transition-transform duration-200 ${
                        vybran ? "scale-100" : "scale-0"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <Slova
                      tekst={option.text}
                      nachalo={nachalaVariantov[i]}
                      shag={shag}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* «Предыдущий вопрос» - тихая, но находимая: мелко и серым, под
            вариантами, со стрелкой. На первом вопросе её нет - идти некуда,
            для стартовой есть ссылка вверху. */}
        {current > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-priglushennyy transition-colors duration-200 hover:text-tekst"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4 fill-none stroke-current"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 4L6 8l4 4" />
            </svg>
            Предыдущий вопрос
          </button>
        )}
      </div>
    </main>
  );
}
