import Link from "next/link";
import { SearchParamInput } from "@/components/admin/SearchParamInput";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatTime, isValidDate } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import type { Reservation } from "@/lib/types";

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const filtered = isValidDate(date);
  const items = await apiFetch<Reservation[]>(`/admin/reservations${filtered ? `?date=${date}` : ""}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-44">
          <SearchParamInput param="date" type="date" aria-label="日付で絞り込み" />
        </div>
        {filtered && (
          <Link href="/admin/reservations" className="text-sm text-muted-foreground underline">
            すべて表示
          </Link>
        )}
      </div>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">日時</TableHead>
              <TableHead className="px-4">拠点・スペース</TableHead>
              <TableHead className="px-4">会員</TableHead>
              <TableHead className="px-4">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="px-4">
                  {formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}
                </TableCell>
                <TableCell className="px-4">
                  {r.space.location?.name}　{r.space.name}
                </TableCell>
                <TableCell className="px-4">{r.user?.name}</TableCell>
                <TableCell className="px-4 text-muted-foreground">{r.status === "canceled" ? "キャンセル" : "確定"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">予約はありません。</p>}
      </Card>
    </div>
  );
}
