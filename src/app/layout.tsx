import type { Metadata } from "next";
import "./globals.css";

// Заголовок вкладки браузера и подпись при отправке ссылки.
// Описание - пересказ «Подробнее о тесте» с первого экрана в двух фразах.
const nazvanie = "Насколько вы удобны";
const opisanie =
  "Двенадцать вопросов о самых обычных ситуациях. Тест поможет вам определить, как устроена ваша удобность.";

export const metadata: Metadata = {
  // Адрес сайта. Картинку превью мессенджер забирает только по полной
  // ссылке, а без адреса Next.js подставил бы в неё localhost - и в Telegram
  // превью вышло бы пустым. Свой домен привязан 24.09.2026; прежний адрес
  // my-work-code-ula-star.amvera.io продолжает открываться, но ссылки и
  // превью ведут сюда.
  metadataBase: new URL("https://kustova-psy.ru"),
  title: nazvanie,
  description: opisanie,
  // Превью ссылки в мессенджерах. Сама картинка - файл opengraph-image.png
  // рядом, Next.js подключает его сам; здесь только подписи к ней.
  openGraph: {
    title: nazvanie,
    description: opisanie,
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
