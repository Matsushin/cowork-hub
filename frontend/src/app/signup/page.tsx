import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/reserve");
  return <SignupForm />;
}
