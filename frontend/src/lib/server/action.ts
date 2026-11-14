import "server-only";
import { redirect } from "next/navigation";
import { ApiError, toActionState, type ActionState } from "@/lib/api-error";
import { clearSessionToken } from "./session";

type Result<T> = { ok: true; data: T } | { ok: false; state: ActionState };

/**
 * API呼び出しの失敗を、フォームに返せる ActionState に変換する
 * セッション切れ（401）のときはCookieを消してログイン画面へ移る。
 * ログインのように401を「入力の誤り」として返したい場合は redirectOnUnauthorized: false にする
 */
export async function tryApi<T>(fn: () => Promise<T>, { redirectOnUnauthorized = true } = {}): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401 && redirectOnUnauthorized) {
        await clearSessionToken();
        redirect("/login");
      }
      return { ok: false, state: toActionState(e) };
    }
    throw e;
  }
}

export const success = (message: string | null = null): ActionState => ({ ok: true, message, fieldErrors: {} });
