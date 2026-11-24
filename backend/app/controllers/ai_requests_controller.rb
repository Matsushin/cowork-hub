# AI 機能の利用記録と回数の上限。AI の呼び出し自体は Next.js のサーバーが行い、前後でここを呼ぶ
#   1. POST  /api/ai_requests     相談を始める（1日の回数の上限を超えていれば429）
#   2. PATCH /api/ai_requests/:id 終わった相談のトークン数・料金・応答時間を書く
class AiRequestsController < ApplicationController
  def create
    ai_request = AiRequest.start!(user: current_user, feature: params.expect(ai_request: [ :feature ])[:feature])
    render json: AiRequestSerializer.call(ai_request), status: :created
  rescue AiRequest::LimitExceeded => e
    render json: { error: e.message }, status: :too_many_requests
  end

  def update
    ai_request = policy_scope(AiRequest).find(params[:id])
    authorize ai_request
    ai_request.finish!(params.expect(ai_request: [
      :status, :model, :input_tokens, :output_tokens, :cache_read_input_tokens, :cache_creation_input_tokens,
      :cost_micro_usd, :duration_ms, :tool_calls, :error_code
    ]))
    render json: AiRequestSerializer.call(ai_request)
  end
end
