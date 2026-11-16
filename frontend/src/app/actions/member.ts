"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/api-error";
import { checkinSchema, profileSchema, reservationSchema } from "@/lib/schemas";
import { parseInput, success, tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";

/** 受付のQRコード（/checkin の確認画面）からチェックインする */
export async function checkIn(locationId: number, code: string): Promise<ActionState> {
  const input = parseInput(checkinSchema, { location_id: locationId, code });
  if (!input.ok) return input.state;
  const result = await tryApi(() => apiFetch("/visits", { method: "POST", body: { visit: input.data } }));
  if (!result.ok) return result.state;
  revalidatePath("/", "layout"); // ヘッダーの「利用中」表示も更新する
  redirect("/visits");
}

export async function checkOut(visitId: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/visits/${visitId}/checkout`, { method: "PATCH" }));
  if (!result.ok) return result.state;
  revalidatePath("/", "layout");
  return success("チェックアウトしました");
}

export async function createReservation(params: { space_id: number; starts_at: string; ends_at: string }): Promise<ActionState> {
  const input = parseInput(reservationSchema, params);
  if (!input.ok) return { ...input.state, message: "予約内容が正しくありません。枠を選び直してください。" };
  const result = await tryApi(() => apiFetch("/reservations", { method: "POST", body: { reservation: input.data } }));
  if (!result.ok) return result.state;
  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function cancelReservation(id: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/reservations/${id}/cancel`, { method: "PATCH" }));
  if (!result.ok) return result.state;
  revalidatePath("/reservations");
  return success("予約をキャンセルしました");
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(profileSchema, formData);
  if (!input.ok) return input.state;
  const { password, ...rest } = input.data;
  const result = await tryApi(() =>
    apiFetch("/me", {
      method: "PATCH",
      body: { user: { ...rest, ...(password ? { password } : {}) } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/", "layout"); // ヘッダーの名前も更新する
  return success("保存しました");
}
