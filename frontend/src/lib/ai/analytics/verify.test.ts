import { describe, expect, it } from "vitest";
import { collectNumbers, extractNumbers, isSupported } from "./verify";

const usage = {
  from: "2026-10-01",
  to: "2026-10-31",
  rows: [
    { key: 1, label: "川西駅前", reservation_amount: 88050, total_amount: 120000, utilization_rate: 7.3 },
    { key: 3, label: "渋谷", reservation_amount: 312250, total_amount: 400000, utilization_rate: 16.1 },
  ],
  totals: { reservation_amount: 400300, utilization_rate: 11.4 },
};

describe("collectNumbers", () => {
  it("結果の数字と、表の列ごとの合計を集める（ID・見出しの番号は除く）", () => {
    const numbers = collectNumbers(usage);
    expect(numbers).toContain(312250);
    expect(numbers).toContain(16.1);
    expect(numbers).toContain(520000); // total_amount の列の合計
    expect(numbers).not.toContain(3); // key
  });
});

describe("isSupported", () => {
  const numbers = collectNumbers(usage);

  it("結果の値そのものと、丸めた値は正しい", () => {
    expect(isSupported(312250, numbers)).toBe(true);
    expect(isSupported(16, numbers)).toBe(true);
  });

  it("2つの値の差・比（％・倍・増減率）は正しい", () => {
    expect(isSupported(312250 - 88050, numbers)).toBe(true);
    expect(isSupported(3.5, numbers)).toBe(true); // 312250 / 88050 ≒ 3.546 → 小数1桁
    expect(isSupported(78, numbers)).toBe(true); // 312250 / 400300 ≒ 78.0%
    expect(isSupported(254.6, numbers)).toBe(true); // 312250 / 88050 − 1 ≒ 254.6% 増
  });

  it("どこからも作れない数字は照らし合わせられない", () => {
    expect(isSupported(123456, numbers)).toBe(false);
    expect(isSupported(37.7, numbers)).toBe(false);
    expect(isSupported(99.9, numbers)).toBe(true); // 400000 ÷ 400300 ≒ 99.9%。差・比は偶然当てはまることがある
  });
});

describe("extractNumbers", () => {
  it("金額・割合を取り出し、日付・時刻・順位は除く", () => {
    const text = "2026年10月は渋谷が1位で312,250円（稼働率16.1%）。10/1〜10/31、9時から集計。2026-10 の4拠点";
    expect(extractNumbers(text).map((n) => n.value)).toEqual([312250, 16.1]);
  });
});
