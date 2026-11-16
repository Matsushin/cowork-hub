import { expect, test } from "@playwright/test";
import { ADMIN, expectLoggedIn, login, MEMBER } from "./helpers";

// seed の「渋谷」（7:00〜23:00）を使う。営業時間外はチェックインできないので実行しない
const SHIBUYA = { name: "渋谷", openHour: 7, closeHour: 23 };
const hourInTokyo = Number(
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(new Date()),
);

test("受付用QRのURLを会員が開いてチェックインし、チェックアウトする", async ({ browser }) => {
  test.skip(hourInTokyo < SHIBUYA.openHour || hourInTokyo >= SHIBUYA.closeHour - 1, "渋谷の営業時間外");

  // 管理者：受付用QRを開く
  const adminPage = await (await browser.newContext()).newPage();
  await adminPage.goto("/login?next=/admin/locations");
  await login(adminPage, ADMIN);
  await expectLoggedIn(adminPage);
  await adminPage
    .getByRole("row", { name: new RegExp(SHIBUYA.name) })
    .getByRole("link", { name: "受付用QR" })
    .click();
  const qr = adminPage.getByRole("img", { name: "チェックイン用のQRコード" });
  await expect(qr).toBeVisible();
  await expect(adminPage.getByText(/秒で新しいQRコードに変わります/)).toBeVisible();
  const url = await qr.getAttribute("data-checkin-url");
  expect(url).toMatch(/\/checkin\?location=\d+&code=[0-9a-f]{16}$/);

  // 会員：QRのURLを開く → ログイン → 確認画面に戻ってチェックイン
  const page = await (await browser.newContext()).newPage();
  await page.goto(url!);
  await expect(page).toHaveURL(/\/login\?next=/);
  await login(page, MEMBER);
  await expect(page.getByRole("heading", { name: SHIBUYA.name })).toBeVisible();
  await page.getByRole("button", { name: "チェックインする" }).click();
  await expect(page).toHaveURL("/visits");
  await expect(page.getByText(SHIBUYA.name).first()).toBeVisible();

  // チェックアウトはこれまでどおりボタンで行う（ほかのテストのため、利用中のままにしない）
  await page.getByRole("button", { name: "チェックアウト" }).click();
  await page.getByRole("button", { name: "チェックアウトする" }).click();
  await expect(page.getByText("チェックアウトしました")).toBeVisible();
});

test("拠点ページからはチェックインできず、案内が表示される", async ({ page }) => {
  await page.goto("/login?next=/locations");
  await login(page, MEMBER);
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(SHIBUYA.name) })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: SHIBUYA.name })).toBeVisible();
  await expect(page.getByText("受付のQRコードを読んでチェックインしてください")).toBeVisible();
  await expect(page.getByRole("button", { name: "チェックインする" })).toHaveCount(0);
});
