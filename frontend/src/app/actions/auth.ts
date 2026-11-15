"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/api-error";
import type { SessionResponse } from "@/lib/types";
import { safeRedirectPath } from "@/lib/session-cookie";
import { loginSchema, signupSchema } from "@/lib/schemas";
import { parseInput, tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";
import { clearSessionToken, setSessionToken } from "@/lib/server/session";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(loginSchema, formData);
  if (!input.ok) return input.state;
  const result = await tryApi(
    () =>
      apiFetch<SessionResponse>("/session", {
        method: "POST",
        auth: false,
        body: input.data,
      }),
    { redirectOnUnauthorized: false }, // 401は「メールアドレスまたはパスワードが違う」として表示する
  );
  if (!result.ok) return result.state;
  await setSessionToken(result.data.token);
  // proxy が付けた ?next= の画面へ戻る（外部URLは safeRedirectPath で弾く）
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const input = parseInput(signupSchema, formData);
  if (!input.ok) return input.state;
  const result = await tryApi(() =>
    apiFetch<SessionResponse>("/signup", {
      method: "POST",
      auth: false,
      body: { user: input.data },
    }),
  );
  if (!result.ok) return result.state;
  await setSessionToken(result.data.token);
  redirect("/locations");
}

export async function logout() {
  await apiFetch("/session", { method: "DELETE" }).catch(() => {});
  await clearSessionToken();
  redirect("/");
}
