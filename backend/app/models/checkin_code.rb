# 受付のQRコードに入れるチェックイン用のコード（TOTPと同じ考え方。DBには保存しない）
#   - サーバーの秘密鍵で「拠点ID＋60秒ごとの時間枠」から HMAC で作る
#   - 今の時間枠と1つ前の時間枠のコードを有効にする（読み取った直後に切り替わっても失敗しないように。最長で約2分）
#   - 別の拠点のコードは無効
class CheckinCode
  INTERVAL = 60 # 秒
  LENGTH = 16 # 16進数の桁数（64ビット）

  Result = Data.define(:code, :expires_at)

  class << self
    # 今の時間枠のコードと、その枠が終わる時刻
    def generate(location, at: Time.current)
      step = step_at(at)
      Result.new(code: digest(location.id, step), expires_at: Time.zone.at((step + 1) * INTERVAL))
    end

    def valid?(location, code, at: Time.current)
      return false if location.blank? || code.blank?
      step = step_at(at)
      [ step, step - 1 ].any? { |s| ActiveSupport::SecurityUtils.secure_compare(digest(location.id, s), code.to_s) }
    end

    private

    def step_at(time) = time.to_i / INTERVAL

    def digest(location_id, step)
      OpenSSL::HMAC.hexdigest("SHA256", secret, "#{location_id}:#{step}").first(LENGTH)
    end

    # secret_key_base から用途専用の鍵を作る（本番の secret_key_base は SSM から渡す）
    def secret
      @secret ||= Rails.application.key_generator.generate_key("checkin_code", 32)
    end
  end
end
