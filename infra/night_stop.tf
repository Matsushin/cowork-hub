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

# --- 夜間停止中の監視アラーム（monitoring.tf） ---
# 止めている間は「正常なタスクが0」と「ALB自身の5xx（タスクが無いので503）」が鳴り続けるので、
# 停止の2分前に通知を止め、起動の10分後に通知を戻す。
# 戻すときは状態をOKにし直す。次の評価で状態を見直すので、朝の起動に失敗していればその時点でALARMが通知される
# （通知を戻すだけだと、夜のあいだのALARMのまま変化しないので見逃す）

locals {
  night_muted_alarms = merge(
    { for k, a in aws_cloudwatch_metric_alarm.healthy_hosts : "${k}-no-healthy-host" => a },
    { alb-elb-5xx = aws_cloudwatch_metric_alarm.alb_elb_5xx },
  )

  # 0:00 からの分。停止の2分前・起動の10分後（日付をまたいでもよいよう1440で割った余り）
  night_mute_at = (
    tonumber(split(":", var.night_stop_start)[0]) * 60 + tonumber(split(":", var.night_stop_start)[1]) - 2 + 1440
  ) % 1440
  night_unmute_at = (
    tonumber(split(":", var.night_stop_end)[0]) * 60 + tonumber(split(":", var.night_stop_end)[1]) + 10
  ) % 1440
  night_reset_at = (local.night_unmute_at + 1) % 1440 # 通知を戻した1分後にOKにし直す
}

data "aws_iam_policy_document" "scheduler_alarm_actions" {
  statement {
    actions   = ["cloudwatch:DisableAlarmActions", "cloudwatch:EnableAlarmActions", "cloudwatch:SetAlarmState"]
    resources = [for a in local.night_muted_alarms : a.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_alarm_actions" {
  name   = "mute-alarms-at-night"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_alarm_actions.json
}

resource "aws_scheduler_schedule" "night_alarms" {
  for_each = {
    mute   = { at = local.night_mute_at, api = "disableAlarmActions" }
    unmute = { at = local.night_unmute_at, api = "enableAlarmActions" }
  }

  name                         = "${var.project}-night-alarms-${each.key}"
  schedule_expression          = "cron(${each.value.at % 60} ${floor(each.value.at / 60)} * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"
  state                        = local.night_stop_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:cloudwatch:${each.value.api}"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ AlarmNames = [for a in local.night_muted_alarms : a.alarm_name] })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 600
    }
  }

  depends_on = [aws_iam_role_policy.scheduler_alarm_actions]
}

resource "aws_scheduler_schedule" "night_alarm_reset" {
  for_each = local.night_muted_alarms

  name                         = "${var.project}-night-alarm-reset-${each.key}"
  schedule_expression          = "cron(${local.night_reset_at % 60} ${floor(local.night_reset_at / 60)} * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"
  state                        = local.night_stop_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:cloudwatch:setAlarmState"
    role_arn = aws_iam_role.scheduler.arn
    input = jsonencode({
      AlarmName   = each.value.alarm_name
      StateValue  = "OK"
      StateReason = "夜間停止の後、状態を見直す"
    })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 600
    }
  }

  depends_on = [aws_iam_role_policy.scheduler_alarm_actions]
}

# 夜間停止を無効にしたとき（停止中に無効にした場合も）、止めていた通知を戻す。
# 通知の有効・無効はスケジュールが切り替えるので、アラーム側は actions_enabled の差分を無視している（monitoring.tf）
resource "terraform_data" "alarm_actions" {
  triggers_replace = [local.night_stop_enabled, sort([for a in local.night_muted_alarms : a.alarm_name])]

  provisioner "local-exec" {
    command = local.night_stop_enabled ? "true" : "aws cloudwatch enable-alarm-actions --region ${var.region} --alarm-names ${join(" ", [for a in local.night_muted_alarms : a.alarm_name])}"
  }
}
