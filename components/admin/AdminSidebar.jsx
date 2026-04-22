"use client";

import { usePathname, useRouter } from "next/navigation";
import { apiRequest } from "../../services/apiClient";

const links = [{ href: "/admin", label: "Dashboard" }];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
    }
  };

  return (
    <aside className="w-full rounded-xl border border-slate-200 bg-white p-4 lg:w-64">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin Panel</p>
        <h2 className="text-xl font-semibold text-slate-900">Balaji Ji Food Arts</h2>
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={logout}
        className="mt-6 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
      >
        Logout
      </button>
    </aside>
  );
}
