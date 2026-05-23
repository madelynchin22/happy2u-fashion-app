"use client";
import { useRef, useState } from "react";

export default function ImportMayPosPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ deleted: number; created: number; log: string[]; deleteLog?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select the Excel file first."); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/purchase-orders/import-may", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Import May 2026 POs</h1>
      <p className="text-gray-500 text-sm mb-6">
        Clears all existing MAY 2026 POs and re-imports from the Excel file.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 text-center">
        <p className="text-sm text-gray-500 mb-3">Select <strong>MAY 26 NEW STOCK (SHOES).xlsx</strong></p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="text-sm"
        />
      </div>

      <button
        onClick={handleImport}
        disabled={loading}
        className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
      >
        {loading ? "Importing..." : "Clear & Import"}
      </button>

      {error && (
        <pre className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-pre-wrap break-all">
          {error}
        </pre>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-sm">
          <p className="font-semibold text-green-700 mb-2">
            Done — deleted {result.deleted} old POs, created {result.created} new POs
          </p>
          {result.deleteLog && result.deleteLog.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">Delete log:</p>
              <ul className="space-y-0.5 text-xs font-mono text-gray-600">
                {result.deleteLog.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          )}
          <ul className="space-y-1 text-xs font-mono">
            {result.log.map((line, i) => (
              <li key={i} className={line.startsWith("✓") ? "text-green-700" : "text-orange-600"}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
