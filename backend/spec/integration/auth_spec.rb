require "swagger_helper"

RSpec.describe "認証・会員情報", type: :request do
  let(:user) { create(:user, password: "password123") }
  let(:Authorization) { auth_headers(user)["Authorization"] }

  path "/api/signup" do
    post "会員登録（ドロップインプランで開始）" do
      tags "認証"
      produces "application/json"
      security []
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          user: {
            type: :object,
            properties: { name: { type: :string }, email_address: { type: :string }, password: { type: :string } },
            required: %w[name email_address password]
          }
        },
        required: %w[user]
      }

      response "201", "登録してログインした" do
        schema "$ref" => "#/components/schemas/SessionResponse"
        before { create(:plan, kind: :drop_in, price: 0) }
        let(:body) { { user: { name: "新規会員", email_address: "new@example.com", password: "password123" } } }
        run_test!
      end

      response "422", "入力内容の誤り" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { user: { name: "", email_address: "invalid", password: "short" } } }
        run_test!
      end
    end
  end

  path "/api/session" do
    post "ログイン" do
      tags "認証"
      produces "application/json"
      security []
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { email_address: { type: :string }, password: { type: :string } },
        required: %w[email_address password]
      }

      response "201", "ログインした" do
        schema "$ref" => "#/components/schemas/SessionResponse"
        let(:body) { { email_address: user.email_address, password: "password123" } }
        run_test!
      end

      response "401", "メールアドレスまたはパスワードが違う" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { email_address: user.email_address, password: "wrong-password" } }
        run_test!
      end
    end

    delete "ログアウト" do
      tags "認証"
      produces "application/json"

      response "204", "ログアウトした" do
        run_test!
      end

      it_requires_login
    end
  end

  path "/api/me" do
    get "ログイン中の会員" do
      tags "会員"
      produces "application/json"

      response "200", "会員情報" do
        schema "$ref" => "#/components/schemas/User"
        run_test!
      end

      it_requires_login
    end

    patch "会員情報の更新" do
      tags "会員"
      produces "application/json"
      consumes "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          user: {
            type: :object,
            properties: {
              name: { type: :string },
              email_address: { type: :string },
              password: { type: :string, description: "変更するときだけ送る" }
            }
          }
        },
        required: %w[user]
      }

      response "200", "更新した" do
        schema "$ref" => "#/components/schemas/User"
        let(:body) { { user: { name: "名前を変更" } } }
        run_test!
      end

      response "422", "入力内容の誤り" do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { user: { name: "" } } }
        run_test!
      end
    end
  end

  path "/api/plans" do
    get "料金プラン一覧" do
      tags "プラン"
      produces "application/json"
      security []

      response "200", "プラン一覧（安い順）" do
        schema type: :array, items: { "$ref" => "#/components/schemas/Plan" }
        before { create(:plan, kind: :drop_in, price: 0, monthly_hours_limit: 8) }
        run_test!
      end
    end
  end
end
