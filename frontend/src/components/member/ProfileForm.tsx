"use client";

import { useEffect } from "react";
import { updateProfile } from "@/app/actions/member";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileSchema } from "@/lib/schemas";
import type { User } from "@/lib/types";

export function ProfileForm({ user }: { user: User }) {
  const { state, pending, onSubmit, errors, form } = useActionForm(updateProfile, {
    schema: profileSchema,
    defaultValues: { name: user.name, email_address: user.email_address, password: "" },
  });

  // 保存できたらパスワード欄を空にする
  useEffect(() => {
    if (state.ok) form.setValue("password", "");
  }, [state, form]);

  return (
    <FormErrors value={errors}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormStatus state={state} />
        <Field label="名前">
          <Input name="name" />
        </Field>
        <Field label="メールアドレス">
          <Input name="email_address" type="email" />
        </Field>
        <Field label="新しいパスワード（変更する場合のみ）">
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={pending}>
          保存する
        </Button>
      </form>
    </FormErrors>
  );
}
