module VisitSerializer
  def self.call(visit, with_user: false)
    json = visit.slice(:id, :checked_in_at, :checked_out_at, :amount, :auto_checked_out).merge(
      location: visit.location.slice(:id, :name),
      duration_minutes: visit.duration_minutes
    )
    # 利用中は「今チェックアウトしたらいくらか」の目安を返す
    if visit.in_progress?
      json[:estimated_amount] = visit.fee_until(Time.current)
      json[:auto_checkout_at] = visit.auto_checkout_at
    end
    json[:user] = visit.user.slice(:id, :name, :email_address) if with_user
    json
  end
end
