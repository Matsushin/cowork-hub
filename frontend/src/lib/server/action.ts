import "server-only";
import { ApiError, toActionState, type ActionState } from "@/lib/api-error";

type Result<T> = { ok: true; data: T } | { ok: false; state: ActionState };

/** API呼び出しの失敗を、フォームに返せる ActionState に変換する */
export async function tryApi<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, state: toActionState(e) };
    throw e;
  }
}

export const success = (message: string | null = null): ActionState => ({ ok: true, message, fieldErrors: {} });
