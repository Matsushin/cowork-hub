"use client";

import { signup } from "@/app/actions/auth";
import { ErrorMessage, Field, FormErrors, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signupSchema } from "@/lib/schemas";

export function SignupForm() {
  const { state, pending, onSubmit, errors } = useActionForm(signup, { schema: signupSchema });

  return (
    <Card className="mx-auto max-w-sm px-5">
      <h1 className="mb-1 text-xl font-semibold">会員登録</h1>
      <p className="mb-4 text-sm text-muted-foreground">登録後はドロップインプランで利用を開始できます。</p>
      <FormErrors value={errors}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <ErrorMessage message={state.message} />
          <Field label="名前">
            <Input name="name" />
          </Field>
          <Field label="メールアドレス">
            <Input name="email_address" type="email" autoComplete="email" />
          </Field>
          <Field label="パスワード（8文字以上）">
            <Input name="password" type="password" autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            登録する
          </Button>
        </form>
      </FormErrors>
    </Card>
  );
}
