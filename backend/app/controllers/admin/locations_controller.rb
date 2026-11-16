module Admin
  class LocationsController < BaseController
    def index
      Visit.auto_check_out_overdue!
      locations = Location.order(:prefecture, :name)
      visitors = Visit.in_progress.group(:location_id).count
      render json: locations.map { |l| LocationSerializer.call(l, current_visitors: visitors.fetch(l.id, 0)) }
    end

    def create
      location = Location.create!(location_params)
      render json: LocationSerializer.call(location), status: :created
    end

    def update
      location = Location.find(params[:id])
      location.update!(location_params)
      render json: LocationSerializer.call(location)
    end

    # 受付用QRのコード。expires_in（残り秒数）はサーバーの時刻で計算して返す（タブレットの時計のずれに左右されないように）
    def checkin_code
      location = Location.find(params[:id])
      now = Time.current
      result = CheckinCode.generate(location, at: now)
      render json: {
        location: { id: location.id, name: location.name },
        code: result.code,
        expires_at: result.expires_at.iso8601,
        expires_in: (result.expires_at - now).ceil,
        interval: CheckinCode::INTERVAL
      }
    end

    private

    def location_params
      params.expect(location: [ :name, :prefecture, :address, :description, :open_hour, :close_hour,
                                :hourly_price, :daily_max_price, :active ])
    end
  end
end
