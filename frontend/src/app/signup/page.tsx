"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, ErrorMessage } from "@/components/form";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup(form.name, form.email, form.password);
      router.push("/reserve");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="px-5 mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">会員登録</h1>
      <p className="mb-4 text-sm text-muted-foreground">登録後はドロップインプランで利用を開始できます。</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorMessage message={error} />
        <Field label="名前">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="メールアドレス">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
        </Field>
        <Field label="パスワード（8文字以上）">
          <Input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={submitting} className="w-full">登録する</Button>
      </form>
    </Card>
  );
}
