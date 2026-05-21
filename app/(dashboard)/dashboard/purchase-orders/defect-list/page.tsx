"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { POTabs } from "@/components/layout/POTabs";

type DefectItem = {
  id: string;
  colorName: string | null;
  orderedQty: number;
  receivedQty: number | null;
  defectQty: number;
  notes: string | null;
  receiptDate: string | null;
  delivery: {
    actualArrival: string | null;
    outlet: { id: string; name: string; marking: string };
    po: { id: string; poNumber: string; productName: string | null; brand: string | null };
  };
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DefectListPage() {
  const [items, setItems]   = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/defects")
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group by PO
  const byPO = items.reduce<Record<string, { po: DefectItem["delivery"]["po"]; rows: DefectItem[] }>>((acc, item) => {
    const key = item.delivery.po.id;
    if (!acc[key]) acc[key] = { po: item.delivery.po, rows: [] };
    acc[key].rows.push(item);
    return acc;
  }, {});

  const totalDefects = items.reduce((s, i) => s + i.defectQty, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Tab navigation */}
      <POTabs />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Defect List
          </h1>
          <p className="text-sm text-gray-500 mt-1">Defects reported upon stock arrival at each outlet</p>
        </div>
        {!loading && items.length > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-red-500">{totalDefects}</p>
            <p className="text-xs text-gray-400">total defective pairs</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      )}

      {!loading && items.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-16 text-center">
          <AlertTriangle size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No defects reported yet</p>
          <p className="text-xs text-gray-300 mt-1">Defects will appear here when outlet staff save their goods receipt</p>
        </div>
      )}

      {!loading && Object.values(byPO).map(({ po, rows }) => {
        const poTotal = rows.reduce((s, r) => s + r.defectQty, 0);
        return (
          <div key={po.id} className="border border-gray-100 rounded-xl overflow-hidden">
            {/* PO Header */}
            <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm text-gray-800">{po.poNumber}</span>
                {po.brand && <span className="text-xs text-gray-400 font-medium">{po.brand}</span>}
                {po.productName && <span className="text-xs text-gray-500">{po.productName}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-red-500">{poTotal} defects</span>
                <Link
                  href={`/dashboard/purchase-orders`}
                  className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  View PO <ExternalLink size={11} />
                </Link>
              </div>
            </div>

            {/* Defect rows */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-2">Outlet</th>
                  <th className="text-left px-3 py-2">Colour</th>
                  <th className="text-center px-3 py-2">Ordered</th>
                  <th className="text-center px-3 py-2">Received</th>
                  <th className="text-center px-3 py-2 text-red-400">Defects</th>
                  <th className="text-left px-3 py-2">Notes</th>
                  <th className="text-left px-3 py-2">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-xs">{row.delivery.outlet.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{row.delivery.outlet.marking}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700 font-medium text-xs">{row.colorName ?? "—"}</td>
                    <td className="px-3 py-3 text-center text-gray-500 text-xs">{row.orderedQty}</td>
                    <td className="px-3 py-3 text-center text-gray-700 text-xs">{row.receivedQty ?? "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 bg-red-100 text-red-600 rounded font-bold text-xs">
                        {row.defectQty}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[180px] truncate">{row.notes ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{fmt(row.receiptDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
