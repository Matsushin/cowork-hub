import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/api", () => ({ apiFetch: vi.fn() }));

const runAiFeature = vi.fn();
vi.mock("../run", () => ({ runAiFeature: (...args: unknown[]) => runAiFeature(...args) }));

const { runBookingAssistant } = await import("./assistant");

const now = new Date("2026-12-01T10:00:00+09:00");
const location = {
  id: 3,
  name: "渋谷",
  open_hour: 7,
  close_hour: 23,
  spaces: [
    { id: 11, name: "会議室（4名）", kind: "meeting_room", capacity: 4, hourly_price: 1000, active: true, location_id: 3 },
  ],
};
const availability = { date: "2026-12-02", open_hour: 7, close_hour: 23, slot_minutes: 30, reserved: [] };
const apiMock = vi.fn(async (path: string) => (path.includes("availability") ? availability : location));
const api = apiMock as unknown as typeof import("@/lib/server/api").apiFetch;

const aiReturns = (reply: unknown, status = "succeeded") =>
  runAiFeature.mockResolvedValue({
    status,
    message: { content: [{ type: "text", text: JSON.stringify(reply) }] },
    remainingToday: 19,
  });

beforeEach(() => {
  runAiFeature.mockReset();
  apiMock.mockClear();
});

describe("runBookingAssistant", () => {
  it("AI の候補を API の値で確かめ、通ったものだけを返す（外したものは理由つきで rejected に）", async () => {
    aiReturns({
      kind: "candidates",
      message: "渋谷の会議室が空いています",
      candidates: [
        { location_id: 3, space_id: 11, starts_at: "2026-12-02T14:00:00+09:00", ends_at: "2026-12-02T16:00:00+09:00" },
        { location_id: 3, space_id: 11, starts_at: "2026-12-02T23:00:00+09:00", ends_at: "2026-12-02T23:30:00+09:00" },
      ],
    });
    const result = await runBookingAssistant({ history: [], message: "明日の午後、渋谷で4人", now, api });
    expect(result.kind).toBe("candidates");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ location_name: "渋谷", amount: 2000 });
    expect(result.rejected).toEqual([expect.objectContaining({ reason: "営業時間外" })]);
    // 同じ拠点・同じ日の詳細と空き状況は1回ずつだけ取る
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it("候補がすべて外れたら、no_candidates にして AI の返事は使わない", async () => {
    aiReturns({
      kind: "candidates",
      message: "予約しました",
      candidates: [
        { location_id: 3, space_id: 99, starts_at: "2026-12-02T14:00:00+09:00", ends_at: "2026-12-02T15:00:00+09:00" },
      ],
    });
    const result = await runBookingAssistant({ history: [], message: "x", now, api });
    expect(result.kind).toBe("no_candidates");
    expect(result.message).not.toContain("予約しました");
  });

  it("聞き返し・断りは、そのまま返す（候補は空）", async () => {
    aiReturns({ kind: "clarify", message: "日付を教えてください", candidates: [] });
    expect(await runBookingAssistant({ history: [], message: "会議室", now, api })).toMatchObject({
      kind: "clarify",
      candidates: [],
    });
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("安全の判定で断られたら、決まった文言の refuse にする", async () => {
    runAiFeature.mockResolvedValue({ status: "refused", message: { content: [] }, remainingToday: 1 });
    expect((await runBookingAssistant({ history: [], message: "x", now, api })).kind).toBe("refuse");
  });

  it("会話の履歴と今の日時（日本時間）を渡す", async () => {
    aiReturns({ kind: "clarify", message: "場所は？", candidates: [] });
    await runBookingAssistant({
      history: [
        { role: "user", text: "明日" },
        { role: "assistant", text: "場所は？" },
      ],
      message: "渋谷",
      now,
      api,
    });
    const opts = runAiFeature.mock.calls[0]![0];
    expect(opts.messages).toEqual([
      { role: "user", content: "明日" },
      { role: "assistant", content: "場所は？" },
      { role: "user", content: "渋谷" },
    ]);
    expect(opts.context).toContain("2026年12月1日（火）10:00");
    expect(opts.format).toBeDefined();
  });
});
