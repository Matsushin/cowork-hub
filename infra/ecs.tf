resource "aws_ecs_cluster" "main" {
  name = var.project

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  for_each          = toset(["backend", "frontend"])
  name              = "/ecs/${var.project}/${each.key}"
  retention_in_days = 14
}

# --- IAM ---
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# タスク実行ロール：イメージ取得・ログ出力・シークレット読み込み
resource "aws_iam_role" "execution" {
  name               = "${var.project}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
  statement {
    actions = ["ssm:GetParameters"]
    resources = [
      aws_ssm_parameter.secret_key_base.arn,
      aws_ssm_parameter.admin_password.arn,
      aws_ssm_parameter.demo_password.arn,
    ]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# タスクロール：アプリ自身の権限（ECS Execでのデバッグ用）
resource "aws_iam_role" "task" {
  name               = "${var.project}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task_exec" {
  statement {
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_exec" {
  name   = "ecs-exec"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_exec.json
}

# --- タスク定義 ---
locals {
  db_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn
}

# Sentry（エラーの調査用）。DSN を指定したときだけ環境変数を渡す（未指定なら SDK は何もしない）
locals {
  sentry_env = {
    for app, dsn in { backend = var.sentry_dsn_backend, frontend = var.sentry_dsn_frontend } : app => dsn == null ? [] : [
      { name = "SENTRY_DSN", value = dsn },
      { name = "SENTRY_ENVIRONMENT", value = "production" },
      { name = "SENTRY_TRACES_SAMPLE_RATE", value = tostring(var.sentry_traces_sample_rate) },
    ]
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name         = "backend"
    image        = "${aws_ecr_repository.app["backend"].repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = concat([
      { name = "DB_HOST", value = aws_db_instance.main.address },
      { name = "DB_NAME", value = aws_db_instance.main.db_name },
      { name = "DB_USERNAME", value = aws_db_instance.main.username },
      { name = "RAILS_LOG_LEVEL", value = "info" },
      { name = "SEED_ADMIN_EMAIL", value = "admin@example.com" },
      { name = "SEED_DEMO_EMAIL", value = "demo@example.com" },
      # Solid Queue のワーカーをPumaの中で動かす（メール送信などの非同期処理）
      { name = "SOLID_QUEUE_IN_PUMA", value = "true" },
      # メール本文のリンク先
      { name = "APP_URL", value = local.app_origin },
      # SMTP_ADDRESS などを渡すまでメールは実際には送られない（config/environments/production.rb）
    ], local.sentry_env.backend)
    secrets = [
      { name = "DB_PASSWORD", valueFrom = "${local.db_secret_arn}:password::" },
      { name = "SECRET_KEY_BASE", valueFrom = aws_ssm_parameter.secret_key_base.arn },
      { name = "SEED_ADMIN_PASSWORD", valueFrom = aws_ssm_parameter.admin_password.arn },
      { name = "SEED_DEMO_PASSWORD", valueFrom = aws_ssm_parameter.demo_password.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["backend"].name
        awslogs-region        = var.region
        awslogs-stream-prefix = "backend"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name         = "frontend"
    image        = "${aws_ecr_repository.app["frontend"].repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = concat([
      # Server Components / Server Actions からRails APIを呼ぶ接続先（ALB経由で /api/* がRailsに届く）
      # HTTPSが有効なら https://<ドメイン> になり、サーバー間の通信も暗号化される
      { name = "API_ORIGIN", value = local.app_origin },
      # HTTPSが有効ならCookieにSecure属性を付ける
      { name = "COOKIE_SECURE", value = tostring(local.https_enabled) },
    ], local.sentry_env.frontend)
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["frontend"].name
        awslogs-region        = var.region
        awslogs-stream-prefix = "frontend"
      }
    }
  }])
}

# --- サービス ---
resource "aws_ecs_service" "app" {
  for_each = {
    backend  = { task = aws_ecs_task_definition.backend.arn, tg = aws_lb_target_group.backend.arn }
    frontend = { task = aws_ecs_task_definition.frontend.arn, tg = aws_lb_target_group.frontend.arn }
  }

  name                   = each.key
  cluster                = aws_ecs_cluster.main.id
  task_definition        = each.value.task
  desired_count          = var.desired_count
  launch_type            = "FARGATE"
  enable_execute_command = true

  # 起動直後のdb:prepare（マイグレーション）でヘルスチェックに落ちないよう猶予を持たせる
  health_check_grace_period_seconds = 120

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = each.value.tg
    container_name   = each.key
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # 夜間停止（night_stop.tf）のスケジュールが desiredCount を書き換えるので、apply で戻さない。
  # desired_count は作成時だけ使い、変えたときは terraform_data.desired_count が反映する
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener_rule.api]
}
