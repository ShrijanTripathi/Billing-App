import AdminSidebar from "../../../components/admin/AdminSidebar";

export const metadata = {
  title: "Admin | Balaji Ji Food Arts",
};

export default function AdminLayout({ children }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row">
        <AdminSidebar />
        <section className="min-h-[calc(100vh-3rem)] flex-1 rounded-xl border border-slate-200 bg-white p-4 lg:p-6">
          {children}
        </section>
      </div>
    </main>
  );
}
