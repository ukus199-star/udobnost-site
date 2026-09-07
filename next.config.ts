import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Собирать сайт в набор готовых файлов в папке out, без сервера.
  // Тест целиком статический: обе страницы и так собираются заранее,
  // при обычной сборке они помечены как prerendered as static content.
  // Нужно для раздачи на Amvera через nginx - см. amvera.yml.
  output: "export",
};

export default nextConfig;
