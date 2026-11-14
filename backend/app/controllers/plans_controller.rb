class PlansController < ApplicationController
  allow_unauthenticated_access

  def index
    render json: Plan.order(:price).map { |r| PlanSerializer.call(r) }
  end
end
