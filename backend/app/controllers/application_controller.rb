class ApplicationController < ActionController::API
  include Authentication

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "見つかりません" }, status: :not_found
  end

  # バリデーションエラーは項目ごとのメッセージも返す
  #   { error: "名前を入力してください", errors: { name: ["名前を入力してください"], base: [...] } }
  rescue_from ActiveRecord::RecordInvalid do |e|
    render_validation_errors(e.record)
  end

  rescue_from ActionController::ParameterMissing do
    render json: { error: "リクエストの形式が不正です" }, status: :bad_request
  end

  private

  def render_validation_errors(record)
    render json: {
      error: record.errors.full_messages.join("、"),
      errors: record.errors.to_hash(true)
    }, status: :unprocessable_content
  end
end
