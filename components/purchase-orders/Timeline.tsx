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
  batchGroup?: string | null;
  outletId?: string | null;
};

export type TimelineOutlet = { id: string; name: string };

export type TimelineReceiptItem = {
  poItemId: string;
  receivedQty?: number | null;
  defectQty?: number | null;
  missingQty?: number | null;
};
export type TimelineOutletDelivery = { outletId: string; receiptItems: TimelineReceiptItem[] };
export type ReceiptFields = { receivedQty: number; defectQty: number; missingQty: number };

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
    outletAllocations?: string | null;
  }[];
};

const SHIPMENT_SIZE_KEYS = [36, 37, 38, 39, 40, 41, 42];

function parseAllocs(item: { outletAllocations?: string | null }): Record<string, any>[] {
  if (!item.outletAllocations) return [];
  try { return JSON.parse(item.outletAllocations); } catch { return []; }
}

// How many of this item's (colour's) pairs are allocated to one specific outlet.
function itemOutletPairs(item: { outletAllocations?: string | null }, outletId: string): number {
  const a = parseAllocs(item).find(x => x.outletId === outletId);
  if (!a) return 0;
  return SHIPMENT_SIZE_KEYS.reduce((s, sz) => s + (Number(a[`qty${sz}`]) || 0), 0);
}

// Every outlet an item allocates pairs to, and how many — a SKU can span
// several destination outlets across its colours, and each one gets its own
// shipment block below since receiving timelines can differ per outlet.
function outletsForGroup(items: TimelinePO["items"], outlets: TimelineOutlet[]): { id: string; name: string; pairs: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    for (const a of parseAllocs(item)) {
      const sub = SHIPMENT_SIZE_KEYS.reduce((s, sz) => s + (Number(a[`qty${sz}`]) || 0), 0);
      if (sub <= 0 || !a.outletId) continue;
      totals.set(a.outletId, (totals.get(a.outletId) ?? 0) + sub);
    }
  }
  return [...totals.entries()]
    .map(([id, pairs]) => ({ id, name: outlets.find(o => o.id === id)?.name ?? id, pairs }))
    .sort((a, b) => b.pairs - a.pairs);
}

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

// ─── SKU-group timeline & shipment batches ────────────────────────────────────
// A supplier ships every colour of a SKU together, so colours are never
// tracked separately — but different destination outlets (e.g. a nearby China
// warehouse vs. Malaysia HQ) can have very different receiving timelines, so
// each SKU gets one shipment block PER OUTLET: its own stage bar and its own
// "Add shipment" that creates a same-dated batch per colour behind the scenes
// (batchGroup-linked, so PO status / outlet delivery sync / payment tracking
// still see per-colour rows exactly as before). Batches recorded before this
// existed (batchGroup null — a whole colour shipped as one un-split unit, outlet
// unknown) still show individually in a separate legacy list, tagged by colour,
// so nothing already on a PO disappears.

type TaggedBatch = ShipmentBatch & { itemId: string; colorName?: string };
type BatchGroupRow = { groupId: string; pairs: number; shipDate?: string | null; arrivalDate?: string | null };

function taggedBatches(items: TimelinePO["items"]): TaggedBatch[] {
  return items.flatMap(item =>
    (item.shipmentBatches ?? []).map(b => ({ ...b, itemId: item.id, colorName: item.colorName }))
  );
}

function buildGroupRows(batches: TaggedBatch[]): BatchGroupRow[] {
  const grouped = new Map<string, TaggedBatch[]>();
  for (const b of batches) {
    if (!b.batchGroup) continue;
    if (!grouped.has(b.batchGroup)) grouped.set(b.batchGroup, []);
    grouped.get(b.batchGroup)!.push(b);
  }
  return [...grouped.entries()].map(([groupId, bs]) => ({
    groupId,
    pairs: bs.reduce((s, b) => s + b.pairs, 0),
    shipDate: bs.find(b => b.shipDate)?.shipDate ?? null,
    arrivalDate: bs.find(b => b.arrivalDate)?.arrivalDate ?? null,
  }));
}

