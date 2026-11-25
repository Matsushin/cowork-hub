import Link from "next/link";
import { AnalyticsAssistant } from "@/components/assistant/AnalyticsAssistant";

export default function AdminAssistantPage() {
  const available = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        売上・予約・利用状況・会員数について質問すると、AI
        が集計の結果から答えます。数字は集計の結果と照らし合わせ、確かめられなかった数字には印を付けます。
      </p>
      {available ? (
        <AnalyticsAssistant />
      ) : (
        <p className="rounded-md border border-border bg-card p-4 text-sm">
          分析アシスタントは今使えません。
          <Link href="/admin/sales" className="underline">
            売上
          </Link>
          の画面をご覧ください。
        </p>
      )}
    </div>
  );
}
