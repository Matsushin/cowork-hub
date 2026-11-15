import { expect, test } from "@playwright/test";
import { expectLoggedIn, login } from "./helpers";

test("未ログインでログインが必要なページを開くと、ログイン後に元のページへ戻る", async ({ page }) => {
  await page.goto("/reservations?upcoming=false");
  await expect(page).toHaveURL(/\/login\?next=/);

  await login(page);

  await expect(page).toHaveURL("/reservations?upcoming=false");
  await expect(page.getByRole("heading", { name: "予約一覧" })).toBeVisible();
  await expectLoggedIn(page);
});

test("ログインフォームはブラウザで入力チェックし、誤ったパスワードはサーバーのエラーを出す", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("メールアドレスを入力してください")).toBeVisible();
  await expect(page.getByText("パスワードを入力してください")).toBeVisible();

  await login(page, { email: "member@example.com", password: "wrong-password" });
  await expect(page.getByRole("alert").filter({ hasText: "メールアドレスまたはパスワードが正しくありません" })).toBeVisible();
  await expect(page).toHaveURL("/login");
});
