import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Заголовок вкладки браузера и подпись при отправке ссылки.
  // Текст описания - первое предложение с экрана приветствия, дословно.
  title: "Насколько вы удобны",
  description:
    "Двенадцать вопросов о самых обычных ситуациях. Ответив на них, вы узнаете, как устроена ваша удобность.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
