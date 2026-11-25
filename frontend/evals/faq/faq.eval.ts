// FAQ ボットの評価：評価データ（cases.json）を実際の Claude と手元の Rails で流し、正答率・引用・料金・応答時間を測る
//   npm run eval:faq                        全件
//   EVAL_ONLY=cancel-fee npm run eval:faq   1件だけ（カンマ区切りで複数）
//   EVAL_EFFORT=medium npm run eval:faq     考える深さを変えて比べる
// 結果：evals/faq/results/<日時>.json（コミットしない）と、evals/faq/RESULTS.md への1行（コミットする）
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { runFaqAssistant, type FaqAssistantResult } from "@/lib/ai/faq/assistant";
import type { LocationDetail, Plan } from "@/lib/types";

type Expect = {
  cite_any?: string[];
  include_any?: string[];
  must_not?: string;
  no_sources?: boolean;
  live?: "hours" | "plan_limit" | "drop_in_fee";
  location?: string;
  plan?: string;
  minutes?: number;
};
type Case = { id: string; category: string; input: string; expect: Expect };

const dataset = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as { cases: Case[] };
const origin = process.env.API_ORIGIN ?? "http://localhost:3001";
const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim());
const effort = (process.env.EVAL_EFFORT as "low" | "medium" | "high" | undefined) ?? "low";
const YEN_PER_USD = 155;

async function request<T>(path: string, init: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${origin}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `エラー（${res.status}）`);
  return data as T;
}

// 1日の回数の上限は会員ごとなので、実行ごとに評価用の会員を作る
async function signUp(): Promise<string> {
  const user = await request<{ token: string }>("/signup", {
    method: "POST",
    body: { user: { name: "評価用（FAQ）", email_address: `eval-faq-${Date.now()}@example.com`, password: "password123" } },
  }).catch(() => {
    throw new Error("評価用の会員を作れませんでした。docker compose up -d で Rails を起動してください");
  });
  return user.token;
}

const makeApi = (token: string) =>
  (<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) =>
    request<T>(path, { token, method, body })) as never;

const answerText = (r: FaqAssistantResult) => r.segments.map((s) => s.text).join("");
const numbersIn = (text: string) => [...text.matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)].map((m) => Number(m[0].replaceAll(",", "")));

/** 拠点・プランの値の正解（評価から同じ API を直接呼んで求める） */
async function liveNumbers(e: Expect, token: string): Promise<number[]> {
  if (e.live === "plan_limit") {
    const plan = (await request<Plan[]>("/plans", { token })).find((p) => p.name === e.plan);
    return [plan?.monthly_hours_limit ?? NaN];
  }
  const [found] = await request<{ id: number }[]>(`/locations?q=${encodeURIComponent(e.location ?? "")}`, { token });
  const loc = await request<LocationDetail & { hourly_price: number; daily_max_price: number }>(`/locations/${found.id}`, {
    token,
  });
  if (e.live === "hours") return [loc.open_hour, loc.close_hour];
  // ドロップインの料金：30分ごとに1時間の料金の半額、1回の上限あり（Location#drop_in_fee と同じ）
  const units = Math.max(Math.ceil((e.minutes ?? 0) / 30), 1);
  return [Math.min((loc.hourly_price * units) / 2, loc.daily_max_price)];
}

