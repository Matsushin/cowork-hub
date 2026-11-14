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

    namespace :admin do
      resources :users, only: %i[index show update]
      resources :reservations, only: :index
      resources :spaces, only: %i[index create update destroy]
      resources :locations, only: %i[index create update]
      resources :sales, only: :index
    end
  end
end
