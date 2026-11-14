# 会員の月次請求。月額プラン料金＋ドロップイン利用料＋会議室などの予約料金
# 月額プラン料金は、その月の末日（当月なら今日）時点の契約プランで計算する
class MonthlyBill
  attr_reader :user, :month

  def initialize(user:, month:)
    @user = user
    @month = month.beginning_of_month
  end

  def range = month.in_time_zone.all_month

  def plan
    @plan ||= user.current_plan([ month.end_of_month, Date.current ].min)
  end

  def plan_fee = plan&.monthly? ? plan.price : 0

  # 月をまたいだ利用は、チェックインした月に計上する
  def visits
    @visits ||= user.visits.finished.where(checked_in_at: range).includes(:location).order(:checked_in_at)
  end

  def reservations
    @reservations ||= user.reservations.confirmed.where(starts_at: range).includes(space: :location).order(:starts_at)
  end

  def visits_total = visits.sum(&:amount)
  def reservations_total = reservations.sum(&:amount)
  def total = plan_fee + visits_total + reservations_total
end
