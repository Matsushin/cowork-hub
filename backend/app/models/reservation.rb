class Reservation < ApplicationRecord
  SLOT_MINUTES = 30

  class Conflict < StandardError; end

  belongs_to :user
  belongs_to :space

  enum :status, { confirmed: 0, canceled: 1 }

  validates :starts_at, :ends_at, presence: true
  validate :time_order
  validate :within_business_hours
  validate :aligned_to_slots
  validate :space_is_active, on: :create
  validate :within_plan_limit, on: :create

  scope :overlapping, ->(starts_at, ends_at) { where("starts_at < ? AND ends_at > ?", ends_at, starts_at) }
  scope :on_date, ->(date) { overlapping(date.beginning_of_day, date.end_of_day) }
  scope :upcoming, -> { where(ends_at: Time.current..) }

  # 同じスペースへの同時予約で二重登録にならないよう、スペース行をロックしてから重複を確認する
  def self.reserve!(user:, space:, starts_at:, ends_at:)
    transaction do
      space.lock!
      if space.reservations.confirmed.overlapping(starts_at, ends_at).exists?
        raise Conflict, "指定の時間帯はすでに予約されています"
      end
      # 料金は予約時点のスペース料金で確定する（あとで料金を変えても過去の予約は変わらない）
      amount = starts_at && ends_at ? (space.hourly_price * (ends_at - starts_at) / 3600.0).round : 0
      create!(user:, space:, starts_at:, ends_at:, amount:)
    end
  end

  def duration_hours
    (ends_at - starts_at) / 3600.0
  end

  def cancel!
    raise ActiveRecord::RecordInvalid.new(self) unless cancelable?
    canceled!
  end

  def cancelable?
    confirmed? && starts_at > Time.current
  end

  private

  def time_order
    return if starts_at.blank? || ends_at.blank?
    errors.add(:ends_at, "は開始時刻より後にしてください") unless starts_at < ends_at
  end

  # 営業時間は拠点ごとに異なる
  def within_business_hours
    return if starts_at.blank? || ends_at.blank? || space.blank?
    location = space.location
    date = starts_at.in_time_zone.to_date
    return if starts_at >= location.opens_at(date) && ends_at <= location.closes_at(date)
    errors.add(:base, "営業時間（#{location.open_hour}:00〜#{location.close_hour}:00）内で予約してください")
  end


  def aligned_to_slots
    [ starts_at, ends_at ].compact.each do |t|
      unless (t.min % SLOT_MINUTES).zero? && t.sec.zero?
        errors.add(:base, "#{SLOT_MINUTES}分単位で指定してください")
        break
      end
    end
  end

  def space_is_active
    errors.add(:space, "は現在利用できません") if space && !(space.active? && space.location.active?)
  end

  def within_plan_limit
    return if user.blank? || starts_at.blank? || ends_at.blank?
    plan = user.current_plan(starts_at.to_date)
    if plan.nil?
      errors.add(:base, "有効なプランがありません")
      return
    end
    return if plan.monthly_hours_limit.nil?

    month = starts_at.all_month
    used = user.reservations.confirmed.where(starts_at: month).sum { |r| r.duration_hours }
    if used + duration_hours > plan.monthly_hours_limit
      errors.add(:base, "今月の予約上限（#{plan.monthly_hours_limit}時間）を超えます")
    end
  end
end
