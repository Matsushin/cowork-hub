module SpaceSerializer
  def self.call(space)
    space.slice(:id, :name, :kind, :capacity, :active)
  end
end
