import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { apiFetch } from "@/lib/server/api";
import { runAiFeature, type AiRunResult } from "../run";
import { ANALYTICS_SYSTEM_PROMPT, buildAnalyticsContext } from "./prompt";
import { analyticsReplySchema, type AnalyticsReply, type AnalyticsSource, type CheckedFigure } from "./schema";
import { collectNumbers, extractNumbers, isSupported } from "./verify";

export type AnalyticsAssistantResult = {
  kind: AnalyticsReply["kind"];
  message: string;
  figures: CheckedFigure[];
  unverifiedInMessage: string[];
  sources: AnalyticsSource[];
  /** 道具を呼んだパス（評価とログのため） */
  calls: string[];
  run: AiRunResult;
};

const REFUSED_MESSAGE = "この内容にはお答えできません。売上・予約・利用状況・会員数についての質問にお答えできます。";

/** 管理者の質問に、集計の API だけを使って答える。答えの数字は道具の結果と照らし合わせて印を付ける */
export async function runAnalyticsAssistant({
  question,
  now = new Date(),
  api = apiFetch,
  effort,
}: {
  question: string;
  now?: Date;
  api?: typeof apiFetch;
  effort?: "low" | "medium" | "high";
}): Promise<AnalyticsAssistantResult> {
  // 道具が受け取った結果を残す（照らし合わせと「使ったデータ」の表示のため）。利用記録（/ai_requests）は除く
  const results: { path: string; data: unknown }[] = [];
  const recording = (async (path: string, options?: Parameters<typeof apiFetch>[1]) => {
    const data = await api(path, options);
    if (!options?.method && !path.startsWith("/ai_requests")) results.push({ path, data });
    return data;
  }) as typeof apiFetch;

  const run = await runAiFeature({
    feature: "analytics",
    system: ANALYTICS_SYSTEM_PROMPT,
    context: buildAnalyticsContext(now),
    messages: [{ role: "user", content: question }],
    format: betaZodOutputFormat(analyticsReplySchema),
    maxIterations: 10,
    effort,
    api: recording,
  });
  const calls = results.map((r) => r.path);
  const sources = describeSources(calls);

  if (run.status === "refused")
    return { kind: "refuse", message: REFUSED_MESSAGE, figures: [], unverifiedInMessage: [], sources: [], calls, run };

  const text = run.message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = analyticsReplySchema.safeParse(safeJson(text));
  if (!parsed.success) throw new Error("AI の回答の形が正しくありませんでした");
  const reply = parsed.data;

  const numbers = new Set<number>();
  results.forEach((r) => collectNumbers(r.data, numbers));
  const figures =
    reply.kind === "answer" ? reply.figures.slice(0, 6).map((f) => ({ ...f, verified: isSupported(f.value, numbers) })) : [];
  // 答えの文の数字は、道具の結果か、figures に出した数字（照らし合わせ済み）から作れればよい
  const figureValues = new Set(figures.filter((f) => f.verified).map((f) => f.value));
  const unverifiedInMessage = extractNumbers(reply.message)
    .filter(({ value }) => !figureValues.has(value) && !isSupported(value, numbers))
    .map(({ raw }) => raw);

  return { kind: reply.kind, message: reply.message, figures, unverifiedInMessage, sources, calls, run };
}

const GROUP_LABELS: Record<string, string> = {
  location: "拠点",
  space: "スペース",
  month: "月",
  weekday: "曜日",
  hour: "時間帯",
};

/** 道具を呼んだパスを、画面に出す「使ったデータ」の説明にする（同じものは1つにまとめる） */
export function describeSources(paths: string[]): AnalyticsSource[] {
  const seen = new Map<string, AnalyticsSource>();
  for (const path of paths) {
    const url = new URL(path, "http://x");
    const q = url.searchParams;
    let source: AnalyticsSource | null = null;
    if (url.pathname === "/admin/sales") {
      const month = q.get("month") ?? "今月";
      source = { label: `月次売上（${month}）`, href: `/admin/sales${q.get("month") ? `?month=${month}` : ""}` };
    } else if (url.pathname === "/admin/stats/usage") {
      const by = GROUP_LABELS[q.get("group_by") ?? "location"] ?? q.get("group_by");
      const where = q.get("location_id") ? `・拠点ID ${q.get("location_id")}` : "";
      source = { label: `利用状況（${q.get("from")}〜${q.get("to")}・${by}ごと${where}）` };
    } else if (url.pathname === "/admin/stats/members") {
      source = { label: `会員数（${q.get("month") ?? "今月"}）` };
    }
    if (source) seen.set(source.label, source);
  }
  return [...seen.values()];
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
