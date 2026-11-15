require "rails_helper"

RSpec.describe ReservationPolicy do
  let(:user) { create(:user) }
  let(:mine) { create(:reservation, user:) }
  let(:others) { create(:reservation) }

  it "キャンセルできるのは本人の予約だけ" do
    expect(described_class.new(user, mine).cancel?).to be true
    expect(described_class.new(user, others).cancel?).to be false
  end

  it "見てよい範囲は本人の予約だけ" do
    expect(described_class::Scope.new(user, Reservation).resolve).to contain_exactly(mine)
    others
    expect(described_class::Scope.new(user, Reservation).resolve).not_to include(others)
  end

  it "管理者でも会員向けの範囲では本人の予約だけ（全会員の予約は管理APIで見る）" do
    admin = create(:user, :admin)
    mine
    expect(described_class::Scope.new(admin, Reservation).resolve).to be_empty
  end
end
