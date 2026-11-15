# 権限チェックの基底クラス（Pundit）
#
# - 「誰が」「どのレコードに」「何をしてよいか」を Policy クラスの ?メソッドに書く
# - コントローラーでは authorize（1件に対する操作）と policy_scope（見てよい範囲）を使う
# - 許可されなかったら Pundit::NotAuthorizedError → ApplicationController が403を返す
class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  # 403のときに返すメッセージ
  def error_message = "この操作を行う権限がありません"

  private

  def owner? = user.present? && record.user_id == user.id

  class Scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NotImplementedError, "#{self.class}#resolve を定義してください"
    end

    private

    attr_reader :user, :scope
  end
end
