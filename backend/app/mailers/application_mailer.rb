class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "ee-office <no-reply@example.com>")
  layout "mailer"
end
