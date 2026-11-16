require "swagger_helper"

RSpec.describe "管理", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  around { |example| travel_to(Time.zone.local(2026, 11, 16, 12, 0)) { example.run } }

  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user) }
  let(:Authorization) { auth_headers(admin)["Authorization"] }
  let(:location) { create(:location) }
  let(:space) { create(:space, location:) }

  # 管理APIは会員のトークンでは403になる
  def self.it_requires_admin
    response "403", "管理者以外" do
      schema "$ref" => "#/components/schemas/Error"
      let(:Authorization) { auth_headers(member)["Authorization"] }
      run_test!
    end
  end

  path "/api/admin/users" do
    get "会員一覧" do
      tags "管理"
      produces "application/json"
      parameter name: :q, in: :query, required: false, schema: { type: :string }, description: "名前・メールアドレスの部分一致"

      response "200", "会員一覧" do
        schema type: :array, items: { "$ref" => "#/components/schemas/User" }
        before do
          member
          create(:user, plan: nil) # プラン未設定（plan: null）
        end
        run_test!
      end

      it_requires_admin
    end
  end

  path "/api/admin/users/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:id) { member.id }

    get "会員の詳細（直近の予約・利用つき）" do
      tags "管理"
      produces "application/json"

      response "200", "会員の詳細" do
        schema "$ref" => "#/components/schemas/UserDetail"
        before do
          create(:reservation, user: member, space:)
          create(:visit, user: member, location:, checked_in_at: 1.hour.ago)
        end
        run_test!
      end

      response "404", "存在しない会員" do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { 0 }
        run_test!
      end
    end

    patch "会員の権限・プランの変更" do
      tags "管理"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          user: {
            type: :object,
            properties: { role: { type: :string, enum: %w[member admin] }, plan_id: { type: :integer } }
          }
        },
        required: %w[user]
      }

      response "200", "変更した" do
        schema "$ref" => "#/components/schemas/User"
        let(:body) { { user: { role: "admin", plan_id: create(:plan).id } } }
        run_test!
      end

      response "422", "存在しない権限" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { user: { role: "owner" } } }
        run_test!
      end
    end
  end

  path "/api/admin/reservations" do
    get "全会員の予約（新しい順・200件まで）" do
      tags "管理"
      produces "application/json"
      parameter name: :date, in: :query, required: false, schema: { type: :string, format: :date }

      response "200", "予約一覧（会員情報つき）" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Reservation" }
        let(:date) { Date.tomorrow.iso8601 }
        before { create(:reservation, user: member, space:) }
        run_test!
      end

      it_requires_admin
    end
  end

  path "/api/admin/locations" do
    get "拠点一覧（非公開を含む）" do
      tags "管理"
      produces "application/json"

      response "200", "拠点一覧" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Location" }
        before { location }
        run_test!
      end

      it_requires_admin
    end

    post "拠点の追加" do
      tags "管理"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          location: {
            type: :object,
            properties: {
              name: { type: :string },
              prefecture: { type: :string },
              address: { type: :string },
              description: { type: :string },
              open_hour: { type: :integer },
              close_hour: { type: :integer },
              hourly_price: { type: :integer },
              daily_max_price: { type: :integer }
            },
            required: %w[name prefecture address open_hour close_hour hourly_price daily_max_price]
          }
        },
        required: %w[location]
      }

      response "201", "追加した" do
        schema "$ref" => "#/components/schemas/Location"
        let(:body) do
          { location: { name: "梅田", prefecture: "大阪府", address: "大阪市北区1-1", open_hour: 9, close_hour: 21,
                        hourly_price: 300, daily_max_price: 1500 } }
        end
        run_test!
      end

      response "422", "入力内容の誤り" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { location: { name: "", prefecture: "大阪府", address: "", open_hour: 21, close_hour: 9 } } }
        run_test!
      end
    end
  end

  path "/api/admin/locations/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "拠点の更新（公開・非公開の切り替えなど）" do
      tags "管理"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { location: { type: :object, properties: { active: { type: :boolean } } } },
        required: %w[location]
      }

      response "200", "更新した" do
        schema "$ref" => "#/components/schemas/Location"
        let(:id) { location.id }
        let(:body) { { location: { active: false } } }
        run_test!
      end
    end
  end

  path "/api/admin/locations/{id}/checkin_code" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:id) { location.id }

    get "受付用QRのコード（60秒ごとに変わる）" do
      tags "管理"
      produces "application/json"

      response "200", "今の時間枠のコード" do
        schema "$ref" => "#/components/schemas/CheckinCode"
        run_test!
      end

      it_requires_admin
      it_requires_login
    end
  end

  path "/api/admin/spaces" do
    get "スペース一覧（非公開を含む）" do
      tags "管理"
      produces "application/json"

      response "200", "スペース一覧（拠点名つき）" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Space" }
        before { space }
        run_test!
      end

      it_requires_admin
    end

    post "スペースの追加" do
      tags "管理"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          space: {
            type: :object,
            properties: {
              location_id: { type: :integer },
              name: { type: :string },
              kind: { type: :string, enum: %w[seat meeting_room] },
              capacity: { type: :integer },
              hourly_price: { type: :integer }
            },
            required: %w[location_id name kind capacity hourly_price]
          }
        },
        required: %w[space]
      }

      response "201", "追加した" do
        schema "$ref" => "#/components/schemas/Space"
        let(:body) { { space: { location_id: location.id, name: "会議室A", kind: "meeting_room", capacity: 6, hourly_price: 1000 } } }
        run_test!
      end

      response "422", "入力内容の誤り" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { space: { location_id: nil, name: "", kind: "seat", capacity: 0, hourly_price: 0 } } }
        run_test!
      end
    end
  end

  path "/api/admin/spaces/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:id) { space.id }

    patch "スペースの更新" do
      tags "管理"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { space: { type: :object, properties: { active: { type: :boolean } } } },
        required: %w[space]
      }

      response "200", "更新した" do
        schema "$ref" => "#/components/schemas/Space"
        let(:body) { { space: { active: false } } }
        run_test!
      end
    end

    delete "スペースの削除（予約があれば削除できない）" do
      tags "管理"
      produces "application/json"

      response "204", "削除した" do
        run_test!
      end

      response "422", "予約がある" do
        schema "$ref" => "#/components/schemas/Error"
        before { create(:reservation, space:) }
        run_test!
      end
    end
  end

  path "/api/admin/sales" do
    get "拠点別の月次売上" do
      tags "管理"
      produces "application/json"
      parameter name: :month, in: :query, required: false, schema: { type: :string, pattern: '^\d{4}-\d{2}$' }

      response "200", "拠点別の売上と月額プラン料金" do
        schema "$ref" => "#/components/schemas/Sales"
        let(:month) { "2026-11" }
        before do
          create(:visit, location:, checked_in_at: 1.day.ago.change(hour: 10), checked_out_at: 1.day.ago.change(hour: 11), amount: 300)
        end
        run_test!
      end

      it_requires_admin
    end
  end
end
