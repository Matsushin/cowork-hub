class ReservationsController < ApplicationController
  def index
    scope = current_user.reservations.includes(:space).order(starts_at: :desc)
    scope = scope.upcoming.confirmed if params[:upcoming] == "true"
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
    render json: ReservationSerializer.call(reservation), status: :created
  rescue Reservation::Conflict => e
    render json: { error: e.message }, status: :conflict
  end

  def cancel
    reservation = current_user.reservations.find(params[:id])
    unless reservation.cancelable?
      return render json: { error: "この予約はキャンセルできません" }, status: :unprocessable_content
    end
    reservation.canceled!
    render json: ReservationSerializer.call(reservation)
  end
end
