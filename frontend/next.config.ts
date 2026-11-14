import type { NextConfig } from "next";

// 本番ではALBが /api/* をRailsへ振り分ける。
// ローカル開発では API_ORIGIN（例: http://localhost:3001）へプロキシする。
const apiOrigin = process.env.API_ORIGIN;

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return apiOrigin ? [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }] : [];
  },
};

export default nextConfig;
