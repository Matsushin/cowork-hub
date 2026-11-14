import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeRedirectPath } from "@/lib/session-cookie";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <LoginForm next={next} />;
}
