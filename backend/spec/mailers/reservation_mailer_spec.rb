require "rails_helper"

RSpec.describe ReservationMailer do
  let(:user) { create(:user, name: "会員 太郎", email_address: "taro@example.com") }
  let(:location) { create(:location, name: "梅田", address: "大阪市北区1-1") }
  let(:space) { create(:space, location:, name: "会議室A", hourly_price: 1000) }
  # 2026-11-20 は金曜日。DBはUTCで持つが、本文は日本時間で書く
  let(:reservation) do
    create(:reservation, user:, space:, amount: 2000,
                         starts_at: Time.zone.local(2026, 11, 20, 10), ends_at: Time.zone.local(2026, 11, 20, 12))
  end

  describe "#confirmed" do
    subject(:mail) { described_class.with(reservation:).confirmed }

    it "予約した会員に、日時・場所・料金を知らせる" do
      expect(mail.to).to eq [ "taro@example.com" ]
      expect(mail.subject).to eq "【ee-office】ご予約を承りました（11/20（金）10:00〜12:00）"
      body = mail.body.encoded
      expect(body).to include("会員 太郎 様", "梅田（大阪市北区1-1）", "会議室A", "2,000円", "http://localhost:3000/reservations")
    end
  end

  describe "#canceled" do
    subject(:mail) { described_class.with(reservation:).canceled }

    it "キャンセルした予約を知らせる" do
      expect(mail.to).to eq [ "taro@example.com" ]
      expect(mail.subject).to eq "【ee-office】ご予約をキャンセルしました（11/20（金）10:00〜12:00）"
      expect(mail.body.encoded).to include("料金は請求されません")
    end
  end
end
