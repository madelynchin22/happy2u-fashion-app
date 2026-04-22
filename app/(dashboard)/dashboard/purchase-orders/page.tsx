"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

type PO = {
  id: string; poNumber: string; brand: string; status: string;
  totalPairs: number; totalPrice: number; currency: string;
  createdAt: string; deliveryDate?: string;
  manufacturer: { name: string };
  _count: { items: number };
};

const STATUS_OPTS = ["all","draft","sent","confirmed","in_production","shipped","closed"];

export default function PurchaseOrdersPage() {
  const [pos, setPos]     = useState<PO[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { fetch("/api/purchase-orders").then(r => r.json()).then(setPos); }, []);

  const filtered = pos.filter(p => {
    const matchStatus = filter === "all" || p.status === filter;
    const q = search.toLowerCase();
    return matchStatus && (!q || p.poNumber.toLowerCase().includes(q) || p.manufacturer.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 text-sm">{filtered.length} orders</p>
        </div>
        <Link href="/dashboard/purchase-orders/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Purchase Order
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-56" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === s ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["PO Number","Brand","Manufacturer","Items","Delivery Date","Total Pairs","Total Price","Status","Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/purchase-orders/${p.id}`} className="font-medium text-brand-600 hover:underline">{p.poNumber}</Link>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.brand}</td>
                <td className="px-4 py-3 text-gray-600">{p.manufacturer.name}</td>
                <td className="px-4 py-3 text-gray-500">{p._count.items} SKUs</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(p.deliveryDate)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.totalPairs.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-gray-900">¥ {p.totalPrice.toFixed(0)}</td>
                <td className="px-4 py-3"><span className={`badge-${p.status}`}>{p.status.replace("_"," ")}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
