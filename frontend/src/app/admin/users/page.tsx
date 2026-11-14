"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<User[]>(`/admin/users?q=${encodeURIComponent(q)}`).then(setUsers).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Input placeholder="名前・メールアドレスで検索" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorMessage message={error} />
      <Card className="px-5 overflow-x-auto p-0">
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
                  <Link href={`/admin/users/${u.id}`} className="text-primary hover:underline">{u.name}</Link>
                </TableCell>
                <TableCell className="px-4 text-muted-foreground">{u.email_address}</TableCell>
                <TableCell className="px-4">{u.plan?.name ?? "—"}</TableCell>
                <TableCell className="px-4">{u.role === "admin" ? "管理者" : "会員"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
