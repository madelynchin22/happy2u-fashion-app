"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

type Sample = {
  id: string; orderNumber: string; productName: string;
  status: string; brand: string; colorName?: string; colorCode?: string;
  sampleSize?: string; dateSent?: string; deadline?: string; createdAt: string;
  manufacturer: { name: string };
};

const STATUSES = [
  { key: "all",       label: "All" },
  { key: "draft",     label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "shipping",  label: "Shipping" },
  { key: "delivered", label: "Delivered" },
  { key: "ready",     label: "Ready" },
  { key: "used",      label: "Used" },
  { key: "rejected",  label: "Rejected" },
];

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  shipping:  "bg-purple-100 text-purple-700",
  delivered: "bg-yellow-100 text-yellow-700",
  ready:     "bg-green-100 text-green-700",
  used:      "bg-brand-100 text-brand-700",
  rejected:  "bg-red-100 text-red-600",
  // legacy status support
  sent:      "bg-blue-100 text-blue-700",
  received:  "bg-yellow-100 text-yellow-700",
  approved:  "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", sent: "Submitted",
  shipping: "Shipping", delivered: "Delivered", received: "Delivered",
  ready: "Ready", approved: "Ready", used: "Used", rejected: "Rejected",
};

export default function SamplesPage() {
  const router = useRouter();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/samples").then(r => r.json()).then(d => setSamples(Array.isArray(d) ? d : []));
  }, []);

  const filtered = samples.filter(s => {
    const matchStatus = filter === "all" || s.status === filter ||
      (filter === "submitted" && s.status === "sent") ||
      (filter === "delivered" && s.status === "received") ||
      (filter === "ready" && s.status === "approved");
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (s.orderNumber ?? "").toLowerCase().includes(q) ||
      (s.productName ?? "").toLowerCase().includes(q) ||
      (s.manufacturer?.name ?? "").toLowerCase().includes(q) ||
      (s.brand ?? "").toLowerCase().includes(q) ||
      (s.colorName ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sample Orders</h1>
          <p className="text-gray-500 text-sm">{samples.length} order{samples.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/dashboard/samples/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Sample Order
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-56 text-sm" placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s.key ? "bg-brand-700 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Ref No.", "Brand", "Manufacturer", "Color / Size", "Status", "Date Sent", "Deadline"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} onClick={() => router.push(`/dashboard/samples/${s.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <span className="font-semibold text-brand-700 font-mono text-xs">
                    {s.orderNumber}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{s.brand || "-"}</div>
                  <div className="text-xs text-gray-400">{s.productName}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.manufacturer?.name ?? "-"}</td>
                <td className="px-4 py-3">
                  {s.colorName && <div className="text-gray-700">{s.colorName}{s.colorCode ? ` · ${s.colorCode}` : ""}</div>}
                  {s.sampleSize && <div className="text-xs text-gray-400">EU {s.sampleSize}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {s.dateSent ? new Date(s.dateSent).toLocaleDateString("en-GB") : "-"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {s.deadline ? (
                    <span className={new Date(s.deadline) < new Date() && s.status === "draft" ? "text-red-500 font-medium" : "text-gray-500"}>
                      {new Date(s.deadline).toLocaleDateString("en-GB")}
                    </span>
                  ) : "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sample orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
