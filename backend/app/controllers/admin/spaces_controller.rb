module Admin
  class SpacesController < BaseController
    def index
      spaces = Space.includes(:location).order(:location_id, :kind, :name)
      render json: spaces.map { |r| SpaceSerializer.call(r, with_location: true) }
    end

    def create
      space = Space.create!(space_params)
      render json: SpaceSerializer.call(space, with_location: true), status: :created
    end

    def update
      space = Space.find(params[:id])
      space.update!(space_params)
      render json: SpaceSerializer.call(space, with_location: true)
    end

    def destroy
      space = Space.find(params[:id])
      if space.destroy
        head :no_content
      else
        render_validation_errors(space)
      end
    end

    private

    def space_params
      params.expect(space: [ :location_id, :name, :kind, :capacity, :hourly_price, :active ])
    end
  end
end
