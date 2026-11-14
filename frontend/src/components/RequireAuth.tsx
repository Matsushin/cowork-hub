"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = user && (!admin || user.role === "admin");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (admin && user.role !== "admin") router.replace("/reserve");
  }, [loading, user, admin, router]);

  if (loading || !allowed) return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  return <>{children}</>;
}
