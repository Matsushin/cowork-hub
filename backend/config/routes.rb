Rails.application.routes.draw do
  # ALBのヘルスチェック用
  get "up" => "rails/health#show", as: :rails_health_check

  # ALBで /api/* をRailsへ、それ以外をNext.jsへ振り分ける
  scope :api do
    post "signup", to: "registrations#create"
    resource :session, only: %i[create destroy]
    resource :me, only: %i[show update], controller: "me"
    resources :plans, only: :index
    resources :locations, only: %i[index show] do
      resources :spaces, only: :index do
        get :availability, on: :collection
      end
    end
    resources :visits, only: %i[index create] do
      get :current, on: :collection
      patch :checkout, on: :member
    end
    resource :billing, only: :show
    resources :reservations, only: %i[index create] do
      patch :cancel, on: :member
    end
    resources :ai_requests, only: %i[create update]

    namespace :admin do
      resources :users, only: %i[index show update]
      resources :reservations, only: :index
      resources :spaces, only: %i[index create update destroy]
      resources :locations, only: %i[index create update] do
        get :checkin_code, on: :member # 受付に表示するQRコードの中身（60秒ごとに変わる）
      end
      resources :sales, only: :index
      # 集計（分析アシスタントの道具にもなる）
      get "stats/usage", to: "stats#usage"
      get "stats/members", to: "stats#members"
    end
  end
end
