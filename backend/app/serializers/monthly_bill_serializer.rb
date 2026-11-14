module MonthlyBillSerializer
  def self.call(bill)
    {
      month: bill.month.strftime("%Y-%m"),
      plan: bill.plan && PlanSerializer.call(bill.plan),
      plan_fee: bill.plan_fee,
      visits: bill.visits.map { |v| VisitSerializer.call(v) },
      visits_total: bill.visits_total,
      reservations: bill.reservations.map { |r| ReservationSerializer.call(r) },
      reservations_total: bill.reservations_total,
      total: bill.total
    }
  end
end
