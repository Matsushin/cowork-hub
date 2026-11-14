import { notFound } from "next/navigation";
import { UserForm } from "@/components/admin/UserForm";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api-error";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import type { Plan, Reservation, User } from "@/lib/types";

type UserDetail = User & { reservations: Reservation[] };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, plans] = await Promise.all([
    apiFetch<UserDetail>(`/admin/users/${id}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    apiFetch<Plan[]>("/plans", { auth: false }),
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
      <Card className="space-y-4 px-5">
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email_address}</p>
          <p className="text-xs text-muted-foreground">登録日：{formatDate(user.created_at)}</p>
        </div>
        {/* key: 保存後に再取得した値で初期値を作り直す */}
        <UserForm key={`${user.plan?.id}-${user.role}`} user={user} plans={plans} />
      </Card>
      <Card className="px-5">
        <h2 className="mb-3 font-semibold">予約履歴</h2>
        {user.reservations.length === 0 && <p className="text-sm text-muted-foreground">予約はありません。</p>}
        <ul className="divide-y divide-border text-sm">
          {user.reservations.map((r) => (
            <li key={r.id} className="flex justify-between py-2">
              <span>
                {formatDateTime(r.starts_at)}〜{formatTime(r.ends_at)}　{r.space.name}
              </span>
              <span className="text-muted-foreground">{r.status === "canceled" ? "キャンセル" : "確定"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
