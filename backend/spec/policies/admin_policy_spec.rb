require "rails_helper"

RSpec.describe AdminPolicy do
  it "管理者だけが管理画面に入れる" do
    expect(described_class.new(build(:user, :admin), :admin).access?).to be true
    expect(described_class.new(build(:user), :admin).access?).to be false
    expect(described_class.new(nil, :admin).access?).to be false
  end
end
