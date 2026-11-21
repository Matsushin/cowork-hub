class SessionsController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    # authenticate_by は引数が欠けると ArgumentError になるので、文字列で揃っているときだけ呼ぶ
    email_address = params[:email_address]
    password = params[:password]
    user = User.authenticate_by(email_address:, password:) if email_address.is_a?(String) && password.is_a?(String)
    if user
      session = start_new_session_for(user)
      render json: { token: session.token, user: UserSerializer.call(user) }, status: :created
    else
      render json: { error: "メールアドレスまたはパスワードが正しくありません" }, status: :unauthorized
    end
  end

  def destroy
    current_session.destroy!
    head :no_content
  end
end
