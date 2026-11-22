# --- 本番エラーの起票（.github/workflows/incident.yml）を AWS から定期的に起動する ---
# GitHub Actions のスケジュール実行（cron）は、混んでいると大きく遅れたり飛ばされたりする。
# 30分ごとの予定が、実際には1日に数回しか動いていなかった（2026-11-22 は3回）ため、
# EventBridge のルールから GitHub の API（workflow_dispatch）を直接呼んで起動する。コードは持たない（API destination）。
#
# 必要なもの：GitHub の fine-grained personal access token
#   対象リポジトリ：Matsushin/cowork-hub だけ／権限：Actions の Read and write だけ
#   terraform.tfvars の github_dispatch_token に書く（.gitignore 済み。値はチャットや画面に貼らない）
#   未設定なら、このファイルのリソースは作らない
#   トークンは Terraform の state に平文で入る（state は手元のファイルだけで、コミットしない）。期限が切れたらアラームが鳴るので、作り直して apply する
# 費用：API destination の呼び出しは月に約1,200回で、ほぼ0円。トークンの保管（Secrets Manager）が月 $0.40 ほど

locals {
  incident_dispatch_enabled = var.github_dispatch_token != ""
}

resource "aws_cloudwatch_event_connection" "github" {
  count              = local.incident_dispatch_enabled ? 1 : 0
  name               = "${var.project}-github"
  description        = "GitHub の API（workflow_dispatch）を呼ぶためのトークン"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${var.github_dispatch_token}"
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "incident_dispatch" {
  count                            = local.incident_dispatch_enabled ? 1 : 0
  name                             = "${var.project}-incident-dispatch"
  description                      = "incident.yml を workflow_dispatch で起動する"
  invocation_endpoint              = "https://api.github.com/repos/${var.github_repository}/actions/workflows/incident.yml/dispatches"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
  connection_arn                   = aws_cloudwatch_event_connection.github[0].arn
}

resource "aws_cloudwatch_event_rule" "incident_dispatch" {
  count       = local.incident_dispatch_enabled ? 1 : 0
  name        = "${var.project}-incident-dispatch"
  description = "30分ごとに本番エラーの起票（incident.yml）を起動する。夜間停止（20:00〜翌3:00 JST）の間は動かさない"
  # EventBridge のルールの cron は UTC。UTC の 18〜23時・0〜10時 ＝ JST の 3:07〜19:37（incident.yml の cron と同じ）
  schedule_expression = "cron(7,37 0-10,18-23 * * ? *)"
  state               = var.desired_count > 0 ? "ENABLED" : "DISABLED"
}

data "aws_iam_policy_document" "events_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "incident_dispatch" {
  count              = local.incident_dispatch_enabled ? 1 : 0
  name               = "${var.project}-incident-dispatch"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
}

resource "aws_iam_role_policy" "incident_dispatch" {
  count = local.incident_dispatch_enabled ? 1 : 0
  name  = "invoke-api-destination"
  role  = aws_iam_role.incident_dispatch[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "events:InvokeApiDestination"
      Resource = aws_cloudwatch_event_api_destination.incident_dispatch[0].arn
    }]
  })
}

resource "aws_cloudwatch_event_target" "incident_dispatch" {
  count    = local.incident_dispatch_enabled ? 1 : 0
  rule     = aws_cloudwatch_event_rule.incident_dispatch[0].name
  arn      = aws_cloudwatch_event_api_destination.incident_dispatch[0].arn
  role_arn = aws_iam_role.incident_dispatch[0].arn
  # dry_run を false にして、実際に Issue を作らせる（手動実行の既定は true）
  input = jsonencode({ ref = "main", inputs = { dry_run = "false" } })

  http_target {
    header_parameters = {
      Accept                 = "application/vnd.github+json"
      "X-GitHub-Api-Version" = "2022-11-28"
    }
  }

  retry_policy {
    maximum_retry_attempts       = 2
    maximum_event_age_in_seconds = 600
  }
}

# 起動に失敗したら（トークンの期限切れ・権限不足など）Slack に知らせる
resource "aws_cloudwatch_metric_alarm" "incident_dispatch_failed" {
  count               = local.incident_dispatch_enabled ? 1 : 0
  alarm_name          = "${var.project}-incident-dispatch-failed"
  alarm_description   = "本番エラーの起票（incident.yml）を AWS から起動できなかった。GitHub のトークンの期限・権限を確認する"
  namespace           = "AWS/Events"
  metric_name         = "FailedInvocations"
  dimensions          = { RuleName = aws_cloudwatch_event_rule.incident_dispatch[0].name }
  statistic           = "Sum"
  period              = 1800 # 起動の間隔（30分）に合わせる
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}
