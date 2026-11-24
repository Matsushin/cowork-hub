require "swagger_helper"

RSpec.describe "AI 機能の利用記録", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { auth_headers(user)["Authorization"] }

  path "/api/ai_requests" do
    post "AI の相談を始める（1日の回数の上限を確かめて記録を作る）" do
      tags "AI"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          ai_request: {
            type: :object,
            properties: { feature: { type: :string, enum: %w[booking] } },
            required: %w[feature]
          }
        },
        required: %w[ai_request]
      }
      let(:body) { { ai_request: { feature: "booking" } } }

      response "201", "記録を作った" do
        schema "$ref" => "#/components/schemas/AiRequest"
        run_test!
      end

      response "429", "今日の回数の上限に達した" do
        schema "$ref" => "#/components/schemas/Error"
        before do
          allow(AiRequest).to receive(:daily_limit).and_return(1)
          create(:ai_request, user:)
        end
        run_test!
      end

      it_requires_login
    end
  end

  path "/api/ai_requests/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }

    patch "終わった相談のトークン数・料金・応答時間を書く" do
      tags "AI"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          ai_request: {
            type: :object,
            properties: {
              status: { type: :string, enum: %w[succeeded failed refused] },
              model: { type: :string },
              input_tokens: { type: :integer },
              output_tokens: { type: :integer },
              cache_read_input_tokens: { type: :integer },
              cache_creation_input_tokens: { type: :integer },
              cost_micro_usd: { type: :integer, description: "料金（米ドル）×1,000,000" },
              duration_ms: { type: :integer },
              tool_calls: { type: :integer },
              error_code: { type: :string }
            },
            required: %w[status]
          }
        },
        required: %w[ai_request]
      }
      let(:ai_request) { create(:ai_request, user:) }
      let(:id) { ai_request.id }
      let(:body) { { ai_request: { status: "succeeded", model: "claude-opus-5-5", input_tokens: 3000, output_tokens: 400, cost_micro_usd: 20000, duration_ms: 5200, tool_calls: 2 } } }

      response "200", "書いた" do
        schema "$ref" => "#/components/schemas/AiRequest"
        run_test!
      end

      response "404", "他人の記録" do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { create(:ai_request).id }
        run_test!
      end

      response "422", "すでに終わっている" do
        schema "$ref" => "#/components/schemas/Error"
        let(:ai_request) { create(:ai_request, user:, status: :succeeded) }
        run_test!
      end

      it_requires_login
    end
  end
end
