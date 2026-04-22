"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, rmbToRm } from "@/lib/utils";
import { FileDown, GitBranch, PackageCheck, Send, ChevronLeft, Save, Upload, X, Edit2 } from "lucide-react";

const BRANDS = ["Happy2U", "Blissfit", "Latex", "Cloudfeet", "Bunny"];
const MANUFACTURERS_CACHE: { id: string; name: string }[] = [];

type Sample = {
  id: string; orderNumber: string; productName: string; productNumber?: string;
  version: number; status: string; brand: string; season?: string; sampleSize?: string;
  lastModel?: string; dateSent?: string; deadline?: string; receivedAt?: string;
  supplierSku?: string; h2uSku?: string; colorName?: string; colorCode?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
  heelSpec?: string; platformSpec?: string;
  materialUpperPhoto?: string; materialLiningPhoto?: string; materialMidsolePhoto?: string;
  materialOutsolePhoto?: string; hardwarePhoto?: string; logoSpecPhoto?: string;
  heelSpecPhoto?: string; platformSpecPhoto?: string;
  materialUpperRemark?: string; materialLiningRemark?: string; materialMidsoleRemark?: string;
  materialOutsoleRemark?: string; hardwareRemark?: string; logoSpecRemark?: string;
  heelSpecRemark?: string; platformSpecRemark?: string;
  notesA?: string; notesB?: string; notesC?: string; notesD?: string; notesE?: string;
  generalNotes?: string; amendmentNotes?: string; ipNotes?: string; designSource?: string;
  receivedRemark?: string; productCostRmb?: number; productCostRm?: number;
  costRmb?: number; costRm?: number; suggestedRetailLow?: number; suggestedRetailHigh?: number;
  photoSideUrl?: string; photoBackUrl?: string; photoFrontUrl?: string;
  photoPlatformUrl?: string; photoHeelUrl?: string;
  manufacturer: { id: string; name: string; contactName?: string; contactWechat?: string };
  parent?: { id: string; orderNumber: string; version: number };
  children: { id: string; orderNumber: string; version: number; status: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  shipping: "bg-purple-100 text-purple-700",
  delivered: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  used: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", sent: "Submitted",
  shipping: "Shipping", delivered: "Delivered", received: "Delivered",
  ready: "Ready", approved: "Ready", used: "Used", rejected: "Rejected",
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  return d.url ?? "";
}

function PhotoCell({ url, onChange }: { url?: string; onChange: (u: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    const u = await uploadFile(file);
    onChange(u);
    setUploading(false);
  }
  return (
    <div className="relative group">
      {url ? (
        <>
          <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
          <button onClick={() => ref.current?.click()}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] rounded-lg transition-opacity">
            <Upload size={12} />
          </button>
        </>
      ) : (
        <button onClick={() => ref.current?.click()}
          className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-brand-400 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-brand-500 transition-colors">
          {uploading ? <span className="text-[9px]">…</span> : <><Upload size={12} /><span className="text-[9px]">Photo</span></>}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

function ViewPhotoCell({ label, photo, notes, onUpload }: {
  label: string; photo?: string; notes?: string; onUpload: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    const url = await uploadFile(file);
    onUpload(url);
    setUploading(false);
  }
  return (
    <div className="text-center">
      <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center mb-2 overflow-hidden relative group cursor-pointer"
        onClick={() => !photo && ref.current?.click()}>
        {photo ? (
          <>
            <img src={photo} alt={label} className="w-full h-full object-cover" />
            <button onClick={e => { e.stopPropagation(); ref.current?.click(); }}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">
              <Upload size={14} className="mr-1" /> Replace
            </button>
          </>
        ) : uploading ? (
          <span className="text-gray-400 text-xs">Uploading…</span>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400 hover:text-brand-500 transition-colors">
            <Upload size={16} /><span className="text-[10px]">{label}</span>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
      <p className="text-xs font-medium text-gray-700">{label}</p>
      {notes && <p className="text-xs text-gray-500 mt-1">{notes}</p>}
    </div>
  );
}

const MATERIAL_ROWS = [
  { key: "materialUpper",   label: "Upper (鞋面)" },
  { key: "materialLining",  label: "Lining (内里)" },
  { key: "materialMidsole", label: "Midsole (中底)" },
  { key: "materialOutsole", label: "Outsole (大底)" },
  { key: "hardware",        label: "Hardware (五金)" },
  { key: "heelSpec",        label: "Heel (鞋跟)" },
  { key: "platformSpec",    label: "Platform (台面)" },
  { key: "logoSpec",        label: "Logo" },
] as const;

const VIEW_ROWS = [
  { label: "A — Side",     photoKey: "photoSideUrl",     notesKey: "notesA" },
  { label: "B — Back",     photoKey: "photoBackUrl",     notesKey: "notesB" },
  { label: "C — Front",    photoKey: "photoFrontUrl",    notesKey: "notesC" },
  { label: "D — Platform", photoKey: "photoPlatformUrl", notesKey: "notesD" },
  { label: "E — Heel",     photoKey: "photoHeelUrl",     notesKey: "notesE" },
] as const;

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [sample, setSample]   = useState<Sample | null>(null);
  const [mfrs, setMfrs]       = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving]   = useState(false);
  const [amending, setAmending]     = useState(false);
  const [amendNotes, setAmendNotes] = useState("");
  const [rmbRate] = useState<number>(() => parseFloat(localStorage.getItem("rmbRate") ?? "0.62"));

  // Edit state (used when draft)
  const [edit, setEdit] = useState<Record<string, string>>({});

  // Received stage
  const [rcvEdit, setRcvEdit] = useState({ supplierSku: "", productCostRmb: "", receivedRemark: "" });
  const [rcvSaving, setRcvSaving] = useState(false);

  useEffect(() => {
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs);
    fetch(`/api/samples/${id}`).then(r => r.json()).then((s: Sample) => {
      setSample(s);
      // Populate edit state from sample
      const e: Record<string, string> = {};
      e.brand = s.brand ?? "Happy2U";
      e.sampleSize = s.sampleSize ?? "37";
      e.lastModel = s.lastModel ?? "";
      e.dateSent = s.dateSent ? s.dateSent.split("T")[0] : "";
      e.deadline = s.deadline ? s.deadline.split("T")[0] : "";
      e.manufacturerId = s.manufacturer?.id ?? "";
      e.colorName = s.colorName ?? "";
      e.colorCode = s.colorCode ?? "";
      for (const row of MATERIAL_ROWS) {
        e[row.key] = (s as any)[row.key] ?? "";
        e[`${row.key}Remark`] = (s as any)[`${row.key}Remark`] ?? "";
        e[`${row.key}Photo`] = (s as any)[`${row.key}Photo`] ?? "";
      }
      for (const v of VIEW_ROWS) {
        e[v.photoKey] = (s as any)[v.photoKey] ?? "";
        e[v.notesKey] = (s as any)[v.notesKey] ?? "";
      }
      e.generalNotes = s.generalNotes ?? "";
      e.amendmentNotes = s.amendmentNotes ?? "";
      e.designSource = s.designSource ?? "in-house";
      e.ipNotes = s.ipNotes ?? "";
      setEdit(e);
      setRcvEdit({
        supplierSku: s.supplierSku ?? "",
        productCostRmb: s.productCostRmb ? String(s.productCostRmb) : "",
        receivedRemark: s.receivedRemark ?? "",
      });
    });
  }, [id]);

  function setE(field: string, value: string) {
    setEdit(prev => ({ ...prev, [field]: value }));
  }

  async function saveDraft() {
    setSaving(true);
    const payload: Record<string, any> = {
      brand: edit.brand,
      sampleSize: edit.sampleSize,
      lastModel: edit.lastModel || null,
      dateSent: edit.dateSent || null,
      deadline: edit.deadline || null,
      manufacturerId: edit.manufacturerId || undefined,
      colorName: edit.colorName || null,
      colorCode: edit.colorCode || null,
      productName: [edit.brand, edit.colorName].filter(Boolean).join(" ") || "Sample",
    };
    for (const row of MATERIAL_ROWS) {
      payload[row.key] = edit[row.key] || null;
      payload[`${row.key}Remark`] = edit[`${row.key}Remark`] || null;
      payload[`${row.key}Photo`] = edit[`${row.key}Photo`] || null;
    }
    for (const v of VIEW_ROWS) {
      payload[v.photoKey] = edit[v.photoKey] || null;
      payload[v.notesKey] = edit[v.notesKey] || null;
    }
    payload.generalNotes = edit.generalNotes || null;
    payload.amendmentNotes = edit.amendmentNotes || null;
    payload.designSource = edit.designSource || null;
    payload.ipNotes = edit.ipNotes || null;

    const res = await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setSample(updated);
      alert("Saved successfully!");
    } else {
      alert("Failed to save changes.");
    }
  }

  async function updateStatus(status: string) {
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetch(`/api/samples/${id}`).then(r => r.json()).then(setSample);
  }

  async function saveReceived() {
    setRcvSaving(true);
    const costRmb = parseFloat(rcvEdit.productCostRmb) || null;
    const costRm  = costRmb ? rmbToRm(costRmb, rmbRate) : null;
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierSku: rcvEdit.supplierSku || null, productCostRmb: costRmb, productCostRm: costRm, receivedRemark: rcvEdit.receivedRemark || null }),
    });
    setRcvSaving(false);
    fetch(`/api/samples/${id}`).then(r => r.json()).then(setSample);
  }

  async function createAmendment() {
    if (!amendNotes.trim()) { alert("Please describe what to amend."); return; }
    setSaving(true);
    const res = await fetch(`/api/samples/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amendmentNotes: amendNotes, status: "draft" }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/samples/${data.id}`);
    }
  }

  async function downloadPdf() {
    const res = await fetch(`/api/samples/${id}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${sample?.orderNumber ?? "sample"}.pdf`; a.click();
    }
  }

  if (!sample) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const isDraft = sample.status === "draft";
  const statusStyle = STATUS_STYLE[sample.status] ?? "bg-gray-100 text-gray-600";
  const statusLabel = STATUS_LABEL[sample.status] ?? sample.status;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/samples" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-2">
            <ChevronLeft size={14} /> Back to samples
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{sample.orderNumber}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>
              {statusLabel}
            </span>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">v{sample.version}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">{sample.productName} · {sample.manufacturer.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {isDraft && (
            <button onClick={saveDraft} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
          {isDraft && (
            <button onClick={() => updateStatus("submitted")} className="btn-secondary flex items-center gap-2">
              <Send size={14} /> Mark Submitted
            </button>
          )}
          {sample.status === "submitted" && (
            <button onClick={() => updateStatus("shipping")} className="btn-primary flex items-center gap-2">
              <PackageCheck size={14} /> Mark Shipping
            </button>
          )}
          {sample.status === "shipping" && (
            <button onClick={() => updateStatus("delivered")} className="btn-primary flex items-center gap-2">
              <PackageCheck size={14} /> Mark Delivered
            </button>
          )}
          {sample.status === "delivered" && (
            <>
              <button onClick={() => setAmending(true)} className="btn-secondary flex items-center gap-2">
                <GitBranch size={14} /> Create Amendment
              </button>
              <button onClick={() => updateStatus("ready")} className="btn-primary flex items-center gap-2">
                Mark Ready to Use
              </button>
            </>
          )}
          {sample.status === "ready" && (
            <button onClick={() => updateStatus("used")} className="btn-primary flex items-center gap-2">
              Mark Used
            </button>
          )}
          {!isDraft && (
            <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
              <FileDown size={14} /> Download PDF
            </button>
          )}
        </div>
      </div>

      {isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Edit2 size={14} /> This sample order is in <strong>Draft</strong> — all fields are editable. Click <strong>Save Changes</strong> when done.
        </div>
      )}

      {/* Version chain */}
      {(sample.parent || sample.children.length > 0) && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs font-medium text-amber-800 mb-2">Sample Version History</p>
          <div className="flex items-center gap-2 flex-wrap">
            {sample.parent && (
              <Link href={`/dashboard/samples/${sample.parent.id}`}
                className="text-xs bg-white border border-amber-200 px-3 py-1 rounded-full text-amber-700 hover:bg-amber-50">
                ← v{sample.parent.version} {sample.parent.orderNumber}
              </Link>
            )}
            <span className="text-xs bg-amber-200 text-amber-900 px-3 py-1 rounded-full font-medium">
              v{sample.version} (current)
            </span>
            {sample.children.map(c => (
              <Link key={c.id} href={`/dashboard/samples/${c.id}`}
                className="text-xs bg-white border border-amber-200 px-3 py-1 rounded-full text-amber-700 hover:bg-amber-50">
                v{c.version} {c.orderNumber} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Header Info */}
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Product Information</h2>
            <div className="space-y-3">
              {/* Brand */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Brand</span>
                {isDraft
                  ? <select className="input w-40 text-sm" value={edit.brand} onChange={e => setE("brand", e.target.value)}>
                      {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  : <span className="text-sm font-medium text-gray-900">{sample.brand || "-"}</span>
                }
              </div>
              {/* Manufacturer */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Manufacturer</span>
                {isDraft
                  ? <select className="input w-40 text-sm" value={edit.manufacturerId} onChange={e => setE("manufacturerId", e.target.value)}>
                      <option value="">Select…</option>
                      {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  : <span className="text-sm font-medium text-gray-900">{sample.manufacturer.name}</span>
                }
              </div>
              {/* Sample Size */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Sample Size</span>
                {isDraft
                  ? <select className="input w-40 text-sm" value={edit.sampleSize} onChange={e => setE("sampleSize", e.target.value)}>
                      {["35","36","37","38","39","40","41","42"].map(s => <option key={s} value={s}>EU {s}</option>)}
                    </select>
                  : <span className="text-sm font-medium text-gray-900">{sample.sampleSize ? `EU ${sample.sampleSize}` : "-"}</span>
                }
              </div>
              {/* Last Model */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Model</span>
                {isDraft
                  ? <input className="input w-40 text-sm" value={edit.lastModel} onChange={e => setE("lastModel", e.target.value)} placeholder="SR-2026-001" />
                  : <span className="text-sm font-medium text-gray-900">{sample.lastModel || "-"}</span>
                }
              </div>
              {/* Date Sent */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Date Sent</span>
                {isDraft
                  ? <input className="input w-40 text-sm" type="date" value={edit.dateSent} onChange={e => setE("dateSent", e.target.value)} />
                  : <span className="text-sm font-medium text-gray-900">{formatDate(sample.dateSent)}</span>
                }
              </div>
              {/* Deadline */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Deadline</span>
                {isDraft
                  ? <input className="input w-40 text-sm" type="date" value={edit.deadline} onChange={e => setE("deadline", e.target.value)} />
                  : <span className="text-sm font-medium text-gray-900">{formatDate(sample.deadline)}</span>
                }
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">SKU & Color</h2>
            <div className="space-y-3">
              {[
                { label: "Supplier SKU", key: "supplierSku", readonly: true, value: sample.supplierSku },
                { label: "H2U SKU",      key: "h2uSku",      readonly: true, value: sample.h2uSku },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
                </div>
              ))}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Color Name</span>
                {isDraft
                  ? <input className="input w-40 text-sm" value={edit.colorName} onChange={e => setE("colorName", e.target.value)} placeholder="BEIGE" />
                  : <span className="text-sm font-medium text-gray-900">{sample.colorName || "-"}</span>
                }
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Color Code</span>
                {isDraft
                  ? <input className="input w-40 text-sm" value={edit.colorCode} onChange={e => setE("colorCode", e.target.value)} placeholder="262" />
                  : <span className="text-sm font-medium text-gray-900">{sample.colorCode || "-"}</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Right: Materials */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Material Specifications</h2>
          <div className="space-y-4">
            {MATERIAL_ROWS.map(row => (
              <div key={row.key} className={isDraft ? "border border-gray-100 rounded-xl p-3 space-y-2" : "border-b border-gray-50 pb-3 last:border-0"}>
                <p className="text-xs font-semibold text-gray-600">{row.label}</p>
                {isDraft ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input text-sm" placeholder="Material…"
                        value={edit[row.key] ?? ""} onChange={e => setE(row.key, e.target.value)} />
                      <input className="input text-sm" placeholder="Remark…"
                        value={edit[`${row.key}Remark`] ?? ""} onChange={e => setE(`${row.key}Remark`, e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Photo:</span>
                      <PhotoCell url={edit[`${row.key}Photo`]} onChange={url => setE(`${row.key}Photo`, url)} />
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    {(sample as any)[`${row.key}Photo`] && (
                      <img src={(sample as any)[`${row.key}Photo`]} alt={row.label} className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-gray-900">{(sample as any)[row.key] || "—"}</p>
                      {(sample as any)[`${row.key}Remark`] && (
                        <p className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">{(sample as any)[`${row.key}Remark`]}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Views & Notes */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Product Views & Notes</h2>
        <div className="grid grid-cols-5 gap-4">
          {VIEW_ROWS.map(v => (
            <div key={v.label} className="text-center">
              <ViewPhotoCell
                label={v.label}
                photo={isDraft ? edit[v.photoKey] : (sample as any)[v.photoKey]}
                notes={isDraft ? edit[v.notesKey] : (sample as any)[v.notesKey]}
                onUpload={url => {
                  setE(v.photoKey, url);
                  // Auto-save photo immediately even in draft
                  fetch(`/api/samples/${id}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [v.photoKey]: url }),
                  });
                }}
              />
              {isDraft && (
                <input className="input text-xs mt-2 text-center" placeholder="Notes…"
                  value={edit[v.notesKey] ?? ""} onChange={e => setE(v.notesKey, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Design & IP Notes */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Design Changes & IP Notes</h2>
        {isDraft ? (
          <div className="space-y-4">
            <div>
              <label className="label">Design Source</label>
              <select className="input" value={edit.designSource} onChange={e => setE("designSource", e.target.value)}>
                <option value="in-house">In-house original design</option>
                <option value="reference">Based on reference (modified)</option>
                <option value="licensed">Licensed design</option>
              </select>
            </div>
            <div>
              <label className="label">IP / Design Origin Notes</label>
              <textarea className="input" rows={3} value={edit.ipNotes} onChange={e => setE("ipNotes", e.target.value)}
                placeholder="e.g. Original design by Happy2U. Reference shoe used only for last shape." />
            </div>
            <div>
              <label className="label">Amendment / Special Instructions for Manufacturer</label>
              <textarea className="input" rows={4} value={edit.amendmentNotes} onChange={e => setE("amendmentNotes", e.target.value)}
                placeholder="e.g. Please change buckle color from silver to gun-black." />
            </div>
            <div>
              <label className="label">General Notes</label>
              <textarea className="input" rows={3} value={edit.generalNotes} onChange={e => setE("generalNotes", e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {sample.designSource && <p className="text-gray-500">Source: <span className="text-gray-900 font-medium">{sample.designSource}</span></p>}
            {sample.ipNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">IP / Design Origin</p><p className="text-gray-800">{sample.ipNotes}</p></div>}
            {sample.amendmentNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">Amendment Instructions</p><p className="text-gray-800 whitespace-pre-wrap">{sample.amendmentNotes}</p></div>}
            {sample.generalNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">General Notes</p><p className="text-gray-800">{sample.generalNotes}</p></div>}
            {!sample.ipNotes && !sample.amendmentNotes && !sample.generalNotes && <p className="text-gray-400">No notes.</p>}
          </div>
        )}
      </div>

      {/* After Receiving Sample */}
      {["delivered","ready","used","rejected","received","approved"].includes(sample.status) && (
        <div className="card p-5 border-l-4 border-blue-400">
          <h2 className="font-semibold text-gray-900 mb-1">After Receiving Sample</h2>
          <p className="text-xs text-gray-400 mb-4">Fill in after the physical sample arrives from supplier.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Supplier SKU</label>
              <input className="input" value={rcvEdit.supplierSku}
                onChange={e => setRcvEdit(p => ({ ...p, supplierSku: e.target.value }))}
                placeholder="e.g. S1764" />
            </div>
            <div>
              <label className="label">Product Cost (RMB ¥)</label>
              <input className="input" type="number" step="0.01" value={rcvEdit.productCostRmb}
                onChange={e => setRcvEdit(p => ({ ...p, productCostRmb: e.target.value }))}
                placeholder="0.00" />
              {rcvEdit.productCostRmb && (
                <p className="text-xs text-gray-500 mt-1">≈ RM {rmbToRm(parseFloat(rcvEdit.productCostRmb) || 0, rmbRate).toFixed(2)}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Received Remark</label>
              <textarea className="input" rows={2} value={rcvEdit.receivedRemark}
                onChange={e => setRcvEdit(p => ({ ...p, receivedRemark: e.target.value }))}
                placeholder="Quality notes, issues found, changes requested…" />
            </div>
          </div>
          <button onClick={saveReceived} disabled={rcvSaving} className="btn-secondary flex items-center gap-2">
            <Save size={14} /> {rcvSaving ? "Saving…" : "Save Received Info"}
          </button>
        </div>
      )}

      {/* Amendment modal */}
      {amending && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Create Amendment — v{sample.version + 1}</h2>
            <p className="text-sm text-gray-500 mb-4">All fields from v{sample.version} will be copied. Document what changed below.</p>
            <label className="label">Amendment Notes *</label>
            <textarea className="input mb-4" rows={5} value={amendNotes} onChange={e => setAmendNotes(e.target.value)}
              placeholder="Describe all changes from this sample." />
            <div className="flex gap-3">
              <button onClick={() => setAmending(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createAmendment} className="btn-primary flex-1" disabled={saving}>
                {saving ? "Creating…" : "Create v" + (sample.version + 1)}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDraft && (
        <div className="flex justify-end gap-3 pb-6">
          <button onClick={saveDraft} disabled={saving} className="btn-primary px-8 flex items-center gap-2">
            <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
