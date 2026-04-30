"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "../../../components/admin/Modal";
import { apiRequest, API_BASE_URL } from "../../../services/apiClient";
import { fetchCategoriesV2, fetchMenuV2, isMenuItemAvailable } from "../../../services/menuV2Api";

const SALES_RANGES = [
  { key: "today", label: "Today Sale" },
  { key: "week", label: "This Week Sale" },
  { key: "month", label: "This Month Sale" },
];

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatRangeLabel(isoString, timeZone) {
  if (!isoString) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesRange, setSalesRange] = useState("today");
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [salesAnalytics, setSalesAnalytics] = useState(null);
  const [offlineSales, setOfflineSales] = useState([]);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineError, setOfflineError] = useState("");
  const [excludingSaleId, setExcludingSaleId] = useState("");
  const [downloadDeleteBusy, setDownloadDeleteBusy] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [pendingDeleteFilter, setPendingDeleteFilter] = useState("");
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      const [meData, menuData, categoryData] = await Promise.all([
        apiRequest("/api/auth/me"),
        fetchMenuV2(),
        fetchCategoriesV2(),
      ]);

      setAdmin(meData.admin);
      setItems(menuData.items || []);
      setCategories(categoryData.categories || []);
    } catch (requestError) {
      if (requestError.status === 401) {
        router.replace("/admin/login");
        return;
      }
      setError(requestError.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboardStats = useMemo(() => {
    const total = items.length;
    const available = items.filter((item) => isMenuItemAvailable(item)).length;
    return {
      total,
      categories: categories.length,
      available,
      needsAttention: items.filter((item) => !isMenuItemAvailable(item) || item.isActive === false).length,
    };
  }, [items, categories]);

  const loadSalesAnalytics = async (range = salesRange) => {
    setSalesLoading(true);
    setSalesError("");

    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const analyticsData = await apiRequest("/api/sales/analytics", {
        query: {
          period: range,
          timeZone: browserTimeZone,
        },
      });
      setSalesAnalytics(analyticsData);
    } catch (requestError) {
      setSalesError(requestError.message || "Unable to load sales analytics");
      setSalesAnalytics(null);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadOfflineSales = async () => {
    setOfflineLoading(true);
    setOfflineError("");

    try {
      const response = await apiRequest("/api/sales", {
        query: {
          saleType: "OFFLINE",
          includeDeleted: false,
          limit: 100,
        },
      });
      setOfflineSales(response.sales || []);
    } catch (requestError) {
      setOfflineError(requestError.message || "Unable to load offline sales");
      setOfflineSales([]);
    } finally {
      setOfflineLoading(false);
    }
  };

  const deleteOfflineSale = async (saleId) => {
    if (!window.confirm("Delete this offline sale?")) return;

    setExcludingSaleId(saleId);
    try {
      await apiRequest(`/api/sales/${saleId}/delete`, {
        method: "PATCH",
      });
      await Promise.all([loadSalesAnalytics(salesRange), loadOfflineSales()]);
    } catch (requestError) {
      setOfflineError(requestError.message || "Unable to delete offline sale");
    } finally {
      setExcludingSaleId("");
    }
  };

  const triggerCsvDownload = (csvString, fileName) => {
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute("download", fileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const buildSalesCsv = (sales) => {
    const headers = ["Date", "Items", "Quantity", "Total Amount"];
    const rows = sales.map((sale) => {
      const date = new Date(sale.billedAt).toLocaleString("en-IN");
      const itemNames = (sale.items || []).map((item) => `${item.name} x${item.qty}`).join(" | ");
      const quantity = Number(sale.totalQty || 0);
      const total = Number(sale.grandTotal || 0).toFixed(2);
      const escapedItems = `"${String(itemNames).replace(/"/g, '""')}"`;
      return `${date},${escapedItems},${quantity},${total}`;
    });

    return [headers.join(","), ...rows].join("\n");
  };

  const downloadAndPrepareDelete = async () => {
    setDownloadDeleteBusy(true);
    setSalesError("");

    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const response = await apiRequest("/api/sales/export", {
        query: {
          filter: salesRange,
          timeZone: browserTimeZone,
        },
      });
      const sales = Array.isArray(response.sales) ? response.sales : [];

      if (!sales.length) {
        setSalesError("No sales available for selected filter.");
        return;
      }

      const csv = buildSalesCsv(sales);
      const fileName = `sales-${salesRange}-${new Date().toISOString().slice(0, 10)}.csv`;
      triggerCsvDownload(csv, fileName);

      setPendingDeleteFilter(salesRange);
      setPendingDeleteCount(sales.length);
      setBulkDeleteModalOpen(true);
    } catch (requestError) {
      setSalesError(requestError.message || "Unable to download sales data.");
    } finally {
      setDownloadDeleteBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    setDownloadDeleteBusy(true);
    setSalesError("");

    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      await apiRequest("/api/sales/bulk-delete", {
        method: "DELETE",
        body: {
          filter: pendingDeleteFilter,
          timeZone: browserTimeZone,
        },
      });
      setBulkDeleteModalOpen(false);
      setPendingDeleteFilter("");
      setPendingDeleteCount(0);
      await Promise.all([loadSalesAnalytics(salesRange), loadOfflineSales()]);
    } catch (requestError) {
      setSalesError(requestError.message || "Unable to delete sales from database.");
    } finally {
      setDownloadDeleteBusy(false);
    }
  };

  useEffect(() => {
    if (!salesOpen) return;
    Promise.all([loadSalesAnalytics(salesRange), loadOfflineSales()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOpen, salesRange]);

  useEffect(() => {
    if (!salesOpen) return;

    const streamUrl = `${API_BASE_URL}/api/sales/stream`;
    const eventStream = new EventSource(streamUrl, { withCredentials: true });

    const handleSalesUpdate = () => {
      loadSalesAnalytics(salesRange);
      loadOfflineSales();
    };

    eventStream.addEventListener("sales_update", handleSalesUpdate);

    return () => {
      eventStream.removeEventListener("sales_update", handleSalesUpdate);
      eventStream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesOpen, salesRange]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading admin dashboard...</p>;
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Restaurant Admin Dashboard</h1>
          <p className="text-sm text-slate-600">Authorized user: {admin?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/menu"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700"
          >
            Manage Menu
          </a>
          <a
            href="/admin/menu/import"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Bulk Import
          </a>
        </div>
      </header>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Total menu items</p>
          <p className="text-2xl font-semibold text-slate-900">{dashboardStats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Total categories</p>
          <p className="text-2xl font-semibold text-slate-900">{dashboardStats.categories}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Available items</p>
          <p className="text-2xl font-semibold text-emerald-900">{dashboardStats.available}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">Unavailable / inactive</p>
          <p className="text-2xl font-semibold text-amber-900">{dashboardStats.needsAttention}</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Total Sales</h2>
          <button
            type="button"
            onClick={() => setSalesOpen((prev) => !prev)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {salesOpen ? "Hide Sales" : "View Total Sales"}
          </button>
        </div>

        {salesOpen ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {SALES_RANGES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSalesRange(option.key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    salesRange === option.key
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={downloadAndPrepareDelete}
                disabled={downloadDeleteBusy}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
              >
                {downloadDeleteBusy ? "Processing..." : "Download & Delete"}
              </button>
            </div>

            {salesLoading ? <p className="text-sm text-slate-500">Loading sales analytics...</p> : null}
            {salesError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {salesError}
              </div>
            ) : null}

            {salesAnalytics && !salesLoading ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">{salesAnalytics.periodLabel} Revenue</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {formatCurrency(salesAnalytics.summary?.totalSales || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">{salesAnalytics.periodLabel} Orders</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {Number(salesAnalytics.summary?.totalOrders || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">{salesAnalytics.periodLabel} Items Sold</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {Number(salesAnalytics.summary?.totalQty || 0)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Range ({salesAnalytics.range?.timeZone}):{" "}
                  {formatRangeLabel(salesAnalytics.range?.start, salesAnalytics.range?.timeZone)} to{" "}
                  {formatRangeLabel(salesAnalytics.range?.end, salesAnalytics.range?.timeZone)}
                </p>

                {Number(salesAnalytics.summary?.totalOrders || 0) === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No sales recorded for this period yet.
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-2">Item</th>
                        <th className="py-2">Category</th>
                        <th className="py-2">Qty Sold</th>
                        <th className="py-2">Sales Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesAnalytics.items || []).map((item) => (
                        <tr key={item.itemId || `${item.name}-${item.category}`} className="border-b border-slate-100">
                          <td className="py-2 font-medium text-slate-900">{item.name}</td>
                          <td className="py-2 text-slate-600">{item.category}</td>
                          <td className="py-2 text-slate-600">{item.quantitySold}</td>
                          <td className="py-2 text-slate-600">{formatCurrency(item.salesAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Offline Sales Control</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Manage OFFLINE sales and delete them from analytics instantly.
                  </p>

                  {offlineLoading ? <p className="mt-3 text-sm text-slate-500">Loading offline sales...</p> : null}
                  {offlineError ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {offlineError}
                    </div>
                  ) : null}

                  {!offlineLoading && offlineSales.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      No offline sales available.
                    </div>
                  ) : null}

                  {offlineSales.length > 0 ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600">
                            <th className="py-2">Bill #</th>
                            <th className="py-2">Billed At</th>
                            <th className="py-2">Total</th>
                            <th className="py-2">Status</th>
                            <th className="py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offlineSales.map((sale) => (
                            <tr key={sale._id} className="border-b border-slate-100">
                              <td className="py-2 text-slate-900">{sale.billNo}</td>
                              <td className="py-2 text-slate-600">
                                {new Date(sale.billedAt).toLocaleString("en-IN")}
                              </td>
                              <td className="py-2 text-slate-600">{formatCurrency(sale.grandTotal)}</td>
                              <td className="py-2">
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                  Active
                                </span>
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => deleteOfflineSale(sale._id)}
                                  disabled={excludingSaleId === sale._id}
                                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                                >
                                  {excludingSaleId === sale._id ? "Deleting..." : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <Modal
        open={bulkDeleteModalOpen}
        onClose={() => {
          if (downloadDeleteBusy) return;
          setBulkDeleteModalOpen(false);
        }}
        title="Confirm Sales Deletion"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete these sales from database? This action cannot be undone.
          </p>
          <p className="text-xs text-slate-500">
            Filter: <span className="font-semibold uppercase">{pendingDeleteFilter || "-"}</span> | Records:{" "}
            <span className="font-semibold">{pendingDeleteCount}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkDeleteModalOpen(false)}
              disabled={downloadDeleteBusy}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmBulkDelete}
              disabled={downloadDeleteBusy}
              className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {downloadDeleteBusy ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
