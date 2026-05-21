"use client";
import { useEffect, useState } from "react";
import { CreditCard, AlertTriangle, Clock, CheckCircle, BadgeCheck } from "lucide-react";
import { POTabs } from "@/components/layout/POTabs";

const PAYMENT_DAYS = 30;
const DEFAULT_FX = 0.62;

type BatchSku = { h2uSku: string | null; colorName: string | null; pairs: number };
type Batch = { shipDate: string; pairs: number; price: number; skus: BatchSku[] };

type POPayment = {
  id: string;
  poNumber: string;
  productName: string | null;
  brand: string | null;
  status: string;
  paymentPaidDate: string | null;
  totalPrice: number | null;
  totalPairs: number;
  currency: string;
  fxRate: number | null;
  paymentTerms: string | null;
  paymentIncoterm: string | null;
  manufacturer: { id: string; name: string };
  batches: Batch[];
};

function daysLeft(shipDate: string): number {
  const due = new Date(shipDate);
  due.setDate(due.getDate() + PAYMENT_DAYS);
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}

function dueDate(shipDate: string): string {
  const d = new Date(shipDate);
  d.setDate(d.getDate() + PAYMENT_DAYS);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Urgency = "overdue" | "urgent" | "soon" | "ok";

function urgency(days: number): Urgency {
  if (days < 0)  return "overdue";
  if (days <= 7) return "urgent";
  if (days <= 14) return "soon";
  return "ok";
}

// Most urgent batch across all batches in a PO
function poUrgency(po: POPayment): Urgency {
  const days = po.batches.map(b => daysLeft(b.shipDate));
  const min = Math.min(...days);
  return urgency(min);
}

const URGENCY_ROW: Record<Urgency, string> = {
  overdue: "bg-red-50 border-l-4 border-l-red-500",
  urgent:  "bg-orange-50 border-l-4 border-l-orange-400",
  soon:    "bg-amber-50 border-l-4 border-l-amber-300",
  ok:      "bg-white border-l-4 border-l-transparent",
};

const URGENCY_BADGE: Record<Urgency, string> = {
  overdue: "bg-red-100 text-red-700 font-bold",
  urgent:  "bg-orange-100 text-orange-700 font-semibold",
  soon:    "bg-amber-100 text-amber-700",
  ok:      "bg-green-100 text-green-700",
};

function batchRm(batch: Batch, po: POPayment): number {
  return po.currency === "RMB" ? batch.price * (po.fxRate ?? DEFAULT_FX) : batch.price;
}

function skuLabel(skus: BatchSku[]): string {
  return skus.map(s => {
    const sku = s.h2uSku?.match(/^(S\d+)/i)?.[1] ?? s.h2uSku ?? "";
    const col = s.colorName ?? "";
    const label = [sku, col].filter(Boolean).join(" ");
    return label ? `${label} ×${s.pairs}` : `×${s.pairs}`;
  }).join(" · ");
}

export default function PaymentTrackingPage() {
  const [pos, setPos]         = useState<POPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(false);

  function load() {
    fetch("/api/payment-tracking")
      .then(r => r.json())
      .then(d => { setPos(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function markPaid(id: string) {
    setMarking(id);
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPaidDate: new Date().toISOString() }),
    });
    setMarking(null);
    load();
  }

  async function unmarkPaid(id: string) {
    setMarking(id);
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPaidDate: null }),
    });
    setMarking(null);
    load();
  }

  const unpaid = pos.filter(p => !p.paymentPaidDate);
  const paid   = pos.filter(p =>  p.paymentPaidDate);

  // Sort unpaid by most-urgent batch first
  const sortedUnpaid = [...unpaid].sort((a, b) => {
    const aMin = Math.min(...a.batches.map(b => daysLeft(b.shipDate)));
    const bMin = Math.min(...b.batches.map(b => daysLeft(b.shipDate)));
    return aMin - bMin;
  });

  // Summary
  const overdueCount = unpaid.filter(p => poUrgency(p) === "overdue").length;
  const urgentCount  = unpaid.filter(p => poUrgency(p) === "urgent").length;
  const totalDueRm   = unpaid.reduce((s, p) =>
    s + p.batches.reduce((bs, b) => bs + batchRm(b, p), 0), 0);

  // Group unpaid by supplier
  const bySupplier = sortedUnpaid.reduce<Record<string, POPayment[]>>((acc, p) => {
    const key = p.manufacturer.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <POTabs />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard size={20} className="text-brand-600" />
          Payment Tracking
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Payment due {PAYMENT_DAYS} days from supplier ship-out date
        </p>
      </div>

      {/* Summary cards */}
      {!loading && pos.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 ${overdueCount > 0 ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={15} className={overdueCount > 0 ? "text-red-500" : "text-gray-300"} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</span>
            </div>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-gray-300"}`}>{overdueCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">past payment due date</p>
          </div>
          <div className={`rounded-xl border p-4 ${urgentCount > 0 ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={15} className={urgentCount > 0 ? "text-orange-500" : "text-gray-300"} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due within 7 days</span>
            </div>
            <p className={`text-2xl font-bold ${urgentCount > 0 ? "text-orange-600" : "text-gray-300"}`}>{urgentCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">require immediate attention</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={15} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total outstanding</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">RM {Math.round(totalDueRm).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{unpaid.length} PO{unpaid.length !== 1 ? "s" : ""} pending payment</p>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>}

      {!loading && pos.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-16 text-center">
          <CreditCard size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No payments to track</p>
          <p className="text-xs text-gray-300 mt-1">Payments appear here once a PO has a Supplier Ship Out date</p>
        </div>
      )}

      {!loading && unpaid.length === 0 && paid.length > 0 && (
        <div className="border border-dashed border-green-200 rounded-xl p-8 text-center bg-green-50">
          <BadgeCheck size={28} className="mx-auto text-green-400 mb-2" />
          <p className="text-sm font-medium text-green-700">All payments settled</p>
        </div>
      )}

      {/* Unpaid — grouped by supplier */}
      {!loading && Object.entries(bySupplier).map(([supplierName, poList]) => {
        const supplierTotalRm = poList.reduce((s, p) =>
          s + p.batches.reduce((bs, b) => bs + batchRm(b, p), 0), 0);
        const mostUrgent = poList[0] ? poUrgency(poList[0]) : "ok";

        return (
          <div key={supplierName} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-gray-900">{supplierName}</span>
                <span className="text-xs text-gray-400">{poList.length} PO{poList.length !== 1 ? "s" : ""}</span>
                {mostUrgent === "overdue" && (
                  <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Has overdue</span>
                )}
                {mostUrgent === "urgent" && (
                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Due soon</span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-700">
                RM {Math.round(supplierTotalRm).toLocaleString()} total
              </span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-2 w-28">PO</th>
                  <th className="text-left px-3 py-2">Shipped items</th>
                  <th className="text-center px-3 py-2 w-24">Ship Date</th>
                  <th className="text-center px-3 py-2 w-28">Payment Due</th>
                  <th className="text-center px-3 py-2 w-24">Days Left</th>
                  <th className="text-right px-5 py-2 w-32">Amount</th>
                  <th className="text-left px-3 py-2 w-28">Terms</th>
                  <th className="text-center px-3 py-2 w-24">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {poList.map(po => {
                  const isPartial = po.batches.reduce((s, b) => s + b.pairs, 0) < po.totalPairs;
                  return po.batches.map((batch, bIdx) => {
                    const days = daysLeft(batch.shipDate);
                    const urg  = urgency(days);
                    const rmAmt = batchRm(batch, po);
                    const isFirst = bIdx === 0;
                    const isLast  = bIdx === po.batches.length - 1;
                    return (
                      <tr key={`${po.id}-${batch.shipDate}`} className={`${URGENCY_ROW[urg]} transition-colors`}>
                        <td className="px-5 py-3 align-top">
                          {isFirst && (
                            <>
                              <span className="font-mono font-semibold text-xs text-gray-800">{po.poNumber}</span>
                              {isPartial && po.batches.length === 1 && (
                                <p className="text-[10px] text-amber-600 mt-0.5">
                                  {po.batches[0].pairs}/{po.totalPairs} pairs
                                </p>
                              )}
                              {po.batches.length > 1 && (
                                <p className="text-[10px] text-blue-500 mt-0.5">{po.batches.length} batches</p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs text-gray-700 font-medium">{skuLabel(batch.skus)}</p>
                          {po.productName && isFirst && (
                            <p className="text-[11px] text-gray-400">{po.productName}{po.brand ? ` · ${po.brand}` : ""}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{fmt(batch.shipDate)}</td>
                        <td className="px-3 py-3 text-center text-xs font-medium text-gray-700">{dueDate(batch.shipDate)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${URGENCY_BADGE[urg]}`}>
                            {urg === "overdue"
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                              ? "Due today"
                              : `${days}d left`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-gray-800 align-top">
                          RM {Math.round(rmAmt).toLocaleString()}
                          {po.currency === "RMB" && (
                            <p className="text-[11px] text-gray-400 font-normal">¥{Math.round(batch.price).toLocaleString()}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 max-w-[120px] truncate align-top">
                          {isFirst ? (po.paymentTerms ?? "—") : ""}
                        </td>
                        <td className="px-3 py-3 text-center align-top">
                          {isFirst && (
                            <button
                              onClick={() => markPaid(po.id)}
                              disabled={marking === po.id}
                              className="text-[11px] px-2.5 py-1 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {marking === po.id ? "…" : "Mark Paid"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Settled / Paid section */}
      {!loading && paid.length > 0 && (
        <div>
          <button
            onClick={() => setShowPaid(v => !v)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <BadgeCheck size={14} className="text-green-500" />
            {showPaid ? "Hide" : "Show"} {paid.length} settled payment{paid.length !== 1 ? "s" : ""}
            <span className="text-gray-300">{showPaid ? "▲" : "▼"}</span>
          </button>

          {showPaid && (
            <div className="border border-green-100 rounded-xl overflow-hidden opacity-75">
              <div className="bg-green-50 px-5 py-2.5 border-b border-green-100 flex items-center gap-2">
                <BadgeCheck size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">Settled Payments</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-2 w-28">PO</th>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-left px-3 py-2">Supplier</th>
                    <th className="text-center px-3 py-2 w-24">Ship Date</th>
                    <th className="text-center px-3 py-2 w-28">Paid On</th>
                    <th className="text-right px-5 py-2 w-32">Amount</th>
                    <th className="text-center px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {paid.map(po => {
                    const totalRm = po.batches.reduce((s, b) => s + batchRm(b, po), 0);
                    const earliestShip = po.batches[0]?.shipDate;
                    return (
                      <tr key={po.id} className="bg-white hover:bg-green-50/30 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="font-mono text-xs text-gray-500">{po.poNumber}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{po.productName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{po.manufacturer.name}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                          {earliestShip ? fmt(earliestShip) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            <BadgeCheck size={11} /> {fmt(po.paymentPaidDate!)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs text-gray-500">
                          RM {Math.round(totalRm).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => unmarkPaid(po.id)}
                            disabled={marking === po.id}
                            className="text-[11px] text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Undo paid"
                          >
                            Undo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
