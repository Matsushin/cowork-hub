"use client";

import { useState } from "react";
import { api, yen } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorMessage, Field, FormErrors, useApiErrors } from "@/components/form";

function ProfileInner({ user }: { user: User }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name, email_address: user.email_address, password: "" });
  const errors = useApiErrors();
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    errors.clear();
    setSaved(false);
    try {
      const body = { user: { name: form.name, email_address: form.email_address, ...(form.password ? { password: form.password } : {}) } };
      await api("/me", { method: "PATCH", body });
      await refresh();
      setForm({ ...form, password: "" });
      setSaved(true);
    } catch (err) {
      errors.handle(err);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="px-5">
        <h2 className="mb-4 text-lg font-semibold">プロフィール</h2>
        <FormErrors value={errors}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <ErrorMessage message={errors.message} />
          {saved && <p className="text-sm text-primary">保存しました</p>}
          <Field label="名前" name="name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="メールアドレス" name="email_address">
            <Input type="email" value={form.email_address} onChange={(e) => setForm({ ...form, email_address: e.target.value })} />
          </Field>
          <Field label="新しいパスワード（変更する場合のみ）" name="password">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Button type="submit">保存する</Button>
        </form>
        </FormErrors>
      </Card>
      <Card className="px-5">
        <h2 className="mb-4 text-lg font-semibold">ご契約中のプラン</h2>
        {user.plan ? (
          <div className="space-y-2">
            <p className="text-xl font-bold">{user.plan.name}</p>
            <p className="text-muted-foreground">{yen(user.plan.price)}{user.plan.kind === "monthly" ? " /月" : ""}</p>
            <p className="text-sm text-muted-foreground">
              予約上限：{user.plan.monthly_hours_limit ? `月${user.plan.monthly_hours_limit}時間` : "無制限"}
            </p>
            <p className="pt-2 text-xs text-muted-foreground">プランの変更はスタッフまでお申し付けください。</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">有効なプランがありません。</p>
        )}
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  return <RequireAuth>{user && <ProfileInner user={user} />}</RequireAuth>;
}
