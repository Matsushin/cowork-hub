"use client";

import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useMemo, useState, useTransition } from "react";
import { createReservation } from "@/app/actions/member";
import { ErrorMessage } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { spaceKindLabel, yen } from "@/lib/format";
import { parseAsDate } from "@/lib/search-params";
import type { Availability, Location, Space } from "@/lib/types";

type Selection = { spaceId: number; start: number; end: number } | null;

type Props = {
  location: Location;
  date: string;
  today: string;
  /** サーバーで描画した時刻。サーバーとブラウザで「過去の枠」の判定を揃えるために使う */
  now: number;
  spaces: Space[];
  availability: Availability;
};

const fmt = (ms: number) =>
  new Date(ms).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

// データはServer Componentで取得済み。ここでは枠の選択と予約の送信だけを行う
export function ReserveGrid({ location, date, today, now, spaces, availability }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 日付はURL（?date=）で持つ。変えるとサーバーで空き状況を取り直す（shallow: false）。戻るボタンで前の日付に戻れる
  // URLはすぐ変わるが、新しい空き状況が届くまでは loadingDate が true（古い表を操作させない）
  const [loadingDate, startDateTransition] = useTransition();
  const [dateParam, setDate] = useQueryState(
    "date",
    parseAsDate.withOptions({ shallow: false, history: "push", startTransition: startDateTransition }),
  );

  const { open_hour, close_hour, slot_minutes } = availability;
  const slotMs = slot_minutes * 60_000;

  // 30分刻みの枠の開始時刻（ミリ秒）一覧
  const slots = useMemo(() => {
    const count = ((close_hour - open_hour) * 60) / slot_minutes;
    const first = new Date(`${date}T${String(open_hour).padStart(2, "0")}:00:00+09:00`).getTime();
    return Array.from({ length: count }, (_, i) => first + i * slotMs);
  }, [date, open_hour, close_hour, slot_minutes, slotMs]);

  const slotState = (spaceId: number, i: number): "free" | "reserved" | "mine" | "past" => {
    const start = slots[i];
    const end = start + slotMs;
    const hit = availability.reserved.find(
      (r) => r.space_id === spaceId && new Date(r.starts_at).getTime() < end && new Date(r.ends_at).getTime() > start,
    );
    if (hit) return hit.mine ? "mine" : "reserved";
    if (start < now) return "past";
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

  const submit = () => {
    if (!selection) return;
    setError(null);
    startTransition(async () => {
      // 成功時はServer Action側で予約一覧へリダイレクトする
      const result = await createReservation({
        space_id: selection.spaceId,
        starts_at: new Date(slots[selection.start]).toISOString(),
        ends_at: new Date(slots[selection.end] + slotMs).toISOString(),
      });
      if (!result.ok) {
        setError(result.message);
        setSelection(null);
        router.refresh(); // 他の人に先に取られた場合に備えて空き状況を取り直す
      }
    });
  };

  const selectedSpace = spaces.find((s) => s.id === selection?.spaceId);
  const selectedHours = selection ? ((selection.end - selection.start + 1) * slot_minutes) / 60 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{location.prefecture}</p>
          <h1 className="text-2xl font-bold">{location.name}を予約する</h1>
          <p className="text-sm text-muted-foreground">空いている枠をクリックし、続けて終了したい枠をクリックしてください。</p>
        </div>
        <div className="w-44">
          <Input
            type="date"
            aria-label="日付"
            value={dateParam ?? date} // 読み込み中も、選んだ日付をすぐ表示する
            min={today}
            onChange={(e) => {
              if (!e.target.value) return;
              setSelection(null);
              setDate(e.target.value);
            }}
          />
        </div>
      </div>

      <ErrorMessage message={error} />

      <Card className={`overflow-x-auto p-0 transition-opacity ${loadingDate ? "pointer-events-none opacity-50" : ""}`} aria-busy={loadingDate} data-date={date}>
        <Table className="w-full border-collapse text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-36 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                スペース
              </TableHead>
              {slots.map((s, i) => (
                <TableHead key={s} className="min-w-7 px-0 py-2 text-left font-normal text-muted-foreground">
                  {i % 2 === 0
                    ? new Date(s).toLocaleTimeString("ja-JP", {
                        hour: "numeric",
                        timeZone: "Asia/Tokyo",
                      })
                    : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((space) => (
              <TableRow key={space.id} className="border-t border-border">
                <TableCell className="sticky left-0 z-10 bg-card px-3 py-2">
                  <div className="font-medium text-foreground">{space.name}</div>
                  <div className="text-muted-foreground">
                    {spaceKindLabel[space.kind]}・{space.capacity}名{space.hourly_price > 0 && `・${yen(space.hourly_price)}/時`}
                  </div>
                </TableCell>
                {slots.map((s, i) => {
                  const state = slotState(space.id, i);
                  const selected = selection?.spaceId === space.id && i >= selection.start && i <= selection.end;
                  const color = selected
                    ? "bg-emerald-600"
                    : {
                        free: "bg-emerald-100 hover:bg-emerald-300 cursor-pointer",
                        reserved: "bg-stone-300",
                        mine: "bg-sky-400",
                        past: "bg-muted",
                      }[state];
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
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm bg-emerald-100" />
          空き
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />
          選択中
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm bg-sky-400" />
          自分の予約
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm bg-stone-300" />
          予約済み
        </span>
      </div>

      {selection && selectedSpace && (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-4 px-5">
          <div>
            <p className="text-sm text-muted-foreground">選択中の予約</p>
            <p className="font-semibold">
              {selectedSpace.name}　{date.replaceAll("-", "/")} {fmt(slots[selection.start])}〜
              {fmt(slots[selection.end] + slotMs)}
            </p>
            <p className="text-sm text-muted-foreground">
              料金：
              {yen(Math.round(selectedSpace.hourly_price * selectedHours))}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelection(null)}>
              クリア
            </Button>
            <Button onClick={submit} disabled={pending}>
              この内容で予約する
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
