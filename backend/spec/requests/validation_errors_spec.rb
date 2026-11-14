require "rails_helper"

RSpec.describe "バリデーションエラーの形式", type: :request do
  it "会員登録の入力エラーは項目ごとのメッセージを返す" do
    create(:user, email_address: "taken@example.com")
    post "/api/signup", params: { user: { name: "", email_address: "taken@example.com", password: "short" } }

    expect(response).to have_http_status(:unprocessable_content)
    expect(json["errors"]["name"]).to eq [ "名前を入力してください" ]
    expect(json["errors"]["email_address"]).to eq [ "メールアドレスはすでに使用されています" ]
    expect(json["errors"]["password"]).to eq [ "パスワードは8文字以上で入力してください" ]
    expect(json["error"]).to include "名前を入力してください"
  end

  it "項目に属さないエラーは base に入る" do
    user = create(:user, plan: create(:plan, monthly_hours_limit: 1))
    space = create(:space)
    post "/api/reservations", headers: auth_headers(user), params: {
      reservation: { space_id: space.id, starts_at: Date.tomorrow.in_time_zone.change(hour: 10).iso8601,
                     ends_at: Date.tomorrow.in_time_zone.change(hour: 12).iso8601 }
    }
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["errors"]["base"].first).to include "上限"
  end

  it "パラメータが欠けていると400" do
    post "/api/signup", params: {}
    expect(response).to have_http_status(:bad_request)
    expect(json["error"]).to eq "リクエストの形式が不正です"
  end

  it "不正な種別のスペースは422で kind のエラーを返す" do
    admin = create(:user, :admin)
    post "/api/admin/spaces", headers: auth_headers(admin), params: { space: { location_id: create(:location).id, name: "", kind: "garden", capacity: 0 } }
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["errors"].keys).to contain_exactly("name", "kind", "capacity")
  end
end
