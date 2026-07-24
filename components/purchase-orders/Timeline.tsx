"use client";
import React from "react";
import Image from "next/image";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShipmentBatch = {
  id: string;
  pairs: number;
  shipDate?: string | null;
  arrivalDate?: string | null;
};

export type TimelinePO = {
  date: string;
  deliveryDate?: string;
  items: {
    id: string;
    h2uSku?: string;
    photoUrl?: string | null;
    colorName?: string;
    totalPairs: number;
    itemShipDate?: string | null;
    shipmentBatches?: ShipmentBatch[];
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export const MAIN_SKU_RE_TL = /^(S\d{4})/i;

type Stage = { label: string; done: boolean; actual: string | null; target: string | null };

function StageBar({ stages, size }: { stages: Stage[]; size: "md" | "sm" }) {
  const dot = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  const check = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  const labelCls = size === "md" ? "text-[10px] text-gray-500" : "text-[9px] text-gray-500";
  const actualCls = size === "md" ? "text-[10px] text-gray-400" : "text-[8px] text-gray-400";
  const targetCls = size === "md" ? "text-[9px] text-amber-500" : "text-[8px] text-amber-500";
  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, i, arr) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`${dot} rounded-full border-2 flex items-center justify-center ${
              stage.done ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
            }`}>
              {stage.done && <svg className={check} fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
            </div>
            <p className={`${labelCls} whitespace-nowrap`}>{stage.label}</p>
            {stage.actual && <p className={`${actualCls} whitespace-nowrap`}>{stage.actual}</p>}
            {stage.target && <p className={`${targetCls} whitespace-nowrap`}>{stage.target}</p>}
          </div>
          {i < arr.length - 1 && (
            <div className="flex-1 h-0.5 bg-gray-200 mb-5">
              <div className="h-full bg-green-500 transition-all" style={{ width: arr[i].done ? "100%" : "0%" }} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function toInputDate(d?: string | null): string {
  return d ? d.slice(0, 10) : "";
}

// An item is "done" once every ordered pair has both shipped and arrived —
// i.e. all its shipment batches (there can be several, shipped on different
// days) together cover the full ordered quantity and each has an arrival date.
function isItemDone(item: TimelinePO["items"][0]): boolean {
  const batches = item.shipmentBatches ?? [];
  if (batches.length === 0) return false;
  const arrivedPairs = batches.filter(b => b.arrivalDate).reduce((s, b) => s + b.pairs, 0);
  return arrivedPairs >= item.totalPairs;
}

// ─── Per-line (SKU + colour) timeline & shipment batches ──────────────────────

function ItemTimeline({ item, poSentDate, targetSupplierShip, onBatchAdd, onBatchUpdate, onBatchDelete }: {
  item: TimelinePO["items"][0];
  poSentDate: Date | null;
  targetSupplierShip: Date | null;
  onBatchAdd?: (itemId: string, initial: { pairs: number }) => Promise<void>;
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
}) {
  const [local, setLocal] = React.useState<Record<string, { pairs?: number; shipDate?: string; arrivalDate?: string }>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);

  const batches = item.shipmentBatches ?? [];

  const val = (b: ShipmentBatch, field: "pairs" | "shipDate" | "arrivalDate") => {
    const l = local[b.id];
    if (l && field in l) return l[field] as any;
    if (field === "pairs") return b.pairs;
    return toInputDate(b[field]);
  };

  function setLocalField(batchId: string, field: "pairs" | "shipDate" | "arrivalDate", value: any) {
    setLocal(prev => ({ ...prev, [batchId]: { ...prev[batchId], [field]: value } }));
  }

  async function commit(batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) {
    setSaving(prev => ({ ...prev, [batchId]: true }));
    if (onBatchUpdate) await onBatchUpdate(batchId, fields);
    setSaving(prev => ({ ...prev, [batchId]: false }));
  }

  async function addBatch() {
    const remaining = Math.max(0, item.totalPairs - batches.reduce((s, b) => s + b.pairs, 0));
    setAdding(true);
    if (onBatchAdd) await onBatchAdd(item.id, { pairs: remaining });
    setAdding(false);
  }

  async function removeBatch(batchId: string) {
    setSaving(prev => ({ ...prev, [batchId]: true }));
    if (onBatchDelete) await onBatchDelete(batchId);
  }

  const effShipDate = (b: ShipmentBatch) => { const v = val(b, "shipDate"); return v ? new Date(v) : null; };
  const effArrivalDate = (b: ShipmentBatch) => { const v = val(b, "arrivalDate"); return v ? new Date(v) : null; };
  const effPairs = (b: ShipmentBatch) => Number(val(b, "pairs")) || 0;

  const shippedPairs = batches.reduce((s, b) => s + (effShipDate(b) ? effPairs(b) : 0), 0);
  const arrivedPairs = batches.reduce((s, b) => s + (effArrivalDate(b) ? effPairs(b) : 0), 0);

  const pendingTargets = batches
    .filter(b => effShipDate(b) && !effArrivalDate(b))
    .map(b => addDays(effShipDate(b)!, 25));
  const nextTargetArrival = pendingTargets.length > 0 ? pendingTargets.reduce((a, b) => (a < b ? a : b)) : null;

  const fullyArrived = batches.length > 0 && arrivedPairs >= item.totalPairs;
  const latestArrival = fullyArrived
    ? batches.map(effArrivalDate).filter((d): d is Date => !!d).reduce((a, b) => (a > b ? a : b))
    : null;

  const targetLaunch = latestArrival
    ? addDays(latestArrival, 3)
    : (nextTargetArrival ? addDays(nextTargetArrival, 3) : null);

  const stages: Stage[] = [
    { label: "PO Submitted", done: !!poSentDate, actual: poSentDate ? fmtDate(poSentDate) : null, target: null },
    { label: "Supplier Ship", done: shippedPairs > 0,
      actual: shippedPairs > 0 ? `${shippedPairs}/${item.totalPairs} pairs` : null,
      target: targetSupplierShip ? `Target ${fmtDate(targetSupplierShip)}` : null },
    { label: "Actual Arrival", done: arrivedPairs > 0,
      actual: arrivedPairs > 0 ? `${arrivedPairs}/${item.totalPairs} pairs` : null,
      target: nextTargetArrival ? `Target ${fmtDate(nextTargetArrival)}` : null },
    { label: "Targeted Launch", done: fullyArrived, actual: null, target: targetLaunch ? fmtDate(targetLaunch) : null },
  ];

  return (
    <div className={`pl-8 pr-4 py-2.5 border-b border-gray-50 ${fullyArrived ? "bg-green-50/40" : ""}`}>
      <div className="flex items-center gap-3 mb-2">
        {item.photoUrl ? (
          <Image src={item.photoUrl} alt={item.colorName ?? ""} width={28} height={28} className="w-7 h-7 rounded-md object-cover border border-gray-100 flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-gray-50 border border-dashed border-gray-200 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700">{item.colorName || item.h2uSku || "—"}</p>
          <p className="text-[10px] text-gray-400">{item.totalPairs} pairs ordered</p>
        </div>
        {fullyArrived && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full flex-shrink-0">
            <CheckCircle2 size={11} /> Completed
          </span>
        )}
      </div>

      <div className="mb-2.5 pl-1">
        <StageBar stages={stages} size="sm" />
      </div>

      <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
        {batches.length === 0 && (
          <p className="text-[10px] text-gray-400">No shipments recorded yet.</p>
        )}
        {batches.map(b => {
          const target = effShipDate(b) ? addDays(effShipDate(b)!, 25) : null;
          return (
            <div key={b.id} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0}
                  value={val(b, "pairs")}
                  onChange={e => setLocalField(b.id, "pairs", e.target.value === "" ? "" : Number(e.target.value))}
                  onBlur={e => commit(b.id, { pairs: Number(e.target.value) || 0 })}
                  className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <span className="text-[10px] text-gray-400">pairs</span>
              </div>
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(b, "shipDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(b.id, "shipDate", v ?? ""); commit(b.id, { shipDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">ship date</span>
              </div>
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(b, "arrivalDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(b.id, "arrivalDate", v ?? ""); commit(b.id, { arrivalDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">
                  {target ? `arrival · target ${fmtDate(target)}` : "actual arrival"}
                </span>
              </div>
              {saving[b.id] && <span className="text-[9px] text-gray-400">Saving…</span>}
              <button
                onClick={() => removeBatch(b.id)}
                className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                title="Remove this shipment"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
        <button
          onClick={addBatch}
          disabled={adding}
          className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
        >
          <Plus size={12} /> {adding ? "Adding…" : "Add shipment"}
        </button>
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function Timeline<TPO extends TimelinePO>({ po, onSave, onBatchAdd, onBatchUpdate, onBatchDelete }: {
  po: TPO;
  onSave?: (field: "shipDate" | "deliveryDate", value: string) => void;
  onBatchAdd?: (itemId: string, initial: { pairs: number }) => Promise<void>;
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
}) {
  const poSentDate   = po.date         ? new Date(po.date)         : null;
  const arriveActual = po.deliveryDate ? new Date(po.deliveryDate) : null;

  // Stage 2 — Supplier Ship: actual = earliest per-colour ship date; target = PO submit + 50d
  const shipDates    = po.items.map(i => i.itemShipDate).filter((d): d is string => !!d).map(d => new Date(d));
  const earliestShip = shipDates.length > 0 ? shipDates.reduce((a, b) => (a < b ? a : b)) : null;
  const targetSupplierShip = poSentDate ? addDays(poSentDate, 50) : null;

  // Stage 3 — Actual Arrival: actual = po.deliveryDate; target = earliest ship date + 25d
  const targetArrival = earliestShip ? addDays(earliestShip, 25) : null;

  // Stage 4 — Targeted Launch: target-only, = actual arrival + 3d (or projected from target arrival)
  const targetLaunch = arriveActual ? addDays(arriveActual, 3) : (targetArrival ? addDays(targetArrival, 3) : null);

  type SkuItem = TPO["items"][0];
  type SkuGroup = { key: string; photoUrl?: string | null; colorName?: string | null; pairs: number; items: SkuItem[] };

  // Group items by main SKU, one row per unique shoe model
  const skuMap = new Map<string, SkuGroup>();
  for (const item of po.items) {
    const key = item.h2uSku?.match(MAIN_SKU_RE_TL)?.[1]?.toUpperCase() ?? item.h2uSku ?? item.id;
    if (!skuMap.has(key)) skuMap.set(key, { key, photoUrl: item.photoUrl, colorName: item.colorName, pairs: 0, items: [] });
    const grp = skuMap.get(key)!;
    grp.pairs += item.totalPairs;
    grp.items.push(item);
  }
  const skuGroups = [...skuMap.values()];

  // A colour counts as "shipped" once at least one shipment batch has been recorded,
  // and "completed" once every ordered pair across all its batches has arrived.
  const totalGroups   = skuGroups.length;
  const shippedGroups = skuGroups.filter(g => g.items.some(i => (i.shipmentBatches?.length ?? 0) > 0)).length;
  const totalItems     = po.items.length;
  const completedItems = po.items.filter(isItemDone).length;

  return (
    <div className="space-y-4">
      {/* Per-SKU, per-colour shipment tracking — each line has its own full
          timeline, so there's no need for a duplicate overall stage bar here. */}
      {skuGroups.length > 0 && (
        <div className="border border-gray-200 rounded-xl">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 rounded-t-xl flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Shipment by SKU</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">{shippedGroups}/{totalGroups} shipped</p>
              {completedItems > 0 && (
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${completedItems === totalItems ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-600"}`}>
                  <CheckCircle2 size={11} /> {completedItems}/{totalItems} completed
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {skuGroups.map(grp => {
              const shippedInGroup   = grp.items.filter(i => (i.shipmentBatches?.length ?? 0) > 0).length;
              const completedInGroup = grp.items.filter(isItemDone).length;
              return (
                <div key={grp.key}>
                  {/* Main SKU group header */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
                    {grp.photoUrl ? (
                      <Image src={grp.photoUrl} alt={grp.key} width={28} height={28} className="w-7 h-7 rounded-md object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-gray-100 border border-dashed border-gray-200 flex-shrink-0" />
                    )}
                    <p className="text-xs font-bold text-gray-700 flex-1">{grp.key}</p>
                    {completedInGroup > 0 && (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${completedInGroup === grp.items.length ? "bg-green-100 text-green-700" : "bg-blue-50 text-blue-600"}`}>
                        <CheckCircle2 size={11} /> {completedInGroup}/{grp.items.length} completed
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${shippedInGroup === grp.items.length ? "bg-green-100 text-green-700" : shippedInGroup > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                      {shippedInGroup}/{grp.items.length} shipped
                    </span>
                  </div>
                  {/* Per-colour rows — each with its own full timeline + batches */}
                  {grp.items.map(item => (
                    <ItemTimeline
                      key={item.id}
                      item={item}
                      poSentDate={poSentDate}
                      targetSupplierShip={targetSupplierShip}
                      onBatchAdd={onBatchAdd}
                      onBatchUpdate={onBatchUpdate}
                      onBatchDelete={onBatchDelete}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {/* Arrival date */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 rounded-b-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">Actual Arrival Date</p>
              {onSave ? (
                <input type="date"
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:border-brand-400 w-28"
                  defaultValue={arriveActual ? arriveActual.toISOString().split("T")[0] : ""}
                  onChange={e => { if (e.target.value) onSave("deliveryDate", e.target.value); }}
                />
              ) : (
                <p className="text-xs text-gray-500">{arriveActual ? fmtDate(arriveActual) : "—"}</p>
              )}
            </div>
            {targetArrival && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-400">Targeted Arrival Date</p>
                <p className="text-[11px] text-amber-500">{fmtDate(targetArrival)}</p>
              </div>
            )}
            {targetLaunch && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-400">Targeted Launch Date</p>
                <p className="text-[11px] text-amber-500">{fmtDate(targetLaunch)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
