class CreateSpacesAndReservations < ActiveRecord::Migration[8.1]
  def change
    create_table :spaces do |t|
      t.string :name, null: false
      t.integer :kind, null: false, default: 0
      t.integer :capacity, null: false, default: 1
      t.boolean :active, null: false, default: true
      t.timestamps
    end

    create_table :reservations do |t|
      t.references :user, null: false, foreign_key: true
      t.references :space, null: false, foreign_key: true
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.integer :status, null: false, default: 0
      t.timestamps
    end
    add_index :reservations, [ :space_id, :starts_at, :ends_at ]
    add_check_constraint :reservations, "starts_at < ends_at", name: "reservations_time_order"
  end
end
