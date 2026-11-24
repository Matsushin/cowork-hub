// 予約アシスタントの評価：評価データ（cases.json）を実際の Claude と手元の Rails で流し、正答率・料金・応答時間を測る
//   npm run eval:booking            全件
//   EVAL_ONLY=basic-umeda-morning npm run eval:booking   1件だけ（カンマ区切りで複数）
//   EVAL_EFFORT=medium npm run eval:booking               考える深さを変えて比べる
// 結果：evals/booking/results/<日時>.json（コミットしない）と、evals/booking/RESULTS.md への1行（コミットする）
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { runBookingAssistant, type BookingAssistantResult } from "@/lib/ai/booking/assistant";
import type { Location } from "@/lib/types";

type Expect = {
  type: "candidates" | "clarify" | "no_candidates" | "refuse" | "alternatives";
  location?: string;
  location_any?: string[];
  prefecture?: string;
  prefecture_any?: string[];
  kind?: "seat" | "meeting_room";
  min_capacity?: number;
  date?: string;
  starts_at?: string;
  window?: [string, string];
  duration_minutes?: number;
  must_not_claim_booked?: boolean;
  reason?: string;
  message_includes?: string;
};
type Case = { id: string; category: string; input: string; expect: Expect };

const dataset = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as { now: string; cases: Case[] };
const origin = process.env.API_ORIGIN ?? "http://localhost:3001";
const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim());
const effort = (process.env.EVAL_EFFORT as "low" | "medium" | "high" | undefined) ?? "low";
const YEN_PER_USD = 155; // 料金の円換算の目安

// 評価用の会員でログインした状態で Rails API を呼ぶ（会員ごとの1日の上限があるので、実行ごとに会員を作る）
async function signUp(): Promise<string> {
  const res = await fetch(`${origin}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: { name: "評価用", email_address: `eval-${Date.now()}@example.com`, password: "password123" } }),
  });
  if (!res.ok)
    throw new Error(`評価用の会員を作れませんでした（${res.status}）。docker compose up -d で Rails を起動してください`);
  return ((await res.json()) as { token: string }).token;
}

function makeApi(token: string) {
  return async function api<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? `エラー（${res.status}）`);
    return data as T;
  };
}

const jst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString();
const jstDate = (iso: string) => jst(iso).slice(0, 10);
const jstTime = (iso: string) => jst(iso).slice(11, 16);
const BOOKED_WORDS = /予約しました|確保しました|予約が完了|予約を確定しました|確定しました/;

// 期待（expect）と結果を照らし合わせ、合わない点を返す（空なら正解）
function grade(e: Expect, r: BookingAssistantResult, prefectureOf: Map<string, string>): string[] {
  const problems: string[] = [];
  // 希望どおりには予約できない：理由を伝え、代わりの候補を出す（または候補なし）なら正解
  if (e.type === "alternatives") {
    if (r.kind !== "candidates" && r.kind !== "no_candidates") problems.push(`種類が ${r.kind}（期待は候補か候補なし）`);
    if (e.message_includes && !r.message.includes(e.message_includes)) problems.push(`返事に「${e.message_includes}」がない`);
  } else if (r.kind !== e.type) problems.push(`種類が ${r.kind}（期待は ${e.type}）`);
  if (e.message_includes && e.type !== "alternatives" && !r.message.includes(e.message_includes))
    problems.push(`返事に「${e.message_includes}」がない`);
  if (BOOKED_WORDS.test(r.message)) problems.push("予約したと書いている");
  if (e.type !== "candidates" && e.type !== "alternatives") {
    if (r.candidates.length > 0) problems.push("候補を出している");
    return problems;
  }
  if (e.type === "candidates" && r.candidates.length === 0) problems.push("候補がない");
  for (const c of r.candidates) {
    const where = `${c.location_name}・${c.space_name} ${jstDate(c.starts_at)} ${jstTime(c.starts_at)}-${jstTime(c.ends_at)}`;
    const pref = prefectureOf.get(c.location_name);
    if (e.location && c.location_name !== e.location) problems.push(`${where}：拠点が違う`);
    if (e.location_any && !e.location_any.includes(c.location_name)) problems.push(`${where}：拠点が違う`);
    if (e.prefecture && pref !== e.prefecture) problems.push(`${where}：都道府県が違う`);
    if (e.prefecture_any && !e.prefecture_any.includes(pref ?? "")) problems.push(`${where}：都道府県が違う`);
    if (e.kind && c.kind !== e.kind) problems.push(`${where}：種別が違う`);
    if (e.min_capacity && c.capacity < e.min_capacity) problems.push(`${where}：定員が足りない`);
    if (e.date && jstDate(c.starts_at) !== e.date) problems.push(`${where}：日付が違う`);
    if (e.starts_at && jstTime(c.starts_at) !== e.starts_at) problems.push(`${where}：開始が違う`);
    if (e.window && (jstTime(c.starts_at) < e.window[0] || jstTime(c.ends_at) > e.window[1]))
      problems.push(`${where}：時間帯の外`);
    const minutes = (new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000;
    if (e.duration_minutes && minutes !== e.duration_minutes) problems.push(`${where}：長さが ${minutes}分`);
  }
  return problems;
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

it("予約アシスタントの評価", async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("frontend/.env.local に ANTHROPIC_API_KEY を書いてください");
  const api = makeApi(await signUp());
  const prefectureOf = new Map((await api<Location[]>("/locations")).map((l) => [l.name, l.prefecture]));
  const cases = dataset.cases.filter((c) => !only || only.includes(c.id));
  const now = new Date(dataset.now);

  type Row = { id: string; category: string; pass: boolean; problems: string[] } & Partial<{
    kind: string;
    message: string;
    candidates: unknown[];
    rejected: unknown[];
    cost_micro_usd: number;
    duration_ms: number;
    tool_calls: number;
    usage: BookingAssistantResult["run"]["usage"];
  }>;
  const rows: Row[] = [];
  for (const c of cases) {
    try {
      const r = await runBookingAssistant({ history: [], message: c.input, now, api: api as never, effort });
      const problems = grade(c.expect, r, prefectureOf);
      rows.push({
        id: c.id,
        category: c.category,
        pass: problems.length === 0,
        problems,
        kind: r.kind,
        message: r.message,
        candidates: r.candidates,
        rejected: r.rejected,
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
    cost_usd_total: Math.round(costUsd * 10000) / 10000,
    cost_yen_per_case: done.length ? Math.round(((costUsd * YEN_PER_USD) / done.length) * 10) / 10 : 0,
    latency_ms_p50: percentile(latencies, 50),
    latency_ms_p90: percentile(latencies, 90),
    tool_calls_avg: done.length ? Math.round((done.reduce((s, r) => s + r.tool_calls, 0) / done.length) * 10) / 10 : 0,
    rejected_candidates: done.reduce((s, r) => s + r.rejected.length, 0),
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
        )} | ${summary.cost_yen_per_case}円 | ${(summary.latency_ms_p50 / 1000).toFixed(1)}秒／${(summary.latency_ms_p90 / 1000).toFixed(1)}秒 | ${summary.tool_calls_avg} | ${summary.rejected_candidates} | ${summary.cache_read_ratio}% |  |\n`,
    );
  }
  expect(rows.length).toBeGreaterThan(0);
});
