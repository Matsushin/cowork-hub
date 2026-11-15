class VisitsController < ApplicationController
  # チェックアウトし忘れを締めてから返す（定期実行の合間でも、閉店後に「利用中」のまま見えないように）
  # checkout は check_out! 自身が閉店時刻で締めるので対象外（先に締めると「チェックアウト済み」エラーになる）
  before_action -> { Visit.auto_check_out_overdue!(current_user.visits) }, only: %i[index current]

  def index
    visits = current_user.visits.includes(:location).order(checked_in_at: :desc).limit(100)
    render json: visits.map { |v| VisitSerializer.call(v) }
  end

  # 利用中のドロップイン（なければ null）
  def current
    visit = current_user.visits.in_progress.includes(:location).first
    render json: visit && VisitSerializer.call(visit)
  end

  def create
    location = Location.active.find(params.expect(visit: [ :location_id ])[:location_id])
    visit = Visit.check_in!(user: current_user, location:)
    render json: VisitSerializer.call(visit), status: :created
  rescue Visit::AlreadyCheckedIn => e
    render json: { error: e.message }, status: :conflict
  end

  def checkout
    visit = current_user.visits.find(params[:id])
    visit.check_out!
    render json: VisitSerializer.call(visit)
  end
end
