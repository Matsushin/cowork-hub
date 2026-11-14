drop_in = Plan.find_or_create_by!(name: "ドロップイン") do |p|
  p.kind = :drop_in
  p.price = 0
  p.monthly_hours_limit = 8
  p.description = "月8時間まで予約可能。利用料は当日払い"
end
Plan.find_or_create_by!(name: "月額ライト") do |p|
  p.kind = :monthly
  p.price = 8800
  p.monthly_hours_limit = 40
  p.description = "月40時間まで予約可能"
end
Plan.find_or_create_by!(name: "月額フル") do |p|
  p.kind = :monthly
  p.price = 16500
  p.monthly_hours_limit = nil
  p.description = "予約時間無制限"
end

[
  [ "フリー席A", :seat, 1 ], [ "フリー席B", :seat, 1 ], [ "フリー席C", :seat, 1 ],
  [ "会議室（4名）", :meeting_room, 4 ], [ "会議室（8名）", :meeting_room, 8 ]
].each do |name, kind, capacity|
  Space.find_or_create_by!(name:) { |s| s.kind = kind; s.capacity = capacity }
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

unless Rails.env.production?
  member = User.find_or_create_by!(email_address: "member@example.com") do |u|
    u.name = "会員 太郎"
    u.password = "password123"
  end
  member.change_plan!(drop_in) unless member.current_plan
end
