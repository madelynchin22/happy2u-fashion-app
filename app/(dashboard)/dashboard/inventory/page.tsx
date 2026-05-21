"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, RefreshCw, Search, CheckCircle, AlertCircle, DownloadCloud } from "lucide-react";

const SIZES = [35, 36, 37, 38, 39, 40, 41, 42];

type Outlet = { id: string; name: string; marking: string; country: string };

type RawRow = {
  id: string;
  productLibrary: {
    id: string; productName: string; h2uSku: string | null;
    mainSku: string | null; colorCode: string | null;
    supplierSku: string | null; category: string | null; colorName: string | null;
    status: string | null;
  };
  outlet: Outlet;
  qty35: number; qty36: number; qty37: number; qty38: number;
  qty39: number; qty40: number; qty41: number; qty42: number;
  totalQty: number;
  uploadedAt: string;
};

type ColorRow = {
  h2uSku: string;
  colorName: string | null;
  colorCode: string | null;
  qty35: number; qty36: number; qty37: number; qty38: number;
  qty39: number; qty40: number; qty41: number; qty42: number;
  totalQty: number;
};

type ProductGroup = {
  mainSku: string;
  productName: string;
  status: string;
  colors: ColorRow[];
};

const STATUS_ORDER: Record<string, number> = { active: 0, clearance: 1, archived: 2 };
const STATUS_LABEL: Record<string, string> = { active: "Active", clearance: "Clearance", archived: "Archived" };
const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  clearance: "bg-orange-50 text-orange-700 border-orange-200",
  archived:  "bg-gray-100 text-gray-500 border-gray-200",
};
const SECTION_STYLE: Record<string, string> = {
  active:    "bg-green-50 text-green-800 border-green-200",
  clearance: "bg-orange-50 text-orange-800 border-orange-200",
  archived:  "bg-gray-50 text-gray-600 border-gray-200",
};

type UnmatchedRow = { row: number; sku: string; location: string; reason: string };
type PreviewPayload = { matched: number; unmatched: UnmatchedRow[]; preview: any[] };

function buildGroups(rows: RawRow[]): ProductGroup[] {
  const groupMap = new Map<string, { productName: string; status: string; colorMap: Map<string, ColorRow> }>();

  for (const row of rows) {
    const mainSku = row.productLibrary.mainSku ?? row.productLibrary.h2uSku ?? "?";
    if (!groupMap.has(mainSku)) {
      groupMap.set(mainSku, {
        productName: row.productLibrary.productName,
        status: row.productLibrary.status ?? "active",
        colorMap: new Map(),
      });
    }
    const g = groupMap.get(mainSku)!;
    const colorKey = row.productLibrary.h2uSku ?? row.productLibrary.colorCode ?? "?";
    if (!g.colorMap.has(colorKey)) {
      g.colorMap.set(colorKey, {
        h2uSku: colorKey,
        colorName: row.productLibrary.colorName,
        colorCode: row.productLibrary.colorCode,
        qty35: 0, qty36: 0, qty37: 0, qty38: 0,
        qty39: 0, qty40: 0, qty41: 0, qty42: 0,
        totalQty: 0,
      });
    }
    const c = g.colorMap.get(colorKey)!;
    SIZES.forEach(s => { (c as any)[`qty${s}`] += (row as any)[`qty${s}`]; });
    c.totalQty += row.totalQty;
  }

  return Array.from(groupMap.entries())
    .map(([mainSku, g]) => ({
      mainSku,
      productName: g.productName,
      status: g.status,
      colors: Array.from(g.colorMap.values()).sort((a, b) =>
        (a.colorCode ?? "").localeCompare(b.colorCode ?? "")
      ),
    }))
    .sort((a, b) => {
      const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (so !== 0) return so;
      return a.mainSku.localeCompare(b.mainSku);
    });
}

