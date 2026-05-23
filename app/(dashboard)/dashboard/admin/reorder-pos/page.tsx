"use client";
import { useState } from "react";

// Desired final assignment: poNumber → supplierName (in order)
// Where a supplier appears twice, earlier slot gets the lower-numbered current PO.
const DESIRED: { poNumber: string; supplier: string }[] = [
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

type CurrentPO = { id: string; poNumber: string; supplierName: string };
type Rename = { from: string; to: string; supplier: string };

function computeRenames(current: CurrentPO[]): Rename[] {
  // Group current POs by supplier name (normalised to lowercase for matching)
  const bySupplier: Record<string, CurrentPO[]> = {};
  for (const po of current) {
    const key = po.supplierName?.toLowerCase().trim() ?? "";
    bySupplier[key] = [...(bySupplier[key] ?? []), po];
  }
  // Sort each group by current poNumber so first occurrence gets the lower slot
  for (const key of Object.keys(bySupplier)) {
    bySupplier[key].sort((a, b) => a.poNumber.localeCompare(b.poNumber));
  }

  const usedSupplier: Record<string, number> = {};
  const renames: Rename[] = [];

  for (const slot of DESIRED) {
    const key = slot.supplier.toLowerCase().trim();
    const idx = usedSupplier[key] ?? 0;
    usedSupplier[key] = idx + 1;
    const po = bySupplier[key]?.[idx];
    if (!po) continue;
    if (po.poNumber !== slot.poNumber) {
      renames.push({ from: po.poNumber, to: slot.poNumber, supplier: po.supplierName });
    }
  }
  return renames;
}

export default function ReorderPOsPage() {
  const [current, setCurrent] = useState<CurrentPO[] | null>(null);
  const [renames, setRenames] = useState<Rename[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");

  async function loadAndPreview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load POs");
      const pos: CurrentPO[] = data.pos;
      setCurrent(pos);
      const computed = computeRenames(pos);
      setRenames(computed);
      setStep("preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyRenames() {
    if (!renames.length) return;
    setLoading(true);
    setError(null);
    try {
      const payload = renames.map((r) => ({ from: r.from, to: r.to }));
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renames: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Reorder May 2026 PO Numbers</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Reassigns PO numbers so each supplier gets the correct MAY slot.
      </p>

      <h2 className="font-semibold text-sm mb-2 text-gray-700">Target assignment</h2>
      <table className="w-full text-sm border mb-6">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">PO Number</th>
            <th className="p-2 border">Supplier</th>
          </tr>
        </thead>
        <tbody>
          {DESIRED.map((d) => (
            <tr key={d.poNumber}>
              <td className="p-2 border font-mono">{d.poNumber}</td>
              <td className="p-2 border">{d.supplier}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {step === "idle" && (
        <button
          onClick={loadAndPreview}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
        >
          {loading ? "Loading..." : "Preview Changes"}
        </button>
      )}

      {step === "preview" && (
        <>
          <h2 className="font-semibold text-sm mb-2 text-gray-700">Current state (all MAY POs)</h2>
          <table className="w-full text-sm border mb-4">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border">Current PO</th>
                <th className="p-2 border">Supplier</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {(current ?? []).map((po) => {
                const rename = renames.find((r) => r.from === po.poNumber);
                return (
                  <tr key={po.id}>
                    <td className="p-2 border font-mono">{po.poNumber}</td>
                    <td className="p-2 border">{po.supplierName}</td>
                    <td className="p-2 border">
                      {rename ? (
                        <span className="text-blue-700 font-mono">→ {rename.to}</span>
                      ) : (
                        <span className="text-gray-400">no change</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {renames.length === 0 ? (
            <p className="text-green-700 font-semibold text-sm">
              All PO numbers already match the target — nothing to change.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {renames.length} PO(s) will be renamed. Click Confirm to apply.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("idle")}
                  className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={applyRenames}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  {loading ? "Applying..." : "Confirm & Apply"}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {step === "done" && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          Done! {result?.renamed?.length} PO(s) renamed successfully.
          <div className="mt-2 space-y-1">
            {result?.renamed?.map((r: any) => (
              <div key={r.id} className="font-mono">
                {r.from} ({r.supplierName}) → {r.to}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
