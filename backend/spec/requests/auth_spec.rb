require "rails_helper"

RSpec.describe "認証", type: :request do
  let!(:drop_in) { create(:plan, kind: :drop_in, price: 0, monthly_hours_limit: 8) }

  it "会員登録するとトークンが返り、ドロップインプランが付与される" do
    post "/api/signup", params: { user: { name: "山田", email_address: "Yamada@Example.com", password: "password123" } }
    expect(response).to have_http_status(:created)
    expect(json["token"]).to be_present
    expect(json.dig("user", "email_address")).to eq "yamada@example.com"
    expect(json.dig("user", "plan", "id")).to eq drop_in.id
  end

  it "正しいパスワードでログインでき、誤りなら401" do
    user = create(:user, password: "password123")
    post "/api/session", params: { email_address: user.email_address, password: "password123" }
    expect(response).to have_http_status(:created)

    post "/api/session", params: { email_address: user.email_address, password: "wrong" }
    expect(response).to have_http_status(:unauthorized)
  end

  describe "ログインの入力が不正なとき" do
    let!(:user) { create(:user, password: "password123") }

    [
      [ "passwordがない", ->(u) { { email_address: u.email_address } } ],
      [ "email_addressがない", ->(_) { { password: "password123" } } ],
      [ "どちらもない", ->(_) { {} } ],
      [ "passwordが配列", ->(u) { { email_address: u.email_address, password: [ "password123" ] } } ],
      [ "passwordがハッシュ", ->(u) { { email_address: u.email_address, password: { a: "b" } } } ],
      [ "email_addressが配列", ->(_) { { email_address: [ "a@example.com" ], password: "password123" } } ]
    ].each do |name, build|
      it "#{name}場合も500にならず401を返す" do
        post "/api/session", params: build.call(user)
        expect(response).to have_http_status(:unauthorized)
        expect(json["error"]).to eq "メールアドレスまたはパスワードが正しくありません"
      end
    end
  end

  it "トークンなしでは401、ログアウト後のトークンは使えない" do
    get "/api/me"
    expect(response).to have_http_status(:unauthorized)

    user = create(:user)
    headers = auth_headers(user)
    get "/api/me", headers: headers
    expect(json["id"]).to eq user.id

    delete "/api/session", headers: headers
    get "/api/me", headers: headers
    expect(response).to have_http_status(:unauthorized)
  end
end
