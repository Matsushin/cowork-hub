require "rails_helper"

# OpenAPI（API仕様書）の生成設定
#
#   bin/rails rswag:specs:swaggerize   … spec/integration のテストを実行して swagger/v1/openapi.yaml を出力する
#
# spec/integration のテストは、レスポンスがここで定義したスキーマに合っているかも検証する。
# フロントエンドは openapi.yaml から TypeScript の型を生成している（frontend の npm run gen:api）ので、
# APIのレスポンスを変えたらスキーマも直し、両方を再生成してコミットする。
RSpec.configure do |config|
  config.openapi_root = Rails.root.join("swagger").to_s
  config.openapi_format = :yaml

  # OpenAPI 3.0 では $ref の隣に書いた nullable は無視されるので、$ref は allOf で包む
  nullable = ->(schema) { schema.key?("$ref") ? { allOf: [ schema ], nullable: true } : schema.merge(nullable: true) }
  ref = ->(name) { { "$ref" => "#/components/schemas/#{name}" } }
  datetime = { type: :string, format: "date-time" }
  id_name = { type: :object, properties: { id: { type: :integer }, name: { type: :string } }, required: %w[id name] }

  config.openapi_specs = {
    "v1/openapi.yaml" => {
      openapi: "3.0.3",
      info: { title: "ee-office API", version: "v1" },
      components: {
        securitySchemes: {
          bearer: { type: :http, scheme: :bearer, description: "ログイン・会員登録で受け取ったトークン" }
        },
        schemas: {
          Error: {
            type: :object,
            properties: {
              error: { type: :string },
              errors: {
                type: :object,
                description: "項目名 → エラーメッセージ一覧（項目に属さないものは base）。バリデーションエラー（422）のときだけ返す",
                additionalProperties: { type: :array, items: { type: :string } }
              }
            },
            required: %w[error]
          },
          Plan: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              kind: { type: :string, enum: %w[drop_in monthly] },
              price: { type: :integer },
              monthly_hours_limit: nullable.({ type: :integer }),
              description: nullable.({ type: :string })
            },
            required: %w[id name kind price monthly_hours_limit description]
          },
          User: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              email_address: { type: :string },
              role: { type: :string, enum: %w[member admin] },
              plan: nullable.(ref.("Plan")),
              created_at: datetime
            },
            required: %w[id name email_address role plan created_at]
          },
          UserDetail: {
            allOf: [
              ref.("User"),
              {
                type: :object,
                properties: {
                  reservations: { type: :array, items: ref.("Reservation") },
                  visits: { type: :array, items: ref.("Visit") }
                },
                required: %w[reservations visits]
              }
            ]
          },
          UserSummary: {
            type: :object,
            properties: { id: { type: :integer }, name: { type: :string }, email_address: { type: :string } },
            required: %w[id name email_address]
          },
          SessionResponse: {
            type: :object,
            properties: { token: { type: :string }, user: ref.("User") },
            required: %w[token user]
          },
          Location: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              prefecture: { type: :string },
              address: { type: :string },
              description: nullable.({ type: :string }),
              open_hour: { type: :integer },
              close_hour: { type: :integer },
              hourly_price: { type: :integer },
              daily_max_price: { type: :integer },
              active: { type: :boolean },
              current_visitors: { type: :integer, description: "利用中の人数（一覧・詳細のみ）" }
            },
            required: %w[id name prefecture address description open_hour close_hour hourly_price daily_max_price active]
          },
          LocationDetail: {
            allOf: [
              ref.("Location"),
              {
                type: :object,
                properties: { spaces: { type: :array, items: ref.("Space") } },
                required: %w[spaces]
              }
            ]
          },
          Space: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
              kind: { type: :string, enum: %w[seat meeting_room] },
              capacity: { type: :integer },
              hourly_price: { type: :integer },
              active: { type: :boolean },
              location_id: { type: :integer },
              location: id_name.merge(description: "予約・管理画面のみ")
            },
            required: %w[id name kind capacity hourly_price active location_id]
          },
          Reservation: {
            type: :object,
            properties: {
              id: { type: :integer },
              starts_at: datetime,
              ends_at: datetime,
              status: { type: :string, enum: %w[confirmed canceled] },
              amount: { type: :integer },
              space: ref.("Space"),
              cancelable: { type: :boolean },
              user: ref.("UserSummary").merge(description: "管理画面のみ")
            },
            required: %w[id starts_at ends_at status amount space cancelable]
          },
          Availability: {
            type: :object,
            properties: {
              date: { type: :string, format: :date },
              open_hour: { type: :integer },
              close_hour: { type: :integer },
              slot_minutes: { type: :integer },
              reserved: {
                type: :array,
                items: {
                  type: :object,
                  properties: { space_id: { type: :integer }, starts_at: datetime, ends_at: datetime, mine: { type: :boolean } },
                  required: %w[space_id starts_at ends_at mine]
                }
              }
            },
            required: %w[date open_hour close_hour slot_minutes reserved]
          },
          Visit: {
            type: :object,
            properties: {
              id: { type: :integer },
              checked_in_at: datetime,
              checked_out_at: nullable.(datetime),
              amount: nullable.({ type: :integer }),
              estimated_amount: { type: :integer, description: "利用中のみ。今チェックアウトした場合の料金" },
              duration_minutes: { type: :integer },
              location: id_name,
              user: ref.("UserSummary")
            },
            required: %w[id checked_in_at checked_out_at amount duration_minutes location]
          },
          Bill: {
            type: :object,
            properties: {
              month: { type: :string, example: "2026-11" },
              plan: nullable.(ref.("Plan")),
              plan_fee: { type: :integer },
              visits: { type: :array, items: ref.("Visit") },
              visits_total: { type: :integer },
              reservations: { type: :array, items: ref.("Reservation") },
              reservations_total: { type: :integer },
              total: { type: :integer }
            },
            required: %w[month plan plan_fee visits visits_total reservations reservations_total total]
          },
          Sales: {
            type: :object,
            properties: {
              month: { type: :string, example: "2026-11" },
              locations: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    location: {
                      type: :object,
                      properties: { id: { type: :integer }, name: { type: :string }, prefecture: { type: :string } },
                      required: %w[id name prefecture]
                    },
                    visit_count: { type: :integer },
                    visit_amount: { type: :integer },
                    reservation_amount: { type: :integer },
                    total: { type: :integer }
                  },
                  required: %w[location visit_count visit_amount reservation_amount total]
                }
              },
              plan_amount: { type: :integer },
              total: { type: :integer }
            },
            required: %w[month locations plan_amount total]
          }
        }
      },
      security: [ { bearer: [] } ],
      paths: {}
    }
  }
end

# spec/integration で使う共通の書き方
module OpenapiHelpers
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    # 認証が必要なAPIで、トークンなしなら401になること
    def it_requires_login
      response "401", "未ログイン" do
        schema "$ref" => "#/components/schemas/Error"
        let(:Authorization) { nil }
        run_test!
      end
    end
  end
end

RSpec.configure do |config|
  config.include OpenapiHelpers, type: :request, file_path: %r{spec/integration}
end
