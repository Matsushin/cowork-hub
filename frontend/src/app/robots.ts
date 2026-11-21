import type { MetadataRoute } from "next";

// 学習用のサンプルで、検索エンジンに載せる必要がないため、すべてのクローラーを断る。
// robots.txt は守らないボットもいるので、本番は Basic 認証（proxy.ts）でも守る
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
