"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Search, X, Upload, Layers } from "lucide-react";

type Material = {
  id: string; name: string; materialType: string;
  colorCode?: string; colorName?: string; supplier?: string;
  photoUrl?: string; swatchUrl?: string; notes?: string;
  createdAt: string;
};

const TYPES = ["upper","lining","midsole","outsole","hardware","insole","heel","platform","sole"];
const TYPE_LABELS: Record<string, string> = {
  upper: "Upper (鞋面)", lining: "Lining (内里)", midsole: "Midsole (中底)",
  outsole: "Outsole (大底)", hardware: "Hardware (五金)", insole: "Insole (鞋垫)",
  heel: "Heel (鞋跟)", platform: "Platform (台面)", sole: "Sole",
};
const TYPE_COLORS: Record<string, string> = {
  upper: "bg-blue-100 text-blue-700", lining: "bg-purple-100 text-purple-700",
  midsole: "bg-amber-100 text-amber-700", outsole: "bg-gray-100 text-gray-700",
  hardware: "bg-zinc-100 text-zinc-700", insole: "bg-green-100 text-green-700",
  heel: "bg-pink-100 text-pink-700", platform: "bg-orange-100 text-orange-700",
  sole: "bg-stone-100 text-stone-700",
};

const EMPTY = { name: "", materialType: "upper", colorCode: "", colorName: "", supplier: "", photoUrl: "", swatchUrl: "", notes: "" };

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  return d.url ?? "";
}

function PhotoBtn({ url, onChange, label }: { url: string; onChange: (u: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
          <button onClick={() => onChange("")} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center">
            <X size={8} />
          </button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-brand-400 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-brand-500 transition-colors text-[9px]">
          {loading ? "…" : <><Upload size={12} />{label}</>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        setLoading(true); onChange(await uploadFile(f)); setLoading(false); e.target.value = "";
      }} />
    </div>
  );
}

export default function MaterialsPage() {
  const [items, setItems]       = useState<Material[]>([]);
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState("all");
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Material | null>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);

  function load() {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (typeFilter !== "all") p.set("type", typeFilter);
    fetch(`/api/materials?${p}`).then(r => r.json()).then(setItems).catch(() => setItems([]));
  }

  useEffect(() => { load(); }, [search, typeFilter]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setModal(true); }
  function openEdit(m: Material) {
    setEditing(m);
    setForm({ name: m.name, materialType: m.materialType, colorCode: m.colorCode ?? "", colorName: m.colorName ?? "",
      supplier: m.supplier ?? "", photoUrl: m.photoUrl ?? "", swatchUrl: m.swatchUrl ?? "", notes: m.notes ?? "" });
    setModal(true);
  }

  async function save() {
    if (!form.name) { alert("Name is required."); return; }
    setSaving(true);
    if (editing) {
      const r = await fetch(`/api/materials/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { const d = await r.json(); setItems(prev => prev.map(x => x.id === editing.id ? d : x)); }
    } else {
      const r = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) { const d = await r.json(); setItems(prev => [d, ...prev]); }
    }
    setSaving(false); setModal(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this material?")) return;
    await fetch(`/api/materials/${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(x => x.id !== id));
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = items.filter(i => i.materialType === t);
    return acc;
  }, {} as Record<string, Material[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materials Library</h1>
          <p className="text-gray-500 text-sm">{items.length} material{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Material
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setType("all")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === "all" ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>All</button>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${typeFilter === t ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-3 text-center">
          <Layers size={40} className="text-gray-200" />
          <p className="text-gray-500 font-medium">No materials yet</p>
          <p className="text-gray-400 text-sm">Add materials to build your library for use in sample orders.</p>
          <button onClick={openAdd} className="btn-primary mt-2"><Plus size={14} className="mr-1" />Add Material</button>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPES.filter(t => typeFilter === "all" ? grouped[t]?.length > 0 : t === typeFilter).map(t => (
            grouped[t]?.length > 0 && (
              <div key={t}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{TYPE_LABELS[t]}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {grouped[t].map(m => (
                    <div key={m.id} className="card p-4 flex gap-3 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openEdit(m)}>
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-100" />
                      ) : m.swatchUrl ? (
                        <img src={m.swatchUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Layers size={20} className="text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{m.name}</p>
                        {m.colorName && <p className="text-xs text-gray-500 truncate">{m.colorName}{m.colorCode ? ` · ${m.colorCode}` : ""}</p>}
                        {m.supplier && <p className="text-xs text-gray-400 truncate">{m.supplier}</p>}
                        <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[m.materialType] ?? "bg-gray-100 text-gray-600"}`}>
                          {m.materialType}
                        </span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); del(m.id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all self-start">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Material" : "Add Material"}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Name *</label>
                  <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Crinkle Patent PU" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.materialType} onChange={e => set("materialType", e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Supplier</label>
                  <input className="input" value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Supplier name" />
                </div>
                <div>
                  <label className="label">Color Name</label>
                  <input className="input" value={form.colorName} onChange={e => set("colorName", e.target.value)} placeholder="Nude Beige" />
                </div>
                <div>
                  <label className="label">Color Code</label>
                  <input className="input" value={form.colorCode} onChange={e => set("colorCode", e.target.value)} placeholder="262" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs">Material Photo</label>
                  <PhotoBtn url={form.photoUrl} onChange={u => set("photoUrl", u)} label="Photo" />
                </div>
                <div>
                  <label className="label text-xs">Swatch</label>
                  <PhotoBtn url={form.swatchUrl} onChange={u => set("swatchUrl", u)} label="Swatch" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : editing ? "Save Changes" : "Add Material"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
