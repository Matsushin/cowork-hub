import { expect, type Page } from "@playwright/test";

// backend/db/seeds.rb で作る開発・テスト用アカウント
export const MEMBER = { email: "member@example.com", password: "password123" };
export const ADMIN = { email: "admin@example.com", password: "password123" };

export async function login(page: Page, { email, password } = MEMBER) {
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}

/** 日本時間で今日から days 日後（YYYY-MM-DD） */
export function dateInTokyo(days: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
}

export async function expectLoggedIn(page: Page) {
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
}
