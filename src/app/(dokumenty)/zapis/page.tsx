// Страница условий работы: `kustova-psy.ru/zapis`.
//
// Сюда ведёт письмо с разбором результата теста. Задача страницы - не продать,
// а снять то, что останавливает перед первым сообщением: что будет на встрече,
// сколько стоит, и что делать, если не знаешь, с чего начать.

import type { Metadata } from "next";
import {
  CENA_PERVOY_VSTRECHI,
  DLITELNOST_VSTRECHI,
  O_PERVOY_VSTRECHE,
  SOMNENIYA,
} from "@/data/zapis";
import { TELEGRAM, NIK_TELEGRAMA } from "@/lib/ssylki";

export const metadata: Metadata = {
  title: "Первая встреча",
  description:
    "Как проходит первая встреча с гештальт-терапевтом Ульяной Кустовой, сколько она стоит и как написать.",
};

export default function Zapis() {
  return (
    <article>
      <h1 className="text-2xl sm:text-3xl font-semibold text-tekst">
        Первая встреча
      </h1>

      <div className="mt-6 space-y-4">
        {O_PERVOY_VSTRECHE.map((abzac) => (
          <p key={abzac} className="text-[15px] leading-relaxed text-tekst">
            {abzac}
          </p>
        ))}
      </div>

      <div className="mt-8 rounded-myagkiy border border-granica bg-akcent-myagkiy p-5 sm:p-6">
        <p className="text-2xl font-semibold text-tekst">
          {CENA_PERVOY_VSTRECHI.toLocaleString("ru-RU")} ₽{" "}
          <span className="text-[15px] font-normal">
            за встречу {DLITELNOST_VSTRECHI}
          </span>
        </p>

        <a
          href={TELEGRAM}
          className="mt-5 inline-block rounded-myagkiy bg-akcent px-7 py-3.5 font-semibold text-poverhnost hover:bg-akcent-naveden"
        >
          Написать в телеграме
        </a>

        <p className="mt-4 text-sm text-priglushennyy">
          Не открылось - найдите меня в телеграме:{" "}
          <span className="font-semibold text-akcent">{NIK_TELEGRAMA}</span>.
          Можно написать и на почту{" "}
          <a href="mailto:ukus199@gmail.com" className="underline underline-offset-4">
            ukus199@gmail.com
          </a>
        </p>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-tekst">
        Если сомневаетесь, стоит ли идти
      </h2>
      <dl className="mt-4 space-y-5">
        {SOMNENIYA.map(({ vopros, otvet }) => (
          <div key={vopros}>
            <dt className="text-[15px] font-semibold text-tekst">{vopros}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-priglushennyy">
              {otvet}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-sm text-priglushennyy">
        Тест и разбор носят информационный характер и не являются диагностикой
        или медицинской услугой.
      </p>
    </article>
  );
}
