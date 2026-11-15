class BillingsController < ApplicationController
  include MonthParam

  def show
    Visit.auto_check_out_overdue!(current_user.visits)
    render json: MonthlyBillSerializer.call(MonthlyBill.new(user: current_user, month: month_param))
  end
end
