import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatMonth, shiftMonth } from "@/lib/format";
import { serializeMonth } from "@/lib/search-params";

/** 前月・翌月へのリンク（?month=YYYY-MM） */
export function MonthNav({ month, basePath, max }: { month: string; basePath: string; max: string }) {
  const next = shiftMonth(month, 1);
  return (
    <div className="flex items-center gap-2">
      <Link href={serializeMonth(basePath, { month: shiftMonth(month, -1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
        ← 前月
      </Link>
      <span className="min-w-24 text-center font-semibold">{formatMonth(month)}</span>
      {next <= max ? (
        <Link href={serializeMonth(basePath, { month: next })} className={buttonVariants({ variant: "outline", size: "sm" })}>
          翌月 →
        </Link>
      ) : (
        <span
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "pointer-events-none opacity-40",
          })}
        >
          翌月 →
        </span>
      )}
    </div>
  );
}
