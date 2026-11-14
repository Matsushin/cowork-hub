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
    post "/api/admin/spaces", params: { space: { name: "個室", kind: "meeting_room", capacity: 2 } }, headers: auth_headers(admin)
    expect(response).to have_http_status(:created)
  end
end
