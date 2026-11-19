import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * PRのキャプチャ用の設定（.github/workflows/pr-screenshots.yml から使う）
 *   SCREENSHOT_PAGES … 撮るページ（screenshots/pages.mjs の name をカンマ区切り。省略すると全ページ）
 *   SCREENSHOT_OUT   … 保存先のディレクトリ
 *   VIDEO_SPECS      … 録画するE2Eのテスト（指定したときは、撮影ではなく e2e/ のテストを録画する）
 */
const recordVideo = !!process.env.VIDEO_SPECS;

export default defineConfig({
  ...base,
  testDir: recordVideo ? "./e2e" : "./screenshots",
  outputDir: recordVideo ? "./test-results-video" : "./test-results-screenshots",
  retries: 0,
  reporter: "list",
  use: {
    ...base.use,
    viewport: { width: 1280, height: 800 },
    video: recordVideo ? { mode: "on", size: { width: 1280, height: 800 } } : "off",
  },
});
