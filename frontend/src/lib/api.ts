const TOKEN_KEY = "coworking_token";

// 項目名 → エラーメッセージ一覧（項目に属さないものは "base"）
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "サーバーに接続できませんでした。時間をおいて再度お試しください");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `エラーが発生しました（${res.status}）`, data.errors ?? {});
  return data as T;
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

export const spaceKindLabel = { seat: "フリー席", meeting_room: "会議室" } as const;
