import { ReserveGrid } from "@/components/reserve/ReserveGrid";
import { isValidDate, todayInTokyo } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { Availability, Space } from "@/lib/types";

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireUser();
  const today = todayInTokyo();
  const { date: requested } = await searchParams;
  const date = isValidDate(requested) && requested >= today ? requested : today;

  // スペース一覧と空き状況をサーバーで並行して取得する
  const [spaces, availability] = await Promise.all([
    apiFetch<Space[]>("/spaces"),
    apiFetch<Availability>(`/spaces/availability?date=${date}`),
  ]);

  // 日付が変わったら選択状態をリセットするため key に日付を使う
  return <ReserveGrid key={date} date={date} today={today} now={Date.now()} spaces={spaces} availability={availability} />;
}
