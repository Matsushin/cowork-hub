class Space < ApplicationRecord
  has_many :reservations, dependent: :restrict_with_error

  enum :kind, { seat: 0, meeting_room: 1 }

  validates :name, presence: true
  validates :capacity, numericality: { greater_than: 0 }

  scope :active, -> { where(active: true) }
end
