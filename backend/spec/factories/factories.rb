FactoryBot.define do
  factory :plan do
    sequence(:name) { |n| "プラン#{n}" }
    kind { :monthly }
    price { 10000 }
    monthly_hours_limit { nil }
  end

  factory :user do
    sequence(:email_address) { |n| "user#{n}@example.com" }
    name { "テスト会員" }
    password { "password123" }

    transient do
      plan { association(:plan) }
    end

    after(:create) do |user, ctx|
      user.memberships.create!(plan: ctx.plan, started_on: Date.current.beginning_of_month) if ctx.plan
    end

    trait :admin do
      role { :admin }
    end
  end

  factory :location do
    sequence(:name) { |n| "拠点#{n}" }
    prefecture { "東京都" }
    address { "渋谷区1-1" }
    open_hour { 9 }
    close_hour { 21 }
    hourly_price { 300 }
    daily_max_price { 1500 }
  end

  factory :visit do
    user
    location
    checked_in_at { Time.current.change(hour: 10) }
  end

  factory :space do
    location
    sequence(:name) { |n| "席#{n}" }
    kind { :seat }
    capacity { 1 }
  end

  factory :reservation do
    user
    space
    starts_at { 1.day.from_now.change(hour: 10) }
    ends_at { 1.day.from_now.change(hour: 12) }
  end

  factory :ai_request do
    user
    feature { "booking" }
  end
end
