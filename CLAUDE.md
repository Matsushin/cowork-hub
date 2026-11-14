# coworking-sample

コワーキングスペースの予約・会員管理サンプル。Claude Codeの学習用リポジトリ。
全体像・セットアップ手順は README.md を参照。

## 構成
- `backend/` Rails 8.1 APIモード＋MySQL 8.4。テストはRSpec（request spec中心）
- `frontend/` Next.js 15 App Router＋Tailwind CSS v4＋shadcn/ui
- `infra/` Terraform（ALB / ECS Fargate / RDS MySQL / ECR）

## 開発コマンド
- バックエンドのテスト: `cd backend && bundle exec rspec && bin/rubocop`
- フロントの検査: `cd frontend && npm run lint && npx tsc --noEmit`
- Terraform: `terraform -chdir=infra fmt -recursive && terraform -chdir=infra validate`

## 実装の約束ごと
- APIはすべて `/api` 配下。本番ではALBが `/api/*` をRailsへ振り分ける
- 認証は `Authorization: Bearer <token>`（Sessionモデルのトークン）
- バリデーションエラーは422で `{ error, errors: { 項目名: [メッセージ] } }` を返す。
  フロントは `useApiErrors` と `<Field name="...">` で項目ごとに表示する
- 予約の重複防止は `Reservation.reserve!` でスペース行をロックしてから確認する
- 画面の文言・エラーメッセージは日本語。UIはshadcn/uiのコンポーネントを使う
- 秘密情報はコミットしない（本番はSSM / Secrets Manager経由）

## コードレビューの観点
重要度の高い順に確認する。

1. **バグ・仕様違反**：予約の重複・営業時間・プラン上限などのルールが守られているか。境界値（ちょうど隣接する時間帯など）
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
- `@claude` のpushは専用GitHub Appのトークンで行うので、CIと自動レビューが再実行される
- `@claude` の修正コミットはボット名義のため、ボットのコミットを残すとき（初回など）はsquashではなくマージコミットで取り込む