export default function InventoryPage() {
  const [tab, setTab] = useState<"view" | "upload">("view");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOutletName, setSelectedOutletName] = useState("");
  const outletTabsRef = useRef<HTMLDivElement>(null);

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committed, setCommitted] = useState<{ saved: number; unmatched: UnmatchedRow[] } | null>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetch("/api/outlets").then(r => r.json()).then((data: Outlet[]) => {
      setOutlets(data.sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  async function loadInventory() {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedOutlet) params.set("outletId", selectedOutlet);
    if (search) params.set("search", search);
    const data: RawRow[] = await fetch(`/api/inventory?${params}`).then(r => r.json());
    setGroups(buildGroups(Array.isArray(data) ? data : []));
    const outlet = outlets.find(o => o.id === selectedOutlet);
    setSelectedOutletName(outlet?.name ?? "");
    setLoading(false);
  }

  useEffect(() => { if (tab === "view") loadInventory(); }, [tab, selectedOutlet]);

  async function handlePreview() {
    if (!file) return;
    setUploading(true); setPreview(null); setUploadError("");
    const fd = new FormData(); fd.append("file", file); fd.append("commit", "false");
    try {
      const res = await fetch("/api/inventory/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setUploadError(json.error ?? "Upload failed"); else setPreview(json);
    } catch { setUploadError("Network error"); }
    setUploading(false);
  }

  async function handleCommit() {
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("commit", "true");
    try {
      const res = await fetch("/api/inventory/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setUploadError(json.error ?? "Commit failed");
      else { setCommitted(json); setPreview(null); }
    } catch { setUploadError("Network error"); }
    setUploading(false);
  }

  function resetUpload() {
    setFile(null); setPreview(null); setCommitted(null); setUploadError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const header = ["SKU", "Location", ...SIZES.map(s => `Size ${s}`), "Notes"];
    const example = ["S1800H", "Johor Outlet", 0, 5, 4, 3, 2, 1, 0, 0, ""];
    const csv = [header, example].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "inventory_template.csv"; a.click();
  }

  const totalPairs = groups.reduce((sum, g) => sum + g.colors.reduce((s, c) => s + c.totalQty, 0), 0);

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory by Location</h1>
          <p className="text-sm text-gray-500 mt-0.5">Per-outlet stock levels across all products</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(["view", "upload"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); resetUpload(); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}>
            {t === "view" ? "View Inventory" : "Upload Excel"}
          </button>
        ))}
      </div>

      {/* ── VIEW ── */}
      {tab === "view" && (
        <div>
          {/* Outlet tab bar */}
          <div className="mb-4">
            <div
              ref={outletTabsRef}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: "none" }}
            >
              {/* All Locations pill */}
              <button
                onClick={() => setSelectedOutlet("")}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  selectedOutlet === ""
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-700"
                }`}
              >
                All Locations
              </button>
              {outlets.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOutlet(o.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${
                    selectedOutlet === o.id
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-700"
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search + stats bar */}
          <div className="flex gap-3 mb-4 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadInventory()}
                placeholder="Search SKU or product..."
                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <button onClick={loadInventory}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <RefreshCw size={14} /> Refresh
            </button>
            {!loading && groups.length > 0 && (
              <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
                <span><span className="font-semibold text-gray-800">{groups.length}</span> styles</span>
                <span><span className="font-semibold text-gray-800">{groups.reduce((s,g)=>s+g.colors.length,0)}</span> colours</span>
                <span><span className="font-semibold text-gray-800">{totalPairs.toLocaleString()}</span> pairs</span>
              </div>
            )}
          </div>

          {/* Active outlet label */}
          {selectedOutletName && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-gray-500">Showing stock at</span>
              <span className="px-3 py-0.5 bg-brand-50 text-brand-700 rounded-full text-sm font-semibold border border-brand-100">{selectedOutletName}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-base font-medium">No inventory records</p>
              <p className="text-sm mt-1">Upload an Excel file to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Main SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Colour</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">H2U SKU</th>
                    {SIZES.map(s => (
                      <th key={s} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">{s}</th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {(() => {
                    const rows: React.ReactNode[] = [];
                    let lastStatus = "";
                    groups.forEach((group) => {
                      // Section header when status changes
                      if (group.status !== lastStatus) {
                        lastStatus = group.status;
                        const colCount = 4 + SIZES.length + 1;
                        rows.push(
                          <tr key={`section-${group.status}`}>
                            <td colSpan={colCount} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-y ${SECTION_STYLE[group.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {STATUS_LABEL[group.status] ?? group.status} — {groups.filter(g => g.status === group.status).length} styles
                            </td>
                          </tr>
                        );
                      }

                      group.colors.forEach((color, ci) => {
                        rows.push(
                          <tr key={`${group.mainSku}-${color.h2uSku}`}
                            className={`hover:bg-gray-50 transition-colors divide-x divide-gray-100 ${ci === 0 && group.status !== "active" ? "opacity-80" : ""}`}>

                            {/* Main SKU — only on first colour row */}
                            {ci === 0 ? (
                              <td rowSpan={group.colors.length} className="px-4 py-2 align-top border-r border-gray-100">
                                <span className="font-mono font-bold text-brand-700 text-sm">{group.mainSku}</span>
                                <div className="mt-1">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STATUS_STYLE[group.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                    {STATUS_LABEL[group.status] ?? group.status}
                                  </span>
                                </div>
                              </td>
                            ) : null}

                            {/* Product name — only on first colour row */}
                            {ci === 0 ? (
                              <td rowSpan={group.colors.length} className="px-4 py-2 align-top border-r border-gray-100 max-w-[200px]">
                                <p className="font-medium text-gray-900 text-sm leading-snug">{group.productName}</p>
                              </td>
                            ) : null}

                            {/* Colour */}
                            <td className="px-4 py-2 border-r border-gray-100">
                              <span className="text-gray-700 text-sm">{color.colorName ?? color.colorCode ?? "—"}</span>
                            </td>

                            {/* H2U SKU */}
                            <td className="px-4 py-2 border-r border-gray-100">
                              <span className="font-mono text-xs text-gray-500">{color.h2uSku}</span>
                            </td>

                            {/* Size quantities */}
                            {SIZES.map(s => {
                              const q = (color as any)[`qty${s}`] as number;
                              return (
                                <td key={s} className="px-2 py-2 text-center border-r border-gray-50">
                                  <span className={`text-sm font-medium ${
                                    q === 0 ? "text-gray-200" : q <= 2 ? "text-amber-500 font-semibold" : "text-gray-800"
                                  }`}>{q}</span>
                                </td>
                              );
                            })}

                            {/* Total */}
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                color.totalQty === 0 ? "bg-gray-100 text-gray-400" : "bg-brand-50 text-brand-700"
                              }`}>{color.totalQty}</span>
                            </td>
                          </tr>
                        );
                      });
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD ── */}
      {tab === "upload" && (
        <div className="max-w-2xl">
          {committed ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle size={22} className="text-green-600" />
                <h3 className="font-semibold text-green-800 text-lg">Import Complete</h3>
              </div>
              <p className="text-green-700 text-sm">{committed.saved} records saved successfully.</p>
              {committed.unmatched.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-amber-700 mb-2">{committed.unmatched.length} rows skipped:</p>
                  <div className="bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 max-h-48 overflow-y-auto">
                    {committed.unmatched.map((u, i) => (
                      <div key={i} className="px-3 py-2 text-xs flex gap-3">
                        <span className="text-gray-400">Row {u.row}</span>
                        <span className="font-mono text-gray-700">{u.sku}</span>
                        <span className="text-gray-500">{u.location}</span>
                        <span className="text-amber-700">{u.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <button onClick={resetUpload} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800">Upload Another</button>
                <button onClick={() => { setTab("view"); resetUpload(); loadInventory(); }} className="px-4 py-2 border border-green-300 text-green-800 rounded-lg text-sm hover:bg-green-100">View Inventory</button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
                <DownloadCloud size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">Excel / CSV Format</p>
                  <p className="text-xs text-blue-600 mt-0.5">Columns: <span className="font-mono">SKU, Location, Size 35–42, Notes</span></p>
                  <p className="text-xs text-blue-500 mt-0.5">SKU must match a Product Library entry. Location must match an outlet name or marking code.</p>
                </div>
                <button onClick={downloadTemplate} className="text-xs text-blue-700 underline hover:text-blue-900 flex-shrink-0">Download template</button>
              </div>

              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setPreview(null); setCommitted(null); } }}>
                <Upload size={28} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 font-medium">{file ? file.name : "Drop your Excel or CSV file here"}</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, or .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(null); setCommitted(null); } }} />
              </div>

              {uploadError && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} /> {uploadError}
                </div>
              )}

              {file && !preview && (
                <button onClick={handlePreview} disabled={uploading}
                  className="mt-4 w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                  {uploading ? "Analysing…" : "Preview Import"}
                </button>
              )}

              {preview && (
                <div className="mt-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm font-medium text-green-700">{preview.matched} rows ready</span>
                    </div>
                    {preview.unmatched.length > 0 && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">{preview.unmatched.length} rows skipped</span>
                      </div>
                    )}
                  </div>
                  {preview.unmatched.length > 0 && (
                    <div className="mb-4 bg-white rounded-lg border border-amber-200 divide-y divide-amber-100 max-h-40 overflow-y-auto">
                      {preview.unmatched.map((u, i) => (
                        <div key={i} className="px-3 py-2 text-xs flex gap-3">
                          <span className="text-gray-400 w-12">Row {u.row}</span>
                          <span className="font-mono text-gray-700 w-24 truncate">{u.sku}</span>
                          <span className="text-gray-500 w-28 truncate">{u.location}</span>
                          <span className="text-amber-700">{u.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={handleCommit} disabled={uploading || preview.matched === 0}
                      className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                      {uploading ? "Importing…" : `Confirm & Import ${preview.matched} Records`}
                    </button>
                    <button onClick={resetUpload} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
