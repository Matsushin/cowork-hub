import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// AI 機能の評価（実際に Claude を呼ぶので料金がかかる。npm run eval:booking のときだけ動かす）
// .env.local の ANTHROPIC_API_KEY を読み、手元の Rails（docker compose up -d・seed 済み）に対して動かす
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js の外で動かすので、サーバー専用の印を空にする
      "server-only": fileURLToPath(new URL("./evals/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30 * 60 * 1000,
    fileParallelism: false,
  },
}));
