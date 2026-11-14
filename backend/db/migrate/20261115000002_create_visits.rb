class CreateVisits < ActiveRecord::Migration[8.1]
  def change
    # ドロップイン利用（チェックイン〜チェックアウト）
    create_table :visits do |t|
      t.references :user, null: false, foreign_key: true
      t.references :location, null: false, foreign_key: true
      t.datetime :checked_in_at, null: false
      t.datetime :checked_out_at
      # チェックアウト時に確定する利用料（円）
      t.integer :amount
      t.timestamps
    end
    add_index :visits, [ :user_id, :checked_out_at ]
    add_index :visits, [ :location_id, :checked_in_at ]
    add_check_constraint :visits, "checked_out_at IS NULL OR checked_in_at <= checked_out_at", name: "visits_time_order"
  end
end
