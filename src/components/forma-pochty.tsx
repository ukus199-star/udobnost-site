// Форма почты на экране результата - фаза 3 плана формы почты.
//
// Решения владелицы 22.09.2026, записаны в plans/2026-09-22-forma-pochty.md:
//   - блок под текстом результата, не всплывающее окно (решение 2);
//   - строка над полем и тихая подпись у поля (решение 3);
//   - письмо уходит сразу, без «подтвердите адрес» (решение 4);
//   - две галочки: обязательная на письмо и по желанию на рассылку (4а).
//
// Тон - по ai-clone/voice/stop-words.md: ни срочности, ни уговоров. Форма
// спокойно называет, что человек получит, и ждёт.
//
// Пока на сервере форма не включена (переменная FORMA_POCHTY), блока на
// экране нет вовсе: сначала документы от юриста, потом форма.

"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { TypeCode } from "@/data/questions";
import { adresVPoryadke, normalizovatAdres } from "@/lib/pochta";

type Sostoyanie =
  | { vid: "zapolnenie" }
  | { vid: "otpravka" }
  | { vid: "gotovo"; adres: string }
  | { vid: "oshibka"; soobshchenie: string };

// Что сказать человеку на каждый ответ сервера. Без технических слов и без
// вины: «не получилось», а не «вы ввели неверно».
const SOOBSHCHENIYA: Record<string, string> = {
  adres: "Похоже, в адресе опечатка - проверьте его, пожалуйста.",
  soglasie: "Чтобы отправить письмо, нужна первая галочка - согласие на обработку адреса.",
  chasto: "Слишком много попыток подряд. Попробуйте через несколько минут.",
  servis: "Не получилось отправить письмо. Попробуйте ещё раз чуть позже.",
};

