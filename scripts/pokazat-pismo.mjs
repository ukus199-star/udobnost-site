// Собрать письмо в HTML-файл, чтобы посмотреть его глазами до отправки.
//
// Запуск из папки udobnost:
//   node scripts/pokazat-pismo.mjs            - тип «вы спасаете»
//   node scripts/pokazat-pismo.mjs boundary   - другой тип результата
//
// Файл кладётся во временную папку, путь печатается. Письмо никому не
// отправляется: это просто предпросмотр.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sobratPisma } from "./sobrat-pisma.mjs";

const papkaSkripta = dirname(fileURLToPath(import.meta.url));
const { pisma, pismoVHtml, ubrat } = await sobratPisma();

const tip = process.argv[2] ?? "rescuer";
const pismo = pisma[tip];
if (!pismo) {
  console.error(`Нет такого типа: ${tip}. Есть: ${Object.keys(pisma).join(", ")}`);
  process.exit(2);
}

const fayl = join(papkaKopiy, `${tip}.html`);
await writeFile(fayl, pismoVHtml(pismo));
console.log(fayl);
