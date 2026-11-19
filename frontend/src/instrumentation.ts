import * as Sentry from "@sentry/nextjs";

// Next.js のサーバー側のエラーを Sentry に送る（SENTRY_DSN を指定したときだけ）。
// Slack への通知は CloudWatch のアラームで行い、Sentry は原因の調査（スタックトレースなど）に使う。
// ブラウザ側のエラーは送らない（DSN をビルド時に埋め込む必要があるため）。
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // 送信の様子をログに出す（うまく届かないときの調査用）
    debug: process.env.SENTRY_DEBUG === "1",
    // 性能の記録は一部のリクエストだけ（無料プランの上限に収めるため）
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // 個人情報や秘密情報を送らない。初期値では Cookie（セッション）・ヘッダー・リクエストの本文
    // （ログイン時のパスワードを含む）まで送るため、すべて止める。URL のクエリは送る（秘密情報は SDK が伏せる）
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
    },
  });
}

// Server Components・Server Actions・Route Handlers で起きたエラー。初期化していなければ何もしない
export const onRequestError = Sentry.captureRequestError;
