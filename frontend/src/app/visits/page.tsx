import Link from "next/link";
import { checkOut } from "@/app/actions/member";
import { ActionButton } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatDuration, formatTime, yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { Visit } from "@/lib/types";

export default async function VisitsPage() {
  await requireUser();
  const visits = await apiFetch<Visit[]>("/visits");
  const current = visits.find((v) => v.checked_out_at === null);
  const history = visits.filter((v) => v.checked_out_at !== null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">利用状況</h1>

      {current ? (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-4 border-primary px-5">
          <div>
            <p className="text-sm text-muted-foreground">利用中</p>
            <p className="text-lg font-semibold">{current.location.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(current.checked_in_at)}から {formatDuration(current.duration_minutes)}経過・現在の料金{" "}
              {yen(current.estimated_amount ?? 0)}
            </p>
          </div>
          <ActionButton
            action={checkOut.bind(null, current.id)}
            confirmMessage={`${current.location.name}からチェックアウトしますか？`}
          >
            チェックアウト
          </ActionButton>
        </Card>
      ) : (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-4 px-5">
          <p className="text-sm text-muted-foreground">現在利用中の拠点はありません。</p>
          <Link href="/locations" className={buttonVariants({ variant: "outline" })}>
            拠点を探してチェックイン
          </Link>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">利用履歴</h2>
          <Link href="/billing" className="text-sm text-primary hover:underline">
            今月の請求を見る
          </Link>
        </div>
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">日時</TableHead>
                <TableHead className="px-4">拠点</TableHead>
                <TableHead className="px-4">利用時間</TableHead>
                <TableHead className="px-4 text-right">料金</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="px-4">
                    {formatDateTime(v.checked_in_at)}〜{formatTime(v.checked_out_at!)}
                  </TableCell>
                  <TableCell className="px-4">{v.location.name}</TableCell>
                  <TableCell className="px-4">{formatDuration(v.duration_minutes)}</TableCell>
                  <TableCell className="px-4 text-right">{yen(v.amount ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {history.length === 0 && <p className="p-4 text-sm text-muted-foreground">利用履歴はまだありません。</p>}
        </Card>
      </section>
    </div>
  );
}
