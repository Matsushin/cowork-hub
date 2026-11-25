"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { askBookingAssistant } from "@/app/actions/assistant";
import { createReservation } from "@/app/actions/member";
import { ActionButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HistoryItem, VerifiedCandidate } from "@/lib/ai/booking/schema";
import { formatDateTime, formatTime, spaceKindLabel, yen } from "@/lib/format";

type Turn = HistoryItem & { candidates?: VerifiedCandidate[] };

const EXAMPLES = [
  "明日の午後、渋谷で4人・2時間使える会議室",
  "あさっての朝9時から1時間、梅田で2人",
  "来週の月曜、大阪府で夕方に1時間",
];

export function BookingAssistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    const history: HistoryItem[] = turns.map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    startTransition(async () => {
      const result = await askBookingAssistant(history, message);
      if (!result.ok) {
        setError(result.error);
        // 失敗した入力は会話に残さず、入力欄に戻す（言い直せるように）
        setTurns((t) => t.slice(0, -1));
        setInput(message);
        return;
      }
      setRemaining(result.remainingToday);
      setTurns((t) => [...t, { role: "assistant", text: result.message, candidates: result.candidates }]);
    });
  };

  return (
    <div className="space-y-4">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <Button key={e} type="button" variant="outline" size="sm" onClick={() => send(e)} disabled={pending}>
              {e}
            </Button>
          ))}
        </div>
      )}

      <ol className="space-y-3" aria-live="polite">
        {turns.map((turn, i) => (
          <li key={i} className={turn.role === "user" ? "flex justify-end" : "space-y-2"}>
            <p
              className={
                turn.role === "user"
                  ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {turn.text}
            </p>
            {turn.candidates && turn.candidates.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {turn.candidates.map((c) => (
                  <CandidateCard key={`${c.space_id}-${c.starts_at}`} candidate={c} />
                ))}
              </div>
            )}
          </li>
        ))}
        {pending && <li className="text-sm text-muted-foreground">空きを調べています…</li>}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          条件
        </label>
        <textarea
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="例：明日の14時から1時間、梅田で4人"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pending}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {remaining !== null && `今日あと${remaining}回使えます。`}
            うまくいかないときは
            <Link href="/locations" className="underline">
              拠点を探す
            </Link>
            から予約できます。
          </span>
          <Button type="submit" disabled={pending || input.trim() === ""}>
            {pending ? "調べています…" : "送る"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CandidateCard({ candidate: c }: { candidate: VerifiedCandidate }) {
  const when = `${formatDateTime(c.starts_at)}〜${formatTime(c.ends_at)}`;
  return (
    <Card className="space-y-2 p-4">
      <div>
        <p className="font-medium">
          {c.location_name}・{c.space_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {spaceKindLabel[c.kind]}（{c.capacity}名まで）
        </p>
      </div>
      <p className="text-sm">{when}</p>
      <p className="text-sm">料金の目安：{yen(c.amount)}</p>
      <ActionButton
        action={createReservation.bind(null, { space_id: c.space_id, starts_at: c.starts_at, ends_at: c.ends_at })}
        confirm={{
          title: "この内容で予約しますか？",
          description: `${c.location_name}・${c.space_name}　${when}　${yen(c.amount)}`,
          actionLabel: "予約する",
        }}
        size="sm"
      >
        この内容で予約
      </ActionButton>
    </Card>
  );
}
