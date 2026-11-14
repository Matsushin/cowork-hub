class Space < ApplicationRecord
  belongs_to :location
  has_many :reservations, dependent: :restrict_with_error

  enum :kind, { seat: 0, meeting_room: 1 }, validate: true

  validates :name, presence: true
  validates :capacity, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :hourly_price, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }
end
