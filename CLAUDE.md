# cowork-hub

全国ネットワーク型コワーキングの会員サービス「ee-office（ええオフィス）」のサンプル。Claude Codeの学習用リポジトリ。
サービス名の表記は英語「ee-office」、日本語「ええオフィス」。リポジトリ名・インフラのリソース名は `cowork-hub`。
全体像・セットアップ手順は README.md を参照。

## 構成
- `backend/` Rails 8.1 APIモード＋MySQL 8.4。テストはRSpec（request spec中心）
- `frontend/` Next.js 16 App Router＋Tailwind CSS v4＋shadcn/ui
- `infra/` Terraform（ALB / ECS Fargate / RDS MySQL / ECR）

## 開発コマンド
- 開発環境：バックエンド（Rails・MySQL・Mailpit）は Docker（`docker compose up -d`）、フロントエンドは手元で `npm run dev`
  - Railsのコマンドはコンテナで実行する：`docker compose exec backend bin/rails ...`
  - 開発環境のメールは Mailpit（http://localhost:8025）に届く
- バックエンドのテスト: `docker compose exec backend bundle exec rspec && docker compose exec backend bin/rubocop`
- フロントの検査: `cd frontend && npm run lint && npm run format:check && npx tsc --noEmit && npm test`（単体テストはVitest。`src/**/*.test.ts(x)`）
- E2E: `cd frontend && npm run test:e2e`（Playwright。`e2e/`。`docker compose up -d` でRailsを起動しておく。Next.jsは起動していなければ自動で起動する。seedのデータが必要）
- Terraform: `terraform -chdir=infra fmt -recursive && terraform -chdir=infra validate`

## 実装の約束ごと
- APIはすべて `/api` 配下。本番ではALBが `/api/*` をRailsへ振り分ける
- 認証は `Authorization: Bearer <token>`（Sessionモデルのトークン）
- 権限チェックはPundit（`app/policies/`）。見てよい範囲は `policy_scope`、1件への操作は `authorize` で確認する
  - 他人のレコードは `policy_scope(...).find` で404にする（存在を知られないため403にしない）
  - 管理APIは `Admin::BaseController` の `authorize :admin, :access?`（AdminPolicy）。許可されなければ403
  - 予約のキャンセル可否（開始前か）などの業務ルールはPolicyに入れず、モデルで判定して422を返す
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
  - `src/proxy.ts`（旧middleware）は、すべてのページの前で
    1. Basic 認証（`BASIC_AUTH_USER`・`BASIC_AUTH_PASSWORD` があるときだけ。本番のみ）を確かめ、
    2. ログインが必要なページ（`lib/login-required.ts`）なら Cookie の有無だけを見て、未ログインならページ描画前に `/login?next=...` へ送る（最終確認は requireUser と Rails）。
    ログインが必要なページを増やしたら `lib/login-required.ts` に追加する（`config.matcher` はすべてのページ）
  - Rails の API は外から直接使えない。本番の ALB は、`apiFetch` が付けるヘッダー `X-Internal-Api-Key` の合う `/api/*` だけを Rails に通す
- フォームは `useActionForm(action, { schema, defaultValues })` ＋ `<FormErrors>` ＋ `<Field>`（React Hook Form＋Zod）。
  `<Field>` は子要素の name でReact Hook Formに登録し、その項目のエラー（ブラウザのチェック → Railsのエラー）を表示する。
  初期値は `<Input defaultValue>` ではなく `defaultValues` で渡す。
  スキーマは `lib/schemas.ts` に置き、Server Action側でも `parseInput` で同じスキーマを使って検証してからRailsへ送る。
  1クリックの操作は `ActionButton` に `.bind(null, id)` したServer Actionを渡す。取り消せない操作は `confirm` で確認ダイアログを出す
- 操作の結果は通知（Sonnerのトースト）で知らせる。成功時の文言は Server Action の `success("...")` で返す（フォームのエラーは従来どおり欄の下）
- 日時の表示は `lib/format.ts` を使う（サーバーはUTCなので、日本時間を明示している）
- URLのクエリパラメータ（`?date=` `?month=` `?q=` `?filter=`）は nuqs で扱う。定義は `lib/search-params.ts` に集約し、
  Server Component は `load...Params(searchParams)`、クライアントは `useQueryState`（再取得が必要なら `shallow: false`）、リンクは `serialize...` を使う
- ドメインの関係：拠点（Location）→ スペース（Space）→ 予約（Reservation）。ドロップイン利用は Visit（会員×拠点）
- 予約の重複防止は `Reservation.reserve!` でスペース行をロックしてから確認する。料金（amount）もここで確定する
- ドロップインは `Visit.check_in!`（会員行をロックして1拠点だけに制限）と `Visit#check_out!`（行をロックして料金を確定）で行う
- チェックアウトし忘れは、チェックインした日の閉店時刻（`Visit#auto_checkout_at`）で締める（`auto_checked_out: true`）。
  `Visit.auto_check_out_overdue!` を定期実行（`infra/scheduler.tf`）と、利用中かどうか・利用中の人数・料金を返すAPIの前で呼ぶ
