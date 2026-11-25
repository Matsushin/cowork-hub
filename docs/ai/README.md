# ee-office の AI 機能

既存の業務システム（Rails API ＋ Next.js）に、あとから AI を組み込む例として作る。
「現場の課題を聞く → 既存の API を道具として AI に渡す → 安全に本番で使える形にする → 効果を数字で示す」までを一通り行う。

| 順番 | 機能 | 使う人 | 状態 |
|---|---|---|---|
| 1 | 話して予約できるアシスタント（`/assistant`） | 会員 | 作成済み。評価 20/20・1件 約2円・応答 中央値 6.5秒（[結果](../../frontend/evals/booking/RESULTS.md)） |
| 2 | 売上・利用状況を質問できる分析アシスタント（`/admin/assistant`） | 運営者（管理者） | 作成済み。評価 16/16・確かめられない数字 0・1件 約1.8円・応答 中央値 4.9秒（[結果](../../frontend/evals/analytics/RESULTS.md)） |
| 3 | ご利用ルールに引用つきで答える FAQ ボット（RAG、`/rules`） | 会員 | 作成済み。評価 16/16・引用 9/9・1件 約1.5円・応答 中央値 4.0秒（[結果](../../frontend/evals/faq/RESULTS.md)） |

## 文書

- [01_課題メモ.md](01_課題メモ.md)：予約アシスタントの課題メモ（だれが何に困っているか、成功の基準。作る前に書く）
- [03_課題メモ_分析アシスタント.md](03_課題メモ_分析アシスタント.md)：分析アシスタントの課題メモ
- [04_課題メモ_FAQボット.md](04_課題メモ_FAQボット.md)：FAQ ボットの課題メモ（検索の方式・引用の設計の判断も）
- [../rules/](../rules/README.md)：ご利用ルール（FAQ ボットの元の文書）
- [02_AIに渡す操作.md](02_AIに渡す操作.md)：AI が呼んでよい API の許可リストと、その理由
- 評価データ：[`frontend/evals/booking/cases.json`](../../frontend/evals/booking/cases.json)（予約）、[`analytics/cases.json`](../../frontend/evals/analytics/cases.json)（分析）、[`faq/cases.json`](../../frontend/evals/faq/cases.json)（FAQ）
- 評価の結果：[`booking/RESULTS.md`](../../frontend/evals/booking/RESULTS.md)・[`analytics/RESULTS.md`](../../frontend/evals/analytics/RESULTS.md)・[`faq/RESULTS.md`](../../frontend/evals/faq/RESULTS.md)（流すたびに1行）

## 予約アシスタントの仕組み

```
会員の文章 ─▶ Server Action（入力を Zod で検証）
  ─▶ runBookingAssistant
       ├ runAiFeature：回数の上限 → Claude（道具：拠点の検索・詳細・空き状況・料金プラン）→ 利用量の記録
       ├ 最後の回答は構造化出力（kind・message・候補の ID と時刻だけ）
       └ 候補を API の値で確かめる（営業時間・30分単位・空き・過去でない）。名前と料金も API の値で付ける
  ─▶ 画面：候補のカード →「この内容で予約」→ 確認ダイアログ → 既存の予約の処理（POST /api/reservations）
```

- AI は候補の ID と時刻しか返さない。拠点名・料金などは API の値から付けるので、AI が料金を間違えても画面には出ない
- 確かめて外れた候補は画面に出さず、評価の「外した候補」として数える（今は0件）

## 分析アシスタントの仕組み

```
管理者の質問 ─▶ Server Action（管理者か・入力の長さを確かめる）
  ─▶ runAnalyticsAssistant
       ├ runAiFeature：回数の上限 → Claude（道具：利用状況の集計・会員数の集計・月次売上・拠点の検索）→ 利用量の記録
       ├ 最後の回答は構造化出力（kind・message・主な数字 figures）
       └ 答えの数字を、道具が返した値と照らし合わせる（値そのもの・列の合計・2つの値の差や比）
  ─▶ 画面：答え ＋ 主な数字（✓ 一致／⚠ 照らし合わせられない）＋ 使ったデータ
```

