import { NextResponse, type NextRequest } from "next/server";
import { basicAuthCredentials, isAuthorized } from "@/lib/basic-auth";
import { requiresLogin } from "@/lib/login-required";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * すべてのページの前に動く（Next.js 16 で middleware.ts から proxy.ts に改名された。Node.js ランタイムで動く）
 *
 * 1. Basic 認証：本番で外部の人やボットに見せないため。BASIC_AUTH_USER / BASIC_AUTH_PASSWORD があるときだけ有効
 *    （ローカル・CI・E2E では無効）。Rails の API は ALB で守る（infra/alb.tf：Next.js のサーバーからの呼び出しだけを通す）
 * 2. ログインが必要なページに、セッション Cookie を持たずに来たらログイン画面へ送る
 *    ここで見るのは「Cookie があるか」だけ（Rails API への問い合わせはしない）。
 *    トークンが有効か・管理者かの最終確認は、各ページの requireUser / requireAdmin と Rails 側で行う。
 *    ページの描画や API 呼び出しの前に弾けるので、未ログイン時の無駄な処理がなくなり、ログイン後に元のページへ戻れる（?next=）
 */
export function proxy(request: NextRequest) {
  const credentials = basicAuthCredentials();
  if (credentials && !isAuthorized(request.headers.get("authorization"), credentials)) {
    return new NextResponse("認証が必要です", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="ee-office", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const { pathname, search } = request.nextUrl;
  if (!requiresLogin(pathname) || request.cookies.has(SESSION_COOKIE_NAME)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * 次を除くすべてのパス（_next 以外は完全一致。`/healthz-foo` のようなパスまで認証の対象外にしないため）
     * - _next/static・_next/image：静的ファイル（Basic 認証の後にしか読み込まれない。ブラウザは同じサイトに認証情報を送る）
     * - healthz：ALB のヘルスチェック（認証情報を送れない）
     * - robots.txt：クローラーに「見ないで」と伝えるため、認証なしで読めるようにする
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|healthz$|robots\\.txt$|favicon\\.ico$).*)",
  ],
};
