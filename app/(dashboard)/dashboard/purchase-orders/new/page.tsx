"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Camera, ShoppingCart } from "lucide-react";
import Image from "next/image";

function today() { return new Date().toISOString().split("T")[0]; }

type LibItem = {
  id: string; libNumber: string; productName: string; h2uSku?: string; mainSku?: string;
  supplierSku?: string; brand?: string; category?: string; colorName?: string; colorCode?: string;
  status?: string; sampleOrderId?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
  shoePhotoUrl?: string; photoSideUrl?: string;
  manufacturer?: { id: string; name: string };
  sampleOrder?: { orderNumber: string };
};

type DisplayRow =
  | { type: "group"; groupKey: string; mainSku: string | null; items: LibItem[] }
  | { type: "single"; item: LibItem };

const STATUS_DOT: Record<string, string> = {
  active:       "bg-teal-500",
  draft:        "bg-violet-400",
  low_stock:    "bg-amber-400",
  out_of_stock: "bg-gray-400",
  clearance:    "bg-red-400",
};

function GroupCheckbox({ allIn, someIn, onChange }: { allIn: boolean; someIn: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !allIn && someIn; }, [allIn, someIn]);
  return (
    <input ref={ref} type="checkbox" checked={allIn} onChange={onChange}
      className="w-4 h-4 rounded accent-gray-800 cursor-pointer" />
  );
}

