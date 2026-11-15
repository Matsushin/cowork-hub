import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ApiError, toActionState, type ActionState, type FieldErrors } from "@/lib/api-error";
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

/**
 * FormData（またはオブジェクト）をZodスキーマで検証する
 * ブラウザ側のチェックを通らずに直接呼ばれても、不正な値をRailsへ送らないための2重チェック
 */
export function parseInput<S extends z.ZodType>(schema: S, input: FormData | unknown): Result<z.output<S>> {
  const raw = input instanceof FormData ? Object.fromEntries(input) : input;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const { formErrors, fieldErrors } = z.flattenError(parsed.error);
  return {
    ok: false,
    state: {
      ok: false,
      message: formErrors.length ? formErrors.join("\n") : "入力内容に誤りがあります。各項目を確認してください。",
      fieldErrors: fieldErrors as FieldErrors,
    },
  };
}
