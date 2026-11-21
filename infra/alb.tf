resource "aws_lb" "main" {
  name               = var.project
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project}-front"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  # Rails に依存しない専用のパス（frontend/src/app/healthz/route.ts）。トップページは Rails の API を呼ぶため、
  # Rails の起動前にフロントまで不健全と判定され、エラーになる
  health_check {
    path    = "/healthz"
    matcher = "200"
  }
  deregistration_delay = 30
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-back"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path    = "/up"
    matcher = "200"
  }
  deregistration_delay = 30
}

# HTTP(80)：HTTPSが有効ならHTTPSへリダイレクト、無効ならそのまま振り分ける
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = local.https_enabled ? "redirect" : "forward"
    target_group_arn = local.https_enabled ? null : aws_lb_target_group.frontend.arn

    dynamic "redirect" {
      for_each = local.https_enabled ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

# HTTPS(443)：ACM証明書で終端する
resource "aws_lb_listener" "https" {
  count = local.https_enabled ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.app[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

locals {
  # アプリへの入口になるリスナー（既定はNext.js、/api/* はRails）
  app_listener_arn = local.https_enabled ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
}

# /api/* は、Next.js のサーバーからの呼び出し（ヘッダー X-Internal-Api-Key が合うもの）だけを Rails に通す。
# ブラウザは Rails を直接呼ばない（Server Components / Server Actions 経由）ので、外部から API を直接使わせない。
# Basic 認証（frontend/src/proxy.ts）は画面だけにかかり、Rails の Bearer トークンとヘッダーがぶつかるため API にはかけない
resource "aws_lb_listener_rule" "api" {
  listener_arn = local.app_listener_arn
  priority     = 10

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  condition {
    http_header {
      http_header_name = "X-Internal-Api-Key"
      values           = [random_password.internal_api_key.result]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ヘッダーが合わない /api/* は Rails に届けずに 403 を返す（このルールがないと Next.js に届いて 404 になる）
resource "aws_lb_listener_rule" "api_forbidden" {
  listener_arn = local.app_listener_arn
  priority     = 20

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      status_code  = "403"
      message_body = jsonencode({ error = "Forbidden" })
    }
  }
}
