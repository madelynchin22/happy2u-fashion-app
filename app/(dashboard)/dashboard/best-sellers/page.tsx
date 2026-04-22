"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";

type BestSeller = {
  id: string; productName: string; supplierSku?: string; h2uSku?: string;
  category: string; season?: string; colorName?: string; material?: string;
  unitsSold?: number; revenueRm?: number; notes?: string;
};

const CATEGORIES = ["heels","flats","sandals","boots","bags","accessories","shoe_care","keychain","merchandiser"];

const empty = {
  productName:"", supplierSku:"", h2uSku:"", category:"heels",
  season:"", colorName:"", material:"", unitsSold:"", revenueRm:"", notes:"",
};

export default function BestSellersPage() {
  const [list, setList]     = useState<BestSeller[]>([]);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/best-sellers").then(r => r.json()).then(setList);
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/best-sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unitsSold: form.unitsSold ? parseInt(form.unitsSold) : null,
        revenueRm: form.revenueRm ? parseFloat(form.revenueRm) : null,
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); setList(l => [d, ...l]); setModal(false); setForm(empty); }
  }

  async function del(id: string) {
    if (!confirm("Remove this best seller record?")) return;
    await fetch(`/api/best-sellers/${id}`, { method: "DELETE" });
    setList(l => l.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Past Best Sellers</h1>
          <p className="text-gray-500 text-sm">This data is fed to the AI to suggest your next collection</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Best Seller
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Product Name","SKU","Category","Color","Material","Season","Units Sold","Revenue (RM)",""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((b, i) => (
              <tr key={b.id} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                <td className="px-4 py-3 font-medium text-gray-900">{b.productName}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{b.h2uSku ?? b.supplierSku ?? "-"}</td>
                <td className="px-4 py-3"><span className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full capitalize">{b.category}</span></td>
                <td className="px-4 py-3 text-gray-600">{b.colorName ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{b.material ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500">{b.season ?? "-"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{b.unitsSold?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3 text-gray-700">{b.revenueRm ? `RM ${b.revenueRm.toLocaleString()}` : "-"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => del(b.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                No best seller data yet. Add your top products from past seasons so the AI can learn your customers' preferences.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add Best Seller</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Product Name *</label>
                <input className="input" value={form.productName} onChange={e => setForm(f=>({...f,productName:e.target.value}))} placeholder="Block Heel Mary Jane" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">H2U SKU</label>
                  <input className="input" value={form.h2uSku} onChange={e => setForm(f=>({...f,h2uSku:e.target.value}))} placeholder="S1764C" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Color</label>
                  <input className="input" value={form.colorName} onChange={e => setForm(f=>({...f,colorName:e.target.value}))} placeholder="Beige" />
                </div>
                <div>
                  <label className="label">Material</label>
                  <input className="input" value={form.material} onChange={e => setForm(f=>({...f,material:e.target.value}))} placeholder="PU, Suede, Genuine Leather" />
                </div>
                <div>
                  <label className="label">Season</label>
                  <input className="input" value={form.season} onChange={e => setForm(f=>({...f,season:e.target.value}))} placeholder="SS2025" />
                </div>
                <div>
                  <label className="label">Units Sold</label>
                  <input className="input" type="number" value={form.unitsSold} onChange={e => setForm(f=>({...f,unitsSold:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Revenue (RM)</label>
                  <input className="input" type="number" step="0.01" value={form.revenueRm} onChange={e => setForm(f=>({...f,revenueRm:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Why it sold well, customer feedback…" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving || !form.productName}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
