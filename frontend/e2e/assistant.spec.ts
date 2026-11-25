import { expect, test } from "@playwright/test";
import { ADMIN, expectLoggedIn, login } from "./helpers";

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

// 管理者向けの分析アシスタント。Claude は呼ばない（中身の確かめは npm run eval:analytics）
test("管理者は管理画面から分析アシスタントを開け、使えないときは売上の画面へ案内される", async ({ page }) => {
  await page.goto("/login?next=/admin/users");
  await login(page, ADMIN);
  await expectLoggedIn(page);

  await page.getByRole("link", { name: "AIに聞く" }).click();
  await expect(page).toHaveURL("/admin/assistant");
  await expect(page.getByText("集計の結果と照らし合わせ")).toBeVisible();

  const unavailable = page.getByText("分析アシスタントは今使えません");
  if (await unavailable.isVisible()) {
    await page.getByRole("link", { name: "売上" }).last().click();
    await expect(page).toHaveURL("/admin/sales");
  } else {
    await expect(page.getByLabel("質問")).toBeVisible();
    await expect(page.getByRole("button", { name: "質問する" })).toBeDisabled();
  }
});

test("一般会員は分析アシスタントを開けない", async ({ page }) => {
  await page.goto("/login?next=/admin/assistant");
  await login(page);
  await expect(page).toHaveURL("/locations");
});

// ご利用ルールと FAQ ボット。Claude は呼ばない（中身の確かめは npm run eval:faq）
test("ご利用ルールはログインしなくても読め、FAQ ボットはログインを案内する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ご利用ルール" }).first().click();
  await expect(page).toHaveURL("/rules");
  await expect(page.getByRole("heading", { name: "取り消しの料金" })).toBeVisible();
  await expect(page.getByText("すると、ご利用ルールについて AI に質問できます")).toBeVisible();

  // 項目へのリンク（FAQ ボットの引用のリンク先）で、その項目へ移動できる
  await page.goto("/rules#cancel-fee");
  await expect(page.locator("#cancel-fee")).toBeInViewport();
});

test("ログインした会員は、ご利用ルールの画面で FAQ ボットに質問できる（使えないときは案内が出る）", async ({ page }) => {
  await page.goto("/login?next=/rules");
  await login(page);
  await expect(page).toHaveURL("/rules");
  const unavailable = page.getByText("FAQ ボットは今使えません");
  if (!(await unavailable.isVisible())) {
    await expect(page.getByLabel("質問")).toBeVisible();
    await expect(page.getByRole("button", { name: "質問する" })).toBeDisabled();
  }
});
