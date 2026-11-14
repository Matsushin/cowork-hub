variable "project" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "coworking-sample"
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

variable "domain_name" {
  description = <<-EOT
    アプリを公開するドメイン（例: coworking.example.com）。
    指定するとRoute 53のホストゾーン・ACM証明書・HTTPSリスナーを作り、HTTPはHTTPSへリダイレクトする。
    null（未指定）ならALBのDNS名でHTTPのみ。値は terraform.tfvars に書く（.gitignore済み）
  EOT
  type        = string
  default     = null
}
