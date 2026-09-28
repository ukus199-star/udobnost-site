// Собрать письма из исходного кода - общая часть всех скриптов про письма.
//
// Зачем это одним файлом. Node не понимает псевдонимы вида `@/lib/...`, из-за
// которых файлы приходится копировать во временную папку с прямыми путями.
// Этот кусок жил в четырёх скриптах сразу, и 28.09.2026 это выстрелило: в
// письме появился новый файл `src/lib/ssylki.ts`, а списки копируемых файлов
// остались прежними - проверка писем упала на ровном месте. Теперь список один.
//
// Копии делаются заново при каждом запуске, из `src`: устареть нечему. Это тоже
// не из головы - 25.09.2026 письма уходили владелице из устаревших копий, и она
// трижды видела старое оформление.

import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const papkaSkripta = dirname(fileURLToPath(import.meta.url));
const korni = join(papkaSkripta, "..", "src");

// Что копируем и под каким именем. Ключ - путь в проекте, значение - имя копии.
const FAYLY = [
  [join(korni, "data", "questions.ts"), "questions.ts"],
  [join(korni, "data", "pisma.ts"), "pisma-dannye.ts"],
  [join(korni, "lib", "ssylki.ts"), "ssylki.ts"],
  [join(korni, "lib", "pisma.ts"), "pisma-vid.ts"],
];

// Псевдонимы, которые надо превратить в прямые пути.
const PSEVDONIMY = [
  [/@\/data\/questions/g, "./questions.ts"],
  [/@\/data\/pisma/g, "./pisma-dannye.ts"],
  [/@\/lib\/ssylki/g, "./ssylki.ts"],
];

/**
 * Собирает письма из текущего исходного кода.
 *
 * Возвращает `{ pisma, pismoVHtml, ubrat }`: данные писем, сборщик HTML и
 * функцию, которая удаляет временную папку. Вызывать `ubrat()` после работы.
 */
export async function sobratPisma(prefiks = "pisma") {
  const kopii = join(tmpdir(), `${prefiks}-${Date.now()}`);
  await mkdir(kopii, { recursive: true });

  for (const [otkuda, imya] of FAYLY) {
    let tekst = await readFile(otkuda, "utf8");
    for (const [chto, naChto] of PSEVDONIMY) tekst = tekst.replace(chto, naChto);
    await writeFile(join(kopii, imya), tekst);
  }

  const { pisma } = await import(join(kopii, "pisma-dannye.ts"));
  const { pismoVHtml } = await import(join(kopii, "pisma-vid.ts"));

  return {
    pisma,
    pismoVHtml,
    papka: kopii,
    ubrat: () => rm(kopii, { recursive: true, force: true }),
  };
}
