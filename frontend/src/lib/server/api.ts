import "server-only";
import { ApiError } from "@/lib/api-error";
import { getSessionToken } from "./session";

// Rails APIの接続先。ローカルは .env.development、本番はECSタスクの環境変数で指定する
function apiOrigin() {
  const origin = process.env.API_ORIGIN;
  if (origin) return origin;
  // 本番で設定漏れに気づけるよう、黙ってlocalhostにフォールバックしない
  if (process.env.NODE_ENV === "production") throw new Error("環境変数 API_ORIGIN が設定されていません");
  return "http://localhost:3001";
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** falseならCookieのトークンを付けない（ログイン・会員登録・公開API） */
  auth?: boolean;
};

/** Server Components / Server Actions からRails APIを呼ぶ */
export async function apiFetch<T>(path: string, { method = "GET", body, auth = true }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth) {
    const token = await getSessionToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // 本番の ALB は、このヘッダーが付いた /api/* だけを Rails に通す（外部から API を直接使わせない。infra/alb.tf）
  if (process.env.INTERNAL_API_KEY) headers["X-Internal-Api-Key"] = process.env.INTERNAL_API_KEY;

  let res: Response;
  try {
    res = await fetch(`${apiOrigin()}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store", // 会員ごとに内容が違うのでキャッシュしない
    });
  } catch {
    throw new ApiError(0, "サーバーに接続できませんでした。時間をおいて再度お試しください");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `エラーが発生しました（${res.status}）`, data.errors ?? {});
  return data as T;
}
