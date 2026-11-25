"use client";

import { useState, useTransition } from "react";
import { askFaq } from "@/app/actions/faq";
import { Button } from "@/components/ui/button";
import type { FaqResult } from "@/lib/ai/faq/schema";

type Answer = Extract<FaqResult, { ok: true }> & { question: string };

const EXAMPLES = ["予約を取り消すと料金はかかる？", "チェックアウトし忘れたらどうなる？", "月額プランでもドロップインは有料？"];

export function FaqBot() {
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
      const result = await askFaq(question);
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
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="faq-input" className="sr-only">
          質問
        </label>
        <input
          id="faq-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          placeholder="例：予約は何日前まで取り消せる？"
          className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || input.trim() === ""}>
          {pending ? "調べています…" : "質問する"}
        </Button>
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
      {pending && <p className="text-sm text-muted-foreground">ご利用ルールを調べています…</p>}

      <ol className="space-y-3" aria-live="polite">
        {answers.map((a, i) => (
          <li key={answers.length - i} className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Q. {a.question}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {a.segments.map((s, j) => (
                <span key={j}>
                  {s.text}
                  {s.sourceIds.map((id) => {
                    const n = a.sources.findIndex((src) => src.id === id) + 1;
                    return (
                      <sup key={id}>
                        <a href={`#${id}`} className="text-primary underline" aria-label={`根拠 ${n}`}>
                          [{n}]
                        </a>
                      </sup>
                    );
                  })}
                </span>
              ))}
            </p>
            {a.sources.length > 0 ? (
              <ol className="space-y-0.5 text-xs text-muted-foreground">
                {a.sources.map((s, j) => (
                  <li key={s.id}>
                    [{j + 1}]{" "}
                    <a href={`#${s.id}`} className="underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              !a.grounded && (
                <p className="text-xs text-muted-foreground">
                  この答えはご利用ルールにもとづいていません。分からないことはスタッフにお問い合わせください。
                </p>
              )
            )}
          </li>
        ))}
      </ol>
      {remaining !== null && <p className="text-xs text-muted-foreground">今日あと{remaining}回使えます。</p>}
    </div>
  );
}
