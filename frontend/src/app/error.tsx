"use client";

import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/form";

// Server Componentでのデータ取得に失敗したときに表示する
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <ErrorMessage message={error.message || "エラーが発生しました"} />
      <Button variant="outline" onClick={reset}>
        再読み込み
      </Button>
    </div>
  );
}
