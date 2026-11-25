import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login, MEMBER } from "../e2e/helpers";

// AI 機能のデモ（playwright.demo.config.ts）。実際の Claude を呼ぶ。予約は確定しない（確認ダイアログで「戻る」）

/** 画面の下に、いま何をしているかの説明を出す（録画を見る人のため） */
async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:90%;padding:10px 18px;border-radius:8px;background:rgba(20,30,25,.88);color:#fff;font:600 18px/1.5 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

const pause = (page: Page, ms = 1500) => page.waitForTimeout(ms);

// Next.js の開発用の表示（左下の「N」のボタン）を録画に映さない
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
});

async function signIn(page: Page, next: string, account = MEMBER) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await login(page, account);
  await expect(page).toHaveURL(next);
}

test("予約アシスタント", async ({ page }) => {
  await signIn(page, "/assistant");
  await caption(page, "① 会員が、条件を文で書く");
  await pause(page);
  await page.getByLabel("条件").pressSequentially("明日の午後、渋谷で4人・2時間使える会議室", { delay: 70 });
  await page.getByRole("button", { name: "送る" }).click();
  await caption(page, "② AI が拠点・空き状況を調べる（道具は読み取りの API だけ）");
  const reserve = page.getByRole("button", { name: "この内容で予約" }).first();
  await expect(reserve).toBeVisible({ timeout: 60_000 });
  await caption(page, "③ 候補はコードが API の値（営業時間・空き・料金）で確かめてから出す");
  await pause(page, 3500);
  await reserve.click();
  await caption(page, "④ 予約を確定するのは会員。AI は予約しない");
  await pause(page, 3000);
  await page.getByRole("button", { name: "戻る" }).click();
  await pause(page);
});

test("分析アシスタント", async ({ page }) => {
  await signIn(page, "/admin/assistant", ADMIN);
  await caption(page, "① 運営者が、知りたいことを文で聞く");
  await pause(page);
  await page.getByLabel("質問").pressSequentially("先月は何曜日の予約がいちばん多かった？", { delay: 70 });
  await page.getByRole("button", { name: "質問する" }).click();
  await caption(page, "② AI は集計の API だけを使う（SQL は書かせない）");
  await expect(page.getByText("集計の結果と一致").first()).toBeVisible({ timeout: 90_000 });
  await caption(page, "③ 答えの数字は、集計の結果と照らし合わせて ✓ を付ける");
  await pause(page, 5000);
});

test("FAQ ボット", async ({ page }) => {
  await signIn(page, "/rules");
  await caption(page, "① 会員が、ご利用ルールについて質問する");
  await pause(page);
  await page.getByLabel("質問").pressSequentially("予約を取り消すと料金はかかる？", { delay: 70 });
  await page.getByRole("button", { name: "質問する" }).click();
  await caption(page, "② AI がご利用ルールを検索して答える");
  const cite = page.getByRole("link", { name: "根拠 1" }).first();
  await expect(cite).toBeVisible({ timeout: 60_000 });
  await caption(page, "③ 答えの文に、根拠の項目を引用する（引用の場所は API が返す）");
  await pause(page, 4000);
  await cite.click();
  await caption(page, "④ 番号を押すと、ご利用ルールのその項目へ");
  await pause(page, 3000);
});
