// Собрать письмо в HTML-файл, чтобы посмотреть его глазами до отправки.
//
// Запуск из папки udobnost:
//   node scripts/pokazat-pismo.mjs            - тип «вы спасаете»
//   node scripts/pokazat-pismo.mjs boundary   - другой тип результата
//
// Файл кладётся во временную папку, путь печатается. Письмо никому не
// отправляется: это просто предпросмотр.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sobratPisma } from "./sobrat-pisma.mjs";

const { pisma, pismoVHtml, papka } = await sobratPisma("pismo-predprosmotr");

const tip = process.argv[2] ?? "rescuer";
const pismo = pisma[tip];
if (!pismo) {
  console.error(`Нет такого типа: ${tip}. Есть: ${Object.keys(pisma).join(", ")}`);
  process.exit(2);
}

// Папку не убираем: файл нужен, чтобы открыть его в браузере.
const fayl = join(papka, `${tip}.html`);
await writeFile(fayl, pismoVHtml(pismo));
console.log(fayl);
