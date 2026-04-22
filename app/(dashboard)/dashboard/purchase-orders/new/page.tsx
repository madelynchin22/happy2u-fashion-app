"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type Manufacturer = { id: string; name: string };
const SIZES = ["36","37","38","39","40","41","42"];

type LineItem = {
  supplierSku: string; h2uSku: string; brand: string; colorName: string; colorCode: string;
  materialUpper: string; materialLining: string; materialMidsole: string;
  materialOutsole: string; hardware: string; logoSpec: string; remark: string;
  photoUrl: string; deliveryDate: string;
  qty36: number; qty37: number; qty38: number; qty39: number;
  qty40: number; qty41: number; qty42: number;
  totalPairs: number; discountPrice: string; lineTotal: number;
};

const emptyLine = (): LineItem => ({
  supplierSku:"", h2uSku:"", brand:"", colorName:"", colorCode:"",
  materialUpper:"", materialLining:"", materialMidsole:"",
  materialOutsole:"", hardware:"", logoSpec:"", remark:"", photoUrl:"", deliveryDate:"",
  qty36:0,qty37:0,qty38:0,qty39:0,qty40:0,qty41:0,qty42:0,
  totalPairs:0, discountPrice:"", lineTotal:0,
});

function calcLine(item: LineItem): LineItem {
  const totalPairs = SIZES.reduce((s, sz) => s + (Number((item as any)[`qty${sz}`]) || 0), 0);
  const price = parseFloat(item.discountPrice) || 0;
  return { ...item, totalPairs, lineTotal: totalPairs * price };
}

export default function NewPOPage() {
  const router = useRouter();
  const [mfrs, setMfrs]   = useState<Manufacturer[]>([]);
  const [saving, setSaving] = useState(false);
  const [items, setItems]  = useState<LineItem[]>([emptyLine()]);
  const [header, setHeader] = useState({
    poNumber: "", brand: "MS SWEET", manufacturerId: "", deliveryDate: "", notes: "", currency: "RMB",
  });

  useEffect(() => { fetch("/api/manufacturers").then(r => r.json()).then(setMfrs); }, []);

  function setItemField(idx: number, field: string, value: string | number) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcLine({ ...next[idx], [field]: value } as LineItem);
      return next;
    });
  }

  function addLine() { setItems(i => [...i, emptyLine()]); }
  function removeLine(idx: number) { setItems(i => i.filter((_, j) => j !== idx)); }

  const totalPairs = items.reduce((s, i) => s + i.totalPairs, 0);
  const totalPrice = items.reduce((s, i) => s + i.lineTotal, 0);

  async function save() {
    if (!header.poNumber || !header.manufacturerId) { alert("PO Number and Manufacturer are required."); return; }
    setSaving(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...header,
        totalPairs, totalPrice,
        items: items.map(i => ({ ...i, discountPrice: parseFloat(i.discountPrice) || null })),
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); router.push(`/dashboard/purchase-orders/${d.id}`); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Create PO"}</button>
        </div>
      </div>

      {/* PO Header */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">PO Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">PO Number *</label>
            <input className="input" value={header.poNumber} onChange={e => setHeader(h => ({...h, poNumber: e.target.value}))} placeholder="JUN-04" />
          </div>
          <div>
            <label className="label">Brand Name</label>
            <input className="input" value={header.brand} onChange={e => setHeader(h => ({...h, brand: e.target.value}))} placeholder="MS SWEET" />
          </div>
          <div>
            <label className="label">Manufacturer *</label>
            <select className="input" value={header.manufacturerId} onChange={e => setHeader(h => ({...h, manufacturerId: e.target.value}))}>
              <option value="">Select…</option>
              {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Delivery Date</label>
            <input className="input" type="date" value={header.deliveryDate} onChange={e => setHeader(h => ({...h, deliveryDate: e.target.value}))} />
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" value={header.currency} onChange={e => setHeader(h => ({...h, currency: e.target.value}))}>
              <option value="RMB">RMB (¥)</option>
              <option value="RM">RM</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={header.notes} onChange={e => setHeader(h => ({...h, notes: e.target.value}))} placeholder="Additional instructions…" />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
          <button onClick={addLine} className="btn-secondary flex items-center gap-2 text-xs">
            <Plus size={13} /> Add Row
          </button>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Photo URL</th>
                <th className="px-2 py-2 text-left">Supplier SKU</th>
                <th className="px-2 py-2 text-left">Brand</th>
                <th className="px-2 py-2 text-left">H2U SKU</th>
                <th className="px-2 py-2 text-left">Color</th>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">材料 Upper</th>
                <th className="px-2 py-2 text-left">内里 Lining</th>
                <th className="px-2 py-2 text-left">中底 Midsole</th>
                <th className="px-2 py-2 text-left">大底 Outsole</th>
                <th className="px-2 py-2 text-left">五金 Hardware</th>
                <th className="px-2 py-2 text-left">Logo/Remark</th>
                {SIZES.map(s => <th key={s} className="px-2 py-2 text-center">{s}</th>)}
                <th className="px-2 py-2 text-center">Pairs</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-pink-50" : ""}`}>
                  <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.photoUrl} onChange={e => setItemField(idx, "photoUrl", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.supplierSku} onChange={e => setItemField(idx, "supplierSku", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.brand} placeholder={header.brand} onChange={e => setItemField(idx, "brand", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.h2uSku} onChange={e => setItemField(idx, "h2uSku", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.colorName} onChange={e => setItemField(idx, "colorName", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-12" value={item.colorCode} onChange={e => setItemField(idx, "colorCode", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.materialUpper} onChange={e => setItemField(idx, "materialUpper", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.materialLining} onChange={e => setItemField(idx, "materialLining", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.materialMidsole} onChange={e => setItemField(idx, "materialMidsole", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.materialOutsole} onChange={e => setItemField(idx, "materialOutsole", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.hardware} onChange={e => setItemField(idx, "hardware", e.target.value)} /></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.logoSpec} onChange={e => setItemField(idx, "logoSpec", e.target.value)} /></td>
                  {SIZES.map(s => (
                    <td key={s} className="px-1 py-1">
                      <input type="number" min="0" className="input text-xs w-10 text-center"
                        value={(item as any)[`qty${s}`] || ""} onChange={e => setItemField(idx, `qty${s}`, parseInt(e.target.value) || 0)} />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-medium text-brand-700">{item.totalPairs}</td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" className="input text-xs w-16 text-right" placeholder="¥"
                      value={item.discountPrice} onChange={e => setItemField(idx, "discountPrice", e.target.value)} />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-brand-700">
                    {item.lineTotal > 0 ? `¥${item.lineTotal.toFixed(0)}` : "-"}
                  </td>
                  <td className="px-2 py-1">
                    <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-brand-50 border-t-2 border-brand-200">
              <tr>
                <td colSpan={16} className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL:</td>
                <td className="px-2 py-2 text-center font-bold text-brand-700 text-sm">{totalPairs} pairs</td>
                <td className="px-2 py-2 text-right font-bold text-brand-700 text-sm">¥{totalPrice.toFixed(0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary px-8" disabled={saving}>{saving ? "Saving…" : "Create Purchase Order"}</button>
      </div>
    </div>
  );
}
