"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, X, AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type SampleRow = {
  id: string; orderNumber: string; productName: string;
  status: string; brand: string; colorName?: string; colorCode?: string;
  colorVariants?: string;
  sampleSize?: string; dateSent?: string; deadline?: string; createdAt: string;
  updatedAt: string; productCostRm?: number;
  photoSideUrl?: string; photoFrontUrl?: string;
  designSource?: string; trendInspiration?: string;
  manufacturer: { id: string; name: string };
  productLibraries?: { id: string; mainSku?: string; productName?: string; status?: string; colorName?: string | null; colorCode?: string | null }[];
  libColours?: { colorName: string | null; colorCode: string | null }[] | null;
};

type ColorVariant = { name: string; hex: string };

type SampleDetail = SampleRow & {
  category?: string; season?: string; moq?: number;
  bulkCostEst?: number; leadTime?: number; sizesOffered?: string;
  colorVariants?: string; predecessorSku?: string; predecessorLesson?: string;
  libColours?: { colorName: string | null; colorCode: string | null }[] | null;
  launchType?: string; trendInspiration?: string;
  materialUpper?: string; materialLining?: string;
  materialMidsole?: string; materialOutsole?: string; hardware?: string;
  productCostRmb?: number; suggestedRetailLow?: number; suggestedRetailHigh?: number;
  receivedAt?: string; createdBy?: { name?: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all",            label: "All" },
  { key: "pending",        label: "Pending" },
  { key: "approved",       label: "Approved" },
  { key: "save_for_later", label: "Save for later" },
  { key: "rejected",       label: "Rejected" },
];

// Resolved statuses — approved samples go to PO, rejected stay in rejected list
const APPROVED_STATUSES      = ["approved", "ready", "used"];
const REJECTED_STATUSES      = ["rejected", "not_submitted"];
const SAVE_FOR_LATER_STATUSES = ["save_for_later"];

const SAMPLE_PRESET_COLORS = [
  { name: "Black",    hex: "#1a1a1a" },
  { name: "Beige",    hex: "#D4B896" },
  { name: "Espresso", hex: "#3C1414" },
  { name: "White",    hex: "#F4F4F4" },
];

const STATUS_STYLE: Record<string, string> = {
  draft:            "bg-amber-100 text-amber-700",
  pending:          "bg-amber-100 text-amber-700",
  not_submitted:    "bg-red-100 text-red-600",
  submitted:        "bg-amber-100 text-amber-700",
  shipping:         "bg-amber-100 text-amber-700",
  delivered:        "bg-amber-100 text-amber-700",
  pending_decision: "bg-amber-100 text-amber-700",
  ready:            "bg-green-100 text-green-700",
  approved:         "bg-green-100 text-green-700",
  used:             "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-600",
  sent:             "bg-amber-100 text-amber-700",
  received:         "bg-amber-100 text-amber-700",
  "in production":  "bg-amber-100 text-amber-700",
  save_for_later:   "bg-yellow-100 text-yellow-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft:            "Pending",
  pending:          "Pending",
  not_submitted:    "Rejected",
  submitted:        "Pending",
  sent:             "Pending",
  shipping:         "Pending",
  delivered:        "Pending",
  received:         "Pending",
  pending_decision: "Pending",
  ready:            "Approved",
  approved:         "Approved",
  used:             "Approved",
  rejected:         "Rejected",
  "in production":  "Pending",
  save_for_later:   "Save for later",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

function isOverdue(sample: SampleRow): boolean {
  const days = daysOpen(sample.createdAt);
  const awaitingDecision = ["delivered", "pending_decision"].includes(sample.status);
  return awaitingDecision && days > 14;
}

function matchesFilter(s: SampleRow, filter: string): boolean {
  if (filter === "all")            return true;
  if (filter === "pending")        return !APPROVED_STATUSES.includes(s.status) && !REJECTED_STATUSES.includes(s.status) && !SAVE_FOR_LATER_STATUSES.includes(s.status);
  if (filter === "approved")       return APPROVED_STATUSES.includes(s.status);
  if (filter === "rejected")       return REJECTED_STATUSES.includes(s.status);
  if (filter === "save_for_later") return SAVE_FOR_LATER_STATUSES.includes(s.status);
  return s.status === filter;
}

function sourceLabel(s: SampleRow): string {
  if (s.trendInspiration) return `Trend: ${s.trendInspiration}`;
  if (s.designSource === "reference") return "Based on reference";
  if (s.designSource === "licensed") return "Licensed design";
  return "Own design";
}

function parseColorVariants(raw?: string): ColorVariant[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatRm(val?: number | null): string {
  if (!val) return "—";
  return `RM ${val.toFixed(0)}`;
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Thumbnail({ url }: { url?: string }) {
  if (!url) return <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0" />;
  return <img src={url} alt="" className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ActionButton({ sample }: { sample: SampleRow }) {
  if (APPROVED_STATUSES.includes(sample.status)) {
    const lib = sample.productLibraries?.[0];
    const hasSkuAssigned = !!lib?.mainSku;
    if (hasSkuAssigned) {
      return (
        <Link href={`/dashboard/product-library?status=active`} onClick={e => e.stopPropagation()}
          className="text-xs text-blue-600 font-medium flex items-center gap-0.5 hover:text-blue-800">
          View SKU <ChevronRight size={12} />
        </Link>
      );
    }
    return (
      <Link href={`/dashboard/product-library?status=draft`} onClick={e => e.stopPropagation()}
        className="text-xs text-green-600 font-medium flex items-center gap-0.5 hover:text-green-800">
        Assign SKU <ChevronRight size={12} />
      </Link>
    );
  }
  if (REJECTED_STATUSES.includes(sample.status)) {
    return <span className="text-xs text-red-400">Rejected</span>;
  }
  if (SAVE_FOR_LATER_STATUSES.includes(sample.status)) {
    return <span className="text-xs text-yellow-600 font-medium">Saved</span>;
  }
  return (
    <span className="text-xs font-medium text-amber-600 flex items-center gap-0.5 whitespace-nowrap">
      Decide <ChevronRight size={12} />
    </span>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({
  samples,
  activeFilter,
  onFilter,
}: {
  samples: SampleRow[];
  activeFilter: string;
  onFilter: (key: string) => void;
}) {
  const now = new Date();
  const thisMonth = (s: SampleRow) =>
    new Date(s.updatedAt).getMonth() === now.getMonth() &&
    new Date(s.updatedAt).getFullYear() === now.getFullYear();

  const approvedAll   = samples.filter(s => APPROVED_STATUSES.includes(s.status));
  const rejectedAll   = samples.filter(s => REJECTED_STATUSES.includes(s.status));
  const savedAll      = samples.filter(s => SAVE_FOR_LATER_STATUSES.includes(s.status));
  const approvedMonth = approvedAll.filter(thisMonth);
  const rejectedMonth = rejectedAll.filter(thisMonth);
  const savedMonth    = savedAll.filter(thisMonth);

  const cards = [
    {
      filterKey: "all",
      label: "All",
      value: samples.length,
      sub: "All sample orders",
      borderCls: "border-gray-200",
      valueCls: "text-gray-700",
      activeCls: "bg-gray-50 border-gray-400 ring-2 ring-gray-200",
    },
    {
      filterKey: "approved",
      label: "Approved",
      value: approvedAll.length,
      sub: approvedMonth.length > 0 ? `${approvedMonth.length} approved this month` : "None this month",
      borderCls: "border-green-200",
      valueCls: "text-green-700",
      activeCls: "bg-green-50 border-green-400 ring-2 ring-green-200",
    },
    {
      filterKey: "save_for_later",
      label: "Save for later",
      value: savedAll.length,
      sub: savedMonth.length > 0 ? `${savedMonth.length} saved this month` : "None this month",
      borderCls: "border-yellow-200",
      valueCls: "text-yellow-600",
      activeCls: "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200",
    },
    {
      filterKey: "rejected",
      label: "Rejected",
      value: rejectedAll.length,
      sub: rejectedMonth.length > 0 ? `${rejectedMonth.length} rejected this month` : "None this month",
      borderCls: "border-red-200",
      valueCls: "text-red-600",
      activeCls: "bg-red-50 border-red-400 ring-2 ring-red-200",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const isActive = activeFilter === c.filterKey;
        return (
          <button
            key={i}
            onClick={() => onFilter(c.filterKey === "all" || isActive ? "all" : c.filterKey)}
            className={`text-left bg-white border rounded-xl px-4 py-3 transition-all hover:shadow-sm focus:outline-none ${
              isActive ? c.activeCls : `${c.borderCls} hover:border-gray-300`
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold leading-none mb-1 ${c.valueCls}`}>{c.value}</p>
            <p className="text-xs text-gray-400">{c.sub}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

type PoSummary = {
  id: string; poNumber: string; poType?: string; status: string;
  totalPairs?: number; totalPrice?: number; date?: string; deliveryDate?: string;
};

function PoTypeBadge({ type }: { type?: string }) {
  const map: Record<string, string> = {
    test: "bg-blue-100 text-blue-700",
    reorder: "bg-green-100 text-green-700",
    replenishment: "bg-orange-100 text-orange-700",
    clearance: "bg-red-100 text-red-600",
  };
  if (!type) return null;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${map[type] ?? "bg-gray-100 text-gray-600"}`}>
      {type === "replenishment" ? "Replen" : type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function DetailPanel({ id, onClose, onStatusChange }: {
  id: string;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const router = useRouter();
  const [sample, setSample]       = useState<SampleDetail | null>(null);
  const [saving, setSaving]       = useState(false);
  const [launching, setLaunching] = useState(false);
  const [linkedPos, setLinkedPos] = useState<PoSummary[]>([]);
  const [hasLibEntry, setHasLibEntry] = useState(false);
  const [libSent, setLibSent] = useState(false);

  useEffect(() => {
    setSample(null);
    setLinkedPos([]);
    setHasLibEntry(false);
    setLibSent(false);
    fetch(`/api/samples/${id}`).then(r => r.json()).then((s: SampleDetail) => {
      setSample(s);
      fetch("/api/purchase-orders").then(r => r.json()).then((pos: PoSummary[]) => {
        if (Array.isArray(pos)) setLinkedPos(pos.filter((p: any) => p.sampleOrderId === s.orderNumber));
      });
      fetch(`/api/product-library?sampleOrderId=${s.id}`).then(r => r.json()).then((libs: any[]) => {
        setHasLibEntry(Array.isArray(libs) && libs.length > 0);
      }).catch(() => {});
    });
  }, [id]);

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    const updated = await fetch(`/api/samples/${id}`).then(r => r.json());
    setSample(updated);
    onStatusChange(id, status);
  }

  async function approve() {
    setSaving(true);
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setSaving(false);
    const updated = await fetch(`/api/samples/${id}`).then(r => r.json());
    setSample(updated);
    onStatusChange(id, "approved");
    setHasLibEntry(true);
    setLibSent(true);
  }

  async function setLaunchType(launchType: string) {
    setLaunching(true);
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ launchType }),
    });
    setLaunching(false);
    setSample(prev => prev ? { ...prev, launchType } : prev);
  }

  if (!sample) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white p-6 mt-2">
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  const days          = daysOpen(sample.createdAt);
  const isApproved    = APPROVED_STATUSES.includes(sample.status);
  const isRejected    = REJECTED_STATUSES.includes(sample.status);
  const isSaved       = SAVE_FOR_LATER_STATUSES.includes(sample.status);
  const isPending     = !isApproved && !isRejected && !isSaved;
  const colorVariants = parseColorVariants(sample.colorVariants);
  // When a Main SKU exists, use ProductLibrary colours; resolve hex from preset map or original sample variants
  const displayColours = sample.libColours
    ? sample.libColours.map(lc => {
        const key = (lc.colorName ?? "").toLowerCase();
        const hex =
          SAMPLE_PRESET_COLORS.find(p => p.name.toLowerCase() === key)?.hex ??
          colorVariants.find(cv => cv.name.toLowerCase() === key)?.hex ??
          "#9ca3af";
        return { name: lc.colorName ?? "", hex };
      })
    : colorVariants;

  const margin = sample.bulkCostEst && sample.suggestedRetailLow
    ? Math.round((1 - sample.bulkCostEst / sample.suggestedRetailLow) * 100)
    : null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mt-2 shadow-sm">
      {/* Panel header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-bold text-gray-900 text-lg leading-tight">
            {sample.orderNumber} · {(sample as any).productLibraries?.[0]?.productName || sample.productName}
          </h2>
          <StatusBadge status={sample.status} />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
            {days} days open
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && (
            <>
              <button onClick={() => updateStatus("rejected")} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 text-red-600">
                Reject
              </button>
              <button onClick={() => updateStatus("save_for_later")} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium border border-yellow-300 bg-yellow-50 rounded-lg hover:bg-yellow-100 text-yellow-700">
                Save for later
              </button>
              <button onClick={approve} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium bg-brand-700 text-white rounded-lg hover:bg-brand-800 flex items-center gap-1">
                {saving ? "Approving…" : <><span>Approve</span> <ChevronRight size={14} /></>}
              </button>
            </>
          )}
          {isSaved && (
            <>
              <button onClick={() => updateStatus("rejected")} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 text-red-600">
                Reject
              </button>
              <button onClick={approve} disabled={saving}
                className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1">
                {saving ? "Approving…" : <><span>Approve</span> <ChevronRight size={14} /></>}
              </button>
            </>
          )}
          {isApproved && (
            <span className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
              ✓ Approved
            </span>
          )}
          {isSaved && (
            <span className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-lg">
              ⏸ Saved for later
            </span>
          )}
          {isRejected && (
            <span className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg">
              Rejected
            </span>
          )}
          {/* Edit navigates to the full-page edit form */}
          <button
            onClick={() => router.push(`/dashboard/samples/${id}?edit=1`)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Edit
          </button>
          <Link href={`/dashboard/samples/${id}`}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-brand-600 border border-gray-200 rounded-lg">
            Full details
          </Link>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Approved → sent to Product Library banner */}
      {(libSent || (isApproved && hasLibEntry)) && (
        <div className="mx-5 mt-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-violet-800">
            ✓ Sent to Product Library — assign a Main SKU to activate, then create a PO from the New PO page.
          </p>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <Link href="/dashboard/product-library"
              className="text-sm font-medium text-violet-700 hover:text-violet-900 flex items-center gap-1 whitespace-nowrap">
              Product Library <ChevronRight size={14} />
            </Link>
            <Link href="/dashboard/purchase-orders/new"
              className="text-sm font-medium text-brand-700 hover:text-brand-900 flex items-center gap-1 whitespace-nowrap">
              New PO <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
      {isApproved && !hasLibEntry && !libSent && (
        <div className="mx-5 mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800">✓ Sample approved.</p>
          <Link href="/dashboard/purchase-orders/new"
            className="ml-4 text-sm font-medium text-green-700 hover:text-green-900 flex items-center gap-1 whitespace-nowrap">
            New PO <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Save-for-later decision section */}
      {isSaved && (
        <div className="mx-5 mt-4 bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-yellow-800 mb-0.5">⏸ Saved for later — decision pending</p>
              <p className="text-xs text-yellow-700">Make a final call on this sample when you're ready. Approving will not auto-create a PO.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => updateStatus("rejected")} disabled={saving}
                className="px-4 py-2 text-sm font-medium border border-red-300 bg-white rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                Reject
              </button>
              <button onClick={approve} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 transition-colors">
                {saving ? "Approving…" : <><span>Approve</span> <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* From line */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
        From <span className="font-medium text-gray-700">{sample.manufacturer.name}</span>
        {sample.receivedAt && <> · received {formatDate(sample.receivedAt)}</>}
        {sample.createdBy?.name && <> · reviewer: {sample.createdBy.name}</>}
      </div>

      <div className="p-5 grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Specifications</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-gray-500">Product name</span>
              <span className="font-medium text-gray-900">{(sample as any).productLibraries?.[0]?.productName || sample.productName || "—"}</span>
              <span className="text-gray-500">Category</span>
              <span className="font-medium text-gray-900">{sample.category || "—"}</span>
              <span className="text-gray-500">Season</span>
              <span className="font-medium text-gray-900">{sample.season || "—"}</span>
              <span className="text-gray-500 self-start pt-1">Colours</span>
              {displayColours.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {displayColours.map(cv => (
                    <span key={cv.name} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
                      <span className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" style={{backgroundColor: cv.hex}} />
                      {cv.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-medium text-gray-900">{sample.colorName || "—"}</span>
              )}
              <span className="text-gray-500">MOQ</span>
              <span className="font-medium text-gray-900">{sample.moq != null ? `${sample.moq} pairs` : "—"}</span>
              <span className="text-gray-500">Sample cost</span>
              <span className="font-medium text-gray-900">{sample.productCostRm != null ? `RM ${sample.productCostRm.toFixed(0)}` : "—"}</span>
              <span className="text-gray-500">Bulk cost (est)</span>
              <span className="font-medium text-gray-900">{sample.bulkCostEst != null ? `RM ${sample.bulkCostEst.toFixed(0)}` : "—"}</span>
              <span className="text-gray-500">Proposed retail</span>
              <span className="font-medium text-gray-900">{sample.suggestedRetailLow != null ? `RM ${sample.suggestedRetailLow.toFixed(0)}` : "—"}</span>
              <span className="text-gray-500">Margin (proj)</span>
              <span className="font-medium text-gray-900">{margin !== null ? `${margin}%` : "—"}</span>
              <span className="text-gray-500">Lead time</span>
              <span className="font-medium text-gray-900">{sample.leadTime != null ? `${sample.leadTime} days` : "—"}</span>
              <span className="text-gray-500">Sizes offered</span>
              <span className="font-medium text-gray-900">{sample.sizesOffered || "—"}</span>
            </div>
          </div>

          {displayColours.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Color Variants Offered</p>
              <div className="flex flex-wrap gap-2">
                {displayColours.map(cv => (
                  <div key={cv.name} className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: cv.hex }} />
                    <span className="text-sm text-gray-700">{cv.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(sample.trendInspiration || sample.predecessorSku) && (
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Source & Predecessor</p>
              <div className="space-y-1 text-sm">
                {sample.trendInspiration && (
                  <p className="text-gray-700">Inspired by trend: <span className="text-brand-700 font-medium">{sample.trendInspiration} ↗</span></p>
                )}
                {sample.predecessorSku && (
                  <p className="text-gray-700">Predecessor SKU: <Link href="#" className="text-brand-700 font-medium hover:underline">{sample.predecessorSku} ↗</Link></p>
                )}
                {sample.predecessorLesson && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>Lessons from predecessor: {sample.predecessorLesson}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {(sample.materialUpper || sample.materialLining || sample.materialMidsole || sample.materialOutsole || sample.hardware) && (
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Materials</p>
              <div className="space-y-1.5 text-sm">
                {([
                  ["Upper",    sample.materialUpper],
                  ["Lining",   sample.materialLining],
                  ["Insole",   sample.materialMidsole],
                  ["Outsole",  sample.materialOutsole],
                  ["Hardware", sample.hardware],
                ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex gap-2 items-center">
                    <span className="text-gray-500 w-16 flex-shrink-0">{label}:</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Decision · Launch Type</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "market_test", label: "Market test",  sub: "200–500 pairs · validate demand before scaling" },
                { key: "full_launch", label: "Full launch",  sub: "1,000+ pairs · skip test, proven demand" },
                { key: "reject",      label: "Reject",       sub: "Decision rationale required" },
              ].map(opt => {
                const active = sample.launchType === opt.key;
                return (
                  <button key={opt.key} onClick={() => setLaunchType(opt.key)} disabled={launching}
                    className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                      active ? "border-brand-600 bg-brand-50 text-brand-800"
                             : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}>
                    <p className={`font-semibold mb-1 ${active ? "text-brand-800" : "text-gray-800"}`}>{opt.label}</p>
                    <p className="text-gray-400 leading-tight">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Order History */}
      <div className="px-5 pb-5">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Purchase Order History</p>
        {linkedPos.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No purchase orders linked to this sample yet.</p>
        ) : (
          <div className="space-y-2">
            {linkedPos.map(po => (
              <Link key={po.id} href={`/dashboard/purchase-orders/${po.id}`} onClick={e => e.stopPropagation()}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-700 group-hover:text-brand-700">{po.poNumber}</span>
                  <PoTypeBadge type={po.poType} />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    po.status === "closed" ? "bg-gray-100 text-gray-500" :
                    po.status === "shipped" ? "bg-green-100 text-green-700" :
                    po.status === "in_production" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{po.status ?? "draft"}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {po.totalPairs != null && po.totalPairs > 0 && <span>{po.totalPairs.toLocaleString()} pairs</span>}
                  {po.date && <span>{formatDate(po.date)}</span>}
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-brand-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center gap-3">
        <span>Last updated {formatDate(sample.updatedAt)}</span>
        <span>·</span>
        <Link href={`/dashboard/samples/${id}`} className="text-brand-600 hover:underline">view activity log</Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SamplesPage() {
  const [samples, setSamples]         = useState<SampleRow[]>([]);
  const [filter, setFilter]           = useState("all");
  const [mfrFilter, setMfrFilter]     = useState("all");
  const [sortBy, setSortBy]           = useState("newest");
  const [search, setSearch]           = useState("");
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  function loadSamples() {
    fetch("/api/samples").then(r => r.json()).then(d => setSamples(Array.isArray(d) ? d : []));
  }

  useEffect(() => { loadSamples(); }, []);

  function handleCardFilter(key: string) {
    setFilter(key);
    setSelectedId(null);
  }

  async function deleteSample(id: string, orderNumber: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete ${orderNumber}? This cannot be undone.`)) return;
    const res = await fetch(`/api/samples/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSamples(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    } else {
      alert("Failed to delete sample order");
    }
  }

  // Unique manufacturer list for the dropdown
  const manufacturers = Array.from(
    new Map(samples.map(s => [s.manufacturer.id, s.manufacturer.name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = samples
    .filter(s => {
      if (!matchesFilter(s, filter)) return false;
      if (mfrFilter !== "all" && s.manufacturer.id !== mfrFilter) return false;
      const q = search.toLowerCase();
      return !q ||
        (s.orderNumber ?? "").toLowerCase().includes(q) ||
        (s.productName ?? "").toLowerCase().includes(q) ||
        (s.manufacturer?.name ?? "").toLowerCase().includes(q) ||
        (s.colorName ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "newest")   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest")   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name_az")  return a.productName.localeCompare(b.productName);
      if (sortBy === "name_za")  return b.productName.localeCompare(a.productName);
      if (sortBy === "supplier") return (a.manufacturer.name).localeCompare(b.manufacturer.name);
      return 0;
    });

  const totalCount  = samples.length;
  const pendingCount = samples.filter(s => !APPROVED_STATUSES.includes(s.status) && !REJECTED_STATUSES.includes(s.status)).length;
  const avgDays = samples.length > 0
    ? Math.round(samples.reduce((acc, s) => acc + daysOpen(s.createdAt), 0) / samples.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sample orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalCount} sample{totalCount !== 1 ? "s" : ""}
            {pendingCount > 0 && <> · <span className="text-orange-600 font-medium">{pendingCount} pending decision</span></>}
            {avgDays > 0 && <> · avg {avgDays} days to verdict</>}
          </p>
        </div>
        <Link href="/dashboard/samples/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create new sample order
        </Link>
      </div>

      {/* Summary cards */}
      <SummaryCards samples={samples} activeFilter={filter} onFilter={handleCardFilter} />

      {/* Filter tabs + manufacturer filter + sort + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status tabs */}
          <div className="flex gap-1">
            {FILTER_TABS.map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === t.key
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Manufacturer filter */}
          <select
            className="input text-xs py-1.5 pr-8 w-40"
            value={mfrFilter}
            onChange={e => { setMfrFilter(e.target.value); setSelectedId(null); }}
          >
            <option value="all">All suppliers</option>
            {manufacturers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            className="input text-xs py-1.5 pr-8 w-36"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_az">Name A → Z</option>
            <option value="name_za">Name Z → A</option>
            <option value="supplier">Supplier A → Z</option>
          </select>
        </div>

        <input
          className="input text-sm w-52"
          placeholder="Search orders…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Photo", "Ref No.", "Product / Source", "Supplier", "Color", "Size", "Cost", "Status", "Days open", "Action", ""].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const days       = daysOpen(s.createdAt);
              const isSelected = selectedId === s.id;
              const photoUrl   = s.photoSideUrl || s.photoFrontUrl;

              return (
                <React.Fragment key={s.id}>
                  <tr
                    onClick={() => setSelectedId(prev => prev === s.id ? null : s.id)}
                    className={`cursor-pointer transition-colors border-b border-gray-100 ${
                      isSelected ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-3 py-2.5"><Thumbnail url={photoUrl} /></td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-gray-700 font-mono text-xs">{s.orderNumber}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900 leading-tight">{s.productLibraries?.[0]?.productName || s.productName}</div>
                      {s.productLibraries?.[0]?.mainSku ? (
                        <div className="text-xs text-blue-600 font-mono mt-0.5">{s.productLibraries[0].mainSku}</div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-0.5">{sourceLabel(s)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{s.manufacturer?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        // When a Main SKU exists, Product Library is source of truth for colours
                        if (s.libColours && s.libColours.length > 0) {
                          const sampleVariants = parseColorVariants(s.colorVariants);
                          return (
                            <div className="flex items-center gap-1">
                              {s.libColours.map(lc => {
                                const key = (lc.colorName ?? "").toLowerCase();
                                const hex =
                                  SAMPLE_PRESET_COLORS.find(p => p.name.toLowerCase() === key)?.hex ??
                                  sampleVariants.find(v => v.name.toLowerCase() === key)?.hex ??
                                  "#9ca3af";
                                return (
                                  <span key={lc.colorName} title={lc.colorName ?? ""}
                                    className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0"
                                    style={{ backgroundColor: hex }} />
                                );
                              })}
                            </div>
                          );
                        }
                        const variants = parseColorVariants(s.colorVariants);
                        if (variants.length > 0) {
                          return (
                            <div className="flex items-center gap-1">
                              {variants.map(cv => (
                                <span key={cv.name} title={cv.name}
                                  className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0"
                                  style={{ backgroundColor: cv.hex }} />
                              ))}
                            </div>
                          );
                        }
                        if (s.colorName) {
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0 bg-gray-400" />
                              <span className="text-xs text-gray-700">{s.colorName}</span>
                            </div>
                          );
                        }
                        return <span className="text-gray-300">—</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{s.sampleSize ? `EU ${s.sampleSize}` : "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-800">
                      {s.productCostRm ? `RM ${s.productCostRm.toFixed(0)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5">
                      {["approved", "ready", "rejected", "used", "not_submitted"].includes(s.status) ? (
                        <span className="text-xs text-gray-400">closed</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-600">{days} days</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <ActionButton sample={s} />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={e => deleteSample(s.id, s.orderNumber, e)}
                        title={`Delete ${s.orderNumber}`}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>

                  {isSelected && (
                    <tr>
                      <td colSpan={11} className="p-0 bg-white">
                        <DetailPanel
                          id={s.id}
                          onClose={() => setSelectedId(null)}
                          onStatusChange={(sid, status) => {
                            setSamples(prev => prev.map(r => r.id === sid ? { ...r, status } : r));
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">No sample orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
