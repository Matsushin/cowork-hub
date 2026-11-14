import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import type { User } from "@/lib/types";
import { NavLinks } from "./NavLinks";

export function Header({ user }: { user: User | null }) {
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
        <NavLinks links={links} />
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-muted-foreground">{user.name} さん</span>
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm">
                  ログアウト
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                ログイン
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                会員登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
