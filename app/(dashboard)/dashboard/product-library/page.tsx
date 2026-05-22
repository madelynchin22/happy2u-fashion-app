"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Upload, X, BookOpen,
  ChevronDown, ChevronUp, Pencil, Trash2,
  ChevronLeft, ChevronRight, Camera, Box, ShoppingCart, RefreshCw,
} from "lucide-react";

type PLItem = {
  id: string; libNumber: string; productName: string; h2uSku?: string; mainSku?: string; supplierSku?: string;
  brand?: string; category?: string; colorName?: string; colorCode?: string; season?: string;
  status?: string; inventoryTotal?: number; warehouseQty?: number;
  sizeRange?: string; availableSizes?: string; sizeInventory?: string; compareAtPrice?: number; productType?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string; heelSpec?: string; platformSpec?: string;
  costRmb?: number; costRm?: number; sellingPrice?: number;
  imageUrls?: string; notes?: string; sampleOrderId?: string;
  shoePhotoUrl?: string; photoSideUrl?: string; photoUpperUrl?: string; photoDesignUrl?: string; boxPhotoUrl?: string;
  materialUpperPhoto?: string; materialLiningPhoto?: string; materialMidsolePhoto?: string; materialOutsolePhoto?: string;
  hardwarePhoto?: string; logoSpecPhoto?: string; heelSpecPhoto?: string; platformSpecPhoto?: string;
  manufacturer?: { id: string; name: string };
  sampleOrder?: { orderNumber: string };
  createdAt: string;
};
type Mfr = { id: string; name: string };

const SHOE_SIZES = ["36","37","38","39","40","41","42"];
const CATS = ["heels","flats","sandals","boots","sneakers","wedges","bags","accessories","shoe_care","clearance","keychain","merchandiser"];
const PAGE_SIZE = 50;

type StatusKey = "all" | "draft" | "active" | "low_stock" | "out_of_stock" | "clearance" | "archived";

const STATUS_TABS: { key: StatusKey; label: string; dot: string; card: string; text: string; subtext: string; badge: string }[] = [
  { key:"all",          label:"All SKUs",     dot:"bg-gray-400",    card:"bg-white border-gray-300",         text:"text-gray-900",    subtext:"text-gray-400",    badge:"bg-gray-100 text-gray-600 ring-gray-200"     },
  { key:"draft",        label:"Draft",        dot:"bg-violet-400",  card:"bg-violet-50 border-violet-300",   text:"text-violet-800",  subtext:"text-violet-500",  badge:"bg-violet-50 text-violet-700 ring-violet-200" },
  { key:"active",       label:"Active",       dot:"bg-teal-500",    card:"bg-teal-50 border-teal-300",       text:"text-teal-800",    subtext:"text-teal-500",    badge:"bg-teal-50 text-teal-700 ring-teal-200"      },
  { key:"low_stock",    label:"Low Stock",    dot:"bg-amber-400",   card:"bg-amber-50 border-amber-300",     text:"text-amber-800",   subtext:"text-amber-500",   badge:"bg-amber-50 text-amber-700 ring-amber-200"   },
  { key:"out_of_stock", label:"Out of Stock", dot:"bg-gray-400",    card:"bg-gray-100 border-gray-300",      text:"text-gray-700",    subtext:"text-gray-500",    badge:"bg-gray-100 text-gray-600 ring-gray-200"     },
  { key:"clearance",    label:"Clearance",    dot:"bg-red-400",     card:"bg-red-50 border-red-300",         text:"text-red-800",     subtext:"text-red-400",     badge:"bg-red-50 text-red-600 ring-red-200"         },
  { key:"archived",     label:"Archived",     dot:"bg-slate-400",   card:"bg-slate-50 border-slate-300",     text:"text-slate-700",   subtext:"text-slate-400",   badge:"bg-slate-100 text-slate-600 ring-slate-200"  },
];

const BLANK_FORM = {
  productName:"", mainSku:"", colorCode:"", h2uSku:"", supplierSku:"", brand:"Happy2U", category:"heels",
  colorName:"", season:"", manufacturerId:"",
  materialUpper:"", materialLining:"", materialMidsole:"", materialOutsole:"",
  hardware:"", logoSpec:"", heelSpec:"", platformSpec:"",
  costRmb:"", costRm:"", sellingPrice:"", notes:"",
  shoePhotoUrl:"", photoSideUrl:"", photoUpperUrl:"", photoDesignUrl:"", boxPhotoUrl:"", status:"",
  materialUpperPhoto:"", materialLiningPhoto:"", materialMidsolePhoto:"", materialOutsolePhoto:"",
  hardwarePhoto:"", logoSpecPhoto:"", heelSpecPhoto:"", platformSpecPhoto:"",
};

function parseSizes(s?: string): string[] {
  if (!s) return [];
  try { return JSON.parse(s) as string[]; } catch { return []; }
}
function parseSizeInv(s?: string): Record<string, number> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, number>; } catch { return {}; }
}

type DisplayRow =
  | { type: "group"; groupKey: string; mainSku: string | null; items: PLItem[] }
  | { type: "single"; item: PLItem };

