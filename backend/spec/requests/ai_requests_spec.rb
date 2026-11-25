require "rails_helper"

RSpec.describe "AI 機能の利用記録", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  def start(feature: "booking")
    post "/api/ai_requests", params: { ai_request: { feature: } }, headers:, as: :json
  end

  describe "相談を始める" do
    before { allow(AiRequest).to receive(:daily_limit).and_return(2) }

    it "記録を作り、今日あと何回使えるかを返す" do
      start
      expect(response).to have_http_status(:created)
      expect(json).to include("feature" => "booking", "status" => "started", "remaining_today" => 1)
    end

    it "1日の上限を超えると429で、記録は増えない" do
      2.times { start }
      expect { start }.not_to change(AiRequest, :count)
      expect(response).to have_http_status(:too_many_requests)
      expect(json["error"]).to include "上限（2回）"
    end

    it "回数は日本時間の日付で数え、次の日には戻る" do
      travel_to(Time.zone.local(2026, 12, 1, 23, 50)) { 2.times { start } }
      travel_to(Time.zone.local(2026, 12, 2, 0, 5)) do
        start
        expect(response).to have_http_status(:created)
      end
    end

    it "他人の利用は自分の回数に数えない" do
      create_list(:ai_request, 2)
      start
      expect(response).to have_http_status(:created)
    end

    it "分析アシスタント（analytics）は管理者だけが始められる" do
      start(feature: "analytics")
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to include "管理者だけ"

      post "/api/ai_requests", params: { ai_request: { feature: "analytics" } }, headers: auth_headers(create(:user, :admin)), as: :json
      expect(response).to have_http_status(:created)
    end

    it "決まっていない機能は422" do
      start(feature: "unknown")
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["errors"]).to have_key("feature")
    end
  end

  describe "終わった相談を書く" do
    let(:ai_request) { create(:ai_request, user:) }

    def finish(id: ai_request.id, **attrs)
      patch "/api/ai_requests/#{id}", params: { ai_request: attrs }, headers:, as: :json
    end

    it "トークン数・料金・応答時間を書く" do
      finish(status: "succeeded", model: "claude-opus-5-5", input_tokens: 3000, output_tokens: 400,
             cache_read_input_tokens: 2000, cost_micro_usd: 20000, duration_ms: 5200, tool_calls: 2)
      expect(response).to have_http_status(:ok)
      expect(ai_request.reload).to have_attributes(status: "succeeded", input_tokens: 3000, cost_micro_usd: 20000, tool_calls: 2)
    end

    it "失敗も理由つきで書ける" do
      finish(status: "failed", error_code: "rate_limited")
      expect(ai_request.reload).to have_attributes(status: "failed", error_code: "rate_limited")
    end

    it "書けるのは始めたばかりの記録だけ（2回目は422）" do
      finish(status: "succeeded")
      finish(status: "failed")
      expect(response).to have_http_status(:unprocessable_content)
      expect(ai_request.reload.status).to eq "succeeded"
    end

    it "started のままにはできない（何度でも書き直せないように）" do
      finish(status: "started", input_tokens: 10)
      expect(response).to have_http_status(:unprocessable_content)
      expect(ai_request.reload).to have_attributes(status: "started", input_tokens: 0)
    end

    it "他人の記録は404（存在を知られないため）" do
      finish(id: create(:ai_request).id, status: "succeeded")
      expect(response).to have_http_status(:not_found)
    end

    it "決まっていない状態・負の数は422" do
      finish(status: "unknown")
      expect(response).to have_http_status(:unprocessable_content)
      finish(status: "succeeded", input_tokens: -1)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "会員の id や機能は書き換えられない（Strong Parameters）" do
      other = create(:user)
      finish(status: "succeeded", user_id: other.id, feature: "other")
      expect(ai_request.reload).to have_attributes(user_id: user.id, feature: "booking")
    end
  end
end
