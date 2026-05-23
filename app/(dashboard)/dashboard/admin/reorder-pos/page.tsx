"use client";
import { useState } from "react";

type PO = { id: string; poNumber: string };
type Step = "idle" | "preview" | "done";

export default function ReorderPOsPage() {
  const [mayPos, setMayPos] = useState<PO[]>([]);
  const [swaps, setSwaps] = useState<{ id: string; newPoNumber: string; from: string }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");

  async function loadAndPreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder");
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));

      const pos: PO[] = data.pos; // sorted by poNumber asc
      setMayPos(pos);

      if (pos.length < 3) {
        throw new Error(`Only ${pos.length} MAY POs found — expected at least 3.\nFound: ${JSON.stringify(pos)}`);
      }

      // pos[0]=slot1(ZhangSheng), pos[1]=slot2(Nancy), pos[2]=slot3(Anna)
      // Desired: Nancy→slot1, Anna→slot2, ZhangSheng→slot3
      // So: pos[0] takes pos[2]'s number, pos[1] takes pos[0]'s number, pos[2] takes pos[1]'s number
      const computed = [
        { id: pos[0].id, from: pos[0].poNumber, newPoNumber: pos[2].poNumber },
        { id: pos[1].id, from: pos[1].poNumber, newPoNumber: pos[0].poNumber },
        { id: pos[2].id, from: pos[2].poNumber, newPoNumber: pos[1].poNumber },
      ];
      setSwaps(computed);
      setStep("preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function applySwaps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase-orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swaps: swaps.map(({ id, newPoNumber }) => ({ id, newPoNumber })) }),
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
        Swaps the first 3 MAY POs so Nancy → slot 01, Anna → slot 02, Zhang Sheng → slot 03.
      </p>

      {step === "idle" && (
        <button
          onClick={loadAndPreview}
          disabled={loading}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
        >
          {loading ? "Loading from database..." : "Preview Changes"}
        </button>
      )}

      {step === "preview" && (
        <>
          <p className="text-xs text-gray-400 mb-3">
            All MAY POs found ({mayPos.length}): {mayPos.map((p) => p.poNumber).join(", ")}
          </p>
          <h2 className="font-semibold text-sm mb-2 text-gray-700">Renames to apply</h2>
          <table className="w-full text-sm border mb-4">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border">Current PO</th>
                <th className="p-2 border">New PO</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s) => (
                <tr key={s.id}>
                  <td className="p-2 border font-mono text-red-600">{s.from}</td>
                  <td className="p-2 border font-mono text-green-600">{s.newPoNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3">
            <button onClick={() => setStep("idle")} className="px-4 py-2 bg-gray-100 border rounded text-sm">
              Cancel
            </button>
            <button
              onClick={applySwaps}
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
            <div key={r.id} className="font-mono">{r.from} → {r.to}</div>
          ))}
        </div>
      )}

      {error && (
        <pre className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs break-all whitespace-pre-wrap">
          {error}
        </pre>
      )}
    </div>
  );
}
