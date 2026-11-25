# cowork-hub

**ee-office（ええオフィス）** は、全国のコワーキングスペースを会員がドロップイン（予約なし・時間課金）で使える会員サービスのサンプルアプリです。
Claude Codeの学習用に、Rails API＋Next.jsで作り、AWS（ECS Fargate）にTerraformでデプロイします。

> 全国ネットワーク型のコワーキングサービスを題材にした学習用の架空サービスです。実在の企業・サービスとは関係ありません。

**デモ環境**：https://ee-office.matsushin.tech （毎日 20:00〜翌3:00 は停止）
ボットや検索エンジン避けの Basic 認証をかけています。ID `ee-office`／パスワード `password1122`

## 機能

| 区分 | 内容 |
|---|---|
| 拠点 | 拠点の検索（都道府県・キーワード）、拠点ごとの営業時間・料金・利用中の人数の表示（ログインなしで閲覧可） |
| ドロップイン | 受付のQRコードを読んでチェックインし、チェックアウト時に利用時間から料金を確定。利用中の表示、利用履歴 |
| 予約 | 拠点ごとの会議室・席の空き状況（30分単位）、予約・キャンセル、予約一覧 |
| 請求 | 月ごとの請求額（月額プラン＋ドロップイン利用料＋予約料金）と明細 |
| 会員 | 会員登録・ログイン、プロフィール編集、契約プランの確認 |
| 管理者 | 会員の検索・プラン変更・権限変更、拠点の登録・停止、受付用QRの表示（60秒ごとに更新）、スペースの登録・停止、全予約の一覧、拠点別・月別の売上集計 |

ドロップインのルール
- チェックインは受付に表示したQRコードを読んだときだけできます（拠点にいることを確かめるため。拠点ページには案内だけを表示）。
  QRは管理画面の「受付用QR」（`/admin/locations/[id]/qr`）を受付のタブレットで開いておき、60秒ごとに新しくなります。
  コードは秘密鍵で「拠点ID＋60秒の時間枠」から作るHMAC（DBには保存しない）で、今と1つ前の時間枠のものが有効（最長で約2分）。チェックアウトはボタンで行います
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

## AI 機能（作っているもの）

既存の API に AI をあとから組み込む例として、会員向けの「話して予約できるアシスタント」（`/assistant`）を作りました。「明日の午後、渋谷で4人・2時間」のように書くと、AI が API の仕様書から作った道具で空きを調べて候補を出し、会員がボタンで予約します（AI は予約しません）。

- 評価データ20件で **正答 20/20・1件あたり約2円・応答時間の中央値 6.5秒**（[評価の結果](frontend/evals/booking/RESULTS.md)）

管理者向けには「売上・利用状況を質問できる分析アシスタント」（`/admin/assistant`）を作りました。「先月は何曜日の予約が多かった？」のように聞くと、AI が集計用の API だけを使って答えます。AI に SQL や計算はさせず、答えの数字は集計の結果と照らし合わせて、確かめられない数字には印を付けます。

- 評価データ16件で **正答 16/16・確かめられない数字 0・1件あたり約1.8円・応答時間の中央値 4.9秒**（[評価の結果](frontend/evals/analytics/RESULTS.md)）

会員向けには「ご利用ルールに答える FAQ ボット」（`/rules`）も作りました。AI がご利用ルール（`docs/rules/`）を検索し、答えの文に根拠の項目を引用して返します（RAG）。営業時間や料金のような変わる値は文書に書かず、API から調べます。

- 評価データ16件で **正答 16/16・引用 9/9・1件あたり約1.5円・応答時間の中央値 4.0秒**（[評価の結果](frontend/evals/faq/RESULTS.md)）。検索だけの評価18件は CI で毎回流しています
- 課題メモ・AI に渡す操作の許可リスト・仕組み・評価の流し方は [docs/ai/](docs/ai/README.md) にあります

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

