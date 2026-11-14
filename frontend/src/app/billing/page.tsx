import { MonthNav } from "@/components/MonthNav";
import { Card } from "@/components/ui/card";
import { currentMonthInTokyo, formatDateTime, formatDuration, formatMonth, formatTime, isValidMonth, yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { Bill } from "@/lib/types";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const thisMonth = currentMonthInTokyo();
  const { month: requested } = await searchParams;
  const month = isValidMonth(requested) && requested <= thisMonth ? requested : thisMonth;
  const bill = await apiFetch<Bill>(`/billing?month=${month}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">請求</h1>
        <MonthNav month={month} basePath="/billing" max={thisMonth} />
      </div>

      <Card className="gap-1 px-5">
        <p className="text-sm text-muted-foreground">
          {formatMonth(month)}のご請求
          {month === thisMonth && "（今日までの利用分）"}
        </p>
        <p className="text-3xl font-bold">{yen(bill.total)}</p>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted-foreground">月額プラン（{bill.plan?.name ?? "なし"}）</dt>
          <dd className="text-right">{yen(bill.plan_fee)}</dd>
          <dt className="text-muted-foreground">ドロップイン利用（{bill.visits.length}回）</dt>
          <dd className="text-right">{yen(bill.visits_total)}</dd>
          <dt className="text-muted-foreground">予約（{bill.reservations.length}件）</dt>
          <dd className="text-right">{yen(bill.reservations_total)}</dd>
        </dl>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="px-5">
          <h2 className="font-semibold">ドロップイン利用</h2>
          {bill.visits.length === 0 && <p className="text-sm text-muted-foreground">利用はありません。</p>}
          <ul className="divide-y divide-border text-sm">
            {bill.visits.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 py-2">
                <span>
                  {formatDateTime(v.checked_in_at)}〜{formatTime(v.checked_out_at!)}　{v.location.name}
                  <span className="text-muted-foreground">（{formatDuration(v.duration_minutes)}）</span>
                </span>
                <span>{yen(v.amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="px-5">
          <h2 className="font-semibold">予約</h2>
          {bill.reservations.length === 0 && <p className="text-sm text-muted-foreground">予約はありません。</p>}
          <ul className="divide-y divide-border text-sm">
            {bill.reservations.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 py-2">
                <span>
                  {formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}　{r.space.location?.name} {r.space.name}
                </span>
                <span>{yen(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        月額プラン料金は月末時点（今月は今日時点）のご契約で計算します。月をまたいだ利用はチェックインした月に計上します。
      </p>
    </div>
  );
}
