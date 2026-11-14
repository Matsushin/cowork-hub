require "rails_helper"

RSpec.describe "予約", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:tomorrow) { Date.tomorrow }

  def reserve(from:, to:, as: user, target: space)
    post "/api/reservations", headers: auth_headers(as), params: {
      reservation: { space_id: target.id, starts_at: tomorrow.in_time_zone.change(hour: from).iso8601,
                     ends_at: tomorrow.in_time_zone.change(hour: to).iso8601 }
    }
  end

  it "予約を作成できる" do
    reserve(from: 10, to: 12)
    expect(response).to have_http_status(:created)
    expect(json.dig("space", "id")).to eq space.id
  end

  it "同じスペースの重なる時間帯は409で拒否される" do
    reserve(from: 10, to: 12)
    reserve(from: 11, to: 13, as: create(:user))
    expect(response).to have_http_status(:conflict)
  end

  it "隣接する時間帯や別スペースなら予約できる" do
    reserve(from: 10, to: 12)
    reserve(from: 12, to: 13)
    expect(response).to have_http_status(:created)
    reserve(from: 10, to: 12, target: create(:space))
    expect(response).to have_http_status(:created)
  end

  it "キャンセル済みの枠は再度予約できる" do
    reserve(from: 10, to: 12)
    patch "/api/reservations/#{json['id']}/cancel", headers: auth_headers(user)
    expect(json["status"]).to eq "canceled"
    reserve(from: 10, to: 12, as: create(:user))
    expect(response).to have_http_status(:created)
  end

  it "営業時間外は422" do
    reserve(from: 7, to: 9)
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "プランの月間上限を超えると422" do
    limited = create(:user, plan: create(:plan, monthly_hours_limit: 3))
    reserve(from: 10, to: 12, as: limited)
    expect(response).to have_http_status(:created)
    reserve(from: 13, to: 15, as: limited)
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["error"]).to include "上限"
  end

  it "他人の予約はキャンセルできない" do
    other = create(:reservation)
    patch "/api/reservations/#{other.id}/cancel", headers: auth_headers(user)
    expect(response).to have_http_status(:not_found)
  end

  it "空き状況では他人の予約が mine=false で返る" do
    create(:reservation, space:, starts_at: tomorrow.in_time_zone.change(hour: 10), ends_at: tomorrow.in_time_zone.change(hour: 11))
    get "/api/spaces/availability", params: { date: tomorrow.to_s }, headers: auth_headers(user)
    expect(json["reserved"].first).to include("space_id" => space.id, "mine" => false)
  end
end
