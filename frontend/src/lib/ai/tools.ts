import "server-only";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { ApiError } from "@/lib/api-error";
import { apiFetch } from "@/lib/server/api";
import { GENERATED_TOOLS } from "./generated-tools";
import { buildRequestPath, ToolInputError, type GeneratedTool } from "./tool-request";

export type AiFeature = keyof typeof GENERATED_TOOLS;

/** 道具の結果が長すぎると料金がかさみ、AI も読みにくいので打ち切る */
const MAX_RESULT_CHARS = 20_000;

/**
 * 道具を実行する：ログイン中の会員のトークンで Rails API を GET で呼ぶ（apiFetch）。
 * 見てよい範囲は Rails の Pundit が決めるので、AI のために特別な権限は持たせない。
 * 失敗は例外にせず、AI が読める形（error）で返す（AI が引数を直して呼び直せるように）
 */
export async function executeTool(tool: GeneratedTool, input: Record<string, unknown>, fetcher = apiFetch): Promise<string> {
  try {
    const data = await fetcher<unknown>(buildRequestPath(tool, input));
    const text = JSON.stringify(data);
    return text.length > MAX_RESULT_CHARS ? JSON.stringify({ error: "結果が多すぎます。条件を絞って呼び直してください" }) : text;
  } catch (e) {
    if (e instanceof ToolInputError) return JSON.stringify({ error: e.message });
    if (e instanceof ApiError) return JSON.stringify({ error: e.message, status: e.status });
    throw e;
  }
}

/** 機能ごとの道具（許可リストから作ったものだけ）を、SDK の tool runner に渡せる形にする */
export function toolsFor(feature: AiFeature, fetcher = apiFetch) {
  return GENERATED_TOOLS[feature].map((tool: GeneratedTool) =>
    betaTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      run: (input) => executeTool(tool, input as Record<string, unknown>, fetcher),
    }),
  );
}
