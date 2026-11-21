resource "random_password" "secret_key_base" {
  length  = 128
  special = false
}

resource "random_password" "admin" {
  length  = 20
  special = false
}

# デモ会員のパスワード（非公開。面談の相手などに個別に伝える）
resource "random_password" "demo" {
  length  = 16
  special = false
}

resource "aws_ssm_parameter" "secret_key_base" {
  name  = "/${var.project}/backend/SECRET_KEY_BASE"
  type  = "SecureString"
  value = random_password.secret_key_base.result
}

# 初期管理者のパスワード（seed実行時に使う）。確認は README の手順を参照
resource "aws_ssm_parameter" "admin_password" {
  name  = "/${var.project}/backend/SEED_ADMIN_PASSWORD"
  type  = "SecureString"
  value = random_password.admin.result
}

# デモ会員のパスワード（seed実行時に使う）。確認は README の手順を参照
resource "aws_ssm_parameter" "demo_password" {
  name  = "/${var.project}/backend/SEED_DEMO_PASSWORD"
  type  = "SecureString"
  value = random_password.demo.result
}

# Basic 認証のパスワード（basic_auth_user を指定したときに使う。basic_auth_password を指定しなければ自動で作る）
resource "random_password" "basic_auth" {
  length  = 16
  special = false
}

resource "aws_ssm_parameter" "basic_auth_password" {
  name  = "/${var.project}/frontend/BASIC_AUTH_PASSWORD"
  type  = "SecureString"
  value = coalesce(var.basic_auth_password, random_password.basic_auth.result)
}

# Next.js のサーバーが Rails の API を呼ぶときに付けるヘッダーの値。ALB はこれが付いた /api/* だけを Rails に通す（alb.tf）。
# ALB の条件では * と ? がワイルドカードになるので、記号を使わない
resource "random_password" "internal_api_key" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "internal_api_key" {
  name  = "/${var.project}/frontend/INTERNAL_API_KEY"
  type  = "SecureString"
  value = random_password.internal_api_key.result
}
