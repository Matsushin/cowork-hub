"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime, formatTime } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/form";
import { Badge } from "@/components/ui/badge";

function ReservationsInner() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Reservation[]>("/reservations").then(setItems).catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const cancel = async (r: Reservation) => {
    if (!confirm(`${r.space.name} ${formatDateTime(r.starts_at)} の予約をキャンセルしますか？`)) return;
    try {
      await api(`/reservations/${r.id}/cancel`, { method: "PATCH" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">予約一覧</h1>
      <ErrorMessage message={error} />
      {items.length === 0 && <p className="text-sm text-muted-foreground">予約はまだありません。</p>}
      <div className="space-y-2">
        {items.map((r) => (
          <Card key={r.id} className="px-5 flex flex-row flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">
                {formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}
              </p>
              <p className="text-sm text-muted-foreground">{r.space.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {r.status === "canceled" ? (
                <Badge variant="secondary">キャンセル済み</Badge>
              ) : r.cancelable ? (
                <Button variant="destructive" onClick={() => cancel(r)}>キャンセル</Button>
              ) : (
                <Badge variant="secondary">利用済み</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <RequireAuth>
      <ReservationsInner />
    </RequireAuth>
  );
}
