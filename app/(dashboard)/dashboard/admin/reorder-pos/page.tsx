"use client";
import { useState } from "react";

// Desired final assignment (for display only)
const DESIRED = [
  { poNumber: "PO-2026-MAY01", supplier: "Nancy" },
  { poNumber: "PO-2026-MAY02", supplier: "Anna" },
  { poNumber: "PO-2026-MAY03", supplier: "Zhang Sheng" },
  { poNumber: "PO-2026-MAY04", supplier: "Ms Sweet" },
  { poNumber: "PO-2026-MAY05", supplier: "Tina Real Shoes" },
  { poNumber: "PO-2026-MAY06", supplier: "Jojo" },
  { poNumber: "PO-2026-MAY07", supplier: "Sophia" },
  { poNumber: "PO-2026-MAY08", supplier: "Nancy" },
  { poNumber: "PO-2026-MAY09", supplier: "Ms Sweet" },
];

// Explicit renames — derived from known current state (Image screenshot)
const RENAMES = [
  { from: "PO-2026-MAY01", to: "PO-2026-MAY03", note: "Zhang Sheng → slot 03" },
  { from: "PO-2026-MAY02", to: "PO-2026-MAY01", note: "Nancy → slot 01" },
  { from: "PO-2026-MAY03", to: "PO-2026-MAY02", note: "Anna → slot 02" },
];

export default function ReorderPOsPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");

  async function preview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renames: RENAMES.map(({ from, to }) => ({ from, to })), dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
      setResult(data);
      setStep("preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renames: RENAMES.map(({ from, to }) => ({ from, to })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
      setResult(data);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Reorder May 2026 PO Numbers</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Swaps MAY01/02/03 to correct supplier order. MAY04–09 are already correct.
      </p>

      <h2 className="font-semibold text-sm mb-2 text-gray-700">Changes to apply</h2>
      <table className="w-full text-sm border mb-6">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Current PO</th>
            <th className="p-2 border">New PO</th>
            <th className="p-2 border">Note</th>
          </tr>
        </thead>
        <tbody>
          {RENAMES.map((r) => (
            <tr key={r.from}>
              <td className="p-2 border font-mono text-red-600">{r.from}</td>
              <td className="p-2 border font-mono text-green-600">{r.to}</td>
              <td className="p-2 border text-gray-500 text-xs">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="font-semibold text-sm mb-2 text-gray-700">Full target assignment</h2>
      <table className="w-full text-sm border mb-6">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">PO Number</th>
            <th className="p-2 border">Supplier</th>
          </tr>
        </thead>
        <tbody>
          {DESIRED.map((d) => (
            <tr key={d.poNumber} className={RENAMES.some(r => r.to === d.poNumber || r.from === d.poNumber) ? "bg-yellow-50" : ""}>
              <td className="p-2 border font-mono">{d.poNumber}</td>
              <td className="p-2 border">{d.supplier}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {step === "idle" && (
        <button
          onClick={preview}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
        >
          {loading ? "Checking..." : "Preview Changes"}
        </button>
      )}

      {step === "preview" && result?.plan && (
        <>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm mb-4">
            <p className="font-semibold text-blue-700 mb-2">Ready to apply — {result.plan.length} renames:</p>
            <ul className="space-y-1">
              {result.plan.map((p: any) => (
                <li key={p.id} className="font-mono">
                  {p.from}{p.supplier ? ` (${p.supplier})` : ""} → <span className="text-green-700">{p.to}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("idle")} className="px-4 py-2 bg-gray-100 border rounded text-sm">
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              {loading ? "Applying..." : "Confirm & Apply"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          <p className="font-semibold mb-1">Done! {result?.renamed?.length} POs renamed.</p>
          {result?.renamed?.map((r: any) => (
            <div key={r.id} className="font-mono">
              {r.from} → {r.to}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm break-all">
          {error}
        </div>
      )}
    </div>
  );
}
