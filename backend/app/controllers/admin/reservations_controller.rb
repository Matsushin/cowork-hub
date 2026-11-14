module Admin
  class ReservationsController < BaseController
    def index
      scope = Reservation.includes({ space: :location }, :user).order(starts_at: :desc)
      scope = scope.on_date(Date.parse(params[:date])) if params[:date].present?
      render json: scope.limit(200).map { |r| ReservationSerializer.call(r, with_user: true) }
    rescue Date::Error
      render json: { error: "日付の形式が不正です" }, status: :bad_request
    end
  end
end
