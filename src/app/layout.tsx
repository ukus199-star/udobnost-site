import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Заголовок вкладки браузера и подпись при отправке ссылки.
  // Текст описания - первое предложение с экрана приветствия, дословно.
  title: "Насколько вы удобны",
  description:
    "Двенадцать обычных ситуаций. В каждой выберите то, что ближе к тому, как вы поступаете на самом деле.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
