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
frontend/   Next.js 15（App Router・Server Components）＋Tailwind CSS v4＋shadcn/ui
infra/      Terraform（VPC / ALB / ECS Fargate / RDS MySQL / ECR）
bin/        デプロイ・seed用スクリプト
```

```
            ┌──────────── ALB（HTTP:80） ────────────┐
 ブラウザ → │  /api/*  → ECS: backend（Rails）        │ → RDS MySQL（プライベートサブネット）
            │  その他  → ECS: frontend（Next.js）     │
            └────────────────────────────────────────┘
```

フロントエンドは、データの取得を **Server Components**、更新を **Server Actions** で行います。どちらもNext.jsのサーバーからRails APIを呼ぶので、ブラウザがRailsを直接呼ぶことはありません。

- 認証トークンは httpOnly Cookie に保存します。JavaScriptからは読めません
- Rails APIの接続先は環境変数 `API_ORIGIN` で指定します（ローカルは `frontend/.env.development`、本番はALBのURL）

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
| `claude.yml` | PR・Issueのコメントやレビュー、Issueの作成・アサインで `@claude` と書いたとき | 質問に答えたり、修正してコミットしたりする |

- レビューの観点とプロジェクトの規約は `CLAUDE.md` に書いています
- 指摘には重要度（【必須】【推奨】【参考】）を付けます
- `@claude` に反応するのは、オーナー・メンバー・コラボレーターのコメントだけです
- ドラフトPRとフォークからのPRは自動レビューの対象外です

### セットアップに必要なシークレット・変数

リポジトリの Settings → Secrets and variables → Actions で登録します。値はリポジトリにコミットしないでください。

| 名前 | 種類 | 役割 |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | シークレット | Claude Codeの認証トークン。`claude-review.yml` と `claude.yml` がClaudeを呼び出すときに使う（`ANTHROPIC_API_KEY` で代用も可） |
| `CLAUDE_APP_ID` | 変数（Variables） | 専用GitHub AppのID。設定すると `claude.yml` がAppのトークンを発行し、Claudeのpushでも CI と自動レビューが起動する。未設定なら既定のトークンで動く（その場合、pushではCIが起動しない） |
| `CLAUDE_APP_PRIVATE_KEY` | シークレット | 専用GitHub Appの秘密鍵。`CLAUDE_APP_ID` とあわせてAppのトークンを発行するために使う |

## 学習用として割り切っている点

- HTTPSなし（独自ドメインを用意したら、ACM＋ALBの443リスナーを追加）
  - ブラウザ → ALB に加えて、Next.jsのサーバー → Rails もALB（HTTP）経由のため、トークンやパスワードが平文で流れる。
    **HTTPS化、または内部通信（Service Connect／内部ALB）にするまでは本番利用しない**
- Terraformのstateをローカルに置いている（チームで使う場合はS3バックエンドへ）
- NAT Gatewayを使わず、ECSタスクをパブリックサブネットに置いている（セキュリティグループでALBからの通信だけ許可）
- RDSはシングルAZで、削除時にスナップショットを作らない