// 期待（expect）と結果を照らし合わせ、合わない点を返す（空なら正解）
async function grade(e: Expect, r: FaqAssistantResult, token: string): Promise<string[]> {
  const problems: string[] = [];
  const text = answerText(r);
  const cited = r.sources.map((s) => s.id);
  if (/@[\w.-]+\.\w+/.test(text)) problems.push("メールアドレスを書いている");
  if (e.cite_any && !e.cite_any.some((id) => cited.includes(id)))
    problems.push(`「${e.cite_any.join("」か「")}」を引用していない（引用：${cited.join("・") || "なし"}）`);
  if (e.include_any && !e.include_any.some((w) => text.includes(w)))
    problems.push(`答えに「${e.include_any.join("」か「")}」がない`);
  if (e.must_not && new RegExp(e.must_not).test(text)) problems.push(`答えに「${e.must_not}」がある`);
  if (e.no_sources && cited.length > 0) problems.push(`引用してはいけないのに引用している（${cited.join("・")}）`);
  if (e.live) {
    const expected = await liveNumbers(e, token);
    const found = numbersIn(text);
    const missing = expected.filter((n) => !found.includes(n));
    if (missing.length) problems.push(`答えに ${missing.join("・")} がない（API の値）`);
    if (r.calls.length === 0) problems.push("拠点・プランの API を呼んでいない");
  }
  return problems;
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

it("FAQ ボットの評価", async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("frontend/.env.local に ANTHROPIC_API_KEY を書いてください");
  const token = await signUp();
  const api = makeApi(token);
  const cases = dataset.cases.filter((c) => !only || only.includes(c.id));

  type Row = { id: string; category: string; pass: boolean; problems: string[]; cite_expected: boolean } & Partial<{
    cite_ok: boolean;
    answer: string;
    sources: string[];
    searches: FaqAssistantResult["searches"];
    calls: string[];
    cost_micro_usd: number;
    duration_ms: number;
    tool_calls: number;
    usage: FaqAssistantResult["run"]["usage"];
  }>;
  const rows: Row[] = [];
  for (const c of cases) {
    const citeExpected = Boolean(c.expect.cite_any);
    try {
      const r = await runFaqAssistant({ question: c.input, api, effort });
      const problems = await grade(c.expect, r, token);
      rows.push({
        id: c.id,
        category: c.category,
        pass: problems.length === 0,
        problems,
        cite_expected: citeExpected,
        cite_ok: citeExpected ? c.expect.cite_any!.some((id) => r.sources.some((s) => s.id === id)) : undefined,
        answer: answerText(r),
        sources: r.sources.map((s) => s.id),
        searches: r.searches,
        calls: r.calls,
        cost_micro_usd: r.run.costMicroUsd,
        duration_ms: r.run.durationMs,
        tool_calls: r.run.toolCalls,
        usage: r.run.usage,
      });
    } catch (e) {
      rows.push({
        id: c.id,
        category: c.category,
        pass: false,
        problems: [`例外：${(e as Error).message}`],
        cite_expected: citeExpected,
      });
    }
    const last = rows.at(-1)!;
    console.log(`${last.pass ? "○" : "×"} ${c.id}${last.pass ? "" : `：${last.problems.join(" / ")}`}`);
  }

  const done = rows.filter((r) => r.duration_ms !== undefined) as (Row &
    Required<Pick<Row, "duration_ms" | "cost_micro_usd" | "tool_calls" | "usage">>)[];
  const passed = rows.filter((r) => r.pass).length;
  const costUsd = done.reduce((s, r) => s + r.cost_micro_usd, 0) / 1e6;
  const latencies = done.map((r) => r.duration_ms);
  const byCategory = Object.fromEntries(
    [...new Set(rows.map((r) => r.category))].map((cat) => {
      const rs = rows.filter((r) => r.category === cat);
      return [cat, `${rs.filter((r) => r.pass).length}/${rs.length}`];
    }),
  );
  const citeRows = rows.filter((r) => r.cite_expected);
  const cacheRead = done.reduce((s, r) => s + r.usage.cache_read_input_tokens, 0);
  const inputAll = done.reduce(
    (s, r) => s + r.usage.input_tokens + r.usage.cache_read_input_tokens + r.usage.cache_creation_input_tokens,
    0,
  );
  const summary = {
    at: new Date().toISOString(),
    model: "claude-opus-5-5",
    effort,
    cases: rows.length,
    passed,
    accuracy: rows.length ? Math.round((passed / rows.length) * 1000) / 10 : 0,
    by_category: byCategory,
    citation: `${citeRows.filter((r) => r.cite_ok).length}/${citeRows.length}`,
    cost_usd_total: Math.round(costUsd * 10000) / 10000,
    cost_yen_per_case: done.length ? Math.round(((costUsd * YEN_PER_USD) / done.length) * 10) / 10 : 0,
    latency_ms_p50: percentile(latencies, 50),
    latency_ms_p90: percentile(latencies, 90),
    tool_calls_avg: done.length ? Math.round((done.reduce((s, r) => s + r.tool_calls, 0) / done.length) * 10) / 10 : 0,
    cache_read_ratio: inputAll ? Math.round((cacheRead / inputAll) * 1000) / 10 : 0,
  };
  console.log(summary);

  const dir = new URL("./results/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`${summary.at.replace(/[:.]/g, "-")}.json`, dir), JSON.stringify({ summary, rows }, null, 2));
  if (!only) {
    appendFileSync(
      new URL("./RESULTS.md", import.meta.url),
      `| ${summary.at.slice(0, 16).replace("T", " ")} | ${summary.effort} | ${summary.passed}/${summary.cases}（${summary.accuracy}%） | ${Object.entries(
        byCategory,
      )
        .map(([k, v]) => `${k} ${v}`)
        .join(
          "・",
        )} | ${summary.citation} | ${summary.cost_yen_per_case}円 | ${(summary.latency_ms_p50 / 1000).toFixed(1)}秒／${(summary.latency_ms_p90 / 1000).toFixed(1)}秒 | ${summary.tool_calls_avg} | ${summary.cache_read_ratio}% |  |\n`,
    );
  }
  expect(rows.length).toBeGreaterThan(0);
});
