class AddAutoCheckedOutToVisits < ActiveRecord::Migration[8.1]
  def change
    # チェックアウトし忘れを閉店時刻で自動的に締めた利用か
    add_column :visits, :auto_checked_out, :boolean, null: false, default: false
  end
end
