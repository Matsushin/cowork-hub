import { createHash, timingSafeEqual } from "node:crypto";

/** Basic 認証の設定。BASIC_AUTH_USER と BASIC_AUTH_PASSWORD の両方があるときだけ有効（ローカル・CI・E2E では無効） */
export function basicAuthCredentials(env: Record<string, string | undefined> = process.env) {
  const user = env.BASIC_AUTH_USER;
  const password = env.BASIC_AUTH_PASSWORD;
  return user && password ? { user, password } : null;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Authorization ヘッダーが Basic 認証の ID・パスワードと一致するか（比較にかかる時間から推測されないよう、ハッシュを定数時間で比べる） */
export function isAuthorized(header: string | null, credentials: { user: string; password: string }) {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return false;
  }
  const expected = `${credentials.user}:${credentials.password}`;
  return timingSafeEqual(digest(decoded), digest(expected));
}
