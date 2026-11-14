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

  factory :space do
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
end
