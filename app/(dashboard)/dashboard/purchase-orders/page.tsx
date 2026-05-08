"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Plus, ChevronRight, X, AlertTriangle, Download, Edit2, Camera, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Allocation = { name: string; pairs: number; pct: number; note?: string };
type Outlet = { id: string; name: string; marking: string; country: string; isHQ: boolean };

type PO = {
  id: string; poNumber: string; brand: string; productName?: string; libProductName?: string;
  status: string; poType?: string; photoUrl?: string;
  sampleOrderId?: string; parentPoNumber?: string;
  destination?: string; paymentTerms?: string; paymentIncoterm?: string;
  fxRate?: number; totalPairs: number; totalPrice: number; currency: string;
  date: string; deliveryDate?: string; createdAt: string; updatedAt: string;
  productionStartDate?: string; qcDate?: string; shipDate?: string;
  sizeCurveInsight?: string; allocations?: string;
  manufacturer: { id: string; name: string; leadTimeDays?: number; rating?: number };
  _count: { items: number };
};

type OutletDelivery = {
  id: string;
  outletId: string;
  status: string;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  notes?: string | null;
  outlet: { id: string; name: string; marking: string };
  receiptItems: {
    id: string; poItemId: string; colorName?: string | null;
    orderedQty: number; receivedQty?: number | null;
    defectQty?: number | null; notes?: string | null;
  }[];
};

