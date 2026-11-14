resource "random_password" "secret_key_base" {
  length  = 128
  special = false
}

resource "random_password" "admin" {
  length  = 20
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
