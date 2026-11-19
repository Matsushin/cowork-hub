import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, type Browser, type Page } from "@playwright/test";
import { PAGES } from "./pages.mjs";

// PRのキャプチャ用（通常のE2Eではない）。.github/workflows/pr-screenshots.yml から実行する
//   SCREENSHOT_PAGES=location,visits SCREENSHOT_OUT=shots npx playwright test -c playwright.screenshots.config.ts
// SCREENSHOT_PAGES を省略すると全ページを撮る
const ACCOUNTS = {
  member: { email: "member@example.com", password: "password123" },
  admin: { email: "admin@example.com", password: "password123" },
} as const;

const wanted = (process.env.SCREENSHOT_PAGES ?? "").split(",").filter(Boolean);
const targets = PAGES.filter((p) => wanted.length === 0 || wanted.includes(p.name));
const outDir = path.resolve(process.env.SCREENSHOT_OUT ?? "screenshots-out");

async function pageFor(browser: Browser, role: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  if (role === "member" || role === "admin") {
    const { email, password } = ACCOUNTS[role];
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.getByRole("button", { name: "ログアウト" }).waitFor();
  }
  return page;
}

test("変わったページを撮る", async ({ browser }) => {
  test.setTimeout(60_000 + targets.length * 15_000);
  mkdirSync(outDir, { recursive: true });
  const sessions = new Map<string, Page>();

  for (const target of targets) {
    if (!sessions.has(target.role)) sessions.set(target.role, await pageFor(browser, target.role));
    const page = sessions.get(target.role)!;
    // 変更前のブランチにページがない（新しいページ）ときなどは、エラーの画面をそのまま撮る
    await page.goto(target.path).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: path.join(outDir, `${target.name}.png`), fullPage: true });
  }
});
