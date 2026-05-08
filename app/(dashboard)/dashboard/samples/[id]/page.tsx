"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDate, rmbToRm } from "@/lib/utils";
import { FileDown, GitBranch, PackageCheck, Send, ChevronLeft, Save, Upload, X, Edit2, Truck, ChevronRight, Image as ImageIcon, Pencil, Plus } from "lucide-react";

const BRANDS = ["Happy2U", "Blissfit", "Latex", "Cloudfeet", "Bunny"];

const BRAND_LOGOS: Record<string, string> = {
  "Happy2U":   "/logos/happy2u.png",
  "Blissfit":  "/logos/blissfit.png",
  "Latex":     "/logos/latex.png",
  "Cloudfeet": "/logos/cloudfeet.png",
  "Bunny":     "/logos/happy2u.png",
};

const PRESET_COLORS = [
  { name: "Black",    hex: "#1a1a1a" },
  { name: "Beige",    hex: "#D4B896" },
  { name: "Espresso", hex: "#3C1414" },
  { name: "White",    hex: "#F4F4F4" },
];

type Sample = {
  id: string; orderNumber: string; productName: string; productNumber?: string;
  version: number; status: string; brand: string; season?: string; sampleSize?: string;
  lastModel?: string; dateSent?: string; deadline?: string; receivedAt?: string;
  trackingNumber?: string; courierCompany?: string; shipOutDate?: string;
  supplierSku?: string; h2uSku?: string; mainSku?: string; colorName?: string; colorCode?: string;
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
  colorVariants?: string;
  costRmb?: number; costRm?: number; suggestedRetailLow?: number; suggestedRetailHigh?: number;
  photoSideUrl?: string; photoBackUrl?: string; photoFrontUrl?: string;
  photoPlatformUrl?: string; photoHeelUrl?: string;
  manufacturer: { id: string; name: string; contactName?: string; contactWechat?: string };
  parent?: { id: string; orderNumber: string; version: number };
  children: { id: string; orderNumber: string; version: number; status: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-gray-100 text-gray-600",
  not_submitted: "bg-gray-100 text-gray-400",
  submitted: "bg-blue-100 text-blue-700",
  shipping: "bg-purple-100 text-purple-700",
  delivered: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  used: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-600",
  save_for_later: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Pending", pending: "Pending",
  not_submitted: "Not submitted",
  submitted: "Submitted", sent: "Submitted",
  shipping: "Shipping", delivered: "Delivered", received: "Delivered",
  ready: "Ready", approved: "Ready", used: "Used", rejected: "Rejected",
  save_for_later: "Save for later",
};

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

function MainPhotoUpload({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    const u = await uploadFile(file);
    onChange(u);
    setUploading(false);
  }
  if (url) {
    return (
      <div className="relative group w-48 h-48 flex-shrink-0">
        <img src={url} alt="Main design" className="w-48 h-48 object-cover rounded-xl border border-gray-200" />
        <button onClick={() => onChange("")}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center">
          <X size={11} />
        </button>
      </div>
    );
  }
  return (
    <>
      <button onClick={() => ref.current?.click()}
        className="w-48 h-48 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-brand-500 transition-colors">
        {uploading
          ? <span className="text-sm">Uploading…</span>
          : <><Upload size={22} /><span className="text-sm font-medium">Upload photo</span><span className="text-xs text-gray-300">JPG · PNG · WebP</span></>}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </>
  );
}

// Auto-detect courier from tracking number patterns
function detectCourier(tracking: string): string {
  const t = tracking.trim().toUpperCase();
  if (!t) return "";
  if (/^SF\d{12}$/.test(t) || /^(75|76|77|78)\d{10}$/.test(t)) return "SF Express (顺丰)";
  if (/^JT\d{12,15}$/.test(t) || /^60\d{11,13}$/.test(t)) return "J&T Express";
  if (/^YT\d{14,16}$/.test(t)) return "YunExpress";
  if (/^XX\d{13}$/.test(t) || /^4PX/.test(t)) return "4PX";
  if (/^1Z[A-Z0-9]{16}$/.test(t)) return "UPS";
  if (/^[0-9]{12}$/.test(t)) return "FedEx";
  if (/^[0-9]{15}$/.test(t)) return "FedEx";
  if (/^[0-9]{20,22}$/.test(t)) return "FedEx / USPS";
  if (/^[ERC][A-Z]{1}\d{9}CN$/i.test(t)) return "EMS / China Post";
  if (/^NV(SG|MY|TH|PH|ID|VN)/i.test(t)) return "Ninja Van";
  if (/^POSLAJU/i.test(t) || /^EF\d{9}MY$/i.test(t)) return "Poslaju";
  if (/^GD\d{10,14}$/.test(t)) return "DHL eCommerce";
  if (/^[0-9]{10}$/.test(t)) return "DHL Express";
  if (/^61\d{17}$/.test(t) || /^73\d{17}$/.test(t)) return "Australia Post";
  return "";
}

function ViewPhotoCell({ label, photo, notes, onUpload, editable = true }: {
  label: string; photo?: string; notes?: string; onUpload: (url: string) => void; editable?: boolean;
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
      <div className={`bg-gray-100 rounded-lg aspect-square flex items-center justify-center mb-2 overflow-hidden relative ${editable ? "group cursor-pointer" : ""}`}
        onClick={() => editable && !photo && ref.current?.click()}>
        {photo ? (
          <>
            <img src={photo} alt={label} className="w-full h-full object-cover" />
            {editable && (
              <button onClick={e => { e.stopPropagation(); ref.current?.click(); }}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">
                <Upload size={14} className="mr-1" /> Replace
              </button>
            )}
          </>
        ) : uploading ? (
          <span className="text-gray-400 text-xs">Uploading…</span>
        ) : editable ? (
          <div className="flex flex-col items-center gap-1 text-gray-400 hover:text-brand-500 transition-colors">
            <Upload size={16} /><span className="text-[10px]">{label}</span>
          </div>
        ) : (
          <span className="text-gray-300 text-xs">No photo</span>
        )}
        {editable && (
          <input ref={ref} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        )}
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
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [sample, setSample]   = useState<Sample | null>(null);
  const [mfrs, setMfrs]       = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving]   = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [amending, setAmending]     = useState(false);
  const [amendNotes, setAmendNotes] = useState("");
  const [newPo, setNewPo]           = useState<{ poNumber: string } | null>(null);
  const [creatingPo, setCreatingPo] = useState(false);
  const [linkedPos, setLinkedPos]   = useState<any[]>([]);

  // Shipping modal
  const [shippingModal, setShippingModal] = useState(false);
  const [shipForm, setShipForm] = useState({
    trackingNumber: "", courierCompany: "", shipOutDate: new Date().toISOString().split("T")[0],
  });
  const [rmbRate] = useState<number>(() => parseFloat(localStorage.getItem("rmbRate") ?? "0.62"));

  // Edit form state
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<{ name: string; hex: string; code: string }[]>([]);
  const [customColorInput, setCustomColorInput] = useState("");

  // Received stage
  const [rcvEdit, setRcvEdit] = useState({ supplierSku: "", productCostRmb: "", receivedRemark: "" });
  const [rcvSaving, setRcvSaving] = useState(false);

  function toggleColor(color: { name: string; hex: string; code?: string }) {
    setSelectedColors(prev =>
      prev.find(c => c.name === color.name)
        ? prev.filter(c => c.name !== color.name)
        : [...prev, { name: color.name, hex: color.hex, code: color.code ?? "" }]
    );
  }

  function setColorCode(name: string, code: string) {
    setSelectedColors(prev => prev.map(c => c.name === name ? { ...c, code: code.toUpperCase() } : c));
  }

  function addCustomColor() {
    const name = customColorInput.trim();
    if (!name) return;
    if (selectedColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      setCustomColorInput("");
      return;
    }
    setSelectedColors(prev => [...prev, { name, hex: "#CBD5E1", code: "" }]);
    setCustomColorInput("");
  }

  function populateEditState(s: Sample) {
    if (s.colorVariants) {
      try {
        const parsed = JSON.parse(s.colorVariants);
        setSelectedColors(parsed.map((c: any) => ({ name: c.name ?? "", hex: c.hex ?? "#CBD5E1", code: c.code ?? "" })));
      } catch { setSelectedColors([]); }
    } else {
      setSelectedColors([]);
    }
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
  }

  useEffect(() => {
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs);
    fetch(`/api/samples/${id}`).then(r => r.json()).then((s: Sample) => {
      setSample(s);
      populateEditState(s);
      // Auto-enter edit mode for drafts OR when ?edit=1 in URL
      const isDraft = s.status === "draft" || s.status === "pending";
      setIsEditing(isDraft || searchParams.get("edit") === "1");
      fetch("/api/purchase-orders").then(r => r.json()).then((pos: any[]) => {
        if (Array.isArray(pos)) setLinkedPos(pos.filter(p => p.sampleOrderId === s.orderNumber));
      });
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

  async function saveChanges() {
    setSaving(true);
    const firstColor = selectedColors[0]?.name ?? edit.colorName ?? "";
    const payload: Record<string, any> = {
      brand: edit.brand,
      sampleSize: edit.sampleSize,
      lastModel: edit.lastModel || null,
      dateSent: edit.dateSent || null,
      deadline: edit.deadline || null,
      manufacturerId: edit.manufacturerId || undefined,
      colorName: firstColor || null,
      colorCode: selectedColors[0]?.code || edit.colorCode || null,
      colorVariants: selectedColors.length > 0 ? JSON.stringify(selectedColors) : null,
      productName: [edit.brand, firstColor].filter(Boolean).join(" ") || "Sample",
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
      populateEditState(updated);
      setIsEditing(false);
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

  async function confirmShipping() {
    if (!shipForm.trackingNumber.trim()) { alert("Please enter a tracking number."); return; }
    setSaving(true);
    const res = await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "shipping",
        trackingNumber: shipForm.trackingNumber.trim(),
        courierCompany: shipForm.courierCompany.trim() || null,
        shipOutDate: shipForm.shipOutDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setSample(updated);
      setShippingModal(false);
    } else {
      alert("Failed to update shipping info.");
    }
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

  async function buildPoItems(s: typeof sample) {
    if (!s) return [];
    let variants: { name: string; hex: string; code?: string }[] = [];
    try { variants = JSON.parse(s.colorVariants ?? "[]"); } catch {}
    return variants.length > 0
      ? variants.map(cv => ({
          sampleOrderId: s.id, colorName: cv.name,
          qty35: 0, qty36: 0, qty37: 0, qty38: 0,
          qty39: 0, qty40: 0, qty41: 0, qty42: 0, totalPairs: 0,
        }))
      : s.colorName
      ? [{ sampleOrderId: s.id, colorName: s.colorName,
           qty35: 0, qty36: 0, qty37: 0, qty38: 0,
           qty39: 0, qty40: 0, qty41: 0, qty42: 0, totalPairs: 0 }]
      : [];
  }

  async function approveAndCreatePO() {
    if (!sample) return;
    setCreatingPo(true);
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    await createPoForSample(sample);
    setCreatingPo(false);
  }

  async function createPoForSample(s: typeof sample) {
    if (!s) return;
    const items = await buildPoItems(s);
    const res = await fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand:          s.brand,
        productName:    s.productName,
        manufacturerId: s.manufacturer.id,
        poType:         "test",
        sampleOrderId:  s.orderNumber,
        items,
      }),
    });
    if (res.ok) {
      const po = await res.json();
      setNewPo({ poNumber: po.poNumber });
      fetch("/api/purchase-orders").then(r => r.json()).then((pos: any[]) => {
        if (Array.isArray(pos)) setLinkedPos(pos.filter(p => p.sampleOrderId === s.orderNumber));
      });
    }
  }

  async function createPoOnly() {
    if (!sample) return;
    setCreatingPo(true);
    await createPoForSample(sample);
    setCreatingPo(false);
  }

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/samples/${id}/pdf`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const d = await res.json(); msg = d.error ?? msg; } catch {}
        alert(`PDF failed: ${msg}`);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${sample?.orderNumber ?? "sample"}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      alert(`PDF error: ${e.message}`);
    }
  }

  if (!sample) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const isDraft    = sample.status === "draft" || sample.status === "pending";
  const statusStyle = STATUS_STYLE[sample.status] ?? "bg-gray-100 text-gray-600";
  const statusLabel = STATUS_LABEL[sample.status] ?? sample.status;

  // ── EDIT VIEW — identical layout to new/page.tsx ──────────────────────────
  if (isEditing) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isDraft ? "New Sample Order" : "Edit Sample Order"}
            </h1>
            <p className="text-gray-500 text-sm">
              Reference: <span className="font-mono text-brand-600 font-semibold">{sample.orderNumber}</span>
              {isDraft && <span className="ml-2 text-xs text-gray-400">· Draft</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { populateEditState(sample); setIsEditing(false); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button onClick={saveChanges} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Section 1: Product Information */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Product Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Brand</label>
              <div className="flex items-center gap-3">
                <select className="input" value={edit.brand} onChange={e => setE("brand", e.target.value)}>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {BRAND_LOGOS[edit.brand] && (
                  <img src={BRAND_LOGOS[edit.brand]} alt={edit.brand} className="h-16 object-contain flex-shrink-0" />
                )}
              </div>
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <select className="input" value={edit.manufacturerId} onChange={e => setE("manufacturerId", e.target.value)}>
                <option value="">Select manufacturer…</option>
                {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sample Size</label>
              <select className="input" value={edit.sampleSize} onChange={e => setE("sampleSize", e.target.value)}>
                {["35","36","37","38","39","40","41","42"].map(s => <option key={s} value={s}>EU {s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date Sent</label>
                <input className="input" type="date" value={edit.dateSent} onChange={e => setE("dateSent", e.target.value)} />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input className="input" type="date" value={edit.deadline} onChange={e => setE("deadline", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Colour selector */}
          <div className="mt-5">
            <label className="label mb-2">Colours &amp; SKU Codes</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map(c => {
                const checked = !!selectedColors.find(s => s.name === c.name);
                return (
                  <button key={c.name} type="button" onClick={() => toggleColor(c)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      checked ? "border-gray-800 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                    }`}>
                    <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                    {c.name}
                    {checked && <X size={12} className="ml-0.5 opacity-70" />}
                  </button>
                );
              })}
              {selectedColors.filter(c => !PRESET_COLORS.find(p => p.name === c.name)).map(c => (
                <button key={c.name} type="button" onClick={() => toggleColor(c)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-white text-sm font-medium">
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-500 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                  {c.name}
                  <X size={12} className="ml-0.5 opacity-70" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input className="input text-sm w-48" placeholder="Add custom colour…"
                value={customColorInput} onChange={e => setCustomColorInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomColor(); } }} />
              <button type="button" onClick={addCustomColor} disabled={!customColorInput.trim()}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                + Add
              </button>
            </div>

            {/* Per-colour code inputs */}
            {selectedColors.length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Colour codes <span className="font-normal text-gray-400">(optional — assign the SKU letter for each colour)</span>
                </p>
                <div className="space-y-2">
                  {selectedColors.map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                      <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{c.name}</span>
                      <input
                        className="input font-mono text-sm w-20"
                        placeholder="e.g. H"
                        maxLength={4}
                        value={c.code}
                        onChange={e => setColorCode(c.name, e.target.value)}
                      />
                      {c.code && <span className="text-xs text-gray-400">code saved with colour</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Main Design Photo */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Main Design Photo</h2>
          <p className="text-xs text-gray-400 mb-4">Upload the primary shoe design photo — this will appear in the sample order list.</p>
          <div className="flex items-start gap-6">
            <MainPhotoUpload
              url={edit.photoSideUrl ?? ""}
              onChange={url => {
                setE("photoSideUrl", url);
                fetch(`/api/samples/${id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ photoSideUrl: url }),
                });
              }}
            />
            <div className="text-sm text-gray-400 pt-2 space-y-1 leading-relaxed">
              <p className="text-gray-600 font-medium">Recommended: side view of the shoe</p>
              <p>This photo shows as the thumbnail in the sample order list so the team can identify the design at a glance.</p>
              <p>You can also upload additional view photos (back, front, platform, heel) in the Product Views section below.</p>
            </div>
          </div>
        </div>

        {/* Section 3: Material Specifications */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Material Specifications</h2>
          <p className="text-xs text-gray-400 mb-4">Specify material for each component. Add a remark or attach a reference photo per row.</p>
          <div className="space-y-4">
            {MATERIAL_ROWS.map(row => (
              <div key={row.key} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <label className="text-sm font-semibold text-gray-700">{row.label}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-sm" placeholder={`${row.label.split(" ")[0]} material…`}
                    value={edit[row.key] ?? ""} onChange={e => setE(row.key, e.target.value)} />
                  <input className="input text-sm" placeholder="Remark / instruction…"
                    value={edit[`${row.key}Remark`] ?? ""} onChange={e => setE(`${row.key}Remark`, e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400">Reference photo:</span>
                  <PhotoUpload
                    url={edit[`${row.key}Photo`] ?? ""}
                    onChange={url => {
                      setE(`${row.key}Photo`, url);
                      fetch(`/api/samples/${id}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ [`${row.key}Photo`]: url }),
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Product Views & Notes */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Product Views & Notes</h2>
          <p className="text-xs text-gray-400 mb-4">Upload product reference photos per view. Add notes for the manufacturer for each angle.</p>
          <div className="space-y-4">
            {VIEW_ROWS.map(v => (
              <div key={v.photoKey} className="flex items-start gap-4">
                <div className="w-28 pt-1 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">{v.label}</span>
                </div>
                <PhotoUpload
                  url={edit[v.photoKey] ?? ""}
                  onChange={url => {
                    setE(v.photoKey, url);
                    fetch(`/api/samples/${id}`, {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ [v.photoKey]: url }),
                    });
                  }}
                />
                <input className="input flex-1 text-sm" placeholder={`Notes for ${v.label}…`}
                  value={edit[v.notesKey] ?? ""} onChange={e => setE(v.notesKey, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Design Changes & IP Notes */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Design Changes & IP Notes</h2>
          <p className="text-xs text-gray-400 mb-4">Document all design modifications for legal IP protection.</p>
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
        </div>

        {/* Draft-only: submit actions */}
        {isDraft && (
          <div className="card p-4 flex items-center justify-between gap-4 bg-gray-50">
            <p className="text-sm text-gray-500">Ready to submit this sample order to the manufacturer?</p>
            <div className="flex gap-2">
              <button onClick={() => { saveChanges().then(() => updateStatus("not_submitted")); }} className="btn-secondary text-sm">
                Save & Mark Not Submitted
              </button>
              <button onClick={() => saveChanges().then(() => updateStatus("submitted"))} className="btn-primary text-sm flex items-center gap-2">
                <Send size={13} /> Save & Submit
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pb-6">
          <button onClick={() => { populateEditState(sample); setIsEditing(false); }} className="btn-secondary">
            Cancel
          </button>
          <button onClick={saveChanges} disabled={saving} className="btn-primary px-8">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW (read-only) ───────────────────────────────────────────────
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
          {sample.status === "submitted" && (
            <button onClick={() => setShippingModal(true)} className="btn-primary flex items-center gap-2">
              <Truck size={14} /> Mark Shipping
            </button>
          )}
          {sample.status === "shipping" && (
            <button onClick={() => updateStatus("delivered")} className="btn-primary flex items-center gap-2">
              <PackageCheck size={14} /> Mark Delivered
            </button>
          )}
          {(sample.status === "delivered" || sample.status === "save_for_later") && (
            <>
              <button onClick={() => setAmending(true)} className="btn-secondary flex items-center gap-2">
                <GitBranch size={14} /> Request revision
              </button>
              <button onClick={() => updateStatus("rejected")} className="btn-secondary flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50">
                Reject
              </button>
              {sample.status !== "save_for_later" && (
                <button onClick={() => updateStatus("save_for_later")} className="btn-secondary flex items-center gap-2 border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100">
                  ⏸ Save for later
                </button>
              )}
              <button onClick={approveAndCreatePO} disabled={creatingPo} className="btn-primary flex items-center gap-2">
                {creatingPo ? "Creating PO…" : <><span>Approve</span> <ChevronRight size={14} /></>}
              </button>
            </>
          )}
          {(sample.status === "ready" || sample.status === "approved") && linkedPos.length === 0 && (
            <button onClick={createPoOnly} disabled={creatingPo} className="btn-primary flex items-center gap-2">
              {creatingPo ? "Creating PO…" : <><Plus size={14} /> Create PO</>}
            </button>
          )}
          {(sample.status === "ready" || sample.status === "approved") && (
            <button onClick={() => updateStatus("used")} className="btn-secondary flex items-center gap-2">
              Mark Used
            </button>
          )}
          <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
            <FileDown size={14} /> Download PDF
          </button>
          <button onClick={() => setIsEditing(true)} className="btn-secondary flex items-center gap-2">
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {newPo && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800">
            ✓ Sample approved. Purchase order <strong>{newPo.poNumber}</strong> created as draft — fill in quantities to proceed.
          </p>
          <Link href="/dashboard/purchase-orders"
            className="ml-4 text-sm font-semibold text-green-700 hover:text-green-900 flex items-center gap-1 whitespace-nowrap">
            View PO <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Shipping info */}
      {sample.trackingNumber && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Truck size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-purple-800 mb-1">Shipment Info</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-purple-700">
              <span><span className="text-purple-500">Tracking:</span> <strong>{sample.trackingNumber}</strong></span>
              {sample.courierCompany && <span><span className="text-purple-500">Courier:</span> {sample.courierCompany}</span>}
              {sample.shipOutDate && <span><span className="text-purple-500">Ship-out date:</span> {formatDate(sample.shipOutDate)}</span>}
            </div>
          </div>
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

      {/* Read-only detail cards */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Product Information</h2>
            <div className="space-y-3">
              {[
                { label: "Brand",        value: sample.brand },
                { label: "Manufacturer", value: sample.manufacturer.name },
                { label: "Sample Size",  value: sample.sampleSize ? `EU ${sample.sampleSize}` : undefined },
                { label: "Last Model",   value: sample.lastModel },
                { label: "Date Sent",    value: formatDate(sample.dateSent) },
                { label: "Deadline",     value: formatDate(sample.deadline) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">SKU &amp; Colour</h2>
            <div className="space-y-3">
              {sample.supplierSku && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Supplier SKU</span>
                  <span className="text-sm font-medium text-gray-900 font-mono">{sample.supplierSku}</span>
                </div>
              )}
              {sample.colorVariants && (() => {
                try {
                  const variants: { name: string; hex: string; code?: string }[] = JSON.parse(sample.colorVariants);
                  if (variants.length > 0) return (
                    <div>
                      <span className="text-sm text-gray-500 block mb-2">Colours &amp; SKUs</span>
                      <div className="space-y-2">
                        {variants.map(c => {
                          const colorSku = sample.mainSku && c.code ? `${sample.mainSku}${c.code}` : null;
                          return (
                            <div key={c.name} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-gray-700">
                                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300" style={{ backgroundColor: c.hex }} />
                                {c.name}
                                {c.code && <span className="font-mono text-gray-400">[{c.code}]</span>}
                              </span>
                              {colorSku && (
                                <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                  {colorSku}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } catch {}
                return null;
              })()}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Material Specifications</h2>
          <div className="space-y-4">
            {MATERIAL_ROWS.map(row => (
              <div key={row.key} className="border-b border-gray-50 pb-3 last:border-0">
                <p className="text-xs font-semibold text-gray-600 mb-1">{row.label}</p>
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
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Product Views & Notes</h2>
        <div className="grid grid-cols-5 gap-4">
          {VIEW_ROWS.map(v => (
            <ViewPhotoCell key={v.label} label={v.label}
              photo={(sample as any)[v.photoKey]} notes={(sample as any)[v.notesKey]}
              editable={false} onUpload={() => {}} />
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Design Changes & IP Notes</h2>
        <div className="space-y-3 text-sm">
          {sample.designSource && <p className="text-gray-500">Source: <span className="text-gray-900 font-medium">{sample.designSource}</span></p>}
          {sample.ipNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">IP / Design Origin</p><p className="text-gray-800">{sample.ipNotes}</p></div>}
          {sample.amendmentNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">Amendment Instructions</p><p className="text-gray-800 whitespace-pre-wrap">{sample.amendmentNotes}</p></div>}
          {sample.generalNotes && <div><p className="text-xs font-medium text-gray-500 mb-1">General Notes</p><p className="text-gray-800">{sample.generalNotes}</p></div>}
          {!sample.ipNotes && !sample.amendmentNotes && !sample.generalNotes && <p className="text-gray-400">No notes.</p>}
        </div>
      </div>

      {/* After Receiving Sample */}
      {["delivered","ready","used","rejected","received","approved","save_for_later"].includes(sample.status) && (
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

      {/* Purchase Order History */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Purchase Order History</h2>
        {linkedPos.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No purchase orders linked to this sample order yet.</p>
        ) : (
          <div className="space-y-2">
            {linkedPos.map((po: any) => (
              <Link key={po.id} href={`/dashboard/purchase-orders/${po.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-gray-700 group-hover:text-brand-700">{po.poNumber}</span>
                  {po.poType && (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      po.poType === "test" ? "bg-blue-100 text-blue-700" :
                      po.poType === "reorder" ? "bg-green-100 text-green-700" :
                      po.poType === "replenishment" ? "bg-orange-100 text-orange-700" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {po.poType === "replenishment" ? "Replen" : po.poType}
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    po.status === "closed" ? "bg-gray-100 text-gray-500" :
                    po.status === "shipped" ? "bg-green-100 text-green-700" :
                    po.status === "in_production" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{po.status ?? "draft"}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {po.totalPairs > 0 && <span>{po.totalPairs.toLocaleString()} pairs</span>}
                  {po.totalPrice > 0 && <span>¥{po.totalPrice.toLocaleString()}</span>}
                  {po.date && <span>{new Date(po.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Shipping modal */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Truck size={18} /> Mark as Shipping</h2>
              <button onClick={() => setShippingModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Tracking Number *</label>
                <input className="input" value={shipForm.trackingNumber} placeholder="e.g. SF123456789012"
                  onChange={e => {
                    const val = e.target.value;
                    const detected = detectCourier(val);
                    setShipForm(p => ({ ...p, trackingNumber: val, courierCompany: detected || p.courierCompany }));
                  }} />
                {shipForm.trackingNumber && detectCourier(shipForm.trackingNumber) && (
                  <p className="text-xs text-green-600 mt-1">✓ Auto-detected: {detectCourier(shipForm.trackingNumber)}</p>
                )}
              </div>
              <div>
                <label className="label">Courier Company</label>
                <input className="input" value={shipForm.courierCompany} placeholder="e.g. SF Express"
                  onChange={e => setShipForm(p => ({ ...p, courierCompany: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Auto-filled from tracking number. You can override it.</p>
              </div>
              <div>
                <label className="label">Ship-out Date</label>
                <input className="input" type="date" value={shipForm.shipOutDate}
                  onChange={e => setShipForm(p => ({ ...p, shipOutDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShippingModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmShipping} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Truck size={14} /> {saving ? "Saving…" : "Confirm Shipping"}
              </button>
            </div>
          </div>
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
    </div>
  );
}
