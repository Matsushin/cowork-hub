require "rails_helper"

RSpec.describe "管理者向けの集計API", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  around { |example| travel_to(Time.zone.local(2026, 11, 20, 12, 0)) { example.run } }

  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user) }
  # A：9〜21時（12時間）・会議室1つ、B：9〜21時・会議室2つ
  let(:a) { create(:location, name: "A", prefecture: "大阪府") }
  let(:b) { create(:location, name: "B", prefecture: "東京都") }
  let(:room_a) { create(:space, location: a, name: "会議室", kind: :meeting_room, capacity: 4) }
  let!(:room_b1) { create(:space, location: b, name: "会議室1", kind: :meeting_room, capacity: 4) }
  let!(:room_b2) { create(:space, location: b, name: "会議室2", kind: :meeting_room, capacity: 8) }

  def reserve(space, day, from, to, amount)
    build(:reservation, space:, starts_at: Time.zone.local(2026, 11, day, from), ends_at: Time.zone.local(2026, 11, day, to), amount:)
      .tap { |r| r.save!(validate: false) }
  end

  def visit(location, day, from, to, amount)
    create(:visit, location:, checked_in_at: Time.zone.local(2026, 11, day, from), checked_out_at: Time.zone.local(2026, 11, day, to), amount:)
  end

  before do
    reserve(room_a, 2, 10, 12, 2000)  # 11/2（月）
    reserve(room_a, 3, 14, 15, 1000)  # 11/3（火）
    reserve(room_b1, 2, 10, 13, 3000) # 11/2（月）
    reserve(room_b2, 2, 9, 10, 2000).canceled! # 取り消しは数えない
    reserve(room_a, 10, 10, 11, 1000) # 期間外
    visit(a, 2, 9, 11, 600)
    visit(b, 3, 13, 14, 500)
  end

  def usage(**params)
    get "/api/admin/stats/usage", params: { from: "2026-11-02", to: "2026-11-03", **params }, headers: auth_headers(admin)
  end

  describe "利用状況" do
    it "拠点ごとに予約・ドロップインの件数・時間・金額と、会議室の稼働率を返す" do
      usage
      expect(response).to have_http_status(:ok)
      rows = json["rows"].index_by { |r| r["label"] }
      expect(json["rows"].map { |r| r["label"] }).to eq %w[A B] # 都道府県・名前の順
      expect(rows["A"]).to include("reservation_count" => 2, "reservation_hours" => 3.0, "reservation_amount" => 3000,
                                   "visit_count" => 1, "visit_hours" => 2.0, "visit_amount" => 600, "total_amount" => 3600)
      # A：予約3時間 ÷（12時間 × 会議室1 × 2日）＝ 12.5%、B：3時間 ÷（12 × 2 × 2）＝ 6.3%
      expect(rows["A"]["utilization_rate"]).to eq 12.5
      expect(rows["B"]["utilization_rate"]).to eq 6.3
      expect(json["totals"]).to include("reservation_count" => 3, "reservation_amount" => 6000, "visit_amount" => 1100,
                                        "total_amount" => 7100, "utilization_rate" => 8.3)
    end

    it "曜日ごとにまとめられ、件数0の曜日も返す" do
      usage(group_by: "weekday")
      rows = json["rows"].index_by { |r| r["label"] }
      expect(rows.keys).to eq %w[日曜日 月曜日 火曜日 水曜日 木曜日 金曜日 土曜日]
      expect(rows["月曜日"]).to include("reservation_count" => 2, "reservation_amount" => 5000, "visit_count" => 1)
      expect(rows["火曜日"]).to include("reservation_count" => 1, "visit_count" => 1)
      expect(rows["水曜日"]).to include("reservation_count" => 0, "utilization_rate" => nil)
    end

    it "時間帯ごとは、予約か利用があった時間だけを返し、稼働率は出さない" do
      usage(group_by: "hour")
      expect(json["rows"].map { |r| r["key"] }).to eq [ 9, 10, 13, 14 ]
      expect(json["rows"].find { |r| r["key"] == 10 }).to include("label" => "10時", "reservation_count" => 2, "utilization_rate" => nil)
    end

    it "スペースごとは、ドロップインを数えない（スペースに紐づかないため）" do
      usage(group_by: "space", location_id: b.id)
      expect(json["location"]).to eq("id" => b.id, "name" => "B")
      rows = json["rows"].index_by { |r| r["label"] }
      expect(rows.keys).to eq [ "B 会議室1", "B 会議室2" ]
      expect(rows["B 会議室1"]).to include("reservation_hours" => 3.0, "visit_count" => nil, "utilization_rate" => 12.5)
      expect(json["totals"]["visit_count"]).to be_nil
    end

    it "月ごとにまとめられる" do
      get "/api/admin/stats/usage", params: { from: "2026-10-01", to: "2026-11-30", group_by: "month" }, headers: auth_headers(admin)
      expect(json["rows"].map { |r| [ r["label"], r["reservation_count"] ] }).to eq [ [ "2026年10月", 0 ], [ "2026年11月", 4 ] ]
    end

    it "拠点で絞り込める" do
      usage(location_id: a.id)
      expect(json["rows"].map { |r| r["label"] }).to eq [ "A" ]
      expect(json["totals"]["reservation_amount"]).to eq 3000
    end

    it "日付・まとめ方・期間が正しくなければ400" do
      usage(from: "2026/11/02")
      expect(response).to have_http_status(:bad_request)
      usage(group_by: "user")
      expect(response).to have_http_status(:bad_request)
      get "/api/admin/stats/usage", params: { from: "2025-01-01", to: "2026-11-30" }, headers: auth_headers(admin)
      expect(json["error"]).to include "366日以内"
      get "/api/admin/stats/usage", headers: auth_headers(admin)
      expect(response).to have_http_status(:bad_request)
    end

    it "一般会員は403" do
      get "/api/admin/stats/usage", params: { from: "2026-11-02", to: "2026-11-03" }, headers: auth_headers(member)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "会員数" do
    it "プランごとの会員数・月額プランの料金、新しい会員・利用した会員の数を返す（個人の情報は返さない）" do
      admin
      light = create(:plan, name: "ライト", price: 8800)
      create(:user, plan: light)
      create(:user, plan: create(:plan, name: "ドロップイン", kind: :drop_in, price: 0))
      get "/api/admin/stats/members", params: { month: "2026-11" }, headers: auth_headers(admin)
      expect(response).to have_http_status(:ok)
      # 予約・利用のデータを作るときに会員が作られている（factory の reservation・visit）
      expect(json["member_count"]).to eq User.joins(:memberships).distinct.count
      expect(json["new_member_count"]).to eq User.count
      expect(json["active_member_count"]).to eq (Reservation.confirmed.where(starts_at: Time.zone.local(2026, 11).all_month).pluck(:user_id) | Visit.pluck(:user_id)).size
      expect(json["by_plan"].find { |p| p.dig("plan", "name") == "ライト" }).to include("member_count" => 1, "plan_amount" => 8800)
      expect(json.to_s).not_to include("@example.com")
    end

    it "一般会員は403" do
      get "/api/admin/stats/members", headers: auth_headers(member)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
