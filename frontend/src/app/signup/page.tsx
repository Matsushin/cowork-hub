"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorMessage, Field, FormErrors, useApiErrors } from "@/components/form";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const errors = useApiErrors();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    errors.clear();
    try {
      await signup(form.name, form.email, form.password);
      router.push("/reserve");
    } catch (err) {
      errors.handle(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-sm px-5">
      <h1 className="mb-1 text-xl font-semibold">会員登録</h1>
      <p className="mb-4 text-sm text-muted-foreground">登録後はドロップインプランで利用を開始できます。</p>
      <FormErrors value={errors}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <ErrorMessage message={errors.message} />
          <Field label="名前" name="name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="メールアドレス" name="email_address">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="パスワード（8文字以上）" name="password">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={submitting} className="w-full">登録する</Button>
        </form>
      </FormErrors>
    </Card>
  );
}
