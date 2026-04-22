"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Sample = {
  id: string; orderNumber: string; productName: string; version: number;
  status: string; brand: string; colorName?: string; season?: string;
  sentAt?: string; receivedAt?: string;
  manufacturer: { name: string };
  children: { id: string; version: number; status: string }[];
  costRm?: number; suggestedRetailLow?: number; suggestedRetailHigh?: number;
};

const STATUS_OPTS = ["all", "draft", "sent", "received", "approved", "rejected"];

export default function SamplesPage() {
  const [samples, setSamples]   = useState<Sample[]>([]);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");

  useEffect(() => {
    fetch("/api/samples").then(r => r.json()).then(setSamples);
  }, []);

  const filtered = samples.filter(s => {
    const matchStatus = filter === "all" || s.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.orderNumber.toLowerCase().includes(q) ||
      s.productName.toLowerCase().includes(q) || s.manufacturer.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sample Orders</h1>
          <p className="text-gray-500 text-sm">{filtered.length} orders</p>
        </div>
        <Link href="/dashboard/samples/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Sample Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-56" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === s ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Order No.", "Product", "Manufacturer", "Version", "Season", "Status", "Cost (RM)", "Suggested Price", "Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/samples/${s.id}`} className="font-medium text-brand-600 hover:underline">
                    {s.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{s.productName}</div>
                  {s.colorName && <div className="text-xs text-gray-400">{s.colorName}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.manufacturer.name}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">v{s.version}</span>
                  {s.children.length > 0 && (
                    <span className="ml-1 text-xs text-brand-500">+{s.children.length} ver</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{s.season ?? "-"}</td>
                <td className="px-4 py-3"><span className={`badge-${s.status}`}>{s.status}</span></td>
                <td className="px-4 py-3 text-gray-700">{s.costRm ? `RM ${s.costRm.toFixed(2)}` : "-"}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {s.suggestedRetailLow && s.suggestedRetailHigh
                    ? `RM ${s.suggestedRetailLow.toFixed(0)} – ${s.suggestedRetailHigh.toFixed(0)}`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(s.sentAt ?? undefined)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No sample orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
