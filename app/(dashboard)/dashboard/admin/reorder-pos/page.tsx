"use client";
import { useState } from "react";

const RENAMES = [
  { from: "PO-2026-MAY01", to: "PO-2026-MAY03", supplier: "Zhang Sheng" },
  { from: "PO-2026-MAY02", to: "PO-2026-MAY01", supplier: "Nancy" },
  { from: "PO-2026-MAY03", to: "PO-2026-MAY02", supplier: "Anna" },
];

export default function ReorderPOsPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunDone, setDryRunDone] = useState(false);

  async function runDryRun() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renames: RENAMES, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
      setDryRunDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyRenames() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renames: RENAMES }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
      setDryRunDone(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Reorder May PO Numbers</h1>
      <p className="text-gray-500 mb-6 text-sm">
        This one-time tool swaps MAY PO numbers to match the correct supplier order.
      </p>

      <table className="w-full text-sm border mb-6">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Supplier</th>
            <th className="p-2 border">Current PO</th>
            <th className="p-2 border">New PO</th>
          </tr>
        </thead>
        <tbody>
          {RENAMES.map((r) => (
            <tr key={r.from}>
              <td className="p-2 border">{r.supplier}</td>
              <td className="p-2 border font-mono text-red-600">{r.from}</td>
              <td className="p-2 border font-mono text-green-600">{r.to}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-3">
        <button
          onClick={runDryRun}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
        >
          {loading && !dryRunDone ? "Checking..." : "Dry Run (Preview)"}
        </button>
        {dryRunDone && (
          <button
            onClick={applyRenames}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {loading ? "Applying..." : "Confirm & Apply"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-gray-50 border rounded text-sm">
          {result.dryRun ? (
            <>
              <p className="font-semibold text-green-700 mb-2">
                Dry run OK — all {result.plan.length} POs found. Click Confirm to apply.
              </p>
              <ul className="space-y-1">
                {result.plan.map((p: any) => (
                  <li key={p.id}>
                    <span className="font-mono">{p.from}</span> ({p.supplierName}) →{" "}
                    <span className="font-mono text-green-700">{p.to}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-semibold text-green-700">
              Done! Renamed {result.renamed?.length} POs successfully.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
