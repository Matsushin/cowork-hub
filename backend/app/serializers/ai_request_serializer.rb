module AiRequestSerializer
  def self.call(ai_request)
    ai_request.slice(:id, :feature, :status, :created_at).merge(remaining_today: AiRequest.remaining_for(ai_request.user))
  end
end
