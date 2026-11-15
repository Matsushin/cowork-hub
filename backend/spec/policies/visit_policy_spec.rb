require "rails_helper"

RSpec.describe VisitPolicy do
  let(:user) { create(:user) }
  let(:location) { create(:location) }
  let(:mine) { create(:visit, user:, location:) }
  let(:others) { create(:visit, location:) }

  it "チェックアウトできるのは本人の利用だけ" do
    expect(described_class.new(user, mine).checkout?).to be true
    expect(described_class.new(user, others).checkout?).to be false
  end

  it "見てよい範囲は本人の利用だけ" do
    mine
    others
    expect(described_class::Scope.new(user, Visit).resolve).to contain_exactly(mine)
  end
end
