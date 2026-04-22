"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Phone, Mail, MessageCircle } from "lucide-react";

type Manufacturer = {
  id: string; name: string; nameEn?: string; contactName?: string;
  contactPhone?: string; contactWechat?: string; contactEmail?: string;
  country: string; moq?: number; leadTimeDays?: number;
  paymentTerms?: string; materials?: string; notes?: string;
};

const empty: Omit<Manufacturer, "id"> = {
  name: "", nameEn: "", contactName: "", contactPhone: "", contactWechat: "",
  contactEmail: "", country: "CN", moq: undefined, leadTimeDays: undefined,
  paymentTerms: "", materials: "", notes: "",
};

export default function ManufacturersPage() {
  const [list, setList]       = useState<Manufacturer[]>([]);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [form, setForm]       = useState<Omit<Manufacturer, "id">>(empty);
  const [saving, setSaving]   = useState(false);

  async function load() {
    const res = await fetch("/api/manufacturers");
    setList(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openNew()  { setEditing(null); setForm(empty); setModal(true); }
  function openEdit(m: Manufacturer) {
    setEditing(m);
    const { id, ...rest } = m;
    setForm(rest);
    setModal(true);
  }

  async function save() {
    setSaving(true);
    if (editing) {
      await fetch(`/api/manufacturers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/manufacturers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setSaving(false);
    setModal(false);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this manufacturer?")) return;
    await fetch(`/api/manufacturers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manufacturers</h1>
          <p className="text-gray-500 text-sm">{list.length} active suppliers</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Manufacturer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map(m => (
          <div key={m.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{m.name}</h3>
                {m.nameEn && <p className="text-xs text-gray-400">{m.nameEn}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-brand-600">
                  <Pencil size={14} />
                </button>
                <button onClick={() => del(m.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-sm text-gray-600">
              {m.contactName  && <p className="font-medium text-gray-800">{m.contactName}</p>}
              {m.contactPhone && <div className="flex items-center gap-1.5"><Phone size={12} />{m.contactPhone}</div>}
              {m.contactWechat && <div className="flex items-center gap-1.5"><MessageCircle size={12} />WeChat: {m.contactWechat}</div>}
              {m.contactEmail && <div className="flex items-center gap-1.5"><Mail size={12} />{m.contactEmail}</div>}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
              {m.moq && <span>MOQ: {m.moq} pcs</span>}
              {m.leadTimeDays && <span>Lead: {m.leadTimeDays}d</span>}
              {m.paymentTerms && <span>{m.paymentTerms}</span>}
            </div>

            {m.materials && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.materials.split(",").map(mat => (
                  <span key={mat} className="bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full">{mat.trim()}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <p>No manufacturers yet. Add your first supplier.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit" : "New"} Manufacturer</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Chinese Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="佳鑫锋" />
                </div>
                <div>
                  <label className="label">English Name</label>
                  <input className="input" value={form.nameEn ?? ""} onChange={e => setForm(f => ({...f, nameEn: e.target.value}))} placeholder="Jia Xin Feng" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact Person</label>
                  <input className="input" value={form.contactName ?? ""} onChange={e => setForm(f => ({...f, contactName: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Phone / WhatsApp</label>
                  <input className="input" value={form.contactPhone ?? ""} onChange={e => setForm(f => ({...f, contactPhone: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">WeChat ID</label>
                  <input className="input" value={form.contactWechat ?? ""} onChange={e => setForm(f => ({...f, contactWechat: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.contactEmail ?? ""} onChange={e => setForm(f => ({...f, contactEmail: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">MOQ (pairs)</label>
                  <input className="input" type="number" value={form.moq ?? ""} onChange={e => setForm(f => ({...f, moq: parseInt(e.target.value) || undefined}))} />
                </div>
                <div>
                  <label className="label">Lead Time (days)</label>
                  <input className="input" type="number" value={form.leadTimeDays ?? ""} onChange={e => setForm(f => ({...f, leadTimeDays: parseInt(e.target.value) || undefined}))} />
                </div>
                <div>
                  <label className="label">Payment Terms</label>
                  <input className="input" value={form.paymentTerms ?? ""} onChange={e => setForm(f => ({...f, paymentTerms: e.target.value}))} placeholder="30% deposit" />
                </div>
              </div>
              <div>
                <label className="label">Materials (comma-separated)</label>
                <input className="input" value={form.materials ?? ""} onChange={e => setForm(f => ({...f, materials: e.target.value}))} placeholder="PU, genuine leather, suede, synthetic" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={form.notes ?? ""} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving || !form.name}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
