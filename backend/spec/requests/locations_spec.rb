require "rails_helper"

RSpec.describe "拠点", type: :request do
  let!(:kawanishi) { create(:location, name: "川西駅前", prefecture: "兵庫県", address: "川西市栄町1-1") }
  let!(:umeda) { create(:location, name: "梅田", prefecture: "大阪府", address: "大阪市北区梅田2-2") }
  let!(:closed) { create(:location, name: "閉鎖店", prefecture: "兵庫県", active: false) }

  it "ログインなしで公開中の拠点一覧を見られる" do
    get "/api/locations"
    expect(response).to have_http_status(:ok)
    expect(json.map { |l| l["name"] }).to contain_exactly("川西駅前", "梅田")
  end

  it "都道府県・キーワード（名前・住所）で絞り込める" do
    get "/api/locations", params: { prefecture: "兵庫県" }
    expect(json.map { |l| l["name"] }).to eq [ "川西駅前" ]
    get "/api/locations", params: { q: "北区" }
    expect(json.map { |l| l["name"] }).to eq [ "梅田" ]
  end

  it "利用中の人数を返す" do
    create(:visit, location: umeda)
    create(:visit, location: umeda, checked_out_at: Time.current.change(hour: 11), amount: 300)
    get "/api/locations"
    expect(json.find { |l| l["name"] == "梅田" }["current_visitors"]).to eq 1
  end

  it "詳細では公開中のスペースだけを返す" do
    room = create(:space, location: umeda, kind: :meeting_room)
    create(:space, location: umeda, active: false)
    get "/api/locations/#{umeda.id}"
    expect(json["spaces"].map { |s| s["id"] }).to eq [ room.id ]
  end

  it "停止中の拠点の詳細は404" do
    get "/api/locations/#{closed.id}"
    expect(response).to have_http_status(:not_found)
  end
end
