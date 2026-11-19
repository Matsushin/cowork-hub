---
name: add-feature
description: ee-office（cowork-hub）に機能を追加・変更するときの手順。APIの追加や変更、テーブル・カラムの追加、画面の追加など、backend と frontend にまたがる実装を始める前に読む。仕様の確認 → マイグレーション → モデル → API → テスト → OpenAPI → 型の生成 → 画面 → 検証 → PR の順に進める。
---

# 機能を追加する手順（ee-office）

実装の約束ごと（認可・エラー形式・フォームの作り方など）は CLAUDE.md にある。この手順はそれを**どの順で、どこに書くか**をまとめたもの。
各段階の終わりに「確認」を満たしてから次へ進む。書式（RuboCop・Prettier・ESLint・terraform fmt）は PostToolUse のフックが自動で整える。

フックについて
- 返ってくるのは自動で直せない**エラー**だけ。ESLint の警告（未使用の import など）は返らないので、手順9の `npm run lint` で拾う
- 1つの変更を複数回の Edit に分けると、途中の状態でエラーが返る。import や定義を先に足してから、使う側を書く
- リポジトリ直下のファイル（README.md・CLAUDE.md）や `config/locales/*.yml` は整形の対象外

## 0. 仕様を確かめる（コードを書く前）

- 受け入れ条件を箇条書きにする。曖昧な点（料金・権限・営業時間外の扱いなど）はユーザーに確認してから進める
- **境界値**を先に洗い出す：ちょうど隣接する時間帯、閉店時刻ちょうど、月末・日付をまたぐ利用、0件・上限ちょうど
- 誰が使えるか（未ログイン／会員／管理者）と、他人のデータが見えないかを決める
- 変更が大きい場合は、触るファイルの一覧と手順をユーザーに見せてから実装する

## 1. データベース（`backend/db/migrate/`）

- `docker compose exec backend bin/rails g migration ...` で作る
- 既存データがある前提で書く：NOT NULL を足すときは既定値か、データを埋めてから `change_column_null`
- 整合性はDBでも守る：外部キー、必要なら `add_check_constraint`、検索に使う列のインデックス
- `docker compose exec backend bin/rails db:migrate` のあと、`db/schema.rb` の差分を確認する

## 2. モデル（`backend/app/models/`）

- 業務ルール（料金計算・営業時間・二重登録の防止）はモデルに置く。コントローラーやPolicyには置かない
- 同時に実行されると壊れる処理は、行をロックしてから確認する（例：`Reservation.reserve!`、`Visit.check_in!`）
- 時刻は `Time.current`、拠点ごとの値（営業時間・料金）は `Location` から取る。定数で持たない

## 3. API（routes・controller・policy・serializer）

- ルートは `config/routes.rb` の `/api` の中。管理者用は `Admin::` 配下で `Admin::BaseController` を継承する
- 認可は Pundit：一覧は `policy_scope`、1件の操作は `authorize`。他人のレコードは `policy_scope(...).find` で404
- パラメータは Strong Parameters で受ける。月の指定は `MonthParam`（`?month=YYYY-MM`）
- レスポンスは `app/serializers/` で組み立てる。バリデーションエラーは422で `{ error, errors }`

## 4. テスト（`backend/spec/requests/`）

最低限そろえるもの：
- 正常系
- 異常系：バリデーションエラー（422）、業務ルール違反（422）
- 認可：未ログイン（401）、他人のデータ（404）、一般会員が管理APIを使う（403）
- 手順0で洗い出した境界値。時刻に依存する処理は `travel_to` で固定する

確認：`docker compose exec backend bundle exec rspec`

## 5. API仕様書（OpenAPI）

request spec と rswag で同じケースを二重に書かない。分担は次のとおり。
- **request spec（`spec/requests/`）**：振る舞いの確認。異常系・認可・境界値は全部ここに書く
- **rswag（`spec/integration/`）**：仕様書とレスポンスの形の確認。エンドポイントごとに、正常系と、仕様書に載せたい代表的なエラー（例：422・403）を1つずつ

1. `spec/integration/` に rswag のテストを追加（レスポンスがスキーマどおりかも検証される）
2. 新しい形のレスポンスは `spec/swagger_helper.rb` の `components.schemas` に追加・修正
3. `cd backend && bin/rails rswag:specs:swaggerize` で `swagger/v1/openapi.yaml` を再生成

## 6. フロントエンドの型

1. `cd frontend && npm run gen:api` で `src/lib/api-schema.ts` を再生成（手で編集しない）
2. 新しいスキーマは `src/lib/types.ts` に別名を足し、画面からはその別名を使う

