module RequestHelpers
  def auth_headers(user)
    { "Authorization" => "Bearer #{user.sessions.create!.token}" }
  end

  def json
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
  config.include RequestHelpers, type: :request
end
