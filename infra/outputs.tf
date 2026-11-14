output "app_url" {
  value = local.app_origin
}

output "delegation_name_servers" {
  description = "親ゾーンに登録するNSレコードの値（HTTPS有効時のみ）"
  value       = local.https_enabled ? aws_route53_zone.app[0].name_servers : null
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
