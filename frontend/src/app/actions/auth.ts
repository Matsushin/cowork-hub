"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/api-error";
import type { User } from "@/lib/types";
import { tryApi } from "@/lib/server/action";
import { apiFetch } from "@/lib/server/api";
import { clearSessionToken, setSessionToken } from "@/lib/server/session";

type SessionResponse = { token: string; user: User };

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await tryApi(
    () =>
      apiFetch<SessionResponse>("/session", {
        method: "POST",
        auth: false,
        body: {
          email_address: formData.get("email_address"),
          password: formData.get("password"),
        },
      }),
    { redirectOnUnauthorized: false }, // 401は「メールアドレスまたはパスワードが違う」として表示する
  );
  if (!result.ok) return result.state;
  await setSessionToken(result.data.token);
  redirect("/locations");
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await tryApi(() =>
    apiFetch<SessionResponse>("/signup", {
      method: "POST",
      auth: false,
      body: {
        user: {
          name: formData.get("name"),
          email_address: formData.get("email_address"),
          password: formData.get("password"),
        },
      },
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
