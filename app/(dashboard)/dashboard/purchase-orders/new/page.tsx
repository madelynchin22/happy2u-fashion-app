"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Search, PackageSearch, BookOpen } from "lucide-react";

const BRANDS = ["Happy2U", "Blissfit", "Latex", "Cloudfeet", "Bunny"];
const SIZES  = ["36","37","38","39","40","41","42"];

type Manufacturer = { id: string; name: string };
type SampleOption = {
  id: string; orderNumber: string; brand: string; colorName?: string; colorCode?: string;
  supplierSku?: string; h2uSku?: string; productName: string; status: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
  manufacturer: { name: string };
};
type LibraryOption = {
  id: string; libNumber: string; productName: string; brand?: string;
  colorName?: string; colorCode?: string; supplierSku?: string; h2uSku?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
};
type LineItem = {
  sampleOrderId?: string;
  supplierSku: string; h2uSku: string; brand: string; colorName: string; colorCode: string;
  materialUpper: string; materialLining: string; materialMidsole: string;
  materialOutsole: string; hardware: string; logoSpec: string; remark: string; photoUrl: string;
  qty36: number; qty37: number; qty38: number; qty39: number;
  qty40: number; qty41: number; qty42: number;
  totalPairs: number; discountPrice: string; lineTotal: number;
};

function today() { return new Date().toISOString().split("T")[0]; }
function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
const emptyLine = (): LineItem => ({
  supplierSku: "", h2uSku: "", brand: "", colorName: "", colorCode: "",
  materialUpper: "", materialLining: "", materialMidsole: "",
  materialOutsole: "", hardware: "", logoSpec: "", remark: "", photoUrl: "",
  qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0,
  totalPairs: 0, discountPrice: "", lineTotal: 0,
});
function calcLine(item: LineItem): LineItem {
  const totalPairs = SIZES.reduce((s, sz) => s + (Number((item as any)[`qty${sz}`]) || 0), 0);
  return { ...item, totalPairs, lineTotal: totalPairs * (parseFloat(item.discountPrice) || 0) };
}

