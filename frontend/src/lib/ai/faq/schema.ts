// FAQ ボットの入力と回答の形（画面とサーバーの両方で使う）
import { z } from "zod";

export const faqQuestionSchema = z.string().trim().min(1, "質問を入力してください").max(300, "300文字以内で入力してください");

/** 答えの文の一部と、その部分の根拠（ご利用ルールの項目） */
export type FaqSegment = { text: string; sourceIds: string[] };
export type FaqSource = { id: string; title: string; href: string };

export type FaqResult =
  | {
      ok: true;
      segments: FaqSegment[];
      sources: FaqSource[];
      /** ご利用ルールを引用したか、拠点・プランの値（API）を使ったか。どちらもなければ、根拠のない答え */
      grounded: boolean;
      remainingToday: number;
    }
  | { ok: false; error: string };
