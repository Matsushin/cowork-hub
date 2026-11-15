"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/api-error";
import { adminUserSchema, locationSchema, spaceSchema } from "@/lib/schemas";
import { parseInput, success, tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";

// 権限チェックはRails側（Admin::BaseController）で行う

export async function updateUser(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(adminUserSchema, formData);
  if (!input.ok) return input.state;
  const { role, plan_id } = input.data;
  const result = await tryApi(() =>
    apiFetch(`/admin/users/${id}`, {
      method: "PATCH",
      body: { user: { role, ...(plan_id ? { plan_id } : {}) } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
  return success("保存しました");
}

export async function createLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(locationSchema, formData);
  if (!input.ok) return input.state;
  const result = await tryApi(() => apiFetch("/admin/locations", { method: "POST", body: { location: input.data } }));
  if (!result.ok) return result.state;
  revalidatePath("/admin/locations");
  return success("拠点を追加しました");
}

export async function setLocationActive(id: number, active: boolean): Promise<ActionState> {
  const result = await tryApi(() =>
    apiFetch(`/admin/locations/${id}`, {
      method: "PATCH",
      body: { location: { active } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/admin/locations");
  return success(active ? "公開しました" : "非公開にしました");
}

export async function createSpace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(spaceSchema, formData);
  if (!input.ok) return input.state;
  const result = await tryApi(() => apiFetch("/admin/spaces", { method: "POST", body: { space: input.data } }));
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success("スペースを追加しました");
}

export async function setSpaceActive(id: number, active: boolean): Promise<ActionState> {
  const result = await tryApi(() =>
    apiFetch(`/admin/spaces/${id}`, {
      method: "PATCH",
      body: { space: { active } },
    }),
  );
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success(active ? "公開しました" : "非公開にしました");
}

export async function deleteSpace(id: number): Promise<ActionState> {
  const result = await tryApi(() => apiFetch(`/admin/spaces/${id}`, { method: "DELETE" }));
  if (!result.ok) return result.state;
  revalidatePath("/admin/spaces");
  return success("削除しました");
}
