require "rails_helper"

RSpec.describe "管理者API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user, name: "佐藤花子") }

  it "一般会員は403" do
    get "/api/admin/users", headers: auth_headers(member)
    expect(response).to have_http_status(:forbidden)
  end

  it "会員を名前で検索できる" do
    member
    create(:user, name: "鈴木一郎")
    get "/api/admin/users", params: { q: "佐藤" }, headers: auth_headers(admin)
    expect(json.map { |r| r["name"] }).to eq [ "佐藤花子" ]
  end

  it "会員のプランを変更できる" do
    new_plan = create(:plan, name: "月額フル")
    patch "/api/admin/users/#{member.id}", params: { user: { plan_id: new_plan.id } }, headers: auth_headers(admin)
    expect(response).to have_http_status(:ok)
    expect(json.dig("plan", "id")).to eq new_plan.id
    expect(member.memberships.count).to eq 2
  end

  it "スペースを登録できる" do
    post "/api/admin/spaces", params: { space: { location_id: create(:location).id, name: "個室", kind: "meeting_room", capacity: 2 } }, headers: auth_headers(admin)
    expect(response).to have_http_status(:created)
  end

  it "スペースは拠点なしでは登録できない" do
    post "/api/admin/spaces", params: { space: { name: "個室", kind: "meeting_room", capacity: 2 } }, headers: auth_headers(admin)
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["errors"].keys).to include "location"
  end

  describe "拠点" do
    let(:params) do
      { name: "梅田", prefecture: "大阪府", address: "大阪市北区1-1", open_hour: 8, close_hour: 22,
        hourly_price: 400, daily_max_price: 2000 }
    end

    it "拠点を登録・停止できる" do
      post "/api/admin/locations", params: { location: params }, headers: auth_headers(admin)
      expect(response).to have_http_status(:created)
      patch "/api/admin/locations/#{json['id']}", params: { location: { active: false } }, headers: auth_headers(admin)
      expect(json["active"]).to be false
      get "/api/locations"
      expect(json).to be_empty
    end

    it "閉店が開店より前・不正な都道府県は422" do
      post "/api/admin/locations", params: { location: params.merge(open_hour: 22, close_hour: 8, prefecture: "東京") },
                                   headers: auth_headers(admin)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"].keys).to include("close_hour", "prefecture")
    end

    it "一般会員は登録できない" do
      post "/api/admin/locations", params: { location: params }, headers: auth_headers(member)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "売上集計" do
    include ActiveSupport::Testing::TimeHelpers

    # 月初の利用が「閉店済み」になる日時に固定する（月初の日中に実行すると結果が変わらないように）
    around { |example| travel_to(Time.zone.local(2026, 11, 15, 12, 0)) { example.run } }

    let(:month) { Date.current.beginning_of_month }
    let(:a) { create(:location, name: "A") }
    let(:b) { create(:location, name: "B") }

    def finished_visit(location:, at:, amount:)
      create(:visit, location:, checked_in_at: at, checked_out_at: at + 1.hour, amount:)
    end

    before do
      finished_visit(location: a, at: month.in_time_zone.change(hour: 10), amount: 600)
      finished_visit(location: a, at: month.in_time_zone.change(hour: 14), amount: 300)
      finished_visit(location: b, at: (month - 1.day).in_time_zone.change(hour: 10), amount: 999) # 先月
      # 1日のチェックアウトし忘れは閉店時刻で締めて数える（会員は月額プランなので0円）
      create(:visit, location: b, checked_in_at: month.in_time_zone.change(hour: 10))
      room = create(:space, location: b, kind: :meeting_room, hourly_price: 1000)
      build(:reservation, space: room, starts_at: month.in_time_zone.change(hour: 10), ends_at: month.in_time_zone.change(hour: 12), amount: 2000)
        .save!(validate: false)
      create(:user, plan: create(:plan, kind: :monthly, price: 8800))
    end

    it "拠点別のドロップイン・予約売上と月額プラン売上を返す" do
      get "/api/admin/sales", params: { month: month.strftime("%Y-%m") }, headers: auth_headers(admin)
      expect(response).to have_http_status(:ok)
      rows = json["locations"].index_by { |r| r.dig("location", "name") }
      expect(rows["A"]).to include("visit_count" => 2, "visit_amount" => 900, "reservation_amount" => 0)
      expect(rows["B"]).to include("visit_count" => 1, "visit_amount" => 0, "reservation_amount" => 2000)
      # adminとmemberのプラン（factoryの月額10000円）＋8800円
      expect(json["plan_amount"]).to eq Membership.active_on(Date.current).joins(:plan).merge(Plan.monthly).sum("plans.price")
      expect(json["total"]).to eq 900 + 2000 + json["plan_amount"]
    end

    it "月の形式が不正なら400" do
      get "/api/admin/sales", params: { month: "2026/11" }, headers: auth_headers(admin)
      expect(response).to have_http_status(:bad_request)
    end
  end
end
