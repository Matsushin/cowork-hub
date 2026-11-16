# ドロップイン利用（予約なしでチェックインし、チェックアウト時に利用時間から料金を確定する）
# チェックアウトし忘れた利用は、チェックインした日の閉店時刻で自動的に締める
#   - 閉店後にチェックアウトしても、閉店時刻までの料金になる
#   - 定期実行（bin/rails visits:auto_check_out）に加えて、チェックイン時や利用状況の取得時にも締める
class Visit < ApplicationRecord
  class AlreadyCheckedIn < StandardError; end

  belongs_to :user
  belongs_to :location

  validates :checked_in_at, presence: true
  validate :location_is_open, on: :create

  scope :in_progress, -> { where(checked_out_at: nil) }
  scope :finished, -> { where.not(checked_out_at: nil) }

  # 閉店時刻を過ぎても利用中のままの利用を締める。対象を絞るなら scope を渡す（例：会員の利用だけ）
  def self.auto_check_out_overdue!(scope = all, now: Time.current)
    # 営業時間は拠点ごとなので、閉店済みかどうかはRubyで判定する（チェックインが now より前のものに絞ってから）
    scope.in_progress.where(checked_in_at: ...now).includes(:location, :user).find_each do |visit|
      visit.auto_check_out! if visit.overdue?(now)
    end
  end

  # 受付のQRコード（CheckinCode）を読んだときだけチェックインできる（その場にいることを確かめる）
  # 同じ会員が同時に2か所へチェックインしないよう、会員行をロックしてから確認する
  def self.check_in!(user:, location:, code:, at: Time.current)
    unless CheckinCode.valid?(location, code, at:)
      visit = new(user:, location:)
      visit.errors.add(:code, "の有効期限が切れています。受付のQRコードを読み直してください")
      raise ActiveRecord::RecordInvalid, visit
    end
    transaction do
      user.lock!
      # 前回のチェックアウトし忘れは閉店時刻で締めてから確認する（締めないと別の拠点に入れない）
      auto_check_out_overdue!(user.visits, now: at)
      current = user.visits.in_progress.includes(:location).first
      raise AlreadyCheckedIn, "すでに#{current.location.name}にチェックイン中です" if current
      create!(user:, location:, checked_in_at: at)
    end
  end

  def in_progress? = checked_out_at.nil?

  # チェックインした日の閉店時刻。これを過ぎても利用中なら自動的に締める
  def auto_checkout_at = location.closes_at(checked_in_at.in_time_zone.to_date)

  def overdue?(now = Time.current) = in_progress? && now >= auto_checkout_at

  # 二重にチェックアウトされないよう、行をロックしてから料金を確定する
  # 閉店時刻を過ぎていたら、閉店時刻までの利用として自動チェックアウト扱いにする
  def check_out!(at: Time.current)
    with_lock do
      unless in_progress?
        errors.add(:base, "すでにチェックアウト済みです")
        raise ActiveRecord::RecordInvalid, self
      end
      if at >= auto_checkout_at
        finish!(auto_checkout_at, auto: true)
      else
        finish!(at, auto: false)
      end
    end
  end

  # 閉店時刻で締める（すでに締められていれば何もしない）
  def auto_check_out!
    with_lock do
      finish!(auto_checkout_at, auto: true) if in_progress?
    end
  end

  def duration_minutes(until_time = checked_out_at || Time.current)
    ((until_time - checked_in_at) / 60).floor
  end

  # 月額プランの会員は全拠点使い放題（0円）。それ以外は拠点の料金表で計算する
  def fee_until(time)
    return 0 if user.current_plan(checked_in_at.to_date)&.monthly?
    location.drop_in_fee(duration_minutes(time))
  end

  private

  def finish!(at, auto:)
    update!(checked_out_at: at, amount: fee_until(at), auto_checked_out: auto)
  end

  def location_is_open
    return if location.blank? || checked_in_at.blank?
    if !location.active?
      errors.add(:location, "は現在利用できません")
    elsif !location.open_at?(checked_in_at)
      errors.add(:base, "営業時間（#{location.open_hour}:00〜#{location.close_hour}:00）外のためチェックインできません")
    end
  end
end
