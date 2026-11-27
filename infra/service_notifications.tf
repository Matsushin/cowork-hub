# --- デプロイ・夜間停止・起動の完了を Slack に知らせる ---
# ECS のイベント（EventBridge）→ Lambda（lambda/service_notify/handler.py）→ SNS（alerts）→ Slack
#   - デプロイの完了・失敗：サービスごとに1通（デプロイしたイメージのタグつき）
#   - 夜間停止の完了：すべてのサービスが止まったときに1通
#   - 起動の完了：すべてのサービスが目標の台数で安定したときに1通（起動に失敗すると届かない。代わりに task_failures.tf の通知が届く）
# 夜間停止・起動は、スケジュールが指示を出したときではなく、ECS の実際の状態が変わったときに送る。
# 前の状態（stopped / running）は SSM パラメータに残し、同じ状態のイベントが何回来ても1回だけ送る。
# 費用：Lambda は1日に数十回動くだけで、無料枠の範囲

locals {
  notify_services = ["backend", "frontend"]
}

data "archive_file" "service_notify" {
  type        = "zip"
  source_file = "${path.module}/lambda/service_notify/handler.py"
  output_path = "${path.module}/.build/service_notify.zip"
}

resource "aws_ssm_parameter" "service_state" {
  name        = "/${var.project}/notify/service-state"
  description = "通知の Lambda が最後に知らせたサービスの状態（stopped / running）"
  type        = "String"
  value       = "running"

  # 値は Lambda が書き換える
  lifecycle {
    ignore_changes = [value]
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "service_notify" {
  name               = "${var.project}-service-notify"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "service_notify" {
  statement {
    actions   = ["ecs:DescribeServices"]
    resources = [for s in local.notify_services : "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${s}"]
  }
  statement {
    # タスク定義の読み取りはリソースで絞れない
    actions   = ["ecs:DescribeTaskDefinition"]
    resources = ["*"]
  }
  statement {
    actions   = ["ssm:GetParameter", "ssm:PutParameter"]
    resources = [aws_ssm_parameter.service_state.arn]
  }
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
  }
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.service_notify.arn}:*"]
  }
}

resource "aws_iam_role_policy" "service_notify" {
  name   = "notify"
  role   = aws_iam_role.service_notify.id
  policy = data.aws_iam_policy_document.service_notify.json
}

resource "aws_cloudwatch_log_group" "service_notify" {
  name              = "/aws/lambda/${var.project}-service-notify"
  retention_in_days = 14
}

resource "aws_lambda_function" "service_notify" {
  function_name    = "${var.project}-service-notify"
  description      = "デプロイ・夜間停止・起動の完了を Slack に知らせる"
  role             = aws_iam_role.service_notify.arn
  runtime          = "python3.13"
  handler          = "handler.handler"
  filename         = data.archive_file.service_notify.output_path
  source_code_hash = data.archive_file.service_notify.output_base64sha256
  timeout          = 30
  memory_size      = 128
  # 1つずつ動かす。夜間停止では backend・frontend の停止がほぼ同時に届くので、
  # 並行で動くと両方が「前は running」と読んで「夜間停止の完了」が2通届く。待たされたイベントは自動で再試行される
  reserved_concurrent_executions = 1

  environment {
    variables = {
      CLUSTER        = aws_ecs_cluster.main.name
      SERVICES       = join(",", local.notify_services)
      TOPIC_ARN      = aws_sns_topic.alerts.arn
      STATE_PARAM    = aws_ssm_parameter.service_state.name
      NIGHT_STOP_END = local.night_stop_enabled ? var.night_stop_end : ""
    }
  }

  depends_on = [aws_cloudwatch_log_group.service_notify, aws_iam_role_policy.service_notify]
}

resource "aws_cloudwatch_event_rule" "service_notify" {
  name        = "${var.project}-service-notify"
  description = "デプロイの完了・失敗、サービスの安定、サービスのタスクの停止（夜間停止・起動の完了の判定）"
  event_pattern = jsonencode({
    source = ["aws.ecs"]
    "$or" = [
      {
        detail-type = ["ECS Deployment State Change"]
        detail      = { eventName = ["SERVICE_DEPLOYMENT_COMPLETED", "SERVICE_DEPLOYMENT_FAILED"] }
        resources   = [for s in local.notify_services : { prefix = "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${s}" }]
      },
      {
        detail-type = ["ECS Service Action"]
        detail      = { clusterArn = [aws_ecs_cluster.main.arn], eventName = ["SERVICE_STEADY_STATE"] }
      },
      {
        detail-type = ["ECS Task State Change"]
        detail = {
          clusterArn = [aws_ecs_cluster.main.arn]
          lastStatus = ["STOPPED"]
          group      = [for s in local.notify_services : "service:${s}"]
        }
      },
    ]
  })
}

resource "aws_cloudwatch_event_target" "service_notify" {
  rule = aws_cloudwatch_event_rule.service_notify.name
  arn  = aws_lambda_function.service_notify.arn
}

resource "aws_lambda_permission" "service_notify" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service_notify.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.service_notify.arn
}

# 通知の Lambda 自体が失敗したら知らせる（通知が来ないことが「正常」とは限らないため）
resource "aws_cloudwatch_metric_alarm" "service_notify_errors" {
  alarm_name          = "${local.alarm_prefix}service-notify-errors"
  alarm_description   = "デプロイ・夜間停止・起動の通知の Lambda が失敗した。ログは ${aws_cloudwatch_log_group.service_notify.name}"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.service_notify.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}
