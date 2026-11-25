# AI 機能の利用記録。会員は自分の記録だけを見て、書き足せる
# 分析アシスタント（analytics）は管理者だけが始められる（道具の管理 API も管理者だけだが、回数を無駄に使わせない）
class AiRequestPolicy < ApplicationPolicy
  ADMIN_FEATURES = %w[analytics].freeze

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user:)
  end

  def create? = !ADMIN_FEATURES.include?(record.feature) || user&.admin? || false

  def update? = owner?

  def error_message = record.new_record? ? "この AI 機能は管理者だけが使えます" : super
end
