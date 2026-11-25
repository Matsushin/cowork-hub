// ご利用ルールの検索（FAQ ボットの道具 search_rules の中身）
//   文書が少ない（数十項目）ので、外部の検索サービスや埋め込み（ベクトル）は使わず、文字の2-gram の BM25 で探す。
//   日本語は単語の区切りがないので、2文字ずつに区切って数える（「取り消し」→「取り」「り消」「消し」）
//   項目（## 見出し）が検索の1単位。見出しは本文より重く数える
import { RULE_DOCS, type RuleSection } from "./generated-rules";

export type RuleChunk = RuleSection & { docTitle: string; file: string };

export const RULE_CHUNKS: RuleChunk[] = RULE_DOCS.flatMap((doc) =>
  doc.sections.map((s) => ({ ...s, docTitle: doc.title, file: doc.file })),
);

/** 表記のゆれをそろえる（全角・半角、カタカナ・ひらがな、記号と空白を除く） */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s、。・，．,.!?！？「」『』（）()【】［］\[\]:：;；/／\-ー〜~＝=]/g, "");
}

export function bigrams(text: string): string[] {
  const s = normalize(text);
  if (s.length < 2) return s ? [s] : [];
  return Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2));
}

const HEADING_WEIGHT = 3;
const K1 = 1.2;
const B = 0.75;

type Indexed = { chunk: RuleChunk; tf: Map<string, number>; length: number };

function index(chunks: RuleChunk[]) {
  const docs: Indexed[] = chunks.map((chunk) => {
    const tf = new Map<string, number>();
    const add = (text: string, weight: number) => bigrams(text).forEach((g) => tf.set(g, (tf.get(g) ?? 0) + weight));
    add(`${chunk.docTitle}${chunk.heading}`, HEADING_WEIGHT);
    chunk.blocks.forEach((b) => add(b, 1));
    return { chunk, tf, length: [...tf.values()].reduce((a, b) => a + b, 0) };
  });
  const df = new Map<string, number>();
  docs.forEach((d) => d.tf.forEach((_, g) => df.set(g, (df.get(g) ?? 0) + 1)));
  const avg = docs.reduce((s, d) => s + d.length, 0) / Math.max(docs.length, 1);
  return { docs, df, avg };
}

const DEFAULT_INDEX = index(RULE_CHUNKS);

/** 質問に近い項目を、近い順に最大 limit 件返す（どの語にも当たらなければ空） */
export function searchRules(query: string, limit = 3, idx = DEFAULT_INDEX): { chunk: RuleChunk; score: number }[] {
  const terms = [...new Set(bigrams(query))];
  const n = idx.docs.length;
  return idx.docs
    .map((d) => {
      let score = 0;
      for (const g of terms) {
        const f = d.tf.get(g);
        if (!f) continue;
        const df = idx.df.get(g) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / idx.avg)));
      }
      return { chunk: d.chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 項目の画面の場所（引用のリンク先） */
export const ruleHref = (id: string) => `/rules#${id}`;
