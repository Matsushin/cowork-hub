import { defineConfig, devices } from "@playwright/test";

/**
 * 画面を通した動作確認（E2E）
 * Rails API（:3001）と Next.js（:3000）を起動し、seed のデータ・テストアカウントで操作する。
 * ローカルですでにサーバーを起動していればそれを使う。
 *
 *   npx playwright install chromium   … 初回のみ
 *   npm run test:e2e
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // 同じseedデータを使うので順番に実行する
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bin/rails server -p 3001",
      cwd: "../backend",
      url: "http://localhost:3001/up",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      // CIは本番と同じビルドで確認する
      command: isCI ? "npm run build && npm run start" : "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: { API_ORIGIN: "http://localhost:3001" },
    },
  ],
});
