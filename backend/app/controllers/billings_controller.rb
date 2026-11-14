class BillingsController < ApplicationController
  include MonthParam

  def show
    render json: MonthlyBillSerializer.call(MonthlyBill.new(user: current_user, month: month_param))
  end
end
