import Link from "next/link";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { checkIn } from "@/app/actions/member";
import { ActionButton } from "@/components/form";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api-error";
import { formatHours, yen } from "@/lib/format";
import { loadCheckinParams } from "@/lib/search-params";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { LocationDetail, Visit } from "@/lib/types";

/**
 * 受付のQRコードを読むと開くチェックインの確認画面（/checkin?location=1&code=...）
 * 未ログインなら proxy がログイン画面へ送り、ログイン後にこの画面へ戻る。コードが有効かはRailsが判定する
 */
export default async function CheckinPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser();
  const { location: locationId, code } = await loadCheckinParams(searchParams);
  if (!locationId) notFound();

  const [location, currentVisit] = await Promise.all([
    apiFetch<LocationDetail>(`/locations/${locationId}`, { auth: false }).catch((e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    apiFetch<Visit | null>("/visits/current"),
  ]);

  return (
    <Card className="mx-auto max-w-md gap-4 px-5">
      <div>
        <p className="text-sm text-muted-foreground">{location.prefecture}</p>
        <h1 className="text-2xl font-bold">{location.name}</h1>
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted-foreground">営業時間</dt>
        <dd>{formatHours(location.open_hour, location.close_hour)}</dd>
        <dt className="text-muted-foreground">料金</dt>
        <dd>
          {yen(location.hourly_price / 2)}/30分（1回{yen(location.daily_max_price)}まで）
          <br />
          <span className="text-muted-foreground">月額プランの方は無料</span>
        </dd>
      </dl>
      {currentVisit ? (
        <p className="text-sm text-muted-foreground">
          {currentVisit.location.name}を利用中です。
          <Link href="/visits" className="text-primary hover:underline">
            利用状況
          </Link>
          からチェックアウトできます。
        </p>
      ) : !code ? (
        <p className="text-sm text-muted-foreground">受付のQRコードを読んでチェックインしてください。</p>
      ) : (
        <ActionButton action={checkIn.bind(null, location.id, code)} size="lg">
          チェックインする
        </ActionButton>
      )}
    </Card>
  );
}
