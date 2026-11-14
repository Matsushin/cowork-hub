Rails.application.routes.draw do
  # ALBのヘルスチェック用
  get "up" => "rails/health#show", as: :rails_health_check

  # ALBで /api/* をRailsへ、それ以外をNext.jsへ振り分ける
  scope :api do
    post "signup", to: "registrations#create"
    resource :session, only: %i[create destroy]
    resource :me, only: %i[show update], controller: "me"
    resources :plans, only: :index
    resources :spaces, only: :index do
      get :availability, on: :collection
    end
    resources :reservations, only: %i[index create] do
      patch :cancel, on: :member
    end

    namespace :admin do
      resources :users, only: %i[index show update]
      resources :reservations, only: :index
      resources :spaces, only: %i[index create update destroy]
    end
  end
end
