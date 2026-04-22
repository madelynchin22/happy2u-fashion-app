"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Search, Upload, X, BookOpen, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

type PLItem = {
  id: string; libNumber: string; productName: string; h2uSku?: string; supplierSku?: string;
  brand?: string; category?: string; colorName?: string; colorCode?: string; season?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string; heelSpec?: string; platformSpec?: string;
  costRmb?: number; costRm?: number; sellingPrice?: number;
  imageUrls?: string; notes?: string; sampleOrderId?: string;
  manufacturer?: { id: string; name: string };
  createdAt: string;
};

type Mfr = { id: string; name: string };

const CATS = ["", "heels", "flats", "sandals", "boots", "bags", "accessories", "shoe_care", "keychain", "merchandiser"];

const BLANK_FORM = {
  productName: "", h2uSku: "", supplierSku: "", brand: "Happy2U", category: "heels",
  colorName: "", colorCode: "", season: "", manufacturerId: "",
  materialUpper: "", materialLining: "", materialMidsole: "", materialOutsole: "",
  hardware: "", logoSpec: "", heelSpec: "", platformSpec: "",
  costRmb: "", costRm: "", sellingPrice: "", notes: "",
};

export default function ProductLibraryPage() {
  const [items, setItems]       = useState<PLItem[]>([]);
  const [mfrs, setMfrs]         = useState<Mfr[]>([]);
  const [search, setSearch]     = useState("");
  const [cat, setCat]           = useState("");
  const [modal, setModal]       = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ ...BLANK_FORM });
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [search, cat]);

  async function load() {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (cat)    p.set("category", cat);
    const r = await fetch(`/api/product-library?${p}`);
    if (r.ok) setItems(await r.json());
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...BLANK_FORM });
    setModal(true);
  }

  function openEdit(item: PLItem) {
    setEditId(item.id);
    setForm({
      productName: item.productName, h2uSku: item.h2uSku ?? "", supplierSku: item.supplierSku ?? "",
      brand: item.brand ?? "Happy2U", category: item.category ?? "heels",
      colorName: item.colorName ?? "", colorCode: item.colorCode ?? "", season: item.season ?? "",
      manufacturerId: (item.manufacturer?.id ?? "") as any,
      materialUpper: item.materialUpper ?? "", materialLining: item.materialLining ?? "",
      materialMidsole: item.materialMidsole ?? "", materialOutsole: item.materialOutsole ?? "",
      hardware: item.hardware ?? "", logoSpec: item.logoSpec ?? "",
      heelSpec: item.heelSpec ?? "", platformSpec: item.platformSpec ?? "",
      costRmb: item.costRmb ? String(item.costRmb) : "",
      costRm: item.costRm ? String(item.costRm) : "",
      sellingPrice: item.sellingPrice ? String(item.sellingPrice) : "",
      notes: item.notes ?? "",
    });
    setModal(true);
  }

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.productName) { alert("Product name is required"); return; }
    setSaving(true);
    const payload = {
      productName: form.productName, h2uSku: form.h2uSku || null, supplierSku: form.supplierSku || null,
      brand: form.brand || null, category: form.category || null,
      colorName: form.colorName || null, colorCode: form.colorCode || null, season: form.season || null,
      manufacturerId: (form as any).manufacturerId || null,
      materialUpper: form.materialUpper || null, materialLining: form.materialLining || null,
      materialMidsole: form.materialMidsole || null, materialOutsole: form.materialOutsole || null,
      hardware: form.hardware || null, logoSpec: form.logoSpec || null,
      heelSpec: form.heelSpec || null, platformSpec: form.platformSpec || null,
      costRmb: form.costRmb ? parseFloat(form.costRmb) : null,
      costRm: form.costRm ? parseFloat(form.costRm) : null,
      sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : null,
      notes: form.notes || null,
    };
    if (editId) {
      await fetch(`/api/product-library/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/product-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    setModal(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this product from library?")) return;
    await fetch(`/api/product-library/${id}`, { method: "DELETE" });
    load();
  }

  async function importExcel(file: File) {
    setImporting(true);
    // Dynamically import xlsx
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    const res = await fetch("/api/product-library/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows),
    });
    const d = await res.json();
    setImporting(false);
    if (res.ok) { alert(`Imported ${d.imported} products`); load(); }
    else alert("Import failed");
  }

  const filtered = items; // server-side filtering already applied

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-brand-500" /> Product Library
          </h1>
          <p className="text-gray-500 text-sm">{items.length} products · tracks cost, selling price, and material specs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => xlsxRef.current?.click()} disabled={importing}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} /> {importing ? "Importing…" : "Import Excel"}
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }} />
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-56" placeholder="Search name, SKU…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40 text-sm" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {CATS.filter(Boolean).map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {/* Import template hint */}
      <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
        <strong>Excel import columns:</strong> productName, h2uSku, supplierSku, brand, category, colorName, colorCode, season, materialUpper, materialLining, materialMidsole, materialOutsole, hardware, logoSpec, heelSpec, platformSpec, costRmb, costRm, sellingPrice, notes
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ref</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">SKUs</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Color</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Cost (RM)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Selling</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(item => (
              <>
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.libNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.category} · {item.season ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {item.h2uSku && <p className="text-brand-700 font-medium">H2U: {item.h2uSku}</p>}
                    {item.supplierSku && <p className="text-gray-500">Sup: {item.supplierSku}</p>}
                    {!item.h2uSku && !item.supplierSku && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{item.colorName ?? "—"}{item.colorCode ? ` (${item.colorCode})` : ""}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {item.costRm ? `RM ${item.costRm.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-brand-700">
                    {item.sellingPrice ? `RM ${item.sellingPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                        {expanded === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => del(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === item.id && (
                  <tr key={`${item.id}-exp`} className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-xs">
                        {[
                          ["Upper", item.materialUpper], ["Lining", item.materialLining],
                          ["Midsole", item.materialMidsole], ["Outsole", item.materialOutsole],
                          ["Hardware", item.hardware], ["Heel", item.heelSpec],
                          ["Platform", item.platformSpec], ["Logo", item.logoSpec],
                        ].map(([k, v]) => v ? (
                          <div key={k as string}><span className="text-gray-400">{k}: </span><span className="text-gray-700">{v}</span></div>
                        ) : null)}
                        {item.notes && <div className="col-span-4 text-gray-500 italic">{item.notes}</div>}
                        {item.sampleOrderId && <div className="col-span-4 text-brand-600">Source: Sample Order</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-600">No products in library yet</p>
                <p className="text-sm mt-1">Add products manually or import from Excel.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? "Edit Product" : "Add Product to Library"}</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Product Name *</label>
                  <input className="input" value={form.productName} onChange={e => setF("productName", e.target.value)} placeholder="e.g. Block Heel Mary Jane" />
                </div>
                <div>
                  <label className="label">H2U SKU</label>
                  <input className="input" value={form.h2uSku} onChange={e => setF("h2uSku", e.target.value)} placeholder="S1764C" />
                </div>
                <div>
                  <label className="label">Supplier SKU</label>
                  <input className="input" value={form.supplierSku} onChange={e => setF("supplierSku", e.target.value)} placeholder="S1764" />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <input className="input" value={form.brand} onChange={e => setF("brand", e.target.value)} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setF("category", e.target.value)}>
                    {CATS.filter(Boolean).map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Color Name</label>
                  <input className="input" value={form.colorName} onChange={e => setF("colorName", e.target.value)} placeholder="BEIGE" />
                </div>
                <div>
                  <label className="label">Color Code</label>
                  <input className="input" value={form.colorCode} onChange={e => setF("colorCode", e.target.value)} placeholder="262" />
                </div>
                <div>
                  <label className="label">Season</label>
                  <input className="input" value={form.season} onChange={e => setF("season", e.target.value)} placeholder="SS2026" />
                </div>
                <div>
                  <label className="label">Manufacturer</label>
                  <select className="input" value={(form as any).manufacturerId ?? ""} onChange={e => setF("manufacturerId", e.target.value)}>
                    <option value="">None</option>
                    {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Material Specifications</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["materialUpper", "Upper (鞋面)"], ["materialLining", "Lining (内里)"],
                    ["materialMidsole", "Midsole (中底)"], ["materialOutsole", "Outsole (大底)"],
                    ["hardware", "Hardware (五金)"], ["heelSpec", "Heel (鞋跟)"],
                    ["platformSpec", "Platform (台面)"], ["logoSpec", "Logo"],
                  ].map(([k, l]) => (
                    <div key={k}>
                      <label className="label text-xs">{l}</label>
                      <input className="input text-sm" value={(form as any)[k]} onChange={e => setF(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cost & Pricing</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label text-xs">Cost (RMB ¥)</label>
                    <input className="input text-sm" type="number" step="0.01" value={form.costRmb} onChange={e => setF("costRmb", e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Cost (RM)</label>
                    <input className="input text-sm" type="number" step="0.01" value={form.costRm} onChange={e => setF("costRm", e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Selling Price (RM)</label>
                    <input className="input text-sm" type="number" step="0.01" value={form.sellingPrice} onChange={e => setF("sellingPrice", e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? "Saving…" : editId ? "Save Changes" : "Add to Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
