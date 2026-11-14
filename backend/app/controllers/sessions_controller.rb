class SessionsController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    user = User.authenticate_by(params.permit(:email_address, :password).to_h.symbolize_keys)
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
