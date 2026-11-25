"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const links = [
  { href: "/admin/users", label: "会員" },
  { href: "/admin/locations", label: "拠点" },
  { href: "/admin/spaces", label: "スペース" },
  { href: "/admin/reservations", label: "予約" },
  { href: "/admin/sales", label: "売上" },
  { href: "/admin/assistant", label: "AIに聞く" },
];

export function AdminNav() {
  const pathname = usePathname();
  const active = useRef<HTMLAnchorElement>(null);
  // 狭い画面で、今のタブが見える位置まで横にスクロールする
  useEffect(() => {
    active.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <div className="mb-6 overflow-x-auto">
      {/* 狭い画面では横にスクロールする。下線は内側の枠に引き、選んだタブの線を重ねる */}
      <div className="flex w-max min-w-full gap-1 border-b border-border">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            ref={pathname.startsWith(l.href) ? active : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm whitespace-nowrap ${pathname.startsWith(l.href) ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
