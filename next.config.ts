import type { NextConfig } from "next";

// Серверный режим. Раньше здесь стояло output: "export" - сайт собирался в
// набор готовых файлов без сервера. Со статикой нельзя ничего сохранить:
// некому принять событие и записать его в базу. С фазы 6 сайт работает
// сервером Node: next build собирает, next start запускает - см. amvera.yml.
const nextConfig: NextConfig = {};

export default nextConfig;
