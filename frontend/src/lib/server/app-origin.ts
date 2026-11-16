import "server-only";
import { headers } from "next/headers";

/**
 * このアプリ（Next.js）を開いているURLのオリジン（例：http://localhost:3000）
 * 本番はALBの後ろで動くので、ALBが付ける X-Forwarded-Proto / Host から組み立てる
 */
export async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  return `${proto}://${host}`;
}
