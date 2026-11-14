import { deleteSpace, setSpaceActive } from "@/app/actions/admin";
import { SpaceCreateForm } from "@/components/admin/SpaceCreateForm";
import { ActionButton } from "@/components/form";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { spaceKindLabel, yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import type { Location, Space } from "@/lib/types";

export default async function AdminSpacesPage() {
  const [spaces, locations] = await Promise.all([apiFetch<Space[]>("/admin/spaces"), apiFetch<Location[]>("/admin/locations")]);

  return (
    <div className="space-y-6">
      <Card className="px-5">
        <h2 className="font-semibold">スペースを追加</h2>
        <SpaceCreateForm locations={locations} />
      </Card>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">拠点</TableHead>
              <TableHead className="px-4">名前</TableHead>
              <TableHead className="px-4">種別</TableHead>
              <TableHead className="px-4">定員</TableHead>
              <TableHead className="px-4">料金</TableHead>
              <TableHead className="px-4">状態</TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="px-4">{s.location?.name}</TableCell>
                <TableCell className="px-4">{s.name}</TableCell>
                <TableCell className="px-4">{spaceKindLabel[s.kind]}</TableCell>
                <TableCell className="px-4">{s.capacity}名</TableCell>
                <TableCell className="px-4">{s.hourly_price > 0 ? `${yen(s.hourly_price)}/時` : "無料"}</TableCell>
                <TableCell className="px-4">
                  {s.active ? "公開中" : <span className="text-muted-foreground">停止中</span>}
                </TableCell>
                <TableCell className="space-x-2 px-4 text-right whitespace-nowrap">
                  <ActionButton variant="outline" action={setSpaceActive.bind(null, s.id, !s.active)}>
                    {s.active ? "停止" : "公開"}
                  </ActionButton>
                  <ActionButton
                    variant="destructive"
                    action={deleteSpace.bind(null, s.id)}
                    confirmMessage={`${s.name}を削除しますか？`}
                  >
                    削除
                  </ActionButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
