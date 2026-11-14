import Link from "next/link";
import { cancelReservation } from "@/app/actions/member";
import { ActionButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatTime } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { Reservation } from "@/lib/types";

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireUser();
  // 表示の切り替えはURL（?filter=all）で持つ。リロードやブックマークでも状態が残る
  const upcomingOnly = (await searchParams).filter !== "all";
  const items = await apiFetch<Reservation[]>(`/reservations${upcomingOnly ? "?upcoming=true" : ""}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <div className="flex gap-1" role="group" aria-label="表示する予約">
          <Link
            href="/reservations"
            aria-current={upcomingOnly ? "page" : undefined}
            className={buttonVariants({ size: "sm", variant: upcomingOnly ? "default" : "outline" })}
          >
            今後の予約
          </Link>
          <Link
            href="/reservations?filter=all"
            aria-current={upcomingOnly ? undefined : "page"}
            className={buttonVariants({ size: "sm", variant: upcomingOnly ? "outline" : "default" })}
          >
            すべて
          </Link>
        </div>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">{upcomingOnly ? "今後の予約はありません。" : "予約はまだありません。"}</p>
      )}
      <div className="space-y-2">
        {items.map((r) => (
          <Card key={r.id} className="flex flex-row flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-medium">
                {formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}
              </p>
              <p className="text-sm text-muted-foreground">{r.space.name}</p>
            </div>
            {r.status === "canceled" ? (
              <Badge variant="secondary">キャンセル済み</Badge>
            ) : r.cancelable ? (
              <ActionButton
                variant="destructive"
                action={cancelReservation.bind(null, r.id)}
                confirmMessage={`${r.space.name} ${formatDateTime(r.starts_at)} の予約をキャンセルしますか？`}
              >
                キャンセル
              </ActionButton>
            ) : (
              <Badge variant="secondary">利用済み</Badge>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
