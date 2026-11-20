# 監視：CloudWatch アラーム・ログのエラー検知・AWS Budgets → SNS → Slack
#
# 通知はすべて SNS トピック（alerts）に集め、Amazon Q Developer in chat applications（旧 AWS Chatbot）で Slack に送る。
# Slack ワークスペースの承認は最初に一度だけ AWS コンソールで行う（Terraform ではできない）。
# 手順は README の「監視とSlack通知」を参照。
#
# アプリのエラーの詳しい調査は Sentry（無料プラン、通知はメール）で行い、Slack への通知はここで行う。

locals {
  slack_enabled = var.slack_team_id != null && var.slack_channel_id != null
  alarm_prefix  = "${var.project}-"
}

# ---------------------------------------------------------------------------
# 通知先
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
}

data "aws_caller_identity" "current" {}

# CloudWatch アラームと AWS Budgets からの発行を許可する（このアカウントのものに限る）
data "aws_iam_policy_document" "alerts_topic" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com", "budgets.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts_topic.json
}

# Slack を使わない場合や、Slack の承認前の確認用に、メールでも受け取れる（購読の確認メールのリンクを押すと有効になる）
resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alert_email != null ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Slack 連携（slack_team_id と slack_channel_id を指定したときだけ作る）
data "aws_iam_policy_document" "chatbot_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["chatbot.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "chatbot" {
  count              = local.slack_enabled ? 1 : 0
  name               = "${var.project}-chatbot"
  assume_role_policy = data.aws_iam_policy_document.chatbot_assume.json
}

# 通知にアラームのグラフを付けるための読み取り権限
resource "aws_iam_role_policy_attachment" "chatbot_cloudwatch" {
  count      = local.slack_enabled ? 1 : 0
  role       = aws_iam_role.chatbot[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess"
}

resource "aws_chatbot_slack_channel_configuration" "alerts" {
  count              = local.slack_enabled ? 1 : 0
  configuration_name = "${var.project}-alerts"
  iam_role_arn       = aws_iam_role.chatbot[0].arn
  slack_team_id      = var.slack_team_id
  slack_channel_id   = var.slack_channel_id
  sns_topic_arns     = [aws_sns_topic.alerts.arn]
  logging_level      = "ERROR"
  # Slack から AWS を操作させない（読み取りのみ）
  guardrail_policy_arns = ["arn:aws:iam::aws:policy/ReadOnlyAccess"]
}

# ---------------------------------------------------------------------------
# アラーム（どれも、問題が起きたときと戻ったときの両方を通知する）
# ---------------------------------------------------------------------------

locals {
  alarm_actions = [aws_sns_topic.alerts.arn]

  target_groups = {
    frontend = aws_lb_target_group.frontend
    backend  = aws_lb_target_group.backend
  }
}

# ALB：アプリが返した 5xx（Rails / Next.js の 500 など）
resource "aws_cloudwatch_metric_alarm" "alb_target_5xx" {
  alarm_name          = "${local.alarm_prefix}alb-target-5xx"
  alarm_description   = "アプリが5分間に5回以上 5xx を返した"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# ALB：ALB 自身が返した 5xx（タスクが1つも動いていない 503、タイムアウトの 504 など）
resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "${local.alarm_prefix}alb-elb-5xx"
  alarm_description   = "ALBが5分間に5回以上 5xx を返した（タスク停止・タイムアウトなど）"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# 性能：応答時間の p95 が続けて遅い
resource "aws_cloudwatch_metric_alarm" "alb_latency_p95" {
  alarm_name          = "${local.alarm_prefix}alb-latency-p95"
  alarm_description   = "応答時間のp95が10分続けて${var.latency_p95_threshold_seconds}秒を超えた"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.latency_p95_threshold_seconds
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# 正常なタスクが0になった（タスクを止めている間は作らない）
resource "aws_cloudwatch_metric_alarm" "healthy_hosts" {
  for_each = var.desired_count > 0 ? local.target_groups : {}

  alarm_name          = "${local.alarm_prefix}${each.key}-no-healthy-host"
  alarm_description   = "${each.key} の正常なタスクが3分続けて0"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = each.value.arn_suffix }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# ECS：CPU・メモリの使用率
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each = var.desired_count > 0 ? toset(["backend", "frontend"]) : toset([])

  alarm_name          = "${local.alarm_prefix}${each.key}-cpu-high"
  alarm_description   = "${each.key} のCPU使用率が15分続けて80%を超えた"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  dimensions          = { ClusterName = aws_ecs_cluster.main.name, ServiceName = each.key }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each = var.desired_count > 0 ? toset(["backend", "frontend"]) : toset([])

  alarm_name          = "${local.alarm_prefix}${each.key}-memory-high"
  alarm_description   = "${each.key} のメモリ使用率が15分続けて85%を超えた"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  dimensions          = { ClusterName = aws_ecs_cluster.main.name, ServiceName = each.key }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# RDS：CPU・空き容量・空きメモリ
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.alarm_prefix}rds-cpu-high"
  alarm_description   = "RDSのCPU使用率が15分続けて80%を超えた"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.alarm_prefix}rds-free-storage-low"
  alarm_description   = "RDSの空き容量が2GBを下回った"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = 2 * 1024 * 1024 * 1024
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_freeable_memory" {
  alarm_name          = "${local.alarm_prefix}rds-freeable-memory-low"
  alarm_description   = "RDSの空きメモリが15分続けて64MBを下回った"
  namespace           = "AWS/RDS"
  metric_name         = "FreeableMemory"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 64 * 1024 * 1024
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# ---------------------------------------------------------------------------
# アプリのエラー：ログから数えて、1件でも出たら通知する
# ---------------------------------------------------------------------------

locals {
  app_error_metrics_namespace = "${var.project}/App"

  log_error_filters = {
    # Rails が 5xx を返した（例外で 500 になったときも含む）
    backend-server-error = {
      log_group = aws_cloudwatch_log_group.app["backend"].name
      pattern   = "\"Completed 5\""
      desc      = "Railsが5xxを返した"
    }
    # 非同期処理（Solid Queue のジョブ：メール送信・自動チェックアウトなど）が失敗した
    backend-job-error = {
      log_group = aws_cloudwatch_log_group.app["backend"].name
      pattern   = "\"Error performing\""
      desc      = "非同期ジョブが失敗した"
    }
    # Next.js のサーバー側のエラー（本番では「⨯」から始まる行で出る）
    frontend-server-error = {
      log_group = aws_cloudwatch_log_group.app["frontend"].name
      pattern   = "\"⨯\""
      desc      = "Next.jsのサーバー側でエラーが出た"
    }
  }
}

resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  for_each = local.log_error_filters

  name           = "${var.project}-${each.key}"
  log_group_name = each.value.log_group
  pattern        = each.value.pattern

  metric_transformation {
    name          = each.key
    namespace     = local.app_error_metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "app_errors" {
  for_each = local.log_error_filters

  alarm_name          = "${local.alarm_prefix}${each.key}"
  alarm_description   = "${each.value.desc}（詳細は Sentry と CloudWatch Logs の ${each.value.log_group}）"
  namespace           = local.app_error_metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.app_errors[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# ---------------------------------------------------------------------------
# 費用：月の予算を超えそうなときに通知する
# ---------------------------------------------------------------------------

resource "aws_budgets_budget" "monthly" {
  name         = "${var.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # 実際の費用が予算の80%を超えた
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  # 月末までの予測が予算を超えた
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  depends_on = [aws_sns_topic_policy.alerts]
}
