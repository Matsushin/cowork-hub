# --- 夜間停止：費用を抑えるため、毎日決まった時間だけECSのタスクを0にする ---
# 既定は 20:00 に backend / frontend の desiredCount を0にし、翌3:00 に desired_count へ戻す（日本時間）。
# 止めている間、ALBは動いたまま（タスクが無いので503を返す）。RDSは止めない（理由はREADMEの「夜間停止」）。
# 自動チェックアウト（scheduler.tf）は単発のタスクで動くので、停止中も毎時動く。
#
# desiredCount をスケジュールが書き換えるので、Terraformは desired_count の変更を無視する（ecs.tf の lifecycle）。
# 代わりに var.desired_count を変えたときだけ、下の terraform_data がAWS CLIでサービスに反映する。

locals {
  night_stop_enabled = var.night_stop_enabled && var.desired_count > 0

  night_stop_times = {
    stop  = { at = var.night_stop_start, count = 0 }
    start = { at = var.night_stop_end, count = var.desired_count }
  }

  # スケジュール：{ backend-stop, backend-start, frontend-stop, frontend-start }
  night_stop_schedules = merge([
    for service in keys(aws_ecs_service.app) : {
      for action, t in local.night_stop_times : "${service}-${action}" => {
        service = service
        count   = t.count
        hour    = tonumber(split(":", t.at)[0])
        minute  = tonumber(split(":", t.at)[1])
      }
    }
  ]...)
}

data "aws_iam_policy_document" "scheduler_update_service" {
  statement {
    actions   = ["ecs:UpdateService"]
    resources = [for s in aws_ecs_service.app : s.id]
  }
}

resource "aws_iam_role_policy" "scheduler_update_service" {
  name   = "update-service-desired-count"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_update_service.json
}

resource "aws_scheduler_schedule" "night_stop" {
  for_each = local.night_stop_schedules

  name                         = "${var.project}-night-${each.key}"
  schedule_expression          = "cron(${each.value.minute} ${each.value.hour} * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"
  state                        = local.night_stop_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  # ユニバーサルターゲット：EventBridge SchedulerからECSのUpdateService APIを直接呼ぶ
  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ecs:updateService"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      Cluster      = aws_ecs_cluster.main.name
      Service      = each.value.service
      DesiredCount = each.value.count
    })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 3600
    }
  }

  depends_on = [aws_iam_role_policy.scheduler_update_service]
}

# var.desired_count を変えたとき（`-var desired_count=0` で止める、戻すなど）と、夜間停止の有効・無効を切り替えたときに、
# サービスのタスク数を desired_count に合わせる（夜間停止中に無効にしても、タスクが0のまま残らないように）。
# 作成時にも1回動く（日中に apply する前提。夜間に apply すると、次の停止時刻までタスクが動く）
resource "terraform_data" "desired_count" {
  for_each = aws_ecs_service.app

  triggers_replace = [var.desired_count, local.night_stop_enabled]

  provisioner "local-exec" {
    command = "aws ecs update-service --region ${var.region} --cluster ${aws_ecs_cluster.main.name} --service ${each.value.name} --desired-count ${var.desired_count} --output text --query service.desiredCount"
  }
}
