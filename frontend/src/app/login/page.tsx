"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, ErrorMessage } from "@/components/form";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/reserve");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">ログイン</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorMessage message={error} />
        <Field label="メールアドレス">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="パスワード">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <Button type="submit" disabled={submitting} className="w-full">ログイン</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        はじめての方は <Link href="/signup" className="text-primary underline">会員登録</Link>
      </p>
    </Card>
  );
}
