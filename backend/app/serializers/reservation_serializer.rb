module ReservationSerializer
  def self.call(reservation, with_user: false)
    json = reservation.slice(:id, :starts_at, :ends_at, :status, :amount).merge(
      space: SpaceSerializer.call(reservation.space, with_location: true),
      cancelable: reservation.cancelable?
    )
    json[:user] = reservation.user.slice(:id, :name, :email_address) if with_user
    json
  end
end
