import { describe, expect, it } from "vitest";
import { formatDuration, formatMonth, formatTime, isValidDate, isValidMonth, shiftMonth, yen } from "./format";

describe("format", () => {
  it("金額を円で表示する", () => {
    expect(yen(16500)).toBe("¥16,500");
  });

  it("UTCの時刻を日本時間で表示する", () => {
    expect(formatTime("2026-11-15T01:30:00Z")).toBe("10:30");
  });

  it("利用時間を時間と分で表示する", () => {
    expect(formatDuration(45)).toBe("45分");
    expect(formatDuration(120)).toBe("2時間");
    expect(formatDuration(150)).toBe("2時間30分");
  });

  it("月をまたいで前後の月を求める", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(formatMonth("2026-03")).toBe("2026年3月");
  });

  it("日付・月の形式を判定する", () => {
    expect(isValidDate("2026-11-15")).toBe(true);
    expect(isValidDate("2026/11/15")).toBe(false);
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });
});
