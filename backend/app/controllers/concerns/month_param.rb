# ?month=YYYY-MM を月初の日付にする（省略時は今月）
module MonthParam
  extend ActiveSupport::Concern

  class Invalid < StandardError; end

  included do
    rescue_from MonthParam::Invalid do
      render json: { error: "月の形式が不正です（YYYY-MM）" }, status: :bad_request
    end
  end

  private

  def month_param
    return Date.current.beginning_of_month if params[:month].blank?
    raise Invalid unless params[:month].to_s.match?(/\A\d{4}-\d{2}\z/)
    Date.strptime(params[:month], "%Y-%m")
  rescue Date::Error
    raise Invalid
  end
end
