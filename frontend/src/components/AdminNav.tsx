"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/users", label: "会員" },
  { href: "/admin/reservations", label: "予約" },
  { href: "/admin/spaces", label: "スペース" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${pathname.startsWith(l.href) ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
