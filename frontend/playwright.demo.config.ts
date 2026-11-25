import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * AI 機能のデモの録画（docs/ai/demo/）。実際の Claude を呼ぶので料金がかかる（3本で 10円ほど）。
 * 手元で Rails（docker compose up -d・seed 済み）と、frontend/.env.local の ANTHROPIC_API_KEY が必要。
 *   npm run demo:record   … 録画して GIF にする（ffmpeg が必要）
 */
const size = { width: 1280, height: 800 };

export default defineConfig({
  ...base,
  testDir: "./demo",
  outputDir: "./test-results-demo",
  retries: 0,
  reporter: "list",
  timeout: 3 * 60 * 1000,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: size,
        // 操作を1つずつゆっくりにして、目で追えるようにする
        launchOptions: { slowMo: 400 },
      },
    },
  ],
  use: { ...base.use, video: { mode: "on", size } },
});
