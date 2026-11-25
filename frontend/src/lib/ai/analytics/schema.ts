// 分析アシスタントの入力と回答の形（画面とサーバーの両方で使う）
import { z } from "zod";

export const FIGURE_UNITS = ["円", "件", "時間", "%", "人", "倍"] as const;

/** AI の最後の回答の形（構造化出力）。数字は figures に分けて出させ、サーバーが道具の結果と照らし合わせる */
export const analyticsReplySchema = z.object({
  kind: z
    .enum(["answer", "clarify", "no_data", "refuse"])
    .describe("answer=答える、clarify=聞き返す、no_data=その期間のデータがない、refuse=範囲外・答えられない"),
  message: z
    .string()
    .describe("管理者への答え（日本語・300字以内）。数字は道具の結果の値をそのまま使い、自分で計算した数字は書かない"),
  figures: z
    .array(
      z.object({
        label: z.string().describe("何の数字か（例：渋谷の10月の売上）"),
        value: z.number().describe("道具の結果の値。金額は円、割合は％の数（12.5% なら 12.5）"),
        unit: z.enum(FIGURE_UNITS),
      }),
    )
    .describe("答えの主な数字（最大6件）。kind が answer 以外なら空"),
});
export type AnalyticsReply = z.infer<typeof analyticsReplySchema>;
export type Figure = AnalyticsReply["figures"][number];

export const analyticsQuestionSchema = z
  .string()
  .trim()
  .min(1, "質問を入力してください")
  .max(300, "300文字以内で入力してください");

/** 画面に出す数字。道具の結果と照らし合わせられたか（verified）を付ける */
export type CheckedFigure = Figure & { verified: boolean };

/** 使ったデータ（道具の呼び出し）。画面に「何を見て答えたか」として出す */
export type AnalyticsSource = { label: string; href?: string };

export type AnalyticsResult =
  | {
      ok: true;
      kind: AnalyticsReply["kind"];
      message: string;
      figures: CheckedFigure[];
      /** 答えの文の中の、照らし合わせられなかった数字 */
      unverifiedInMessage: string[];
      sources: AnalyticsSource[];
      remainingToday: number;
    }
  | { ok: false; error: string };
