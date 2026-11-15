module Admin
  # 拠点別・月別の売上集計
  class SalesController < BaseController
    include MonthParam

    def index
      month = month_param
      Visit.auto_check_out_overdue! # 締め忘れの利用も売上に含める
      range = month.in_time_zone.all_month
      visits = Visit.finished.where(checked_in_at: range).group(:location_id)
      visit_counts = visits.count
      visit_amounts = visits.sum(:amount)
      reservation_amounts = Reservation.confirmed.where(starts_at: range).joins(:space).group("spaces.location_id").sum(:amount)

      rows = Location.order(:prefecture, :name).map do |l|
        visit_amount = visit_amounts.fetch(l.id, 0)
        reservation_amount = reservation_amounts.fetch(l.id, 0)
        {
          location: l.slice(:id, :name, :prefecture),
          visit_count: visit_counts.fetch(l.id, 0),
          visit_amount:,
          reservation_amount:,
          total: visit_amount + reservation_amount
        }
      end

      # 月額プラン料金は拠点に紐づかないので別に集計する（請求と同じく月末時点の契約で数える）
      plan_date = [ month.end_of_month, Date.current ].min
      plan_amount = Membership.active_on(plan_date).joins(:plan).merge(Plan.monthly).sum("plans.price")

      render json: {
        month: month.strftime("%Y-%m"),
        locations: rows,
        plan_amount:,
        total: rows.sum { |r| r[:total] } + plan_amount
      }
    end
  end
end
