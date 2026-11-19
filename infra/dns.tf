# 独自ドメインでのHTTPS化（var.domain_name を指定したときだけ作る）
#
# DNSの管理方法は2通り（var.use_route53 で切り替える）。手順は README の「独自ドメインでHTTPS化する」を参照。
# - true（既定）：サブドメインのホストゾーンをこのアカウントに作り、親ゾーンからNSレコードで委任してもらう
# - false：Route 53は使わない。親ドメインのDNS（レンタルサーバーなど）に、output dns_records_to_add の
#   CNAMEレコード（証明書の検証用とアプリ用）を手で追加する。NSレコードを追加できないDNS向け

locals {
  https_enabled = var.domain_name != null
  use_route53   = local.https_enabled && var.use_route53
  app_origin    = local.https_enabled ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

resource "aws_route53_zone" "app" {
  count = local.use_route53 ? 1 : 0
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
  for_each = local.use_route53 ? {
    for o in aws_acm_certificate.app[0].domain_validation_options : o.domain_name => o
  } : {}

  zone_id = aws_route53_zone.app[0].zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 300
}

# 検証の完了を待つ（委任、または検証用CNAMEの追加が済んでいないと、ここで待ち続ける）
resource "aws_acm_certificate_validation" "app" {
  count                   = local.https_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.app[0].arn
  validation_record_fqdns = local.use_route53 ? [for r in aws_route53_record.cert_validation : r.fqdn] : null

  timeouts {
    create = "30m"
  }
}

# ドメイン → ALB
resource "aws_route53_record" "app" {
  count   = local.use_route53 ? 1 : 0
  zone_id = aws_route53_zone.app[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
