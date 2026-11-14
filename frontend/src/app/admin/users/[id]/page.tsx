"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, formatDateTime, formatTime } from "@/lib/api";
import type { Plan, Reservation, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, ErrorMessage } from "@/components/form";

type UserDetail = User & { reservations: Reservation[] };

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([api<UserDetail>(`/admin/users/${id}`), api<Plan[]>("/plans")]);
      setUser(u);
      setPlans(p);
      setPlanId(String(u.plan?.id ?? ""));
      setRole(u.role);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body: { user: { role, plan_id: planId || undefined } } });
      await load();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!user) return <ErrorMessage message={error} />;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      <Card className="px-5 space-y-4">
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email_address}</p>
          <p className="text-xs text-muted-foreground">登録日：{new Date(user.created_at).toLocaleDateString("ja-JP")}</p>
        </div>
        <ErrorMessage message={error} />
        {saved && <p className="text-sm text-primary">保存しました</p>}
        <Field label="プラン">
          <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <NativeSelectOption value="">未設定</NativeSelectOption>
            {plans.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="権限">
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
            <NativeSelectOption value="member">会員</NativeSelectOption>
            <NativeSelectOption value="admin">管理者</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button onClick={save}>保存する</Button>
      </Card>
      <Card className="px-5">
        <h2 className="mb-3 font-semibold">予約履歴</h2>
        {user.reservations.length === 0 && <p className="text-sm text-muted-foreground">予約はありません。</p>}
        <ul className="divide-y divide-border text-sm">
          {user.reservations.map((r) => (
            <li key={r.id} className="flex justify-between py-2">
              <span>{formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}　{r.space.name}</span>
              <span className="text-muted-foreground">{r.status === "canceled" ? "キャンセル" : "確定"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
