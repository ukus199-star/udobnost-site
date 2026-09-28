// Превратить письмо из data/pisma.ts в HTML, который уходит человеку.
//
// Письмо - продолжение сайта: тот же кремовый фон, та же белая карточка с
// заметной границей, тот же ритм заголовков и абзацев. Оценка владелицы
// 25.09.2026: «просто сырой текст без оформления, которое было бы
// продолжением дизайна сайта». План - plans/2026-09-25-oformlenie-pisem.md.
//
// Почему вёрстка выглядит устаревшей - это не небрежность, а требования среды:
//
//   - таблицы вместо современной раскладки: Outlook собирает письма движком
//     Word, и всё, кроме таблиц, там разъезжается;
//   - цвета и отступы вписаны в каждый элемент, а не в один общий стиль:
//     Gmail вырезает часть общих стилей, а атрибут style у элемента оставляет;
//   - свои шрифты не подключаются: почтовые программы их не загружают,
//     поэтому берём системный - у человека он уже есть;
//   - картинок нет вовсе: во многих программах они отключены, и письмо с
//     ними осталось бы набором пустых рамок.
//
// Тёмная тема: почтовые программы Apple и некоторые другие понимают
// prefers-color-scheme, поэтому для них указаны тёмные цвета. Gmail этот
// блок игнорирует и покажет светлое письмо - это допустимо, письмо остаётся
// читаемым, потому что все цвета заданы явно.

import type { Pismo } from "@/data/pisma";
import { TELEGRAM, SAYT, NIK_TELEGRAMA } from "@/lib/ssylki";

// Цвета сайта, значениями. В письме нельзя сослаться на переменные из
// globals.css - письмо уходит из нашего дома и живёт в чужом.
const CVETA = {
  fon: "#fbf9f4",
  poverhnost: "#fffefa",
  tekst: "#231f19",
  priglushennyy: "#635b4e",
  granica: "#c2bbab",
  akcent: "#5a6942",
} as const;

const SHRIFT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

