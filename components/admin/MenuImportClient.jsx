"use client";

import { useMemo, useState } from "react";
import { commitMenuImportV2, previewMenuImportV2 } from "../../services/menuV2Api";

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstArray(payload, keys) {
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  return [];
}

function summaryEntries(payload) {
  if (!payload || typeof payload !== "object") return [];
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : payload;

  return Object.entries(summary)
    .filter(([, value]) => !Array.isArray(value) && (typeof value !== "object" || value === null))
    .slice(0, 8);
}

function rowIdentity(row, index) {
  if (row && typeof row === "object") {
    return row.id || row.rowNumber || row.row || row.name || index;
  }
  return index;
}

function PreviewTable({ rows }) {
  const columns = useMemo(() => {
    const firstObject = rows.find((row) => row && typeof row === "object" && !Array.isArray(row));
    return firstObject ? Object.keys(firstObject).slice(0, 8) : [];
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No tabular rows were returned in the preview response.
      </div>
    );
  }

  if (!columns.length) {
    return (
      <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        {JSON.stringify(rows, null, 2)}
      </pre>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            {columns.map((column) => (
              <th key={column} className="py-2 pr-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${rowIdentity(row, index)}-${index}`} className="border-b border-slate-100 align-top">
              {columns.map((column) => (
                <td key={column} className="max-w-xs break-words py-2 pr-3 text-slate-700">
                  {typeof row[column] === "object" && row[column] !== null
                    ? JSON.stringify(row[column])
                    : String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponseList({ title, rows, tone }) {
  if (!rows.length) return null;

  const toneClasses =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <section className={`rounded-xl border p-4 ${toneClasses}`}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="max-h-64 overflow-auto">
        <ul className="space-y-2 text-sm">
          {rows.map((row, index) => (
            <li key={`${title}-${index}`} className="rounded bg-white/70 p-2">
              {typeof row === "object" ? JSON.stringify(row) : String(row)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function MenuImportClient() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  const previewRows = useMemo(
    () => firstArray(preview, ["rows", "preview", "previewRows", "validRows", "items", "data"]),
    [preview]
  );
  const invalidRows = useMemo(
    () => [
      ...firstArray(preview, ["invalidRows", "invalid", "validationErrors", "errors", "failedRows"]),
      ...asArray(preview?.error),
    ],
    [preview]
  );
  const duplicateWarnings = useMemo(
    () => firstArray(preview, ["duplicateWarnings", "duplicates", "warnings", "duplicateRows"]),
    [preview]
  );

  const hasInvalidRows = invalidRows.length > 0;

  const runPreview = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Select a CSV or PDF file first.");
      return;
    }

    setLoading(true);
    setError("");
    setPreview(null);
    setCommitResult(null);
    try {
      const data = await previewMenuImportV2(file);
      setPreview(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to preview import file.");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!file || !preview || hasInvalidRows) return;

    setCommitting(true);
    setError("");
    setCommitResult(null);
    try {
      const data = await commitMenuImportV2(file);
      setCommitResult(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to commit import.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bulk Menu Import</h1>
          <p className="text-sm text-slate-600">Preview CSV or PDF files before committing them to the V2 menu.</p>
        </div>
        <a href="/admin/menu" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Back to Menu
        </a>
      </header>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form className="rounded-xl border border-slate-200 p-4" onSubmit={runPreview}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <label className="text-sm font-medium text-slate-700">
            Import file
            <input
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setPreview(null);
                setCommitResult(null);
                setError("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Auto-create categories: true
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Previewing..." : "Preview Import"}
        </button>
      </form>

      {preview ? (
        <section className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryEntries(preview).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase text-slate-500">{key}</p>
                <p className="mt-1 break-words text-lg font-semibold text-slate-900">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>

          <ResponseList title="Validation Errors" rows={invalidRows} tone="error" />
          <ResponseList title="Duplicate Warnings" rows={duplicateWarnings} tone="warning" />

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Preview Table</h2>
              <button
                type="button"
                onClick={commitImport}
                disabled={hasInvalidRows || committing}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {committing ? "Importing..." : "Commit Import"}
              </button>
            </div>
            {hasInvalidRows ? (
              <p className="mb-3 text-sm text-red-600">Fix validation errors before committing this import.</p>
            ) : null}
            <PreviewTable rows={previewRows} />
          </section>

          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Raw preview response</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}

      {commitResult ? (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-lg font-semibold text-emerald-900">Import Complete</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryEntries(commitResult).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white p-3">
                <p className="text-xs font-medium uppercase text-emerald-700">{key}</p>
                <p className="mt-1 break-words text-base font-semibold text-emerald-950">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-emerald-800">Raw import response</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-700">
              {JSON.stringify(commitResult, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </>
  );
}
