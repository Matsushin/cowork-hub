# --- メールの送信（Amazon SES）---
# 予約の確定・取り消しのお知らせを、Amazon SES の API で送る（backend の aws-actionmailer-ses）。
# タスクの IAM ロールに送信の権限を付けるので、SMTP のパスワードは作らない。
#
# 手順（README の「メールの送信」）
#   1. domain_name を指定して apply → SES に送信元のドメインを登録する（DKIM の鍵を作る）
#   2. output mail_dns_records_to_add の CNAME 3つを、ドメインの DNS に追加する（Route 53 を使うなら自動）
#   3. SES のコンソールでドメインが「確認済み」になったら、mail_enabled = true にして apply → backend が送り始める
#   4. 送れる宛先の制限（サンドボックス）を外す申請を AWS に出す。外れるまでは、SES で確認したアドレスにしか送れない
# 費用：1,000通あたり約0.1ドル

locals {
  mail_domain  = var.domain_name
  mail_from    = local.mail_domain == null ? null : "ee-office <no-reply@${local.mail_domain}>"
  mail_enabled = var.mail_enabled && local.mail_domain != null
}

# 送信元のドメイン（DKIM で署名する。鍵は AWS が管理し、自動で入れ替える）
resource "aws_sesv2_email_identity" "app" {
  count          = local.mail_domain == null ? 0 : 1
  email_identity = local.mail_domain
}

# Route 53 を使うときは、DKIM のレコードも自動で作る
resource "aws_route53_record" "dkim" {
  count   = local.use_route53 ? 3 : 0
  zone_id = aws_route53_zone.app[0].zone_id
  name    = "${aws_sesv2_email_identity.app[0].dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.mail_domain}"
  type    = "CNAME"
  records = ["${aws_sesv2_email_identity.app[0].dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
  ttl     = 600
}

# backend のタスクに、このドメインから送る権限だけを付ける
data "aws_iam_policy_document" "task_send_mail" {
  count = local.mail_enabled ? 1 : 0
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.app[0].arn]
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = ["no-reply@${local.mail_domain}"]
    }
  }
}

resource "aws_iam_role_policy" "task_send_mail" {
  count  = local.mail_enabled ? 1 : 0
  name   = "send-mail"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_send_mail[0].json
}

# backend に渡す環境変数（mail_enabled のときだけ。未指定ならメールは送らない）
locals {
  mail_env = local.mail_enabled ? [
    { name = "MAIL_DELIVERY", value = "ses" },
    { name = "MAIL_FROM", value = local.mail_from },
    { name = "AWS_REGION", value = var.region },
  ] : []
}
