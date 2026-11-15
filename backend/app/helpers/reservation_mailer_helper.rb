module ReservationMailerHelper
  WEEKDAYS = %w[日 月 火 水 木 金 土].freeze

  # 11/20（金）10:00〜12:00
  def reservation_period(reservation)
    starts_at = reservation.starts_at.in_time_zone("Tokyo")
    ends_at = reservation.ends_at.in_time_zone("Tokyo")
    "#{starts_at.strftime('%-m/%-d')}（#{WEEKDAYS[starts_at.wday]}）#{starts_at.strftime('%H:%M')}〜#{ends_at.strftime('%H:%M')}"
  end

  def yen(amount)
    "#{amount.to_fs(:delimited)}円"
  end

  def reservations_url
    "#{Rails.configuration.x.app_url}/reservations"
  end
end
