"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 現在のページを強調するため、ここだけクライアントコンポーネントにする
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // 幅は中身に合わせ、入りきらなければ次の行へ回す（スマホで項目の途中で折り返さないように）
  return (
    <nav className="flex flex-[1_1_auto] flex-wrap gap-x-4 gap-y-1 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap ${pathname.startsWith(l.href) ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
