import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

vi.mock("server-only", () => ({}));

const apiFetch = vi.fn();
vi.mock("@/lib/server/api", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

// SDK の tool runner は、API を呼ぶたびの応答（message）を順に返す。ここでは決まった応答を返す偽物にする
let messages: unknown[] = [];
let runnerError: Error | undefined;
const toolRunner = vi.fn<(params: unknown) => AsyncIterable<unknown>>(() => ({
  async *[Symbol.asyncIterator]() {
    for (const m of messages) yield m;
    if (runnerError) throw runnerError;
  },
}));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    static RateLimitError = actual.default.RateLimitError;
    static APIError = actual.default.APIError;
    beta = { messages: { toolRunner } };
  }
  return { default: FakeAnthropic };
});

const { runAiFeature, AiLimitError, AiUnavailableError } = await import("./run");

const message = (stop_reason: string, content: unknown[], usage = { input_tokens: 100, output_tokens: 20 }) => ({
  model: "claude-opus-5-5",
  stop_reason,
  content,
  usage: { cache_read_input_tokens: null, cache_creation_input_tokens: null, ...usage },
});
const options = {
  feature: "booking" as const,
  system: "指示",
  context: "今は 2026-12-01 10:00",
  messages: [{ role: "user" as const, content: "明日渋谷" }],
};
const patchBody = () => apiFetch.mock.calls.find(([, o]) => o?.method === "PATCH")?.[1].body.ai_request;

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (_path: string, opts?: { method?: string }) =>
    opts?.method === "POST" ? { id: 7, remaining_today: 19 } : {},
  );
  messages = [];
  runnerError = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("runAiFeature", () => {
  it("API キーがなければ、Rails にも Claude にも行かずに AiUnavailableError", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(runAiFeature(options)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("今日の上限（Rails が429）なら AiLimitError で、Claude は呼ばない", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(429, "上限に達しました"));
    await expect(runAiFeature(options)).rejects.toBeInstanceOf(AiLimitError);
    expect(toolRunner).not.toHaveBeenCalled();
  });

  it("道具を使った回の usage を足し、料金・道具の回数と一緒に記録する", async () => {
    messages = [
      message("tool_use", [{ type: "tool_use", id: "t1", name: "search_locations", input: {} }], {
        input_tokens: 1000,
        output_tokens: 50,
      }),
      message("end_turn", [{ type: "text", text: "候補です" }], { input_tokens: 1200, output_tokens: 300 }),
    ];
    const result = await runAiFeature(options);
    expect(result).toMatchObject({ status: "succeeded", remainingToday: 19, toolCalls: 1 });
    expect(patchBody()).toMatchObject({
      status: "succeeded",
      model: "claude-opus-5-5",
      input_tokens: 2200,
      output_tokens: 350,
      tool_calls: 1,
      cost_micro_usd: 2200 * 4 + 350 * 20,
    });
    expect(apiFetch.mock.calls.find(([, o]) => o?.method === "PATCH")?.[0]).toBe("/ai_requests/7");
  });

  it("毎回同じ指示はキャッシュに載せ、日時などはその後ろに置く", async () => {
    messages = [message("end_turn", [{ type: "text", text: "ok" }])];
    await runAiFeature(options);
    const params = toolRunner.mock.calls[0]![0] as unknown as {
      system: { text: string; cache_control?: unknown }[];
      thread: boolean;
    };
    expect(params.system[0]).toMatchObject({ text: "指示", cache_control: { type: "ephemeral" } });
    expect(params.system[1]).toEqual({ type: "text", text: "今は 2026-12-01 10:00" });
    expect(params.thread).toBe(false);
  });

  it("断られたら refused として記録して返す", async () => {
    messages = [message("refusal", [])];
    expect((await runAiFeature(options)).status).toBe("refused");
    expect(patchBody()).toMatchObject({ status: "refused" });
  });

  it("道具を使い切っても終わらなければ failed（max_iterations）として記録し、例外にする", async () => {
    messages = [message("tool_use", [{ type: "tool_use", id: "t1", name: "get_location", input: { id: 1 } }])];
    await expect(runAiFeature(options)).rejects.toThrow("max_iterations");
    expect(patchBody()).toMatchObject({ status: "failed", error_code: "max_iterations", tool_calls: 1 });
  });

  it("Claude の呼び出しが失敗しても、失敗として記録してから例外を投げ直す", async () => {
    runnerError = new Error("接続できない");
    await expect(runAiFeature(options)).rejects.toThrow("接続できない");
    expect(patchBody()).toMatchObject({ status: "failed", error_code: "unexpected" });
  });
});
