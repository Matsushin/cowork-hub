require "rails_helper"
require "rake"

RSpec.describe "ドロップイン（入退室）", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:now) { Time.zone.local(2026, 11, 16, 10, 0) }
  let(:location) { create(:location, open_hour: 9, close_hour: 21, hourly_price: 300, daily_max_price: 1500) }
  let(:user) { create(:user, plan: create(:plan, kind: :drop_in, price: 0)) }

  around { |example| travel_to(now) { example.run } }

  # code を省略したら、その拠点の今のQRコードでチェックインする
  def check_in(as: user, target: location, code: CheckinCode.generate(target).code)
    post "/api/visits", headers: auth_headers(as), params: { visit: { location_id: target.id, code: }.compact }
  end

  describe "受付のQRコード" do
    # 2026-11-16 10:00:00 は60秒の時間枠の始まり（エポック秒が60で割り切れる）
    it "今の時間枠のコードでチェックインできる（枠の終わり＝59秒まで）" do
      code = CheckinCode.generate(location).code
      travel 59.seconds
      check_in(code:)
      expect(response).to have_http_status(:created)
    end

    it "1つ前の時間枠のコードでもチェックインできる（ちょうど60秒の切り替わり直後）" do
      travel_to(now + 59.seconds)
      code = CheckinCode.generate(location).code
      travel_to(now + 60.seconds)
      expect(CheckinCode.generate(location).code).not_to eq code
      check_in(code:)
      expect(response).to have_http_status(:created)
    end

    it "1つ前の時間枠の最後（119秒後）まで有効" do
      code = CheckinCode.generate(location).code
      travel 119.seconds
      check_in(code:)
      expect(response).to have_http_status(:created)
    end

    it "2つ前の時間枠のコード（ちょうど120秒後）は422で、チェックインされない" do
      code = CheckinCode.generate(location).code
      travel 120.seconds
      check_in(code:)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["error"]).to eq "QRコードの有効期限が切れています。受付のQRコードを読み直してください"
      expect(json["errors"].keys).to eq [ "code" ]
      expect(user.visits).to be_empty
    end

    it "別の拠点のコードは422" do
      check_in(code: CheckinCode.generate(create(:location)).code)
      expect(response).to have_http_status(:unprocessable_content)
      expect(user.visits).to be_empty
    end

    it "コードなし・でたらめなコードは422" do
      check_in(code: nil)
      expect(response).to have_http_status(:unprocessable_content)
      check_in(code: "0123456789abcdef")
      expect(response).to have_http_status(:unprocessable_content)
      expect(user.visits).to be_empty
    end

    it "有効なコードでも、営業時間外はこれまでどおり422" do
      travel_to(now.change(hour: 21))
      check_in
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["error"]).to include "営業時間"
    end

    it "未ログインは401" do
      post "/api/visits", params: { visit: { location_id: location.id, code: CheckinCode.generate(location).code } }
      expect(response).to have_http_status(:unauthorized)
    end
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

  describe "チェックアウトし忘れ（閉店時刻で自動チェックアウト）" do
    # 9:00〜21:00、300円/時・上限1500円。10:00にチェックイン
    def checked_in_visit
      check_in
      Visit.find(json["id"])
    end

    it "閉店後にチェックアウトすると、閉店時刻までの料金で自動チェックアウト扱いになる" do
      visit = checked_in_visit
      travel 2.days
      check_out(visit.id)
      expect(response).to have_http_status(:ok)
      expect(json).to include("auto_checked_out" => true, "amount" => 1500)
      expect(Time.zone.parse(json["checked_out_at"])).to eq now.change(hour: 21)
    end

    it "閉店時刻より前のチェックアウトは通常どおり" do
      visit = checked_in_visit
      travel 1.hour
      check_out(visit.id)
      expect(json).to include("auto_checked_out" => false, "amount" => 300)
    end

    it "閉店時刻ちょうどのチェックアウトは自動扱い（料金は同じ）" do
      visit = checked_in_visit
      travel 11.hours
      check_out(visit.id)
      expect(json).to include("auto_checked_out" => true, "duration_minutes" => 11 * 60)
    end

    it "閉店後に利用状況を開くと、利用中ではなく履歴に入っている" do
      visit = checked_in_visit
      travel 12.hours
      get "/api/visits/current", headers: auth_headers(user)
      expect(json).to be_nil
      get "/api/visits", headers: auth_headers(user)
      expect(json.first).to include("id" => visit.id, "auto_checked_out" => true, "amount" => 1500)
    end

    it "締め忘れがあっても、翌日は別の拠点にチェックインできる" do
      checked_in_visit
      travel 1.day
      check_in(target: create(:location))
      expect(response).to have_http_status(:created)
      expect(user.visits.in_progress.count).to eq 1
    end

    it "利用中は自動チェックアウトの予定時刻を返す" do
      checked_in_visit
      get "/api/visits/current", headers: auth_headers(user)
      expect(Time.zone.parse(json["auto_checkout_at"])).to eq now.change(hour: 21)
    end

    it "拠点の利用中の人数に、閉店後の締め忘れを数えない" do
      checked_in_visit
      travel 12.hours
      get "/api/locations/#{location.id}"
      expect(json["current_visitors"]).to eq 0
    end

    it "24時閉店の拠点は、翌日0時で締める" do
      late = create(:location, open_hour: 9, close_hour: 24)
      check_in(target: late)
      id = json["id"]
      travel 1.day
      check_out(id)
      expect(Time.zone.parse(json["checked_out_at"])).to eq now.tomorrow.beginning_of_day
    end

    it "定期実行のタスクで、閉店済みの利用だけを締める" do
      overdue = checked_in_visit
      other_user = create(:user)
      open_later = create(:location, open_hour: 9, close_hour: 23)
      travel 11.5.hours # 21:30。location は閉店済み、open_later はまだ営業中
      still_open = create(:visit, user: other_user, location: open_later, checked_in_at: now.change(hour: 21))

      Rails.application.load_tasks unless Rake::Task.task_defined?("visits:auto_check_out")
      expect { Rake::Task["visits:auto_check_out"].execute }.to output(/1件/).to_stdout

      expect(overdue.reload).to have_attributes(auto_checked_out: true, checked_out_at: now.change(hour: 21))
      expect(still_open.reload.checked_out_at).to be_nil
    end
  end
end
