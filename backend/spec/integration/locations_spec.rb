require "swagger_helper"

RSpec.describe "拠点・スペース", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { auth_headers(user)["Authorization"] }
  let(:location) { create(:location, description: "駅から徒歩3分") }
  let!(:space) { create(:space, location:) }
  let(:location_id) { location.id }

  path "/api/locations" do
    get "拠点の検索" do
      tags "拠点"
      produces "application/json"
      security []
      parameter name: :q, in: :query, required: false, schema: { type: :string }, description: "拠点名・住所の部分一致"
      parameter name: :prefecture, in: :query, required: false, schema: { type: :string }

      response "200", "公開中の拠点（利用中の人数つき）" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Location" }
        let(:prefecture) { "東京都" }
        before { create(:visit, location:) }
        run_test! do
          expect(JSON.parse(response.body).first["current_visitors"]).to eq 1
        end
      end
    end
  end

  path "/api/locations/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }

    get "拠点の詳細" do
      tags "拠点"
      produces "application/json"
      security []

      response "200", "拠点とスペース一覧" do
        schema "$ref" => "#/components/schemas/LocationDetail"
        let(:id) { location.id }
        run_test!
      end

      response "404", "存在しない・非公開" do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { create(:location, active: false).id }
        run_test!
      end
    end
  end

  path "/api/locations/{location_id}/spaces" do
    parameter name: :location_id, in: :path, schema: { type: :integer }

    get "拠点のスペース一覧" do
      tags "拠点"
      produces "application/json"

      response "200", "利用できるスペース" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Space" }
        run_test!
      end

      it_requires_login
    end
  end

  path "/api/locations/{location_id}/spaces/availability" do
    parameter name: :location_id, in: :path, schema: { type: :integer }

    get "指定日の空き状況（予約済みの時間帯）" do
      tags "拠点"
      produces "application/json"
      parameter name: :date, in: :query, required: false, schema: { type: :string, format: :date }, description: "省略時は今日"

      response "200", "予約済みの時間帯（誰の予約かは mine だけ返す）" do
        schema "$ref" => "#/components/schemas/Availability"
        let(:date) { Date.tomorrow.iso8601 }
        before { create(:reservation, user:, space:) }
        run_test!
      end

      response "400", "日付の形式が不正" do
        schema "$ref" => "#/components/schemas/Error"
        let(:date) { "2026-13-40" }
        run_test!
      end

      it_requires_login
    end
  end
end
