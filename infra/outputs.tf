output "app_url" {
  value = local.app_origin
}

output "delegation_name_servers" {
  description = "親ゾーンに登録するNSレコードの値（Route 53を使う場合のみ）"
  value       = local.use_route53 ? aws_route53_zone.app[0].name_servers : null
}

output "dns_records_to_add" {
  description = "Route 53を使わない場合に、ドメインのDNSへ手で追加するCNAMEレコード（証明書の検証用とアプリ用）"
  value = local.https_enabled && !local.use_route53 ? concat(
    [for o in aws_acm_certificate.app[0].domain_validation_options : {
      purpose = "ACM証明書の検証"
      name    = o.resource_record_name
      type    = o.resource_record_type
      value   = o.resource_record_value
    }],
    [{
      purpose = "アプリ（ALB）"
      name    = "${var.domain_name}."
      type    = "CNAME"
      value   = "${aws_lb.main.dns_name}."
    }],
  ) : null
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "backend_network" {
  description = "seed実行など単発タスク用のネットワーク設定"
  value = {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.app.id]
  }
}

output "admin_password_parameter" {
  value = aws_ssm_parameter.admin_password.name
}

output "region" {
  value = var.region
}

output "alerts_topic_arn" {
  description = "監視の通知先 SNS トピック（Slack・メールへ送る）"
  value       = aws_sns_topic.alerts.arn
}

output "basic_auth" {
  description = "Basic 認証の ID と、パスワードを置いた SSM パラメーター（basic_auth_user を指定したときだけ）"
  value       = var.basic_auth_user == null ? null : { user = var.basic_auth_user, password_parameter = aws_ssm_parameter.basic_auth_password.name }
}
