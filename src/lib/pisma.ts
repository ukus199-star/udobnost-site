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

function teloPisma(pismo: Pismo): string {
  return pismo.abzacy
    .map((abzac) => {
      // Класс нужен каждому элементу отдельно: цвет стоит в самом элементе,
      // а правило на родителе его не перебивает - в тёмной теме текст
      // оставался тёмным на тёмном (проверено снимком 25.09.2026).
      const zag = podzagolovok(abzac);
      if (zag !== null) {
        return `<h2 class="tekst" style="margin:32px 0 10px;font-family:${SHRIFT};font-size:19px;line-height:1.35;font-weight:600;color:${CVETA.tekst}">${ekran(zag)}</h2>`;
      }
      return `<p class="tekst" style="margin:0 0 16px;font-family:${SHRIFT};font-size:16px;line-height:1.6;color:${CVETA.tekst}">${razmetka(abzac)}</p>`;
    })
    .join("\n");
}

export function pismoVHtml(pismo: Pismo): string {
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
            <h1 class="zagolovok" style="margin:0 0 20px;font-family:${SHRIFT};font-size:25px;line-height:1.25;font-weight:600;color:${CVETA.tekst};">${ekran(pismo.tema)}</h1>
            <div>
${teloPisma(pismo)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;">
            <p class="tihiy" style="margin:0;font-family:${SHRIFT};font-size:13px;line-height:1.5;color:${CVETA.priglushennyy};">
              Письмо пришло, потому что вы прошли тест на <a href="https://kustova-psy.ru" style="color:${CVETA.akcent};">kustova-psy.ru</a> и попросили разбор.
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
