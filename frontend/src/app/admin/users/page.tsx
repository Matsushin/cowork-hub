import Link from "next/link";
import { SearchParamInput } from "@/components/admin/SearchParamInput";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/server/api";
import type { User } from "@/lib/types";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const users = await apiFetch<User[]>(`/admin/users?q=${encodeURIComponent(q)}`);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SearchParamInput param="q" delay={300} placeholder="名前・メールアドレスで検索" aria-label="会員を検索" />
      </div>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">名前</TableHead>
              <TableHead className="px-4">メールアドレス</TableHead>
              <TableHead className="px-4">プラン</TableHead>
              <TableHead className="px-4">権限</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="px-4">
                  <Link href={`/admin/users/${u.id}`} className="text-primary hover:underline">
                    {u.name}
                  </Link>
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">{u.email_address}</TableCell>
                <TableCell className="px-4">{u.plan?.name ?? "—"}</TableCell>
                <TableCell className="px-4">{u.role === "admin" ? "管理者" : "会員"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {users.length === 0 && <p className="p-4 text-sm text-muted-foreground">該当する会員はいません。</p>}
      </Card>
    </div>
  );
}
