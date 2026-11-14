import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 単体テスト（ロジック・コンポーネント）。画面を通した動作確認は Playwright（e2e/）で行う
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
