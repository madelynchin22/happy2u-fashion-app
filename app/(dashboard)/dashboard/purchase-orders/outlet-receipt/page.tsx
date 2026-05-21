"use client";
import { useEffect, useState, useCallback } from "react";
import { Store, ChevronRight, CheckCircle2 } from "lucide-react";
import { POTabs } from "@/components/layout/POTabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type POItem = {
  id: string;
  colorName: string | null;
  h2uSku: string | null;
  outletAllocations: string | null;
  totalPairs: number;
};

type ReceiptItem = {
  id: string;
  poItemId: string;
  colorName: string | null;
  orderedQty: number;
  receivedQty: number | null;
  defectQty: number | null;
  notes: string | null;
};

type Outlet = { id: string; name: string; marking: string };

type OutletDelivery = {
  id: string;
  outletId: string;
  status: string;
  actualArrival: string | null;
  estimatedArrival: string | null;
  outlet: Outlet;
  receiptItems: ReceiptItem[];
};

type ShippedPO = {
  id: string;
  poNumber: string;
  productName: string | null;
  brand: string | null;
  shipDate: string | null;
  manufacturer: { name: string };
  items: POItem[];
  outletDeliveries: OutletDelivery[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type OutletAlloc = { outletId: string; qty: number };

function parseItemOutlets(item: POItem): OutletAlloc[] {
  if (!item.outletAllocations) return [];
  try {
    const allocs: any[] = JSON.parse(item.outletAllocations);
    return allocs.map(a => ({
      outletId: a.outletId,
      qty: [36, 37, 38, 39, 40, 41, 42].reduce((s: number, sz: number) => s + (a[`qty${sz}`] || 0), 0),
    })).filter(x => x.outletId && x.qty > 0);
  } catch { return []; }
}

// ─── SKU Card ─────────────────────────────────────────────────────────────────

type OutletRow = {
  outletId: string;
  outletName: string;
  outletMarking: string;
  deliveryId: string;
  orderedQty: number;
  existingRI: ReceiptItem | undefined;
};

function SKUCard({ po, item, onSaved }: { po: ShippedPO; item: POItem; onSaved: () => void }) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<{ received: string; defect: string; notes: string }[]>([]);

  const deliveryMap = new Map(po.outletDeliveries.map(d => [d.outletId, d]));
  const outletAllocs = parseItemOutlets(item).filter(a => deliveryMap.has(a.outletId));

  const outletRows: OutletRow[] = outletAllocs.map(a => {
    const d = deliveryMap.get(a.outletId)!;
    return {
      outletId: a.outletId,
      outletName: d.outlet.name,
      outletMarking: d.outlet.marking,
      deliveryId: d.id,
      orderedQty: a.qty,
      existingRI: d.receiptItems.find(ri => ri.poItemId === item.id),
    };
  });

  function initInputs() {
    setInputs(outletRows.map(r => ({
      received: r.existingRI?.receivedQty != null ? String(r.existingRI.receivedQty) : "",
      defect:   r.existingRI?.defectQty   != null ? String(r.existingRI.defectQty)   : "",
      notes:    r.existingRI?.notes ?? "",
    })));
  }

  function toggle() {
    if (!open) initInputs();
    setOpen(v => !v);
  }

  function update(idx: number, field: "received" | "defect" | "notes", val: string) {
    setInputs(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  async function save() {
    setSaving(true);
    const delivery = po.outletDeliveries[0]; // used only for arrival fallback below
    void delivery;

    await Promise.all(
      outletRows.map(async (row, idx) => {
        const inp = inputs[idx] ?? { received: "", defect: "", notes: "" };
        if (inp.received === "" && inp.defect === "" && inp.notes === "") return;

        const d = deliveryMap.get(row.outletId)!;
        await fetch(`/api/outlet-deliveries/${row.deliveryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualArrival: d.actualArrival ?? new Date().toISOString(),
            receiptItems: [{
              ...(row.existingRI ? { id: row.existingRI.id } : {}),
              poItemId:    item.id,
              colorName:   item.colorName ?? null,
              orderedQty:  row.orderedQty,
              receivedQty: inp.received !== "" ? Number(inp.received) : null,
              defectQty:   inp.defect   !== "" ? Number(inp.defect)   : null,
              notes:       inp.notes || null,
            }],
          }),
        });
      })
    );

    setSaving(false);
    setOpen(false);
    onSaved();
  }

  const skuCode = item.h2uSku?.match(/^(S\d+)/i)?.[1] ?? item.h2uSku ?? "";
  const colour  = item.colorName ?? "";
  const skuLabel = [skuCode, colour].filter(Boolean).join(" ");

  // Header summary: outlet short names + qty
  const outletSummary = outletRows.map(r => `${r.outletMarking} ×${r.orderedQty}`).join(" · ");

  // How many outlets have already receipted this specific item
  const doneCount = outletRows.filter(r => r.existingRI?.receivedQty != null).length;
  const allDone   = doneCount === outletRows.length && outletRows.length > 0;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={toggle}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-gray-800">{skuLabel || "—"}</span>
            <span className="text-xs text-gray-500">{item.totalPairs} pairs</span>
            {allDone && (
              <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 size={11} /> All received
              </span>
            )}
            {!allDone && doneCount > 0 && (
              <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                {doneCount}/{outletRows.length} outlets done
              </span>
            )}
          </div>
          {outletSummary && (
            <p className="text-[11px] text-gray-400 pl-0.5">{outletSummary}</p>
          )}
        </div>
        <ChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </div>

      {/* Receipt form */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wide">
                <th className="text-left pb-1.5 pr-3">Outlet</th>
                <th className="text-center pb-1.5 px-2 w-20">Ordered</th>
                <th className="text-center pb-1.5 px-2 w-24">Received ✓</th>
                <th className="text-center pb-1.5 px-2 w-24">Defects ✗</th>
                <th className="text-center pb-1.5 px-2 w-20">Good stock</th>
                <th className="text-left pb-1.5 pl-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {outletRows.map((row, idx) => {
                const inp  = inputs[idx] ?? { received: "", defect: "", notes: "" };
                const good = (Number(inp.received) || 0) - (Number(inp.defect) || 0);
                const done = row.existingRI?.receivedQty != null;
                return (
                  <tr key={row.outletId} className={done ? "bg-green-50/40" : ""}>
                    <td className="pr-3 py-1.5">
                      <span className="font-medium text-gray-800">{row.outletName}</span>
                      <span className="ml-1.5 text-gray-400 font-mono text-[10px]">{row.outletMarking}</span>
                    </td>
                    <td className="text-center px-2 py-1.5 text-gray-500">{row.orderedQty}</td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" placeholder="0"
                        className="input text-xs w-full text-center"
                        value={inp.received} onChange={e => update(idx, "received", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" placeholder="0"
                        className="input text-xs w-full text-center"
                        value={inp.defect} onChange={e => update(idx, "defect", e.target.value)} />
                    </td>
                    <td className="text-center px-2 py-1.5 font-semibold text-gray-800">
                      {inp.received !== "" ? good : "—"}
                    </td>
                    <td className="pl-2 py-1.5">
                      <input type="text" placeholder="e.g. 2 pairs torn seam"
                        className="input text-xs w-full"
                        value={inp.notes} onChange={e => update(idx, "notes", e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="btn-primary text-xs px-4">
              {saving ? "Saving…" : "Save receipt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PO Block ─────────────────────────────────────────────────────────────────

function POBlock({ po, onSaved }: { po: ShippedPO; onSaved: () => void }) {
  const allDone = po.items.length > 0 && po.items.every(item => {
    const allocs = parseItemOutlets(item).filter(a =>
      po.outletDeliveries.some(d => d.outletId === a.outletId)
    );
    if (allocs.length === 0) return true;
    return allocs.every(a => {
      const d = po.outletDeliveries.find(d => d.outletId === a.outletId);
      return d?.receiptItems.some(ri => ri.poItemId === item.id && ri.receivedQty != null);
    });
  });

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* PO header */}
      <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-gray-900">{po.poNumber}</span>
          {po.brand && <span className="text-xs font-medium text-gray-500">{po.brand}</span>}
          {po.productName && <span className="text-xs text-gray-400">{po.productName}</span>}
          <span className="text-xs text-gray-400">· {po.manufacturer.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {po.shipDate && <span>Shipped: <span className="text-gray-600 font-medium">{fmt(po.shipDate)}</span></span>}
          {allDone && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium text-[11px]">All receipts done</span>
          )}
        </div>
      </div>

      {/* SKU cards */}
      <div className="p-3 space-y-2">
        {po.items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No shipped items for this PO</p>
        ) : (
          po.items.map(item => (
            <SKUCard key={item.id} po={po} item={item} onSaved={onSaved} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutletReceiptPage() {
  const [pos, setPos]         = useState<ShippedPO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/outlet-receipt")
      .then(r => r.json())
      .then(d => { setPos(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <POTabs />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={20} className="text-brand-600" />
            Outlet Receipt Submit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record goods receipt per SKU for all shipped purchase orders
          </p>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">{pos.length}</p>
            <p className="text-xs text-gray-400">PO{pos.length !== 1 ? "s" : ""} awaiting receipt</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      )}

      {!loading && pos.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-16 text-center">
          <Store size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No shipped POs awaiting receipt</p>
          <p className="text-xs text-gray-300 mt-1">POs will appear here once their status is set to Shipped</p>
        </div>
      )}

      {!loading && pos.map(po => (
        <POBlock key={po.id} po={po} onSaved={load} />
      ))}
    </div>
  );
}
