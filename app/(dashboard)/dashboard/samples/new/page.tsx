"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Image as ImageIcon } from "lucide-react";

type Manufacturer = { id: string; name: string };

const BRANDS = ["Happy2U", "Blissfit", "Latex", "Cloudfeet", "Bunny"];

// Brand → logo file mapping (place files in /public/logos/)
const BRAND_LOGOS: Record<string, string> = {
  "Happy2U":  "/logos/happy2u.png",
  "Blissfit": "/logos/blissfit.png",
  "Latex":    "/logos/latex.png",
  "Cloudfeet":"/logos/cloudfeet.png",
  "Bunny":    "/logos/bunny.png",
};

function today() { return new Date().toISOString().split("T")[0]; }
function plusDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

const MATERIALS_ROWS = [
  { key: "materialUpper",   label: "Upper (鞋面)" },
  { key: "materialLining",  label: "Lining (内里)" },
  { key: "materialMidsole", label: "Midsole (中底)" },
  { key: "materialOutsole", label: "Outsole (大底)" },
  { key: "hardware",        label: "Hardware (五金)" },
  { key: "heelSpec",        label: "Heel (鞋跟)" },
  { key: "platformSpec",    label: "Platform (台面)" },
  { key: "logoSpec",        label: "Logo" },
] as const;

const VIEWS = [
  { photoKey: "photoSideUrl",     notesKey: "notesA", label: "A — Side View" },
  { photoKey: "photoBackUrl",     notesKey: "notesB", label: "B — Back View" },
  { photoKey: "photoFrontUrl",    notesKey: "notesC", label: "C — Front / ¾ View" },
  { photoKey: "photoPlatformUrl", notesKey: "notesD", label: "D — Platform" },
  { photoKey: "photoHeelUrl",     notesKey: "notesE", label: "E — Heel" },
];

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  return d.url ?? "";
}

