import { describe, expect, it } from "vitest";
import type { Availability, LocationDetail } from "@/lib/types";
import { checkCandidate } from "./check";

const location = {
  id: 3,
  name: "渋谷",
  prefecture: "東京都",
  address: "渋谷区",
  description: null,
  open_hour: 7,
  close_hour: 23,
  hourly_price: 500,
  daily_max_price: 2500,
  active: true,
  spaces: [
    { id: 11, name: "会議室（4名）", kind: "meeting_room", capacity: 4, hourly_price: 1000, active: true, location_id: 3 },
    { id: 12, name: "会議室（8名）", kind: "meeting_room", capacity: 8, hourly_price: 2000, active: false, location_id: 3 },
  ],
} as LocationDetail;
const availability: Availability = {
  date: "2026-12-02",
  open_hour: 7,
  close_hour: 23,
  slot_minutes: 30,
  reserved: [{ space_id: 11, starts_at: "2026-12-02T13:00:00+09:00", ends_at: "2026-12-02T14:00:00+09:00", mine: false }],
};
const now = new Date("2026-12-01T10:00:00+09:00");
const candidate = (starts: string, ends: string, overrides = {}) => ({
  location_id: 3,
  space_id: 11,
  starts_at: `2026-12-02T${starts}:00+09:00`,
  ends_at: `2026-12-02T${ends}:00+09:00`,
  ...overrides,
});

describe("checkCandidate", () => {
  it("条件を満たす候補に、拠点・スペースの名前と料金（API の値）を付ける", () => {
    const result = checkCandidate(candidate("14:00", "16:00"), location, availability, now);
    expect(result).toEqual({
      ok: true,
      candidate: expect.objectContaining({ location_name: "渋谷", space_name: "会議室（4名）", capacity: 4, amount: 2000 }),
    });
  });

  it.each([
    ["予約済みと重なる", candidate("13:30", "14:30"), "予約済みの時間と重なる"],
    ["営業時間前", candidate("06:30", "07:30"), "営業時間外"],
    ["閉店を過ぎる", candidate("22:30", "23:30"), "営業時間外"],
    ["30分単位でない", candidate("14:15", "15:15"), "30分単位でない"],
    ["終了が開始より前", candidate("15:00", "14:00"), "終了が開始より前"],
    ["その拠点にないスペース", candidate("15:00", "16:00", { space_id: 99 }), "その拠点にないスペース"],
    ["停止中のスペース", candidate("15:00", "16:00", { space_id: 12 }), "その拠点にないスペース"],
    ["拠点が違う", candidate("15:00", "16:00", { location_id: 4 }), "拠点が違う"],
    ["日時の形が正しくない", candidate("15:00", "16:00", { starts_at: "明日の15時" }), "日時の形が正しくない"],
  ])("%s なら外す", (_label, c, reason) => {
    expect(checkCandidate(c, location, availability, now)).toEqual({ ok: false, reason });
  });

  it("ちょうど隣り合う時間（予約の終わり＝候補の始まり）は重ならない", () => {
    expect(checkCandidate(candidate("14:00", "15:00"), location, availability, now).ok).toBe(true);
    expect(checkCandidate(candidate("12:00", "13:00"), location, availability, now).ok).toBe(true);
  });

  it("過去の時刻は外す", () => {
    expect(checkCandidate(candidate("14:00", "15:00"), location, availability, new Date("2026-12-02T14:30:00+09:00"))).toEqual({
      ok: false,
      reason: "過去の時刻",
    });
  });
});
