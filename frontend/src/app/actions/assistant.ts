"use server";

import { ApiError } from "@/lib/api-error";
import { runBookingAssistant } from "@/lib/ai/booking/assistant";
import { historySchema, userMessageSchema, type AssistantResult } from "@/lib/ai/booking/schema";
import { AiLimitError, AiUnavailableError } from "@/lib/ai/run";
import { requireUser } from "@/lib/server/session";

const FALLBACK = "うまくお答えできませんでした。時間をおいてもう一度お試しいただくか、「拠点を探す」から予約してください。";

/** 予約アシスタントに相談する。Server Action は外から直接呼べるので、入力をここで確かめる */
export async function askBookingAssistant(history: unknown, message: unknown): Promise<AssistantResult> {
  await requireUser();
  const parsedHistory = historySchema.safeParse(history);
  const parsedMessage = userMessageSchema.safeParse(message);
  if (!parsedHistory.success) return { ok: false, error: "会話が長すぎます。ページを開き直してください" };
  if (!parsedMessage.success) return { ok: false, error: parsedMessage.error.issues[0]?.message ?? "入力が正しくありません" };

  try {
    const result = await runBookingAssistant({ history: parsedHistory.data, message: parsedMessage.data });
    return {
      ok: true,
      kind: result.kind,
      message: result.message,
      candidates: result.candidates,
      remainingToday: result.run.remainingToday,
    };
  } catch (e) {
    if (e instanceof AiUnavailableError)
      return { ok: false, error: "AI アシスタントは今使えません。「拠点を探す」から予約してください。" };
    if (e instanceof AiLimitError) return { ok: false, error: e.message };
    if (e instanceof ApiError && e.status === 401) return { ok: false, error: "ログインし直してください" };
    console.error("予約アシスタントでエラー", e);
    return { ok: false, error: FALLBACK };
  }
}