ツールのバージョンは [mise](https://mise.jdx.dev/) で管理しています（Ruby 4.0 / Node 26 / Terraform 1.17）。

バックエンド（Rails・MySQL・メール確認用のMailpit）は **Docker** で、フロントエンド（Next.js）は手元で動かします。

```bash
mise install                                   # Node（フロント用）など
docker compose up -d                           # MySQL・Rails（:3001）・Mailpit（:8025）。初回はイメージのビルドに数分かかります
docker compose exec backend bin/rails db:seed  # 初回のみ。DBの作成・マイグレーションは起動時に自動で行う
cd frontend && npm ci && npm run dev           # http://localhost:3000
```

| URL | 内容 |
|---|---|
| http://localhost:3000 | 画面（Next.js） |
| http://localhost:3001 | Rails API |
| http://localhost:8025 | Mailpit（予約メールなど、送信されたメールを確認する） |

よく使うコマンド

```bash
docker compose logs -f backend                  # Railsのログ
docker compose exec backend bin/rails console   # コンソール
docker compose exec backend bin/rails db:migrate
docker compose restart backend                  # Gemfileを変えたあと（起動時に bundle install する）
docker compose down                             # 停止（DBのデータはボリュームに残る）
```

開発用アカウント（seedで作成）
- 管理者：`admin@example.com` / `password123`
- 会員：`member@example.com` / `password123`

テスト

```bash
docker compose exec backend bundle exec rspec
docker compose exec backend bin/rubocop
cd frontend && npm run lint && npx tsc --noEmit && npm test
cd frontend && npm run test:e2e   # docker compose up -d で起動しておく
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

本番のアカウント（seedで作成。パスワードはTerraformが生成してSSMに保存）
- 管理者：`admin@example.com`
- デモ会員：`demo@example.com`（非公開。面談の相手などに個別に伝える。利用履歴と翌日の会議室予約のサンプル入り）

```bash
# 管理者のパスワード
aws ssm get-parameter --with-decryption --name /cowork-hub/backend/SEED_ADMIN_PASSWORD --query Parameter.Value --output text
# デモ会員のパスワード
aws ssm get-parameter --with-decryption --name /cowork-hub/backend/SEED_DEMO_PASSWORD --query Parameter.Value --output text
```

費用の目安（東京リージョン・常時稼働）：ALB 約2,800円＋Fargate 2タスク 約2,500円＋RDS db.t4g.micro 約2,500円＋パブリックIPv4 約1,500円で、**月8,000〜9,000円程度**です。

使わないときは止められます。

```bash
terraform -chdir=infra apply -var desired_count=0   # タスクだけ停止（ALB・RDSの料金は継続。夜間停止・自動チェックアウトも止まる）
terraform -chdir=infra apply                        # 再開（desired_count=1）
terraform -chdir=infra destroy                      # すべて削除（データも消えます）
```

### 夜間停止

費用を抑えるため、毎日 **20:00〜翌3:00（日本時間）はタスク（backend / frontend）を0にしています**（`infra/night_stop.tf`）。
EventBridge Scheduler が 20:00 に desiredCount を0にし、3:00 に `desired_count` へ戻します。停止中にアクセスすると、ALB が 503 を返します。

| 変数 | 既定 | 内容 |
|---|---|---|
| `night_stop_enabled` | `true` | 夜間停止をするか（`desired_count=0` のときは無効） |
| `night_stop_start` | `"20:00"` | 止める時刻（HH:MM） |
| `night_stop_end` | `"03:00"` | 起動する時刻（HH:MM）。起動してから使えるまで2〜3分かかる |

- 削減できるのは Fargate とタスクのパブリックIPv4の7時間分で、**月1,000円程度**（月8,000〜9,000円 → 7,000〜8,000円）。ALB（約2,800円）と ALB のパブリックIPv4 は止められないので残ります
- RDS は止めていません。同じ時間に止めても月600〜800円程度しか減らず、起動に5〜10分かかる・止めている間は自動バックアップを取らない・自動チェックアウトがDBに繋がらない、といった注意点が増えるためです
- 自動チェックアウト（毎時5分）は単発のタスクで動くので、夜間停止中も動きます（seedの拠点は21〜23時まで営業のため、閉店時刻の締めに必要）
- スケジュールが desiredCount を書き換えるので、Terraform は `desired_count` の差分を無視します（`ignore_changes`）。`desired_count` か `night_stop_enabled` を変えたときだけ、apply が AWS CLI でサービスのタスク数を `desired_count` に合わせます（夜間停止中に `night_stop_enabled=false` にしても、すぐ起動します）。夜間にこれらを変えて apply すると、タスクが起動し、次の 20:00 まで動きます
- 夜間停止中に `bin/deploy` すると、新しいイメージで動くのは翌朝の起動からです
- 監視（下の「監視とSlack通知」）のうち、停止中に鳴り続ける「正常なタスクの数」と「ALB 自身の 5xx」は、停止の2分前（19:58）に通知を止め、起動の10分後（3:10）に戻します。戻した1分後に状態を OK にし直すので、朝の起動に失敗していれば、そこで Slack に通知が届きます（「OK（夜間停止の後、状態を見直す）」に続けて ALARM の2通）。翌朝に通知が戻っているかは `aws cloudwatch describe-alarms --alarm-name-prefix cowork-hub- --query 'MetricAlarms[].[AlarmName,StateValue,ActionsEnabled]' --output table` で確認できます

### Sentry でエラーを調べる

Rails と Next.js（サーバー側）の例外を Sentry に送り、スタックトレースや発生した画面・API から原因を調べます。Slack への通知は CloudWatch のアラームで行います（Sentry の無料プランは通知がメールのみのため）。

- DSN を指定したときだけ送ります。未指定なら SDK は何もしません（開発環境・テストでは送らない）
- 個人情報や秘密情報は送りません：Cookie・リクエストヘッダー・リクエストの本文（ログイン時のパスワードなど）・ユーザー情報は止めています（Rails は Cookie とヘッダーの値を `[Filtered]` にする）
- 性能の記録（トレース）は10%のリクエストだけ（`sentry_traces_sample_rate`）
- ブラウザ側のエラーは送りません（DSN をビルド時に埋め込む必要があるため）

1. [Sentry](https://sentry.io/) で Rails 用と Next.js 用のプロジェクトを作り、それぞれの DSN を `infra/terraform.tfvars` に書く

```hcl
sentry_dsn_backend  = "https://xxxx@o0.ingest.sentry.io/0"
sentry_dsn_frontend = "https://yyyy@o0.ingest.sentry.io/0"
```

2. `terraform -chdir=infra apply` で反映する（タスクが新しい環境変数で入れ替わる）

送信がうまくいかないときは、タスクに `SENTRY_DEBUG=1` を渡すと Next.js 側の送信の様子がログに出ます。

### Basic 認証とクローラー対策

学習用のサンプルなので、ボットや検索エンジンに見せないよう、本番はサイト全体に Basic 認証をかけています。ID とパスワードは隠すほどのものではないので、この README に載せています（ID `ee-office`／パスワード `password1122`）。デモ会員のパスワードは、引き続き面談の相手などに個別に伝えます。

| 対象 | 守り方 |
|---|---|
| 画面（Next.js） | `frontend/src/proxy.ts` で Basic 認証。ALB のヘルスチェック（`/healthz`）と `robots.txt` は対象外 |
| API（Rails の `/api/*`） | ALB が、Next.js のサーバーが付けるヘッダー `X-Internal-Api-Key` の合うものだけを Rails に通し、それ以外は 403（`infra/alb.tf`）。ブラウザは Rails を直接呼ばないので、外部から API を直接使えなくなる |
| 検索エンジン | `robots.txt` ですべて断り、すべての応答に `X-Robots-Tag: noindex, nofollow` を付ける |

- API に Basic 認証をかけないのは、Rails の認証（`Authorization: Bearer`）と同じヘッダーを使ってぶつかるため
- ローカル・CI・E2E では、環境変数（`BASIC_AUTH_USER`・`BASIC_AUTH_PASSWORD`・`INTERNAL_API_KEY`）がないので、どれも無効
- 有効にするには `infra/terraform.tfvars` に `basic_auth_user = "ee-office"` を書いて apply する。パスワードと API 用のヘッダーの値は Terraform が作って SSM に置く

パスワードは `infra/terraform.tfvars` の `basic_auth_password` で決めています（省略すると自動で作る）。変えたら `terraform -chdir=infra apply` のあと `aws ecs update-service --cluster cowork-hub --service frontend --force-new-deployment` でタスクを入れ替えます（パスワードはタスクの起動時に読むため）。SSM の値の確認：

```bash
aws ssm get-parameter --with-decryption --name /cowork-hub/frontend/BASIC_AUTH_PASSWORD --query Parameter.Value --output text
```

最初に有効にするときは、順番を守ります（ALB の条件を先に変えると、ヘッダーを付けない今のフロントから API が使えなくなる）。

1. `bin/deploy frontend`（環境変数がなければ何もしないので、先に入れても影響しない）
2. タスクに環境変数を渡す：タスク定義だけを先に作り、サービスは AWS CLI で切り替えて、反映を待つ
   （ECS サービスは ALB のルールに依存しているため、`-target` にサービスを含めると ALB の条件まで同時に変わってしまう）
   ```bash
   terraform -chdir=infra apply -target=aws_iam_role_policy.execution_secrets -target=aws_ecs_task_definition.frontend
   aws ecs update-service --cluster cowork-hub --service frontend --task-definition cowork-hub-frontend
   aws ecs wait services-stable --cluster cowork-hub --services frontend
   ```
3. 残り（ALB の条件）を反映する：`terraform -chdir=infra apply`。ALB のルールの反映には数十秒かかる（その間は外から `/api/*` がまだ通る）

### 独自ドメインでHTTPS化する

`domain_name` を指定すると、ACM証明書とHTTPSリスナーを作ります。HTTPはHTTPSへリダイレクトし、Next.jsのサーバーからRailsへの通信もHTTPS（`API_ORIGIN=https://<ドメイン>`）になります。Cookieには `Secure` 属性が付きます。

DNSの設定方法は、親ドメインのDNSでできることに合わせて2通りから選びます。どちらも親ドメインのほかの設定（メールなど）には影響しません。ACMの証明書は無料です。

| 方法 | 使う場面 | 親ドメインのDNSに追加するもの | 追加の費用 |
|---|---|---|---|
| A. Route 53に委任（既定） | 親ドメインがRoute 53など、NSレコードを追加できるDNSにある | NSレコード4件 | ホストゾーン（月60円程度） |
| B. CNAMEだけ（`use_route53 = false`） | レンタルサーバーのDNSなど、NSレコードを追加できない | CNAMEレコード2件 | なし |

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
# terraform.tfvars に domain_name = "coworking.example.com" を書く（.gitignore済み）
# 方法Bなら use_route53 = false も書く
```

#### A. Route 53に委任する

サブドメイン（例：`coworking.example.com`）のホストゾーンをこのアカウントに作り、親ドメインから委任してもらいます。

```bash
# 1. サブドメインのホストゾーンだけを先に作る
terraform -chdir=infra apply -target=aws_route53_zone.app
terraform -chdir=infra output delegation_name_servers
```

2. 親ドメインのDNSで、親のホストゾーンにNSレコードを追加します。
   - レコード名：`coworking`（サブドメイン部分）
   - タイプ：NS
   - 値：上で表示された4つのネームサーバー

```bash
# 3. 残りを作る（証明書のDNS検証が終わるまで数分待つ）
terraform -chdir=infra apply
```

#### B. CNAMEだけで設定する（Route 53を使わない）

```bash
# 1. 証明書とALBを先に作り、DNSに追加するレコードを表示する
terraform -chdir=infra apply -var desired_count=0 \
  -target=aws_acm_certificate.app -target=aws_lb.main
terraform -chdir=infra output dns_records_to_add
```

2. 親ドメインのDNSに、表示された2件のCNAMEレコードを追加します。
   - 証明書の検証用（`_xxxx.coworking.example.com.` → `_yyyy.acm-validations.aws.`）
   - アプリ用（`coworking.example.com.` → ALBのDNS名）
   - ホスト名をサブドメイン部分だけ書く画面では、末尾の `.example.com.` を除いて入力します。
   - 検証用のCNAMEは、証明書の更新でも使うので消さないでください。

```bash
# 3. 残りを作る（DNSに検証用のCNAMEが反映され、証明書が発行されるまで待つ）
terraform -chdir=infra apply -var desired_count=0
```

4. 基盤ができたら、上の「AWSへのデプロイ」の手順でイメージをpushし（`bin/deploy`）、タスクを起動します（`terraform -chdir=infra apply`）。

## 監視とSlack通知

`infra/monitoring.tf` で、CloudWatch のアラームと AWS Budgets の通知を SNS トピックに集め、Amazon Q Developer in chat applications（旧 AWS Chatbot）で Slack に送ります。アプリのエラーの詳しい調査（スタックトレースなど）は Sentry で行います。

| 種類 | 何を見るか | 通知する条件 |
|---|---|---|
| アプリのエラー | Rails の 5xx（ログの `Completed 5xx`） | 5分間に1件以上 |
| | 非同期ジョブの失敗（`Error performing`） | 5分間に1件以上 |
| | Next.js のサーバー側のエラー（`⨯` の行） | 5分間に1件以上 |
| 可用性 | ALB：アプリの 5xx / ALB 自身の 5xx（503・504） | 5分間に5件以上 |
| | 正常なタスクの数（backend / frontend） | 3分続けて0 |
| 性能 | 応答時間の p95 | 10分続けて1秒超（`latency_p95_threshold_seconds`） |
| | ECS の CPU / メモリ | 15分続けて80% / 85%超 |
| | RDS の CPU / 空きメモリ / 空き容量 | 15分続けて80%超 / 64MB未満 / 2GB未満 |
| 費用 | AWS アカウント全体の月の費用（`monthly_budget_usd`、既定 80ドル） | 実費が80%超、月末の予測が100%超 |

問題が起きたときと、元に戻ったときの両方を通知します。費用はアラーム15件で月200〜300円程度です（ログのメトリクスフィルターは無料、Budgets は2件まで無料）。

### Slack につなぐ

1. AWS コンソールの「Amazon Q Developer in chat applications」で「チャットクライアントを設定」→ Slack を選び、ワークスペースを承認する（Terraform ではできないため、最初に一度だけ手で行う）
2. 承認後に表示されるワークスペースID（`T`から始まる）と、通知先のチャンネルID（Slack のチャンネル詳細の一番下、`C`から始まる）を `infra/terraform.tfvars` に書く。プライベートチャンネルなら、先に `/invite @Amazon Q` で招待しておく

```hcl
slack_team_id    = "T0123456789"
slack_channel_id = "C0123456789"
```

3. 反映して、試しにアラームを1つ鳴らす

```bash
terraform -chdir=infra apply
aws cloudwatch set-alarm-state --alarm-name cowork-hub-alb-target-5xx --state-value ALARM --state-reason "Slack通知のテスト"
```

数十秒で Slack に通知が届きます。テストで鳴らしたアラームは、次の評価（5分以内）で自動的に OK に戻り、その通知も届きます。

## Claude Codeによるコードレビュー

[Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) を使っています。

| ワークフロー | 動くタイミング | 内容 |
|---|---|---|
| `claude-review.yml` | PRの作成・更新時 | 変更をレビューし、該当行へのコメントと総評を日本語で投稿する |
| `claude.yml` | PR・Issueのコメントやレビュー、Issueの作成・アサインで `@claude` と書いたとき | 質問に答えたり、修正してコミットしたりする |
| `claude.yml` | Issueにラベル `claude-implement` を付けたとき | Issueの仕様に沿って実装し、テストを通してからPRを作る |
| `pr-screenshots.yml` | 画面に関わるファイルが変わったPRの作成・更新時 | 変更前後の画面のキャプチャ（E2Eを変えたなら操作のGIF）をPRにコメントする |
| `claude-security-review.yml` | コード・インフラ・ワークフローが変わったPRの作成・更新時 | セキュリティの観点だけでレビューし、【重大】の指摘があればチェックを失敗させる（下の「AI が書いたコードのセキュリティチェック」） |
| `incident.yml` | 30分ごと（夜間停止中を除く。AWS の EventBridge から起動） | 本番の新しいエラーを Sentry から Issue にし、原因と修正案をコメントする（下の「本番エラーを Issue にして AI に調べさせる」） |
| `weekly-maintenance.yml` | 毎週月曜 9:00（日本時間） | 依存ライブラリの更新と、ドキュメントとコードの食い違いの修正を AI が行い、変更があれば PR にする（下の「週1回のメンテナンスを AI にやらせる」） |

- ラベル `claude-implement` を付ける前に、Issue 本文を必ず読んで内容を確認してください（本文の指示にClaudeが従うため）。Issueの作者がオーナー・メンバー・コラボレーター以外のときは動きません
- レビューの観点とプロジェクトの規約は `CLAUDE.md` に書いています
- 指摘には重要度（【必須】【推奨】【参考】）を付けます
- `@claude` に反応するのは、オーナー・メンバー・コラボレーターのコメントだけです
- ドラフトPRとフォークからのPRは自動レビューの対象外です

### AI が書いたコードのセキュリティチェック

AI が書いた PR（`claude-implement`・`@claude`・週1回のメンテナンス）も人の PR も、同じ3段で確かめます。

| 段 | どこで | 見るもの |
|---|---|---|
| 静的解析 | `ci.yml` | Brakeman（Rails の危ない書き方）、bundler-audit（gem の既知の脆弱性）、`npm audit --omit=dev --audit-level=high`（本番で使う npm パッケージの high 以上の脆弱性） |
| AI のセキュリティレビュー | `claude-security-review.yml` | このアプリの守りの仕組み（Pundit の認可、Strong Parameters、Basic 認証と `proxy.ts` の対象外のパス、内部 API キー、Server Actions の検証、リダイレクト先、ワークフローの権限）が崩れていないか。攻撃の筋道を書けるものだけを指摘し、【重大】があればチェックが失敗する |
| 秘密情報 | GitHub の設定 | secret scanning と push protection（有効） |

- チェックリストはスキル `security-check`（`.claude/skills/security-check/SKILL.md`）にあり、手元の Claude Code でも使えます
- レビューの基準には、PR の中のものではなく **main のチェックリスト**を使います（PR がチェックリストを弱めて、自分自身を通せないように）

### main のブランチ保護

main には直接 push できず、PR を通す必要があります。次のチェックが通らないとマージできません（管理者も同じ。`enforce_admins`）。

| 必須のチェック | ワークフロー |
|---|---|
| `backend`・`frontend`・`e2e`・`terraform`・`docker (backend)`・`docker (frontend)` | `ci.yml` |
| `security-review`（AI のセキュリティレビュー。【重大】で失敗） | `claude-security-review.yml` |

- PR は必須ですが、承認（レビューの Approve）は0件でよい設定です（1人で開発しているため）。AI の自動レビュー（`review`）は必須にしていません（指摘があっても成功で終わるため）
- `security-review` は必須のチェックなので、すべての PR で動きます。セキュリティに関係するファイル（コード・依存・インフラ・ワークフロー・`.claude/`）が変わっていなければ、AI を呼ばずに成功で終わります
- AI のワークフロー（`claude.yml`・`weekly-maintenance.yml`）が push するのは作業用のブランチだけで、main には PR を通してしか入りません
- 緊急で外す必要があるときは、Settings → Branches で一時的に解除します。設定は次のコマンドで入れています

```bash
gh api -X PUT repos/Matsushin/cowork-hub/branches/main/protection --input .github/branch-protection.json
```
- 通常のレビュー（`claude-review.yml`）とは別のジョブにしています。観点を絞ったほうが見落としが減り、セキュリティの指摘だけでマージを止められるためです

### 役割ごとのサブエージェント（手元の Claude Code）

`.claude/agents/` に、役割を分けたサブエージェントを3つ定義しています。スキル `add-feature` の手順9・10から使います。

| 名前 | モデル | 役割 | できること |
|---|---|---|---|
| `test-runner` | haiku | テスト・静的解析を実行し、失敗だけを短く返す（長いログで会話を埋めない） | 実行して読むだけ。直さない |
| `code-reviewer` | sonnet | 差分を CLAUDE.md の「コードレビューの観点」で読む（実装した本人の会話を持たない別の目） | 読むだけ |
| `security-reviewer` | opus | 差分をスキル `security-check` に沿って、攻撃者の立場で読む | 読むだけ |

- 2つのレビューは同時に頼みます。直すのは呼び出し元（メインの会話）です
- `tools` では Bash のコマンドまでは絞れないため、「読むだけ」「直さない」はプロンプトで指示しています
- わざと2つの問題（他人の予約を `policy_scope` なしで探す・閉店時刻ちょうどを営業中にする）を入れて試しました
  - test-runner は閉店時刻の問題で落ちる2件のテストを報告、code-reviewer は2つとも指摘、security-reviewer は1つ目を【注意】で指摘し、2つ目はセキュリティの問題ではないと切り分けました
  - code-reviewer は「境界のテストがない」と誤った指摘もしました（実際はある）。読むだけの役は推測を含むので、テストを動かす test-runner と組み合わせて使います

### セットアップに必要なシークレット・変数

リポジトリの Settings → Secrets and variables → Actions で登録します。値はリポジトリにコミットしないでください。

| 名前 | 種類 | 役割 |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | シークレット | Claude Codeの認証トークン。`claude-review.yml` と `claude.yml` がClaudeを呼び出すときに使う（`ANTHROPIC_API_KEY` で代用も可） |
| `CLAUDE_APP_ID` | 変数（Variables） | 専用GitHub AppのID。設定すると `claude.yml` がAppのトークンを発行し、Claudeのpushでも CI と自動レビューが起動する。未設定なら既定のトークンで動く（その場合、pushではCIが起動しない） |
| `CLAUDE_APP_PRIVATE_KEY` | シークレット | 専用GitHub Appの秘密鍵。`CLAUDE_APP_ID` とあわせてAppのトークンを発行するために使う |
| `SENTRY_AUTH_TOKEN` | シークレット | Sentry の個人トークン（スコープ `event:read`）。`incident.yml` がエラーを読むために使う |
| `SENTRY_ORG` | 変数（Variables） | Sentry の組織の ID かスラッグ。未設定なら `incident.yml` は何もしない |
| `SENTRY_PROJECTS` | 変数（Variables） | 対象の Sentry プロジェクトの ID かスラッグ（Rails 用と Next.js 用をカンマ区切り） |

### 本番エラーを Issue にして AI に調べさせる

本番のエラーから修正PRまでを、次の流れでつないでいます。

```
Sentry（本番の未解決エラー）
  → incident.yml（30分ごと。AWS の EventBridge から起動）が Issue を作る（ラベル incident・bug、作成者は専用 GitHub App）
  → Claude Code が コードを読むだけの権限で原因・影響・修正案・再現テスト案をコメントする
  → 人がコメントを読んで、ラベル claude-implement を付ける
  → claude.yml が再現テストを先に書いてから直し、PRを作る（自動レビュー・CI が走る）
  → 人がマージ・デプロイし、Sentry の issue を Resolved にする
```

- 調査と修正の手順はスキル `fix-incident`（`.claude/skills/fix-incident/SKILL.md`）にまとめています
- **修正の開始には人の判断を挟みます**。エラーの文面には外部の利用者が入力した値が混じることがあり、そこに AI への指示を紛れ込ませる攻撃（プロンプトインジェクション）がありうるためです。調査のジョブはファイルの読み取りとその Issue へのコメントしかできません
- 公開リポジトリのため、Issue にはエラーの種類・文面・アプリのコードのスタックトレース・回数だけを載せ、メールアドレスや長い数字・トークンらしき文字列は伏せます。リクエストの中身や変数の値は載せません（詳しくは Sentry のリンクから）
- 同じエラーは1件の Issue にまとめます（本文の `<!-- sentry-issue-id: N -->` で判定。閉じた Issue も含む）。1回に作るのは3件まで、対象は最初の発生が24時間以内のものです
- **起動は AWS から**：GitHub Actions のスケジュール実行は、混んでいると大きく遅れたり飛ばされたりします（30分ごとの予定が、実際には1日に数回しか動いていませんでした）。そこで EventBridge のルールが30分ごとに GitHub の API（`workflow_dispatch`）を呼びます（`infra/incident_dispatch.tf`）。コードは持たず、起動に失敗すると Slack に通知します。ワークフローの cron は予備として残しています
  - 必要なもの：GitHub の fine-grained personal access token（対象は このリポジトリだけ、権限は Actions の Read and write だけ）を `infra/terraform.tfvars` の `github_dispatch_token` に書いて `terraform -chdir=infra apply`。期限が切れたら作り直して同じように反映します
- 試すとき：Actions の「本番エラーの起票と調査」を手動で実行します。`dry_run` が有効（既定）なら Issue は作らず、作る予定の本文をログに出します

Sentry のトークンは、Sentry の User Settings → Personal Tokens で `event:read` だけを付けて作り、手元で登録します（値を画面やチャットに貼らない）。

```bash
gh secret set SENTRY_AUTH_TOKEN
gh variable set SENTRY_ORG --body "<組織のIDかスラッグ>"
gh variable set SENTRY_PROJECTS --body "<Rails用のID>,<Next.js用のID>"
```

### 週1回のメンテナンスを AI にやらせる

`weekly-maintenance.yml` が毎週月曜 9:00（日本時間）に、次の2つを別々のジョブで行います。手順はスキル `weekly-maintenance`（`.claude/skills/weekly-maintenance/SKILL.md`）です。

| ジョブ | 内容 | PR のブランチ |
|---|---|---|
| deps | 依存ライブラリ（gem・npm）をパッチ・マイナーまで上げ、CI と同じ確認（テスト・RuboCop・Brakeman・bundler-audit・lint・型・ビルド）を通す。壊れたら小さく直すか、そのライブラリだけ見送る。メジャーの更新は PR の本文で知らせるだけ | `maintenance/deps` |
| docs | この1週間のコミットを見て、README・CLAUDE.md に書かれたコマンド・パス・バージョンなどがコードと食い違っていないかを確かめ、事実の食い違いだけを直す | `maintenance/docs` |

- **AI にコミット・push の権限を渡しません**（main にブランチ保護がないため）。AI はファイルを変えて PR のタイトルと本文を `/tmp/maintenance/` に書くまでです
  - 依存ライブラリの更新（新しいバージョンのインストール処理が動く）は、シークレットのないステップで AI の前に済ませます。ただしテストの実行では更新後のコードが動くので、AI のステップの Claude のトークンを完全には守れません（公開リポジトリの CI と同じ前提）
  - AI のジョブにあるのは読み取りだけの `GITHUB_TOKEN` です。変更は patch にして成果物（artifact）で渡すだけです（`.github/scripts/maintenance-patch.sh`）
  - PR を作るのは別のジョブです。別のランナーで main をきれいに checkout し直し、patch を当てて、変えてよい範囲かを確かめてから push します（`.github/scripts/open-maintenance-pr.sh`）。AI や更新したライブラリのコードが作業ツリーや `.git`（フック・設定）に何かを仕込んでも、push 用の専用 GitHub App のトークンには届きません
- 変えてよい範囲を決めています（deps は `backend/`・`frontend/` の下で Dockerfile を除く、docs は README.md・CLAUDE.md だけ。スキルは AI の動作やセキュリティレビューの基準を決めるので、食い違いは PR の本文で知らせるだけ）。範囲の外のファイルが変わっていたら（名前の変更は変更前のパスも見ます）PR を作らずに失敗します
- PR はブランチごとに1本（ラベル `maintenance`）で、毎週上書きします。このブランチに手でコミットを積まないでください。マージは人が行います
- 変える必要がなければ PR は作りません
- 試すとき：Actions の「週1回のメンテナンス（AI）」を手動で実行します（`task` で deps・docs のどちらかだけにもできます）

## 学習用として割り切っている点

- 独自ドメインを指定しない場合はHTTPのみ。パスワードやトークンが平文で流れるので、**HTTPS化するまでは本番利用しない**
- Next.jsのサーバー → Rails は、HTTPS化してもALB（インターネット側）を経由する。内部通信（Service Connect）にはしていない
- Terraformのstateをローカルに置いている（チームで使う場合はS3バックエンドへ）
- NAT Gatewayを使わず、ECSタスクをパブリックサブネットに置いている（セキュリティグループでALBからの通信だけ許可）
- RDSはシングルAZで、削除時にスナップショットを作らない
