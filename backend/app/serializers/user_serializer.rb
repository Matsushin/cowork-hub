module UserSerializer
  def self.call(user)
    plan = user.current_plan
    {
      id: user.id,
      name: user.name,
      email_address: user.email_address,
      role: user.role,
      plan: plan && PlanSerializer.call(plan),
      created_at: user.created_at
    }
  end
end
