"use client";

import { updateUser } from "@/app/actions/admin";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Plan, User } from "@/lib/types";

export function UserForm({ user, plans }: { user: User; plans: Plan[] }) {
  const { state, pending, onSubmit, errors } = useActionForm(updateUser.bind(null, user.id));

  return (
    <FormErrors value={errors}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormStatus state={state} />
        <Field label="プラン" errorKey="plan">
          <NativeSelect name="plan_id" defaultValue={String(user.plan?.id ?? "")}>
            <NativeSelectOption value="">未設定</NativeSelectOption>
            {plans.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="権限">
          <NativeSelect name="role" defaultValue={user.role}>
            <NativeSelectOption value="member">会員</NativeSelectOption>
            <NativeSelectOption value="admin">管理者</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          保存する
        </Button>
      </form>
    </FormErrors>
  );
}
