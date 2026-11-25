"use server";

import { ApiError } from "@/lib/api-error";
import { runFaqAssistant } from "@/lib/ai/faq/assistant";
import { faqQuestionSchema, type FaqResult } from "@/lib/ai/faq/schema";
import { AiLimitError, AiUnavailableError } from "@/lib/ai/run";
import { requireUser } from "@/lib/server/session";

const FALLBACK = "うまくお答えできませんでした。下のご利用ルールをご覧いただくか、スタッフにお問い合わせください。";

/** FAQ ボットに質問する（会員）。Server Action は外から直接呼べるので、ログインと入力をここで確かめる */
export async function askFaq(question: unknown): Promise<FaqResult> {
  await requireUser();
  const parsed = faqQuestionSchema.safeParse(question);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力が正しくありません" };

  try {
    const r = await runFaqAssistant({ question: parsed.data });
    return { ok: true, segments: r.segments, sources: r.sources, grounded: r.grounded, remainingToday: r.run.remainingToday };
  } catch (e) {
    if (e instanceof AiUnavailableError)
      return { ok: false, error: "FAQ ボットは今使えません。下のご利用ルールをご覧ください。" };
    if (e instanceof AiLimitError) return { ok: false, error: e.message };
    if (e instanceof ApiError && e.status === 401) return { ok: false, error: "ログインし直してください" };
    console.error("FAQ ボットでエラー", e);
    return { ok: false, error: FALLBACK };
  }
}
