"use client";
import { useEffect, useState, useCallback } from "react";
import { Store, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type POItem = {
  id: string;
  colorName: string | null;
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

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", in_transit: "In Transit", arrived: "Arrived", receipt_done: "Receipt Done",
};
const STATUS_STYLE: Record<string, string> = {
  pending:      "bg-gray-100 text-gray-500",
  in_transit:   "bg-amber-100 text-amber-700",
  arrived:      "bg-blue-100 text-blue-700",
  receipt_done: "bg-green-100 text-green-700",
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function allocatedItems(po: ShippedPO, outletId: string): POItem[] {
  return po.items.filter(item => {
    if (!item.outletAllocations) return false;
    try { return JSON.parse(item.outletAllocations).some((a: any) => a.outletId === outletId); }
    catch { return false; }
  });
}

function orderedForAlloc(item: POItem, outletId: string): number {
  if (!item.outletAllocations) return 0;
  try {
    const alloc = JSON.parse(item.outletAllocations).find((a: any) => a.outletId === outletId);
    return alloc ? [36,37,38,39,40,41,42].reduce((s: number, sz: number) => s + (alloc[`qty${sz}`] || 0), 0) : 0;
  } catch { return 0; }
}

// ─── Outlet Card ──────────────────────────────────────────────────────────────

function OutletCard({ po, d, onSaved }: { po: ShippedPO; d: OutletDelivery; onSaved: () => void }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows]   = useState<{ received: string; defect: string; notes: string }[]>([]);

  function initRows() {
    const source = d.receiptItems.length > 0
      ? d.receiptItems.map(ri => ({
          received: ri.receivedQty != null ? String(ri.receivedQty) : "",
          defect:   ri.defectQty   != null ? String(ri.defectQty)   : "",
          notes:    ri.notes ?? "",
        }))
      : allocatedItems(po, d.outletId).map(() => ({ received: "", defect: "", notes: "" }));
    setRows(source);
  }

  function toggle() {
    if (!open) initRows();
    setOpen(v => !v);
  }

  function update(idx: number, field: "received" | "defect" | "notes", val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  async function save() {
    setSaving(true);
    const usingExisting = d.receiptItems.length > 0;
    const source = usingExisting ? d.receiptItems : allocatedItems(po, d.outletId);

    const receiptItems = source.map((item, idx) => {
      const r = rows[idx] ?? { received: "", defect: "", notes: "" };
      const ordered = "outletAllocations" in item
        ? orderedForAlloc(item as POItem, d.outletId)
        : (item as ReceiptItem).orderedQty;
      return {
        ...(usingExisting ? { id: item.id } : {}),
        poItemId:   usingExisting ? (item as ReceiptItem).poItemId : (item as POItem).id,
        colorName:  item.colorName ?? null,
        orderedQty: ordered,
        receivedQty: r.received !== "" ? Number(r.received) : null,
        defectQty:   r.defect   !== "" ? Number(r.defect)   : null,
        notes:       r.notes || null,
      };
    });

    await fetch(`/api/outlet-deliveries/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "receipt_done",
        actualArrival: d.actualArrival ?? new Date().toISOString(),
        receiptItems,
      }),
    });
    setSaving(false);
    setOpen(false);
    onSaved();
  }

  const items = d.receiptItems.length > 0 ? d.receiptItems : allocatedItems(po, d.outletId);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-gray-800">{d.outlet.name}</span>
          <span className="text-xs text-gray-400 font-mono">{d.outlet.marking}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[d.status] ?? "bg-gray-100 text-gray-500"}`}>
            {STATUS_LABEL[d.status] ?? d.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {d.actualArrival
            ? <span>Arrived: <span className="font-medium text-gray-700">{fmt(d.actualArrival)}</span></span>
            : d.estimatedArrival
            ? <span className="text-gray-400">Est: {fmt(d.estimatedArrival)}</span>
            : null}
          <ChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </div>
      </div>

      {/* Receipt form */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wide">
                <th className="text-left pb-1.5 pr-3">Colour</th>
                <th className="text-center pb-1.5 px-2 w-20">Ordered</th>
                <th className="text-center pb-1.5 px-2 w-24">Received ✓</th>
                <th className="text-center pb-1.5 px-2 w-24">Defects ✗</th>
                <th className="text-center pb-1.5 px-2 w-20">Good stock</th>
                <th className="text-left pb-1.5 pl-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const r = rows[idx] ?? { received: "", defect: "", notes: "" };
                const good = (Number(r.received) || 0) - (Number(r.defect) || 0);
                const ordered = "outletAllocations" in item
                  ? orderedForAlloc(item as POItem, d.outletId)
                  : (item as ReceiptItem).orderedQty;
                return (
                  <tr key={idx}>
                    <td className="pr-3 py-1.5 font-medium text-gray-800">{item.colorName ?? "—"}</td>
                    <td className="text-center px-2 py-1.5 text-gray-500">{ordered}</td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" placeholder="0"
                        className="input text-xs w-full text-center"
                        value={r.received} onChange={e => update(idx, "received", e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" placeholder="0"
                        className="input text-xs w-full text-center"
                        value={r.defect} onChange={e => update(idx, "defect", e.target.value)} />
                    </td>
                    <td className="text-center px-2 py-1.5 font-semibold text-gray-800">
                      {r.received !== "" ? good : "—"}
                    </td>
                    <td className="pl-2 py-1.5">
                      <input type="text" placeholder="e.g. 2 pairs torn seam"
                        className="input text-xs w-full"
                        value={r.notes} onChange={e => update(idx, "notes", e.target.value)} />
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
  const allDone = po.outletDeliveries.length > 0 && po.outletDeliveries.every(d => d.status === "receipt_done");

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

      {/* Outlet cards */}
      <div className="p-3 space-y-2">
        {po.outletDeliveries.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No outlet allocations for this PO</p>
        ) : (
          po.outletDeliveries.map(d => (
            <OutletCard key={d.id} po={po} d={d} onSaved={onSaved} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutletReceiptPage() {
  const [pos, setPos]     = useState<ShippedPO[]>([]);
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={20} className="text-brand-600" />
            Outlet Receipt Submit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record goods receipt per outlet for all shipped purchase orders
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