export function FormaPochty({
  resultType,
  runId,
}: {
  resultType: TypeCode;
  // Ссылка, а не значение: номер прохождения читается только в момент
  // отправки. Читать ref во время отрисовки React не разрешает.
  runId: RefObject<string>;
}) {
  // null - ещё не знаем, включена ли форма. Пока не знаем - ничего не
  // показываем: мелькнувшая и исчезнувшая форма хуже, чем её отсутствие.
  const [vklyuchena, setVklyuchena] = useState<boolean | null>(null);
  const [adres, setAdres] = useState("");
  const [soglasie, setSoglasie] = useState(false);
  const [rassylka, setRassylka] = useState(false);
  const [sostoyanie, setSostoyanie] = useState<Sostoyanie>({ vid: "zapolnenie" });
  const poleAdresa = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    let otmeneno = false;
    fetch("/api/pochta")
      .then((r) => r.json())
      .then((j: { vklyucheno?: boolean }) => {
        if (!otmeneno) setVklyuchena(j.vklyucheno === true);
      })
      .catch(() => {
        if (!otmeneno) setVklyuchena(false);
      });
    return () => {
      otmeneno = true;
    };
  }, []);

  if (!vklyuchena) return null;

  async function otpravit(sobytie: FormEvent<HTMLFormElement>) {
    sobytie.preventDefault();
    if (sostoyanie.vid === "otpravka") return;

    // Сначала проверяем сами - та же проверка, что на сервере, из
    // lib/pochta.ts. Человек узнаёт об опечатке сразу, без ожидания сети.
    const email = normalizovatAdres(adres);
    if (!adresVPoryadke(email)) {
      setSostoyanie({ vid: "oshibka", soobshchenie: SOOBSHCHENIYA.adres });
      poleAdresa.current?.focus();
      return;
    }
    if (!soglasie) {
      setSostoyanie({ vid: "oshibka", soobshchenie: SOOBSHCHENIYA.soglasie });
      return;
    }

    setSostoyanie({ vid: "otpravka" });
    try {
      const otvet = await fetch("/api/pochta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          soglasie: true,
          rassylka,
          resultType,
          runId: runId.current || undefined,
        }),
      });
      if (otvet.ok) {
        setSostoyanie({ vid: "gotovo", adres: email });
        return;
      }
      const j = (await otvet.json().catch(() => ({}))) as { oshibka?: string };
      if (j.oshibka === "vyklyucheno") {
        setVklyuchena(false);
        return;
      }
      setSostoyanie({
        vid: "oshibka",
        soobshchenie: SOOBSHCHENIYA[j.oshibka ?? ""] ?? SOOBSHCHENIYA.servis,
      });
    } catch {
      // Сеть оборвалась - та же честная фраза, что при отказе сервиса.
      setSostoyanie({ vid: "oshibka", soobshchenie: SOOBSHCHENIYA.servis });
    }
  }

  // Письмо ушло. Форма не исчезает бесследно: остаётся строка, куда именно
  // ушло письмо, и где его искать, если во «Входящих» пусто.
  if (sostoyanie.vid === "gotovo") {
    return (
      <div
        role="status"
        className="animate-proyavlenie mt-12 rounded-myagkiy border border-granica bg-poverhnost px-6 py-6 text-center sm:px-8"
      >
        <p className="text-base font-medium text-tekst">Готово, письмо уже в пути.</p>
        <p className="mt-2 text-sm leading-relaxed text-priglushennyy">
          Отправила разбор на <span className="text-tekst">{sostoyanie.adres}</span>.
          Если через несколько минут его нет во «Входящих», загляните в «Спам» или
          «Промоакции».
        </p>
      </div>
    );
  }

  const idPolya = `${id}-adres`;
  const idSoobshcheniya = `${id}-soobshchenie`;
  const otpravka = sostoyanie.vid === "otpravka";

  return (
    <form
      onSubmit={otpravit}
      noValidate
      className="animate-proyavlenie mt-12 rounded-myagkiy border border-granica bg-poverhnost px-6 py-7 sm:px-8"
    >
      {/* Строка над полем - решение 3: объясняет, что человек получит. Без
          этого непонятно, зачем отдавать адрес. */}
      <p className="text-base font-medium leading-snug text-tekst">
        Хотите подробный разбор своего способа? Пришлю на почту.
      </p>

      <label htmlFor={idPolya} className="mt-5 block text-sm text-priglushennyy">
        Куда прислать разбор?
      </label>
      {/* type=email и inputMode - на телефоне открывается клавиатура с «@».
          autoComplete - браузер может подставить адрес сам. */}
      <input
        ref={poleAdresa}
        id={idPolya}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="name@example.ru"
        value={adres}
        onChange={(e) => {
          setAdres(e.target.value);
          if (sostoyanie.vid === "oshibka") setSostoyanie({ vid: "zapolnenie" });
        }}
        aria-describedby={sostoyanie.vid === "oshibka" ? idSoobshcheniya : undefined}
        aria-invalid={sostoyanie.vid === "oshibka" && sostoyanie.soobshchenie === SOOBSHCHENIYA.adres}
        className="mt-2 block min-h-12 w-full rounded-myagkiy border border-granica-yarkaya bg-fon px-4 text-base text-tekst placeholder:text-priglushennyy/70 focus:border-akcent"
      />

      {/* Галочки не отмечены заранее: предустановленная галочка согласием не
          считается. Зона нажатия - вся строка с текстом, не только квадрат. */}
      <label className="mt-5 flex cursor-pointer gap-3 text-sm leading-relaxed text-priglushennyy">
        <input
          type="checkbox"
          checked={soglasie}
          onChange={(e) => {
            setSoglasie(e.target.checked);
            if (sostoyanie.vid === "oshibka") setSostoyanie({ vid: "zapolnenie" });
          }}
          className="mt-0.5 size-5 shrink-0 accent-akcent"
        />
        <span>
          Я даю{" "}
          <a href="/soglasie" target="_blank" rel="noopener" className="text-akcent underline underline-offset-2">
            согласие на обработку персональных данных
          </a>{" "}
          и ознакомлен(а) с{" "}
          <a href="/politika" target="_blank" rel="noopener" className="text-akcent underline underline-offset-2">
            политикой обработки персональных данных
          </a>
        </span>
      </label>

      <label className="mt-3 flex cursor-pointer gap-3 text-sm leading-relaxed text-priglushennyy">
        <input
          type="checkbox"
          checked={rassylka}
          onChange={(e) => setRassylka(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-akcent"
        />
        <span>
          Хочу получать письма о новых материалах, группах и продуктах -{" "}
          <a
            href="/soglasie-rassylka"
            target="_blank"
            rel="noopener"
            className="text-akcent underline underline-offset-2"
          >
            согласие на рассылку
          </a>
          . Отписаться можно в любой момент. По желанию - разбор придёт и без этого.
        </span>
      </label>

      {/* Сообщение об ошибке. aria-live - экранный диктор зачитает его, как
          только оно появится. */}
      <p
        id={idSoobshcheniya}
        aria-live="polite"
        className="mt-4 min-h-5 text-sm leading-relaxed text-tekst"
      >
        {sostoyanie.vid === "oshibka" ? sostoyanie.soobshchenie : ""}
      </p>

      {/* Значок загрузки на кнопке - тот, что перенесли из фазы 5 плана
          дизайна: тест грузится мгновенно, ждать приходится только здесь. */}
      <button
        type="submit"
        disabled={otpravka}
        aria-busy={otpravka}
        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-myagkiy bg-akcent px-6 py-3 text-base font-medium text-poverhnost shadow-sm transition duration-200 hover:bg-akcent-naveden active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
      >
        {otpravka && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 animate-spin fill-none stroke-current" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" className="opacity-30" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
        )}
        {otpravka ? "Отправляю…" : "Прислать разбор"}
      </button>
    </form>
  );
}
