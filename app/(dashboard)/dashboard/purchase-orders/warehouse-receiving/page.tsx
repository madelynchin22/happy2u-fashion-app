"use client";
import { useEffect, useState, useCallback } from "react";
import { Warehouse, ChevronRight, CheckCircle2, AlertTriangle, PackageCheck } from "lucide-react";
import { POTabs } from "@/components/layout/POTabs";

// ─── Types ────────────────────────────────────────────────────────────────────

const SIZES = [35, 36, 37, 38, 39, 40, 41, 42] as const;

type POItem = {
  id: string;
  colorName: string | null;
  h2uSku: string | null;
  supplierSku: string | null;
  totalPairs: number;
} & { [K in `qty${typeof SIZES[number]}`]: number };

type ReceiptItem = {
  id: string;
  poItemId: string;
  colorName: string | null;
  orderedQty: number;
  receivedQty: number | null;
  defectQty: number | null;
  notes: string | null;
  defectResolution: string | null;
  defectResolutionNotes: string | null;
  postedToInventory: boolean;
} & { [K in `receivedQty${typeof SIZES[number]}`]?: number | null } & { [K in `defectQty${typeof SIZES[number]}`]?: number | null };

type Outlet = { id: string; name: string; marking: string };

type WarehouseDelivery = {
  id: string;
  outletId: string;
  status: string;
  outlet: Outlet;
  receiptItems: ReceiptItem[];
};