// Good / defect / missing pairs for one colour at one outlet — writes through
// to the same OutletReceiptItem the Outlet Receipt Submit and China Warehouse
// Receiving pages read from, so all three views of "what arrived" stay in sync.
function ReceivingRow({ item, ordered, existing, onSave }: {
  item: { id: string; colorName?: string };
  ordered: number;
  existing?: TimelineReceiptItem;
  onSave?: (poItemId: string, colorName: string | null, orderedQty: number, fields: ReceiptFields) => Promise<void>;
}) {
  const [local, setLocal] = React.useState<{ good?: string; defect?: string; missing?: string }>({});
  const [saving, setSaving] = React.useState(false);

  const existingGood = existing ? (existing.receivedQty ?? 0) - (existing.defectQty ?? 0) : null;
  const val = (field: "good" | "defect" | "missing") => {
    if (field in local) return local[field] ?? "";
    if (field === "good") return existingGood != null ? String(existingGood) : "";
    if (field === "defect") return existing?.defectQty != null ? String(existing.defectQty) : "";
    return existing?.missingQty != null ? String(existing.missingQty) : "";
  };

  async function commit(field: "good" | "defect" | "missing", value: string) {
    setLocal(prev => ({ ...prev, [field]: value }));
    const good    = field === "good"    ? Number(value) || 0 : Number(val("good"))    || 0;
    const defect  = field === "defect"  ? Number(value) || 0 : Number(val("defect"))  || 0;
    const missing = field === "missing" ? Number(value) || 0 : Number(val("missing")) || 0;
    setSaving(true);
    if (onSave) await onSave(item.id, item.colorName ?? null, ordered, { receivedQty: good + defect, defectQty: defect, missingQty: missing });
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-gray-500 w-20 flex-shrink-0 truncate">{item.colorName || "—"}</span>
      <span className="text-[10px] text-gray-400 w-16 flex-shrink-0">{ordered} ordered</span>
      {(["good", "defect", "missing"] as const).map(field => (
        <div key={field} className="flex flex-col">
          <input
            type="number" min={0}
            value={val(field)}
            onChange={e => setLocal(prev => ({ ...prev, [field]: e.target.value }))}
            onBlur={e => commit(field, e.target.value)}
            className={`w-14 text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 ${
              field === "defect" ? "border-red-200 text-red-700 focus:ring-red-400"
              : field === "missing" ? "border-amber-200 text-amber-700 focus:ring-amber-400"
              : "border-gray-200 text-gray-700 focus:ring-brand-400"
            }`}
          />
          <span className="text-[9px] text-gray-400 capitalize">{field}</span>
        </div>
      ))}
      {saving && <span className="text-[9px] text-gray-400">Saving…</span>}
    </div>
  );
}

