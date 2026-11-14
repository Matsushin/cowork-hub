class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :memberships, dependent: :destroy
  has_many :reservations, dependent: :destroy

  enum :role, { member: 0, admin: 1 }

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, allow_nil: true

  scope :search, ->(q) {
    q.present? ? where("name LIKE :q OR email_address LIKE :q", q: "%#{sanitize_sql_like(q)}%") : all
  }

  def current_membership(on = Date.current)
    memberships.active_on(on).order(started_on: :desc).first
  end

  def current_plan(on = Date.current)
    current_membership(on)&.plan
  end

  # プランを切り替える（現在の契約を前日で終了し、新しい契約を開始）
  def change_plan!(plan, on: Date.current)
    transaction do
      memberships.active_on(on).find_each { |m| m.update!(ended_on: on - 1) }
      memberships.create!(plan:, started_on: on)
    end
  end
end
