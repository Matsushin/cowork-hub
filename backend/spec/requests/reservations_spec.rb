require "rails_helper"

RSpec.describe "予約", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:tomorrow) { Date.tomorrow }

  def reserve(from:, to:, as: user, target: space)
    post "/api/reservations", headers: auth_headers(as), params: {
      reservation: { space_id: target.id, starts_at: tomorrow.in_time_zone.change(hour: from).iso8601,
                     ends_at: tomorrow.in_time_zone.change(hour: to).iso8601 }
    }
  end

  it "予約を作成すると、確認メールを非同期で送る" do
    expect { reserve(from: 10, to: 12) }.to have_enqueued_mail(ReservationMailer, :confirmed)
    expect(response).to have_http_status(:created)
    expect(json.dig("space", "id")).to eq space.id
  end

  it "同じスペースの重なる時間帯は409で拒否され、メールも送らない" do
    reserve(from: 10, to: 12)
    expect { reserve(from: 11, to: 13, as: create(:user)) }.not_to have_enqueued_mail
    expect(response).to have_http_status(:conflict)
  end

  it "隣接する時間帯や別スペースなら予約できる" do
    reserve(from: 10, to: 12)
    reserve(from: 12, to: 13)
    expect(response).to have_http_status(:created)
    reserve(from: 10, to: 12, target: create(:space))
    expect(response).to have_http_status(:created)
  end

  it "キャンセル済みの枠は再度予約できる（キャンセル時もメールを送る）" do
    reserve(from: 10, to: 12)
    expect {
      patch "/api/reservations/#{json['id']}/cancel", headers: auth_headers(user)
    }.to have_enqueued_mail(ReservationMailer, :canceled)
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
    get "/api/locations/#{space.location_id}/spaces/availability", params: { date: tomorrow.to_s }, headers: auth_headers(user)
    expect(json["reserved"].first).to include("space_id" => space.id, "mine" => false)
  end

  it "空き状況は指定した拠点のスペースだけを返し、営業時間は拠点のものを返す" do
    other_location = create(:location, open_hour: 7, close_hour: 23)
    other_space = create(:space, location: other_location)
    create(:reservation, space:, starts_at: tomorrow.in_time_zone.change(hour: 10), ends_at: tomorrow.in_time_zone.change(hour: 11))
    get "/api/locations/#{other_location.id}/spaces/availability", params: { date: tomorrow.to_s }, headers: auth_headers(user)
    expect(json).to include("open_hour" => 7, "close_hour" => 23, "reserved" => [])
    get "/api/locations/#{other_location.id}/spaces", headers: auth_headers(user)
    expect(json.map { |s| s["id"] }).to eq [ other_space.id ]
  end

  describe "拠点ごとの営業時間・料金" do
    let(:location) { create(:location, open_hour: 7, close_hour: 23) }
    let(:space) { create(:space, location:, kind: :meeting_room, hourly_price: 1500) }

    it "拠点の営業時間内なら早朝・深夜も予約でき、終了ちょうどの23時までは可" do
      reserve(from: 7, to: 8)
      expect(response).to have_http_status(:created)
      reserve(from: 22, to: 23)
      expect(response).to have_http_status(:created)
    end

    it "拠点の営業時間外は422" do
      reserve(from: 6, to: 7)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["error"]).to include "7:00〜23:00"
    end

    it "予約時のスペース料金×時間で金額を確定し、あとで料金を変えても変わらない" do
      reserve(from: 10, to: 12)
      expect(json["amount"]).to eq 3000
      space.update!(hourly_price: 9999)
      expect(Reservation.find(json["id"]).amount).to eq 3000
    end

    it "停止中の拠点のスペースは予約できない" do
      location.update!(active: false)
      reserve(from: 10, to: 12)
      expect(response).to have_http_status(:not_found).or have_http_status(:unprocessable_content)
    end
  end

  describe "予約一覧" do
    let(:now) { Time.zone.local(2026, 11, 14, 12, 0) }

    # 過去日時の予約は作成時の検証（プラン・上限など）を通さず直接作る
    def create_reservation(starts:, ends:, owner: user, status: :confirmed)
      build(:reservation, user: owner, space: create(:space), starts_at: starts, ends_at: ends, status:).tap { |r| r.save!(validate: false) }
    end

    def ids
      json.map { |r| r["id"] }
    end

    around { |example| travel_to(now) { example.run } }

    let!(:past) { create_reservation(starts: now.change(hour: 9), ends: now.change(hour: 11)) }
    let!(:canceled) { create_reservation(starts: now + 1.day, ends: now + 1.day + 2.hours, status: :canceled) }
    let!(:later) { create_reservation(starts: now + 3.days, ends: now + 3.days + 2.hours) }
    let!(:sooner) { create_reservation(starts: now + 1.day, ends: now + 1.day + 2.hours) }
    let!(:ending_now) { create_reservation(starts: now - 2.hours, ends: now) }
    let!(:others) { create_reservation(starts: now + 2.days, ends: now + 2.days + 2.hours, owner: create(:user)) }

    it "upcoming=true は過去・キャンセル済み・他人の予約を除き、開始が近い順で返す" do
      get "/api/reservations", params: { upcoming: "true" }, headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(ids).to eq [ ending_now.id, sooner.id, later.id ]
    end

    it "upcoming=true は終了時刻ちょうどの予約を含み、終了済みは含まない" do
      get "/api/reservations", params: { upcoming: "true" }, headers: auth_headers(user)
      expect(ids).to include ending_now.id
      expect(ids).not_to include past.id

      travel 1.second
      get "/api/reservations", params: { upcoming: "true" }, headers: auth_headers(user)
      expect(ids).not_to include ending_now.id
    end

    it "upcoming なしはキャンセル済みも含めて新しい順で返し、他人の予約は含まない" do
      get "/api/reservations", headers: auth_headers(user)
      expect(ids).to match_array [ later.id, canceled.id, sooner.id, past.id, ending_now.id ]
      starts = ids.map { |id| Reservation.find(id).starts_at }
      expect(starts).to eq starts.sort.reverse
      expect(ids).not_to include others.id
      expect(ids).to include canceled.id
    end

    it "upcoming=false は新しい順で返す" do
      get "/api/reservations", params: { upcoming: "false" }, headers: auth_headers(user)
      starts = ids.map { |id| Reservation.find(id).starts_at }
      expect(starts).to eq starts.sort.reverse
      expect(ids).to include past.id, canceled.id
      expect(ids).not_to include others.id
    end
  end
end
