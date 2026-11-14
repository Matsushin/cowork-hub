"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 現在のページを強調するため、ここだけクライアントコンポーネントにする
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-wrap gap-4 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname.startsWith(l.href) ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
