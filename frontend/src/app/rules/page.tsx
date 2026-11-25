import type { Metadata } from "next";
import Link from "next/link";
import { FaqBot } from "@/components/assistant/FaqBot";
import { Card } from "@/components/ui/card";
import { RULE_DOCS } from "@/lib/ai/faq/generated-rules";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "ご利用ルール" };

// ご利用ルール（docs/rules/*.md から作ったもの）。だれでも見られる。ログインしていれば FAQ ボットに質問できる
export default async function RulesPage() {
  const user = await getCurrentUser();
  const available = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ご利用ルール</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">AI に質問する</h2>
        {!user ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/login?next=/rules" className="underline">
              ログイン
            </Link>
            すると、ご利用ルールについて AI に質問できます。
          </p>
        ) : available ? (
          <FaqBot />
        ) : (
          <p className="text-sm text-muted-foreground">FAQ ボットは今使えません。下のご利用ルールをご覧ください。</p>
        )}
      </Card>

      <nav aria-label="目次" className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {RULE_DOCS.map((doc) => (
            <li key={doc.file}>
              <a href={`#${doc.sections[0].id}`} className="text-primary underline">
                {doc.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {RULE_DOCS.map((doc) => (
        <section key={doc.file} className="space-y-4">
          <h2 className="border-b border-border pb-1 text-xl font-semibold">{doc.title}</h2>
          {doc.sections.map((s) => (
            <div key={s.id} id={s.id} className="scroll-mt-4 space-y-1 rounded-md target:bg-accent target:p-2">
              <h3 className="font-semibold">{s.heading}</h3>
              {s.blocks.map((b, i) => (
                <p key={i} className="text-sm leading-relaxed">
                  {b}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
