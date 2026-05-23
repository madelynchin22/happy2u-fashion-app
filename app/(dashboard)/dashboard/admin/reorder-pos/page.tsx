"use client";
import { useState } from "react";

// Desired slot order for the first 3 MAY POs (sorted by current poNumber):
// slot 0 (current MAY01 / Zhang Sheng) → gets position 3
// slot 1 (current MAY02 / Nancy)        → gets position 1
// slot 2 (current MAY03 / Anna)         → gets position 2
// Expressed as: result[i] = actual_pos[SWAP[i]]
// We just rename: pos[0]→pos[2], pos[1]→pos[0], pos[2]→pos[1]
// which gives us: Nancy=slot1, Anna=slot2, ZhangSheng=slot3

type PO = { id: string; poNumber: string; supplier: string };
type Step = "idle" | "preview" | "done";

export default function ReorderPOsPage() {
  const [mayPos, setMayPos] = useState<PO[]>([]);
  const [renames, setRenames] = useState<{ from: string; to: string }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");

  async function loadAndPreview() {
    setLoading(true);
    setError(null);
    try {
      // Step 1: load actual PO numbers from DB
      const res = await fetch("/api/purchase-orders/reorder");
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      const pos: PO[] = data.pos; // sorted by poNumber asc
      setMayPos(pos);

      if (pos.length < 3) {
        throw new Error(`Only ${pos.length} MAY POs found — expected at least 3.`);
      }

      // Step 2: build renames using actual stored PO numbers
      // pos[0]=MAY01(ZhangSheng), pos[1]=MAY02(Nancy), pos[2]=MAY03(Anna)
      // Desired: pos[0]→pos[2].slot, pos[1]→pos[0].slot, pos[2]→pos[1].slot
      const computed = [
        { from: pos[0].poNumber, to: pos[2].poNumber + "__SWAP" },
        { from: pos[1].poNumber, to: pos[0].poNumber + "__SWAP" },
        { from: pos[2].poNumber, to: pos[1].poNumber + "__SWAP" },
      ];
      // The "to" values need to be the actual slot numbers, not derived from other POs.
      // Since we're doing a circular swap of 3 items, use the actual poNumbers directly.
      const finalRenames = [
        { from: pos[0].poNumber, to: pos[2].poNumber },
        { from: pos[1].poNumber, to: pos[0].poNumber },
        { from: pos[2].poNumber, to: pos[1].poNumber },
      ];
      setRenames(finalRenames);
      setStep("preview");
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
        body: JSON.stringify({ renames }),
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

  const [p0, p1, p2] = mayPos;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Reorder May 2026 PO Numbers</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Swaps MAY01/02/03 so the correct suppliers get the right slot numbers.
      </p>

      <h2 className="font-semibold text-sm mb-2 text-gray-700">Target result after swap</h2>
      <table className="w-full text-sm border mb-6">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Slot</th>
            <th className="p-2 border">Supplier</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["MAY01", "Nancy"], ["MAY02", "Anna"], ["MAY03", "Zhang Sheng"],
            ["MAY04", "Ms Sweet"], ["MAY05", "Tina Real Shoes"], ["MAY06", "Jojo"],
            ["MAY07", "Sophia"], ["MAY08", "Nancy (2nd)"], ["MAY09", "Ms Sweet (2nd)"],
          ].map(([slot, supplier]) => (
            <tr key={slot} className={["MAY01","MAY02","MAY03"].includes(slot) ? "bg-yellow-50" : ""}>
              <td className="p-2 border font-mono text-xs">PO-2026-{slot}</td>
              <td className="p-2 border">{supplier}</td>
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
          <h2 className="font-semibold text-sm mb-2 text-gray-700">Renames to apply</h2>
          <table className="w-full text-sm border mb-4">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border">Current PO</th>
                <th className="p-2 border">New PO</th>
              </tr>
            </thead>
            <tbody>
              {renames.map((r) => (
                <tr key={r.from}>
                  <td className="p-2 border font-mono text-red-600">{r.from}</td>
                  <td className="p-2 border font-mono text-green-600">{r.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mb-3">
            All MAY POs found: {mayPos.map(p => p.poNumber).join(", ")}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setStep("idle")} className="px-4 py-2 bg-gray-100 border rounded text-sm">
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
