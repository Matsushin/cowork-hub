# 管理画面（/api/admin/*）に入れるか。レコードを持たない「ヘッドレス」Policy
#   authorize :admin, :access?
class AdminPolicy < ApplicationPolicy
  def access? = user&.admin? || false

  def error_message = "管理者権限が必要です"
end
