import { expect, test } from "@playwright/test";
import { dateInTokyo, expectLoggedIn, login } from "./helpers";

test("拠点を選んで会議室・席を予約し、予約一覧からキャンセルできる", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expectLoggedIn(page);

  // 拠点を探す → 拠点の詳細 → 予約画面
  await page.goto("/locations");
  await page.getByRole("link", { name: /川西駅前/ }).click();
  await page.getByRole("link", { name: "空き状況を見て予約する" }).click();
  await expect(page.getByRole("heading", { name: "川西駅前を予約する" })).toBeVisible();

  // 1週間後の日付に切り替え、フリー席Bの空いている枠を1つ選ぶ
  const date = dateInTokyo(7);
  await page.getByLabel("日付").fill(date);
  await expect(page).toHaveURL(new RegExp(`date=${date}`));
  const slot = page.locator('button[aria-label^="フリー席B "]:not([disabled])').first();
  const slotLabel = await slot.getAttribute("aria-label");
  await slot.click();
  await expect(page.getByText("選択中の予約")).toBeVisible();

  await page.getByRole("button", { name: "この内容で予約する" }).click();

  // 予約一覧に移り、作った予約が表示される
  await expect(page).toHaveURL(/\/reservations/);
  const time = slotLabel!.replace("フリー席B ", "");
  const row = page.locator("div", { hasText: `フリー席B` }).filter({ hasText: time }).filter({ has: page.getByRole("button", { name: "キャンセル" }) }).last();
  await expect(row).toBeVisible();

  // キャンセル（確認ダイアログで「キャンセルする」）→ 通知が出て一覧から消える
  await row.getByRole("button", { name: "キャンセル" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("この予約をキャンセルしますか？");
  await dialog.getByRole("button", { name: "キャンセルする" }).click();
  await expect(page.getByText("予約をキャンセルしました")).toBeVisible();
  await expect(row).toBeHidden();
});
