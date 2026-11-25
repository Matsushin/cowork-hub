import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { apiFetch } from "@/lib/server/api";
import { runAiFeature, type AiRunResult } from "../run";
import { FAQ_SYSTEM_PROMPT } from "./prompt";
import type { FaqSegment, FaqSource } from "./schema";
import { RULE_CHUNKS, ruleHref, searchRules } from "./search";

export type FaqAssistantResult = {
  segments: FaqSegment[];
  sources: FaqSource[];
  grounded: boolean;
  /** search_rules で検索した語と、見つかった項目（評価とログのため） */
  searches: { query: string; ids: string[] }[];
  /** 拠点・プランの API を呼んだパス */
  calls: string[];
  run: AiRunResult;
};

const REFUSED_MESSAGE =
  "この内容にはお答えできません。ご利用ルール（予約・取り消し・ドロップイン・料金・プラン）についてお答えできます。";

/**
 * ご利用ルールの検索（道具）。見つかった項目を search_result ブロックで返すと、
 * Claude が答えの文に引用（どの項目のどの文か）を付けて返す（引用の場所は API が決めるので、AI が出典を作れない）
 */
export function searchRulesTool(record: (query: string, ids: string[]) => void) {
  return betaTool({
    name: "search_rules",
    description:
      "ee-office のご利用ルールを検索する。query には質問の要点（例：予約の取り消しの料金、チェックアウトし忘れ）を日本語で入れる。近い項目を最大3件返す。言い方を変えて何回か検索してよい",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "検索する語（200文字以内）" } },
      required: ["query"],
      additionalProperties: false,
    },
    run: ({ query }) => {
      const hits = searchRules(String(query).slice(0, 200));
      record(
        String(query),
        hits.map((h) => h.chunk.id),
      );
      if (hits.length === 0) return "ご利用ルールに当てはまる項目は見つかりませんでした。";
      return hits.map(({ chunk }): Anthropic.Beta.Messages.BetaSearchResultBlockParam => ({
        type: "search_result",
        source: ruleHref(chunk.id),
        title: `${chunk.docTitle}：${chunk.heading}`,
        content: chunk.blocks.map((text) => ({ type: "text", text })),
        citations: { enabled: true },
      }));
    },
  });
}

/** 会員の質問に、ご利用ルール（と拠点・プランの API）を根拠にして、引用つきで答える */
export async function runFaqAssistant({
  question,
  api = apiFetch,
  effort,
}: {
  question: string;
  api?: typeof apiFetch;
  effort?: "low" | "medium" | "high";
}): Promise<FaqAssistantResult> {
  const searches: FaqAssistantResult["searches"] = [];
  const calls: string[] = [];
  const recording = (async (path: string, options?: Parameters<typeof apiFetch>[1]) => {
    if (!options?.method && !path.startsWith("/ai_requests")) calls.push(path);
    return api(path, options);
  }) as typeof apiFetch;

  const run = await runAiFeature({
    feature: "faq",
    system: FAQ_SYSTEM_PROMPT,
    messages: [{ role: "user", content: question }],
    extraTools: [searchRulesTool((query, ids) => searches.push({ query, ids }))],
    effort,
    api: recording,
  });

  if (run.status === "refused")
    return { segments: [{ text: REFUSED_MESSAGE, sourceIds: [] }], sources: [], grounded: false, searches, calls, run };

  const { segments, sources } = toSegments(run.message.content);
  return { segments, sources, grounded: sources.length > 0 || calls.length > 0, searches, calls, run };
}

const BY_HREF = new Map(RULE_CHUNKS.map((c) => [ruleHref(c.id), c]));

/** 答えの文（text ブロック）と引用を、画面に出す形にする。引用先はご利用ルールにある項目だけを認める */
export function toSegments(content: Anthropic.Beta.Messages.BetaContentBlock[]): {
  segments: FaqSegment[];
  sources: FaqSource[];
} {
  const sources = new Map<string, FaqSource>();
  const segments: FaqSegment[] = [];
  for (const block of content) {
    if (block.type !== "text") continue;
    const ids: string[] = [];
    for (const c of block.citations ?? []) {
      if (c.type !== "search_result_location") continue;
      const chunk = BY_HREF.get(c.source);
      if (!chunk) continue;
      if (!ids.includes(chunk.id)) ids.push(chunk.id);
      sources.set(chunk.id, { id: chunk.id, title: `${chunk.docTitle}：${chunk.heading}`, href: ruleHref(chunk.id) });
    }
    const last = segments.at(-1);
    // 引用のない短い区切り（改行など）は前の部分につなげる
    if (last && ids.length === 0 && last.sourceIds.length === 0) last.text += block.text;
    else segments.push({ text: block.text, sourceIds: ids });
  }
  return { segments, sources: [...sources.values()] };
}