export default function NewPOPage() {
  const router = useRouter();
  const [mfrs, setMfrs]     = useState<Manufacturer[]>([]);
  const [saving, setSaving] = useState(false);
  const [poPreview, setPoPreview] = useState("APR-01");
  const [items, setItems]   = useState<LineItem[]>([emptyLine()]);
  const [header, setHeader] = useState({
    brand: "Happy2U", manufacturerId: "",
    deliveryDate: "", deliveryMode: "" as ""|"+30"|"+45"|"manual", notes: "",
  });
  const [pickerOpen, setPickerOpen] = useState<null | { mode: "sample"|"library"; idx: number }>(null);
  const [samples, setSamples]   = useState<SampleOption[]>([]);
  const [library, setLibrary]   = useState<LibraryOption[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs);
    const month = new Date().toLocaleString("en", { month: "short" }).toUpperCase();
    fetch("/api/purchase-orders").then(r => r.json()).then((pos: any[]) => {
      const n = Array.isArray(pos) ? pos.filter(p => (p.poNumber ?? "").startsWith(month)).length : 0;
      setPoPreview(`${month}-${String(n + 1).padStart(2, "0")}`);
    }).catch(() => {});
  }, []);

  function setDelivery(mode: "+30"|"+45"|"manual") {
    const date = mode === "+30" ? addDays(30) : mode === "+45" ? addDays(45) : "";
    setHeader(h => ({ ...h, deliveryMode: mode, deliveryDate: date }));
  }

  function openPicker(mode: "sample"|"library", idx: number) {
    setPickerSearch(""); setPickerOpen({ mode, idx });
    if (mode === "sample" && samples.length === 0)
      fetch("/api/samples").then(r => r.json()).then(setSamples);
    if (mode === "library" && library.length === 0)
      fetch("/api/product-library").then(r => r.json()).then(setLibrary);
  }

  function pickSample(s: SampleOption) {
    if (!pickerOpen) return;
    setItems(prev => { const n = [...prev];
      n[pickerOpen.idx] = calcLine({ ...emptyLine(), sampleOrderId: s.id,
        supplierSku: s.supplierSku??'', h2uSku: s.h2uSku??'', brand: s.brand??'',
        colorName: s.colorName??'', colorCode: s.colorCode??'',
        materialUpper: s.materialUpper??'', materialLining: s.materialLining??'',
        materialMidsole: s.materialMidsole??'', materialOutsole: s.materialOutsole??'',
        hardware: s.hardware??'', logoSpec: s.logoSpec??'',
      }); return n; });
    setPickerOpen(null);
  }

  function pickLibrary(p: LibraryOption) {
    if (!pickerOpen) return;
    setItems(prev => { const n = [...prev];
      n[pickerOpen.idx] = calcLine({ ...emptyLine(),
        supplierSku: p.supplierSku??'', h2uSku: p.h2uSku??'', brand: p.brand??'',
        colorName: p.colorName??'', colorCode: p.colorCode??'',
        materialUpper: p.materialUpper??'', materialLining: p.materialLining??'',
        materialMidsole: p.materialMidsole??'', materialOutsole: p.materialOutsole??'',
        hardware: p.hardware??'', logoSpec: p.logoSpec??'',
      }); return n; });
    setPickerOpen(null);
  }

  function setItemField(idx: number, field: string, value: string | number) {
    setItems(prev => { const n = [...prev]; n[idx] = calcLine({...n[idx],[field]:value} as LineItem); return n; });
  }

  const totalPairs = items.reduce((s, i) => s + i.totalPairs, 0);
  const totalPrice = items.reduce((s, i) => s + i.lineTotal, 0);

  async function save() {
    if (!header.manufacturerId) { alert("Please select a Manufacturer."); return; }
    setSaving(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: header.brand, manufacturerId: header.manufacturerId,
        date: today(), deliveryDate: header.deliveryDate || null, notes: header.notes || null,
        totalPairs, totalPrice,
        items: items.map(i => ({
          sampleOrderId: i.sampleOrderId || null,
          supplierSku: i.supplierSku||null, h2uSku: i.h2uSku||null,
          brand: i.brand||null, colorName: i.colorName||null, colorCode: i.colorCode||null,
          materialUpper: i.materialUpper||null, materialLining: i.materialLining||null,
          materialMidsole: i.materialMidsole||null, materialOutsole: i.materialOutsole||null,
          hardware: i.hardware||null, logoSpec: i.logoSpec||null,
          remark: i.remark||null, photoUrl: i.photoUrl||null,
          qty36:i.qty36, qty37:i.qty37, qty38:i.qty38, qty39:i.qty39,
          qty40:i.qty40, qty41:i.qty41, qty42:i.qty42,
          totalPairs:i.totalPairs, discountPrice:parseFloat(i.discountPrice)||null, lineTotal:i.lineTotal,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); router.push(`/dashboard/purchase-orders/${d.id}`); }
    else { let m=`HTTP ${res.status}`; try{const j=await res.json();m=j.error||m;}catch{} alert(`Failed: ${m}`); }
  }

  const q = pickerSearch.toLowerCase();
  const DONE = ["ready","used","delivered","received","approved"];
  const filteredSamples = samples.filter(s =>
    DONE.includes(s.status) &&
    (!q || s.orderNumber.toLowerCase().includes(q) || (s.colorName??'').toLowerCase().includes(q) ||
      s.productName.toLowerCase().includes(q) || s.manufacturer?.name.toLowerCase().includes(q))
  );
  const filteredLibrary = library.filter(p =>
    !q || p.productName.toLowerCase().includes(q) ||
    (p.supplierSku??'').toLowerCase().includes(q) || (p.colorName??'').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-sm text-gray-500">PO Number: <span className="font-mono font-semibold text-brand-600">{poPreview}</span> <span className="text-xs text-gray-400">(auto-assigned on save)</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary" disabled={saving}>{saving?"Saving…":"Create PO"}</button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">PO Details</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Brand</label>
            <select className="input" value={header.brand} onChange={e => setHeader(h=>({...h,brand:e.target.value}))}>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Manufacturer *</label>
            <select className="input" value={header.manufacturerId} onChange={e => setHeader(h=>({...h,manufacturerId:e.target.value}))}>
              <option value="">Select manufacturer…</option>
              {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <div className="input bg-gray-50 text-gray-600">
              {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
            </div>
          </div>
          <div className="col-span-2">
            <label className="label">Delivery Date</label>
            <div className="flex gap-2 items-center flex-wrap">
              {(["+30","+45"] as const).map(o => (
                <button key={o} type="button" onClick={() => setDelivery(o)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    header.deliveryMode===o ? "bg-brand-700 text-white border-brand-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {o} days
                </button>
              ))}
              <button type="button" onClick={() => setDelivery("manual")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  header.deliveryMode==="manual" ? "bg-brand-700 text-white border-brand-700"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                Set manually
              </button>
              {(header.deliveryMode==="manual" || header.deliveryDate) && (
                <input className="input w-44" type="date" value={header.deliveryDate}
                  onChange={e => setHeader(h=>({...h,deliveryDate:e.target.value,deliveryMode:"manual"}))} />
              )}
              {header.deliveryDate && (
                <span className="text-sm text-gray-500">→ {new Date(header.deliveryDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</span>
              )}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={header.notes} onChange={e => setHeader(h=>({...h,notes:e.target.value}))} placeholder="Additional instructions…" />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
          <button onClick={() => setItems(i=>[...i,emptyLine()])} className="btn-secondary flex items-center gap-2 text-xs">
            <Plus size={13} /> Add Row
          </button>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[1600px]">
            <thead className="bg-brand-700 text-white">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Source</th>
                <th className="px-2 py-2 text-left">Supplier SKU</th>
                <th className="px-2 py-2 text-left">Brand</th>
                <th className="px-2 py-2 text-left">H2U SKU</th>
                <th className="px-2 py-2 text-left">Color</th>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">Upper</th>
                <th className="px-2 py-2 text-left">Lining</th>
                <th className="px-2 py-2 text-left">Midsole</th>
                <th className="px-2 py-2 text-left">Outsole</th>
                <th className="px-2 py-2 text-left">Hardware</th>
                <th className="px-2 py-2 text-left">Logo/Remark</th>
                {SIZES.map(s=><th key={s} className="px-1 py-2 text-center">{s}</th>)}
                <th className="px-2 py-2 text-center">Pairs</th>
                <th className="px-2 py-2 text-right">Price ¥</th>
                <th className="px-2 py-2 text-right">Total ¥</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={`border-b border-gray-100 ${idx%2===1?"bg-gray-50":"bg-white"}`}>
                  <td className="px-2 py-1 text-gray-400">{idx+1}</td>
                  <td className="px-1 py-1">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => openPicker("sample",idx)} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800">
                        <PackageSearch size={10}/> Sample
                      </button>
                      <button onClick={() => openPicker("library",idx)} className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-800">
                        <BookOpen size={10}/> Library
                      </button>
                      {item.sampleOrderId && <span className="text-[9px] text-blue-400">SR linked</span>}
                    </div>
                  </td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.supplierSku} onChange={e=>setItemField(idx,"supplierSku",e.target.value)}/></td>
                  <td className="px-1 py-1">
                    <select className="input text-xs w-24" value={item.brand} onChange={e=>setItemField(idx,"brand",e.target.value)}>
                      <option value="">—</option>
                      {BRANDS.map(b=><option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.h2uSku} onChange={e=>setItemField(idx,"h2uSku",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.colorName} onChange={e=>setItemField(idx,"colorName",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-12" value={item.colorCode} onChange={e=>setItemField(idx,"colorCode",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.materialUpper} onChange={e=>setItemField(idx,"materialUpper",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.materialLining} onChange={e=>setItemField(idx,"materialLining",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.materialMidsole} onChange={e=>setItemField(idx,"materialMidsole",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.materialOutsole} onChange={e=>setItemField(idx,"materialOutsole",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-20" value={item.hardware} onChange={e=>setItemField(idx,"hardware",e.target.value)}/></td>
                  <td className="px-1 py-1"><input className="input text-xs w-24" value={item.logoSpec} onChange={e=>setItemField(idx,"logoSpec",e.target.value)}/></td>
                  {SIZES.map(s=>(
                    <td key={s} className="px-1 py-1">
                      <input type="number" min="0" className="input text-xs w-10 text-center"
                        value={(item as any)[`qty${s}`]||""}
                        onChange={e=>setItemField(idx,`qty${s}`,parseInt(e.target.value)||0)}/>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-semibold text-brand-700">{item.totalPairs||"—"}</td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.01" className="input text-xs w-16 text-right"
                      value={item.discountPrice} onChange={e=>setItemField(idx,"discountPrice",e.target.value)}/>
                  </td>
                  <td className="px-2 py-1 text-right font-semibold text-brand-700">
                    {item.lineTotal>0?`¥${item.lineTotal.toFixed(0)}`:"—"}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={()=>setItems(i=>i.filter((_,j)=>j!==idx))} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-brand-200 bg-brand-50">
              <tr>
                <td colSpan={16} className="px-4 py-2 text-right font-semibold text-gray-700">TOTAL</td>
                <td className="px-2 py-2 text-center font-bold text-brand-700">{totalPairs} pairs</td>
                <td className="px-2 py-2 text-right font-bold text-brand-700">¥{totalPrice.toFixed(0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={()=>router.back()} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary px-8" disabled={saving}>{saving?"Saving…":"Create Purchase Order"}</button>
      </div>

      {/* Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                {pickerOpen.mode==="sample"
                  ? <><PackageSearch size={16} className="text-blue-600"/> Pick from Sample Orders</>
                  : <><BookOpen size={16} className="text-green-600"/> Pick from Product Library</>}
              </h2>
              <button onClick={()=>setPickerOpen(null)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="px-6 py-3 border-b">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-8 text-sm w-full" placeholder="Search…"
                  value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} autoFocus/>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {pickerOpen.mode==="sample" ? (
                filteredSamples.length===0
                  ? <p className="text-center text-gray-400 py-12">No ready/delivered sample orders found.</p>
                  : <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>{["Ref No.","Product","Brand","Color","Supplier SKU","Manufacturer"].map(h=>
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredSamples.map(s=>(
                          <tr key={s.id} onClick={()=>pickSample(s)} className="hover:bg-blue-50 cursor-pointer">
                            <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-700">{s.orderNumber}</td>
                            <td className="px-4 py-2.5 text-gray-900">{s.productName}</td>
                            <td className="px-4 py-2.5 text-gray-600">{s.brand}</td>
                            <td className="px-4 py-2.5 text-gray-600">{s.colorName||"—"}</td>
                            <td className="px-4 py-2.5 text-gray-500">{s.supplierSku||"—"}</td>
                            <td className="px-4 py-2.5 text-gray-500">{s.manufacturer?.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              ) : (
                filteredLibrary.length===0
                  ? <p className="text-center text-gray-400 py-12">No products in library yet.</p>
                  : <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>{["Lib No.","Product Name","Brand","Color","Supplier SKU"].map(h=>
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredLibrary.map(p=>(
                          <tr key={p.id} onClick={()=>pickLibrary(p)} className="hover:bg-green-50 cursor-pointer">
                            <td className="px-4 py-2.5 font-mono text-xs font-semibold text-green-700">{p.libNumber}</td>
                            <td className="px-4 py-2.5 text-gray-900">{p.productName}</td>
                            <td className="px-4 py-2.5 text-gray-600">{p.brand||"—"}</td>
                            <td className="px-4 py-2.5 text-gray-600">{p.colorName||"—"}</td>
                            <td className="px-4 py-2.5 text-gray-500">{p.supplierSku||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
            </div>
            <div className="px-6 py-3 border-t text-xs text-gray-400 text-right">
              Click a row to fill line item #{(pickerOpen.idx)+1}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