export default function NewPOPage() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/product-library").then(r => r.json()).then(d => setLibrary(Array.isArray(d) ? d : []));
  }, []);

  // Filter items by search
  const filtered = useMemo(() => {
    if (!search) return library;
    const q = search.toLowerCase();
    return library.filter(item =>
      (item.mainSku ?? "").toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q) ||
      (item.h2uSku ?? "").toLowerCase().includes(q) ||
      (item.colorName ?? "").toLowerCase().includes(q) ||
      (item.manufacturer?.name ?? "").toLowerCase().includes(q)
    );
  }, [library, search]);

  // Group by mainSku → sampleOrderId → singles (same as Product Library "All SKUs")
  const displayRows = useMemo<DisplayRow[]>(() => {
    const mainSkuMap = new Map<string, LibItem[]>();
    const sampleMap  = new Map<string, LibItem[]>();
    const singles: LibItem[] = [];
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
    for (const [mainSku, items] of [...mainSkuMap.entries()].sort(([a], [b]) => a.localeCompare(b)))
      rows.push({ type: "group", groupKey: `sku:${mainSku}`, mainSku, items });
    for (const [sid, items] of sampleMap)
      rows.push({ type: "group", groupKey: `sample:${sid}`, mainSku: null, items });
    for (const item of singles)
      rows.push({ type: "single", item });
    return rows;
  }, [filtered]);

  // One PO group per unique (mainSku × manufacturer) — matches "Create PO" button in Product Library
  const selectedSkuGroups = useMemo(() => {
    const map = new Map<string, {
      mfrId: string | null; mfrName: string;
      mainSku: string | null; productName: string; brand: string; items: LibItem[];
    }>();
    for (const item of library) {
      if (!selected.has(item.id)) continue;
      const mfrId  = item.manufacturer?.id ?? "__none__";
      const skuPart = item.mainSku ?? item.sampleOrderId ?? item.id;
      const key    = `${mfrId}::${skuPart}`;
      if (!map.has(key)) {
        map.set(key, {
          mfrId: item.manufacturer?.id ?? null,
          mfrName: item.manufacturer?.name ?? "No Manufacturer",
          mainSku: item.mainSku ?? null,
          productName: item.productName,
          brand: item.brand ?? "Happy2U",
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    }
    return [...map.values()];
  }, [library, selected]);

  function toggleItem(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleGroup(items: LibItem[]) {
    const allIn = items.every(i => selected.has(i.id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allIn) items.forEach(i => n.delete(i.id));
      else items.forEach(i => n.add(i.id));
      return n;
    });
  }

  async function save() {
    if (selected.size === 0) { alert("Select at least one product."); return; }

    // Block if any selected group has no manufacturer (required field in PO)
    const noMfr = selectedSkuGroups.filter(g => !g.mfrId);
    if (noMfr.length > 0) {
      alert(
        `The following items have no manufacturer set — please assign one in Product Library first:\n` +
        noMfr.map(g => `• ${g.mainSku ?? g.productName}`).join("\n")
      );
      return;
    }

    setSaving(true);
    const errors: string[] = [];
    for (const group of selectedSkuGroups) {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturerId: group.mfrId,
          productName:    group.mainSku ?? group.productName,
          brand:          group.brand,
          sampleOrderId:  group.items[0].sampleOrder?.orderNumber ?? null,
          date:           date || today(),
          notes:          notes || null,
          items: group.items.map(item => ({
            h2uSku:          item.h2uSku          ?? null,
            supplierSku:     item.supplierSku      ?? null,
            colorName:       item.colorName        ?? null,
            colorCode:       item.colorCode        ?? null,
            brand:           item.brand            ?? null,
            materialUpper:   item.materialUpper    ?? null,
            materialLining:  item.materialLining   ?? null,
            materialMidsole: item.materialMidsole  ?? null,
            materialOutsole: item.materialOutsole  ?? null,
            hardware:        item.hardware         ?? null,
            logoSpec:        item.logoSpec         ?? null,
            photoUrl:        item.shoePhotoUrl ?? item.photoSideUrl ?? null,
            totalPairs: 0, lineTotal: 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        errors.push(`${group.mainSku ?? group.productName} (${group.mfrName}): ${err.error ?? `HTTP ${res.status}`}`);
      }
    }
    setSaving(false);
    if (errors.length > 0) {
      alert(`Some POs could not be created:\n\n${errors.join("\n")}`);
    } else {
      router.push("/dashboard/purchase-orders");
    }
  }

  const poCount = selectedSkuGroups.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
          <p className="text-sm text-gray-500">PO numbers are auto-assigned per manufacturer on save</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || selected.size === 0} className="btn-primary flex items-center gap-2">
            <ShoppingCart size={15} />
            {saving ? "Creating…" : poCount > 1 ? `Create ${poCount} POs` : "Create PO"}
          </button>
        </div>
      </div>

      {/* PO Details */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">PO Details</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="label">Purchase Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Additional instructions…" />
          </div>
        </div>
      </div>

      {/* Selection summary */}
      {selected.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-teal-800 mb-2">
            {selected.size} colour{selected.size !== 1 ? "s" : ""} selected
            {" → "}
            {poCount} PO{poCount !== 1 ? "s" : ""} will be created
          </p>
          <div className="flex gap-2 flex-wrap">
            {selectedSkuGroups.map((g, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-xs bg-white border border-teal-200 text-teal-700 px-2.5 py-1 rounded-lg font-medium">
                {g.mfrName} · {g.mainSku ?? g.productName} · {g.items.length} colour{g.items.length !== 1 ? "s" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Product Library — All SKUs style */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Select from Product Library</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-sm w-64" placeholder="Search Main SKU, name, color…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {library.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No products in library yet.
          </div>
        ) : displayRows.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No results for &ldquo;{search}&rdquo;</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="w-10 px-4" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">Main SKU</th>
                <th className="px-2 py-3 w-12" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-32">Manufacturer</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">Colours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayRows.map(row => {
                if (row.type === "group") {
                  const items  = row.items;
                  const allIn  = items.every(i => selected.has(i.id));
                  const someIn = items.some(i => selected.has(i.id));
                  const photo  = items.find(i => i.shoePhotoUrl)?.shoePhotoUrl
                              ?? items.find(i => i.photoSideUrl)?.photoSideUrl;
                  const mfrName = items[0].manufacturer?.name ?? "—";

                  return (
                    <tr key={row.groupKey}
                      onClick={() => toggleGroup(items)}
                      className={`cursor-pointer transition-colors border-b-2 ${
                        allIn  ? "bg-teal-50 hover:bg-teal-100 border-teal-200" :
                        someIn ? "bg-teal-50/50 hover:bg-teal-100/50 border-teal-100" :
                                 "bg-gray-50 hover:bg-gray-100 border-gray-200"
                      }`}>
                      <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <GroupCheckbox allIn={allIn} someIn={someIn} onChange={() => toggleGroup(items)} />
                      </td>
                      <td className="px-4 py-3">
                        {row.mainSku ? (
                          <span className="font-mono text-sm font-black text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                            {row.mainSku}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-violet-600 bg-violet-100 px-2 py-0.5 rounded-lg border border-violet-300">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {photo ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                            <Image src={photo} alt={items[0].productName} width={40} height={40}
                              className="object-cover w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                            <Camera size={12} className="text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900 leading-tight">{items[0].productName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{items[0].category ?? "—"}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {items.map(it => (
                            <span key={it.id} className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[it.status ?? ""] ?? "bg-gray-300"}`} />
                              {it.colorName || "—"}
                              {it.colorCode && <span className="font-mono text-gray-400">[{it.colorCode}]</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {items[0].manufacturer
                          ? <span className="text-gray-600">{mfrName}</span>
                          : <span className="text-red-500 font-semibold">⚠ No manufacturer</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {items.length} colour{items.length !== 1 ? "s" : ""}
                      </td>
                    </tr>
                  );
                }

                // Single item row
                const item = row.item;
                const isSelected = selected.has(item.id);
                const photo = item.shoePhotoUrl ?? item.photoSideUrl;
                return (
                  <tr key={item.id} onClick={() => toggleItem(item.id)}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-teal-50 hover:bg-teal-100" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2.5 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 rounded accent-gray-800 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">—</td>
                    <td className="px-2 py-2">
                      {photo ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                          <Image src={photo} alt={item.productName} width={40} height={40} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                          <Camera size={12} className="text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      {item.colorName && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[item.status ?? ""] ?? "bg-gray-300"}`} />
                          {item.colorName}
                          {item.colorCode && <span className="font-mono text-gray-400">[{item.colorCode}]</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{item.manufacturer?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">1 colour</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving || selected.size === 0} className="btn-primary px-8 flex items-center gap-2">
          <ShoppingCart size={15} />
          {saving ? "Creating…" : poCount > 1 ? `Create ${poCount} Purchase Orders` : "Create Purchase Order"}
        </button>
      </div>
    </div>
  );
}