// Экранировать всё, что могло бы стать разметкой. Тексты писем наши, но
// правило простое: в HTML ничего не попадает без экранирования.
function ekran(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// **жирный** и *курсив* внутри абзаца. Сначала двойные звёздочки, иначе
// одинарные съели бы их по половинке.
function razmetka(tekst: string): string {
  return ekran(tekst)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>");
}

// Абзац целиком в двойных звёздочках - подзаголовок раздела письма.
function podzagolovok(abzac: string): string | null {
  const m = abzac.match(/^\*\*([^*]+)\*\*$/);
  return m ? m[1] : null;
}

// Адрес телеграма стоит в письме дважды: кнопкой и видимым ником. Причина -
// 27.09.2026 нажатие на кнопку в Gmail приводило на страницу Google
// «Уведомление о переадресации»: Gmail заворачивает ссылки писем в свой
// редирект и при невысоком доверии к отправителю не перебрасывает сразу, а
// требует второго нажатия. Воспроизведено в браузере владелицы. Ник написан
// словом именно затем, чтобы его можно было ввести в поиск телеграма руками -
// тогда путь к записи не зависит ни от одного редиректа.
// Куда ведёт кнопка записи. Решение владелицы 25.09.2026: телеграм, путь в
// одно нажатие, и человек сразу виден ей.


// Хвост письма - приглашение на встречу - вынимается из общего текста и
// показывается карточкой: цена крупно, кнопка, запасной путь. Оценка
// владелицы 25.09.2026: «нужно указать текст про цену и возможность записи
// более масштабным шрифтом», «путь должен быть максимально простым».
function razdelitPismo(pismo: Pismo): {
  razbor: string[];
  priglashenie: string | null;
  cena: string | null;
  podpis: string | null;
} {
  const abzacy = [...pismo.abzacy];

  // Подпись - последний абзац целиком курсивом.
  const podpis =
    abzacy.length > 0 && /^\*[^*].*\*$/.test(abzacy[abzacy.length - 1])
      ? abzacy.pop()!.slice(1, -1)
      : null;

  const nachalo = abzacy.findIndex((a) => a.startsWith("Первая встреча"));
  if (nachalo === -1) return { razbor: abzacy, priglashenie: null, cena: null, podpis };

  const hvost = abzacy.splice(nachalo).join(" ");
  // Цена берётся из самого текста, а не пишется здесь второй раз: правило
  // репо номер 1, меняющиеся числа не хардкодим.
  const cena = hvost.match(/(\d[\d\s]{2,7})\s*рублей/)?.[1]?.trim() ?? null;
  // Из текста карточки убираем то, что теперь стоит крупно и на кнопке.
  const priglashenie = hvost
    .replace(/\s*50-60 минут,\s*\d[\d\s]*рублей\./, "")
    .replace(/\s*Ответить можно прямо на это письмо\./, "")
    // Заголовок карточки уже говорит «Первая встреча» - в тексте под ним эти
    // же слова читались как заикание.
    .replace(/^Первая встреча\s*-\s*/, "")
    .trim();

  return { razbor: abzacy, priglashenie, cena, podpis };
}

// Кнопка - обычная ссылка, а под ней строка с адресом словами.
//
// 28.09.2026 пробовали иначе: кнопку без тега ссылки, с адресом, написанным
// внутри неё, - расчёт был на то, что почтовая программа сама сделает адрес
// нажимаемым и обойдёт подмену ссылок сервисом рассылки. **Отвергнуто:** на
// компьютере Gmail адрес подсветил, а в телефоне нет, и кнопка там перестала
// работать вовсе. Плюс подсветку он красит по-своему, и выглядело это плохо.
//
// Поэтому кнопка вернулась к обычному виду, а страховкой служит строка под ней.
//
// Путей к записи три, и это не перестраховка: у читателей две зеркальные
// ситуации, и ни один путь не годится обоим (выяснено 28.09.2026 на двух
// телефонах).
//
//   - С VPN: сайт kustova-psy.ru не открывается (российский хостинг не пускает
//     зарубежные адреса), зато работает t.me. Для них - кнопка.
//   - Без VPN: наоборот, сайт открывается, а t.me заблокирован. Короткий адрес
//     kustova-psy.ru/tg им не поможет - он сам перенаправляет на t.me, то есть
//     упирается в ту же стену, поэтому из письма он убран 28.09.2026. Живёт он
//     теперь ради постов и диктовки голосом.
//   - Ник @ukusto работает у всех, у кого стоит приложение телеграма: оно не
//     зависит ни от сайта, ни от веб-адреса. Поэтому ник стоит первым.
//
// Пока сервис рассылки подменяет ссылки на `geteml.com`, кнопка не работает ни
// у кого, и живой остаётся только строка. Когда подмену отключат, кнопка
// заработает у читателей с VPN - это фаза 4 плана
// `plans/2026-09-28-ssylki-v-pismah.md`.
function kartochkaPriglasheniya(priglashenie: string, cena: string | null): string {
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px;">
              <tr>
                <td class="vrezka" style="background-color:#eef0e2;border:1px solid ${CVETA.granica};border-radius:14px;padding:24px 22px;">
                  <p class="tekst" style="margin:0 0 6px;font-family:${SHRIFT};font-size:17px;line-height:1.4;font-weight:600;color:${CVETA.tekst};">🌿 Первая встреча</p>
                  <p class="tekst" style="margin:0 0 14px;font-family:${SHRIFT};font-size:15px;line-height:1.55;color:${CVETA.tekst};">${razmetka(priglashenie.charAt(0).toUpperCase() + priglashenie.slice(1))}</p>
                  ${cena ? `<p class="tekst" style="margin:0 0 18px;font-family:${SHRIFT};font-size:24px;line-height:1.2;font-weight:600;color:${CVETA.tekst};">${ekran(cena)} ₽ <span style="font-size:15px;font-weight:400;">за встречу 50-60 минут</span></p>` : ""}
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
                    <tr>
                      <td align="center" style="background-color:${CVETA.akcent};border-radius:10px;">
                        <a href="${TELEGRAM}" style="display:inline-block;padding:14px 28px;font-family:${SHRIFT};font-size:16px;line-height:1.2;font-weight:600;color:#fffefa;text-decoration:none;">Записаться в телеграме</a>
                      </td>
                    </tr>
                  </table>
                  <p class="tihiy" style="margin:0;font-family:${SHRIFT};font-size:14px;line-height:1.5;color:${CVETA.priglushennyy};">Не открылось - найдите меня в телеграме: <span style="color:${CVETA.akcent};font-weight:600;">${NIK_TELEGRAMA}</span>. Можно просто ответить на это письмо.</p>
                </td>
              </tr>
            </table>`;
}

// Абзацы, идущие подряд под одним подзаголовком, - это раздел. Разделы
// чередуются фоном: кремовый, светло-зелёный, снова кремовый. Просьба
// владелицы 25.09.2026: «сделай разделение кремового и светло-зелёного фона
// в зависимости от абзаца, так будет эффектнее».
type Razdel = { zagolovok: string | null; abzacy: string[] };

function razbitNaRazdely(abzacy: string[]): Razdel[] {
  const razdely: Razdel[] = [];
  for (const abzac of abzacy) {
    const zag = podzagolovok(abzac);
    if (zag !== null) {
      razdely.push({ zagolovok: zag, abzacy: [] });
      continue;
    }
    if (razdely.length === 0) razdely.push({ zagolovok: null, abzacy: [] });
    razdely[razdely.length - 1].abzacy.push(abzac);
  }
  return razdely;
}

function vvodnayaChast(abzacy: string[]): string {
  // Вводные абзацы идут без карточки: рамка вокруг двух строк выглядела
  // пустой (оценка владелицы 25.09.2026).
  return abzacy
    .map((abzac) => `<p class="tekst" style="margin:0 0 16px;font-family:${SHRIFT};font-size:16px;line-height:1.6;color:${CVETA.tekst}">${razmetka(abzac)}</p>`)
    .join("\n");
}

// Строка «кто вы по результату» стоит после приветствия, а не под заголовком:
// сначала человек здоровается и понимает, что это за письмо, потом получает
// результат. Просьба владелицы 25.09.2026.
//
// Рамки и заливки у этого блока нет: 28.09.2026 владелица попросила убрать их,
// чтобы название типа стояло на общем фоне, как и текст над ним. Врезка делала
// на нём слишком сильный акцент для письма, которое и так всё про этот тип.
function strokaRezultata(tema: string): string {
  return `<p class="tihiy" style="margin:18px 0 2px;font-family:${SHRIFT};font-size:13px;line-height:1.3;letter-spacing:0.04em;text-transform:uppercase;color:${CVETA.priglushennyy};">Ваш результат</p>
              <p class="tekst" style="margin:0 0 20px;font-family:${SHRIFT};font-size:20px;line-height:1.3;font-weight:600;color:${CVETA.tekst};">${ekran(tema)}</p>`;
}

function teloPisma(abzacy: string[]): string {
  // Класс нужен каждому элементу отдельно: цвет стоит в самом элементе, а
  // правило на родителе его не перебивает - в тёмной теме текст оставался
  // тёмным на тёмном (проверено снимком 25.09.2026).
  return razbitNaRazdely(abzacy)
    .filter((razdel) => razdel.zagolovok !== null)
    .map((razdel, nomer) => {
      const zelyonyy = nomer % 2 === 1;
      const klass = zelyonyy ? "polosa-zelyonaya" : "polosa-kremovaya";
      const fon = zelyonyy ? "#eef0e2" : CVETA.fon;
      const zagolovok = razdel.zagolovok
        ? `<h2 class="tekst" style="margin:0 0 10px;font-family:${SHRIFT};font-size:19px;line-height:1.35;font-weight:600;color:${CVETA.tekst}">${ekran(razdel.zagolovok)}</h2>`
        : "";
      const tekst = razdel.abzacy
        .map((abzac, i, vse) => `<p class="tekst" style="margin:0 0 ${i === vse.length - 1 ? 0 : 16}px;font-family:${SHRIFT};font-size:16px;line-height:1.6;color:${CVETA.tekst}">${razmetka(abzac)}</p>`)
        .join("\n");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
                <tr>
                  <td class="${klass}" style="background-color:${fon};border-radius:12px;padding:22px 20px;">
${zagolovok}${tekst}
                  </td>
                </tr>
              </table>`;
    })
    .join("\n");
}

