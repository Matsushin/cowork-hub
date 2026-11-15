import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/server/api";
import { getCurrentUser } from "@/lib/server/session";
import type { Visit } from "@/lib/types";

export const metadata: Metadata = {
  title: "ee-office（ええオフィス）",
  description: "全国のコワーキングスペースを、ドロップインで使った分だけ。会議室の予約もできる会員サービスのサンプル",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // ログイン中なら利用中のドロップインをヘッダーに出す
  const currentVisit = user ? await apiFetch<Visit | null>("/visits/current").catch(() => null) : null;
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <Header user={user} currentVisit={currentVisit} />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
