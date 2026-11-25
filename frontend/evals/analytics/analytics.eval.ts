// 分析アシスタントの評価：評価データ（cases.json）を実際の Claude と手元の Rails（seed のデモデータ）で流し、
// 正答率・照らし合わせられない数字・料金・応答時間を測る
//   npm run eval:analytics                         全件
//   EVAL_ONLY=busiest-weekday npm run eval:analytics   1件だけ（カンマ区切りで複数）
//   EVAL_EFFORT=medium npm run eval:analytics          考える深さを変えて比べる
// 正解は、同じ集計の API を評価から直接呼んで求める（データが変わっても期待を書き直さなくてよい）
// 結果：evals/analytics/results/<日時>.json（コミットしない）と、evals/analytics/RESULTS.md への1行（コミットする）
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { runAnalyticsAssistant, type AnalyticsAssistantResult } from "@/lib/ai/analytics/assistant";
import { extractNumbers } from "@/lib/ai/analytics/verify";

type ValueSpec = { path: string; field: string; row?: string };
type Expect =
  | { type: "top"; path: string; rows: string; label: string; field: string; order: "max" | "min" }
  | { type: "value"; values: ValueSpec[] }
  | { type: "clarify" }
  | { type: "no_data" }
  | { type: "refuse" };
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

// 1日の回数の上限は会員ごとなので、実行ごとに評価用の管理者を作る（seed の管理者で会員を作り、管理者にする）
async function evalAdminToken(): Promise<string> {
  const seedAdmin = await request<{ token: string }>("/session", {
    method: "POST",
    body: { email_address: "admin@example.com", password: "password123" },
  }).catch(() => {
    throw new Error("seed の管理者でログインできません。docker compose up -d と bin/rails db:seed を確かめてください");
  });
  const user = await request<{ token: string; user: { id: number } }>("/signup", {
    method: "POST",
    body: {
      user: { name: "評価用（分析）", email_address: `eval-analytics-${Date.now()}@example.com`, password: "password123" },
    },
  });
  await request(`/admin/users/${user.user.id}`, { token: seedAdmin.token, method: "PATCH", body: { user: { role: "admin" } } });
  return user.token;
}

const makeApi = (token: string) =>
  (<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) =>
    request<T>(path, { token, method, body })) as never;

