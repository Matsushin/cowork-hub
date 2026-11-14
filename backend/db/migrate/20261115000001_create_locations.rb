class CreateLocations < ActiveRecord::Migration[8.1]
  def up
    create_table :locations do |t|
      t.string :name, null: false
      t.string :prefecture, null: false
      t.string :address, null: false
      t.text :description
      t.integer :open_hour, null: false, default: 9
      t.integer :close_hour, null: false, default: 21
      # ドロップイン（入退室）の料金。30分ごとに hourly_price の半額、1回あたり daily_max_price が上限
      t.integer :hourly_price, null: false, default: 300
      t.integer :daily_max_price, null: false, default: 1500
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :locations, :prefecture
    add_check_constraint :locations, "open_hour < close_hour", name: "locations_hours_order"

    # 既存のスペースは「本店」拠点に所属させてから NOT NULL にする
    add_reference :spaces, :location, foreign_key: true
    if select_value("SELECT COUNT(*) FROM spaces").to_i.positive?
      execute <<~SQL
        INSERT INTO locations (name, prefecture, address, created_at, updated_at)
        VALUES ('本店', '東京都', '未設定', NOW(), NOW())
      SQL
      execute "UPDATE spaces SET location_id = (SELECT MIN(id) FROM locations)"
    end
    change_column_null :spaces, :location_id, false
    # 会議室などの1時間あたりの料金（予約時に確定し reservations.amount に保存する）
    add_column :spaces, :hourly_price, :integer, null: false, default: 0
    add_column :reservations, :amount, :integer, null: false, default: 0
  end

  def down
    remove_column :reservations, :amount
    remove_column :spaces, :hourly_price
    remove_reference :spaces, :location, foreign_key: true
    drop_table :locations
  end
end
