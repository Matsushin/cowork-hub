class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :plan

  validates :started_on, presence: true
  validate :ended_on_after_started_on

  scope :active_on, ->(date) {
    where(started_on: ..date).where("ended_on IS NULL OR ended_on >= ?", date)
  }

  private

  def ended_on_after_started_on
    return if ended_on.blank? || started_on.blank?
    errors.add(:ended_on, "は開始日以降にしてください") if ended_on < started_on - 1
  end
end
