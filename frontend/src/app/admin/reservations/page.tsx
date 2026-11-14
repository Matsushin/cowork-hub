"use client";

import { useEffect, useState } from "react";
import { api, formatDateTime, formatTime } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminReservationsPage() {
  const [date, setDate] = useState("");
  const [items, setItems] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Reservation[]>(`/admin/reservations${date ? `?date=${date}` : ""}`).then(setItems).catch((e) => setError(e.message));
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-44">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {date && (
          <button onClick={() => setDate("")} className="text-sm text-muted-foreground underline">すべて表示</button>
        )}
      </div>
      <ErrorMessage message={error} />
      <Card className="px-5 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">日時</TableHead>
              <TableHead className="px-4">スペース</TableHead>
              <TableHead className="px-4">会員</TableHead>
              <TableHead className="px-4">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="px-4">{formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}</TableCell>
                <TableCell className="px-4">{r.space.name}</TableCell>
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
