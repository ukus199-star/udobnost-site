import type { Metadata } from "next";
import "./globals.css";

// Заголовок вкладки браузера и подпись при отправке ссылки.
// Текст описания - первое предложение с экрана приветствия, дословно.
const nazvanie = "Насколько вы удобны";
const opisanie =
  "Двенадцать вопросов о самых обычных ситуациях. Тест поможет вам определить, как устроена ваша удобность.";

export const metadata: Metadata = {
  // Адрес сайта. Картинку превью мессенджер забирает только по полной
  // ссылке, а без адреса Next.js подставил бы в неё localhost - и в Telegram
  // превью вышло бы пустым. Поменять вместе с доменом, фаза 7 основного плана.
  metadataBase: new URL("https://my-work-code-ula-star.amvera.io"),
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
