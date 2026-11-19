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
