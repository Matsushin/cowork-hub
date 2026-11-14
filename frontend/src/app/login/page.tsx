import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/reserve");
  return <LoginForm />;
}
