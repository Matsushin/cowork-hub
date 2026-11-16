"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { secondsLeft } from "@/lib/countdown";

/**
 * 受付用QRの残り秒数を表示し、0秒になったらページを再取得して新しいQRにする
 * 残り秒数はサーバーが計算した expiresIn から数える（タブレットの時計のずれに左右されない）。
 * 新しいQRになったら親が key を変えて作り直すので、ここでは状態をリセットしない
 */
export function QrCountdown({ expiresIn }: { expiresIn: number }) {
  const router = useRouter();
  const [deadline] = useState(() => Date.now() + expiresIn * 1000);
  const [left, setLeft] = useState(expiresIn);

  useEffect(() => {
    let lastRefresh = 0;
    const timer = setInterval(() => {
      const now = Date.now();
      const s = secondsLeft(deadline, now);
      setLeft(s);
      // 通信に失敗しても止まらないよう、0秒のあいだは5秒おきに再取得する
      if (s === 0 && now - lastRefresh > 5000) {
        lastRefresh = now;
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, router]);

  return (
    <p className="text-lg" aria-live="polite">
      あと <span className="font-mono text-2xl font-bold tabular-nums">{left}</span> 秒で新しいQRコードに変わります
    </p>
  );
}