export function pismoVHtml(pismo: Pismo): string {
  const { razbor, priglashenie, cena, podpis } = razdelitPismo(pismo);
  // Всё до первого подзаголовка - вступление: «Здравствуйте» и одна фраза о
  // том, что это за письмо.
  const pervyyZagolovok = razbor.findIndex((a) => podzagolovok(a) !== null);
  const vvedenie = pervyyZagolovok === -1 ? razbor : razbor.slice(0, pervyyZagolovok);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${ekran(pismo.tema)}</title>
<style>
  /* Узкий экран: карточка занимает всю ширину, поля меньше. */
  @media only screen and (max-width:600px) {
    .obolochka { padding:16px 12px !important; }
    .kartochka { padding:24px 20px !important; border-radius:12px !important; }
    .zagolovok { font-size:22px !important; }
  }
  /* Тёмная тема почтовой программы. Понимают не все, и это нормально. */
  @media (prefers-color-scheme: dark) {
    .fon { background-color:#181613 !important; }
    .kartochka { background-color:#211e19 !important; border-color:#413c33 !important; }
    .zagolovok, .tekst { color:#ece8e0 !important; }
    .tihiy { color:#a29a8b !important; }
    .cherta { background-color:#413c33 !important; }
    .vrezka { background-color:#2a2e1f !important; border-color:#413c33 !important; }
    .polosa-kremovaya { background-color:#1f1c18 !important; }
    .polosa-zelyonaya { background-color:#2a2e1f !important; }
  }
</style>
</head>
<body class="fon" style="margin:0;padding:0;background-color:${CVETA.fon};">
<!-- Прехедер: короткая строка, которую почтовая программа показывает в
     списке писем рядом с темой. Скрыт от глаз внутри письма. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Разбор вашего результата теста «Насколько вы удобны».</div>
<table role="presentation" class="fon" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CVETA.fon};">
  <tr>
    <td class="obolochka" align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
        <tr>
          <td class="kartochka" style="background-color:${CVETA.poverhnost};border:1px solid ${CVETA.granica};border-radius:16px;padding:36px 32px;">
            <h1 class="zagolovok" style="margin:0 0 18px;font-family:${SHRIFT};font-size:25px;line-height:1.25;font-weight:600;color:${CVETA.tekst};">Результаты теста: подробный разбор</h1>
            <div>
${vvodnayaChast(vvedenie)}
            </div>
            ${strokaRezultata(pismo.tema)}
            <div>
${teloPisma(razbor)}
            </div>${priglashenie ? kartochkaPriglasheniya(priglashenie, cena) : ""}${podpis ? `
            <p class="tihiy" style="margin:22px 0 0;font-family:${SHRIFT};font-size:15px;line-height:1.5;font-style:italic;color:${CVETA.priglushennyy};">${ekran(podpis)}</p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;">
            <p class="tihiy" style="margin:0;font-family:${SHRIFT};font-size:13px;line-height:1.5;color:${CVETA.priglushennyy};">
              Письмо пришло, потому что вы прошли тест на <span style="color:${CVETA.akcent};">${SAYT.replace("https://", "")}</span> и попросили разбор.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
