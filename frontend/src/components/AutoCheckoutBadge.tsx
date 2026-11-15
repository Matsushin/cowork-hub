import { Badge } from "@/components/ui/badge";

/** チェックアウトし忘れを閉店時刻で自動的に締めた利用の印 */
export function AutoCheckoutBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="secondary" title="チェックアウトし忘れのため、閉店時刻で自動的にチェックアウトしました">
      自動チェックアウト
    </Badge>
  );
}
