"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Plus, ExternalLink, ShoppingBag, Search, X, PackageSearch, Pencil, Trash2 } from "lucide-react";

type Competitor = {
  id: string; name: string; url: string; platform: string; country: string;
  isActive: boolean; lastCrawledAt?: string; _count?: { products: number };
};

type Product = {
  id: string; competitorId: string; name: string; handle: string;
  productUrl: string; imageUrl: string; priceMin: number; priceMax: number;
  colors: string; productType: string; isAvailable: boolean;
  isNew: boolean; wasRestocked: boolean; restockedAt?: string;
  firstSeenAt: string; competitor: { name: string; url: string };
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [tab, setTab]                 = useState<"new" | "restock" | "all">("new");
  const [search, setSearch]           = useState("");
  const [filterComp, setFilterComp]   = useState("");
  const [crawling, setCrawling]       = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<Record<string, any>>({});
  const [modal, setModal]             = useState(false);
  const [editModal, setEditModal]     = useState<Competitor | null>(null);
  const [form, setForm]               = useState({ name: "", url: "", country: "MY" });
  const [editForm, setEditForm]       = useState({ name: "", url: "", country: "MY" });
  const [saving, setSaving]           = useState(false);
  const [pageError, setPageError]     = useState("");

  useEffect(() => { loadCompetitors(); }, []);
  useEffect(() => { loadProducts(); }, [tab, filterComp, search]);

  async function loadCompetitors() {
    try {
      const r = await fetch("/api/competitors");
      if (r.ok) setCompetitors(await r.json());
    } catch {}
  }

  async function loadProducts() {
    try {
      const params = new URLSearchParams({ tab });
      if (filterComp) params.set("competitorId", filterComp);
      if (search) params.set("search", search);
      const r = await fetch(`/api/competitors/products?${params}`);
      if (r.ok) setProducts(await r.json());
    } catch {}
  }

  async function crawl(id: string) {
    setCrawling(id);
    setCrawlResult(prev => { const n = {...prev}; delete n[id]; return n; });
    try {
      const r = await fetch(`/api/competitors/${id}/crawl`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      setCrawlResult(prev => ({ ...prev, [id]: data }));
    } catch (e: any) {
      setCrawlResult(prev => ({ ...prev, [id]: { error: e.message ?? "Network error" } }));
    }
    setCrawling(null);
    loadCompetitors();
    loadProducts();
  }

  async function addCompetitor() {
    setSaving(true);
    setPageError("");
    try {
      const r = await fetch("/api/competitors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, url: form.url, country: form.country }),
      });
      if (r.ok) {
        await loadCompetitors();
        setModal(false);
        setForm({ name: "", url: "", country: "MY" });
      } else {
        const d = await r.json().catch(() => ({}));
        setPageError(d.error ?? "Failed to add competitor");
      }
    } catch (e: any) {
      setPageError(e.message ?? "Network error");
    }
    setSaving(false);
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/competitors/${editModal.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (r.ok) {
        await loadCompetitors();
        setEditModal(null);
      }
    } catch {}
    setSaving(false);
  }

  async function deleteCompetitor(id: string, name: string) {
    if (!confirm(`Delete ${name} and all its tracked products?`)) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    setCompetitors(prev => prev.filter(c => c.id !== id));
    setCrawlResult(prev => { const n = {...prev}; delete n[id]; return n; });
    loadProducts();
  }

  function openEdit(c: Competitor) {
    setEditForm({ name: c.name, url: c.url, country: c.country });
    setEditModal(c);
  }

  function parseColors(json: string): string[] {
    try { return JSON.parse(json) ?? []; } catch { return []; }
  }

  function formatPrice(min: number, max: number) {
    if (!min && !max) return "—";
    if (min === max || !max) return `RM ${min}`;
    return `RM ${min} – RM ${max}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackageSearch size={24} className="text-brand-500" /> Competitor Monitor
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track new arrivals and restocks from your competitors</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Competitor
        </button>
      </div>

      {/* Competitor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitors.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{c.name}</p>
                <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  {c.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 35)}
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{c.country}</span>
                <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-gray-700" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteCompetitor(c.id, c.name)} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>{c._count?.products ?? 0} products tracked</span>
              {c.lastCrawledAt && (
                <span>Last: {new Date(c.lastCrawledAt).toLocaleDateString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
            {crawlResult[c.id] && (
              <div className={`mb-3 p-2 rounded-lg text-xs ${crawlResult[c.id].error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {crawlResult[c.id].error
                  ? <span title={crawlResult[c.id].error}>⚠ {crawlResult[c.id].error.length > 110 ? crawlResult[c.id].error.slice(0, 110) + "…" : crawlResult[c.id].error}</span>
                  : `✓ ${crawlResult[c.id].total} products · ${crawlResult[c.id].newProducts} new · ${crawlResult[c.id].restocks} restocks`}
              </div>
            )}
            <button onClick={() => crawl(c.id)} disabled={crawling === c.id}
              className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
              <RefreshCw size={12} className={crawling === c.id ? "animate-spin" : ""} />
              {crawling === c.id ? "Crawling…" : "Crawl Now"}
            </button>
          </div>
        ))}

        {competitors.length === 0 && (
          <div className="col-span-3 card p-10 text-center text-gray-400">
            <ShoppingBag size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">No competitors added yet</p>
            <p className="text-sm mt-1">Click "Add Competitor" to start monitoring.</p>
          </div>
        )}
      </div>

      {/* Product feed */}
      {competitors.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              {(["new", "restock", "all"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {t === "new" ? "🆕 New Arrivals" : t === "restock" ? "🔄 Restocks" : "All Products"}
                </button>
              ))}
            </div>
            <select className="input w-auto text-sm py-2" value={filterComp} onChange={e => setFilterComp(e.target.value)}>
              <option value="">All competitors</option>
              {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm" placeholder="Search products…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={loadProducts} className="btn-secondary text-xs flex items-center gap-1.5 py-2">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div className="p-4">
            {products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <PackageSearch size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-600">No products yet</p>
                <p className="text-sm mt-1">Click "Crawl Now" on a competitor card above to fetch their products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map(p => {
                  const colors = parseColors(p.colors);
                  return (
                    <a key={p.id} href={p.productUrl} target="_blank" rel="noopener noreferrer"
                      className="group block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-square overflow-hidden bg-gray-100 relative">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ShoppingBag size={32} />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {p.isNew && <span className="bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">NEW</span>}
                          {p.wasRestocked && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">RESTOCK</span>}
                          {!p.isAvailable && <span className="bg-gray-500 text-white text-[10px] px-1.5 py-0.5 rounded">OOS</span>}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-xs font-bold text-brand-700 mt-1">{formatPrice(p.priceMin, p.priceMax)}</p>
                        {colors.length > 0 && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{colors.join(", ")}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{p.competitor.name}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Competitor modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Competitor</h2>
              <button onClick={() => { setModal(false); setPageError(""); }}><X size={18} className="text-gray-400" /></button>
            </div>
            {pageError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{pageError}</div>}
            <div className="space-y-4">
              <div>
                <label className="label">Competitor Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Ballerine" />
              </div>
              <div>
                <label className="label">Website URL *</label>
                <input className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://www.myballerine.com" />
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="TH">Thailand</option>
                  <option value="ID">Indonesia</option>
                  <option value="CN">China</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addCompetitor} disabled={saving || !form.name || !form.url}
                className="btn-primary flex-1">{saving ? "Adding…" : "Add Competitor"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Competitor modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Competitor</h2>
              <button onClick={() => setEditModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Competitor Name</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Website URL</label>
                <input className="input" value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="TH">Thailand</option>
                  <option value="ID">Indonesia</option>
                  <option value="CN">China</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
