import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { QrCountdown } from "@/components/admin/QrCountdown";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api-error";
import { serializeCheckin } from "@/lib/search-params";
import { apiFetch } from "@/lib/server/api";
import { appOrigin } from "@/lib/server/app-origin";
import type { CheckinCode } from "@/lib/types";

/**
 * 受付用QR。拠点の受付タブレットで管理者がログインして開いておく
 * QRの中身は会員用のチェックインURL。コードは60秒ごとに変わるので、残り0秒でページを再取得する
 */
export default async function AdminLocationQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checkin = await apiFetch<CheckinCode>(`/admin/locations/${id}/checkin_code`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const url = serializeCheckin(`${await appOrigin()}/checkin`, { location: checkin.location.id, code: checkin.code });
  // QR画像はサーバーでSVGにする（ブラウザにQRのライブラリを送らない）
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <Card className="items-center gap-4 px-5 py-8 text-center">
      <h2 className="text-xl font-semibold">{checkin.location.name} 受付</h2>
      <p>スマートフォンで読み取ってチェックインしてください</p>
      <div
        className="size-72 max-w-full [&>svg]:size-full"
        role="img"
        aria-label="チェックイン用のQRコード"
        data-checkin-url={url}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <QrCountdown key={checkin.code} expiresIn={checkin.expires_in} />
    </Card>
  );
}
