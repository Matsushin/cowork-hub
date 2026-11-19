import { expect, test } from "@playwright/test";

// seed の「川西駅前」（兵庫県 川西市栄町1-1）を使う
const KAWANISHI = { name: "川西駅前", prefecture: "兵庫県", address: "川西市栄町1-1" };

test("拠点一覧から拠点詳細を開くと、Googleマップのリンクが新しいタブで開く設定になっている", async ({ page }) => {
  await page.goto("/locations");
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(KAWANISHI.name) })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: KAWANISHI.name })).toBeVisible();
  await expect(page.getByText(KAWANISHI.address)).toBeVisible();

  // 外部サイトには移動せず、リンクの中身だけを確かめる
  const mapLink = page.getByRole("link", { name: "Googleマップで開く" });
  await expect(mapLink).toBeVisible();
  await expect(mapLink).toHaveAttribute(
    "href",
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(KAWANISHI.prefecture + KAWANISHI.address)}`,
  );
  await expect(mapLink).toHaveAttribute("target", "_blank");
  await expect(mapLink).toHaveAttribute("rel", "noopener noreferrer");
});
