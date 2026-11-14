# coworking-sample

コワーキングスペースの**予約・会員管理**サンプルアプリです。
Claude Codeの学習用に、Rails API＋Next.jsで作り、AWS（ECS Fargate）にTerraformでデプロイします。

## 機能

| 区分 | 内容 |
|---|---|
| 会員 | 会員登録・ログイン、プロフィール編集、契約プランの確認 |
| 予約 | 空き状況の表示（30分単位）、予約・キャンセル、予約一覧 |
| 管理者 | 会員の検索・プラン変更・権限変更、全予約の一覧、スペースの登録・停止 |

予約のルール
- 営業時間は9:00〜21:00で、30分単位で予約します
- 同じスペースで時間が重なる予約はできません。スペースの行をロック（`SELECT ... FOR UPDATE`）してから重複を確認するので、同時に予約が来ても二重予約になりません
- プランごとに、月あたりの予約上限時間があります

## 構成

```
backend/    Rails 8.1（APIモード）＋MySQL 8.4、RSpec
frontend/   Next.js 15（App Router）＋Tailwind CSS v4＋shadcn/ui
infra/      Terraform（VPC / ALB / ECS Fargate / RDS MySQL / ECR）
bin/        デプロイ・seed用スクリプト
```

```
            ┌──────────── ALB（HTTP:80） ────────────┐
 ブラウザ → │  /api/*  → ECS: backend（Rails）        │ → RDS MySQL（プライベートサブネット）
            │  その他  → ECS: frontend（Next.js）     │
            └────────────────────────────────────────┘
```

フロントエンドは同じドメインの `/api` を呼び出します。そのためCORSの設定は不要です。ローカルでは、Next.jsのrewritesでRailsへ転送します。

## ローカル開発

ツールのバージョンは [mise](https://mise.jdx.dev/) で管理しています（Ruby 3.3 / Node 22 / Terraform 1.13）。

```bash
mise install
docker compose up -d           # MySQL
cd backend && bundle install && bin/rails db:prepare db:seed && bin/rails s -p 3001
cd frontend && npm install && npm run dev   # http://localhost:3000
```

開発用アカウント（seedで作成）
- 管理者：`admin@example.com` / `password123`
- 会員：`member@example.com` / `password123`

テスト

```bash
cd backend && bundle exec rspec && bin/rubocop
cd frontend && npm run lint && npx tsc --noEmit
```

## AWSへのデプロイ

```bash
cd infra
terraform init
terraform apply -var desired_count=0   # まずタスク0件で基盤とECRを作成
cd ..
bin/deploy                              # イメージをpush
terraform -chdir=infra apply            # タスクを起動（desired_count=1）
bin/seed-production                     # 初期データを投入
terraform -chdir=infra output app_url
```

本番の管理者パスワードの確認方法

```bash
aws ssm get-parameter --with-decryption --name /coworking-sample/backend/SEED_ADMIN_PASSWORD --query Parameter.Value --output text
```

費用の目安（東京リージョン・常時稼働）：ALB 約2,800円＋Fargate 2タスク 約2,500円＋RDS db.t4g.micro 約2,500円＋パブリックIPv4 約1,500円で、**月8,000〜9,000円程度**です。

使わないときは止められます。

```bash
terraform -chdir=infra apply -var desired_count=0   # タスクだけ停止（ALB・RDSの料金は継続）
terraform -chdir=infra destroy                      # すべて削除（データも消えます）
```

## Claude Codeによるコードレビュー

[Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) を使っています。

| ワークフロー | 動くタイミング | 内容 |
|---|---|---|
| `claude-review.yml` | PRの作成・更新時 | 変更をレビューし、該当行へのコメントと総評を日本語で投稿する |
| `claude.yml` | PR・Issueのコメントに `@claude` と書いたとき | 質問に答えたり、修正してコミットしたりする |

- レビューの観点とプロジェクトの規約は `CLAUDE.md` に書いています
- 指摘には重要度（【必須】【推奨】【参考】）を付けます
- `@claude` に反応するのは、オーナー・メンバー・コラボレーターのコメントだけです
- ドラフトPRとフォークからのPRは自動レビューの対象外です

## 学習用として割り切っている点

- HTTPSなし（独自ドメインを用意したら、ACM＋ALBの443リスナーを追加）
- Terraformのstateをローカルに置いている（チームで使う場合はS3バックエンドへ）
- NAT Gatewayを使わず、ECSタスクをパブリックサブネットに置いている（セキュリティグループでALBからの通信だけ許可）
- RDSはシングルAZで、削除時にスナップショットを作らない
