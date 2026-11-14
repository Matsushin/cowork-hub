import { ProfileForm } from "@/components/member/ProfileForm";
import { Card } from "@/components/ui/card";
import { yen } from "@/lib/format";
import { requireUser } from "@/lib/server/session";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="px-5">
        <h2 className="mb-4 text-lg font-semibold">プロフィール</h2>
        <ProfileForm user={user} />
      </Card>
      <Card className="px-5">
        <h2 className="mb-4 text-lg font-semibold">ご契約中のプラン</h2>
        {user.plan ? (
          <div className="space-y-2">
            <p className="text-xl font-bold">{user.plan.name}</p>
            <p className="text-muted-foreground">
              {yen(user.plan.price)}
              {user.plan.kind === "monthly" ? " /月" : ""}
            </p>
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
