import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api-error";
import { formatHours, yen } from "@/lib/format";
import { googleMapsUrl } from "@/lib/maps";
import { apiFetch } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/session";
import type { LocationDetail, Visit } from "@/lib/types";

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [location, user] = await Promise.all([
    apiFetch<LocationDetail>(`/locations/${id}`, { auth: false }).catch((e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    getCurrentUser(),
  ]);
  const currentVisit = user ? await apiFetch<Visit | null>("/visits/current") : null;
  const rooms = location.spaces.filter((s) => s.kind === "meeting_room");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{location.prefecture}</p>
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <p className="text-muted-foreground">{location.address}</p>
        <a
          href={googleMapsUrl(location.prefecture, location.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Googleマップで開く
        </a>
        {location.description && <p className="mt-2">{location.description}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3 px-5">
          <h2 className="font-semibold">ドロップイン（予約不要）</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">営業時間</dt>
            <dd>{formatHours(location.open_hour, location.close_hour)}</dd>
            <dt className="text-muted-foreground">料金</dt>
            <dd>
              {yen(location.hourly_price / 2)}/30分（1回
              {yen(location.daily_max_price)}まで）
              <br />
              <span className="text-muted-foreground">月額プランの方は無料</span>
              <br />
              <span className="text-muted-foreground">チェックアウトし忘れた場合は、閉店時刻で自動的にチェックアウトします</span>
            </dd>
            <dt className="text-muted-foreground">利用中</dt>
            <dd>{location.current_visitors}人</dd>
          </dl>
          {currentVisit ? (
            <p className="text-sm text-muted-foreground">
              {currentVisit.location.name}を利用中です。
              <Link href="/visits" className="text-primary hover:underline">
                利用状況
              </Link>
              からチェックアウトできます。
            </p>
          ) : (
            // その場にいることを確かめるため、チェックインは受付のQRコードからだけ行う
            <p className="rounded-md bg-muted px-3 py-2 text-sm">受付のQRコードを読んでチェックインしてください</p>
          )}
        </Card>

        <Card className="gap-3 px-5">
          <h2 className="font-semibold">会議室・席の予約</h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">この拠点には会議室がありません。</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {rooms.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <span>
                    {s.name}（{s.capacity}名）
                  </span>
                  <span>{yen(s.hourly_price)}/時間</span>
                </li>
              ))}
            </ul>
          )}
          {location.spaces.length > 0 && (
            <Link
              href={user ? `/locations/${location.id}/reserve` : `/login?next=/locations/${location.id}/reserve`}
              className={buttonVariants({
                variant: "outline",
                className: "self-start",
              })}
            >
              空き状況を見て予約する
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
