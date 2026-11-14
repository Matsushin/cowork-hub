"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/api-error";
import { success, tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";

export async function checkIn(locationId: number): Promise<ActionState> {
  const result = await tryApi(() =>
    apiFetch("/visits", {
      method: "POST",
      body: { visit: { location_id: locationId } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/", "layout"); // ヘッダーの「利用中」表示も更新する
  redirect("/visits");
}

export async function checkOut(visitId: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/visits/${visitId}/checkout`, { method: "PATCH" }));
  if (!result.ok) return result.state;
  revalidatePath("/", "layout");
  return success();
}

export async function createReservation(input: { space_id: number; starts_at: string; ends_at: string }): Promise<ActionState> {
  const result = await tryApi(() => apiFetch("/reservations", { method: "POST", body: { reservation: input } }));
  if (!result.ok) return result.state;
  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function cancelReservation(id: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/reservations/${id}/cancel`, { method: "PATCH" }));
  if (!result.ok) return result.state;
  revalidatePath("/reservations");
  return success();
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const result = await tryApi(() =>
    apiFetch("/me", {
      method: "PATCH",
      body: {
        user: {
          name: formData.get("name"),
          email_address: formData.get("email_address"),
          ...(password ? { password } : {}),
        },
      },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/", "layout"); // ヘッダーの名前も更新する
  return success("保存しました");
}
