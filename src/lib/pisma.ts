// Превратить письмо из data/pisma.ts в HTML, который уходит человеку.
//
// Вёрстка нарочно простая: один столбец, системный шрифт, никаких картинок и
// таблиц. Почтовые программы - самая капризная среда отображения, и чем меньше
// в письме оформления, тем одинаковее оно выглядит в Gmail, Яндексе и на
// телефоне. Цвет текста и ширина колонки - те же, что на сайте.

import type { Pismo } from "@/data/pisma";

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

export function pismoVHtml(pismo: Pismo): string {
  const telo = pismo.abzacy
    .map((abzac) => {
      const zag = podzagolovok(abzac);
      if (zag !== null) {
        return `<h3 style="font-size:17px;line-height:1.4;margin:28px 0 8px;color:#231f19">${ekran(zag)}</h3>`;
      }
      return `<p style="margin:0 0 14px">${razmetka(abzac)}</p>`;
    })
    .join("\n");

  return `<div style="font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.55;color:#231f19;max-width:560px">
${telo}
</div>`;
}
