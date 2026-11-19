# Rails の例外を Sentry に送る（SENTRY_DSN を指定したときだけ）。
# Slack への通知は CloudWatch のアラームで行い、Sentry は原因の調査（スタックトレースなど）に使う。
if ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.dsn = ENV["SENTRY_DSN"]
    config.environment = ENV.fetch("SENTRY_ENVIRONMENT", Rails.env)
    config.breadcrumbs_logger = [ :active_support_logger, :http_logger ]
    # 性能の記録は一部のリクエストだけ（無料プランの上限に収めるため）
    config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
    # メールアドレスやIPアドレスなどの個人情報は送らない
    config.send_default_pii = false
  end
end
