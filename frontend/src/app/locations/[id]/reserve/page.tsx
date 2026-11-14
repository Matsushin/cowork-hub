import { notFound } from "next/navigation";
import { ReserveGrid } from "@/components/reserve/ReserveGrid";
import { ApiError } from "@/lib/api-error";
import { isValidDate, todayInTokyo } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { requireUser } from "@/lib/server/session";
import type { Availability, Location, Space } from "@/lib/types";

export default async function ReservePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const today = todayInTokyo();
  const { date: requested } = await searchParams;
  const date = isValidDate(requested) && requested >= today ? requested : today;

  // 拠点・スペース一覧・空き状況をサーバーで並行して取得する
  const [location, spaces, availability] = await Promise.all([
    apiFetch<Location>(`/locations/${id}`),
    apiFetch<Space[]>(`/locations/${id}/spaces`),
    apiFetch<Availability>(`/locations/${id}/spaces/availability?date=${date}`),
  ]).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });

  // 日付が変わったら選択状態をリセットするため key に日付を使う
  return (
    <ReserveGrid
      key={date}
      location={location}
      date={date}
      today={today}
      now={Date.now()}
      spaces={spaces}
      availability={availability}
    />
  );
}
