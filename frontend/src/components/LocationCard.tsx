import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatHours, yen } from "@/lib/format";
import type { Location } from "@/lib/types";

export function LocationCard({ location }: { location: Location }) {
  return (
    <Link href={`/locations/${location.id}`} className="block">
      <Card className="h-full gap-1 px-5 transition-colors hover:border-primary">
        <p className="text-xs text-muted-foreground">{location.prefecture}</p>
        <h3 className="text-lg font-semibold">{location.name}</h3>
        <p className="text-sm text-muted-foreground">{location.address}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>{formatHours(location.open_hour, location.close_hour)}</span>
          <span>
            {yen(location.hourly_price / 2)}/30分（1回
            {yen(location.daily_max_price)}まで）
          </span>
          {location.current_visitors !== undefined && (
            <span className="text-muted-foreground">利用中 {location.current_visitors}人</span>
          )}
        </div>
      </Card>
    </Link>
  );
}
