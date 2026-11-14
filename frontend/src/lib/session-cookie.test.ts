import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./session-cookie";

describe("safeRedirectPath", () => {
  it("自サイト内のパスはそのまま返す（クエリも保持）", () => {
    expect(safeRedirectPath("/reservations")).toBe("/reservations");
    expect(safeRedirectPath("/locations/1/reserve?date=2026-11-20")).toBe("/locations/1/reserve?date=2026-11-20");
  });

  it.each([
    ["外部URL", "https://evil.example.com"],
    ["プロトコル相対URL", "//evil.example.com"],
    ["バックスラッシュ", "/\\evil.example.com"],
    ["相対パス", "reservations"],
    ["空文字", ""],
  ])("%s は既定のパスにする", (_label, value) => {
    expect(safeRedirectPath(value)).toBe("/locations");
  });

  it("文字列以外（FormDataの値がない場合など）は既定のパスにする", () => {
    expect(safeRedirectPath(null)).toBe("/locations");
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });
});
