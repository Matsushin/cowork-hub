class ReservationsController < ApplicationController
  def index
    scope = policy_scope(Reservation).includes(space: :location)
    # 今後の予約は近い順、すべて表示のときは新しい順
    scope = if params[:upcoming] == "true"
      scope.upcoming.confirmed.order(starts_at: :asc)
    else
      scope.order(starts_at: :desc)
    end
    render json: scope.map { |r| ReservationSerializer.call(r) }
  end

  def create
    attrs = params.expect(reservation: [ :space_id, :starts_at, :ends_at ])
    space = Space.find(attrs[:space_id])
    reservation = Reservation.reserve!(
      user: current_user, space:,
      starts_at: Time.zone.parse(attrs[:starts_at].to_s),
      ends_at: Time.zone.parse(attrs[:ends_at].to_s)
    )
    ReservationMailer.with(reservation:).confirmed.deliver_later
    render json: ReservationSerializer.call(reservation), status: :created
  rescue Reservation::Conflict => e
    render json: { error: e.message }, status: :conflict
  end

  def cancel
    # 他人の予約は見えない範囲なので404（存在を知られないため403にしない）
    reservation = policy_scope(Reservation).find(params[:id])
    authorize reservation
    unless reservation.cancelable?
      return render json: { error: "この予約はキャンセルできません" }, status: :unprocessable_content
    end
    reservation.canceled!
    ReservationMailer.with(reservation:).canceled.deliver_later
    render json: ReservationSerializer.call(reservation)
  end
end