## 7. 画面（`frontend/src/`）

- データ取得は Server Component で `lib/server/api.ts` の `apiFetch`。更新は `app/actions/` の Server Action
- ブラウザから Rails API を直接呼ばない。`"use client"` は操作が必要な部品だけにする
- フォームは `useActionForm` ＋ `<Field>` ＋ `<FormErrors>`。Zod のスキーマは `lib/schemas.ts` に置き、Server Action でも `parseInput` で同じスキーマを使う
- 成功の通知は Server Action の `success("...")`。取り消せない操作は `confirm` で確認する
- ログインが必要なページを増やしたら `requireUser` / `requireAdmin` に加えて、`src/proxy.ts` の `config.matcher` にも追加する
- URLのクエリは `lib/search-params.ts`（nuqs）に定義する。日時の表示は `lib/format.ts`
- 文言は日本語、UIは `components/ui/`（shadcn/ui）を使う
- 判定や変換のロジックは関数に切り出し、Vitest の単体テスト（`*.test.ts`）を書く

### 依存パッケージを足すとき
- まず既存の依存や標準機能で足りないかを確かめる。足すなら、なぜ必要かをPRの説明に書く
- npm：`cd frontend && npm install --save-exact <パッケージ>@<バージョン>`（バージョンを固定する）。`package.json` と `package-lock.json` を両方コミットする。開発用だけなら `-D`
- gem：`Gemfile` に追記し `docker compose exec backend bundle install`。`Gemfile.lock` もコミットする

## 8. ドキュメント

- 利用者に見える機能を足したら README.md の機能一覧を更新する
- 新しい業務ルールや実装の約束ごとができたら CLAUDE.md の「実装の約束ごと」に1〜2行で追記する

## 9. 検証（PRを作る前に全部通す）

```bash
docker compose exec backend bundle exec rspec && docker compose exec backend bin/rubocop
cd frontend && npm run lint && npm run format:check && npx tsc --noEmit && npm test
cd frontend && npm run test:e2e   # 画面の流れを変えたとき
```

インフラを変えたときは `terraform -chdir=infra fmt -recursive && terraform -chdir=infra validate` も実行する。
最後に、アプリを起動して実際の画面で動きを確認する。

### E2E（Playwright）を書くときの注意
- seed のデータを前提にする（拠点名・アカウント）。テストの中でseedに無いデータを当てにしない
- **現在時刻に左右される処理**（営業時間内だけできる操作など）は、Rails の時刻を固定できないため、条件に合わない時間帯は
  `test.skip(条件, "理由")` で理由つきでスキップする。境界値の確認は request spec（`travel_to`）に任せる
- **状態を残さない**：チェックインしたらチェックアウトする、予約したらキャンセルするなど、テストの最後で元に戻す。
  ほかのテストや次の実行が、残った状態で失敗しないようにする
- ローカルの E2E は開発用DB（seed）をそのまま使うので、実行すると利用履歴や予約が記録として残る。
  消したいときは `docker compose exec backend bin/rails db:seed:replant`（全テーブルを空にしてseedを入れ直す。手で作ったデータも消えるので、実行前にユーザーに確認する）

## 10. 自分でレビューしてからPR

- CLAUDE.md の「コードレビューの観点」の順（バグ・仕様違反 → セキュリティ → データ整合性 → テスト → パフォーマンス → 読みやすさ）で差分を見直す
- `swagger/v1/openapi.yaml` と `src/lib/api-schema.ts` を再生成してコミットしたか確認する（CIで検査される）
- ブランチを切ってコミットし、PRの説明には「何を・なぜ」「確認したこと」「確認できていないこと」を書く
- マージはしない（ユーザーが行う）

## GitHub Actions で実行するとき（Issue のラベル claude-implement から）

- Docker は無い。MySQL はサービスコンテナで起動済み、gem と npm パッケージもインストール済み。
  `docker compose exec backend` を付けずに、`backend/` で `bundle exec rspec`・`bin/rubocop`・`bin/rails ...` を直接実行する
- E2E（Playwright）と、ブラウザでの画面確認はできない。PRの「確認できていないこと」に書く
- フック（PostToolUse）は動かない前提で、手順9の lint と `npm run format:check` を必ず通す
- 仕様が曖昧で決められない点があれば、推測で実装せずに Issue へ質問をコメントして止める
- 最後に `gh pr create` で main へのPRを作る（本文に `Closes #Issue番号`）。マージはしない
