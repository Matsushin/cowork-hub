# 会員の予約（管理者による全会員の予約の閲覧は AdminPolicy で扱う）
class ReservationPolicy < ApplicationPolicy
  # 見てよい・操作してよい予約は本人のものだけ
  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(user:)
  end

  # 開始済み・キャンセル済みかどうかは権限ではなく予約の状態なので、ここでは見ない（コントローラーで422を返す）
  def cancel? = owner?
end
