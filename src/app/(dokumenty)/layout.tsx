// Общий вид юридических страниц: политики и двух согласий.
//
// Отдельная раскладка, потому что эти страницы устроены иначе, чем тест:
// длинный текст, который читают внимательно, а не проходят. Отсюда узкая
// колонка, крупный межстрочный интервал и возврат к тесту в шапке - человек
// пришёл сюда по ссылке из формы и должен уметь вернуться.

import Link from "next/link";

export default function RaskladkaDokumentov({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-full bg-fon">
      <header className="border-b border-granica/40">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link
            href="/"
            className="text-sm text-priglushennyy underline underline-offset-4 hover:text-akcent"
          >
            ← К тесту
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">{children}</main>

      <footer className="mx-auto max-w-2xl px-4 pb-10 text-sm text-priglushennyy">
        Вопросы по обработке персональных данных:{" "}
        <a href="mailto:ukus199@gmail.com" className="underline underline-offset-4">
          ukus199@gmail.com
        </a>
      </footer>
    </div>
  );
}
