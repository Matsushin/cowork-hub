import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * ログインが必要なページに、セッションCookieを持たずに来たらログイン画面へ送る
 *
 * ここで見るのは「Cookieがあるか」だけ（Rails APIへの問い合わせはしない）。
 * トークンが有効か・管理者かの最終確認は、各ページの requireUser / requireAdmin と Rails 側で行う。
 * ページの描画やAPI呼び出しの前に弾けるので、未ログイン時の無駄な処理がなくなり、
 * ログイン後に元のページへ戻れる（?next=）。
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/visits/:path*",
    "/reservations/:path*",
    "/billing/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/locations/:id/reserve",
  ],
};
