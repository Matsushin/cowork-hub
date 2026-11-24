# AI 機能の利用記録。会員は自分の記録だけを見て、書き足せる
class AiRequestPolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user:)
  end

  def update? = owner?
end
