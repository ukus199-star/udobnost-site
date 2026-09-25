// Собрать письмо в HTML-файл, чтобы посмотреть его глазами до отправки.
//
// Запуск из папки udobnost:
//   node scripts/pokazat-pismo.mjs            - тип «вы спасаете»
//   node scripts/pokazat-pismo.mjs boundary   - другой тип результата
//
// Файл кладётся во временную папку, путь печатается. Письмо никому не
// отправляется: это просто предпросмотр.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const korni = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const papkaKopiy = join(tmpdir(), "pismo-predprosmotr");
await mkdir(papkaKopiy, { recursive: true });

// Псевдонимы вида @/... Node не понимает - делаем копии с прямыми путями.
for (const [otkuda, imya] of [
  [join(korni, "data", "questions.ts"), "questions.ts"],
  [join(korni, "data", "pisma.ts"), "pisma-dannye.ts"],
  [join(korni, "lib", "pisma.ts"), "pisma-vid.ts"],
]) {
  const tekst = (await readFile(otkuda, "utf8"))
    .replace(/@\/data\/questions/g, "./questions.ts")
    .replace(/@\/data\/pisma/g, "./pisma-dannye.ts");
  await writeFile(join(papkaKopiy, imya), tekst);
}

const { pisma } = await import(join(papkaKopiy, "pisma-dannye.ts"));
const { pismoVHtml } = await import(join(papkaKopiy, "pisma-vid.ts"));

const tip = process.argv[2] ?? "rescuer";
const pismo = pisma[tip];
if (!pismo) {
  console.error(`Нет такого типа: ${tip}. Есть: ${Object.keys(pisma).join(", ")}`);
  process.exit(2);
}

const fayl = join(papkaKopiy, `${tip}.html`);
await writeFile(fayl, pismoVHtml(pismo));
console.log(fayl);
