import { expect, test } from "@playwright/test";
import { expectLoggedIn, login } from "./helpers";

// AI で会議室を探す画面。Claude は呼ばない（料金がかかり、結果も毎回変わるため。中身の確かめは npm run eval:booking）
// CI には API キーがないので「今使えません」と通常の予約への案内が出る。手元でキーがあれば入力欄が出る
test("会員はヘッダーから AI の画面を開け、使えないときは通常の予約へ案内される", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expectLoggedIn(page);

  await page.getByRole("link", { name: "AIで探す" }).click();
  await expect(page).toHaveURL("/assistant");
  await expect(page.getByRole("heading", { name: "AI で会議室を探す" })).toBeVisible();
  await expect(page.getByText("AI が予約することはありません")).toBeVisible();

  const unavailable = page.getByText("AI アシスタントは今使えません");
  if (await unavailable.isVisible()) {
    await page.getByRole("link", { name: "拠点を探す" }).last().click();
    await expect(page).toHaveURL("/locations");
  } else {
    // 空のままでは送れない
    await expect(page.getByLabel("条件")).toBeVisible();
    await expect(page.getByRole("button", { name: "送る" })).toBeDisabled();
  }
});

test("ログインしていなければ、ログイン画面へ送る", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page).toHaveURL(/\/login\?next=%2Fassistant$/);
});
