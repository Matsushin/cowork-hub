import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * PRのキャプチャ用の設定（.github/workflows/pr-screenshots.yml から使う）
 *   SCREENSHOT_PAGES … 撮るページ（screenshots/pages.mjs の name をカンマ区切り。省略すると全ページ）
 *   SCREENSHOT_OUT   … 保存先のディレクトリ
 *   VIDEO_SPECS      … 録画するE2Eのテスト（指定したときは、撮影ではなく e2e/ のテストを録画する）
 */
const recordVideo = !!process.env.VIDEO_SPECS;
const size = { width: 1280, height: 800 };

export default defineConfig({
  ...base,
  testDir: recordVideo ? "./e2e" : "./screenshots",
  outputDir: recordVideo ? "./test-results-video" : "./test-results-screenshots",
  retries: 0,
  reporter: "list",
  // 画面サイズは projects 側（Desktop Chrome は 1280×720）が優先されるので、projects ごと上書きする。
  // 録画のサイズと合わないと、動画の下に灰色の帯が出る
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: size,
        // 録画のときは操作を1つずつゆっくりにして、GIFで目で追えるようにする
        launchOptions: recordVideo ? { slowMo: 600 } : {},
      },
    },
  ],
  use: {
    ...base.use,
    video: recordVideo ? { mode: "on", size } : "off",
  },
});
