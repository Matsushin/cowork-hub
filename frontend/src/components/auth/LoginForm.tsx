"use client";

import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ErrorMessage, Field, FormErrors, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/schemas";

export function LoginForm({ next }: { next: string }) {
  const { state, pending, onSubmit, errors } = useActionForm(login, { schema: loginSchema });

  return (
    <Card className="mx-auto max-w-sm px-5">
      <h1 className="mb-4 text-xl font-semibold">ログイン</h1>
      <FormErrors value={errors}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* サーバーからはどの項目が誤りかは返さない（アカウントの存在を推測されないため）。項目ごとのエラーは形式チェックのみ */}
          <ErrorMessage message={state.message} />
          <input type="hidden" name="next" value={next} />
          <Field label="メールアドレス">
            <Input name="email_address" type="email" autoComplete="email" />
          </Field>
          <Field label="パスワード">
            <Input name="password" type="password" autoComplete="current-password" />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            ログイン
          </Button>
        </form>
      </FormErrors>
      <p className="mt-4 text-sm text-muted-foreground">
        はじめての方は{" "}
        <Link href="/signup" className="text-primary underline">
          会員登録
        </Link>
      </p>
    </Card>
  );
}
