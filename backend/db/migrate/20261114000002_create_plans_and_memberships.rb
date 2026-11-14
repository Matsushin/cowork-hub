class CreatePlansAndMemberships < ActiveRecord::Migration[8.1]
  def change
    create_table :plans do |t|
      t.string :name, null: false
      t.integer :kind, null: false, default: 0
      t.integer :price, null: false
      # 月あたりの予約上限時間（nullは無制限）
      t.integer :monthly_hours_limit
      t.text :description
      t.timestamps
    end

    create_table :memberships do |t|
      t.references :user, null: false, foreign_key: true
      t.references :plan, null: false, foreign_key: true
      t.date :started_on, null: false
      t.date :ended_on
      t.timestamps
    end
  end
end
