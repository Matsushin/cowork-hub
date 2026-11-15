// セッションCookieの名前とログイン後の戻り先の扱い
// proxy.ts からも読むので、server-only や next/headers に依存させない

export const SESSION_COOKIE_NAME = "session_token";

/**
 * ログイン後に戻るパスとして安全なものだけを返す
 * 外部サイトへ飛ばされないよう（オープンリダイレクト対策）、自サイト内の相対パスに限る
 */
export function safeRedirectPath(value: unknown, fallback = "/locations"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // タブ・改行などの制御文字はブラウザがURLの解釈時に取り除くため、"/\t/evil.com" が "//evil.com" に化ける
  if ([...value].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return fallback;
  return value;
}
