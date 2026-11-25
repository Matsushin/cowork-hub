import { describe, expect, it } from "vitest";
import { buildBookingContext } from "./prompt";

describe("buildBookingContext", () => {
  it("今の日時を日本時間で、曜日つきで渡す（サーバーは UTC）", () => {
    expect(buildBookingContext(new Date("2026-12-01T01:00:00Z"))).toBe(
      "今の日時（日本時間）：2026年12月1日（火）10:00（2026-12-01）",
    );
  });

  it("UTC では前日でも、日本時間の日付にする", () => {
    expect(buildBookingContext(new Date("2026-11-30T15:30:00Z"))).toContain("2026年12月1日（火）00:30");
  });
});