type WarehousePO = {
  id: string;
  poNumber: string;
  productName: string | null;
  brand: string | null;
  shipDate: string | null;
  manufacturer: { name: string };
  items: POItem[];
  outletDeliveries: WarehouseDelivery[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const RESOLUTION_LABEL: Record<string, string> = {
  return_to_supplier: "Ship back to supplier to fix",
  other: "Other",
};

// ─── SKU Card ─────────────────────────────────────────────────────────────────

function SKUCard({ po, item, onSaved }: { po: WarehousePO; item: POItem; onSaved: () => void }) {
  const delivery = po.outletDeliveries[0];
  const existingRI = delivery?.receiptItems.find(ri => ri.poItemId === item.id);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<Record<number, string>>({});
  const [defect, setDefect] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  function initInputs() {
    const r: Record<number, string> = {};
    const d: Record<number, string> = {};
    for (const sz of SIZES) {
      const rv = (existingRI as any)?.[`receivedQty${sz}`];
      const dv = (existingRI as any)?.[`defectQty${sz}`];
      r[sz] = rv != null ? String(rv) : "";
      d[sz] = dv != null ? String(dv) : "";
    }
    setReceived(r);
    setDefect(d);
    setNotes(existingRI?.notes ?? "");
    setResolution(existingRI?.defectResolution ?? "");
    setResolutionNotes(existingRI?.defectResolutionNotes ?? "");
  }

  function toggle() {
    if (!open) initInputs();
    setError(null);
    setOpen(v => !v);
  }

  const totalReceived = SIZES.reduce((s, sz) => s + (Number(received[sz]) || 0), 0);
  const totalDefect   = SIZES.reduce((s, sz) => s + (Number(defect[sz])   || 0), 0);
  const totalGood     = totalReceived - totalDefect;
  const anyEntered    = SIZES.some(sz => received[sz] !== "" || defect[sz] !== "");
  const needsResolution = totalDefect > 0;

  async function save() {
    if (!delivery) return;
    setSaving(true);
    setError(null);
    const payload: Record<string, any> = {
      ...(existingRI ? { id: existingRI.id } : {}),
      poItemId: item.id,
      colorName: item.colorName ?? null,
      orderedQty: item.totalPairs,
      notes: notes || null,
      defectResolution: needsResolution ? (resolution || null) : null,
      defectResolutionNotes: needsResolution ? (resolutionNotes || null) : null,
    };
    for (const sz of SIZES) {
      payload[`receivedQty${sz}`] = received[sz] !== "" ? Number(received[sz]) : null;
      payload[`defectQty${sz}`]   = defect[sz]   !== "" ? Number(defect[sz])   : null;
    }
    await fetch(`/api/outlet-deliveries/${delivery.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualArrival: new Date().toISOString(), receiptItems: [payload] }),
    });
    setSaving(false);
    onSaved();
  }

  async function addToInventory() {
    if (!existingRI) return;
    setPosting(true);
    setError(null);
    const res = await fetch(`/api/warehouse-receipt/${existingRI.id}/inventory`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPosting(false);
    if (!res.ok) { setError(data.error ?? "Failed to add to inventory"); return; }
    onSaved();
  }

  const skuCode = item.h2uSku?.match(/^(S\d+)/i)?.[1] ?? item.h2uSku ?? "";
  const colour  = item.colorName ?? "";
  const skuLabel = [skuCode, colour].filter(Boolean).join(" ");

  const isDone = existingRI?.receivedQty != null;
  const hasUnresolvedDefect = (existingRI?.defectQty ?? 0) > 0 && !existingRI?.defectResolution;
  const posted = existingRI?.postedToInventory ?? false;
  const canPost = isDone && !posted && !hasUnresolvedDefect;

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
            <span className="text-xs text-gray-500">{item.totalPairs} pairs ordered</span>
            {posted && (
              <span className="flex items-center gap-1 text-[11px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                <PackageCheck size={11} /> In inventory
              </span>
            )}
            {!posted && isDone && !hasUnresolvedDefect && (
              <span className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 size={11} /> Received
              </span>
            )}
            {hasUnresolvedDefect && (
              <span className="flex items-center gap-1 text-[11px] text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> Defect needs resolution
              </span>
            )}
          </div>
          {item.supplierSku && <p className="text-[11px] text-gray-400 pl-0.5">Supplier SKU: {item.supplierSku}</p>}
        </div>
        <ChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </div>

      {/* Receipt form */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left pr-3 pb-1.5 text-gray-500 uppercase tracking-wide">Size</th>
                  {SIZES.map(sz => (
                    <th key={sz} className="px-1.5 pb-1.5 text-center text-gray-500 font-medium w-14">EU{sz}</th>
                  ))}
                  <th className="pl-3 pb-1.5 text-center text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="pr-3 py-1.5 text-gray-500">Ordered</td>
                  {SIZES.map(sz => (
                    <td key={sz} className="px-1.5 py-1.5 text-center text-gray-500">{(item as any)[`qty${sz}`] || 0}</td>
                  ))}
                  <td className="pl-3 py-1.5 text-center font-medium text-gray-600">{item.totalPairs}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="pr-3 py-1.5 text-gray-700 font-medium">Received ✓</td>
                  {SIZES.map(sz => (
                    <td key={sz} className="px-1 py-1">
                      <input type="number" min="0" placeholder="0" className="input text-xs w-12 text-center px-1"
                        value={received[sz] ?? ""} onChange={e => setReceived(prev => ({ ...prev, [sz]: e.target.value }))} />
                    </td>
                  ))}
                  <td className="pl-3 py-1.5 text-center font-semibold text-gray-800">{totalReceived}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="pr-3 py-1.5 text-gray-700 font-medium">Defects ✗</td>
                  {SIZES.map(sz => (
                    <td key={sz} className="px-1 py-1">
                      <input type="number" min="0" placeholder="0" className="input text-xs w-12 text-center px-1"
                        value={defect[sz] ?? ""} onChange={e => setDefect(prev => ({ ...prev, [sz]: e.target.value }))} />
                    </td>
                  ))}
                  <td className="pl-3 py-1.5 text-center font-semibold text-red-600">{totalDefect}</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="pr-3 py-1.5 text-gray-700 font-medium">Good stock</td>
                  {SIZES.map(sz => {
                    const g = (Number(received[sz]) || 0) - (Number(defect[sz]) || 0);
                    return <td key={sz} className="px-1.5 py-1.5 text-center text-gray-500">{anyEntered ? g : "—"}</td>;
                  })}
                  <td className="pl-3 py-1.5 text-center font-semibold text-green-700">{anyEntered ? totalGood : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <input type="text" placeholder="Notes (optional)" className="input text-xs w-full"
            value={notes} onChange={e => setNotes(e.target.value)} />

          {needsResolution && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {totalDefect} defective pair{totalDefect !== 1 ? "s" : ""} — record a resolution
              </p>
              <select className="input text-xs w-full" value={resolution} onChange={e => setResolution(e.target.value)}>
                <option value="">Select resolution…</option>
                <option value="return_to_supplier">Ship back to supplier to fix</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Resolution notes…" className="input text-xs w-full"
                value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-xs px-4">
              {saving ? "Saving…" : "Save receipt"}
            </button>
            <button
              onClick={addToInventory}
              disabled={!canPost || posting}
              title={!isDone ? "Save the receipt first" : hasUnresolvedDefect ? "Resolve the defect first" : posted ? "Already posted" : ""}
              className="btn-secondary text-xs px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posted ? "✓ In inventory" : posting ? "Adding…" : "Add to Inventory"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PO Block ─────────────────────────────────────────────────────────────────

function POBlock({ po, onSaved }: { po: WarehousePO; onSaved: () => void }) {
  const delivery = po.outletDeliveries[0];
  const allDone = po.items.length > 0 && po.items.every(item =>
    delivery?.receiptItems.some(ri => ri.poItemId === item.id && ri.receivedQty != null)
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-gray-900">{po.poNumber}</span>
          {po.brand && <span className="text-xs font-medium text-gray-500">{po.brand}</span>}
          {po.productName && <span className="text-xs text-gray-400">{po.productName}</span>}
          <span className="text-xs text-gray-400">· {po.manufacturer.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {delivery?.outlet && <span className="font-mono">{delivery.outlet.marking}</span>}
          {po.shipDate && <span>Shipped: <span className="text-gray-600 font-medium">{fmt(po.shipDate)}</span></span>}
          {allDone && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium text-[11px]">All receipts done</span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {po.items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No items on this PO</p>
        ) : (
          po.items.map(item => <SKUCard key={item.id} po={po} item={item} onSaved={onSaved} />)
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WarehouseReceivingPage() {
  const [pos, setPos] = useState<WarehousePO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/warehouse-receipt")
      .then(r => r.json())
      .then(d => { setPos(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <POTabs />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={20} className="text-brand-600" />
            China Warehouse Receiving
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            QC incoming supplier batches at the CN warehouse — record quantities per size, resolve defects, and add good stock to inventory
          </p>
        </div>
        {!loading && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">{pos.length}</p>
            <p className="text-xs text-gray-400">PO{pos.length !== 1 ? "s" : ""} routed via warehouse</p>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>}

      {!loading && pos.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-16 text-center">
          <Warehouse size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No POs awaiting warehouse receipt</p>
          <p className="text-xs text-gray-300 mt-1">
            Check "Ship to CN Warehouse" on a PO and submit it to see it here
          </p>
        </div>
      )}

      {!loading && pos.map(po => <POBlock key={po.id} po={po} onSaved={load} />)}
    </div>
  );
}
