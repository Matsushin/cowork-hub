import { describe, expect, it } from "vitest";
import { buildAnalyticsContext } from "./prompt";

describe("buildAnalyticsContext", () => {
  it("今の日時（日本時間）と、今月・先月・先々月の範囲を渡す", () => {
    const context = buildAnalyticsContext(new Date("2026-11-25T10:00:00+09:00"));
    expect(context).toContain("2026年11月25日（水）");
    expect(context).toContain("今月：2026-11（2026-11-01〜2026-11-25、今日まで）");
    expect(context).toContain("先月：2026-10（2026-10-01〜2026-10-31）");
    expect(context).toContain("先々月：2026-09（2026-09-01〜2026-09-30）");
  });

  it("年をまたぐ月と、UTC では前日の時刻も日本時間で数える", () => {
    const context = buildAnalyticsContext(new Date("2026-12-31T16:30:00Z")); // 日本時間 2027-01-01 01:30
    expect(context).toContain("今月：2027-01（2027-01-01〜2027-01-01、今日まで）");
    expect(context).toContain("先月：2026-12（2026-12-01〜2026-12-31）");
    expect(context).toContain("先々月：2026-11（2026-11-01〜2026-11-30）");
  });
});
