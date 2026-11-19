# --- 定期実行：ドロップインの自動チェックアウト ---
# 閉店時刻を過ぎても利用中のままの利用を、毎時5分に締める（bin/rails visits:auto_check_out）
# アプリ側でもチェックイン時・利用状況の取得時に締めるので、これは集計や「利用中の人数」を整えるための補助
# タスクを止めている間（desired_count=0）はスケジュールも止める。夜間停止（night_stop.tf）の間は、単発のタスクで動かすので止めない

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.project}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler_run_task" {
  statement {
    actions = ["ecs:RunTask"]
    # リビジョンが変わっても動くよう、ファミリー単位で許可する
    resources = ["${aws_ecs_task_definition.backend.arn_without_revision}:*"]
    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.main.arn]
    }
  }
  statement {
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_run_task" {
  name   = "run-backend-task"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_run_task.json
}

resource "aws_scheduler_schedule" "auto_check_out" {
  name                         = "${var.project}-auto-check-out"
  schedule_expression          = "cron(5 * * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"
  state                        = var.desired_count > 0 ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.backend.arn
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = aws_subnet.public[*].id
        security_groups  = [aws_security_group.app.id]
        assign_public_ip = true
      }
    }

    input = jsonencode({
      containerOverrides = [{
        name    = "backend"
        command = ["./bin/rails", "visits:auto_check_out"]
      }]
    })

    retry_policy {
      maximum_retry_attempts = 0 # 次の回で締め直すので再試行しない
    }
  }
}
