require "rails_helper"

# 本番は MAIL_DELIVERY=ses で、Amazon SES の API（aws-actionmailer-ses の :ses_v2）でメールを送る。
# ここでは SDK の応答を作り物にして（AWS には送らない）、予約のお知らせが SES の API に渡る形を確かめる
RSpec.describe "Amazon SES でのメールの送信" do
  # SDK の作り物の応答（stub_responses）。送った要求は api_requests に残る
  let(:client) { Aws::SESV2::Client.new(region: "ap-northeast-1", stub_responses: { send_email: { message_id: "test-id" } }) }

  around do |example|
    original = [ ActionMailer::Base.delivery_method, ActionMailer::Base.ses_v2_settings ]
    ActionMailer::Base.delivery_method = :ses_v2
    ActionMailer::Base.ses_v2_settings = { region: "ap-northeast-1" }
    example.run
  ensure
    ActionMailer::Base.delivery_method, ActionMailer::Base.ses_v2_settings = original
  end

  before { allow(Aws::SESV2::Client).to receive(:new).and_return(client) }

  it "予約の確定のお知らせを、SES の API に生のメールとして渡す" do
    reservation = create(:reservation)
    ReservationMailer.with(reservation:).confirmed.deliver_now

    expect(client.api_requests.size).to eq 1
    request = client.api_requests.first
    expect(request[:operation_name]).to eq :send_email
    raw = request[:params].dig(:content, :raw, :data)
    expect(raw).to include("To: #{reservation.user.email_address}")
    expect(raw).to include("Subject: =?UTF-8?")
  end
end
