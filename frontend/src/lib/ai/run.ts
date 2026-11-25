import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import { ApiError } from "@/lib/api-error";
import { apiFetch } from "@/lib/server/api";
import type { AiRequest } from "@/lib/types";
import { toolsFor, type AiFeature } from "./tools";
import { addUsage, costMicroUsd, emptyUsage, PRICES_PER_MTOK, type AiModel, type TokenUsage } from "./usage";

// AI 機能の共通の入り口（docs/ai/README.md）
//   1. Rails に相談の開始を記録する（会員ごとの1日の回数の上限を超えていれば AiLimitError）
//   2. 許可リストの道具を持たせて Claude を呼ぶ（道具は会員本人のトークンで Rails API を GET で呼ぶだけ）
//   3. 結果にかかわらず、トークン数・料金・応答時間・道具を使った回数を Rails に記録する（文章は記録しない）

export const AI_MODEL: AiModel = "claude-opus-5-5";

/** ANTHROPIC_API_KEY がない（ローカルで未設定・本番で止めている）。画面は通常の操作へ案内する */
export class AiUnavailableError extends Error {}
/** 今日の回数の上限に達した（Rails が429を返した） */
export class AiLimitError extends Error {}

export type RunAiOptions = {
  feature: AiFeature;
  /** 毎回同じ指示。道具の定義とあわせてプロンプトキャッシュに載せる（日時など毎回変わるものを入れない） */
  system: string;
  /** 毎回変わる情報（今の日時など）。キャッシュの後ろに置く */
  context?: string;
  messages: Anthropic.Beta.Messages.BetaMessageParam[];
  /** API を呼ぶ回数の上限（道具を使うたびに1回）。超えたら失敗として終える */
  maxIterations?: number;
  /** 最後の回答の形（JSON Schema）。指定すると、最後の回答はこの形の JSON になる */
  format?: Anthropic.Beta.Messages.BetaJSONOutputFormat;
  /** 考える深さ。既定は low（会話の応答なので）。評価データで確かめて調整する */
  effort?: "low" | "medium" | "high";
  /** 許可リストから作る道具のほかに持たせる道具（ご利用ルールの検索など、Rails を呼ばないもの） */
  extraTools?: BetaRunnableTool[];
  /** Rails API を呼ぶ関数。既定はログイン中の会員の Cookie を使う apiFetch（評価では評価用の会員のトークンを使うものに差し替える） */
  api?: typeof apiFetch;
};

export type AiRunResult = {
  status: "succeeded" | "refused";
  message: Anthropic.Beta.Messages.BetaMessage;
  remainingToday: number;
  usage: TokenUsage;
  costMicroUsd: number;
  durationMs: number;
  toolCalls: number;
};

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("AI 機能は今使えません");
  // 失敗の再試行は SDK に任せる（429・5xx・接続エラーを2回まで）
  return (client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 }));
}

function errorCode(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "rate_limited";
  if (e instanceof Anthropic.APIError) return `api_${e.status ?? "connection"}`;
  return "unexpected";
}

export async function runAiFeature({
  feature,
  system,
  context,
  messages,
  maxIterations = 8,
  format,
  effort = "low",
  extraTools = [],
  api = apiFetch,
}: RunAiOptions): Promise<AiRunResult> {
  const sdk = anthropic();

  let record: AiRequest;
  try {
    record = await api<AiRequest>("/ai_requests", { method: "POST", body: { ai_request: { feature } } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) throw new AiLimitError(e.message);
    throw e;
  }

  const startedAt = Date.now();
  let usage = emptyUsage();
  let toolCalls = 0;
  let final: Anthropic.Beta.Messages.BetaMessage | undefined;
  let cost = 0;
  let outcome: { status: "succeeded" | "refused" | "failed"; error_code?: string } = {
    status: "failed",
    error_code: "unexpected",
  };

  try {
    const runner = sdk.beta.messages.toolRunner({
      model: AI_MODEL,
      max_tokens: 16000,
      max_iterations: maxIterations,
      // 相談は短いので、毎回の履歴をこちらから送る（会話を Anthropic 側に預ける thread は使わない）
      thread: false,
      output_config: { effort, ...(format ? { format } : {}) },
      // 安全のための判定で断られたとき、Anthropic 側で別のモデルに切り替えて答えさせる
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ...(context ? [{ type: "text" as const, text: context }] : []),
      ],
      tools: [...toolsFor(feature, api), ...extraTools],
      messages,
    });
    for await (const message of runner) {
      usage = addUsage(usage, message.usage);
      toolCalls += message.content.filter((block) => block.type === "tool_use").length;
      final = message;
    }

    if (!final) outcome = { status: "failed", error_code: "no_response" };
    else if (final.stop_reason === "refusal") outcome = { status: "refused" };
    else if (final.stop_reason === "max_tokens") outcome = { status: "failed", error_code: "max_tokens" };
    // 上限の回数まで道具を使っても終わらなかった
    else if (final.stop_reason === "tool_use") outcome = { status: "failed", error_code: "max_iterations" };
    else outcome = { status: "succeeded" };
  } catch (e) {
    outcome = { status: "failed", error_code: errorCode(e) };
    throw e;
  } finally {
    const durationMs = Date.now() - startedAt;
    // 断られて別のモデルが答えたときは、そのモデル名を記録する（料金は表にあるモデルの料金で計算する）
    const servedModel = final?.model ?? AI_MODEL;
    const priceModel: AiModel = servedModel in PRICES_PER_MTOK ? (servedModel as AiModel) : AI_MODEL;
    cost = costMicroUsd(priceModel, usage);
    try {
      await api(`/ai_requests/${record.id}`, {
        method: "PATCH",
        body: {
          ai_request: {
            ...outcome,
            model: servedModel,
            ...usage,
            cost_micro_usd: cost,
            duration_ms: durationMs,
            tool_calls: toolCalls,
          },
        },
      });
    } catch (e) {
      // 記録に失敗しても、会員への応答は止めない
      console.error("AI の利用記録を書けませんでした", e);
    }
  }

  if (outcome.status === "failed") throw new Error(`AI の応答が完了しませんでした（${outcome.error_code}）`);
  return {
    status: outcome.status,
    message: final!,
    remainingToday: record.remaining_today,
    usage,
    costMicroUsd: cost,
    durationMs: Date.now() - startedAt,
    toolCalls,
  };
}
