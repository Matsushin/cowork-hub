# ドロップイン利用（予約なしでチェックインし、チェックアウト時に利用時間から料金を確定する）
class Visit < ApplicationRecord
  class AlreadyCheckedIn < StandardError; end

  belongs_to :user
  belongs_to :location

  validates :checked_in_at, presence: true
  validate :location_is_open, on: :create

  scope :in_progress, -> { where(checked_out_at: nil) }
  scope :finished, -> { where.not(checked_out_at: nil) }

  # 同じ会員が同時に2か所へチェックインしないよう、会員行をロックしてから確認する
  def self.check_in!(user:, location:, at: Time.current)
    transaction do
      user.lock!
      current = user.visits.in_progress.includes(:location).first
      raise AlreadyCheckedIn, "すでに#{current.location.name}にチェックイン中です" if current
      create!(user:, location:, checked_in_at: at)
    end
  end

  def in_progress? = checked_out_at.nil?

  # 二重にチェックアウトされないよう、行をロックしてから料金を確定する
  def check_out!(at: Time.current)
    with_lock do
      unless in_progress?
        errors.add(:base, "すでにチェックアウト済みです")
        raise ActiveRecord::RecordInvalid, self
      end
      update!(checked_out_at: at, amount: fee_until(at))
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

  def location_is_open
    return if location.blank? || checked_in_at.blank?
    if !location.active?
      errors.add(:location, "は現在利用できません")
    elsif !location.open_at?(checked_in_at)
      errors.add(:base, "営業時間（#{location.open_hour}:00〜#{location.close_hour}:00）外のためチェックインできません")
    end
  end
end
