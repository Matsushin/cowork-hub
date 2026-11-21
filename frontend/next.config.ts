import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 検索結果に載せない（robots.txt を無視して URL を知ったクローラー向け。app/robots.ts も参照）
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
