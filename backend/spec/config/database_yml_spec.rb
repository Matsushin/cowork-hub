require "rails_helper"

# 本番の DB のパスワードは RDS が自動で変え、記号で始まることがある。どんな値でも database.yml が読めることを確かめる
RSpec.describe "config/database.yml" do
  def load_with(env)
    stub_const("ENV", ENV.to_h.merge(env))
    erb = ERB.new(Rails.root.join("config/database.yml").read).result
    YAML.safe_load(erb, aliases: true)
  end

  [
    "|abc", ">abc", "!abc", "&abc", "*abc", "%abc", "@abc", "`abc", "#abc", "-abc", "?abc", "{abc", "[abc",
    "a: b", "a #b", "a\"b", "a'b", "a\\b", "<a&b>", "パス"
  ].each do |password|
    it "パスワードが #{password.inspect} でも、そのまま読める" do
      config = load_with("DB_PASSWORD" => password, "DB_USERNAME" => "|user", "DB_HOST" => "db.example.com")
      expect(config.dig("production", "password")).to eq password
      expect(config.dig("production", "username")).to eq "|user"
      expect(config.dig("production", "host")).to eq "db.example.com"
    end
  end
end
