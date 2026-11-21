variable "project" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "cowork-hub"
}

variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "image_tag" {
  description = "デプロイするコンテナイメージのタグ"
  type        = string
  default     = "latest"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "desired_count" {
  description = "各サービスのタスク数（0にすると停止）"
  type        = number
  default     = 1
}

variable "night_stop_enabled" {
  description = "毎日 night_stop_start〜night_stop_end（日本時間）にタスクを0にして費用を抑えるか（desired_count=0 のときは無効）"
  type        = bool
  default     = true
}

variable "night_stop_start" {
  description = "夜間停止を始める時刻（日本時間、HH:MM）"
  type        = string
  default     = "20:00"
  validation {
    condition     = can(regex("^([01][0-9]|2[0-3]):[0-5][0-9]$", var.night_stop_start))
    error_message = "HH:MM（00:00〜23:59）で指定してください。"
  }
}

variable "night_stop_end" {
  description = "夜間停止を終えてタスクを起動する時刻（日本時間、HH:MM）"
  type        = string
  default     = "03:00"
  validation {
    condition     = can(regex("^([01][0-9]|2[0-3]):[0-5][0-9]$", var.night_stop_end))
    error_message = "HH:MM（00:00〜23:59）で指定してください。"
  }
}

variable "domain_name" {
  description = <<-EOT
    アプリを公開するドメイン（例: coworking.example.com）。
    指定するとRoute 53のホストゾーン・ACM証明書・HTTPSリスナーを作り、HTTPはHTTPSへリダイレクトする。
    null（未指定）ならALBのDNS名でHTTPのみ。値は terraform.tfvars に書く（.gitignore済み）
  EOT
  type        = string
  default     = null
}

variable "use_route53" {
  description = <<-EOT
    domain_name を指定したとき、DNSをRoute 53で管理するか。
    true：サブドメインのホストゾーンを作り、親ゾーンからNSレコードで委任してもらう。
    false：Route 53は使わず、親ドメインのDNSに output dns_records_to_add のCNAMEを手で追加する
    （レンタルサーバーのDNSなど、NSレコードを追加できない場合）
  EOT
  type        = bool
  default     = true
}

# ---- 監視（monitoring.tf） ----

variable "slack_team_id" {
  description = "通知先の Slack ワークスペースID（T から始まる）。AWS コンソールでワークスペースを承認したあとに表示される。null なら Slack 連携を作らない"
  type        = string
  default     = null
}

variable "slack_channel_id" {
  description = "通知先の Slack チャンネルID（C から始まる。チャンネル詳細の一番下に表示される）。プライベートチャンネルなら /invite @Amazon Q で招待しておく"
  type        = string
  default     = null
}

variable "alert_email" {
  description = "通知をメールでも受け取る場合のアドレス（任意）。値は terraform.tfvars に書く"
  type        = string
  default     = null
}

variable "latency_p95_threshold_seconds" {
  description = "応答時間のp95がこの秒数を10分続けて超えたら通知する"
  type        = number
  default     = 1
}

variable "monthly_budget_usd" {
  description = "AWSアカウント全体の月の予算（USD）。実費が80%を超えたとき、月末の予測が100%を超えたときに通知する"
  type        = number
  default     = 80
}

# ---- Sentry（エラーの調査用。通知は monitoring.tf の CloudWatch から Slack へ） ----

variable "sentry_dsn_backend" {
  description = "Rails 用の Sentry プロジェクトの DSN。null なら Sentry に送らない。値は terraform.tfvars に書く"
  type        = string
  default     = null
}

variable "sentry_dsn_frontend" {
  description = "Next.js 用の Sentry プロジェクトの DSN（サーバー側のエラーのみ）。null なら Sentry に送らない"
  type        = string
  default     = null
}

variable "sentry_traces_sample_rate" {
  description = "性能の記録（トレース）を取るリクエストの割合。無料プランの上限（月500万スパン）に収まるように小さめにする"
  type        = number
  default     = 0.1
}

variable "basic_auth_user" {
  description = "Basic 認証の ID。指定するとサイト全体に Basic 認証をかける（パスワードは自動で作って SSM に置く。確認は README の「Basic 認証とクローラー対策」）。null なら認証なし"
  type        = string
  default     = null
}

variable "basic_auth_password" {
  description = "Basic 認証のパスワード。null なら自動で作る。ボットや検索エンジン避けで、隠すほどのものではないので README に載せている。変えたらフロントのタスクを入れ替える（README の「Basic 認証とクローラー対策」）"
  type        = string
  default     = null
  sensitive   = true
}
