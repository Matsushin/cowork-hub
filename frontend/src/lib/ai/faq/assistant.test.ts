import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/api", () => ({ apiFetch: vi.fn() }));

const runAiFeature = vi.fn();
vi.mock("../run", () => ({ runAiFeature: (...args: unknown[]) => runAiFeature(...args) }));

const { runFaqAssistant, searchRulesTool, toSegments } = await import("./assistant");

const cite = (source: string) => ({
  type: "search_result_location",
  source,
  title: "",
  cited_text: "",
  search_result_index: 0,
  start_block_index: 0,
  end_block_index: 1,
});
const text = (t: string, citations: unknown[] = []) => ({ type: "text", text: t, citations });
const api = vi.fn() as unknown as typeof import("@/lib/server/api").apiFetch;

beforeEach(() => runAiFeature.mockReset());

describe("searchRulesTool", () => {
  it("見つかった項目を、引用できる検索結果（search_result）で返す", async () => {
    const queries: string[] = [];
    const tool = searchRulesTool((q) => queries.push(q));
    const result = await tool.run({ query: "予約の取り消しの料金" });
    expect(Array.isArray(result)).toBe(true);
    const first = (result as { type: string; source: string; citations: unknown }[])[0];
    expect(first).toMatchObject({ type: "search_result", source: "/rules#cancel-fee", citations: { enabled: true } });
    expect(queries).toEqual(["予約の取り消しの料金"]);
  });

  it("見つからなければ、その旨を文で返す", async () => {
    const tool = searchRulesTool(() => {});
    expect(await tool.run({ query: "xyz" })).toContain("見つかりませんでした");
  });
});

describe("toSegments", () => {
  it("答えの文と引用を、ご利用ルールの項目に結びつける（知らない出典は捨てる）", () => {
    const { segments, sources } = toSegments([
      text("キャンセル料はかかりません。", [cite("/rules#cancel-fee")]),
      text("\n"),
      text("開始前なら取り消せます。", [cite("/rules#cancel-deadline"), cite("https://example.com/fake")]),
    ] as never);
    expect(segments).toEqual([
      { text: "キャンセル料はかかりません。", sourceIds: ["cancel-fee"] },
      { text: "\n", sourceIds: [] },
      { text: "開始前なら取り消せます。", sourceIds: ["cancel-deadline"] },
    ]);
    expect(sources.map((s) => s.href)).toEqual(["/rules#cancel-fee", "/rules#cancel-deadline"]);
  });
});

describe("runFaqAssistant", () => {
  it("ご利用ルールの検索を持たせて呼び、引用があれば根拠ありとする", async () => {
    runAiFeature.mockResolvedValue({
      status: "succeeded",
      message: { content: [text("キャンセル料はかかりません。", [cite("/rules#cancel-fee")])] },
      remainingToday: 19,
    });
    const r = await runFaqAssistant({ question: "取り消しの料金は？", api });
    const opts = runAiFeature.mock.calls[0][0];
    expect(opts.feature).toBe("faq");
    expect(opts.extraTools.map((t: { name: string }) => t.name)).toEqual(["search_rules"]);
    expect(r.grounded).toBe(true);
  });

  it("引用も拠点・プランの値もない答えは、根拠なしとする", async () => {
    runAiFeature.mockResolvedValue({
      status: "succeeded",
      message: { content: [text("ご利用ルールに載っていないので、スタッフにお問い合わせください。")] },
      remainingToday: 19,
    });
    const r = await runFaqAssistant({ question: "Wi-Fi のパスワードは？", api });
    expect(r.grounded).toBe(false);
    expect(r.sources).toEqual([]);
  });

  it("安全のための判定で断られたら、決まった文を返す", async () => {
    runAiFeature.mockResolvedValue({ status: "refused", message: { content: [] }, remainingToday: 19 });
    const r = await runFaqAssistant({ question: "…", api });
    expect(r.segments[0].text).toContain("お答えできません");
  });
});
