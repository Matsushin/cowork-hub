"use server";

import { ApiError } from "@/lib/api-error";
import { runAnalyticsAssistant } from "@/lib/ai/analytics/assistant";
import { analyticsQuestionSchema, type AnalyticsResult } from "@/lib/ai/analytics/schema";
import { AiLimitError, AiUnavailableError } from "@/lib/ai/run";
import { requireAdmin } from "@/lib/server/session";

const FALLBACK = "うまくお答えできませんでした。時間をおいてもう一度お試しいただくか、「売上」の画面をご覧ください。";

/** 分析アシスタントに質問する（管理者だけ）。Server Action は外から直接呼べるので、権限と入力をここで確かめる */
export async function askAnalyticsAssistant(question: unknown): Promise<AnalyticsResult> {
  await requireAdmin();
  const parsed = analyticsQuestionSchema.safeParse(question);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力が正しくありません" };

  try {
    const r = await runAnalyticsAssistant({ question: parsed.data });
    if (r.unverifiedInMessage.length > 0 || r.figures.some((f) => !f.verified))
      console.warn("分析アシスタント：照らし合わせられない数字", { calls: r.calls, unverified: r.unverifiedInMessage });
    return {
      ok: true,
      kind: r.kind,
      message: r.message,
      figures: r.figures,
      unverifiedInMessage: r.unverifiedInMessage,
      sources: r.sources,
      remainingToday: r.run.remainingToday,
    };
  } catch (e) {
    if (e instanceof AiUnavailableError)
      return { ok: false, error: "分析アシスタントは今使えません。「売上」の画面をご覧ください。" };
    if (e instanceof AiLimitError) return { ok: false, error: e.message };
    if (e instanceof ApiError && e.status === 401) return { ok: false, error: "ログインし直してください" };
    console.error("分析アシスタントでエラー", e);
    return { ok: false, error: FALLBACK };
  }
}
