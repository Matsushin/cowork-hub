class VisitsController < ApplicationController
  def index
    visits = current_user.visits.includes(:location).order(checked_in_at: :desc).limit(100)
    render json: visits.map { |v| VisitSerializer.call(v) }
  end

  # 利用中のドロップイン（なければ null）
  def current
    visit = current_user.visits.in_progress.includes(:location).first
    render json: visit && VisitSerializer.call(visit)
  end

  def create
    location = Location.active.find(params.expect(visit: [ :location_id ])[:location_id])
    visit = Visit.check_in!(user: current_user, location:)
    render json: VisitSerializer.call(visit), status: :created
  rescue Visit::AlreadyCheckedIn => e
    render json: { error: e.message }, status: :conflict
  end

  def checkout
    visit = current_user.visits.find(params[:id])
    visit.check_out!
    render json: VisitSerializer.call(visit)
  end
end