function PhotoUpload({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const u = await uploadFile(file);
    onChange(u);
    setUploading(false);
  }

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
          <button onClick={() => onChange("")}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center text-[10px]">
            <X size={8} />
          </button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 hover:border-brand-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-brand-500 transition-colors">
          {uploading ? <span className="text-[9px]">…</span> : <><Upload size={14} /><span className="text-[9px]">Photo</span></>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

export default function NewSamplePage() {
  const router = useRouter();
  const [mfrs, setMfrs]     = useState<Manufacturer[]>([]);
  const [saving, setSaving] = useState(false);
  const [refPreview, setRefPreview] = useState("SR-XXXX-XXX");

  const [form, setForm] = useState({
    brand: "Happy2U",
    sampleSize: "37", lastModel: "", dateSent: today(), deadline: plusDays(14),
    manufacturerId: "", colorName: "", colorCode: "",
    materialUpper: "", materialUpper_remark: "", materialUpper_photo: "",
    materialLining: "", materialLining_remark: "", materialLining_photo: "",
    materialMidsole: "", materialMidsole_remark: "", materialMidsole_photo: "",
    materialOutsole: "", materialOutsole_remark: "", materialOutsole_photo: "",
    hardware: "", hardware_remark: "", hardware_photo: "",
    heelSpec: "", heelSpec_remark: "", heelSpec_photo: "",
    platformSpec: "", platformSpec_remark: "", platformSpec_photo: "",
    logoSpec: "", logoSpec_remark: "", logoSpec_photo: "",
    photoSideUrl: "", photoBackUrl: "", photoFrontUrl: "",
    photoPlatformUrl: "", photoHeelUrl: "",
    notesA: "", notesB: "", notesC: "", notesD: "", notesE: "",
    generalNotes: "", amendmentNotes: "", designSource: "in-house", ipNotes: "",
  });

  useEffect(() => {
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs);
    // Preview reference number
    const year = new Date().getFullYear();
    fetch("/api/samples").then(r => r.json()).then(d => {
      const n = (Array.isArray(d) ? d.length : 0) + 1;
      setRefPreview(`SR-${year}-${String(n).padStart(3, "0")}`);
    }).catch(() => {});
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.manufacturerId) {
      alert("Please select a Manufacturer.");
      return;
    }
    setSaving(true);
    const payload = {
      productName: [form.brand, form.colorName].filter(Boolean).join(" ") || "Sample",
      brand: form.brand, season: "",
      sampleSize: form.sampleSize, lastModel: form.lastModel,
      dateSent: form.dateSent || null, deadline: form.deadline || null,
      manufacturerId: form.manufacturerId,
      colorName: form.colorName, colorCode: form.colorCode,
      materialUpper: form.materialUpper,
      materialUpperRemark: form.materialUpper_remark,
      materialUpperPhoto: form.materialUpper_photo,
      materialLining: form.materialLining,
      materialLiningRemark: form.materialLining_remark,
      materialLiningPhoto: form.materialLining_photo,
      materialMidsole: form.materialMidsole,
      materialMidsoleRemark: form.materialMidsole_remark,
      materialMidsolePhoto: form.materialMidsole_photo,
      materialOutsole: form.materialOutsole,
      materialOutsoleRemark: form.materialOutsole_remark,
      materialOutsolePhoto: form.materialOutsole_photo,
      hardware: form.hardware,
      hardwareRemark: form.hardware_remark,
      hardwarePhoto: form.hardware_photo,
      heelSpec: form.heelSpec,
      heelSpecRemark: form.heelSpec_remark,
      heelSpecPhoto: form.heelSpec_photo,
      platformSpec: form.platformSpec,
      platformSpecRemark: form.platformSpec_remark,
      platformSpecPhoto: form.platformSpec_photo,
      logoSpec: form.logoSpec,
      logoSpecRemark: form.logoSpec_remark,
      logoSpecPhoto: form.logoSpec_photo,
      photoSideUrl: form.photoSideUrl, photoBackUrl: form.photoBackUrl,
      photoFrontUrl: form.photoFrontUrl, photoPlatformUrl: form.photoPlatformUrl,
      photoHeelUrl: form.photoHeelUrl,
      notesA: form.notesA, notesB: form.notesB, notesC: form.notesC,
      notesD: form.notesD, notesE: form.notesE,
      generalNotes: form.generalNotes, amendmentNotes: form.amendmentNotes,
      designSource: form.designSource, ipNotes: form.ipNotes,
    };
    const res = await fetch("/api/samples", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/samples/${data.id}`);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Sample Order</h1>
          <p className="text-gray-500 text-sm">
            Reference: <span className="font-mono text-brand-600 font-semibold">{refPreview}</span>
            <span className="ml-2 text-xs text-gray-400">(auto-assigned on save)</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Create Sample Order"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Product Information ─────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Product Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Brand</label>
            <div className="flex items-center gap-3">
              <select className="input" value={form.brand} onChange={e => set("brand", e.target.value)}>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {BRAND_LOGOS[form.brand] && (
                <img src={BRAND_LOGOS[form.brand]} alt={form.brand}
                  className="h-8 object-contain flex-shrink-0 opacity-80" />
              )}
            </div>
          </div>
          <div>
            <label className="label">Manufacturer *</label>
            <select className="input" value={form.manufacturerId} onChange={e => set("manufacturerId", e.target.value)}>
              <option value="">Select manufacturer…</option>
              {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sample Size</label>
            <select className="input" value={form.sampleSize} onChange={e => set("sampleSize", e.target.value)}>
              {["35","36","37","38","39","40","41","42"].map(s => <option key={s} value={s}>EU {s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Last Model</label>
            <input className="input" value={form.lastModel} onChange={e => set("lastModel", e.target.value)} placeholder="SR-2026-001" />
          </div>
          <div>
            <label className="label">Date Sent</label>
            <input className="input" type="date" value={form.dateSent} onChange={e => set("dateSent", e.target.value)} />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input className="input" type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} />
          </div>
          <div>
            <label className="label">Color Name</label>
            <input className="input" value={form.colorName} onChange={e => set("colorName", e.target.value)} placeholder="BEIGE" />
          </div>
          <div>
            <label className="label">Color Code (色号)</label>
            <input className="input" value={form.colorCode} onChange={e => set("colorCode", e.target.value)} placeholder="262" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          💡 Supplier SKU and H2U SKU will be filled in after sample is received and when Purchase Order is placed.
        </p>
      </div>

      {/* ── Section 2: Material Specifications ───────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Material Specifications</h2>
        <p className="text-xs text-gray-400 mb-4">Specify material for each component. Add a remark or attach a reference photo per row.</p>
        <div className="space-y-4">
          {MATERIALS_ROWS.map(row => (
            <div key={row.key} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <label className="text-sm font-semibold text-gray-700">{row.label}</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input text-sm"
                  placeholder={`${row.label.split(" ")[0]} material…`}
                  value={(form as any)[row.key]}
                  onChange={e => set(row.key, e.target.value)}
                />
                <input
                  className="input text-sm"
                  placeholder="Remark / instruction…"
                  value={(form as any)[`${row.key}_remark`]}
                  onChange={e => set(`${row.key}_remark`, e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon size={12} className="text-gray-400" />
                <span className="text-xs text-gray-400">Reference photo:</span>
                <PhotoUpload
                  url={(form as any)[`${row.key}_photo`]}
                  onChange={url => set(`${row.key}_photo`, url)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Product Views & Notes ──────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Product Views & Notes</h2>
        <p className="text-xs text-gray-400 mb-4">Upload product reference photos per view. Add notes for the manufacturer for each angle.</p>
        <div className="space-y-4">
          {VIEWS.map(v => (
            <div key={v.photoKey} className="flex items-start gap-4">
              <div className="w-24 pt-1">
                <span className="text-sm font-medium text-gray-700">{v.label}</span>
              </div>
              <PhotoUpload
                url={(form as any)[v.photoKey]}
                onChange={url => set(v.photoKey, url)}
              />
              <input
                className="input flex-1 text-sm"
                placeholder={`Notes for ${v.label}…`}
                value={(form as any)[v.notesKey]}
                onChange={e => set(v.notesKey, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Design & IP Notes ─────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Design Changes & IP Notes</h2>
        <p className="text-xs text-gray-400 mb-4">Document all design modifications for legal IP protection.</p>
        <div className="space-y-4">
          <div>
            <label className="label">Design Source</label>
            <select className="input" value={form.designSource} onChange={e => set("designSource", e.target.value)}>
              <option value="in-house">In-house original design</option>
              <option value="reference">Based on reference (modified)</option>
              <option value="licensed">Licensed design</option>
            </select>
          </div>
          <div>
            <label className="label">IP / Design Origin Notes</label>
            <textarea className="input" rows={3} value={form.ipNotes} onChange={e => set("ipNotes", e.target.value)}
              placeholder="e.g. Original design by Happy2U. Reference shoe used only for last shape — all design elements changed." />
          </div>
          <div>
            <label className="label">Amendment / Special Instructions for Manufacturer</label>
            <textarea className="input" rows={4} value={form.amendmentNotes} onChange={e => set("amendmentNotes", e.target.value)}
              placeholder="e.g. Please change buckle color from silver to gun-black. Buckle length 4.5cm. Use TPR outsole with laser logo." />
          </div>
          <div>
            <label className="label">General Notes</label>
            <textarea className="input" rows={3} value={form.generalNotes} onChange={e => set("generalNotes", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        <button onClick={save} className="btn-primary px-8" disabled={saving}>
          {saving ? "Saving…" : "Create Sample Order"}
        </button>
      </div>
    </div>
  );
}
