class CreateAiRequests < ActiveRecord::Migration[8.1]
  def change
    # AI 機能の利用記録（1回の相談ごと）。回数の上限と、料金・応答時間の集計に使う
    # 入力の文章や AI の回答は保存しない（個人情報や予約の内容を残さないため）。数字だけを残す
    create_table :ai_requests do |t|
      t.references :user, null: false, foreign_key: true
      t.string :feature, null: false
      t.integer :status, null: false, default: 0
      t.string :model
      t.integer :input_tokens, null: false, default: 0
      t.integer :output_tokens, null: false, default: 0
      t.integer :cache_read_input_tokens, null: false, default: 0
      t.integer :cache_creation_input_tokens, null: false, default: 0
      # 料金（米ドル）を100万倍した整数。小数の誤差と、JSON で文字列になるのを避ける
      t.integer :cost_micro_usd, null: false, default: 0
      t.integer :duration_ms
      t.integer :tool_calls, null: false, default: 0
      t.string :error_code
      t.timestamps
    end
    add_index :ai_requests, [ :user_id, :created_at ]
    add_index :ai_requests, [ :feature, :created_at ]
  end
end
