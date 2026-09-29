// Показ юридического документа: заголовок, дата и текст абзацами.
//
// Один компонент на все три страницы - политику и два согласия. Текст берётся
// из `src/data/dokumenty.ts`, куда он попадает из файлов юриста; здесь только
// оформление.

import { dokumenty, DATA_VSTUPLENIYA, type KodDokumenta } from "@/data/dokumenty";

/** Строка вида «1. Общие положения» - заголовок раздела, а не абзац текста. */
function zagolovokRazdela(abzac: string): boolean {
  return /^\d+\.\s+[А-ЯЁ]/.test(abzac) && abzac.length < 80;
}

export function Dokument({ kod }: { kod: KodDokumenta }) {
  const { nazvanie, abzacy } = dokumenty[kod];

  return (
    <article>
      <h1 className="text-2xl sm:text-3xl font-semibold text-tekst">{nazvanie}</h1>
      <p className="mt-2 text-sm text-priglushennyy">
        Действует с {DATA_VSTUPLENIYA}
      </p>

      <div className="mt-8 space-y-4">
        {abzacy.map((abzac, nomer) =>
          zagolovokRazdela(abzac) ? (
            <h2
              key={nomer}
              className="pt-4 text-lg font-semibold text-tekst first:pt-0"
            >
              {abzac}
            </h2>
          ) : (
            <p key={nomer} className="text-[15px] leading-relaxed text-tekst">
              {abzac}
            </p>
          ),
        )}
      </div>
    </article>
  );
}
