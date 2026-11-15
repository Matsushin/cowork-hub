import { expect, test } from "@playwright/test";
import { ADMIN, expectLoggedIn, login } from "./helpers";

test("会員の検索は入力が止まってからURLに反映し、サーバーで絞り込む", async ({ page }) => {
  await page.goto("/login?next=/admin/users");
  await login(page, ADMIN);
  await expectLoggedIn(page);
  await expect(page).toHaveURL("/admin/users");

  const search = page.getByLabel("会員を検索");
  await search.fill("member@");
  await expect(page).toHaveURL(/\/admin\/users\?q=member(@|%40)$/);
  await expect(page.getByRole("cell", { name: "member@example.com" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "admin@example.com" })).toBeHidden();

  // 空欄にするとパラメータごと消え、全員が表示される
  await search.fill("");
  await expect(page).toHaveURL("/admin/users");
  await expect(page.getByRole("cell", { name: "admin@example.com" })).toBeVisible();
});

test("請求の月はリンクで切り替わり、不正な月は今月として扱う", async ({ page }) => {
  await page.goto("/login?next=/billing?month=2026-13");
  await login(page, ADMIN);
  await expect(page.getByRole("heading", { name: "請求" })).toBeVisible();

  const current = await page.locator("span.min-w-24").textContent();
  await page.getByRole("link", { name: "← 前月" }).click();
  await expect(page).toHaveURL(/\/billing\?month=\d{4}-\d{2}$/);
  await expect(page.locator("span.min-w-24")).not.toHaveText(current!);
});