function StatusBadge({ status }: { status?: string }) {
  const tab = STATUS_TABS.find(t => t.key === status);
  if (!tab || tab.key === "all") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${tab.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dot}`} />
      {tab.key === "draft" ? "Pending SKU" : tab.label}
    </span>
  );
}

export default function ProductLibraryPage() {
  const router = useRouter();
  const [allItems, setAllItems]   = useState<PLItem[]>([]);
  const [mfrs, setMfrs]           = useState<Mfr[]>([]);
  const [activeTab, setActiveTab] = useState<StatusKey>("all");
  const [search, setSearch]       = useState("");
  const [catF, setCatF]           = useState("");
  const [sizeF, setSizeF]         = useState("");
  const [colorF, setColorF]       = useState("");
  const [page, setPage]           = useState(1);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  const [modal, setModal]         = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState({ ...BLANK_FORM });
  const [saving, setSaving]       = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [missedSkus, setMissedSkus] = useState<string[]>([]);
  const [creatingPO, setCreatingPO] = useState<string | null>(null);

  // Group-edit modal state
  type GroupColour = { id: string; colorName: string; colorCode: string; shoePhotoUrl: string; photoSideUrl: string; photoUpperUrl: string; photoDesignUrl: string; isNew?: boolean };
  const [groupModal, setGroupModal]   = useState(false);
  const [groupItems, setGroupItems]   = useState<PLItem[]>([]);
  const [groupForm, setGroupForm]     = useState({ productName: "", mainSku: "", category: "", brand: "", season: "" });
  const [groupColours, setGroupColours] = useState<GroupColour[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [pendingGroupUpload, setPendingGroupUpload] = useState<{ idx: number; field: string } | null>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);

  function openGroupEdit(items: PLItem[], e: React.MouseEvent) {
    e.stopPropagation();
    setGroupItems(items);
    const first = items[0];
    setGroupForm({
      productName: first.productName ?? "",
      mainSku: first.mainSku ?? "",
      category: first.category ?? "",
      brand: first.brand ?? "Happy2U",
      season: first.season ?? "",
    });
    setGroupColours(items.map(it => ({
      id: it.id,
      colorName: it.colorName ?? "",
      colorCode: it.colorCode ?? "",
      shoePhotoUrl: it.shoePhotoUrl ?? "",
      photoSideUrl: it.photoSideUrl ?? "",
      photoUpperUrl: it.photoUpperUrl ?? "",
      photoDesignUrl: it.photoDesignUrl ?? "",
    })));
    setGroupModal(true);
  }

  async function saveGroup() {
    if (!groupForm.productName) { alert("Product name required"); return; }
    setSavingGroup(true);
    try {
      await Promise.all(groupColours.map(async gc => {
        const derivedH2u = groupForm.mainSku && gc.colorCode ? groupForm.mainSku + gc.colorCode : null;
        const colourPayload = {
          productName: groupForm.productName,
          mainSku: groupForm.mainSku || null,
          category: groupForm.category || null,
          brand: groupForm.brand || null,
          season: groupForm.season || null,
          colorName: gc.colorName || null,
          colorCode: gc.colorCode || null,
          h2uSku: derivedH2u,
          shoePhotoUrl: gc.shoePhotoUrl || null,
          photoSideUrl: gc.photoSideUrl || null,
          photoUpperUrl: gc.photoUpperUrl || null,
          photoDesignUrl: gc.photoDesignUrl || null,
        };
        if (gc.isNew) {
          const res = await fetch("/api/product-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...colourPayload, status: "active" }),
          });
          if (res.ok) {
            const created = await res.json();
            setAllItems(prev => [created, ...prev]);
          }
        } else {
          const res = await fetch(`/api/product-library/${gc.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(colourPayload),
          });
          if (res.ok) {
            const updated = await res.json();
            setAllItems(prev => prev.map(it => it.id === gc.id ? { ...it, ...updated } : it));
          }
        }
      }));
    } finally {
      setSavingGroup(false);
      setGroupModal(false);
    }
  }
  async function handleGroupPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingGroupUpload) return;
    const { idx, field } = pendingGroupUpload;
    let url: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) { url = (await res.json()).url; break; }
      } catch {
        if (attempt === 2) { alert("Upload failed — please try again."); break; }
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (url) setGroupColours(prev => prev.map((c, i) => i === idx ? { ...c, [field]: url as string } : c));
    e.target.value = "";
    setPendingGroupUpload(null);
  }

  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [pendingPhotoField, setPendingPhotoField] = useState<string | null>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const shopifyExportRef = useRef<HTMLInputElement>(null);
  const [importingExport, setImportingExport] = useState(false);
  const singlePhotoInputRef = useRef<HTMLInputElement>(null);

  const [vendorBoxMap, setVendorBoxMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/product-library").then(r => r.json()).then(setAllItems).catch(() => {});
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs).catch(() => {});
    fetch("/api/vendor-assets")
      .then(r => r.json())
      .then((assets: {vendor: string; assetType: string; imageUrl: string}[]) => {
        const boxMap: Record<string, string> = {};
        for (const a of assets) if (a.assetType === "box") boxMap[a.vendor] = a.imageUrl;
        setVendorBoxMap(boxMap);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); setExpanded(null); setExpandedGroups(new Set()); }, [activeTab, search, catF, sizeF, colorF]);

  // Counts per status — by unique Main SKU group (not individual colour entries)
  const counts = useMemo(() => {
    const sets: Record<string, Set<string>> = { all: new Set(), draft: new Set(), active: new Set(), low_stock: new Set(), out_of_stock: new Set(), clearance: new Set(), archived: new Set() };
    for (const it of allItems) {
      const gk = it.mainSku ? `sku:${it.mainSku}` : it.sampleOrderId ? `sample:${it.sampleOrderId}` : `single:${it.id}`;
      sets.all.add(gk);
      const s = it.status as StatusKey;
      if (s && s in sets) sets[s].add(gk);
    }
    return Object.fromEntries(Object.keys(sets).map(k => [k, sets[k].size])) as Record<StatusKey, number>;
  }, [allItems]);

  const allColors = useMemo(() => {
    const s = new Set<string>();
    for (const it of allItems) if (it.colorName) s.add(it.colorName);
    return [...s].sort();
  }, [allItems]);

  const catCounts = useMemo(() => {
    const base = activeTab === "all" ? allItems : allItems.filter(i => i.status === activeTab);
    const seen = new Set<string>();
    const c: Record<string, number> = {};
    for (const it of base) {
      const gk = it.mainSku ? `sku:${it.mainSku}` : it.sampleOrderId ? `sample:${it.sampleOrderId}` : `single:${it.id}`;
      if (seen.has(gk)) continue;
      seen.add(gk);
      const k = it.category ?? "other";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [allItems, activeTab]);

  // Status sort order for the "All SKUs" view — drafts first so pending SKUs are visible
  const STATUS_ORDER: Record<string, number> = { draft: 0, active: 1, low_stock: 2, out_of_stock: 3, clearance: 4, archived: 5 };

  // Filtered + sorted list for current tab + secondary filters
  const filtered = useMemo(() => {
    const result = allItems.filter(it => {
      if (activeTab !== "all" && it.status !== activeTab) return false;
      if (catF && it.category !== catF) return false;
      if (colorF && it.colorName !== colorF) return false;
      if (sizeF && (parseSizeInv(it.sizeInventory)[sizeF] ?? 0) <= 0) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [it.productName, it.h2uSku, it.supplierSku, it.colorName, it.category].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // In "All" view, group by status: Active → Low Stock → Out of Stock → Clearance
    if (activeTab === "all") {
      result.sort((a, b) =>
        (STATUS_ORDER[a.status ?? ""] ?? 9) - (STATUS_ORDER[b.status ?? ""] ?? 9)
      );
    }
    return result;
  }, [allItems, activeTab, catF, colorF, sizeF, search]);

  // Group by mainSku, then by sampleOrderId (drafts from same sample), then singles — for all tabs
  const displayRows = useMemo<DisplayRow[]>(() => {
    const mainSkuMap  = new Map<string, PLItem[]>();
    const sampleMap   = new Map<string, PLItem[]>();
    const singles: PLItem[] = [];
    for (const item of filtered) {
      if (item.mainSku) {
        if (!mainSkuMap.has(item.mainSku)) mainSkuMap.set(item.mainSku, []);
        mainSkuMap.get(item.mainSku)!.push(item);
      } else if (item.sampleOrderId) {
        if (!sampleMap.has(item.sampleOrderId)) sampleMap.set(item.sampleOrderId, []);
        sampleMap.get(item.sampleOrderId)!.push(item);
      } else {
        singles.push(item);
      }
    }
    const rows: DisplayRow[] = [];
    for (const [mainSku, items] of [...mainSkuMap.entries()].sort(([a],[b]) => a.localeCompare(b)))
      rows.push({ type: "group", groupKey: `sku:${mainSku}`, mainSku, items });
    for (const [sampleId, items] of sampleMap) {
      if (items.length > 1)
        rows.push({ type: "group", groupKey: `sample:${sampleId}`, mainSku: null, items });
      else
        singles.push(items[0]);
    }
    for (const item of singles)
      rows.push({ type: "single", item });
    return rows;
  }, [filtered, activeTab]);

  const totalRows   = displayRows.length;
  const totalPages  = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const paginatedDisplay  = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasSecondaryFilters = !!(catF || sizeF || colorF || search);
  const currentTab = STATUS_TABS.find(t => t.key === activeTab)!;

  function clearSecondary() { setCatF(""); setSizeF(""); setColorF(""); setSearch(""); }

  // Modal helpers
  function openAdd() { setEditId(null); setForm({ ...BLANK_FORM }); setModal(true); }
  function buildFormFromItem(item: PLItem, overrides: Partial<typeof BLANK_FORM> = {}) {
    return {
      productName: item.productName, mainSku: item.mainSku ?? "", colorCode: item.colorCode ?? "",
      h2uSku: item.h2uSku ?? "", supplierSku: item.supplierSku ?? "",
      brand: item.brand ?? "Happy2U", category: item.category ?? "heels",
      colorName: item.colorName ?? "", season: item.season ?? "",
      manufacturerId: (item.manufacturer?.id ?? "") as any,
      materialUpper: item.materialUpper ?? "", materialLining: item.materialLining ?? "",
      materialMidsole: item.materialMidsole ?? "", materialOutsole: item.materialOutsole ?? "",
      hardware: item.hardware ?? "", logoSpec: item.logoSpec ?? "",
      heelSpec: item.heelSpec ?? "", platformSpec: item.platformSpec ?? "",
      costRmb: item.costRmb ? String(item.costRmb) : "",
      costRm: item.costRm ? String(item.costRm) : "",
      sellingPrice: item.sellingPrice ? String(item.sellingPrice) : "",
      notes: item.notes ?? "",
      shoePhotoUrl: item.shoePhotoUrl ?? "",
      photoSideUrl: item.photoSideUrl ?? "",
      photoUpperUrl: item.photoUpperUrl ?? "",
      photoDesignUrl: item.photoDesignUrl ?? "",
      boxPhotoUrl: item.boxPhotoUrl ?? "",
      materialUpperPhoto: item.materialUpperPhoto ?? "",
      materialLiningPhoto: item.materialLiningPhoto ?? "",
      materialMidsolePhoto: item.materialMidsolePhoto ?? "",
      materialOutsolePhoto: item.materialOutsolePhoto ?? "",
      hardwarePhoto: item.hardwarePhoto ?? "",
      logoSpecPhoto: item.logoSpecPhoto ?? "",
      heelSpecPhoto: item.heelSpecPhoto ?? "",
      platformSpecPhoto: item.platformSpecPhoto ?? "",
      status: item.status ?? "",
      ...overrides,
    };
  }
  function openEdit(item: PLItem) {
    setEditId(item.id);
    setForm(buildFormFromItem(item));
    setModal(true);
  }
  function openAssignSku(item: PLItem) {
    setEditId(item.id);
    setForm(buildFormFromItem(item, { status: "active" }));
    setModal(true);
  }
  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function uploadPhoto(file: File, field: string) {
    setUploadingPhoto(field);
    let url: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) { url = (await res.json()).url; break; }
      } catch {
        if (attempt === 2) { alert("Upload failed — please try again."); setUploadingPhoto(null); return; }
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (url) setF(field, url);
    else alert("Upload failed — please try again.");
    setUploadingPhoto(null);
  }

  async function handleSinglePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingPhotoField) return;
    await uploadPhoto(file, pendingPhotoField);
    e.target.value = "";
    setPendingPhotoField(null);
  }

  function triggerPhotoUpload(field: string) {
    setPendingPhotoField(field);
    singlePhotoInputRef.current?.click();
  }

  async function save() {
    if (!form.productName) { alert("Product name required"); return; }
    setSaving(true);
    const derivedColorSku =
      form.mainSku && form.colorCode ? form.mainSku + form.colorCode
      : form.h2uSku || null;
    const payload = {
      productName: form.productName,
      mainSku: form.mainSku || null,
      h2uSku: derivedColorSku,
      supplierSku: form.supplierSku || null,
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
      shoePhotoUrl: (form as any).shoePhotoUrl || null,
      photoSideUrl: (form as any).photoSideUrl || null,
      photoUpperUrl: (form as any).photoUpperUrl || null,
      photoDesignUrl: (form as any).photoDesignUrl || null,
      boxPhotoUrl: (form as any).boxPhotoUrl || null,
      materialUpperPhoto: (form as any).materialUpperPhoto || null,
      materialLiningPhoto: (form as any).materialLiningPhoto || null,
      materialMidsolePhoto: (form as any).materialMidsolePhoto || null,
      materialOutsolePhoto: (form as any).materialOutsolePhoto || null,
      hardwarePhoto: (form as any).hardwarePhoto || null,
      logoSpecPhoto: (form as any).logoSpecPhoto || null,
      heelSpecPhoto: (form as any).heelSpecPhoto || null,
      platformSpecPhoto: (form as any).platformSpecPhoto || null,
    };
    const payloadWithStatus = { ...payload, status: (form as any).status || null };
    if (editId) {
      const res = await fetch(`/api/product-library/${editId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payloadWithStatus) });
      if (res.ok) {
        const updated = await res.json();
        setAllItems(prev => prev.map(it => it.id === editId ? { ...it, ...updated } : it));
      } else {
        alert("Save failed. Please try again.");
        setSaving(false);
        return;
      }
    } else {
      const res = await fetch("/api/product-library", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (res.ok) { const d = await res.json(); setAllItems(prev => [d, ...prev]); }
      else { alert("Save failed. Please try again."); setSaving(false); return; }
    }
    setSaving(false);
    setModal(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/product-library/${id}`, { method:"DELETE" });
    setAllItems(prev => prev.filter(it => it.id !== id));
  }

  async function createDraftPO(groupKey: string, items: PLItem[], mainSku: string | null) {
    setCreatingPO(groupKey);
    try {
      const first = items[0];
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: mainSku ?? first.productName,
          brand: first.brand ?? "Happy2U",
          manufacturerId: first.manufacturer?.id ?? null,
          status: "draft",
          items: items.map(item => ({
            h2uSku:          item.h2uSku          ?? null,
            colorName:       item.colorName        ?? null,
            colorCode:       item.colorCode        ?? null,
            brand:           item.brand            ?? "Happy2U",
            materialUpper:   item.materialUpper    ?? null,
            materialLining:  item.materialLining   ?? null,
            materialMidsole: item.materialMidsole  ?? null,
            materialOutsole: item.materialOutsole  ?? null,
            hardware:        item.hardware         ?? null,
            logoSpec:        item.logoSpec         ?? null,
            photoUrl:        item.shoePhotoUrl     ?? null,
            totalPairs: 0,
            lineTotal:  0,
          })),
        }),
      });
      if (res.ok) {
        router.push("/dashboard/purchase-orders");
      } else {
        alert("Failed to create draft PO");
      }
    } finally {
      setCreatingPO(null);
    }
  }

  async function syncShopifyPhotos() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/product-library/sync-shopify", { method: "POST" });
      const text = await res.text();
      const d = text ? JSON.parse(text) : {};
      setSyncing(false);
      if (res.ok) {
        setSyncResult(`✓ ${d.photosUpdated ?? 0} photos · ${d.descUpdated ?? 0} descriptions synced from shophappy2u.com (${d.skipped ?? 0} not matched)`);
        fetch("/api/product-library").then(r => r.json()).then(setAllItems).catch(() => {});
      } else {
        setSyncResult(`Error: ${d.error ?? "Sync failed"}`);
      }
    } catch (e: any) {
      setSyncing(false);
      setSyncResult(`Error: ${e?.message ?? "Sync failed"}`);
    }
  }

  async function importShopifyExport(file: File) {
    setImportingExport(true);
    setSyncResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets["Products"] ?? wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const res = await fetch("/api/product-library/import-shopify-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const d = await res.json();
      if (res.ok) {
        setSyncResult(`✓ Updated ${d.updated} SKUs (${d.notFound} not matched of ${d.total} total)`);
        setMissedSkus(d.missedSkus ?? []);
        fetch("/api/product-library").then(r => r.json()).then(setAllItems).catch(() => {});
      } else {
        setSyncResult(`✗ Import failed: ${d.error ?? "unknown error"}`);
        setMissedSkus([]);
      }
    } catch (e: any) {
      setSyncResult(`✗ Import failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setImportingExport(false);
    }
  }

  async function importExcel(file: File) {
    setImporting(true);
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type:"array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    const res = await fetch("/api/product-library/import", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(rows) });
    const d = await res.json();
    setImporting(false);
    if (res.ok) { alert(`Imported ${d.imported} products`); fetch("/api/product-library").then(r=>r.json()).then(setAllItems).catch(()=>{}); }
    else alert("Import failed");
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-brand-500" /> Product Library
          </h1>
          <p className="text-gray-500 text-sm">{counts.all} SKUs · {counts.draft ?? 0} pending SKU assignment</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncShopifyPhotos} disabled={syncing}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing photos…" : "Sync photos from website"}
          </button>
          <button onClick={() => xlsxRef.current?.click()} disabled={importing}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} />{importing ? "Importing…" : "Import Excel"}
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value=""; }} />
          <button onClick={() => shopifyExportRef.current?.click()} disabled={importingExport}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} />{importingExport ? "Importing…" : "Import Shopify Export"}
          </button>
          <input ref={shopifyExportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importShopifyExport(f); e.target.value=""; }} />
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>
      {syncResult && (
        <div className={`px-4 py-2 rounded-lg text-sm ${syncResult.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {syncResult}
        </div>
      )}
      {missedSkus.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 mb-2">Unmatched SKUs from Shopify export ({missedSkus.length}) — not found in Product Library:</p>
          <div className="flex flex-wrap gap-1.5">
            {missedSkus.map(sku => (
              <span key={sku} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-mono text-xs">{sku}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Status tab cards ── */}
      <div className="grid grid-cols-6 gap-3">
        {STATUS_TABS.map(tab => {
          const count  = counts[tab.key] ?? 0;
          const pct    = counts.all > 0 ? Math.round(count / counts.all * 100) : 0;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-2xl p-5 text-left border-2 transition-all duration-150 ${
                active
                  ? `${tab.card} border-2 shadow-md scale-[1.02]`
                  : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {/* Dot + label */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-3 h-3 rounded-full ${tab.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${active ? tab.subtext : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </div>
              {/* Big number */}
              <p className={`text-4xl font-black leading-none ${active ? tab.text : "text-gray-900"}`}>
                {count}
              </p>
              {/* Subtitle */}
              <p className={`text-xs mt-1.5 ${active ? tab.subtext : "text-gray-400"}`}>
                {tab.key === "all" ? "total SKUs" : `${pct}% of catalog`}
              </p>
              {/* Active indicator bar */}
              {active && (
                <div className={`h-1 rounded-full mt-3 ${tab.dot}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Secondary filters ── */}
      <div className="card p-4 space-y-3">
        {/* Search + chips row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 w-64" placeholder="Search name, SKU, color…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {catF   && <Chip label={catF}  onRemove={() => setCatF("")} />}
          {sizeF  && <Chip label={`EU ${sizeF}`} onRemove={() => setSizeF("")} color="brand" />}
          {colorF && <Chip label={colorF} onRemove={() => setColorF("")} />}
          {hasSecondaryFilters && (
            <button onClick={clearSecondary} className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2">
              Clear
            </button>
          )}
        </div>

        {/* Category pills */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={catF === ""} onClick={() => setCatF("")}>
              All ({counts[activeTab] ?? 0})
            </FilterPill>
            {CATS.filter(c => (catCounts[c] ?? 0) > 0).map(c => (
              <FilterPill key={c} active={catF === c} onClick={() => setCatF(catF === c ? "" : c)}>
                <span className="capitalize">{c}</span> ({catCounts[c]})
              </FilterPill>
            ))}
          </div>
        </div>

        {/* Size + Color */}
        <div className="flex items-start gap-8 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">EU Shoe Size</p>
            <div className="flex gap-1.5">
              <SizePill active={sizeF === ""} onClick={() => setSizeF("")}>All</SizePill>
              {SHOE_SIZES.map(sz => (
                <SizePill key={sz} active={sizeF === sz} onClick={() => setSizeF(sizeF === sz ? "" : sz)}>{sz}</SizePill>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Color</p>
            <select className="input text-sm w-44" value={colorF} onChange={e => setColorF(e.target.value)}>
              <option value="">All colors</option>
              {allColors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Product list section ── */}
      <div className="card [overflow:clip]">

        {/* Section header — clearly shows what tab is active */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${
          activeTab !== "all" ? currentTab.card : "bg-white"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full shrink-0 ${currentTab.dot}`} />
            <div>
              <h2 className={`font-bold text-lg leading-tight ${activeTab !== "all" ? currentTab.text : "text-gray-900"}`}>
                {currentTab.label}
                <span className="ml-2 text-base font-normal opacity-70">— {totalRows} SKUs</span>
              </h2>
              {hasSecondaryFilters && totalRows !== counts[activeTab] && (
                <p className="text-xs text-gray-400 mt-0.5">filtered from {counts[activeTab]} total in this group</p>
              )}
            </div>
          </div>
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                className="p-1 rounded text-gray-500 hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                className="p-1 rounded text-gray-500 hover:bg-white/60 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">
                Main SKU
              </th>
              <th className="px-4 py-3 w-12"></th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-28">Colour SKU</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">Colour</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-40">Sizes · Stock</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-28">Status</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">Inventory</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">Cost</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">Price</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">

            {/* ── Grouped view (all tabs) ── */}
            {paginatedDisplay.map(row => {
              if (row.type === "group") {
                const isOpen   = expandedGroups.has(row.groupKey);
                const totalInv = row.items.reduce((s, i) => s + (i.inventoryTotal ?? 0), 0);
                const prices   = row.items.map(i => i.sellingPrice).filter((v): v is number => v != null);
                const priceMin = prices.length ? Math.min(...prices) : null;
                const priceMax = prices.length ? Math.max(...prices) : null;
                const firstPhoto = row.items.find(i => i.shoePhotoUrl)?.shoePhotoUrl;
                const isDraftGroup = row.mainSku === null;

                return (
                  <React.Fragment key={row.groupKey}>
                    {/* Group header row */}
                    <tr
                      className={`cursor-pointer transition-colors border-b-2 ${isDraftGroup ? "bg-violet-50 hover:bg-violet-100 border-violet-200" : "bg-gray-50 hover:bg-gray-100 border-gray-200"}`}
                      onClick={() => toggleGroup(row.groupKey)}
                    >
                      <td className="px-4 py-3">
                        {isDraftGroup ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[11px] text-violet-600 bg-violet-100 px-2.5 py-1 rounded-lg border border-violet-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                            Pending SKU
                          </span>
                        ) : (
                          <span className="font-mono text-sm font-black text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                            {row.mainSku}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {firstPhoto ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                            <Image src={firstPhoto} alt={row.items[0].productName} width={64} height={64} className="object-cover w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                            <Camera size={16} className="text-gray-300" />
                          </div>
                        )}
                      </td>
                      {/* Product + colours summary spans 3 cols (Product, Colour SKU, Colour) */}
                      <td className="px-4 py-3" colSpan={3}>
                        <p className="font-bold text-gray-900 leading-tight">{row.items[0].productName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{row.items[0].category ?? "—"}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {row.items.map(it => {
                            const dot = STATUS_TABS.find(t => t.key === it.status)?.dot ?? "bg-gray-300";
                            return (
                              <span key={it.id} className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                {it.colorName || "—"}
                                {it.colorCode && <span className="font-mono text-gray-400">[{it.colorCode}]</span>}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      {/* Sizes summary */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">
                          {row.items.length} colour{row.items.length > 1 ? "s" : ""}
                        </span>
                      </td>
                      {/* Status / Create PO */}
                      <td className="px-4 py-3">
                        {row.items.some(i => i.status === "active") && (
                          <button
                            onClick={e => { e.stopPropagation(); createDraftPO(row.groupKey, row.items, row.mainSku); }}
                            disabled={creatingPO === row.groupKey}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            <ShoppingCart size={11} />
                            {creatingPO === row.groupKey ? "Creating…" : "Create PO"}
                          </button>
                        )}
                      </td>
                      {/* Total inventory */}
                      <td className="px-4 py-3 text-right">
                        <p className={`text-sm font-bold ${totalInv === 0 ? "text-gray-400" : totalInv <= 10 ? "text-amber-600" : "text-gray-900"}`}>
                          {totalInv}
                        </p>
                        <p className="text-[10px] text-gray-400">total</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-300">—</td>
                      {/* Price range */}
                      <td className="px-4 py-3 text-right">
                        {priceMin != null ? (
                          <p className="text-sm font-bold text-brand-700">
                            {priceMin === priceMax ? `RM ${priceMin}` : `RM ${priceMin}–${priceMax}`}
                          </p>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* Expand/collapse + group edit */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={e => openGroupEdit(row.items, e)}
                            title="Edit all colours"
                            className="p-1.5 text-gray-400 hover:text-brand-600 rounded transition-colors">
                            <Pencil size={13}/>
                          </button>
                          {isOpen
                            ? <ChevronUp size={15} className="text-gray-500" />
                            : <ChevronDown size={15} className="text-gray-500" />}
                        </div>
                      </td>
                    </tr>

                    {/* Colour sub-rows (when expanded) */}
                    {isOpen && row.items.map(item => {
                      const sizes      = parseSizes(item.availableSizes);
                      const sizeInv    = parseSizeInv(item.sizeInventory);
                      const margin     = item.costRm && item.sellingPrice
                        ? Math.round(((item.sellingPrice - item.costRm) / item.sellingPrice) * 100) : null;
                      const isDetail   = expanded === item.id;

                      return (
                        <React.Fragment key={item.id}>
                          <tr className="bg-white hover:bg-brand-50/30 transition-colors border-l-4 border-brand-300 cursor-pointer"
                            onClick={() => setExpanded(isDetail ? null : item.id)}>
                            {/* Ref indented */}
                            <td className="pl-8 pr-4 py-2.5 font-mono text-[10px] text-gray-400">{item.libNumber}</td>
                            {/* Photo */}
                            <td className="px-2 py-2">
                              {item.shoePhotoUrl ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                  <Image src={item.shoePhotoUrl} alt={item.colorName ?? ""} width={48} height={48} className="object-cover w-full h-full" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                  <Camera size={12} className="text-gray-300" />
                                </div>
                              )}
                            </td>
                            {/* Colour name */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_TABS.find(t=>t.key===item.status)?.dot ?? "bg-gray-200"}`} />
                                <span className="font-medium text-gray-800 text-sm">{item.colorName || "—"}</span>
                              </div>
                            </td>
                            {/* Colour SKU */}
                            <td className="px-4 py-2.5">
                              {item.h2uSku
                                ? <span className="font-mono text-[11px] text-brand-700 font-bold bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">{item.h2uSku}</span>
                                : item.status === "draft"
                                  ? <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">+ Assign SKU</span>
                                  : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            {/* Status badge */}
                            <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                            {/* Size inventory */}
                            <td className="px-4 py-2.5">
                              {sizes.length > 0 ? (
                                <div className="flex flex-wrap gap-0.5">
                                  {sizes.map(sz => {
                                    const qty = sizeInv[sz] ?? 0;
                                    return (
                                      <span key={sz} title={`EU ${sz}: ${qty} units`}
                                        className={`inline-flex flex-col items-center px-1 py-0.5 rounded text-[9px] font-bold leading-tight ${
                                          qty === 0   ? "bg-gray-100 text-gray-300"
                                          : qty <= 3  ? "bg-red-100 text-red-600"
                                          : qty <= 10 ? "bg-amber-100 text-amber-700"
                                          : "bg-teal-100 text-teal-700"
                                        }`}>
                                        <span>{sz}</span><span>{qty}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            {/* Inventory */}
                            <td className="px-4 py-2.5 text-right">
                              {item.inventoryTotal != null ? (
                                <p className={`text-sm font-bold ${
                                  item.inventoryTotal === 0 ? "text-gray-400"
                                  : item.inventoryTotal <= 10 ? "text-amber-600"
                                  : "text-gray-900"
                                }`}>{item.inventoryTotal}</p>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            {/* Cost */}
                            <td className="px-4 py-2.5 text-right text-xs text-gray-600">
                              {item.costRm ? `RM ${item.costRm.toFixed(2)}` : <span className="text-gray-300">—</span>}
                            </td>
                            {/* Price */}
                            <td className="px-4 py-2.5 text-right">
                              {item.sellingPrice ? (
                                <div>
                                  <p className="text-sm font-bold text-brand-700">RM {item.sellingPrice.toFixed(0)}</p>
                                  {margin != null && (
                                    <p className={`text-[10px] font-medium ${margin >= 40 ? "text-teal-600" : margin >= 25 ? "text-amber-600" : "text-red-500"}`}>{margin}%</p>
                                  )}
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5 justify-end">
                                <button onClick={() => setExpanded(isDetail ? null : item.id)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
                                  {isDetail ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                                </button>
                                <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded transition-colors">
                                  <Pencil size={13}/>
                                </button>
                                <button onClick={() => del(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors">
                                  <Trash2 size={13}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* Detail panel for this colour */}
                          {isDetail && <ItemDetailRow item={item} colSpan={11} onEdit={openEdit} onAssignSku={openAssignSku} />}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              }

              // Single item (no mainSku) — flat row
              const item       = row.item;
              const sizes      = parseSizes(item.availableSizes);
              const sizeInv    = parseSizeInv(item.sizeInventory);
              const margin     = item.costRm && item.sellingPrice
                ? Math.round(((item.sellingPrice - item.costRm) / item.sellingPrice) * 100) : null;
              const isExpanded = expanded === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400">{item.libNumber}</td>
                    <td className="px-2 py-2">
                      {item.shoePhotoUrl ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                          <Image src={item.shoePhotoUrl} alt={item.productName} width={64} height={64} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                          <Camera size={16} className="text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 leading-tight">{item.productName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{item.category ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {item.h2uSku
                        ? <span className="font-mono text-[11px] text-brand-700 font-bold bg-brand-50 px-1.5 py-0.5 rounded">{item.h2uSku}</span>
                        : item.status === "draft"
                          ? <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">+ Assign SKU</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[96px] truncate">{item.colorName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {sizes.map(sz => {
                            const qty = sizeInv[sz] ?? 0;
                            return (
                              <span key={sz} title={`EU ${sz}: ${qty} units`}
                                className={`inline-flex flex-col items-center px-1 py-0.5 rounded text-[9px] font-bold leading-tight ${
                                  qty === 0   ? "bg-gray-100 text-gray-300"
                                  : qty <= 3  ? "bg-red-100 text-red-600"
                                  : qty <= 10 ? "bg-amber-100 text-amber-700"
                                  : "bg-teal-100 text-teal-700"
                                }`}>
                                <span>{sz}</span><span>{qty}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {item.inventoryTotal != null ? (
                        <div>
                          <p className={`text-sm font-bold ${item.inventoryTotal === 0 ? "text-gray-400" : item.inventoryTotal <= 10 ? "text-amber-600" : "text-gray-900"}`}>{item.inventoryTotal}</p>
                          {(item.warehouseQty ?? 0) > 0 && <p className="text-[10px] text-gray-400">{item.warehouseQty} wh</p>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">
                      {item.costRm ? `RM ${item.costRm.toFixed(2)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.sellingPrice ? (
                        <div>
                          <p className="text-sm font-bold text-brand-700">RM {item.sellingPrice.toFixed(0)}</p>
                          {margin != null && <p className={`text-[10px] font-medium ${margin >= 40 ? "text-teal-600" : margin >= 25 ? "text-amber-600" : "text-red-500"}`}>{margin}% margin</p>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => setExpanded(isExpanded ? null : item.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
                          {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        </button>
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-brand-600 rounded transition-colors"><Pencil size={13}/></button>
                        <button onClick={() => del(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && <ItemDetailRow item={item} colSpan={11} onEdit={openEdit} onAssignSku={openAssignSku} />}
                </React.Fragment>
              );
            })}

            {/* Empty state */}
            {paginatedDisplay.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center">
                  <BookOpen size={32} className="mx-auto mb-3 text-gray-300"/>
                  <p className="font-medium text-gray-600">No products match</p>
                  {hasSecondaryFilters && (
                    <button onClick={clearSecondary} className="text-sm text-brand-600 hover:underline mt-1">Clear filters</button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-xs text-gray-500">
              {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, totalRows)} of {totalRows}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={14}/>
              </button>
              {Array.from({length: Math.min(totalPages,7)},(_,i)=>{
                let p: number;
                if (totalPages<=7) p=i+1;
                else if (page<=4) p=i+1;
                else if (page>=totalPages-3) p=totalPages-6+i;
                else p=page-3+i;
                return (
                  <button key={p} onClick={()=>setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${p===page?"bg-gray-900 text-white":"text-gray-600 hover:bg-gray-200"}`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Group Edit Modal ── */}
      {groupModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Group — {groupItems.length} colours</h2>
              <button onClick={() => setGroupModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>

            {/* Shared fields */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="label">Product Name *</label>
                <input className="input" value={groupForm.productName}
                  onChange={e => setGroupForm(f => ({ ...f, productName: e.target.value }))} />
              </div>
              <div>
                <label className="label">Main SKU <span className="text-gray-400 font-normal text-xs">(shared across all colours)</span></label>
                <input className="input font-mono" placeholder="e.g. S1800"
                  value={groupForm.mainSku}
                  onChange={e => setGroupForm(f => ({ ...f, mainSku: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Category</label>
                  <select className="input text-sm" value={groupForm.category}
                    onChange={e => setGroupForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">—</option>
                    {CATS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Brand</label>
                  <input className="input text-sm" value={groupForm.brand}
                    onChange={e => setGroupForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label className="label text-xs">Season</label>
                  <input className="input text-sm" placeholder="SS2026" value={groupForm.season}
                    onChange={e => setGroupForm(f => ({ ...f, season: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Per-colour rows */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Colours, Codes &amp; Photos</p>
              <div className="space-y-3">
                {groupColours.map((gc, i) => {
                  const preview = groupForm.mainSku && gc.colorCode ? groupForm.mainSku + gc.colorCode : null;
                  const ANGLE_PHOTOS: [keyof typeof gc, string][] = [
                    ["shoePhotoUrl", "Main"],
                    ["photoSideUrl", "Side"],
                    ["photoUpperUrl", "Upper"],
                    ["photoDesignUrl", "Design"],
                  ];
                  return (
                    <div key={gc.id || `new-${i}`} className="bg-gray-50 rounded-xl px-3 py-3 space-y-3">
                      {/* Colour name + code row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                        <input className="input text-sm flex-1" placeholder="Colour name"
                          value={gc.colorName}
                          onChange={e => setGroupColours(prev => prev.map((c, j) => j === i ? { ...c, colorName: e.target.value } : c))} />
                        <input className="input text-sm w-20 font-mono text-center" placeholder="Code"
                          value={gc.colorCode}
                          onChange={e => setGroupColours(prev => prev.map((c, j) => j === i ? { ...c, colorCode: e.target.value.toUpperCase() } : c))} />
                        {preview && (
                          <span className="font-mono text-xs text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded shrink-0">
                            {preview}
                          </span>
                        )}
                        {gc.isNew && (
                          <button
                            onClick={() => setGroupColours(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600 ml-1 shrink-0"
                            title="Remove this colour"
                          ><X size={14} /></button>
                        )}
                      </div>
                      {/* Photo uploads per colour */}
                      <div className="flex gap-2 pl-6">
                        {ANGLE_PHOTOS.map(([field, label]) => (
                          <div key={field} className="flex flex-col items-center gap-1">
                            <div
                              onClick={() => { setPendingGroupUpload({ idx: i, field: field as string }); groupPhotoInputRef.current?.click(); }}
                              className="relative w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 bg-white hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer overflow-hidden flex items-center justify-center"
                            >
                              {gc[field] ? (
                                <>
                                  <Image src={gc[field] as string} alt={label} fill className="object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-[9px] font-medium">Change</span>
                                  </div>
                                </>
                              ) : (
                                <Camera size={14} className="text-gray-300" />
                              )}
                            </div>
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                            {gc[field] && (
                              <button
                                onClick={() => setGroupColours(prev => prev.map((c, j) => j === i ? { ...c, [field]: "" } : c))}
                                className="text-[9px] text-red-400 hover:text-red-600 leading-none">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Add new colour */}
              <button
                onClick={() => setGroupColours(prev => [...prev, { id: "", colorName: "", colorCode: "", shoePhotoUrl: "", photoSideUrl: "", photoUpperUrl: "", photoDesignUrl: "", isNew: true }])}
                className="w-full mt-2 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                <Plus size={14} /> Add Colour
              </button>
              <input ref={groupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhotoChange} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setGroupModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveGroup} disabled={savingGroup} className="btn-primary flex-1">
                {savingGroup ? "Saving…" : "Save All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Product Name *</label><input className="input" value={form.productName} onChange={e=>setF("productName",e.target.value)}/></div>

                {/* SKU breakdown */}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">SKU Structure</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Main SKU <span className="text-gray-400 font-normal">(style, shared across colours)</span></label>
                        <input className="input font-mono" value={(form as any).mainSku} onChange={e=>setF("mainSku",e.target.value.toUpperCase())} placeholder="S1800"/>
                      </div>
                      <div>
                        <label className="label text-xs">Colour Code <span className="text-gray-400 font-normal">(letter appended after main SKU)</span></label>
                        <input className="input font-mono" value={form.colorCode} onChange={e=>setF("colorCode",e.target.value.toUpperCase())} placeholder="H"/>
                      </div>
                    </div>
                    {/* Live preview */}
                    {((form as any).mainSku || form.colorCode) && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200">
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Colour SKU</span>
                          <span className="font-mono text-sm font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded-lg border border-brand-200">
                            {(form as any).mainSku}{form.colorCode || "?"}
                          </span>
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Per-size SKUs (preview)</span>
                          <div className="flex flex-wrap gap-1">
                            {SHOE_SIZES.map(sz => (
                              <span key={sz} className="font-mono text-[11px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                                {(form as any).mainSku}{form.colorCode || "?"}{sz}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div><label className="label">Supplier SKU</label><input className="input" value={form.supplierSku} onChange={e=>setF("supplierSku",e.target.value)}/></div>
                <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={e=>setF("brand",e.target.value)}/></div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e=>setF("category",e.target.value)}>
                    {CATS.map(c=><option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Colour Name</label><input className="input" value={form.colorName} onChange={e=>setF("colorName",e.target.value)} placeholder="Black"/></div>
                <div><label className="label">Season</label><input className="input" value={form.season} onChange={e=>setF("season",e.target.value)} placeholder="SS2026"/></div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={(form as any).status ?? ""} onChange={e=>setF("status",e.target.value)}>
                    <option value="draft">Draft (Pending SKU)</option>
                    <option value="active">Active</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="clearance">Clearance</option>
                  </select>
                </div>
                <div>
                  <label className="label">Manufacturer</label>
                  <select className="input" value={(form as any).manufacturerId??""} onChange={e=>setF("manufacturerId",e.target.value)}>
                    <option value="">None</option>
                    {mfrs.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Material Specs</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["materialUpper","Upper","materialUpperPhoto"],
                    ["materialLining","Lining","materialLiningPhoto"],
                    ["materialMidsole","Midsole","materialMidsolePhoto"],
                    ["materialOutsole","Outsole","materialOutsolePhoto"],
                    ["hardware","Hardware","hardwarePhoto"],
                    ["heelSpec","Heel","heelSpecPhoto"],
                    ["platformSpec","Platform","platformSpecPhoto"],
                    ["logoSpec","Logo","logoSpecPhoto"],
                  ] as [string,string,string][]).map(([k,l,photoKey])=>(
                    <div key={k}>
                      <label className="label text-xs">{l}</label>
                      <input className="input text-sm" value={(form as any)[k]} onChange={e=>setF(k,e.target.value)}/>
                      <div className="mt-1 flex items-center gap-2">
                        {(form as any)[photoKey] ? (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                            <Image src={(form as any)[photoKey]} alt={l} fill className="object-cover"/>
                            <button
                              onClick={() => setF(photoKey, "")}
                              className="absolute top-0 right-0 bg-black/50 text-white text-[8px] px-0.5 leading-tight"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => triggerPhotoUpload(photoKey)}
                            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-600 border border-dashed border-gray-200 rounded-lg px-2 py-1 hover:border-brand-400 transition-colors"
                          >
                            {uploadingPhoto === photoKey ? "Uploading…" : <><Camera size={10}/> Add photo</>}
                          </button>
                        )}
                        {(form as any)[photoKey] && (
                          <button
                            onClick={() => triggerPhotoUpload(photoKey)}
                            className="text-[10px] text-gray-400 hover:text-brand-600"
                          >Change</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cost &amp; Pricing</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["costRmb","Cost (¥ RMB)"],["costRm","Cost (RM)"],["sellingPrice","Selling (RM)"]].map(([k,l])=>(
                    <div key={k}><label className="label text-xs">{l}</label><input className="input text-sm" type="number" step="0.01" value={(form as any)[k]} onChange={e=>setF(k,e.target.value)}/></div>
                  ))}
                </div>
              </div>
              {/* Photos */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Photos</p>
                {/* Shoe angle photos */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {([
                    ["shoePhotoUrl", "Main"],
                    ["photoSideUrl", "Side"],
                    ["photoDesignUrl", "Design View"],
                  ] as [string, string][]).map(([field, label]) => (
                    <div key={field} className="flex flex-col items-center gap-1">
                      <div
                        onClick={() => triggerPhotoUpload(field)}
                        className="relative w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer overflow-hidden flex items-center justify-center"
                      >
                        {(form as any)[field] ? (
                          <>
                            <Image src={(form as any)[field]} alt={label} fill className="object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-[10px] font-medium">Change</span>
                            </div>
                          </>
                        ) : uploadingPhoto === field ? (
                          <p className="text-[10px] text-gray-400">Uploading…</p>
                        ) : (
                          <Camera size={16} className="text-gray-300" />
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                      {(form as any)[field] && (
                        <button onClick={() => setF(field, "")} className="text-[9px] text-red-400 hover:text-red-600">Remove</button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Box photo */}
                {(() => {
                  const customBox   = (form as any).boxPhotoUrl as string;
                  const vendorBox   = form.brand ? vendorBoxMap[form.brand] ?? "" : "";
                  const displayBox  = customBox || vendorBox;
                  const isVendorDef = !customBox && !!vendorBox;
                  return (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          onClick={() => triggerPhotoUpload("boxPhotoUrl")}
                          className="relative w-24 aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer overflow-hidden flex items-center justify-center"
                        >
                          {displayBox ? (
                            <>
                              <Image src={displayBox} alt="Box" fill className="object-contain p-1" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-[10px] font-medium">{isVendorDef ? "Upload Custom" : "Change"}</span>
                              </div>
                            </>
                          ) : uploadingPhoto === "boxPhotoUrl" ? (
                            <p className="text-[10px] text-gray-400">Uploading…</p>
                          ) : (
                            <Box size={16} className="text-gray-300" />
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Box</span>
                        {isVendorDef && (
                          <span className="text-[9px] text-blue-400">{form.brand} default</span>
                        )}
                        {customBox && (
                          <button onClick={() => setF("boxPhotoUrl", "")} className="text-[9px] text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <input ref={singlePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSinglePhotoChange} />
              </div>
              <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>setF("notes",e.target.value)}/></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving?"Saving…":editId?"Save Changes":"Add to Library"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PO History types ──────────────────────────────────────────────────────────
type POHistoryItem = { h2uSku: string | null; colorName: string | null; colorCode: string | null; totalPairs: number; discountPrice: number | null };
type POHistoryEntry = {
  id: string; poNumber: string; date: string; status: string; poType: string | null;
  manufacturer: { id: string; name: string } | null;
  totalPairs: number; totalValue: number;
  items: POHistoryItem[];
};

const PO_STATUS_STYLE: Record<string, string> = {
  draft:         "bg-gray-100 text-gray-600",
  submitted:     "bg-blue-50 text-blue-700",
  in_production: "bg-amber-50 text-amber-700",
  shipped:       "bg-teal-50 text-teal-700",
  closed:        "bg-green-50 text-green-700",
};
const PO_TYPE_LABEL: Record<string, string> = {
  test: "Test", reorder: "Reorder", replen: "Replen", clear: "Clearance",
};

// ── Item detail panel (shared by both grouped and flat views) ─────────────────
function ItemDetailRow({ item, colSpan, onEdit, onAssignSku }: { item: PLItem; colSpan: number; onEdit: (item: PLItem) => void; onAssignSku?: (item: PLItem) => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "po-history">("overview");
  const [poHistory, setPoHistory] = useState<POHistoryEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (activeTab === "po-history" && poHistory === null) {
      setLoadingHistory(true);
      fetch(`/api/product-library/${item.id}/po-history`)
        .then(r => r.json())
        .then(data => { setPoHistory(Array.isArray(data) ? data : []); setLoadingHistory(false); })
        .catch(() => { setPoHistory([]); setLoadingHistory(false); });
    }
  }, [activeTab, item.id, poHistory]);

  const sizes   = parseSizes(item.availableSizes);
  const sizeInv = parseSizeInv(item.sizeInventory);
  const margin  = item.costRm && item.sellingPrice
    ? Math.round(((item.sellingPrice - item.costRm) / item.sellingPrice) * 100) : null;

  const totalHistoryPairs = poHistory?.reduce((s, p) => s + p.totalPairs, 0) ?? 0;

  return (
    <tr className="bg-slate-50/60">
      <td colSpan={colSpan} className="px-4 py-4">
        {item.status === "draft" && (
          <div className="mb-3 flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-violet-800">Pending SKU assignment</p>
              <p className="text-[11px] text-violet-500 mt-0.5">
                From sample <span className="font-mono font-bold">{item.sampleOrder?.orderNumber ?? item.sampleOrderId}</span>. Click <strong>Assign SKU</strong> to enter the official H2U SKU and set status to Active.
              </p>
            </div>
            <button onClick={() => (onAssignSku ?? onEdit)(item)} className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
              Assign SKU
            </button>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {(["overview", "po-history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-brand-600 text-brand-700 bg-white"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab === "overview" ? "Overview" : "Purchase History"}
              {tab === "po-history" && poHistory !== null && poHistory.length > 0 && (
                <span className="ml-1.5 bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {poHistory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-4 gap-3 text-xs">
            {(item.shoePhotoUrl || item.boxPhotoUrl) && (
              <div className="col-span-4 flex gap-3 mb-1">
                {item.shoePhotoUrl && (
                  <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Shoe Photo</p>
                    <Image src={item.shoePhotoUrl} alt="Shoe" width={160} height={120} className="rounded-lg object-cover h-28 w-40" />
                  </div>
                )}
                {item.boxPhotoUrl && (
                  <div className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Box Photo</p>
                    <Image src={item.boxPhotoUrl} alt="Box" width={160} height={120} className="rounded-lg object-cover h-28 w-40" />
                  </div>
                )}
              </div>
            )}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Size inventory &amp; SKUs</p>
              {sizes.length > 0 ? (
                <div className="space-y-1.5">
                  {sizes.map(sz => {
                    const qty = sizeInv[sz] ?? 0;
                    const pct = item.inventoryTotal ? Math.round(qty / item.inventoryTotal * 100) : 0;
                    const detailSku = item.h2uSku ? `${item.h2uSku}${sz}` : null;
                    return (
                      <div key={sz} className="flex items-center gap-2">
                        <span className="w-7 text-[11px] font-bold text-gray-500 shrink-0">EU {sz}</span>
                        {detailSku && <span className="font-mono text-[10px] text-gray-400 bg-gray-50 px-1 rounded shrink-0">{detailSku}</span>}
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${qty === 0 ? "bg-gray-200" : qty <= 3 ? "bg-red-400" : qty <= 10 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[11px] font-bold w-5 text-right shrink-0 ${qty === 0 ? "text-gray-300" : qty <= 3 ? "text-red-600" : qty <= 10 ? "text-amber-600" : "text-teal-700"}`}>{qty}</span>
                      </div>
                    );
                  })}
                </div>
              ) : item.h2uSku ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-600 font-medium">Pending Shopify sync</p>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1.5">Per-size SKUs ready:</p>
                  <div className="flex flex-wrap gap-1">
                    {["36","37","38","39","40","41","42"].map(sz => (
                      <span key={sz} className="font-mono text-[10px] bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500">{item.h2uSku}{sz}</span>
                    ))}
                  </div>
                </div>
              ) : <p className="text-gray-300">—</p>}
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Inventory</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">All locations</span><span className="font-bold text-gray-900">{item.inventoryTotal ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">H2U Warehouse</span><span className="font-semibold text-gray-900">{item.warehouseQty ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Shopify type</span><span className="text-gray-600">{item.productType ?? "—"}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pricing</p>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Selling price</span><span className="font-bold text-gray-900">{item.sellingPrice ? `RM ${item.sellingPrice.toFixed(2)}` : "—"}</span></div>
                {item.compareAtPrice && item.compareAtPrice > (item.sellingPrice ?? 0) && (
                  <div className="flex justify-between"><span className="text-gray-500">Was</span><span className="text-gray-400 line-through">RM {item.compareAtPrice.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-500">Cost (RM)</span><span className="text-gray-700">{item.costRm ? `RM ${item.costRm.toFixed(2)}` : "—"}</span></div>
                {margin != null && (
                  <div className="flex justify-between pt-1 border-t border-gray-100">
                    <span className="text-gray-500">Gross margin</span>
                    <span className={`font-bold ${margin >= 40 ? "text-teal-700" : margin >= 25 ? "text-amber-600" : "text-red-600"}`}>{margin}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Material specs</p>
              {[["Upper",item.materialUpper],["Lining",item.materialLining],["Outsole",item.materialOutsole],["Heel",item.heelSpec]].some(([,v])=>v)
                ? <div className="space-y-1">
                    {[["Upper",item.materialUpper],["Lining",item.materialLining],["Midsole",item.materialMidsole],["Outsole",item.materialOutsole],["Hardware",item.hardware],["Heel",item.heelSpec]].filter(([,v])=>v).map(([k,v])=>(
                      <div key={k as string} className="flex justify-between gap-2">
                        <span className="text-gray-400 shrink-0">{k}</span>
                        <span className="text-gray-700 text-right truncate">{v as string}</span>
                      </div>
                    ))}
                  </div>
                : <p className="text-gray-300 text-xs">No specs yet</p>}
            </div>
          </div>
        )}

        {/* ── Purchase History tab ── */}
        {activeTab === "po-history" && (
          <div>
            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading purchase history…</div>
            ) : !poHistory || poHistory.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-gray-500">No purchase orders found for this SKU</p>
                <p className="text-xs text-gray-400 mt-1">POs will appear here once created from this product.</p>
              </div>
            ) : (
              <div>
                {/* Summary bar */}
                <div className="flex items-center gap-6 mb-4 bg-white rounded-xl border border-gray-100 px-4 py-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total POs</p>
                    <p className="text-xl font-black text-gray-900 leading-tight">{poHistory.length}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Pairs Ordered</p>
                    <p className="text-xl font-black text-brand-700 leading-tight">{totalHistoryPairs.toLocaleString()}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Latest Order</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">
                      {new Date(poHistory[0].date).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* PO list */}
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {poHistory.map((po, idx) => (
                    <div key={po.id}>
                      <a href={`/dashboard/purchase-orders?open=${po.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        {/* PO number + latest badge */}
                        <div className="w-36 shrink-0">
                          <span className="font-mono font-bold text-brand-700 text-xs">{po.poNumber}</span>
                          {idx === 0 && <span className="ml-1.5 text-[9px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full uppercase">Latest</span>}
                        </div>
                        {/* Date */}
                        <div className="w-24 shrink-0 text-xs text-gray-500">
                          {new Date(po.date).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        {/* Supplier */}
                        <div className="flex-1 text-xs text-gray-700 truncate">{po.manufacturer?.name ?? "—"}</div>
                        {/* Type */}
                        <div className="w-20 shrink-0">
                          {po.poType
                            ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize">{PO_TYPE_LABEL[po.poType] ?? po.poType}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </div>
                        {/* Status */}
                        <div className="w-20 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${PO_STATUS_STYLE[po.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {po.status.replace("_", " ")}
                          </span>
                        </div>
                        {/* Pairs */}
                        <div className="w-12 shrink-0 text-right text-xs font-bold text-gray-900">
                          {po.totalPairs > 0 ? po.totalPairs.toLocaleString() : "—"}
                        </div>
                        {/* Value */}
                        <div className="w-20 shrink-0 text-right text-xs text-gray-600">
                          {po.totalValue > 0 ? `¥${po.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                        </div>
                        {/* Arrow */}
                        <div className="w-4 shrink-0 text-gray-300 text-xs">›</div>
                      </a>

                      {/* Per-colour breakdown */}
                      {po.items.length > 0 && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2">
                          {po.items
                            .filter(it => it.totalPairs > 0)
                            .map((it, ii) => (
                              <div key={ii} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                                {it.colorCode && (
                                  <span className="text-[10px] font-mono font-semibold text-gray-500 bg-white border border-gray-200 px-1 rounded">{it.colorCode}</span>
                                )}
                                <span className="text-[11px] font-medium text-gray-700">{it.colorName ?? it.h2uSku ?? "—"}</span>
                                <span className="text-[11px] font-bold text-brand-700">{it.totalPairs} pairs</span>
                                {it.discountPrice && (
                                  <span className="text-[10px] text-gray-400">¥{it.discountPrice}</span>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {item.notes && activeTab === "overview" && <p className="mt-2 text-xs text-gray-500 italic px-1">{item.notes}</p>}
      </td>
    </tr>
  );
}

// ── Small shared components ────────────────────────────────────────────────────
function Chip({ label, onRemove, color="gray" }: { label: string; onRemove: ()=>void; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color==="brand" ? "bg-brand-600 text-white" : "bg-gray-800 text-white"}`}>
      {label}
      <button onClick={onRemove} className="opacity-70 hover:opacity-100"><X size={11}/></button>
    </span>
  );
}
function FilterPill({ active, onClick, children }: { active: boolean; onClick: ()=>void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
      }`}>
      {children}
    </button>
  );
}
function SizePill({ active, onClick, children }: { active: boolean; onClick: ()=>void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`w-10 h-8 rounded-lg text-xs font-bold border transition-colors ${
        active
          ? "bg-brand-600 text-white border-brand-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:border-brand-400 hover:text-brand-600"
      }`}>
      {children}
    </button>
  );
}
