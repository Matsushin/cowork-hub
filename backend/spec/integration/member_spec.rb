require "swagger_helper"

RSpec.describe "ドロップイン・予約・請求", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  # 営業時間内に固定する（チェックイン・予約は営業時間のチェックがあるため）
  around { |example| travel_to(Time.zone.local(2026, 11, 16, 12, 0)) { example.run } }

  let(:user) { create(:user) }
  let(:Authorization) { auth_headers(user)["Authorization"] }
  let(:location) { create(:location) }
  let(:space) { create(:space, location:, hourly_price: 500) }

  path "/api/visits" do
    get "ドロップインの利用履歴（新しい順・100件まで）" do
      tags "ドロップイン"
      produces "application/json"

      response "200", "利用履歴" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Visit" }
        before do
          create(:visit, user:, location:, checked_in_at: 1.day.ago.change(hour: 10), checked_out_at: 1.day.ago.change(hour: 11), amount: 300)
          create(:visit, user:, location:, checked_in_at: 1.hour.ago)
        end
        run_test!
      end

      it_requires_login
    end

    post "チェックイン（受付のQRコードが必要）" do
      tags "ドロップイン"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          visit: {
            type: :object,
            properties: {
              location_id: { type: :integer },
              code: { type: :string, description: "受付のQRコードに入っているコード（今と1つ前の時間枠のものが有効）" }
            },
            required: %w[location_id code]
          }
        },
        required: %w[visit]
      }
      let(:body) { { visit: { location_id: location.id, code: CheckinCode.generate(location).code } } }

      response "201", "チェックインした" do
        schema "$ref" => "#/components/schemas/Visit"
        run_test!
      end

      response "409", "すでに別の拠点を利用中" do
        schema "$ref" => "#/components/schemas/Error"
        before { create(:visit, user:, location: create(:location), checked_in_at: 1.hour.ago) }
        run_test!
      end

      response "422", "QRコードがない・期限切れ・別の拠点のもの、営業時間外など" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { visit: { location_id: location.id, code: CheckinCode.generate(create(:location)).code } } }
        run_test!
      end
    end
  end

  path "/api/visits/current" do
    get "利用中のドロップイン" do
      tags "ドロップイン"
      produces "application/json"

      response "200", "利用中の利用（なければ null）" do
        schema nullable: true, allOf: [ { "$ref" => "#/components/schemas/Visit" } ]
        before { create(:visit, user:, location:, checked_in_at: 1.hour.ago) }
        run_test! do
          expect(JSON.parse(response.body)["estimated_amount"]).to be_present
        end
      end
    end
  end

  path "/api/visits/{id}/checkout" do
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "チェックアウト（料金を確定）" do
      tags "ドロップイン"
      produces "application/json"

      response "200", "チェックアウトした" do
        schema "$ref" => "#/components/schemas/Visit"
        let(:id) { create(:visit, user:, location:, checked_in_at: 1.hour.ago).id }
        run_test!
      end

      response "404", "他人の利用" do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { create(:visit, location:, checked_in_at: 1.hour.ago).id }
        run_test!
      end
    end
  end

  path "/api/reservations" do
    get "自分の予約一覧" do
      tags "予約"
      produces "application/json"
      parameter name: :upcoming, in: :query, required: false, schema: { type: :string, enum: %w[true] },
                description: "true なら今後の確定済み予約だけを近い順に返す"

      response "200", "予約一覧" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Reservation" }
        let(:upcoming) { "true" }
        before { create(:reservation, user:, space:) }
        run_test!
      end

      it_requires_login
    end

    post "予約する（料金を確定）" do
      tags "予約"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          reservation: {
            type: :object,
            properties: {
              space_id: { type: :integer },
              starts_at: { type: :string, format: "date-time" },
              ends_at: { type: :string, format: "date-time" }
            },
            required: %w[space_id starts_at ends_at]
          }
        },
        required: %w[reservation]
      }
      let(:tomorrow) { Date.tomorrow.in_time_zone }
      let(:body) do
        { reservation: { space_id: space.id, starts_at: tomorrow.change(hour: 10).iso8601, ends_at: tomorrow.change(hour: 12).iso8601 } }
      end

      response "201", "予約した" do
        schema "$ref" => "#/components/schemas/Reservation"
        run_test!
      end

      response "409", "時間帯が重なる予約がある" do
        schema "$ref" => "#/components/schemas/Error"
        before { create(:reservation, space:, starts_at: tomorrow.change(hour: 11), ends_at: tomorrow.change(hour: 13)) }
        run_test!
      end

      response "422", "営業時間外・30分単位でないなど" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) do
          { reservation: { space_id: space.id, starts_at: tomorrow.change(hour: 7).iso8601, ends_at: tomorrow.change(hour: 8).iso8601 } }
        end
        run_test!
      end
    end
  end

  path "/api/reservations/{id}/cancel" do
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "予約のキャンセル（開始前のみ）" do
      tags "予約"
      produces "application/json"

      response "200", "キャンセルした" do
        schema "$ref" => "#/components/schemas/Reservation"
        let(:id) { create(:reservation, user:, space:).id }
        run_test!
      end

      response "422", "開始済み・キャンセル済み" do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { create(:reservation, user:, space:, status: :canceled).id }
        run_test!
      end
    end
  end

  path "/api/billing" do
    get "月次の請求" do
      tags "請求"
      produces "application/json"
      parameter name: :month, in: :query, required: false, schema: { type: :string, pattern: '^\d{4}-\d{2}$' }, description: "YYYY-MM（省略時は今月）"

      response "200", "プラン料金・ドロップイン・予約の明細と合計" do
        schema "$ref" => "#/components/schemas/Bill"
        let(:month) { "2026-11" }
        before do
          create(:visit, user:, location:, checked_in_at: 1.day.ago.change(hour: 10), checked_out_at: 1.day.ago.change(hour: 11), amount: 300)
          create(:reservation, user:, space:)
        end
        run_test!
      end

      response "400", "月の形式が不正" do
        schema "$ref" => "#/components/schemas/Error"
        let(:month) { "2026/11" }
        run_test!
      end
    end
  end
end
