import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Адмін-панель: усі дані живі (Google Play API), тому кешування компонентів вимкнене.
  reactCompiler: true,
  serverExternalPackages: ["googleapis"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
