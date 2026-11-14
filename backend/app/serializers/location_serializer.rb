module LocationSerializer
  def self.call(location, current_visitors: nil)
    json = location.slice(:id, :name, :prefecture, :address, :description, :open_hour, :close_hour,
                          :hourly_price, :daily_max_price, :active)
    json[:current_visitors] = current_visitors unless current_visitors.nil?
    json
  end
end
