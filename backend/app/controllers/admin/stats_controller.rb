module Admin
  # 利用状況・会員数の集計（集計した数字だけを返す。個人の情報は返さない）
  # 管理画面の分析アシスタント（docs/ai/）の道具として、AI がここを呼ぶ。AI に SQL は書かせない
  class StatsController < BaseController
    include MonthParam

    rescue_from UsageStats::Invalid do |e|
      render json: { error: e.message }, status: :bad_request
    end

    def usage
      render json: UsageStats.new(**params.permit(:from, :to, :group_by, :location_id).to_h.symbolize_keys).as_json
    end

    def members
      render json: MemberStats.new(month: month_param).as_json
    end
  end
end
