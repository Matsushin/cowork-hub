module SpaceSerializer
  def self.call(space, with_location: false)
    json = space.slice(:id, :name, :kind, :capacity, :hourly_price, :active, :location_id)
    json[:location] = space.location.slice(:id, :name) if with_location
    json
  end
end
