import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { apiFetch } from "@/lib/server/api";
import type { Availability, LocationDetail } from "@/lib/types";
import { runAiFeature, type AiRunResult } from "../run";
import { checkCandidate } from "./check";
import { BOOKING_SYSTEM_PROMPT, buildBookingContext } from "./prompt";
import { assistantReplySchema, type AssistantReply, type HistoryItem, type VerifiedCandidate } from "./schema";

export type BookingAssistantResult = {
  kind: AssistantReply["kind"];
  message: string;
  candidates: VerifiedCandidate[];
  /** AI が出したが、API の値で確かめて外した候補（評価とログのため。画面には出さない） */
  rejected: { candidate: AssistantReply["candidates"][number]; reason: string }[];
  run: AiRunResult;
};

const REFUSED_MESSAGE = "この内容にはお答えできません。拠点や会議室の空きを探すお手伝いならできます。";
const NO_VALID_MESSAGE = "候補を確かめたところ、条件に合う空きが見つかりませんでした。日時や場所を変えてお試しください。";

/** 会員の条件から予約の候補を出す。候補は API の値で確かめたものだけを返す */
export async function runBookingAssistant({
  history,
  message,
  now = new Date(),
  api = apiFetch,
  effort,
}: {
  history: HistoryItem[];
  message: string;
  now?: Date;
  api?: typeof apiFetch;
  effort?: "low" | "medium" | "high";
}): Promise<BookingAssistantResult> {
  const run = await runAiFeature({
    feature: "booking",
    system: BOOKING_SYSTEM_PROMPT,
    context: buildBookingContext(now),
    messages: [...history.map((h) => ({ role: h.role, content: h.text })), { role: "user" as const, content: message }],
    format: betaZodOutputFormat(assistantReplySchema),
    effort,
    api,
  });

  if (run.status === "refused") return { kind: "refuse", message: REFUSED_MESSAGE, candidates: [], rejected: [], run };

  const text = run.message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = assistantReplySchema.safeParse(safeJson(text));
  if (!parsed.success) throw new Error("AI の回答の形が正しくありませんでした");
  const reply = parsed.data;

  if (reply.kind !== "candidates") return { kind: reply.kind, message: reply.message, candidates: [], rejected: [], run };

  // 拠点の詳細と空き状況は、拠点と日付ごとに1回だけ取る
  const cache = new Map<string, Promise<[LocationDetail, Availability]>>();
  const load = (locationId: number, date: string) => {
    const key = `${locationId}:${date}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        Promise.all([
          api<LocationDetail>(`/locations/${locationId}`),
          api<Availability>(`/locations/${locationId}/spaces/availability?date=${date}`),
        ]),
      );
    }
    return cache.get(key)!;
  };

  const candidates: VerifiedCandidate[] = [];
  const rejected: BookingAssistantResult["rejected"] = [];
  for (const c of reply.candidates.slice(0, 3)) {
    const date = jstDateOf(c.starts_at);
    if (!date || !Number.isInteger(c.location_id) || c.location_id <= 0) {
      rejected.push({ candidate: c, reason: "日時か拠点の形が正しくない" });
      continue;
    }
    try {
      const [location, availability] = await load(c.location_id, date);
      const result = checkCandidate(c, location, availability, now);
      if (result.ok) candidates.push(result.candidate);
      else rejected.push({ candidate: c, reason: result.reason });
    } catch {
      rejected.push({ candidate: c, reason: "拠点か空き状況を取得できない" });
    }
  }

  if (candidates.length === 0) return { kind: "no_candidates", message: NO_VALID_MESSAGE, candidates, rejected, run };
  return { kind: "candidates", message: reply.message, candidates, rejected, run };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function jstDateOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