- **AI に SQL を書かせない**：集計は Rails の決まった API（`/api/admin/stats/usage`・`/stats/members`・`/sales`）だけ。取り消した予約を除く・締め忘れを閉店時刻で締める・稼働率の分母、などの数え方はコードで一つに決まる。AI が選ぶのは期間とまとめ方だけ
- **数字を照らし合わせる**：AI が作った数字や計算の間違いを見つけるため。ただし差や比は組み合わせが多く偶然当てはまることもあるので、「印がない＝正しい」の証明ではない。正しさは評価データで別に測る
- **個人の情報を渡さない**：道具は人数・件数・金額だけを返す。会員一覧・予約一覧（会員の情報を含む）の API は渡さない
- 開発環境の seed に、過去3か月の利用のデモデータが入る（乱数の種を固定。本番には入れない）

## FAQ ボットの仕組み

```
会員の質問 ─▶ Server Action（ログイン・入力の長さを確かめる）
  ─▶ runFaqAssistant
       ├ runAiFeature：回数の上限 → Claude（道具：ご利用ルールの検索・拠点の検索と詳細・料金プラン）→ 利用量の記録
       ├ search_rules：docs/rules を文字の2-gram の BM25 で探し、上位3項目を search_result ブロック（引用あり）で返す
       └ 答えの text ブロックの引用（citations）を、ご利用ルールの項目に結ぶ（ルールにない出典は捨てる）
  ─▶ 画面：答えの文 ＋ 根拠の番号 [1] ＋ 根拠の一覧（/rules#項目 へのリンク）
```

- **引用の場所は API が返す**：AI が出典を書くのではなく、Claude の citations が「どの検索結果のどの文か」を返す。AI が出典を作れない
- **変わる値は API から**：営業時間・料金・プランの上限は文書に書かない（`docs/rules/README.md`）。値の質問は拠点・プランの API で調べる
- **検索だけの評価を CI で流す**：`search.test.ts` の18件（質問 → 根拠の項目が上位3件に入るか）。Claude を呼ばないので料金なし
- 構造化出力は使わない（citations と同時には使えない）

## 評価の流し方

手元で Rails を起動し（`docker compose up -d`、seed 済み）、`frontend/.env.local` に `ANTHROPIC_API_KEY` を書いてから：

```bash
cd frontend && npm run eval:booking
```

- 実行ごとに評価用の会員を作り、20件を順に流す（1回 約40円・約2分）。結果は `evals/booking/results/`（コミットしない）と `RESULTS.md`
- 分析アシスタントは `npm run eval:analytics`（16件・1回 約30円・約1分半）。実行した日を「今日」として、seed のデモデータに対して流す。正解は同じ集計の API を評価から直接呼んで求める
- FAQ ボットは `npm run eval:faq`（16件・1回 約25円・約1分）
- `EVAL_ONLY=ケースのid` で1件だけ、`EVAL_EFFORT=medium` で考える深さを変えて比べられる
- 評価の期待を変えたときは、なぜ変えたか（仕様の判断）を `RESULTS.md` のメモに残す

## 共通の約束

- **AI に確定させない**：予約・変更・取り消しなど、取り消しにくい操作は人がボタンで行う。AI ができるのは調べて提案するまで
- **AI に特別な権限を持たせない**：AI の道具は、使っている人のトークンで既存の API を呼ぶ。見てよい範囲は Pundit がそのまま決める
- **計算・判定は既存のコードに任せる**：営業時間・30分単位・二重予約・料金・プランの上限は Rails の既存のロジックで決まる。AI に計算させない
- **数字で確かめる**：評価データの正答率、1回あたりの料金、応答時間を記録し、変更の前後で比べる
- **失敗しても困らない**：AI が答えられない・止まっているときは、通常の画面（拠点の検索・予約）へ案内する
