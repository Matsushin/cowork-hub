// ALB のヘルスチェック用（infra/alb.tf）。Next.js のサーバーが応答できるかだけを見る。
// トップページを使うと、ヘルスチェックのたびに Rails の API を呼び、Rails の起動前（夜間停止からの再開直後など）に
// フロントまで不健全と判定され、Sentry にエラーが記録される（Issue #45）。そのため Rails には問い合わせない。
export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
