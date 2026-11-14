"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const links = user
    ? [
        { href: "/reserve", label: "予約する" },
        { href: "/reservations", label: "予約一覧" },
        { href: "/profile", label: "会員情報" },
        ...(user.role === "admin" ? [{ href: "/admin/users", label: "管理" }] : []),
      ]
    : [];

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-bold tracking-tight text-primary">
          Cowork Base
        </Link>
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
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-muted-foreground">{user.name} さん</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                ログアウト
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">ログイン</Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>会員登録</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
