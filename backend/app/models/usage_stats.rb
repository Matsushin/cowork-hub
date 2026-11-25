# 利用状況の集計（管理者向け。分析アシスタントの道具にもなる）
#
# 期間（from〜to、日本時間の日付、両端を含む）の会議室の予約とドロップイン利用を、
# 拠点・スペース・月・曜日・時間帯のどれかでまとめる。
#   - 予約：確定（confirmed）のもの。開始日時で期間・曜日・時間帯を決める
#   - ドロップイン：終わった（チェックアウト済み）もの。チェックイン日時で決める
#   - 稼働率：会議室の予約時間 ÷ 会議室を予約できた時間（営業時間 × 会議室の数 × 日数）。時間帯ごとには出さない
# 数字はすべてここで計算する（AI に計算させない）
class UsageStats
  class Invalid < StandardError; end

  GROUPS = %w[location space month weekday hour].freeze
  MAX_DAYS = 366
  WEEKDAYS = %w[日 月 火 水 木 金 土].freeze
  METRICS = %i[reservation_count reservation_hours reservation_amount visit_count visit_hours visit_amount].freeze

  def initialize(from: nil, to: nil, group_by: "location", location_id: nil)
    @from = parse_date(from, "from")
    @to = parse_date(to, "to")
    @group_by = group_by.presence || "location"
    raise Invalid, "group_by は #{GROUPS.join('・')} のどれかにしてください" unless GROUPS.include?(@group_by)
    raise Invalid, "to は from 以降の日付にしてください" if @to < @from
    raise Invalid, "期間は#{MAX_DAYS}日以内にしてください" if (@to - @from).to_i + 1 > MAX_DAYS

    @location = Location.find(location_id) if location_id.present?
  end

  def as_json(*)
    Visit.auto_check_out_overdue! # 締め忘れの利用も数に含める（売上の集計と同じ）
    rows = build_rows
    {
      from: @from.iso8601,
      to: @to.iso8601,
      group_by: @group_by,
      location: @location&.slice(:id, :name),
      rows:,
      totals: totals(rows)
    }
  end

  private

  def parse_date(value, name)
    raise Invalid, "#{name} は YYYY-MM-DD の形で指定してください" unless value.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
    Date.iso8601(value)
  rescue Date::Error
    raise Invalid, "#{name} は YYYY-MM-DD の形で指定してください"
  end

  def range = @from.in_time_zone.beginning_of_day..@to.in_time_zone.end_of_day
  def locations = @location ? [ @location ] : Location.order(:prefecture, :name).to_a
  def location_ids = locations.map(&:id)
  def spaces = Space.where(location_id: location_ids).includes(:location).order(:location_id, :id).to_a
  def meeting_rooms = spaces.select(&:meeting_room?)

  # 行の見出し（集計の単位）。0件の行も出す（時間帯だけは、予約か利用があった時間だけ）
  def keys
    case @group_by
    when "location" then locations.map { |l| [ l.id, l.name ] }
    when "space" then spaces.map { |s| [ s.id, "#{s.location.name} #{s.name}" ] }
    when "month" then months.map { |m| [ m, "#{m[0, 4]}年#{m[5, 2].to_i}月" ] }
    when "weekday" then (0..6).map { |w| [ w, "#{WEEKDAYS[w]}曜日" ] }
    when "hour" then []
    end
  end

  def months = (@from..@to).map { |d| d.strftime("%Y-%m") }.uniq

  def key_of(time, location_id:, space_id: nil)
    t = time.in_time_zone
    case @group_by
    when "location" then location_id
    when "space" then space_id
    when "month" then t.strftime("%Y-%m")
    when "weekday" then t.wday
    when "hour" then t.hour
    end
  end

  def build_rows
    rows = keys.to_h { |key, label| [ key, empty_row(key, label) ] }
    row_for = ->(key) { rows[key] ||= empty_row(key, "#{key}時") } # 時間帯の行は見つかったときに作る

    reservations.each do |r|
      row = row_for.(key_of(r.starts_at, location_id: r.space.location_id, space_id: r.space_id))
      row[:reservation_count] += 1
      row[:reservation_hours] += r.duration_hours
      row[:reservation_amount] += r.amount
      row[:meeting_room_hours] += r.duration_hours if r.space.meeting_room?
    end

    unless @group_by == "space" # ドロップインはスペースに紐づかない
      visits.each do |v|
        row = row_for.(key_of(v.checked_in_at, location_id: v.location_id))
        row[:visit_count] += 1
        row[:visit_hours] += (v.checked_out_at - v.checked_in_at) / 3600.0
        row[:visit_amount] += v.amount.to_i
      end
    end

    add_open_hours(rows) unless @group_by == "hour"
    sorted = @group_by == "hour" ? rows.values.sort_by { |r| r[:key] } : rows.values
    sorted.map { |row| finish_row(row) }
  end

  def reservations
    Reservation.confirmed.where(starts_at: range).joins(:space).where(spaces: { location_id: location_ids }).includes(:space)
  end

  def visits = Visit.finished.where(checked_in_at: range, location_id: location_ids)

  # 会議室を予約できた時間（営業時間 × 会議室の数 × 日数）を行ごとに足す
  def add_open_hours(rows)
    rooms = meeting_rooms
    (@from..@to).each do |date|
      rooms.each do |room|
        key = key_of(date.in_time_zone, location_id: room.location_id, space_id: room.id)
        rows[key][:open_hours] += room.location.close_hour - room.location.open_hour if rows[key]
      end
    end
  end

  def empty_row(key, label)
    { key:, label:, meeting_room_hours: 0.0, open_hours: 0 }.merge(METRICS.index_with { |m| m.end_with?("hours") ? 0.0 : 0 })
  end

  def finish_row(row)
    visits_counted = @group_by != "space"
    {
      key: row[:key],
      label: row[:label],
      reservation_count: row[:reservation_count],
      reservation_hours: row[:reservation_hours].round(1),
      reservation_amount: row[:reservation_amount],
      visit_count: visits_counted ? row[:visit_count] : nil,
      visit_hours: visits_counted ? row[:visit_hours].round(1) : nil,
      visit_amount: visits_counted ? row[:visit_amount] : nil,
      total_amount: row[:reservation_amount] + row[:visit_amount],
      utilization_rate: utilization(row[:meeting_room_hours], row[:open_hours])
    }
  end

  def utilization(used, open)
    return nil if @group_by == "hour" || open.zero?
    (used * 100.0 / open).round(1)
  end

  # 合計は丸める前の値から計算する（行の丸めた値を足すとずれるため）
  def totals(_rows)
    rs = reservations.to_a
    vs = @group_by == "space" ? nil : visits.to_a
    open = meeting_rooms.sum { |r| r.location.close_hour - r.location.open_hour } * ((@to - @from).to_i + 1)
    used = rs.select { |r| r.space.meeting_room? }.sum(&:duration_hours)
    reservation_amount = rs.sum(&:amount)
    visit_amount = vs&.sum { |v| v.amount.to_i }
    {
      reservation_count: rs.size,
      reservation_hours: rs.sum(&:duration_hours).round(1),
      reservation_amount:,
      visit_count: vs&.size,
      visit_hours: vs&.sum { |v| (v.checked_out_at - v.checked_in_at) / 3600.0 }&.round(1),
      visit_amount:,
      total_amount: reservation_amount + visit_amount.to_i,
      utilization_rate: open.zero? ? nil : (used * 100.0 / open).round(1)
    }
  end
end
