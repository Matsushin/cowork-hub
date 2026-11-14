import { MonthNav } from "@/components/MonthNav";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentMonthInTokyo, formatMonth, isValidMonth, yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import type { Sales } from "@/lib/types";

export default async function AdminSalesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const thisMonth = currentMonthInTokyo();
  const { month: requested } = await searchParams;
  const month = isValidMonth(requested) && requested <= thisMonth ? requested : thisMonth;
  const sales = await apiFetch<Sales>(`/admin/sales?month=${month}`);
  const sum = (key: "visit_count" | "visit_amount" | "reservation_amount") => sales.locations.reduce((acc, r) => acc + r[key], 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatMonth(month)}の売上合計</p>
          <p className="text-3xl font-bold">{yen(sales.total)}</p>
        </div>
        <MonthNav month={month} basePath="/admin/sales" max={thisMonth} />
      </div>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">拠点</TableHead>
              <TableHead className="px-4 text-right">ドロップイン回数</TableHead>
              <TableHead className="px-4 text-right">ドロップイン売上</TableHead>
              <TableHead className="px-4 text-right">予約売上</TableHead>
              <TableHead className="px-4 text-right">合計</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.locations.map((r) => (
              <TableRow key={r.location.id}>
                <TableCell className="px-4">
                  {r.location.name}
                  <span className="ml-2 text-xs text-muted-foreground">{r.location.prefecture}</span>
                </TableCell>
                <TableCell className="px-4 text-right">{r.visit_count}回</TableCell>
                <TableCell className="px-4 text-right">{yen(r.visit_amount)}</TableCell>
                <TableCell className="px-4 text-right">{yen(r.reservation_amount)}</TableCell>
                <TableCell className="px-4 text-right font-medium">{yen(r.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="px-4">月額プラン（拠点共通）</TableCell>
              <TableCell className="px-4" colSpan={3} />
              <TableCell className="px-4 text-right font-medium">{yen(sales.plan_amount)}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="px-4">合計</TableCell>
              <TableCell className="px-4 text-right">{sum("visit_count")}回</TableCell>
              <TableCell className="px-4 text-right">{yen(sum("visit_amount"))}</TableCell>
              <TableCell className="px-4 text-right">{yen(sum("reservation_amount"))}</TableCell>
              <TableCell className="px-4 text-right">{yen(sales.total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">
        ドロップインはチェックアウト済みの利用をチェックインした月に、予約は確定済みの予約を利用日の月に計上します。月額プランは月末時点（今月は今日時点）の契約数で計算します。
      </p>
    </div>
  );
}
