import Link from "next/link";
import { LocationCard } from "@/components/LocationCard";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/session";
import type { Location, Plan } from "@/lib/types";

export default async function Home() {
  const [user, plans, locations] = await Promise.all([
    getCurrentUser(),
    apiFetch<Plan[]>("/plans", { auth: false }),
    apiFetch<Location[]>("/locations", { auth: false }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4 py-6">
        <p className="text-sm font-semibold text-primary">ee-office（ええオフィス）</p>
        <h1 className="text-3xl font-bold tracking-tight">全国のコワーキングを、使った分だけ</h1>
        <p className="text-muted-foreground">
          近くの拠点にチェックインするだけで、予約なしですぐに作業できます。料金は30分単位、1回の上限つき。会議室は事前予約もできます。
        </p>
        <Link href={user ? "/locations" : "/signup"} className={buttonVariants({ size: "lg", className: "px-5" })}>
          {user ? "拠点を探す" : "無料で会員登録"}
        </Link>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">拠点（{locations.length}か所）</h2>
          <Link href="/locations" className="text-sm text-primary hover:underline">
            すべて見る
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.slice(0, 4).map((l) => (
            <LocationCard key={l.id} location={l} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">料金プラン</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="gap-0 px-5">
              <p className="text-sm text-muted-foreground">{p.kind === "monthly" ? "月額" : "都度払い"}</p>
              <h3 className="mt-1 text-lg font-semibold">{p.name}</h3>
              <p className="mt-2 text-2xl font-bold">
                {yen(p.price)}
                {p.kind === "monthly" && <span className="text-sm font-normal text-muted-foreground"> /月</span>}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
