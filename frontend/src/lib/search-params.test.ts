import { describe, expect, it } from "vitest";
import {
  loadCheckinParams,
  serializeCheckin,
  loadDateParams,
  loadMonthParams,
  loadReservationFilterParams,
  serializeMonth,
  serializeReservationFilter,
} from "./search-params";

describe("search-params", () => {
  it("正しい形式の日付・月だけを受け取り、不正な値は null にする", async () => {
    expect((await loadDateParams({ date: "2026-11-20" })).date).toBe("2026-11-20");
    expect((await loadDateParams({ date: "2026/11/20" })).date).toBeNull();
    expect((await loadMonthParams({ month: "2026-11" })).month).toBe("2026-11");
    expect((await loadMonthParams({ month: "2026-13" })).month).toBeNull();
    expect((await loadMonthParams({})).month).toBeNull();
  });

  it("予約一覧の表示切り替えは決まった値だけ受け取り、それ以外は既定（今後の予約）にする", async () => {
    expect((await loadReservationFilterParams({ filter: "all" })).filter).toBe("all");
    expect((await loadReservationFilterParams({ filter: "unknown" })).filter).toBe("upcoming");
  });

  it("QRチェックインのURLを組み立て、読み取る（拠点IDが数値でなければ null）", async () => {
    const url = serializeCheckin("http://localhost:3000/checkin", { location: 3, code: "3f2a9c0d1b7e4a56" });
    expect(url).toBe("http://localhost:3000/checkin?location=3&code=3f2a9c0d1b7e4a56");
    expect(await loadCheckinParams({ location: "3", code: "3f2a9c0d1b7e4a56" })).toEqual({
      location: 3,
      code: "3f2a9c0d1b7e4a56",
    });
    expect(await loadCheckinParams({ location: "abc" })).toEqual({ location: null, code: "" });
  });

  it("リンクを組み立てる（既定値はURLに載せない）", () => {
    expect(serializeMonth("/billing", { month: "2026-10" })).toBe("/billing?month=2026-10");
    expect(serializeReservationFilter("/reservations", { filter: "all" })).toBe("/reservations?filter=all");
    expect(serializeReservationFilter("/reservations", { filter: "upcoming" })).toBe("/reservations");
  });
});