/** {last_month} などを、実行した日（日本時間）から決める */
function placeholders(now: Date): Record<string, string> {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = (back: number) => {
    const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() - back, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { month: `${y}-${pad(m)}`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
  };
  const [t, l, p] = [month(0), month(1), month(2)];
  return {
    this_month: t.month,
    this_from: t.from,
    this_to: jst.toISOString().slice(0, 10),
    last_month: l.month,
    last_from: l.from,
    last_to: l.to,
    prev_month: p.month,
    prev_from: p.from,
    prev_to: p.to,
  };
}

const fill = (path: string, vars: Record<string, string>) => path.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
const dig = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
const near = (a: number, b: number) => a === b || Math.round(b) === a || Math.round(b * 10) / 10 === a;

/** 答えに出てきた数字（figures と文の中） */
function answeredNumbers(r: AnalyticsAssistantResult): number[] {
  return [...r.figures.map((f) => f.value), ...extractNumbers(r.message).map((n) => n.value)];
}

// 期待（expect）と結果を照らし合わせ、合わない点を返す（空なら正解）
async function grade(e: Expect, r: AnalyticsAssistantResult, admin: string, vars: Record<string, string>): Promise<string[]> {
  const problems: string[] = [];
  if (/@[\w.-]+\.\w+/.test(r.message)) problems.push("メールアドレスを書いている");
  if (e.type === "clarify" || e.type === "refuse") {
    if (r.kind !== e.type) problems.push(`種類が ${r.kind}（期待は ${e.type}）`);
    return problems;
  }
  if (e.type === "no_data") {
    // データがない月：no_data か、「ない」「0円」と答えれば正解
    if (r.kind !== "no_data" && !(r.kind === "answer" && /ない|ありません|0円/.test(r.message)))
      problems.push(`種類が ${r.kind}（期待はデータなし）`);
    return problems;
  }

  if (r.kind !== "answer") problems.push(`種類が ${r.kind}（期待は answer）`);
  const unverified = [...r.figures.filter((f) => !f.verified).map((f) => `${f.label}=${f.value}`), ...r.unverifiedInMessage];
  if (unverified.length > 0) problems.push(`照らし合わせられない数字：${unverified.join("・")}`);

  if (e.type === "top") {
    const data = await request<unknown>(fill(e.path, vars), { token: admin });
    const rows = (dig(data, e.rows) as unknown[]).filter((row) => typeof dig(row, e.field) === "number");
    const values = rows.map((row) => dig(row, e.field) as number);
    const best = e.order === "max" ? Math.max(...values) : Math.min(...values);
    // 同じ値が並んだらどれでもよい。「水曜日」は「水曜」と書いても正解
    const labels = rows.filter((row) => dig(row, e.field) === best).map((row) => String(dig(row, e.label)));
    if (!labels.some((label) => r.message.includes(label.replace(/日$/, ""))))
      problems.push(`答えに「${labels.join("」か「")}」がない（${e.field}=${best}）`);
  } else {
    const numbers = answeredNumbers(r);
    for (const v of e.values) {
      const data = await request<unknown>(fill(v.path, vars), { token: admin });
      const target = v.row ? (dig(data, "rows") as unknown[]).find((row) => dig(row, "label") === v.row) : data;
      const expected = dig(target, v.field);
      if (typeof expected !== "number") problems.push(`正解の値を取れない（${v.path} ${v.field}）`);
      else if (!numbers.some((n) => near(n, expected))) problems.push(`答えに ${expected} がない（${v.row ?? ""}${v.field}）`);
    }
  }
  return problems;
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

it("分析アシスタントの評価", async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("frontend/.env.local に ANTHROPIC_API_KEY を書いてください");
  const admin = await evalAdminToken();
  const api = makeApi(admin);
  const now = new Date();
  const vars = placeholders(now);
  const cases = dataset.cases.filter((c) => !only || only.includes(c.id));

  type Row = { id: string; category: string; pass: boolean; problems: string[] } & Partial<{
    kind: string;
    message: string;
    figures: unknown[];
    unverified: number;
    calls: string[];
    cost_micro_usd: number;
    duration_ms: number;
    tool_calls: number;
    usage: AnalyticsAssistantResult["run"]["usage"];
  }>;
  const rows: Row[] = [];
  for (const c of cases) {
    try {
      const r = await runAnalyticsAssistant({ question: c.input, now, api, effort });
      const problems = await grade(c.expect, r, admin, vars);
      rows.push({
        id: c.id,
        category: c.category,
        pass: problems.length === 0,
        problems,
        kind: r.kind,
        message: r.message,
        figures: r.figures,
        unverified: r.figures.filter((f) => !f.verified).length + r.unverifiedInMessage.length,
        calls: r.calls,
        cost_micro_usd: r.run.costMicroUsd,
        duration_ms: r.run.durationMs,
        tool_calls: r.run.toolCalls,
        usage: r.run.usage,
      });
    } catch (e) {
      rows.push({ id: c.id, category: c.category, pass: false, problems: [`例外：${(e as Error).message}`] });
    }
    const last = rows.at(-1)!;
    console.log(`${last.pass ? "○" : "×"} ${c.id}${last.pass ? "" : `：${last.problems.join(" / ")}`}`);
  }

  const done = rows.filter((r): r is Required<Row> => r.duration_ms !== undefined);
  const passed = rows.filter((r) => r.pass).length;
  const costUsd = done.reduce((s, r) => s + r.cost_micro_usd, 0) / 1e6;
  const latencies = done.map((r) => r.duration_ms);
  const byCategory = Object.fromEntries(
    [...new Set(rows.map((r) => r.category))].map((cat) => {
      const rs = rows.filter((r) => r.category === cat);
      return [cat, `${rs.filter((r) => r.pass).length}/${rs.length}`];
    }),
  );
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
    unverified_numbers: done.reduce((s, r) => s + r.unverified, 0),
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
  writeFileSync(new URL(`${summary.at.replace(/[:.]/g, "-")}.json`, dir), JSON.stringify({ summary, vars, rows }, null, 2));
  if (!only) {
    appendFileSync(
      new URL("./RESULTS.md", import.meta.url),
      `| ${summary.at.slice(0, 16).replace("T", " ")} | ${summary.effort} | ${summary.passed}/${summary.cases}（${summary.accuracy}%） | ${Object.entries(
        byCategory,
      )
        .map(([k, v]) => `${k} ${v}`)
        .join(
          "・",
        )} | ${summary.unverified_numbers} | ${summary.cost_yen_per_case}円 | ${(summary.latency_ms_p50 / 1000).toFixed(1)}秒／${(summary.latency_ms_p90 / 1000).toFixed(1)}秒 | ${summary.tool_calls_avg} | ${summary.cache_read_ratio}% |  |\n`,
    );
  }
  expect(rows.length).toBeGreaterThan(0);
});
