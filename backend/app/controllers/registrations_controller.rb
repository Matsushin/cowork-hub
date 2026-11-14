class RegistrationsController < ApplicationController
  allow_unauthenticated_access

  def create
    user = User.new(params.expect(user: [ :name, :email_address, :password ]))
    User.transaction do
      user.save!
      default_plan = Plan.drop_in.order(:id).first
      user.memberships.create!(plan: default_plan, started_on: Date.current) if default_plan
    end
    session = start_new_session_for(user)
    render json: { token: session.token, user: UserSerializer.call(user) }, status: :created
  end
end
