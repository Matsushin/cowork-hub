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
  # 利用状況の集計の数字（行と合計で共通）。スペースごとのときはドロップインの値が null
  usage_metrics = {
    reservation_count: { type: :integer, description: "会議室などの予約の件数（確定のもの）" },
    reservation_hours: { type: :number, description: "予約の時間の合計" },
    reservation_amount: { type: :integer, description: "予約の金額の合計（円）" },
    visit_count: { type: :integer, nullable: true, description: "ドロップインの利用の件数" },
    visit_hours: { type: :number, nullable: true, description: "ドロップインの利用時間の合計" },
    visit_amount: { type: :integer, nullable: true, description: "ドロップインの金額の合計（円）" },
    total_amount: { type: :integer, description: "予約とドロップインの金額の合計（円）。月額プランの料金は含まない" },
    utilization_rate: { type: :number, nullable: true, description: "会議室の稼働率（％）。時間帯ごとのときと、会議室がないときは null" }
  }
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
          AiRequest: {
            type: :object,
            description: "AI 機能の利用記録（1回の相談）。入力の文章や AI の回答は含まない",
            properties: {
              id: { type: :integer },
              feature: { type: :string, enum: %w[booking] },
              status: { type: :string, enum: %w[started succeeded failed refused] },
              created_at: datetime,
              remaining_today: { type: :integer, description: "今日あと何回使えるか" }
            },
            required: %w[id feature status created_at remaining_today]
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
              auto_checked_out: { type: :boolean, description: "チェックアウトし忘れを閉店時刻で自動的に締めた利用か" },
              estimated_amount: { type: :integer, description: "利用中のみ。今チェックアウトした場合の料金" },
              auto_checkout_at: datetime.merge(description: "利用中のみ。チェックアウトし忘れた場合に自動で締める時刻（閉店時刻）"),
              duration_minutes: { type: :integer },
              location: id_name,
              user: ref.("UserSummary")
            },
            required: %w[id checked_in_at checked_out_at amount auto_checked_out duration_minutes location]
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
          },
          UsageStats: {
            type: :object,
            description: "利用状況の集計。金額は円（税込）、時間は時間（小数1桁）、稼働率は％（会議室の予約時間 ÷ 予約できた時間、小数1桁）",
            properties: {
              from: { type: :string, format: :date },
              to: { type: :string, format: :date },
              group_by: { type: :string, enum: UsageStats::GROUPS },
              location: id_name.merge(nullable: true),
              rows: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    key: { oneOf: [ { type: :integer }, { type: :string } ], description: "拠点・スペースの ID、月（YYYY-MM）、曜日（0=日曜）、時（0〜23）" },
                    label: { type: :string, example: "渋谷" }
                  }.merge(usage_metrics),
                  required: %w[key label] + usage_metrics.keys.map(&:to_s)
                }
              },
              totals: { type: :object, properties: usage_metrics, required: usage_metrics.keys.map(&:to_s) }
            },
            required: %w[from to group_by location rows totals]
          },
          MemberStats: {
            type: :object,
            description: "会員数の集計（人数だけ。個人の情報は含まない）",
            properties: {
              month: { type: :string, example: "2026-11" },
              member_count: { type: :integer, description: "月末（今月なら今日）時点でプランを契約している人数" },
              new_member_count: { type: :integer, description: "その月に登録した人数（管理者を含む。プランを契約していない人も数える）" },
              active_member_count: { type: :integer, description: "その月に会議室を予約したか、ドロップインを使った人数" },
              by_plan: {
                type: :array,
                items: {
                  type: :object,
                  properties: {
                    plan: {
                      type: :object,
                      properties: { id: { type: :integer }, name: { type: :string }, kind: { type: :string }, price: { type: :integer } },
                      required: %w[id name kind price]
                    },
                    member_count: { type: :integer },
                    plan_amount: { type: :integer, description: "月額プランの料金の合計（ドロップインは0）" }
                  },
                  required: %w[plan member_count plan_amount]
                }
              }
            },
            required: %w[month member_count new_member_count active_member_count by_plan]
          },
          CheckinCode: {
            type: :object,
            description: "受付のQRコードに入れるチェックイン用のコード。今と1つ前の時間枠のコードが有効",
            properties: {
              location: id_name,
              code: { type: :string, example: "3f2a9c0d1b7e4a56" },
              expires_at: datetime.merge(description: "このコードが「今の時間枠」でなくなる時刻（この後も1枠分は使える）"),
              expires_in: { type: :integer, description: "expires_at までの残り秒数（サーバーの時刻で計算）" },
              interval: { type: :integer, description: "時間枠の長さ（秒）", example: 60 }
            },
            required: %w[location code expires_at expires_in interval]
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
