module VisitSerializer
  def self.call(visit, with_user: false)
    json = visit.slice(:id, :checked_in_at, :checked_out_at, :amount).merge(
      location: visit.location.slice(:id, :name),
      duration_minutes: visit.duration_minutes
    )
    # 利用中は「今チェックアウトしたらいくらか」の目安を返す
    json[:estimated_amount] = visit.fee_until(Time.current) if visit.in_progress?
    json[:user] = visit.user.slice(:id, :name, :email_address) if with_user
    json
  end
end
