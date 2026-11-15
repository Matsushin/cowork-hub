namespace :visits do
  desc "閉店時刻を過ぎても利用中のままのドロップインを、閉店時刻で自動チェックアウトする"
  task auto_check_out: :environment do
    before = Visit.in_progress.count
    Visit.auto_check_out_overdue!
    puts "自動チェックアウト：#{before - Visit.in_progress.count}件"
  end
end
