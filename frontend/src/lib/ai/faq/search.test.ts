import { describe, expect, it } from "vitest";
import { bigrams, normalize, RULE_CHUNKS, searchRules } from "./search";

describe("normalize・bigrams", () => {
  it("全角・半角、カタカナ・ひらがな、記号と空白をそろえる", () => {
    expect(normalize("ＱＲコード、チェックイン！")).toBe("qrこどちぇっくいん"); // 長音（ー）も除く（「サーバー」「サーバ」のような書き方のゆれ）
    expect(bigrams("取り消し")).toEqual(["取り", "り消", "消し"]);
  });
});

describe("ご利用ルールのデータ", () => {
  it("項目の ID が重ならず、どの項目にも本文がある", () => {
    const ids = RULE_CHUNKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RULE_CHUNKS.every((c) => c.blocks.length > 0)).toBe(true);
  });

  it("変わる値（料金の金額・営業時間の時刻）を書いていない（拠点・プランの API から調べる約束）", () => {
    const text = RULE_CHUNKS.flatMap((c) => c.blocks).join("\n");
    expect(text).not.toMatch(/\d{1,3},\d{3}円|\d{3,}円/);
    expect(text).not.toMatch(/\d{1,2}:\d{2}|\d{1,2}時〜/);
  });
});

// 検索の評価（Claude を呼ばないので、料金なしで毎回流せる）：質問から、根拠になる項目が上位3件に入るか
const RETRIEVAL_CASES: [string, string][] = [
  ["予約をキャンセルしたらお金はかかる？", "cancel-fee"],
  ["予約は何日前まで取り消せる？", "cancel-deadline"],
  ["予約の取り消し方を教えて", "how-to-cancel"],
  ["チェックアウトを忘れたらどうなる？", "forgot-check-out"],
  ["月額プランでもドロップインは有料？", "drop-in-fee"],
  ["会議室は何分単位で予約できますか", "reservable-hours"],
  ["メールアドレスを変えたい", "profile"],
  ["プランを変えたい", "change-plan"],
  ["2つの拠点に同時にいられる？", "one-location"],
  ["月をまたいで使ったらどの月の請求？", "across-months"],
  ["QRコードはどこにある？", "check-in"],
  ["支払い方法は？", "payment"],
  ["予約の上限を超えたらどうなる", "monthly-limit"],
  ["月の途中でプランを変えたら日割りになる？", "plan-fee"],
  ["予約したら確認のメールは来る？", "reservation-mail"],
  ["同じ部屋に重ねて予約できる？", "no-double-booking"],
  ["予約した後で料金が上がったら？", "reservation-fee"],
  ["登録にお金はかかる？", "signup"],
];

describe("searchRules（検索の評価）", () => {
  it.each(RETRIEVAL_CASES)("「%s」→ %s が上位3件に入る", (query, id) => {
    expect(searchRules(query).map((r) => r.chunk.id)).toContain(id);
  });

  it("当てはまる語がなければ空", () => {
    expect(searchRules("xyz")).toEqual([]);
  });
});
