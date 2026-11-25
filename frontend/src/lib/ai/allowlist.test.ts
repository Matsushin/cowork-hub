import { describe, expect, it } from "vitest";
import allowlist from "./allowlist.json";
import { GENERATED_TOOLS } from "./generated-tools";

// AI に渡す道具の約束（docs/ai/02_AIに渡す操作.md）を、生成された定義で確かめる
describe("AI に渡す道具", () => {
  const all = Object.values(GENERATED_TOOLS).flat();

  it("読み取り（GET）だけ", () => {
    expect(all.every((t) => t.method === "GET")).toBe(true);
  });

  it("会員向け（予約）には、管理 API・会員情報・予約の操作を渡さない", () => {
    const paths = GENERATED_TOOLS.booking.map((t) => t.path);
    expect(paths.some((p) => p.startsWith("/api/admin"))).toBe(false);
    expect(paths).not.toContain("/api/me");
    expect(paths).not.toContain("/api/reservations");
    expect(paths).not.toContain("/api/session");
  });

  it("管理者向け（分析）には、集計した数字だけを返す操作を渡す（個人の情報を返す管理 API は渡さない）", () => {
    const paths = GENERATED_TOOLS.analytics.map((t) => t.path);
    const admin = paths.filter((p) => p.startsWith("/api/admin"));
    expect(admin.sort()).toEqual(["/api/admin/sales", "/api/admin/stats/members", "/api/admin/stats/usage"]);
    expect(paths).not.toContain("/api/me");
  });

  it("許可リストと生成された定義が一致する（npm run gen:api の実行漏れがない）", () => {
    for (const [feature, entries] of Object.entries(allowlist).filter(([k]) => !k.startsWith("$"))) {
      const generated = GENERATED_TOOLS[feature as keyof typeof GENERATED_TOOLS];
      expect(generated.map((t) => `${t.method} ${t.path} ${t.name}`)).toEqual(
        (entries as { method: string; path: string; name: string }[]).map((e) => `${e.method} ${e.path} ${e.name}`),
      );
    }
  });

  it("名前が重ならず、知らない引数を受け付けない", () => {
    for (const tools of Object.values(GENERATED_TOOLS)) {
      expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
    }
    expect(all.every((t) => t.inputSchema.additionalProperties === false)).toBe(true);
  });
});
