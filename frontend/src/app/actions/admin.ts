"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/api-error";
import { success, tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";

// 権限チェックはRails側（Admin::BaseController）で行う

export async function updateUser(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = formData.get("plan_id");
  const result = await tryApi(() =>
    apiFetch(`/admin/users/${id}`, {
      method: "PATCH",
      body: { user: { role: formData.get("role"), ...(planId ? { plan_id: planId } : {}) } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  return success("保存しました");
}

export async function createSpace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await tryApi(() =>
    apiFetch("/admin/spaces", {
      method: "POST",
      body: { space: { name: formData.get("name"), kind: formData.get("kind"), capacity: formData.get("capacity") } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success();
}

export async function setSpaceActive(id: number, active: boolean): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/admin/spaces/${id}`, { method: "PATCH", body: { space: { active } } }));
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success();
}

export async function deleteSpace(id: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/admin/spaces/${id}`, { method: "DELETE" }));
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success();
}
