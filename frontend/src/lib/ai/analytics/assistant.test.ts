import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/api", () => ({ apiFetch: vi.fn() }));

const runAiFeature = vi.fn();
vi.mock("../run", () => ({ runAiFeature: (...args: unknown[]) => runAiFeature(...args) }));

const { runAnalyticsAssistant, describeSources } = await import("./assistant");

const sales = {
  month: "2026-10",
  locations: [
    {
      location: { id: 1, name: "川西駅前", prefecture: "兵庫県" },
      visit_count: 10,
      visit_amount: 3000,
      reservation_amount: 85050,
      total: 88050,
    },
    {
      location: { id: 3, name: "渋谷", prefecture: "東京都" },
      visit_count: 40,
      visit_amount: 12250,
      reservation_amount: 300000,
      total: 312250,
    },
  ],
  plan_amount: 202400,
  total: 602700,
};
const apiMock = vi.fn(async () => sales);
const api = apiMock as unknown as typeof import("@/lib/server/api").apiFetch;

// AI が道具（get_sales）を1回使ってから答えたことにする
const aiAnswers = (reply: unknown) =>
  runAiFeature.mockImplementation(async (opts: { api: typeof api }) => {
    await opts.api("/admin/sales?month=2026-10");
    return { status: "succeeded", message: { content: [{ type: "text", text: JSON.stringify(reply) }] }, remainingToday: 18 };
  });

beforeEach(() => {
  runAiFeature.mockReset();
  apiMock.mockClear();
});

describe("runAnalyticsAssistant", () => {
  it("数字を道具の結果と照らし合わせ、使ったデータを返す", async () => {
    aiAnswers({
      kind: "answer",
      message: "10月の売上がいちばん高いのは渋谷で312,250円です。川西駅前との差は224,200円、全体は602,700円でした。",
      figures: [
        { label: "渋谷の10月の売上", value: 312250, unit: "円" },
        { label: "10月の売上の合計", value: 999999, unit: "円" },
      ],
    });
    const r = await runAnalyticsAssistant({ question: "先月いちばん売れた拠点は？", api });
    expect(runAiFeature).toHaveBeenCalledWith(expect.objectContaining({ feature: "analytics" }));
    expect(r.figures.map((f) => f.verified)).toEqual([true, false]);
    expect(r.unverifiedInMessage).toEqual([]);
    expect(r.calls).toEqual(["/admin/sales?month=2026-10"]);
    expect(r.sources).toEqual([{ label: "月次売上（2026-10）", href: "/admin/sales?month=2026-10" }]);
  });

  it("答えの文の中の、照らし合わせられない数字を返す", async () => {
    aiAnswers({ kind: "answer", message: "渋谷は約45万円、全体の61.3%でした。", figures: [] });
    const r = await runAnalyticsAssistant({ question: "渋谷は？", api });
    expect(r.unverifiedInMessage).toEqual(["45", "61.3"]);
  });

  it("答え以外（聞き返し）では数字を出さない", async () => {
    aiAnswers({ kind: "clarify", message: "どの期間の数字ですか？", figures: [{ label: "x", value: 1, unit: "件" }] });
    const r = await runAnalyticsAssistant({ question: "売上は？", api });
    expect(r.kind).toBe("clarify");
    expect(r.figures).toEqual([]);
  });

  it("安全のための判定で断られたら、決まった文を返す", async () => {
    runAiFeature.mockResolvedValue({ status: "refused", message: { content: [] }, remainingToday: 18 });
    const r = await runAnalyticsAssistant({ question: "…", api });
    expect(r.kind).toBe("refuse");
    expect(r.message).toContain("お答えできません");
  });
});

describe("describeSources", () => {
  it("道具を呼んだパスを、画面に出す説明にする（同じものはまとめる）", () => {
    expect(
      describeSources([
        "/admin/stats/usage?from=2026-10-01&to=2026-10-31&group_by=weekday",
        "/admin/stats/usage?from=2026-10-01&to=2026-10-31&group_by=weekday",
        "/admin/stats/members?month=2026-11",
        "/locations?q=渋谷",
      ]),
    ).toEqual([{ label: "利用状況（2026-10-01〜2026-10-31・曜日ごと）" }, { label: "会員数（2026-11）" }]);
  });
});
