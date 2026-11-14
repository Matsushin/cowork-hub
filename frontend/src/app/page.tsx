import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { yen } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/session";
import type { Plan } from "@/lib/types";

export default async function Home() {
  const [user, plans] = await Promise.all([getCurrentUser(), apiFetch<Plan[]>("/plans", { auth: false })]);

  return (
    <div className="space-y-10">
      <section className="space-y-4 py-6">
        <h1 className="text-3xl font-bold tracking-tight">席も会議室も、30分単位でオンライン予約</h1>
        <p className="text-muted-foreground">フリー席・会議室の空き状況を確認して、その場で予約できます。</p>
        <Link href={user ? "/reserve" : "/signup"} className={buttonVariants({ size: "lg", className: "px-5" })}>
          {user ? "空き状況を見る" : "無料で会員登録"}
        </Link>
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
