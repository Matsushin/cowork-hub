class LocationsController < ApplicationController
  allow_unauthenticated_access

  def index
    locations = Location.active.search(params[:q]).order(:prefecture, :name)
    locations = locations.where(prefecture: params[:prefecture]) if params[:prefecture].present?
    visitors = Visit.in_progress.where(location: locations).group(:location_id).count
    render json: locations.map { |l| LocationSerializer.call(l, current_visitors: visitors.fetch(l.id, 0)) }
  end

  def show
    location = Location.active.find(params[:id])
    render json: LocationSerializer.call(location, current_visitors: location.visits.in_progress.count).merge(
      spaces: location.spaces.active.order(:kind, :name).map { |s| SpaceSerializer.call(s) }
    )
  end
end
