require "rails_helper"

RSpec.describe "月次請求", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:now) { Time.zone.local(2026, 11, 20, 12, 0) }
  let(:location) { create(:location) }

  around { |example| travel_to(now) { example.run } }

  def visit_at(user, at, amount)
    create(:visit, user:, location:, checked_in_at: at, checked_out_at: at + 1.hour, amount:)
  end

  def reservation_at(user, at, amount, status: :confirmed)
    build(:reservation, user:, space: create(:space, location:), starts_at: at, ends_at: at + 1.hour, amount:, status:)
      .tap { |r| r.save!(validate: false) }
  end

  it "ドロップイン会員：その月の利用料と予約料金を合計する" do
    user = create(:user, plan: create(:plan, kind: :drop_in, price: 0))
    visit_at(user, Time.zone.local(2026, 11, 1, 10), 600)
    visit_at(user, Time.zone.local(2026, 11, 30, 20), 300)
    visit_at(user, Time.zone.local(2026, 10, 31, 20), 999)            # 先月
    create(:visit, user:, location:, checked_in_at: now - 1.hour)     # 利用中は含めない
    reservation_at(user, Time.zone.local(2026, 11, 5, 10), 2000)
    reservation_at(user, Time.zone.local(2026, 11, 6, 10), 5000, status: :canceled)
    visit_at(create(:user), Time.zone.local(2026, 11, 2, 10), 777)   # 他人

    get "/api/billing", params: { month: "2026-11" }, headers: auth_headers(user)
    expect(response).to have_http_status(:ok)
    expect(json).to include("month" => "2026-11", "plan_fee" => 0, "visits_total" => 900,
                            "reservations_total" => 2000, "total" => 2900)
    expect(json["visits"].size).to eq 2
  end

  it "月額会員：プラン料金を含める" do
    user = create(:user, plan: create(:plan, kind: :monthly, price: 8800))
    visit_at(user, Time.zone.local(2026, 11, 3, 10), 0)
    get "/api/billing", headers: auth_headers(user)
    expect(json).to include("month" => "2026-11", "plan_fee" => 8800, "total" => 8800)
  end

  it "月の形式が不正なら400" do
    get "/api/billing", params: { month: "2026-13" }, headers: auth_headers(create(:user))
    expect(response).to have_http_status(:bad_request)
  end

  it "未ログインは401" do
    get "/api/billing"
    expect(response).to have_http_status(:unauthorized)
  end
end
