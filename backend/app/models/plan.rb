class Plan < ApplicationRecord
  has_many :memberships, dependent: :restrict_with_error

  enum :kind, { drop_in: 0, monthly: 1 }

  validates :name, presence: true
  validates :price, numericality: { greater_than_or_equal_to: 0 }
  validates :monthly_hours_limit, numericality: { greater_than: 0 }, allow_nil: true
end
