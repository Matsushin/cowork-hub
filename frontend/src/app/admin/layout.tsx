import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">管理</h1>
      <AdminNav />
      {children}
    </>
  );
}
