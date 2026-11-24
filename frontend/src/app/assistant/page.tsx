import Link from "next/link";
import { BookingAssistant } from "@/components/assistant/BookingAssistant";
import { requireUser } from "@/lib/server/session";

export default async function AssistantPage() {
  await requireUser();
  const available = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">AI で会議室を探す</h1>
        <p className="text-sm text-muted-foreground">
          「明日の午後、渋谷で4人・2時間」のように条件を書くと、AI
          が空きを調べて候補を出します。予約は、内容を確かめてからボタンで確定します（AI が予約することはありません）。
        </p>
      </div>
      {available ? (
        <BookingAssistant />
      ) : (
        <p className="rounded-md border border-border bg-card p-4 text-sm">
          AI アシスタントは今使えません。
          <Link href="/locations" className="underline">
            拠点を探す
          </Link>
          から予約できます。
        </p>
      )}
    </div>
  );
}
