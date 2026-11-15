# 予約の確定・キャンセルを会員に知らせる
# コントローラーから deliver_later で呼び、Solid Queue のワーカーが送信する
class ReservationMailer < ApplicationMailer
  include ReservationMailerHelper # 件名で使う
  helper ReservationMailerHelper  # 本文で使う

  def confirmed
    @reservation = params[:reservation]
    mail to: @reservation.user.email_address, subject: "【ee-office】ご予約を承りました（#{reservation_label}）"
  end

  def canceled
    @reservation = params[:reservation]
    mail to: @reservation.user.email_address, subject: "【ee-office】ご予約をキャンセルしました（#{reservation_label}）"
  end

  private

  def reservation_label = reservation_period(@reservation)
end
