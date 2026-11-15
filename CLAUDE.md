# cowork-hub

全国ネットワーク型コワーキングの会員サービス「ee-office（ええオフィス）」のサンプル。Claude Codeの学習用リポジトリ。
サービス名の表記は英語「ee-office」、日本語「ええオフィス」。リポジトリ名・インフラのリソース名は `cowork-hub`。
全体像・セットアップ手順は README.md を参照。

## 構成
- `backend/` Rails 8.1 APIモード＋MySQL 8.4。テストはRSpec（request spec中心）
- `frontend/` Next.js 16 App Router＋Tailwind CSS v4＋shadcn/ui
- `infra/` Terraform（ALB / ECS Fargate / RDS MySQL / ECR）

## 開発コマンド
- バックエンドのテスト: `cd backend && bundle exec rspec && bin/rubocop`
- フロントの検査: `cd frontend && npm run lint && npx tsc --noEmit && npm test`（単体テストはVitest。`src/**/*.test.ts(x)`）
- E2E: `cd frontend && npm run test:e2e`（Playwright。`e2e/`。Rails・Next.jsが起動していなければ自動で起動する。seedのデータが必要）
- Terraform: `terraform -chdir=infra fmt -recursive && terraform -chdir=infra validate`

## 実装の約束ごと
- APIはすべて `/api` 配下。本番ではALBが `/api/*` をRailsへ振り分ける
- 認証は `Authorization: Bearer <token>`（Sessionモデルのトークン）
- バリデーションエラーは422で `{ error, errors: { 項目名: [メッセージ] } }` を返す
- APIの仕様書は OpenAPI（`backend/swagger/v1/openapi.yaml`）。`spec/integration` のrswagのテストから生成し、レスポンスがスキーマどおりかも検証する。
  スキーマ（`components.schemas`）は `spec/swagger_helper.rb` に書く。APIを追加・変更したら
  1. `spec/integration` にテストを追加し、必要ならスキーマを直す
  2. `cd backend && bin/rails rswag:specs:swaggerize` で仕様書を再生成
  3. `cd frontend && npm run gen:api` で型（`src/lib/api-schema.ts`）を再生成。フロントは `lib/types.ts` の別名を使う
  CIで、生成物がコミットされているかを確認している
- フロントのデータ取得は Server Components（`lib/server/api.ts` の `apiFetch`）、更新は Server Actions（`app/actions/`）で行う。
  ブラウザからRails APIを直接呼ばない。クライアントコンポーネントは操作が必要な部分だけにする
- 認証トークンは httpOnly Cookie（`lib/server/session.ts`）。ページの認可は `requireUser` / `requireAdmin`
  - `src/proxy.ts`（旧middleware）はCookieの有無だけを見て、未ログインならページ描画前に `/login?next=...` へ送る（最終確認は requireUser と Rails）。
    ログインが必要なページを増やしたら `config.matcher` にも追加する
- フォームは `useActionForm(action, { schema, defaultValues })` ＋ `<FormErrors>` ＋ `<Field>`（React Hook Form＋Zod）。
  `<Field>` は子要素の name でReact Hook Formに登録し、その項目のエラー（ブラウザのチェック → Railsのエラー）を表示する。
  初期値は `<Input defaultValue>` ではなく `defaultValues` で渡す。
  スキーマは `lib/schemas.ts` に置き、Server Action側でも `parseInput` で同じスキーマを使って検証してからRailsへ送る。
  1クリックの操作は `ActionButton` に `.bind(null, id)` したServer Actionを渡す。取り消せない操作は `confirm` で確認ダイアログを出す
- 操作の結果は通知（Sonnerのトースト）で知らせる。成功時の文言は Server Action の `success("...")` で返す（フォームのエラーは従来どおり欄の下）
- 日時の表示は `lib/format.ts` を使う（サーバーはUTCなので、日本時間を明示している）
- ドメインの関係：拠点（Location）→ スペース（Space）→ 予約（Reservation）。ドロップイン利用は Visit（会員×拠点）
- 予約の重複防止は `Reservation.reserve!` でスペース行をロックしてから確認する。料金（amount）もここで確定する
- ドロップインは `Visit.check_in!`（会員行をロックして1拠点だけに制限）と `Visit#check_out!`（行をロックして料金を確定）で行う
- チェックアウトし忘れは、チェックインした日の閉店時刻（`Visit#auto_checkout_at`）で締める（`auto_checked_out: true`）。
  `Visit.auto_check_out_overdue!` を定期実行（`infra/scheduler.tf`）と、利用中かどうか・利用中の人数・料金を返すAPIの前で呼ぶ
- 営業時間・ドロップイン料金は拠点ごと（`Location#open_at?` / `Location#drop_in_fee`）。定数で持たない
- 月次の集計（請求 `MonthlyBill`・管理の売上）は `?month=YYYY-MM`（`MonthParam`）で受け取る
- 画面の文言・エラーメッセージは日本語。UIはshadcn/uiのコンポーネントを使う
- 秘密情報はコミットしない（本番はSSM / Secrets Manager経由）

## コードレビューの観点
重要度の高い順に確認する。

1. **バグ・仕様違反**：予約の重複・営業時間・プラン上限、ドロップインの二重チェックイン・料金計算（30分単位・上限・月額は0円）などのルールが守られているか。境界値（ちょうど隣接する時間帯、閉店時刻ちょうど、月末をまたぐ利用など）
2. **セキュリティ**：認可漏れ（他人の予約や管理者APIに触れないか）、Strong Parametersの漏れ、SQLインジェクション、秘密情報のコミット、XSS
3. **データ整合性**：トランザクション・ロックの範囲、マイグレーションの安全性（既存データへの影響）
4. **テスト**：振る舞いの変更に対応するrequest specがあるか。異常系もテストされているか
5. **パフォーマンス**：N+1クエリ（`includes` の有無）、不要な再レンダリング
6. **読みやすさ・一貫性**：上記の約束ごととの一貫性、命名、重複コード

指摘しないこと
- RuboCop・ESLint・`terraform fmt` で自動検出できる書式の問題（CIで検出済み）
- 根拠のない好みの押し付け

## GitHub Actionsでの運用メモ
- レビュー用・`@claude` 用のワークフローは、mainに入ってから有効になる（PR内で変更しても、そのPRでは動かない）
- `@claude` のpushは専用GitHub Appのトークンで行うので、CIと自動レビューが起動する
- ただし公開リポジトリでは、`@claude` のコミット（作者は `github-actions[bot]`。pushはAppのトークン）で起動したワークフローは毎回承認待ちになる。
  PRの「Approve and run workflows」を押して実行する（ボットの変更を確認してから実行させる運用）
  - 承認設定の変更や、マージコミットでボットのコミットを残す方法では解消しなかった
