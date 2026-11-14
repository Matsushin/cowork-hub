import { AdminNav } from "@/components/AdminNav";
import { RequireAuth } from "@/components/RequireAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth admin>
      <h1 className="mb-4 text-2xl font-bold">管理</h1>
      <AdminNav />
      {children}
    </RequireAuth>
  );
}
