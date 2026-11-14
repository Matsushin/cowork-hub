import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError } from "@/lib/api-error";
import type { User } from "@/lib/types";
import { apiFetch } from "./api";

const COOKIE_NAME = "session_token";

export async function getSessionToken() {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

// JavaScriptから読めない httpOnly Cookie に保存する（XSSでトークンを盗まれない）
export async function setSessionToken(token: string) {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // HTTPSで配信するときだけSecureを付ける（学習用のALBはHTTPのため）
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionToken() {
  (await cookies()).delete(COOKIE_NAME);
}

/** ログイン中の会員（未ログインならnull）。1リクエスト内では1回だけAPIを呼ぶ */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!(await getSessionToken())) return null;
  try {
    return await apiFetch<User>("/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/reserve");
  return user;
}
