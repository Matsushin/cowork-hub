module Admin
  class SpacesController < BaseController
    def index
      render json: Space.order(:kind, :name).map { |r| SpaceSerializer.call(r) }
    end

    def create
      space = Space.create!(space_params)
      render json: SpaceSerializer.call(space), status: :created
    end

    def update
      space = Space.find(params[:id])
      space.update!(space_params)
      render json: SpaceSerializer.call(space)
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
      params.expect(space: [ :name, :kind, :capacity, :active ])
    end
  end
end
