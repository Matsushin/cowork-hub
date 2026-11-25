"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { askAnalyticsAssistant } from "@/app/actions/analytics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AnalyticsResult, CheckedFigure } from "@/lib/ai/analytics/schema";

type Answer = Extract<AnalyticsResult, { ok: true }> & { question: string };

const EXAMPLES = [
  "先月いちばん売上が高かった拠点は？",
  "先月の会議室の稼働率を拠点ごとに教えて",
  "先月は何曜日の予約が多かった？",
  "今月の新しい会員は何人？",
];

function formatFigure(f: CheckedFigure): string {
  const n = f.value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return f.unit === "円" ? `${n}円` : f.unit === "%" ? `${n}%` : `${n}${f.unit}`;
}

export function AnalyticsAssistant() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    setError(null);
    setInput("");
    startTransition(async () => {
      const result = await askAnalyticsAssistant(question);
      if (!result.ok) {
        setError(result.error);
        setInput(question);
        return;
      }
      setRemaining(result.remainingToday);
      setAnswers((a) => [{ ...result, question }, ...a]);
    });
  };

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="analytics-input" className="sr-only">
          質問
        </label>
        <textarea
          id="analytics-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="例：先月と今月で、渋谷の会議室の稼働率はどう変わった？"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pending}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{remaining !== null && `今日あと${remaining}回使えます。`}</span>
          <Button type="submit" disabled={pending || input.trim() === ""}>
            {pending ? "集計しています…" : "質問する"}
          </Button>
        </div>
      </form>

      {answers.length === 0 && !pending && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <Button key={e} type="button" variant="outline" size="sm" onClick={() => ask(e)}>
              {e}
            </Button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {pending && <p className="text-sm text-muted-foreground">集計しています…（20秒ほどかかります）</p>}

      <ol className="space-y-4" aria-live="polite">
        {answers.map((a, i) => (
          <li key={answers.length - i}>
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium">Q. {a.question}</p>
              <p className="text-sm whitespace-pre-wrap">{a.message}</p>
              {a.figures.length > 0 && (
                <dl className="grid gap-2 sm:grid-cols-3">
                  {a.figures.map((f, j) => (
                    <div key={j} className="rounded-md border border-border p-3">
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="text-lg font-semibold">{formatFigure(f)}</dd>
                      <dd className={`text-xs ${f.verified ? "text-muted-foreground" : "text-destructive"}`}>
                        {f.verified ? "✓ 集計の結果と一致" : "⚠ 集計の結果と照らし合わせられません"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {a.unverifiedInMessage.length > 0 && (
                <p className="text-xs text-destructive">
                  ⚠ 文中の数字（{a.unverifiedInMessage.join("・")}
                  ）は集計の結果と照らし合わせられませんでした。「売上」の画面などで確かめてください。
                </p>
              )}
              {a.sources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  使ったデータ：
                  {a.sources.map((s, j) => (
                    <span key={s.label}>
                      {j > 0 && "、"}
                      {s.href ? (
                        <Link href={s.href} className="underline">
                          {s.label}
                        </Link>
                      ) : (
                        s.label
                      )}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
