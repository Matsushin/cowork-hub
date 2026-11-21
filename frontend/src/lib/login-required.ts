/** ログインが必要なページ（セッション Cookie がなければ proxy.ts がログイン画面へ送る） */
const PREFIXES = ["/visits", "/reservations", "/billing", "/profile", "/admin", "/checkin"];

export function requiresLogin(pathname: string) {
  if (PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return /^\/locations\/[^/]+\/reserve\/?$/.test(pathname);
}
