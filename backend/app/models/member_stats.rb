# 会員数の集計（管理者向け。分析アシスタントの道具にもなる）。個人の情報は返さず、人数だけを返す
#   - 会員数：月末時点（今月なら今日）で契約中のプランがある人。プランごとの内訳と、月額プランの料金の合計（売上の集計と同じ数え方）
#   - 新しい会員：その月に登録した人
#   - 利用した会員：その月に会議室を予約した（予約の開始がその月）か、ドロップインを使った人
class MemberStats
  def initialize(month:)
    @month = month
  end

  def as_json(*)
    on = [ @month.end_of_month, Date.current ].min
    range = @month.in_time_zone.all_month
    memberships = Membership.active_on(on).joins(:plan)
    by_plan = Plan.order(:id).map do |plan|
      count = memberships.where(plan:).distinct.count(:user_id)
      { plan: plan.slice(:id, :name, :kind, :price), member_count: count, plan_amount: plan.monthly? ? plan.price * count : 0 }
    end
    active_ids = Reservation.confirmed.where(starts_at: range).distinct.pluck(:user_id) |
                 Visit.where(checked_in_at: range).distinct.pluck(:user_id)

    {
      month: @month.strftime("%Y-%m"),
      member_count: memberships.distinct.count(:user_id),
      new_member_count: User.where(created_at: range).count,
      active_member_count: active_ids.size,
      by_plan:
    }
  end
end
