import Link from "next/link";
import { setLocationActive } from "@/app/actions/admin";
import { buttonVariants } from "@/components/ui/button";
import { LocationCreateForm } from "@/components/admin/LocationCreateForm";
import { ActionButton } from "@/components/form";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHours, yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import type { Location } from "@/lib/types";

export default async function AdminLocationsPage() {
  const locations = await apiFetch<Location[]>("/admin/locations");

  return (
    <div className="space-y-6">
      <Card className="px-5">
        <h2 className="font-semibold">拠点を追加</h2>
        <LocationCreateForm />
      </Card>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">拠点</TableHead>
              <TableHead className="px-4">営業時間</TableHead>
              <TableHead className="px-4">ドロップイン料金</TableHead>
              <TableHead className="px-4">利用中</TableHead>
              <TableHead className="px-4">状態</TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="px-4">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.prefecture} {l.address}
                  </div>
                </TableCell>
                <TableCell className="px-4">{formatHours(l.open_hour, l.close_hour)}</TableCell>
                <TableCell className="px-4">
                  {yen(l.hourly_price)}/時・上限{yen(l.daily_max_price)}
                </TableCell>
                <TableCell className="px-4">{l.current_visitors}人</TableCell>
                <TableCell className="px-4">
                  {l.active ? "公開中" : <span className="text-muted-foreground">停止中</span>}
                </TableCell>
                <TableCell className="space-x-2 px-4 text-right whitespace-nowrap">
                  <Link href={`/admin/locations/${l.id}/qr`} className={buttonVariants({ variant: "outline" })}>
                    受付用QR
                  </Link>
                  <ActionButton variant="outline" action={setLocationActive.bind(null, l.id, !l.active)}>
                    {l.active ? "停止" : "公開"}
                  </ActionButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {locations.length === 0 && <p className="p-4 text-sm text-muted-foreground">拠点はまだありません。</p>}
      </Card>
    </div>
  );
}