function OutletShipmentBlock({ outlet, items, itemIds, batches, delivery, poSentDate, targetSupplierShip, onGroupAdd, onGroupUpdate, onGroupDelete, onReceiptSave }: {
  outlet: { id: string; name: string; pairs: number };
  items: TimelinePO["items"];
  itemIds: string[];
  batches: TaggedBatch[];
  delivery?: TimelineOutletDelivery;
  poSentDate: Date | null;
  targetSupplierShip: Date | null;
  onGroupAdd?: (itemIds: string[], outletId: string) => Promise<void>;
  onGroupUpdate?: (groupId: string, fields: { shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onGroupDelete?: (groupId: string) => Promise<void>;
  onReceiptSave?: (outletId: string, poItemId: string, colorName: string | null, orderedQty: number, fields: ReceiptFields) => Promise<void>;
}) {
  const [local, setLocal] = React.useState<Record<string, { shipDate?: string; arrivalDate?: string }>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);

  const rows = buildGroupRows(batches);

  const val = (r: BatchGroupRow, field: "shipDate" | "arrivalDate") => {
    const l = local[r.groupId];
    if (l && field in l) return l[field] as any;
    return toInputDate(r[field]);
  };

  function setLocalField(groupId: string, field: "shipDate" | "arrivalDate", value: any) {
    setLocal(prev => ({ ...prev, [groupId]: { ...prev[groupId], [field]: value } }));
  }

  async function commit(r: BatchGroupRow, fields: { shipDate?: string | null; arrivalDate?: string | null }) {
    setSaving(prev => ({ ...prev, [r.groupId]: true }));
    if (onGroupUpdate) await onGroupUpdate(r.groupId, fields);
    setSaving(prev => ({ ...prev, [r.groupId]: false }));
  }

  async function addShipment() {
    setAdding(true);
    if (onGroupAdd) await onGroupAdd(itemIds, outlet.id);
    setAdding(false);
  }

  async function removeRow(r: BatchGroupRow) {
    setSaving(prev => ({ ...prev, [r.groupId]: true }));
    if (onGroupDelete) await onGroupDelete(r.groupId);
  }

  const effShipDate = (r: BatchGroupRow) => { const v = val(r, "shipDate"); return v ? new Date(v) : null; };
  const effArrivalDate = (r: BatchGroupRow) => { const v = val(r, "arrivalDate"); return v ? new Date(v) : null; };

  const shippedPairs = rows.reduce((s, r) => s + (effShipDate(r) ? r.pairs : 0), 0);
  const arrivedPairs = rows.reduce((s, r) => s + (effArrivalDate(r) ? r.pairs : 0), 0);

  const pendingTargets = rows
    .filter(r => effShipDate(r) && !effArrivalDate(r))
    .map(r => addDays(effShipDate(r)!, 25));
  const nextTargetArrival = pendingTargets.length > 0 ? pendingTargets.reduce((a, b) => (a < b ? a : b)) : null;

  const fullyArrived = rows.length > 0 && arrivedPairs >= outlet.pairs;
  const latestArrival = fullyArrived
    ? rows.map(effArrivalDate).filter((d): d is Date => !!d).reduce((a, b) => (a > b ? a : b))
    : null;

  const targetLaunch = latestArrival
    ? addDays(latestArrival, 3)
    : (nextTargetArrival ? addDays(nextTargetArrival, 3) : null);

  const stages: Stage[] = [
    { label: "PO Submitted", done: !!poSentDate, actual: poSentDate ? fmtDate(poSentDate) : null, target: null },
    { label: "Supplier Ship", done: shippedPairs > 0,
      actual: shippedPairs > 0 ? `${shippedPairs}/${outlet.pairs} pairs` : null,
      target: targetSupplierShip ? `Target ${fmtDate(targetSupplierShip)}` : null },
    { label: "Actual Arrival", done: arrivedPairs > 0,
      actual: arrivedPairs > 0 ? `${arrivedPairs}/${outlet.pairs} pairs` : null,
      target: nextTargetArrival ? `Target ${fmtDate(nextTargetArrival)}` : null },
    { label: "Targeted Launch", done: fullyArrived, actual: null, target: targetLaunch ? fmtDate(targetLaunch) : null },
  ];

  return (
    <div className={`rounded-lg border border-gray-100 p-2.5 ${fullyArrived ? "bg-green-50/40" : "bg-white"}`}>
      <p className="text-xs font-semibold text-gray-700 mb-2">→ {outlet.name} <span className="text-[10px] font-normal text-gray-400">({outlet.pairs} pairs)</span></p>

      <div className="mb-2.5 pl-1">
        <StageBar stages={stages} size="sm" />
      </div>

      <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
        {rows.length === 0 && (
          <p className="text-[10px] text-gray-400">No shipments recorded yet.</p>
        )}
        {rows.map(r => {
          const target = effShipDate(r) ? addDays(effShipDate(r)!, 25) : null;
          return (
            <div key={r.groupId} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 w-20 flex-shrink-0">
                <span className="text-xs text-gray-700 font-medium">{r.pairs}</span>
                <span className="text-[10px] text-gray-400">pairs</span>
              </div>
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(r, "shipDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(r.groupId, "shipDate", v ?? ""); commit(r, { shipDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">ship date</span>
              </div>
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(r, "arrivalDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(r.groupId, "arrivalDate", v ?? ""); commit(r, { arrivalDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">
                  {target ? `arrival · target ${fmtDate(target)}` : "actual arrival"}
                </span>
              </div>
              {saving[r.groupId] && <span className="text-[9px] text-gray-400">Saving…</span>}
              <button
                onClick={() => removeRow(r)}
                className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                title="Remove this shipment"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
        <button
          onClick={addShipment}
          disabled={adding}
          className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
        >
          <Plus size={12} /> {adding ? "Adding…" : "Add shipment"}
        </button>
      </div>

      {/* Goods receipt for this outlet — writes to the same records the Outlet
          Receipt Submit / China Warehouse Receiving pages show, once at least
          one shipment has been recorded so there's a delivery to attach it to. */}
      {rows.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
          <p className="text-[10px] text-gray-400 font-medium">Goods receipt</p>
          {items.filter(i => itemOutletPairs(i, outlet.id) > 0).map(item => (
            <ReceivingRow
              key={item.id}
              item={item}
              ordered={itemOutletPairs(item, outlet.id)}
              existing={delivery?.receiptItems.find(ri => ri.poItemId === item.id)}
              onSave={onReceiptSave ? (poItemId, colorName, orderedQty, fields) => onReceiptSave(outlet.id, poItemId, colorName, orderedQty, fields) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkuGroupShipment({ grp, poSentDate, targetSupplierShip, outlets, outletDeliveries, onBatchUpdate, onBatchDelete, onGroupAdd, onGroupUpdate, onGroupDelete, onReceiptSave }: {
  grp: { key: string; pairs: number; items: TimelinePO["items"] };
  poSentDate: Date | null;
  targetSupplierShip: Date | null;
  outlets: TimelineOutlet[];
  outletDeliveries: TimelineOutletDelivery[];
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
  onGroupAdd?: (itemIds: string[], outletId: string) => Promise<void>;
  onGroupUpdate?: (groupId: string, fields: { shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onGroupDelete?: (groupId: string) => Promise<void>;
  onReceiptSave?: (outletId: string, poItemId: string, colorName: string | null, orderedQty: number, fields: ReceiptFields) => Promise<void>;
}) {
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const itemIds = grp.items.map(i => i.id);
  const involvedOutlets = outletsForGroup(grp.items, outlets);
  const allBatches = taggedBatches(grp.items);
  const legacyBatches = allBatches.filter(b => !b.batchGroup);

  async function removeLegacy(batchId: string) {
    setSaving(prev => ({ ...prev, [batchId]: true }));
    if (onBatchDelete) await onBatchDelete(batchId);
  }

  return (
    <div className="pl-8 pr-4 py-2.5 space-y-3">
      {/* One shipment block per destination outlet — the colour + outlet
          breakdown lives inside each block's own Goods receipt section, so
          there's no need to repeat it here too. */}
      <div className="space-y-2.5">
        {involvedOutlets.map(o => (
          <OutletShipmentBlock
            key={o.id}
            outlet={o}
            items={grp.items}
            itemIds={itemIds}
            batches={allBatches.filter(b => b.outletId === o.id)}
            delivery={outletDeliveries.find(d => d.outletId === o.id)}
            poSentDate={poSentDate}
            targetSupplierShip={targetSupplierShip}
            onGroupAdd={onGroupAdd}
            onGroupUpdate={onGroupUpdate}
            onGroupDelete={onGroupDelete}
            onReceiptSave={onReceiptSave}
          />
        ))}
      </div>

      {legacyBatches.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
          <p className="text-[10px] text-gray-400">Recorded before per-outlet tracking — shown by colour:</p>
          {legacyBatches.map(b => (
            <div key={b.id} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 w-20 flex-shrink-0">
                <span className="text-xs text-gray-700 font-medium">{b.pairs}</span>
                <span className="text-[10px] text-gray-400">pairs</span>
              </div>
              <span className="text-[10px] text-gray-400 whitespace-nowrap">{b.colorName || "—"}</span>
              <span className="text-[10px] text-gray-500">{toInputDate(b.shipDate) || "no ship date"}{b.arrivalDate ? ` → ${toInputDate(b.arrivalDate)}` : ""}</span>
              {saving[b.id] && <span className="text-[9px] text-gray-400">Saving…</span>}
              <button
                onClick={() => removeLegacy(b.id)}
                className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                title="Remove this shipment"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function Timeline<TPO extends TimelinePO>({ po, outlets = [], outletDeliveries = [], onSave, onBatchUpdate, onBatchDelete, onGroupAdd, onGroupUpdate, onGroupDelete, onReceiptSave }: {
  po: TPO;
  outlets?: TimelineOutlet[];
  outletDeliveries?: TimelineOutletDelivery[];
  onSave?: (field: "shipDate" | "deliveryDate", value: string) => void;
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
  onGroupAdd?: (itemIds: string[], outletId: string) => Promise<void>;
  onGroupUpdate?: (groupId: string, fields: { shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onGroupDelete?: (groupId: string) => Promise<void>;
  onReceiptSave?: (outletId: string, poItemId: string, colorName: string | null, orderedQty: number, fields: ReceiptFields) => Promise<void>;
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
                  {/* One shared stage bar + shipment record for the whole SKU —
                      every colour ships together, so there's no per-colour
                      timeline here; see the read-only breakdown inside. */}
                  <SkuGroupShipment
                    grp={grp}
                    poSentDate={poSentDate}
                    targetSupplierShip={targetSupplierShip}
                    outlets={outlets}
                    outletDeliveries={outletDeliveries}
                    onBatchUpdate={onBatchUpdate}
                    onBatchDelete={onBatchDelete}
                    onGroupAdd={onGroupAdd}
                    onGroupUpdate={onGroupUpdate}
                    onGroupDelete={onGroupDelete}
                    onReceiptSave={onReceiptSave}
                  />
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
