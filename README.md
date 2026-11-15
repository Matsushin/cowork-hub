# cowork-hub

**ee-office（ええオフィス）** は、全国のコワーキングスペースを会員がドロップイン（予約なし・時間課金）で使える会員サービスのサンプルアプリです。
Claude Codeの学習用に、Rails API＋Next.jsで作り、AWS（ECS Fargate）にTerraformでデプロイします。

> 全国ネットワーク型のコワーキングサービスを題材にした学習用の架空サービスです。実在の企業・サービスとは関係ありません。

## 機能

| 区分 | 内容 |
|---|---|
| 拠点 | 拠点の検索（都道府県・キーワード）、拠点ごとの営業時間・料金・利用中の人数の表示（ログインなしで閲覧可） |
| ドロップイン | 拠点にチェックイン／チェックアウトし、利用時間から料金を確定。利用中の表示、利用履歴 |
| 予約 | 拠点ごとの会議室・席の空き状況（30分単位）、予約・キャンセル、予約一覧 |
| 請求 | 月ごとの請求額（月額プラン＋ドロップイン利用料＋予約料金）と明細 |
| 会員 | 会員登録・ログイン、プロフィール編集、契約プランの確認 |
| 管理者 | 会員の検索・プラン変更・権限変更、拠点の登録・停止、スペースの登録・停止、全予約の一覧、拠点別・月別の売上集計 |

ドロップインのルール
- 拠点の営業時間内だけチェックインできます。同時に利用できるのは1拠点だけです（会員の行をロックしてから確認するので、同時に押しても二重にはなりません）
- 料金は30分ごとに1時間料金の半額（最低30分）、1回あたりの上限額があります。月額プランの会員は0円（全拠点使い放題）
- 料金はチェックアウト時に確定して保存します。月をまたいだ利用はチェックインした月に計上します
- チェックアウトし忘れた利用は、チェックインした日の閉店時刻で自動的にチェックアウトします（料金も閉店時刻まで。画面に「自動チェックアウト」と表示）。
  毎時5分の定期実行（EventBridge Scheduler → `bin/rails visits:auto_check_out`）に加えて、チェックイン時や利用状況・請求・売上の表示時にも締めます

予約のルール
- 営業時間は拠点ごとに異なり、30分単位で予約します
- 同じスペースで時間が重なる予約はできません。スペースの行をロック（`SELECT ... FOR UPDATE`）してから重複を確認するので、同時に予約が来ても二重予約になりません
- 料金は予約時点のスペースの1時間料金で確定します。プランごとに、月あたりの予約上限時間があります

請求・売上のルール
- 月額プラン料金は、その月の末日（今月は今日）時点の契約プランで計算します

## 構成

```
backend/    Rails 8.1（APIモード）＋MySQL 8.4、RSpec
frontend/   Next.js 16（App Router・Server Components）＋Tailwind CSS v4＋shadcn/ui
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
aws ssm get-parameter --with-decryption --name /cowork-hub/backend/SEED_ADMIN_PASSWORD --query Parameter.Value --output text
```

費用の目安（東京リージョン・常時稼働）：ALB 約2,800円＋Fargate 2タスク 約2,500円＋RDS db.t4g.micro 約2,500円＋パブリックIPv4 約1,500円で、**月8,000〜9,000円程度**です。

使わないときは止められます。

```bash
terraform -chdir=infra apply -var desired_count=0   # タスクだけ停止（ALB・RDSの料金は継続）
terraform -chdir=infra destroy                      # すべて削除（データも消えます）
```

### 独自ドメインでHTTPS化する

`domain_name` を指定すると、Route 53のホストゾーン・ACM証明書・HTTPSリスナーを作ります。HTTPはHTTPSへリダイレクトし、Next.jsのサーバーからRailsへの通信もHTTPS（`API_ORIGIN=https://<ドメイン>`）になります。Cookieには `Secure` 属性が付きます。

親ドメイン（例：`example.com`）が**別のAWSアカウント**にある前提で、サブドメイン（例：`coworking.example.com`）だけをこのアカウントに委任します。親ドメインのほかの設定（メールなど）には影響しません。

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
# terraform.tfvars に domain_name = "coworking.example.com" を書く（.gitignore済み）

# 1. サブドメインのホストゾーンだけを先に作る
terraform -chdir=infra apply -target=aws_route53_zone.app
terraform -chdir=infra output delegation_name_servers
```

2. 親ドメインがあるAWSアカウントのRoute 53で、親のホストゾーンにNSレコードを追加します。
   - レコード名：`coworking`（サブドメイン部分）
   - タイプ：NS
   - 値：上で表示された4つのネームサーバー

```bash
# 3. 残りを作る（証明書のDNS検証が終わるまで数分待つ）
terraform -chdir=infra apply
```

費用の追加は、ホストゾーン（月60円程度）だけです。ACMの証明書は無料です。

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

- 独自ドメインを指定しない場合はHTTPのみ。パスワードやトークンが平文で流れるので、**HTTPS化するまでは本番利用しない**
- Next.jsのサーバー → Rails は、HTTPS化してもALB（インターネット側）を経由する。内部通信（Service Connect）にはしていない
- Terraformのstateをローカルに置いている（チームで使う場合はS3バックエンドへ）
- NAT Gatewayを使わず、ECSタスクをパブリックサブネットに置いている（セキュリティグループでALBからの通信だけ許可）
- RDSはシングルAZで、削除時にスナップショットを作らない
