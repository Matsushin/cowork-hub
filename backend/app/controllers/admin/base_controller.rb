module Admin
  class BaseController < ApplicationController
    before_action :require_admin

    private

    def require_admin
      render json: { error: "管理者権限が必要です" }, status: :forbidden unless current_user&.admin?
    end
  end
end
