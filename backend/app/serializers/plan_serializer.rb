module PlanSerializer
  def self.call(plan)
    plan.slice(:id, :name, :kind, :price, :monthly_hours_limit, :description)
  end
end
