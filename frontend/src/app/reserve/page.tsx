"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, spaceKindLabel } from "@/lib/api";
import type { Availability, Space } from "@/lib/types";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Selection = { spaceId: number; start: number; end: number } | null;

function ReserveInner() {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a] = await Promise.all([api<Space[]>("/spaces"), api<Availability>(`/spaces/availability?date=${date}`)]);
      setSpaces(s);
      setAvailability(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [date]);

  useEffect(() => {
    setSelection(null);
    load();
  }, [load]);

  // 30分刻みの枠の開始時刻（Date）一覧
  const slots = useMemo(() => {
    if (!availability) return [];
    const { open_hour, close_hour, slot_minutes } = availability;
    const count = ((close_hour - open_hour) * 60) / slot_minutes;
    return Array.from({ length: count }, (_, i) => new Date(`${date}T${String(open_hour).padStart(2, "0")}:00:00+09:00`).getTime() + i * slot_minutes * 60_000);
  }, [availability, date]);

  const slotMs = (availability?.slot_minutes ?? 30) * 60_000;

  const slotState = (spaceId: number, i: number): "free" | "reserved" | "mine" | "past" => {
    const start = slots[i];
    const end = start + slotMs;
    const hit = availability?.reserved.find(
      (r) => r.space_id === spaceId && new Date(r.starts_at).getTime() < end && new Date(r.ends_at).getTime() > start,
    );
    if (hit) return hit.mine ? "mine" : "reserved";
    if (start < Date.now()) return "past";
    return "free";
  };

  const onSlotClick = (spaceId: number, i: number) => {
    if (slotState(spaceId, i) !== "free") return;
    if (!selection || selection.spaceId !== spaceId || i < selection.start) {
      setSelection({ spaceId, start: i, end: i });
      return;
    }
    // 開始から連続して空いている場合のみ範囲を伸ばす
    for (let k = selection.start; k <= i; k++) {
      if (slotState(spaceId, k) !== "free") {
        setSelection({ spaceId, start: i, end: i });
        return;
      }
    }
    setSelection({ ...selection, end: i });
  };

  const fmt = (ms: number) => new Date(ms).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
  const selectedSpace = spaces.find((s) => s.id === selection?.spaceId);

  const submit = async () => {
    if (!selection) return;
    setSubmitting(true);
    setError(null);
    try {
      await api("/reservations", {
        method: "POST",
        body: {
          reservation: {
            space_id: selection.spaceId,
            starts_at: new Date(slots[selection.start]).toISOString(),
            ends_at: new Date(slots[selection.end] + slotMs).toISOString(),
          },
        },
      });
      router.push("/reservations");
    } catch (e) {
      setError((e as Error).message);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">予約する</h1>
          <p className="text-sm text-muted-foreground">空いている枠をクリックし、続けて終了したい枠をクリックしてください。</p>
        </div>
        <div className="w-44">
          <Input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <ErrorMessage message={error} />

      <Card className="px-5 overflow-x-auto p-0">
        <Table className="w-full border-collapse text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-36 bg-card px-3 py-2 text-left font-medium text-muted-foreground">スペース</TableHead>
              {slots.map((s, i) => (
                <TableHead key={s} className="min-w-7 px-0 py-2 text-left font-normal text-muted-foreground">
                  {i % 2 === 0 ? new Date(s).toLocaleTimeString("ja-JP", { hour: "numeric", timeZone: "Asia/Tokyo" }) : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((space) => (
              <TableRow key={space.id} className="border-t border-border">
                <TableCell className="sticky left-0 z-10 bg-card px-3 py-2">
                  <div className="font-medium text-foreground">{space.name}</div>
                  <div className="text-muted-foreground">{spaceKindLabel[space.kind]}・{space.capacity}名</div>
                </TableCell>
                {slots.map((s, i) => {
                  const state = slotState(space.id, i);
                  const selected = selection?.spaceId === space.id && i >= selection.start && i <= selection.end;
                  const color = selected
                    ? "bg-emerald-600"
                    : { free: "bg-emerald-100 hover:bg-emerald-300 cursor-pointer", reserved: "bg-stone-300", mine: "bg-sky-400", past: "bg-muted" }[state];
                  return (
                    <TableCell key={s} className="p-0.5">
                      <button
                        type="button"
                        aria-label={`${space.name} ${fmt(s)}`}
                        disabled={state !== "free"}
                        onClick={() => onSlotClick(space.id, i)}
                        className={`block h-8 w-full rounded-sm ${color}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-emerald-100" />空き</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />選択中</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-sky-400" />自分の予約</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-stone-300" />予約済み</span>
      </div>

      {selection && selectedSpace && (
        <Card className="px-5 flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">選択中の予約</p>
            <p className="font-semibold">
              {selectedSpace.name}　{date.replaceAll("-", "/")} {fmt(slots[selection.start])}〜{fmt(slots[selection.end] + slotMs)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelection(null)}>クリア</Button>
            <Button onClick={submit} disabled={submitting}>この内容で予約する</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ReservePage() {
  return (
    <RequireAuth>
      <ReserveInner />
    </RequireAuth>
  );
}
