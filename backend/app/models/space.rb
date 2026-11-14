class Space < ApplicationRecord
  has_many :reservations, dependent: :restrict_with_error

  enum :kind, { seat: 0, meeting_room: 1 }, validate: true

  validates :name, presence: true
  validates :capacity, numericality: { only_integer: true, greater_than_or_equal_to: 1 }

  scope :active, -> { where(active: true) }
end
