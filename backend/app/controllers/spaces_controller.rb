class SpacesController < ApplicationController
  def index
    render json: Space.active.order(:kind, :name).map { |r| SpaceSerializer.call(r) }
  end

  # 指定日の予約済み時間帯（誰の予約かは返さない）
  def availability
    date = params[:date].present? ? Date.parse(params[:date]) : Date.current
    reservations = Reservation.confirmed.on_date(date).where(space: Space.active).order(:starts_at)
    render json: {
      date: date,
      open_hour: Reservation::OPEN_HOUR,
      close_hour: Reservation::CLOSE_HOUR,
      slot_minutes: Reservation::SLOT_MINUTES,
      reserved: reservations.map { |r|
        { space_id: r.space_id, starts_at: r.starts_at, ends_at: r.ends_at, mine: r.user_id == current_user.id }
      }
    }
  rescue Date::Error
    render json: { error: "日付の形式が不正です" }, status: :bad_request
  end
end
