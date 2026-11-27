# --- ECS のタスクの異常終了を知らせる ---
# コンテナが自分で終了し（stopCode が EssentialContainerExited）終了コードが 0 以外だったタスクと、起動できなかったタスク（TaskFailedToStart）を拾い、Slack に知らせる。
#   - 起動の途中で落ちる失敗（設定ファイルが読めない・DB に繋がらない）は、アプリのログのエラー検知（monitoring.tf）では拾えない
#   - 2026-11-27：DB のパスワードの自動の変更で、毎時の定期ジョブが19時間近く失敗し続けたが、知らせがなかった
# デプロイ・夜間停止・台数の変更で止めたタスクは、stopCode が ServiceSchedulerInitiated などになるので拾わない。
# 成功した定期ジョブ（終了コード 0）も拾わない。
#
# 流れ：EventBridge のルール → CloudWatch Logs（イベントをそのまま残し、どのタスクがなぜ止まったかを後で見られる）
#       → メトリクスフィルター → アラーム → SNS → Slack（ほかのアラームと同じ通知の形）
# 費用：イベントは失敗したときだけ届くので、ほぼ0円

resource "aws_cloudwatch_log_group" "task_failures" {
  # EventBridge から書き込むロググループの名前は /aws/events/ で始める
  name              = "/aws/events/${var.project}-task-failures"
  retention_in_days = 14
}

data "aws_iam_policy_document" "task_failures_logs" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.task_failures.arn}:*"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com", "delivery.logs.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.task_failures.arn]
    }
  }
}

resource "aws_cloudwatch_log_resource_policy" "task_failures" {
  policy_name     = "${var.project}-task-failures"
  policy_document = data.aws_iam_policy_document.task_failures_logs.json
}

resource "aws_cloudwatch_event_rule" "task_failures" {
  name        = "${var.project}-task-failures"
  description = "ECS のタスクが異常終了した（コンテナが終了コード 0 以外で終わった）"
  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.main.arn]
      lastStatus = ["STOPPED"]
      "$or" = [
        # コンテナが自分で終了し、終了コードが 0 以外
        { stopCode = ["EssentialContainerExited"], containers = { exitCode = [{ "anything-but" = 0 }] } },
        # タスクを起動できなかった（イメージの取得・シークレットの読み込みの失敗など）
        { stopCode = ["TaskFailedToStart"] },
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "task_failures" {
  rule = aws_cloudwatch_event_rule.task_failures.name
  arn  = aws_cloudwatch_log_group.task_failures.arn
}

resource "aws_cloudwatch_log_metric_filter" "task_failures" {
  name           = "${var.project}-task-failures"
  log_group_name = aws_cloudwatch_log_group.task_failures.name
  pattern        = "{ $.detail.lastStatus = \"STOPPED\" }"

  metric_transformation {
    name          = "TaskFailures"
    namespace     = local.app_error_metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "task_failures" {
  alarm_name          = "${local.alarm_prefix}task-failures"
  alarm_description   = "ECS のタスクが異常終了した（定期ジョブ・backend・frontend の起動の失敗など）。どのタスクがなぜ止まったかは CloudWatch Logs の ${aws_cloudwatch_log_group.task_failures.name}、エラーの中身は /ecs/${var.project}/backend などのログ"
  namespace           = local.app_error_metrics_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.task_failures.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}