type PODetail = PO & {
  items: {
    id: string; colorName?: string; colorCode?: string; supplierSku?: string; h2uSku?: string;
    qty35: number; qty36: number; qty37: number; qty38: number;
    qty39: number; qty40: number; qty41: number; qty42: number;
    totalPairs: number; discountPrice?: number; lineTotal?: number;
    outletAllocations?: string | null;
    receivedQty?: number | null; defectQty?: number | null;
    receiptNotes?: string | null; receiptDate?: string | null;
  }[];
  createdBy?: { name?: string };
  sampleColorVariants?: string | null;
  libProductName?: string | null;
  outletDeliveries?: OutletDelivery[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, string> = {
  test:    "bg-blue-100 text-blue-700",
  reorder: "bg-green-100 text-green-700",
  replen:  "bg-orange-100 text-orange-700",
  clear:   "bg-red-100 text-red-600",
};
const TYPE_LABEL: Record<string, string> = {
  test: "Test", reorder: "Reorder", replen: "Replen", clear: "Clear",
};

const STATUS_STYLE: Record<string, string> = {
  draft:         "bg-gray-800 text-white",
  submitted:     "bg-indigo-100 text-indigo-700",
  sent:          "bg-blue-100 text-blue-700",
  in_production: "bg-blue-100 text-blue-700",
  shipped:       "bg-amber-100 text-amber-700",
  closed:        "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", sent: "Sent",
  in_production: "In production", shipped: "Shipped", closed: "Closed",
};

const FILTER_TABS = [
  { key: "all",          label: "All" },
  { key: "draft",        label: "Draft" },
  { key: "submitted",    label: "Submitted" },
  { key: "in_production",label: "In production" },
  { key: "shipped",      label: "Shipped" },
  { key: "closed",       label: "Closed" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysLate(po: PO): number | null {
  if (!po.deliveryDate) return null;
  if (["shipped", "closed"].includes(po.status)) return null;
  const diff = Math.floor((Date.now() - new Date(po.deliveryDate).getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function daysUntil(d?: string | null): string {
  if (!d) return "—";
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff === 0) return "today";
  return `${diff} days from now`;
}

function parseAllocations(raw?: string | null): Allocation[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function monthKey(d?: string | null): string {
  if (!d) return "unknown";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const m = new Date(Number(year), Number(month) - 1)
    .toLocaleString("en-GB", { month: "short" }).toUpperCase();
  return `${m} PO · ${year}`;
}

function totalCommittedRm(pos: PO[]): number {
  return pos
    .filter(p => p.status !== "draft")
    .reduce((s, p) => s + (p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62), 0);
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ pos, activeFilter, onFilter }: {
  pos: PO[];
  activeFilter: string;
  onFilter: (key: string) => void;
}) {
  const committed   = totalCommittedRm(pos);
  const activePOs   = pos.filter(p => !["draft", "closed"].includes(p.status)).length;
  const inProdPos   = pos.filter(p => ["submitted", "in_production"].includes(p.status));
  const inProd      = inProdPos.length;
  const inProdPairs = inProdPos.reduce((s, p) => s + p.totalPairs, 0);
  const inProdVal   = inProdPos.reduce((s, p) => s + (p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62), 0);
  const shipped     = pos.filter(p => p.status === "shipped").length;
  const delayedPos  = pos.filter(p => (daysLate(p) ?? 0) > 0);
  const worstDelay  = delayedPos.sort((a, b) => (daysLate(b) ?? 0) - (daysLate(a) ?? 0))[0];
  const avgLead     = pos.filter(p => p.manufacturer.leadTimeDays).length > 0
    ? Math.round(pos.filter(p => p.manufacturer.leadTimeDays)
        .reduce((s, p) => s + (p.manufacturer.leadTimeDays ?? 0), 0) /
        pos.filter(p => p.manufacturer.leadTimeDays).length)
    : null;

  const cards = [
    {
      filterKey: "all",
      label: "Total committed",
      value: `RM ${Math.round(committed).toLocaleString()}`,
      sub: `${activePOs} active POs`,
      borderCls: "border-l-4 border-l-brand-500 border-gray-200",
      valueCls: "text-gray-900 text-2xl",
      activeCls: "ring-2 ring-brand-300 border-l-4 border-l-brand-500",
    },
    {
      filterKey: "in_production",
      label: "In production",
      value: String(inProdPairs),
      sub: `${inProd} PO${inProd !== 1 ? "s" : ""} · RM ${Math.round(inProdVal).toLocaleString()}`,
      borderCls: "border-l-4 border-l-blue-400 border-gray-200",
      valueCls: "text-blue-700 text-3xl",
      activeCls: "ring-2 ring-blue-200 border-l-4 border-l-blue-500",
    },
    {
      filterKey: "shipped",
      label: "Shipped",
      value: String(shipped),
      sub: "Arriving this week",
      borderCls: "border-l-4 border-l-amber-400 border-gray-200",
      valueCls: "text-amber-700 text-3xl",
      activeCls: "ring-2 ring-amber-200 border-l-4 border-l-amber-500",
    },
    {
      filterKey: "delayed",
      label: "Delayed",
      value: String(delayedPos.length),
      sub: worstDelay ? `${worstDelay.poNumber} · ${daysLate(worstDelay)} days` : "No delays",
      borderCls: "border-l-4 border-l-red-400 border-gray-200",
      valueCls: "text-red-600 text-3xl",
      activeCls: "ring-2 ring-red-200 border-l-4 border-l-red-500",
    },
    {
      filterKey: "avgLead",
      label: "Avg lead time",
      value: avgLead ? `${avgLead}d` : "—",
      sub: "From order to receipt",
      borderCls: "border-l-4 border-l-green-400 border-gray-200",
      valueCls: "text-green-700 text-3xl",
      activeCls: "ring-2 ring-green-200 border-l-4 border-l-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map(c => {
        const isActive = activeFilter === c.filterKey;
        const clickable = !["avgLead"].includes(c.filterKey);
        return (
          <button
            key={c.filterKey}
            disabled={!clickable}
            onClick={() => clickable && onFilter(isActive ? "all" : c.filterKey)}
            className={`text-left bg-white border rounded-xl px-4 py-4 transition-all focus:outline-none ${
              isActive ? c.activeCls : `${c.borderCls} ${clickable ? "hover:shadow-sm hover:border-gray-300 cursor-pointer" : "cursor-default"}`
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-2">{c.label}</p>
            <p className={`font-bold leading-none mb-1 ${c.valueCls}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Timeline({ po, onSave }: { po: PODetail; onSave?: (field: "shipDate" | "deliveryDate", value: string) => void }) {
  const poSentDate     = po.date        ? new Date(po.date)        : null;
  const shipOutActual  = po.shipDate    ? new Date(po.shipDate)    : null;
  const arriveActual   = po.deliveryDate ? new Date(po.deliveryDate) : null;

  // Estimated dates derived from PO sent
  const estShipOut = poSentDate ? addDays(poSentDate, 45) : null;
  const estArrive  = estShipOut ? addDays(estShipOut,  25) : null;

  const now = new Date();

  function nodeState(actual: Date | null, est: Date | null): "done" | "active" | "future" {
    const ref = actual ?? est;
    if (!ref) return "future";
    const diff = (ref.getTime() - now.getTime()) / 86400000;
    if (diff < -1) return "done";
    if (diff <= 1) return "active";
    return "future";
  }

  const steps: { key: string; label: string; note: string; actual: Date | null; est: Date | null; field?: "shipDate" | "deliveryDate" }[] = [
    {
      key:    "po_sent",
      label:  "PO sent",
      note:   "Submit order date",
      actual: poSentDate,
      est:    null,
    },
    {
      key:    "ship_out",
      label:  "Supplier ship out",
      note:   "+45 days from PO sent",
      actual: shipOutActual,
      est:    estShipOut,
      field:  "shipDate",
    },
    {
      key:    "arrive",
      label:  "Arrive at destination",
      note:   "Warehouse + ship ≈ 25 days",
      actual: arriveActual,
      est:    estArrive,
      field:  "deliveryDate",
    },
  ];

  const doneCount   = steps.filter(s => nodeState(s.actual, s.est) === "done").length;
  const progressPct = steps.length > 1 ? Math.round((doneCount / (steps.length - 1)) * 100) : 0;

  const refArrive    = arriveActual ?? estArrive;
  const daysToArrive = refArrive
    ? Math.ceil((refArrive.getTime() - now.getTime()) / 86400000)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-900">Production timeline</p>
        {daysToArrive !== null && (
          <p className={`text-xs font-medium ${daysToArrive < 0 ? "text-red-500" : "text-gray-400"}`}>
            {daysToArrive > 0
              ? `Est. arrival in ${daysToArrive} days`
              : `${Math.abs(daysToArrive)} days overdue`}
          </p>
        )}
      </div>

      {/* Dot track */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-3 left-0 h-0.5 bg-green-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
        {steps.map(s => {
          const state = nodeState(s.actual, s.est);
          return (
            <div key={s.key} className="relative z-10">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                state === "done"   ? "bg-green-500 border-green-500" :
                state === "active" ? "bg-white border-green-500" :
                                     "bg-white border-gray-300"
              }`}>
                {state === "done" && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {state === "active" && <div className="w-2 h-2 rounded-full bg-green-500" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Labels + dates */}
      <div className="flex items-start justify-between">
        {steps.map((s, i) => {
          const state = nodeState(s.actual, s.est);
          const align = i === 0
            ? "items-start text-left"
            : i === steps.length - 1
              ? "items-end text-right"
              : "items-center text-center";
          return (
            <div key={s.key} className={`flex flex-col ${align}`} style={{ width: "33%" }}>
              <p className={`text-xs font-semibold leading-tight ${
                state === "active" ? "text-green-600" : "text-gray-700"
              }`}>
                {s.label}
              </p>
              {/* Actual date — editable input for ship_out and arrive */}
              {s.field && onSave ? (
                <input
                  type="date"
                  className="mt-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:border-brand-400 w-full max-w-[120px]"
                  defaultValue={s.actual ? s.actual.toISOString().split("T")[0] : ""}
                  onBlur={e => { if (e.target.value) onSave(s.field!, e.target.value); }}
                  onChange={e => { if (e.target.value) onSave(s.field!, e.target.value); }}
                />
              ) : (
                <p className={`text-xs font-medium mt-1 ${
                  state === "done" ? "text-gray-500" :
                  state === "active" ? "text-green-600" : "text-gray-400"
                }`}>
                  {s.actual ? fmtDate(s.actual) : "—"}
                </p>
              )}
              {/* Estimated date */}
              {s.est && (
                <p className="text-[11px] text-violet-500 mt-0.5">
                  Est. {fmtDate(s.est)}
                </p>
              )}
              <p className="text-[10px] text-gray-300 mt-1 leading-tight">{s.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoodsReceipt({ po, onSaved }: { po: PODetail; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);

  const deliveries = po.outletDeliveries ?? [];

  // Build per-outlet summary rows
  const outletRows = deliveries.map(d => {
    const allocatedItems = po.items.filter(item => {
      if (!item.outletAllocations) return false;
      try {
        const allocs: { outletId: string }[] = JSON.parse(item.outletAllocations);
        return allocs.some(a => a.outletId === d.outletId);
      } catch { return false; }
    });

    const colours = allocatedItems.map(item => {
      const allocs: any[] = (() => { try { return JSON.parse(item.outletAllocations ?? "[]"); } catch { return []; } })();
      const alloc = allocs.find((a: any) => a.outletId === d.outletId);
      const ordered = alloc
        ? [36,37,38,39,40,41,42].reduce((s: number, sz: number) => s + ((alloc as any)[`qty${sz}`] || 0), 0)
        : 0;
      const ri = d.receiptItems.find(r => r.colorName === item.colorName);
      return { colorName: item.colorName ?? "—", ordered, received: ri?.receivedQty ?? null, defect: ri?.defectQty ?? null };
    });

    const totalOrdered  = colours.reduce((s, c) => s + c.ordered, 0);
    const totalReceived = colours.reduce((s, c) => s + (c.received ?? 0), 0);
    const totalDefect   = colours.reduce((s, c) => s + (c.defect   ?? 0), 0);
    const allReceived   = colours.length > 0 && colours.every(c => c.received != null);

    let rowStyle    = "bg-amber-50 border-amber-200";
    let dotStyle    = "bg-amber-400";
    let statusLabel = "Not yet arrived";
    if (d.status === "receipt_done" || allReceived) {
      if (totalDefect > 0) {
        rowStyle = "bg-red-50 border-red-200"; dotStyle = "bg-red-500";
        statusLabel = `${totalDefect} defect${totalDefect > 1 ? "s" : ""}`;
      } else if (totalReceived >= totalOrdered && totalOrdered > 0) {
        rowStyle = "bg-green-50 border-green-200"; dotStyle = "bg-green-500";
        statusLabel = "All correct";
      } else {
        statusLabel = "Partial";
      }
    }

    return { d, colours, totalOrdered, totalReceived, totalDefect, rowStyle, dotStyle, statusLabel };
  });

  async function closePO() {
    setSaving(true);
    await fetch(`/api/purchase-orders/${po.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="border border-gray-100 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-base">📋</span> Main Goods Receipt Record
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Delivery status per outlet — green: correct · red: defects · yellow: not yet arrived</p>
        </div>
        {po.status === "closed" && (
          <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">PO Closed</span>
        )}
      </div>

      <div className="space-y-2">
        {outletRows.map(({ d, colours, totalOrdered, totalReceived, totalDefect, rowStyle, dotStyle, statusLabel }) => (
          <div key={d.id} className={`rounded-lg border px-4 py-3 ${rowStyle}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotStyle}`} />
                <span className="font-semibold text-sm text-gray-800">{d.outlet.name}</span>
                <span className="text-xs text-gray-400 font-mono">{d.outlet.marking}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  {totalReceived}/{totalOrdered} pairs
                  {totalDefect > 0 && <span className="text-red-600 ml-1">· {totalDefect} defect{totalDefect > 1 ? "s" : ""}</span>}
                </span>
                <span className={`font-medium ${dotStyle === "bg-green-500" ? "text-green-700" : dotStyle === "bg-red-500" ? "text-red-600" : "text-amber-600"}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {colours.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="font-medium">{c.colorName}</span>
                  <span className="text-gray-400">
                    {c.received != null
                      ? <>{c.received}<span className="text-gray-300">/{c.ordered}</span>{c.defect ? <span className="text-red-500 ml-1">-{c.defect}</span> : null}</>
                      : <span className="text-gray-300">{c.ordered} ordered</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {po.status !== "closed" && (
        <div className="flex justify-end pt-1">
          <button onClick={closePO} disabled={saving}
            className="btn-primary text-xs px-4">
            {saving ? "Saving…" : "Close PO"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const EDIT_SIZES = [36, 37, 38, 39, 40, 41, 42];

type OutletAlloc = {
  outletId: string;
  qty36: number; qty37: number; qty38: number; qty39: number;
  qty40: number; qty41: number; qty42: number;
};

type DraftItem = {
  included:      boolean;
  colorName:     string;
  qty36: number; qty37: number; qty38: number; qty39: number;
  qty40: number; qty41: number; qty42: number;
  discountPrice: number;
  outletAllocations: OutletAlloc[]; // per-outlet size breakdown
};

function itemTotal(item: DraftItem) {
  return EDIT_SIZES.reduce((s, sz) => s + ((item as any)[`qty${sz}`] as number || 0), 0);
}

function DetailPanel({ id, onClose, onRefreshList }: { id: string; onClose: () => void; onRefreshList?: () => void }) {
  const [po, setPo]             = useState<PODetail | null>(null);
  const [editing, setEditing]   = useState(false);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftSaving, setDraftSaving] = useState(false);
  const [newColorInput, setNewColorInput] = useState("");
  const [outlets, setOutlets]   = useState<Outlet[]>([]);
  const [allocColorIdx, setAllocColorIdx] = useState(0);

  useEffect(() => {
    fetch("/api/outlets").then(r => r.json()).then(d => setOutlets(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setPo(null);
    setEditing(false);

    async function loadPo() {
      try {
        const r = await fetch(`/api/purchase-orders/${id}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!d?.id) return;
        let current = d;

        // Auto-fix: if shipDate is set but status hasn't advanced, patch it now
        if (d.shipDate && !["shipped", "received", "closed"].includes(d.status ?? "")) {
          const pr = await fetch(`/api/purchase-orders/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shipDate: d.shipDate }),
          });
          if (pr.ok) {
            current = await fetch(`/api/purchase-orders/${id}`).then(r2 => r2.json());
            onRefreshList?.();
          }
        }

        // Auto-create outlet delivery records for shipped POs that don't have them yet
        if (["shipped", "closed"].includes(current.status) && (current.outletDeliveries ?? []).length === 0) {
          const pr = await fetch(`/api/purchase-orders/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: current.status }),
          });
          if (pr.ok) {
            current = await fetch(`/api/purchase-orders/${id}`).then(r2 => r2.json());
          }
        }

        setPo(current);
      } catch (err) {
        console.error("Failed to load PO:", err);
      }
    }

    loadPo();
  }, [id]);

  function startEdit() {
    if (!po) return;

    const items: DraftItem[] = po.items.map(item => ({
      included:     true,
      colorName:    item.colorName ?? "",
      qty36: item.qty36 ?? 0, qty37: item.qty37 ?? 0,
      qty38: item.qty38 ?? 0, qty39: item.qty39 ?? 0,
      qty40: item.qty40 ?? 0, qty41: item.qty41 ?? 0,
      qty42: item.qty42 ?? 0,
      discountPrice: item.discountPrice ?? 0,
      outletAllocations: item.outletAllocations ? JSON.parse(item.outletAllocations) : [],
    }));

    // Merge any color variants from the linked sample that aren't already an item
    if (po.sampleColorVariants) {
      try {
        const variants: { name: string; hex: string }[] = JSON.parse(po.sampleColorVariants);
        for (const cv of variants) {
          const alreadyPresent = items.some(
            i => i.colorName.toLowerCase() === cv.name.toLowerCase()
          );
          if (!alreadyPresent) {
            items.push({
              included: true, colorName: cv.name,
              qty36: 0, qty37: 0, qty38: 0, qty39: 0, qty40: 0, qty41: 0, qty42: 0,
              discountPrice: 0, outletAllocations: [],
            });
          }
        }
      } catch {}
    }

    setDraftItems(items);
    setAllocColorIdx(0);
    setEditing(true);
  }

  function updateOutletAlloc(itemIdx: number, outletId: string, sizeField: string, value: number) {
    setDraftItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      const allocs = [...item.outletAllocations];
      const aIdx   = allocs.findIndex(a => a.outletId === outletId);
      const blank: OutletAlloc = { outletId, qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0 };
      if (aIdx === -1) allocs.push({ ...blank, [sizeField]: value });
      else             allocs[aIdx] = { ...allocs[aIdx], [sizeField]: value };
      // Recompute item totals from allocations
      const totals: Partial<DraftItem> = {};
      for (const sz of EDIT_SIZES) {
        (totals as any)[`qty${sz}`] = allocs.reduce((s, a) => s + ((a as any)[`qty${sz}`] || 0), 0);
      }
      return { ...item, outletAllocations: allocs, ...totals };
    }));
  }

  function updateItem(idx: number, field: string, value: any) {
    setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addColorRow() {
    const name = newColorInput.trim();
    if (!name) return;
    setDraftItems(prev => [...prev, {
      included: true, colorName: name,
      qty36: 0, qty37: 0, qty38: 0, qty39: 0, qty40: 0, qty41: 0, qty42: 0,
      discountPrice: 0, outletAllocations: [],
    }]);
    setNewColorInput("");
  }

  async function saveDateField(field: "shipDate" | "deliveryDate", value: string) {
    const patch: Record<string, string> = { [field]: value };
    if (field === "shipDate" && value) patch.status = "shipped";
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const fresh = await fetch(`/api/purchase-orders/${id}`).then(r => r.json());
    setPo(fresh);
    onRefreshList?.();
  }

  async function submitOrder() {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted", date: new Date().toISOString() }),
    });
    if (res.ok) {
      const fresh = await fetch(`/api/purchase-orders/${id}`).then(r => r.json());
      setPo(fresh);

      // Auto-download PO PDF and Packing List PDF
      function openDownload(url: string) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      openDownload(`/api/purchase-orders/${id}/pdf`);
      setTimeout(() => {
        openDownload(
          `/api/purchase-orders/group-pdf-pl?ids=${id}` +
          `&group=${encodeURIComponent(fresh.poNumber ?? po?.poNumber ?? "")}` +
          `&supplier=${encodeURIComponent(fresh.manufacturer?.name ?? po?.manufacturer?.name ?? "")}`
        );
      }, 800);
    }
  }

  async function saveDraft() {
    setDraftSaving(true);
    const items = draftItems.filter(i => i.included).map(item => {
      const totalPairs = itemTotal(item);
      const lineTotal  = totalPairs * (item.discountPrice || 0);
      return {
        colorName: item.colorName || null,
        qty35: 0, qty36: item.qty36, qty37: item.qty37, qty38: item.qty38,
        qty39: item.qty39, qty40: item.qty40, qty41: item.qty41, qty42: item.qty42,
        totalPairs, discountPrice: item.discountPrice || null, lineTotal,
        outletAllocations: Array.isArray(item.outletAllocations) && item.outletAllocations.length > 0
          ? JSON.stringify(item.outletAllocations) : null,
      };
    });
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setDraftSaving(false);
      alert(`Save failed: ${errData.error ?? "Unknown error — check server logs"}`);
      return; // Stay in edit mode so the user doesn't lose their work
    }
    // Re-fetch after successful save to get fully populated PO (including createdBy, collection)
    const fresh = await fetch(`/api/purchase-orders/${id}`).then(r => r.json());
    if (fresh?.id) setPo(fresh);
    setDraftSaving(false);
    setEditing(false);
  }

  if (!po || !po.items) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white p-6 mt-2">
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          {(po as any)?.error ? `Error: ${(po as any).error}` : "Loading…"}
        </div>
      </div>
    );
  }

  const allocations = parseAllocations(po.allocations);
  // When editing, compute live totals from draft items so the cost card updates in real time
  const liveTotalRmb = editing
    ? draftItems.filter(i => i.included).reduce((s, item) => s + itemTotal(item) * (item.discountPrice || 0), 0)
    : po.totalPrice;
  const rmValue  = po.fxRate ? liveTotalRmb * po.fxRate : liveTotalRmb * 0.62;
  const rmbValue = liveTotalRmb;

  // Build size × color matrix
  const SIZES = [35, 36, 37, 38, 39, 40, 41, 42];
  const usedSizes = SIZES.filter(sz =>
    po.items.some(item => (item as any)[`qty${sz}`] > 0)
  );
  const colorRows = po.items.filter(item => item.colorName || item.totalPairs > 0);

  const colTotal = (sz: number) =>
    colorRows.reduce((s, item) => s + ((item as any)[`qty${sz}`] ?? 0), 0);

  const late = daysLate(po);

  return (
    <div className="bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-bold text-gray-900 text-xl">
              {po.poNumber} · {po.productName || po.brand}
            </h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[po.status] ?? "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABEL[po.status] ?? po.status}
            </span>
            {po.poType && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLE[po.poType] ?? "bg-gray-100 text-gray-500"}`}>
                {TYPE_LABEL[po.poType] ?? po.poType}
              </span>
            )}
          </div>
          {po.libProductName && (
            <p className="text-sm text-gray-500 font-medium">{po.libProductName}</p>
          )}
          <p className="text-xs text-gray-400">
            created {fmt(po.date)}
            {po.createdBy?.name && <> · approved by {po.createdBy.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={`/api/purchase-orders/${id}/pdf`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            <Download size={14} /> Download PO
          </a>
          {po && (
            <a href={`/api/purchase-orders/group-pdf-pl?ids=${id}&group=${encodeURIComponent(po.poNumber)}&supplier=${encodeURIComponent(po.manufacturer.name)}`} target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-300 rounded-lg hover:bg-green-50 text-green-700">
              <Download size={14} /> Download PL
            </a>
          )}
          {po.status === "draft" && !editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              <Edit2 size={14} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={() => setEditing(false)} disabled={draftSaving}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
                Cancel
              </button>
              <button onClick={saveDraft} disabled={draftSaving}
                className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                {draftSaving ? "Saving…" : "Save draft"}
              </button>
            </>
          )}
          {po.status !== "draft" && (
            <Link href={`/dashboard/purchase-orders/${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              <Edit2 size={14} /> Edit
            </Link>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info cards row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Supplier */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Supplier</p>
            <p className="font-semibold text-gray-900">{po.manufacturer.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {po.manufacturer.leadTimeDays && `Lead time: ${po.manufacturer.leadTimeDays}d`}
              {po.manufacturer.rating && <> · <span className="text-amber-500">★</span> {po.manufacturer.rating}</>}
            </p>
          </div>

          {/* Total cost */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total cost</p>
            <p className="font-semibold text-gray-900">RM {Math.round(rmValue).toLocaleString()} <span className="text-gray-400 font-normal text-sm">(¥{Math.round(rmbValue).toLocaleString()})</span></p>
            {po.fxRate && <p className="text-xs text-gray-500 mt-1">Locked at ¥/RM {po.fxRate.toFixed(2)}</p>}
          </div>

          {/* Expected arrival */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Expected arrival</p>
            <p className="font-semibold text-gray-900">{fmt(po.deliveryDate)}</p>
            <p className="text-xs text-gray-500 mt-1">{daysUntil(po.deliveryDate)}</p>
            {late && (
              <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                <AlertTriangle size={10} /> {late} days late
              </p>
            )}
          </div>

          {/* Payment terms */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Payment terms</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{po.paymentTerms || "—"}</p>
            {po.paymentIncoterm && <p className="text-xs text-gray-500 mt-1">{po.paymentIncoterm}</p>}
          </div>
        </div>

        {/* Size × color matrix */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-semibold text-gray-900">Size × colour matrix</p>
            <p className="text-xs text-gray-400">EU sizing · EU36–42</p>
          </div>

          {editing ? (
            /* ── EDIT MODE ── */
            <div className="space-y-4">

              {/* ── Outlet allocation section (shown when outlets are configured) ── */}
              {outlets.length > 0 && (() => {
                const includedItems = draftItems.filter(i => i.included);
                // If current tab points to an unchecked colour, fall back to first included
                const colorItem = (draftItems[allocColorIdx]?.included ? draftItems[allocColorIdx] : null) ?? includedItems[0];
                const colorItemIdx = draftItems.indexOf(colorItem);
                if (!colorItem) return null;
                return (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Header + colour tabs */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Outlet allocation</p>
                        <p className="text-xs text-gray-400">Quantities per outlet per size — totals auto-fill the matrix below</p>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {draftItems.map((item, idx) => {
                          if (!item.included) return null;
                          const colTotal = itemTotal(item);
                          return (
                            <button key={idx} type="button"
                              onClick={() => setAllocColorIdx(idx)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                allocColorIdx === idx
                                  ? "bg-gray-900 text-white"
                                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}>
                              {item.colorName || "—"}
                              {colTotal > 0 && <span className="ml-1 opacity-60">({colTotal})</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Outlet × size matrix for selected colour */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 min-w-[160px]">Outlet</th>
                            {EDIT_SIZES.map(sz => (
                              <th key={sz} className="px-1 py-2 text-xs font-medium text-gray-500 text-center">EU{sz}</th>
                            ))}
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {outlets.map(outlet => {
                            const alloc = colorItem.outletAllocations.find(a => a.outletId === outlet.id)
                              ?? { outletId: outlet.id, qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0 };
                            const rowTotal = EDIT_SIZES.reduce((s, sz) => s + ((alloc as any)[`qty${sz}`] || 0), 0);
                            return (
                              <tr key={outlet.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {outlet.isHQ && <span className="text-[9px] bg-brand-100 text-brand-700 px-1 py-0.5 rounded font-medium">HQ</span>}
                                    <span className="text-xs text-gray-800">{outlet.name}</span>
                                  </div>
                                </td>
                                {EDIT_SIZES.map(sz => (
                                  <td key={sz} className="px-1 py-2">
                                    <input type="number" min="0"
                                      className="w-11 text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                                      value={(alloc as any)[`qty${sz}`] || ""}
                                      placeholder="0"
                                      onChange={e => updateOutletAlloc(colorItemIdx, outlet.id, `qty${sz}`, Number(e.target.value) || 0)} />
                                  </td>
                                ))}
                                <td className="px-4 py-2 text-center font-semibold text-gray-900">
                                  {rowTotal > 0 ? rowTotal : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Total row */}
                          <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                            <td className="px-4 py-2 text-xs text-gray-600">Total → {colorItem.colorName}</td>
                            {EDIT_SIZES.map(sz => (
                              <td key={sz} className="px-1 py-2 text-center text-gray-900 text-sm">
                                {(colorItem as any)[`qty${sz}`] > 0 ? (colorItem as any)[`qty${sz}`] : <span className="text-gray-300">—</span>}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-center text-gray-900">{itemTotal(colorItem)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Colour cost summary (no size columns when outlet allocation is active) ── */}
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  {outlets.length > 0 ? "Cost per colour (totals from outlet allocation above)" : "Enter quantities and cost per colour"}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 w-8" />
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Colour</th>
                        {outlets.length === 0 && EDIT_SIZES.map(sz => (
                          <th key={sz} className="px-1 py-2 text-xs font-medium text-gray-500 text-center">EU{sz}</th>
                        ))}
                        <th className="px-2 py-2 text-xs font-medium text-gray-500 text-center">¥/pair</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center">Total pairs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {draftItems.map((item, idx) => {
                        const total = itemTotal(item);
                        return (
                          <tr key={idx} className={!item.included ? "opacity-40 bg-gray-50" : ""}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={item.included}
                                onChange={e => updateItem(idx, "included", e.target.checked)}
                                className="w-4 h-4 rounded accent-gray-800 cursor-pointer" />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="text-sm border-b border-gray-200 focus:outline-none focus:border-brand-400 w-24 bg-transparent disabled:text-gray-400"
                                value={item.colorName}
                                disabled={!item.included}
                                onChange={e => updateItem(idx, "colorName", e.target.value)} />
                            </td>
                            {outlets.length === 0 && EDIT_SIZES.map(sz => (
                              <td key={sz} className="px-1 py-2">
                                <input type="number" min="0"
                                  className="w-12 text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-30"
                                  value={(item as any)[`qty${sz}`] || ""}
                                  disabled={!item.included}
                                  placeholder="0"
                                  onChange={e => updateItem(idx, `qty${sz}`, Number(e.target.value) || 0)} />
                              </td>
                            ))}
                            <td className="px-1 py-2">
                              <input type="number" min="0"
                                className="w-16 text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-30"
                                value={item.discountPrice || ""}
                                disabled={!item.included}
                                placeholder="¥"
                                onChange={e => updateItem(idx, "discountPrice", Number(e.target.value) || 0)} />
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900">
                              {total > 0 ? total : <span className="text-gray-300">0</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add colour row */}
              <div className="flex items-center gap-2">
                <input className="input text-sm w-40" placeholder="Add colour…"
                  value={newColorInput}
                  onChange={e => setNewColorInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColorRow(); }}} />
                <button onClick={addColorRow} disabled={!newColorInput.trim()}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  + Add colour
                </button>
              </div>
            </div>
          ) : (
            /* ── READ MODE ── */
            <>
              <p className="text-xs text-gray-500 mb-3">
                Total: {po.totalPairs.toLocaleString()} pairs · RM {po.totalPairs > 0 ? (rmValue / po.totalPairs).toFixed(2) : "—"}/pair
              </p>
              {colorRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Colour</th>
                        {usedSizes.map(sz => (
                          <th key={sz} className="px-3 py-2 text-xs font-medium text-gray-500 text-center">{sz}</th>
                        ))}
                        <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center uppercase">Total</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-500 text-center uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {colorRows.map(item => {
                        const itemAllocs: OutletAlloc[] = item.outletAllocations ? JSON.parse(item.outletAllocations) : [];
                        const allocSummary = itemAllocs.length > 0
                          ? itemAllocs
                              .filter(a => EDIT_SIZES.some(sz => (a as any)[`qty${sz}`] > 0))
                              .map(a => {
                                const o = outlets.find(x => x.id === a.outletId);
                                const sub = EDIT_SIZES.reduce((s, sz) => s + ((a as any)[`qty${sz}`] || 0), 0);
                                return o ? `${o.name} ×${sub}` : null;
                              }).filter(Boolean)
                          : null;
                        return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <div className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 bg-gray-200 mt-0.5" />
                              <div>
                                <span className="text-sm text-gray-800">{item.colorName || "—"}</span>
                                {allocSummary && allocSummary.length > 0 && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                                    {allocSummary.join(" · ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          {usedSizes.map(sz => {
                            const qty = (item as any)[`qty${sz}`] ?? 0;
                            return (
                              <td key={sz} className={`px-3 py-2 text-center text-sm ${qty > 0 ? "text-gray-900 font-medium" : "text-gray-300"}`}>
                                {qty > 0 ? qty : "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-semibold text-gray-900">{item.totalPairs}</td>
                          <td className="px-3 py-2 text-center text-gray-700">
                            {item.lineTotal ? Math.round(item.lineTotal * (po.fxRate ?? 0.62)).toLocaleString() : "—"}
                          </td>
                        </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 text-gray-700">Total</td>
                        {usedSizes.map(sz => (
                          <td key={sz} className="px-3 py-2 text-center text-gray-900">{colTotal(sz) || "—"}</td>
                        ))}
                        <td className="px-3 py-2 text-center text-gray-900">{po.totalPairs.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center text-gray-900">{Math.round(rmValue).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-4 text-center">
                  No quantities set yet — click <span className="font-semibold">Edit</span> to fill in sizes and colours.
                </p>
              )}
              {po.sizeCurveInsight && (
                <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Size curve insight: </span>
                  {po.sizeCurveInsight}
                </div>
              )}
            </>
          )}
        </div>

        {/* Allocation by destination */}
        {allocations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Allocation by destination</p>
              <Link href={`/dashboard/purchase-orders/${id}`}
                className="text-xs text-brand-600 hover:underline">Edit ↗</Link>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {allocations.map((a, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">{a.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{a.pairs.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.pct}%{a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Production timeline */}
        <div className="border border-gray-100 rounded-xl p-5">
          <Timeline po={po} onSave={saveDateField} />
        </div>

        {/* Main Goods Receipt Record — shown once PO is shipped or later */}
        {["shipped", "closed"].includes(po.status) && (
          <GoodsReceipt po={po} onSaved={async () => {
            try { const r = await fetch(`/api/purchase-orders/${id}`); if (r.ok) { const d = await r.json(); if (d?.id) setPo(d); } } catch {}
            onRefreshList?.();
          }} />
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>Last edit {fmt(po.updatedAt)}</span>
          <span>·</span>
          <Link href={`/dashboard/purchase-orders/${id}`} className="text-brand-600 hover:underline">
            activity log
          </Link>
        </div>
        {po.status === "draft" && (
          <button
            onClick={submitOrder}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
          >
            Submit order →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PurchaseOrdersContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [pos, setPos]                       = useState<PO[]>([]);
  const [filter, setFilter]                 = useState("all");
  const [search, setSearch]                 = useState("");
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const tableRef = useRef<HTMLDivElement>(null);

  const selectedMonth = searchParams.get("month") ?? "all";

  function loadPos() {
    fetch("/api/purchase-orders").then(r => r.json()).then(d => setPos(Array.isArray(d) ? d : []));
  }

  useEffect(() => { loadPos(); }, []);

  async function deletePO(id: string, poNumber: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete ${poNumber}? This cannot be undone.`)) return;
    const res = await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPos(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    } else {
      alert("Failed to delete PO");
    }
  }

  const months = useMemo(() => {
    // Always include all months from Jan 2026 up to the current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based
    const baseYear = 2026;
    const scaffolded = new Set<string>();
    for (let y = baseYear; y <= currentYear; y++) {
      const startM = 1;
      const endM = y < currentYear ? 12 : currentMonth;
      for (let m = startM; m <= endM; m++) {
        scaffolded.add(`${y}-${String(m).padStart(2, "0")}`);
      }
    }
    // Also include any months from actual PO data (e.g. older years)
    for (const p of pos) {
      const k = monthKey(p.date);
      if (k !== "unknown") scaffolded.add(k);
    }
    return [...scaffolded].sort((a, b) => b.localeCompare(a));
  }, [pos]);

  const suppliersForMonth = useMemo(() => {
    const pool = selectedMonth === "all" ? pos : pos.filter(p => monthKey(p.date) === selectedMonth);
    return [...new Set(pool.map(p => p.manufacturer.name))].sort();
  }, [pos, selectedMonth]);

  function handleCardFilter(key: string) {
    setFilter(key);
    setSelectedId(null);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function selectMonth(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") params.delete("month");
    else params.set("month", key);
    router.replace(`?${params.toString()}`, { scroll: false });
    setSelectedSupplier("all");
    setSelectedId(null);
  }

  const filtered = pos.filter(p => {
    if (selectedMonth !== "all" && monthKey(p.date) !== selectedMonth) return false;
    if (selectedSupplier !== "all" && p.manufacturer.name !== selectedSupplier) return false;
    if (filter === "delayed") return (daysLate(p) ?? 0) > 0;
    if (filter === "in_production") {
      if (!["submitted", "in_production"].includes(p.status)) return false;
    } else if (filter !== "all" && !["avgLead"].includes(filter) && p.status !== filter) {
      return false;
    }
    const q = search.toLowerCase();
    return !q ||
      p.poNumber.toLowerCase().includes(q) ||
      (p.productName ?? "").toLowerCase().includes(q) ||
      p.manufacturer.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q);
  });

  // Build month → supplier grouping for the grouped list view
  type SupGroup   = { name: string; pos: PO[] };
  type MonthGroup = { mk: string; ml: string; suppliers: SupGroup[] };
  const groupedPOs = useMemo<MonthGroup[]>(() => {
    const sorted = [...filtered].sort((a, b) => {
      const mc = monthKey(b.date).localeCompare(monthKey(a.date));
      if (mc !== 0) return mc;
      const sc = a.manufacturer.name.localeCompare(b.manufacturer.name);
      if (sc !== 0) return sc;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    const groups: MonthGroup[] = [];
    for (const po of sorted) {
      const mk = monthKey(po.date);
      let mGroup = groups.find(g => g.mk === mk);
      if (!mGroup) { mGroup = { mk, ml: monthLabel(mk), suppliers: [] }; groups.push(mGroup); }
      let sGroup = mGroup.suppliers.find(s => s.name === po.manufacturer.name);
      if (!sGroup) { sGroup = { name: po.manufacturer.name, pos: [] }; mGroup.suppliers.push(sGroup); }
      sGroup.pos.push(po);
    }
    return groups;
  }, [filtered]);

  const totalPOs     = pos.length;
  const committedRm  = totalCommittedRm(pos);
  const delayedCount = pos.filter(p => (daysLate(p) ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalPOs} PO{totalPOs !== 1 ? "s" : ""}
            {committedRm > 0 && <> · <span className="font-medium text-gray-700">RM {Math.round(committedRm).toLocaleString()} committed</span></>}
            {delayedCount > 0 && <> · <span className="text-red-500 font-medium">{delayedCount} delayed</span></>}
          </p>
        </div>
        <Link href="/dashboard/purchase-orders/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New purchase order
        </Link>
      </div>

      {/* Summary cards */}
      <SummaryCards pos={pos} activeFilter={filter} onFilter={handleCardFilter} />

      {/* Month tabs */}
      {months.length > 0 && (
        <div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => selectMonth("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedMonth === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              All months
            </button>
            {months.map(mk => (
              <button key={mk} onClick={() => selectMonth(mk)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedMonth === mk
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                {monthLabel(mk)}
              </button>
            ))}
          </div>

          {/* Supplier sub-tabs — shown whenever a month is selected */}
          {selectedMonth !== "all" && (
            <div className="flex gap-1.5 flex-wrap items-center mt-2 pl-1">
              <span className="text-xs text-gray-400 mr-1">Supplier:</span>
              <button
                onClick={() => { setSelectedSupplier("all"); setSelectedId(null); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedSupplier === "all"
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                All
              </button>
              {suppliersForMonth.map(s => (
                <button key={s}
                  onClick={() => { setSelectedSupplier(s); setSelectedId(null); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedSupplier === s
                      ? "bg-brand-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status filter tabs + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => { setFilter(t.key); setSelectedId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === t.key
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {t.label}
            </button>
          ))}
          <button onClick={() => { setFilter("delayed"); setSelectedId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === "delayed"
                ? "bg-red-600 text-white"
                : "bg-white border border-gray-200 text-red-600 hover:bg-red-50"
            }`}>
            Delayed
          </button>
        </div>
        <input
          className="input text-sm w-52"
          placeholder="Search POs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div ref={tableRef} className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Photo", "Type", "Product / Sample", "Supplier · Destination", "Pairs", "Cost (RM)", "ETA", "Status", "Days late"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedPOs.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No purchase orders found.</td>
              </tr>
            )}
            {groupedPOs.flatMap(mGroup => {
              const rows: React.ReactNode[] = [];

              {/* ── Month header ─────────────────────────────────────────── */}
              if (selectedMonth === "all") {
                const totalInMonth = mGroup.suppliers.reduce((s, g) => s + g.pos.length, 0);
                rows.push(
                  <tr key={`m-${mGroup.mk}`}>
                    <td colSpan={9} className="px-4 py-2.5 bg-gray-900">
                      <div className="flex items-center gap-3">
                        <span className="text-white text-xs font-bold tracking-widest uppercase">{mGroup.ml}</span>
                        <span className="text-gray-400 text-[11px]">
                          {totalInMonth} PO{totalInMonth !== 1 ? "s" : ""} · {mGroup.suppliers.map(g => g.name).join(" · ")}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              mGroup.suppliers.forEach((sGroup, si) => {
                {/* ── Supplier header ────────────────────────────────────── */}
                if (selectedSupplier === "all") {
                  const year       = mGroup.mk.split("-")[0];
                  const monthAbbr  = mGroup.ml.split(" ")[0];          // "MAY"
                  const poCode     = `PO-${year}-${monthAbbr}${String(si + 1).padStart(2, "0")}`;
                  const totalPairs = sGroup.pos.reduce((s, p) => s + p.totalPairs, 0);
                  const totalRm    = sGroup.pos.reduce((s, p) => s + (p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62), 0);
                  const groupPdfUrl = `/api/purchase-orders/group-pdf?ids=${sGroup.pos.map(p => p.id).join(",")}&group=${encodeURIComponent(poCode)}&supplier=${encodeURIComponent(sGroup.name)}`;
                  const groupPlUrl  = `/api/purchase-orders/group-pdf-pl?ids=${sGroup.pos.map(p => p.id).join(",")}&group=${encodeURIComponent(poCode)}&supplier=${encodeURIComponent(sGroup.name)}`;
                  rows.push(
                    <tr key={`s-${mGroup.mk}-${sGroup.name}`}>
                      <td colSpan={9} className="px-4 py-2 bg-brand-50 border-y border-brand-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-black text-brand-700 bg-white border border-brand-300 px-2.5 py-0.5 rounded-lg">
                              {poCode}
                            </span>
                            <span className="text-sm font-bold text-gray-800">{sGroup.name}</span>
                            <span className="text-xs text-gray-400">
                              · {sGroup.pos.length} PO{sGroup.pos.length !== 1 ? "s" : ""}
                              {totalPairs > 0 && <> · {totalPairs.toLocaleString()} pairs</>}
                              {totalRm > 0 && <> · RM {Math.round(totalRm).toLocaleString()}</>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <a href={groupPdfUrl} target="_blank"
                              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-brand-300 text-brand-700 bg-white rounded-lg hover:bg-brand-50 transition-colors">
                              <Download size={12} /> Download PO
                            </a>
                            <a href={groupPlUrl} target="_blank"
                              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-green-300 text-green-700 bg-white rounded-lg hover:bg-green-50 transition-colors">
                              <Download size={12} /> Download PL
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                {/* ── PO rows ────────────────────────────────────────────── */}
                sGroup.pos.forEach(p => {
                  const late      = daysLate(p);
                  const isDelayed = (late ?? 0) > 0;
                  const isSelected = selectedId === p.id;
                  const rmCost    = p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62;
                  rows.push(
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(prev => prev === p.id ? null : p.id)}
                      className={`cursor-pointer transition-colors border-b border-gray-100 ${
                        isSelected ? "bg-brand-50" :
                        isDelayed  ? "bg-red-50 hover:bg-red-100" :
                        "hover:bg-gray-50"
                      }`}
                    >
                      {/* Shoe photo replaces PO number */}
                      <td className="px-3 py-2 pl-6">
                        {p.photoUrl ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                            <Image src={p.photoUrl} alt={p.productName ?? ""} width={44} height={44} className="object-cover w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                            <Camera size={13} className="text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {p.poType ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLE[p.poType] ?? "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABEL[p.poType] ?? p.poType}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 leading-tight">{p.productName || p.brand}</div>
                        {p.libProductName && (
                          <div className="text-xs text-gray-500 mt-0.5 leading-tight">{p.libProductName}</div>
                        )}
                        {p.parentPoNumber && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            <span className="text-gray-500">Parent: {p.parentPoNumber} ↗</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-700 text-xs">{p.manufacturer.name}</div>
                        {p.destination && <div className="text-xs text-gray-400 mt-0.5">{p.destination}</div>}
                      </td>
                      <td className="px-3 py-3 text-gray-800 font-medium text-right">
                        {p.totalPairs.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-gray-800 font-medium text-right">
                        {Math.round(rmCost).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {fmt(p.deliveryDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          {isDelayed ? (
                            <span className="text-xs font-medium text-red-500 flex items-center gap-1 whitespace-nowrap">
                              {late} days <AlertTriangle size={11} />
                            </span>
                          ) : ["shipped", "closed"].includes(p.status) ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : (
                            <span className="text-xs text-gray-400">on time</span>
                          )}
                          <button
                            onClick={e => deletePO(p.id, p.poNumber, e)}
                            title={`Delete ${p.poNumber}`}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  // Inline detail panel — appears immediately below the clicked row
                  if (selectedId === p.id) {
                    rows.push(
                      <tr key={`detail-${p.id}`}>
                        <td colSpan={10} className="p-0 bg-gray-50 border-b border-gray-200">
                          <DetailPanel id={p.id} onClose={() => setSelectedId(null)} onRefreshList={loadPos} />
                        </td>
                      </tr>
                    );
                  }
                });
              });

              return rows;
            })}
          </tbody>
        </table>
      </div>

      {!selectedId && pos.length > 0 && (
        <p className="text-xs text-gray-400 text-center">Detail view · click any PO above to open</p>
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <React.Suspense>
      <PurchaseOrdersContent />
    </React.Suspense>
  );
}
