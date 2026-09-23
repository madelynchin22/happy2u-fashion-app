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
};

export type TimelineOutlet = { id: string; name: string };

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

// Same per-outlet pairs breakdown shown in the size × colour matrix above —
// repeated here so each shipment line also shows which locations it's for.
function outletSummary(item: { outletAllocations?: string | null }, outlets: TimelineOutlet[]): string[] {
  if (!item.outletAllocations || outlets.length === 0) return [];
  let allocs: Record<string, any>[] = [];
  try { allocs = JSON.parse(item.outletAllocations); } catch { return []; }
  return allocs
    .map(a => {
      const sub = SHIPMENT_SIZE_KEYS.reduce((s, sz) => s + (Number(a[`qty${sz}`]) || 0), 0);
      if (sub <= 0) return null;
      const o = outlets.find(x => x.id === a.outletId);
      return o ? `${o.name} ×${sub}` : null;
    })
    .filter((s): s is string => !!s);
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
// A supplier ships every colour of a SKU together, so shipment recording
// happens once per SKU: one shared stage bar aggregated across all its
// colours' batches, one shared "Add shipment" that creates a same-dated batch
// per colour behind the scenes (batchGroup-linked, so PO status / outlet
// delivery sync / payment tracking still see per-colour rows exactly as
// before), and a plain read-only colour + outlet breakdown for context.
// Batches recorded before this existed (batchGroup null) still show
// individually, tagged by colour, so nothing already on a PO disappears.

type TaggedBatch = ShipmentBatch & { itemId: string; colorName?: string };

type GroupRow = { kind: "group"; groupId: string; pairs: number; shipDate?: string | null; arrivalDate?: string | null; colorNames: string[] };
type SingleRow = { kind: "single"; batch: TaggedBatch };
type ShipmentRow = GroupRow | SingleRow;

function buildShipmentRows(items: TimelinePO["items"]): ShipmentRow[] {
  const tagged: TaggedBatch[] = items.flatMap(item =>
    (item.shipmentBatches ?? []).map(b => ({ ...b, itemId: item.id, colorName: item.colorName }))
  );
  const grouped = new Map<string, TaggedBatch[]>();
  const rows: ShipmentRow[] = [];
  for (const b of tagged) {
    if (b.batchGroup) {
      if (!grouped.has(b.batchGroup)) grouped.set(b.batchGroup, []);
      grouped.get(b.batchGroup)!.push(b);
    } else {
      rows.push({ kind: "single", batch: b });
    }
  }
  for (const [groupId, batches] of grouped.entries()) {
    rows.push({
      kind: "group",
      groupId,
      pairs: batches.reduce((s, b) => s + b.pairs, 0),
      shipDate: batches.find(b => b.shipDate)?.shipDate ?? null,
      arrivalDate: batches.find(b => b.arrivalDate)?.arrivalDate ?? null,
      colorNames: batches.map(b => b.colorName || "—"),
    });
  }
  return rows;
}

function SkuGroupShipment({ grp, poSentDate, targetSupplierShip, outlets, onBatchUpdate, onBatchDelete, onGroupAdd, onGroupUpdate, onGroupDelete }: {
  grp: { key: string; pairs: number; items: TimelinePO["items"] };
  poSentDate: Date | null;
  targetSupplierShip: Date | null;
  outlets: TimelineOutlet[];
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
  onGroupAdd?: (itemIds: string[]) => Promise<void>;
  onGroupUpdate?: (groupId: string, fields: { shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onGroupDelete?: (groupId: string) => Promise<void>;
}) {
  const [local, setLocal] = React.useState<Record<string, { shipDate?: string; arrivalDate?: string }>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);

  const rows = buildShipmentRows(grp.items);
  const rowKey = (r: ShipmentRow) => r.kind === "group" ? r.groupId : r.batch.id;

  const val = (r: ShipmentRow, field: "shipDate" | "arrivalDate") => {
    const l = local[rowKey(r)];
    if (l && field in l) return l[field] as any;
    return toInputDate(r.kind === "group" ? r[field] : r.batch[field]);
  };

  function setLocalField(key: string, field: "shipDate" | "arrivalDate", value: any) {
    setLocal(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function commit(r: ShipmentRow, fields: { shipDate?: string | null; arrivalDate?: string | null }) {
    const key = rowKey(r);
    setSaving(prev => ({ ...prev, [key]: true }));
    if (r.kind === "group") { if (onGroupUpdate) await onGroupUpdate(r.groupId, fields); }
    else { if (onBatchUpdate) await onBatchUpdate(r.batch.id, fields); }
    setSaving(prev => ({ ...prev, [key]: false }));
  }

  async function addShipment() {
    setAdding(true);
    if (onGroupAdd) await onGroupAdd(grp.items.map(i => i.id));
    setAdding(false);
  }

  async function removeRow(r: ShipmentRow) {
    setSaving(prev => ({ ...prev, [rowKey(r)]: true }));
    if (r.kind === "group") { if (onGroupDelete) await onGroupDelete(r.groupId); }
    else { if (onBatchDelete) await onBatchDelete(r.batch.id); }
  }

  const effShipDate = (r: ShipmentRow) => { const v = val(r, "shipDate"); return v ? new Date(v) : null; };
  const effArrivalDate = (r: ShipmentRow) => { const v = val(r, "arrivalDate"); return v ? new Date(v) : null; };
  const effPairs = (r: ShipmentRow) => r.kind === "group" ? r.pairs : r.batch.pairs;

  const shippedPairs = rows.reduce((s, r) => s + (effShipDate(r) ? effPairs(r) : 0), 0);
  const arrivedPairs = rows.reduce((s, r) => s + (effArrivalDate(r) ? effPairs(r) : 0), 0);

  const pendingTargets = rows
    .filter(r => effShipDate(r) && !effArrivalDate(r))
    .map(r => addDays(effShipDate(r)!, 25));
  const nextTargetArrival = pendingTargets.length > 0 ? pendingTargets.reduce((a, b) => (a < b ? a : b)) : null;

  const fullyArrived = rows.length > 0 && arrivedPairs >= grp.pairs;
  const latestArrival = fullyArrived
    ? rows.map(effArrivalDate).filter((d): d is Date => !!d).reduce((a, b) => (a > b ? a : b))
    : null;

  const targetLaunch = latestArrival
    ? addDays(latestArrival, 3)
    : (nextTargetArrival ? addDays(nextTargetArrival, 3) : null);

  const stages: Stage[] = [
    { label: "PO Submitted", done: !!poSentDate, actual: poSentDate ? fmtDate(poSentDate) : null, target: null },
    { label: "Supplier Ship", done: shippedPairs > 0,
      actual: shippedPairs > 0 ? `${shippedPairs}/${grp.pairs} pairs` : null,
      target: targetSupplierShip ? `Target ${fmtDate(targetSupplierShip)}` : null },
    { label: "Actual Arrival", done: arrivedPairs > 0,
      actual: arrivedPairs > 0 ? `${arrivedPairs}/${grp.pairs} pairs` : null,
      target: nextTargetArrival ? `Target ${fmtDate(nextTargetArrival)}` : null },
    { label: "Targeted Launch", done: fullyArrived, actual: null, target: targetLaunch ? fmtDate(targetLaunch) : null },
  ];

  return (
    <div className={`pl-8 pr-4 py-2.5 ${fullyArrived ? "bg-green-50/40" : ""}`}>
      {/* Read-only colour + outlet breakdown — context only, no per-colour recording */}
      <div className="mb-2.5 space-y-1">
        {grp.items.map(item => {
          const locations = outletSummary(item, outlets);
          return (
            <div key={item.id} className="flex items-center gap-2 flex-wrap">
              {item.photoUrl ? (
                <Image src={item.photoUrl} alt={item.colorName ?? ""} width={20} height={20} className="w-5 h-5 rounded object-cover border border-gray-100 flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded bg-gray-50 border border-dashed border-gray-200 flex-shrink-0" />
              )}
              <span className="text-xs text-gray-700">{item.colorName || item.h2uSku || "—"}</span>
              <span className="text-[10px] text-gray-400">{item.totalPairs} pairs</span>
              {locations.length > 0 && (
                <span className="text-[10px] text-gray-400">· {locations.join(" · ")}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-2.5 pl-1">
        <StageBar stages={stages} size="sm" />
      </div>

      <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
        {rows.length === 0 && (
          <p className="text-[10px] text-gray-400">No shipments recorded yet.</p>
        )}
        {rows.map(r => {
          const key = rowKey(r);
          const target = effShipDate(r) ? addDays(effShipDate(r)!, 25) : null;
          return (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 w-20 flex-shrink-0">
                <span className="text-xs text-gray-700 font-medium">{effPairs(r)}</span>
                <span className="text-[10px] text-gray-400">pairs</span>
              </div>
              {r.kind === "single" && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{r.batch.colorName || "—"}</span>
              )}
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(r, "shipDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(key, "shipDate", v ?? ""); commit(r, { shipDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">ship date</span>
              </div>
              <div className="flex flex-col">
                <input
                  type="date"
                  value={val(r, "arrivalDate")}
                  onChange={e => { const v = e.target.value || null; setLocalField(key, "arrivalDate", v ?? ""); commit(r, { arrivalDate: v }); }}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-28"
                />
                <span className="text-[9px] text-gray-400">
                  {target ? `arrival · target ${fmtDate(target)}` : "actual arrival"}
                </span>
              </div>
              {saving[key] && <span className="text-[9px] text-gray-400">Saving…</span>}
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
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function Timeline<TPO extends TimelinePO>({ po, outlets = [], onSave, onBatchUpdate, onBatchDelete, onGroupAdd, onGroupUpdate, onGroupDelete }: {
  po: TPO;
  outlets?: TimelineOutlet[];
  onSave?: (field: "shipDate" | "deliveryDate", value: string) => void;
  onBatchUpdate?: (batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onBatchDelete?: (batchId: string) => Promise<void>;
  onGroupAdd?: (itemIds: string[]) => Promise<void>;
  onGroupUpdate?: (groupId: string, fields: { shipDate?: string | null; arrivalDate?: string | null }) => Promise<void>;
  onGroupDelete?: (groupId: string) => Promise<void>;
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
                    onBatchUpdate={onBatchUpdate}
                    onBatchDelete={onBatchDelete}
                    onGroupAdd={onGroupAdd}
                    onGroupUpdate={onGroupUpdate}
                    onGroupDelete={onGroupDelete}
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
