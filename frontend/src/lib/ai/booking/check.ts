// AI が出した候補を、API の値（拠点の詳細・空き状況）で確かめる。AI の言うことをそのまま画面に出さない
// 予約するときは Rails が同じことをもう一度確かめる（二重予約は行ロックで防ぐ）。ここは「出す候補を正しくする」ため
import type { Availability, LocationDetail } from "@/lib/types";
import type { ReplyCandidate, VerifiedCandidate } from "./schema";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const jstDate = (d: Date) => new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
const jstMinutes = (d: Date) => {
  const j = new Date(d.getTime() + JST_OFFSET_MS);
  return j.getUTCHours() * 60 + j.getUTCMinutes();
};

export type CheckResult = { ok: true; candidate: VerifiedCandidate } | { ok: false; reason: string };

export function checkCandidate(c: ReplyCandidate, location: LocationDetail, availability: Availability, now: Date): CheckResult {
  const startsAt = new Date(c.starts_at);
  const endsAt = new Date(c.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, reason: "日時の形が正しくない" };
  if (location.id !== c.location_id) return { ok: false, reason: "拠点が違う" };

  const space = location.spaces.find((s) => s.id === c.space_id);
  if (!space || !space.active) return { ok: false, reason: "その拠点にないスペース" };
  if (endsAt <= startsAt) return { ok: false, reason: "終了が開始より前" };
  if (startsAt <= now) return { ok: false, reason: "過去の時刻" };

  const date = jstDate(startsAt);
  if (date !== availability.date) return { ok: false, reason: "空き状況の日付と違う" };
  const startMin = jstMinutes(startsAt);
  // 終了が翌日の0:00（24時まで営業）なら 24*60 として扱う
  const endMin = jstDate(endsAt) === date ? jstMinutes(endsAt) : jstMinutes(endsAt) === 0 ? 24 * 60 : -1;
  if (endMin < 0) return { ok: false, reason: "日付をまたいでいる" };

  const slot = availability.slot_minutes;
  if (startMin % slot !== 0 || endMin % slot !== 0 || startsAt.getUTCSeconds() !== 0) {
    return { ok: false, reason: `${slot}分単位でない` };
  }
  if (startMin < location.open_hour * 60 || endMin > location.close_hour * 60) return { ok: false, reason: "営業時間外" };

  const overlapping = availability.reserved.some(
    (r) => r.space_id === space.id && startsAt < new Date(r.ends_at) && endsAt > new Date(r.starts_at),
  );
  if (overlapping) return { ok: false, reason: "予約済みの時間と重なる" };

  const hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
  return {
    ok: true,
    candidate: {
      location_id: location.id,
      location_name: location.name,
      space_id: space.id,
      space_name: space.name,
      kind: space.kind,
      capacity: space.capacity,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      // Rails の予約と同じ計算（スペースの1時間料金 × 時間、四捨五入）
      amount: Math.round(space.hourly_price * hours),
    },
  };
}
