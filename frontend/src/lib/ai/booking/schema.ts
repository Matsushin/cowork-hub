// 予約アシスタントの入力と回答の形（画面とサーバーの両方で使う）
import { z } from "zod";

/** AI の最後の回答の形（構造化出力）。候補は ID と時刻だけを返させ、名前や料金はサーバーが API の値から付ける */
export const assistantReplySchema = z.object({
  kind: z
    .enum(["candidates", "clarify", "no_candidates", "refuse"])
    .describe("candidates=候補を出す、clarify=聞き返す、no_candidates=条件に合う候補がない、refuse=範囲外・答えられない"),
  message: z.string().describe("会員への短い返事（日本語・200字以内）。料金は書かない。予約したとは書かない"),
  candidates: z
    .array(
      z.object({
        location_id: z.number().int(),
        space_id: z.number().int(),
        starts_at: z.string().describe("開始。YYYY-MM-DDTHH:MM:00+09:00"),
        ends_at: z.string().describe("終了。YYYY-MM-DDTHH:MM:00+09:00"),
      }),
    )
    .describe("予約の候補（最大3件）。kind が candidates 以外なら空"),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;
export type ReplyCandidate = AssistantReply["candidates"][number];

/** 画面から送られる会話の履歴（Server Action の入力として検証する） */
export const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(1000) }))
  .max(12);
export type HistoryItem = z.infer<typeof historySchema>[number];

export const userMessageSchema = z.string().trim().min(1, "条件を入力してください").max(300, "300文字以内で入力してください");

/** サーバーが API の値で確かめた候補（画面に出すのはこれだけ） */
export type VerifiedCandidate = {
  location_id: number;
  location_name: string;
  space_id: number;
  space_name: string;
  kind: "seat" | "meeting_room";
  capacity: number;
  starts_at: string;
  ends_at: string;
  amount: number;
};

export type AssistantResult =
  | { ok: true; kind: AssistantReply["kind"]; message: string; candidates: VerifiedCandidate[]; remainingToday: number }
  | { ok: false; error: string };
