class Location < ApplicationRecord
  PREFECTURES = %w[
    北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県
    新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県
    奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県
    熊本県 大分県 宮崎県 鹿児島県 沖縄県
  ].freeze
  # ドロップインの課金単位（分）
  BILLING_UNIT_MINUTES = 30

  has_many :spaces, dependent: :restrict_with_error
  has_many :visits, dependent: :restrict_with_error

  validates :name, :address, presence: true
  validates :prefecture, inclusion: { in: PREFECTURES }
  validates :open_hour, numericality: { only_integer: true, in: 0..23 }
  validates :close_hour, numericality: { only_integer: true, in: 1..24 }
  validates :hourly_price, :daily_max_price, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :open_before_close

  scope :active, -> { where(active: true) }
  scope :search, ->(q) {
    q.present? ? where("name LIKE :q OR address LIKE :q", q: "%#{sanitize_sql_like(q)}%") : all
  }

  # 指定日時が営業時間内か（日本時間で判定）
  def open_at?(time)
    t = time.in_time_zone
    minutes = t.hour * 60 + t.min
    minutes >= open_hour * 60 && minutes < close_hour * 60
  end

  def opens_at(date) = date.in_time_zone.beginning_of_day + open_hour.hours
  def closes_at(date) = date.in_time_zone.beginning_of_day + close_hour.hours

  # ドロップインの利用料。30分ごとに1時間料金の半額、最低1単位、1回あたり上限あり
  def drop_in_fee(minutes)
    units = [ (minutes.to_f / BILLING_UNIT_MINUTES).ceil, 1 ].max
    [ hourly_price * units / 2, daily_max_price ].min
  end

  private

  def open_before_close
    return if open_hour.blank? || close_hour.blank?
    errors.add(:close_hour, "は開店時刻より後にしてください") unless open_hour.to_i < close_hour.to_i
  end
end
