import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Jangan di-bundle — pakai langsung dari node_modules (binary native/WASM;
  // konfigurasi yang disarankan untuk Prisma + libSQL di serverless).
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
    "sharp",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
