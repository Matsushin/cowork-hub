import { describe, expect, it } from "vitest";
import { GENERATED_TOOLS } from "./generated-tools";
import { buildRequestPath, ToolInputError, type GeneratedTool } from "./tool-request";

const tool = (name: string): GeneratedTool => GENERATED_TOOLS.booking.find((t) => t.name === name)!;

describe("buildRequestPath", () => {
  it("パスの引数を埋め、/api を除いたパスにする", () => {
    expect(buildRequestPath(tool("get_location"), { id: 3 })).toBe("/locations/3");
  });

  it("クエリは指定されたものだけを付け、エンコードする", () => {
    expect(buildRequestPath(tool("search_locations"), { q: "渋谷 駅" })).toBe("/locations?q=%E6%B8%8B%E8%B0%B7+%E9%A7%85");
    expect(buildRequestPath(tool("search_locations"), {})).toBe("/locations");
  });

  it("日付の形を確かめる", () => {
    const t = tool("get_availability");
    expect(buildRequestPath(t, { location_id: 1, date: "2026-12-02" })).toBe("/locations/1/spaces/availability?date=2026-12-02");
    expect(() => buildRequestPath(t, { location_id: 1, date: "明日" })).toThrow(ToolInputError);
  });

  it("月の形（pattern）とまとめ方（enum）を確かめる", () => {
    const sales = GENERATED_TOOLS.analytics.find((t) => t.name === "get_sales")!;
    expect(buildRequestPath(sales, { month: "2026-10" })).toBe("/admin/sales?month=2026-10");
    expect(() => buildRequestPath(sales, { month: "先月" })).toThrow(ToolInputError);
    const usage = GENERATED_TOOLS.analytics.find((t) => t.name === "get_usage_stats")!;
    expect(() => buildRequestPath(usage, { from: "2026-10-01", to: "2026-10-31", group_by: "user" })).toThrow(ToolInputError);
  });

  it("id に整数以外を入れてパスを書き換えられない", () => {
    const t = tool("get_location");
    for (const id of ["1/../../admin/users", "../me", -1, 1.5, "abc"]) {
      expect(() => buildRequestPath(t, { id })).toThrow(ToolInputError);
    }
  });

  it("必須の引数がない・知らない引数があるときは失敗する", () => {
    expect(() => buildRequestPath(tool("get_location"), {})).toThrow("id を指定してください");
    expect(() => buildRequestPath(tool("search_locations"), { user_id: 1 })).toThrow("user_id という引数はありません");
  });
});
