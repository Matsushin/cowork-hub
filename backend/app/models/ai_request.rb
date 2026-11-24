# AI 機能の利用記録（1回の相談ごと）
#
# - 相談を始める前に start! で記録を作る。このとき会員ごとの1日の回数の上限を確かめる（超えていたら LimitExceeded）
# - 相談が終わったら finish! でトークン数・料金・応答時間などを書く
# - 入力の文章や AI の回答は保存しない（数字だけ）
class AiRequest < ApplicationRecord
  class LimitExceeded < StandardError; end

  FEATURES = %w[booking].freeze

  belongs_to :user

  enum :status, { started: 0, succeeded: 1, failed: 2, refused: 3 }, validate: true

  validates :feature, inclusion: { in: FEATURES }
  validates :input_tokens, :output_tokens, :cache_read_input_tokens, :cache_creation_input_tokens,
            :cost_micro_usd, :tool_calls, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :duration_ms, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  scope :on_day, ->(time) { where(created_at: time.all_day) }

  # 会員1人あたりの1日の回数の上限（環境変数 AI_DAILY_LIMIT。既定20回）
  def self.daily_limit = Integer(ENV.fetch("AI_DAILY_LIMIT", 20))

  # 今日あと何回使えるか（日本時間の日付で数える）
  def self.remaining_for(user, now: Time.current)
    [ daily_limit - user.ai_requests.on_day(now).count, 0 ].max
  end

  # 同じ会員が同時に何回も始めても上限を超えないよう、会員行をロックしてから数える
  def self.start!(user:, feature:, now: Time.current)
    transaction do
      user.lock!
      raise LimitExceeded, "今日の AI の利用回数の上限（#{daily_limit}回）に達しました。明日またお試しください" if remaining_for(user, now:).zero?

      create!(user:, feature:)
    end
  end

  # 終わった相談の記録を書く。書けるのは始めたばかり（started）の記録だけで、終わった状態にする
  # 同じ記録への書き込みが同時に来ても二重に書かないよう、行をロックしてから確かめる
  def finish!(attrs)
    with_lock do
      unless started?
        errors.add(:base, "この記録はすでに終わっています")
        raise ActiveRecord::RecordInvalid, self
      end
      assign_attributes(attrs)
      if started?
        errors.add(:status, "は終わった状態（succeeded・failed・refused）にしてください")
        raise ActiveRecord::RecordInvalid, self
      end
      save!
    end
  end
end
