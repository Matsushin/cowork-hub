# 独自ドメインでのHTTPS化（var.domain_name を指定したときだけ作る）
#
# ドメインの親ゾーン（例: example.com）が別のAWSアカウントにある前提で、
# サブドメイン（例: coworking.example.com）のホストゾーンをこのアカウントに作り、親から委任してもらう。
# 手順は README の「独自ドメインでHTTPS化する」を参照。

locals {
  https_enabled = var.domain_name != null
  app_origin    = local.https_enabled ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

resource "aws_route53_zone" "app" {
  count = local.https_enabled ? 1 : 0
  name  = var.domain_name
}

resource "aws_acm_certificate" "app" {
  count             = local.https_enabled ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# 証明書のDNS検証用レコード
resource "aws_route53_record" "cert_validation" {
  for_each = local.https_enabled ? {
    for o in aws_acm_certificate.app[0].domain_validation_options : o.domain_name => o
  } : {}

  zone_id = aws_route53_zone.app[0].zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 300
}

# 検証の完了を待つ（親ゾーンからの委任が済んでいないと、ここで待ち続ける）
resource "aws_acm_certificate_validation" "app" {
  count                   = local.https_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.app[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]

  timeouts {
    create = "30m"
  }
}

# ドメイン → ALB
resource "aws_route53_record" "app" {
  count   = local.https_enabled ? 1 : 0
  zone_id = aws_route53_zone.app[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
