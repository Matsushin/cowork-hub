require "rails_helper"

RSpec.describe "ドロップイン（入退室）", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:now) { Time.zone.local(2026, 11, 16, 10, 0) }
  let(:location) { create(:location, open_hour: 9, close_hour: 21, hourly_price: 300, daily_max_price: 1500) }
  let(:user) { create(:user, plan: create(:plan, kind: :drop_in, price: 0)) }

  around { |example| travel_to(now) { example.run } }

  def check_in(as: user, target: location)
    post "/api/visits", headers: auth_headers(as), params: { visit: { location_id: target.id } }
  end

  def check_out(id, as: user)
    patch "/api/visits/#{id}/checkout", headers: auth_headers(as)
  end

  it "チェックインして、利用中として取得できる" do
    check_in
    expect(response).to have_http_status(:created)
    get "/api/visits/current", headers: auth_headers(user)
    expect(json).to include("location" => { "id" => location.id, "name" => location.name }, "checked_out_at" => nil)
  end

  it "利用中でなければ current は null" do
    get "/api/visits/current", headers: auth_headers(user)
    expect(response).to have_http_status(:ok)
    expect(json).to be_nil
  end

  it "利用中に別の拠点へはチェックインできない（409）" do
    check_in
    check_in(target: create(:location))
    expect(response).to have_http_status(:conflict)
    expect(json["error"]).to include location.name
  end

  it "営業時間外・停止中の拠点にはチェックインできない" do
    travel 11.hours # 21:00（閉店時刻ちょうど）
    check_in
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["error"]).to include "営業時間"

    location.update!(active: false)
    check_in
    expect(response).to have_http_status(:not_found)
  end

  describe "料金（30分ごとに1時間料金の半額、1回の上限あり）" do
    {
      1 => 150,                  # 最低30分
      30 => 150,
      31 => 300,                 # 30分を超えたら次の単位
      90 => 450,
      (8 * 60) => 1500           # 上限
    }.each do |minutes, amount|
      it "#{minutes}分の利用は#{amount}円" do
        check_in
        id = json["id"]
        travel minutes.minutes
        check_out(id)
        expect(response).to have_http_status(:ok)
        expect(json).to include("amount" => amount, "duration_minutes" => minutes)
      end
    end

    it "月額プランの会員は0円" do
      monthly = create(:user, plan: create(:plan, kind: :monthly))
      check_in(as: monthly)
      id = json["id"]
      travel 3.hours
      check_out(id, as: monthly)
      expect(json["amount"]).to eq 0
    end
  end

  it "利用中は目安の料金を返す" do
    check_in
    travel 45.minutes
    get "/api/visits/current", headers: auth_headers(user)
    expect(json["estimated_amount"]).to eq 300
  end

  it "二重にチェックアウトすると422で、料金は変わらない" do
    check_in
    id = json["id"]
    travel 30.minutes
    check_out(id)
    travel 2.hours
    check_out(id)
    expect(response).to have_http_status(:unprocessable_content)
    expect(Visit.find(id).amount).to eq 150
  end

  it "他人の利用はチェックアウトできない" do
    other = create(:visit, location:)
    check_out(other.id)
    expect(response).to have_http_status(:not_found)
  end

  it "利用履歴は自分の分だけを新しい順で返す" do
    old = create(:visit, user:, location:, checked_in_at: now - 2.days, checked_out_at: now - 2.days + 1.hour, amount: 300)
    check_in
    create(:visit, location:)
    get "/api/visits", headers: auth_headers(user)
    expect(json.map { |v| v["id"] }).to eq [ Visit.last(2).first.id, old.id ]
  end
end
