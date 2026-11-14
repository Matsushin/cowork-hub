module Admin
  class UsersController < BaseController
    def index
      users = User.search(params[:q]).includes(memberships: :plan).order(:id)
      render json: users.map { |r| UserSerializer.call(r) }
    end

    def show
      user = User.find(params[:id])
      render json: UserSerializer.call(user).merge(
        reservations: user.reservations.includes(:space).order(starts_at: :desc).limit(50).map { |r| ReservationSerializer.call(r) }
      )
    end

    def update
      user = User.find(params[:id])
      attrs = params.expect(user: [ :role, :plan_id ])
      User.transaction do
        user.update!(role: attrs[:role]) if attrs[:role].present?
        user.change_plan!(Plan.find(attrs[:plan_id])) if attrs[:plan_id].present? && attrs[:plan_id].to_i != user.current_plan&.id
      end
      render json: UserSerializer.call(user.reload)
    end
  end
end
