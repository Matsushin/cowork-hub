import "server-only";
import { headers } from "next/headers";

/**
 * このアプリ（Next.js）を開いているURLのオリジン（例：http://localhost:3000）
 * 本番はALBの後ろで動くので、ALBが付ける X-Forwarded-Proto / Host から組み立てる
 */
export async function appOrigin() {
  const h = await headers();
  // プロキシを複数挟むとカンマ区切りの複数値になるので、先頭（利用者に近い側）だけを使う
  const first = (name: string) => h.get(name)?.split(",")[0]?.trim() || null;
  const host = first("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = first("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
