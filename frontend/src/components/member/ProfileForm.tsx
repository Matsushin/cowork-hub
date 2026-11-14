"use client";

import { useEffect, useRef } from "react";
import { updateProfile } from "@/app/actions/member";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/lib/types";

export function ProfileForm({ user }: { user: User }) {
  const { state, pending, onSubmit, errors } = useActionForm(updateProfile);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 保存できたらパスワード欄を空にする
  useEffect(() => {
    if (state.ok && passwordRef.current) passwordRef.current.value = "";
  }, [state]);

  return (
    <FormErrors value={errors}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormStatus state={state} />
        <Field label="名前">
          <Input name="name" defaultValue={user.name} />
        </Field>
        <Field label="メールアドレス">
          <Input name="email_address" type="email" defaultValue={user.email_address} />
        </Field>
        <Field label="新しいパスワード（変更する場合のみ）">
          <Input ref={passwordRef} name="password" type="password" autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={pending}>
          保存する
        </Button>
      </form>
    </FormErrors>
  );
}
