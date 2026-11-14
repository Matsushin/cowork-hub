class MeController < ApplicationController
  def show
    render json: UserSerializer.call(current_user)
  end

  def update
    current_user.update!(params.expect(user: [ :name, :email_address, :password ]))
    render json: UserSerializer.call(current_user)
  end
end
