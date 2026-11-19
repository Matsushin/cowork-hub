drop_in = Plan.find_or_create_by!(name: "ドロップイン") do |p|
  p.kind = :drop_in
  p.price = 0
  p.monthly_hours_limit = 8
  p.description = "月額0円。全国の拠点を使った分だけ時間課金。会議室の予約は月8時間まで"
end
Plan.find_or_create_by!(name: "月額ライト") do |p|
  p.kind = :monthly
  p.price = 8800
  p.monthly_hours_limit = 10
  p.description = "全国の拠点がドロップイン使い放題。会議室の予約は月10時間まで"
end
Plan.find_or_create_by!(name: "月額フル") do |p|
  p.kind = :monthly
  p.price = 16500
  p.monthly_hours_limit = nil
  p.description = "全国の拠点がドロップイン使い放題。会議室の予約も時間無制限"
end

locations = [
  { name: "川西駅前", prefecture: "兵庫県", address: "川西市栄町1-1", open_hour: 9, close_hour: 21,
    hourly_price: 300, daily_max_price: 1500, description: "駅から徒歩2分。電源・Wi-Fi完備" },
  { name: "梅田", prefecture: "大阪府", address: "大阪市北区梅田2-2", open_hour: 8, close_hour: 22,
    hourly_price: 400, daily_max_price: 2000, description: "大阪駅すぐ。個室ブースあり" },
  { name: "渋谷", prefecture: "東京都", address: "渋谷区道玄坂3-3", open_hour: 7, close_hour: 23,
    hourly_price: 500, daily_max_price: 2500, description: "早朝から深夜まで営業" },
  { name: "博多", prefecture: "福岡県", address: "福岡市博多区博多駅前4-4", open_hour: 9, close_hour: 20,
    hourly_price: 300, daily_max_price: 1200, description: "出張時の作業に" }
].map do |attrs|
  Location.find_or_create_by!(name: attrs[:name]) { |l| l.assign_attributes(attrs) }
end

locations.each do |location|
  [
    [ "フリー席A", :seat, 1, 0 ], [ "フリー席B", :seat, 1, 0 ],
    [ "会議室（4名）", :meeting_room, 4, 1000 ], [ "会議室（8名）", :meeting_room, 8, 2000 ]
  ].each do |name, kind, capacity, hourly_price|
    location.spaces.find_or_create_by!(name:) do |s|
      s.kind = kind
      s.capacity = capacity
      s.hourly_price = hourly_price
    end
  end
end

# 開発用アカウント（本番では SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD を指定）
admin_email = ENV.fetch("SEED_ADMIN_EMAIL", "admin@example.com")
admin_password = ENV["SEED_ADMIN_PASSWORD"] || (Rails.env.production? ? nil : "password123")
if admin_password
  admin = User.find_or_create_by!(email_address: admin_email) do |u|
    u.name = "管理者"
    u.password = admin_password
    u.role = :admin
  end
  admin.change_plan!(Plan.find_by!(name: "月額フル")) unless admin.current_plan
end

# 会員アカウント。開発では member@example.com、本番ではデモ会員（SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD を指定したときだけ）。
# デモ会員は非公開で、面談の相手などに個別に伝える。利用履歴と予約のサンプルを入れておく
member_email = ENV.fetch("SEED_DEMO_EMAIL", "member@example.com")
member_password = ENV["SEED_DEMO_PASSWORD"] || (Rails.env.production? ? nil : "password123")
if member_password
  member = User.find_or_create_by!(email_address: member_email) do |u|
    u.name = "会員 太郎"
    u.password = member_password
  end
  member.change_plan!(drop_in, on: Date.current.beginning_of_month) unless member.current_plan

  # 利用履歴と請求画面の確認用に、今月のドロップイン利用を入れておく
  if member.visits.none?
    first = locations.first
    [ [ 3, 10, 13 ], [ 2, 9, 18 ] ].each do |days_ago, from, to|
      date = Date.current - days_ago
      next unless date.month == Date.current.month
      visit = member.visits.create!(location: first, checked_in_at: date.in_time_zone.change(hour: from))
      visit.check_out!(at: date.in_time_zone.change(hour: to))
    end
  end

  # 予約一覧の確認用に、翌日の会議室の予約を1件入れておく（今後の予約が1件もないときだけ）。
  # ほかの人の予約と重なる時間は避け、空いている時間を10時から順に探す
  if member.reservations.confirmed.upcoming.none?
    room = locations.first.spaces.find_by!(name: "会議室（4名）")
    (10..17).each do |hour|
      starts_at = Date.tomorrow.in_time_zone.change(hour:)
      Reservation.reserve!(user: member, space: room, starts_at:, ends_at: starts_at + 2.hours)
      break
    rescue Reservation::Conflict
      next
    end
  end
end
