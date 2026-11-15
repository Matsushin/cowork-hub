# ドロップインの利用
class VisitPolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user:)
  end

  def checkout? = owner?
end
