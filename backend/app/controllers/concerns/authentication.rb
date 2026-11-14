module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def require_authentication
    render json: { error: "ログインが必要です" }, status: :unauthorized unless current_user
  end

  def current_session
    return @current_session if defined?(@current_session)
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    @current_session = token.present? ? Session.find_by(token:) : nil
  end

  def current_user
    current_session&.user
  end

  def start_new_session_for(user)
    user.sessions.create!(user_agent: request.user_agent, ip_address: request.remote_ip)
  end
end
