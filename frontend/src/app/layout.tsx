import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Cowork Base",
  description: "コワーキングスペースの予約・会員管理サンプル",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <Header user={user} />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