- チェックインは受付のQRコードが必須（`POST /api/visits` の `code`）。コードは `CheckinCode`（HMAC：`secret_key_base` から作った鍵＋拠点ID＋60秒の時間枠。DBに保存しない）で、
  今と1つ前の時間枠を有効にする。無効なら422（`errors.code`）。コードの取得は管理APIの `GET /api/admin/locations/:id/checkin_code` だけ。
  受付用QRは `/admin/locations/[id]/qr` でサーバー側でSVGにし（`qrcode`）、残り0秒で `router.refresh()` する
- 営業時間・ドロップイン料金は拠点ごと（`Location#open_at?` / `Location#drop_in_fee`）。定数で持たない
- 月次の集計（請求 `MonthlyBill`・管理の売上）は `?month=YYYY-MM`（`MonthParam`）で受け取る
- 画面の文言・エラーメッセージは日本語。UIはshadcn/uiのコンポーネントを使う
- 非同期処理は Active Job ＋ Solid Queue（キューはアプリと同じDB。ワーカーはPumaの中で動く：`config/puma.rb`）。
  メールは `deliver_later` で送る。開発環境は letter_opener（実際には送らずブラウザで開く）、テストは `have_enqueued_mail` で確認する。
  本番は `SMTP_ADDRESS` などの環境変数を渡すまで送信しない
- 秘密情報はコミットしない（本番はSSM / Secrets Manager経由）

## 画面のキャプチャ（PR）
- 画面に関わるファイル（`frontend/src`・`frontend/e2e`）が変わったPRでは、`.github/workflows/pr-screenshots.yml` が
  変更前（分岐元）と変更後の画面を seed のデータで撮り、PRにコメントする（同じコメントを更新する）。E2Eのテストを変えたら、その操作をGIFで貼る
- 撮るページは `frontend/screenshots/targets.mjs` が変わったファイルから決める（import をたどり、そのファイルを使うページ・レイアウトだけを撮る。型だけの import はたどらない）。ページの一覧は `frontend/screenshots/pages.mjs`（ページを増やしたら追加する）
- 画像は専用ブランチ `pr-screenshots` に置いている（GitHubには画像をアップロードするAPIがないため）。このブランチはマージしない

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

## Claude Code の設定（`.claude/`）
- 機能を追加・変更するときは、スキル `add-feature`（`.claude/skills/add-feature/SKILL.md`）の手順に沿って進める
- 本番のエラー（ラベル `incident` の Issue）を調べる・直すときは、スキル `fix-incident`（`.claude/skills/fix-incident/SKILL.md`）の手順に沿う
- 変更のセキュリティを確かめるときは、スキル `security-check` のチェックリストを使う（PR ごとに `.github/workflows/claude-security-review.yml` も同じ手順で見る）
- PostToolUse のフック（`.claude/hooks/format-edited-file.sh`）が、編集したファイルを自動で整形する
  （Ruby は RuboCop、TS/JS などは Prettier → ESLint、Terraform は terraform fmt）。自動で直せない指摘は Claude に返される
- Prettier の設定は `frontend/.prettierrc.json`（1行130文字）。生成物（`api-schema.ts`）と `components/ui/` は `.prettierignore` で除外。
  全体を整形するときは `npm run format`（Prettier を既定の設定で直接実行しない）
- 個人用の設定は `.claude/settings.local.json` に書く（コミットしない）

## GitHub Actionsでの運用メモ
- Issue にラベル `claude-implement` を付けると、Claude Code がスキル `add-feature` に沿って実装し、PRを作る（`.github/workflows/claude.yml`）。
  Issue は `.github/ISSUE_TEMPLATE/feature.yml`（背景・仕様・受け入れ条件）で書く。PRには自動レビューが走り、指摘は `@claude` で直させる。マージは人が行う
  - Issue 本文は信頼できない入力になりうる（プロンプトインジェクション）。ラベルを付ける前に、本文を必ず読んで内容を確認する
  - ラベル起動は Issue の作者が OWNER / MEMBER / COLLABORATOR のときだけ動く。`--allowedTools` は任意コードの実行を防ぐものではなく、止まらないようにするためのもの
  - 本番エラーの Issue（ラベル `incident`）は `.github/workflows/incident.yml` が Sentry から作り、Claude Code が原因をコメントする。
    作成者は専用 GitHub App（`matsushin-claude-bot[bot]`）なので、`claude-implement` の起動条件で incident の Issue だけを例外として許可している
  - `@claude`（GitHub App）には workflows の権限がないため、`.github/workflows/` の変更はpushできない。ワークフローの修正は人が手元で行う
- レビュー用・`@claude` 用のワークフローは、mainに入ってから有効になる（PR内で変更しても、そのPRでは動かない）
- `@claude` のpushは専用GitHub Appのトークンで行うので、CIと自動レビューが起動する
- ただし公開リポジトリでは、`@claude` のコミット（作者は `github-actions[bot]`。pushはAppのトークン）で起動したワークフローは毎回承認待ちになる。
  PRの「Approve and run workflows」を押して実行する（ボットの変更を確認してから実行させる運用）
  - 承認設定の変更や、マージコミットでボットのコミットを残す方法では解消しなかった
