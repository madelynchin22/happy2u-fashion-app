"use client";
import { useEffect, useState } from "react";
import { Plus, TrendingUp, ExternalLink, Search, Globe, RefreshCw, Sparkles, SlidersHorizontal } from "lucide-react";

type TrendItem = {
  id: string; category: string; title: string; description?: string;
  imageUrl?: string; sourceUrl?: string; sourceName?: string;
  market?: string; brand?: string; colorName?: string;
  priceMin?: number; priceMax?: number;
  rankPosition?: number; salesData?: string;
  trendScore?: number; season?: string; scrapedAt: string; isManual: boolean;
};

const CATS    = ["all","color","material","accessory","silhouette","style"];
const MARKETS = ["all","MY","TH","GLOBAL"];
const PRICE_RANGES = [
  { label: "All prices", min: 0, max: Infinity },
  { label: "Under RM 89", min: 0, max: 89 },
  { label: "RM 89 – 149", min: 89, max: 149 },
  { label: "RM 150 – 249", min: 150, max: 249 },
  { label: "RM 250+", min: 250, max: Infinity },
];

const CAT_COLORS: Record<string, string> = {
  color:      "bg-pink-100 text-pink-700",
  material:   "bg-amber-100 text-amber-700",
  accessory:  "bg-purple-100 text-purple-700",
  silhouette: "bg-blue-100 text-blue-700",
  style:      "bg-green-100 text-green-700",
};

function trendPhotoUrl(t: TrendItem): string | null {
  return t.imageUrl ?? null;
}

export default function TrendsPage() {
  const [trends, setTrends]         = useState<TrendItem[]>([]);
  const [cat, setCat]               = useState("all");
  const [market, setMarket]         = useState("all");
  const [search, setSearch]         = useState("");
  const [brandFilter, setBrand]     = useState("");
  const [colorFilter, setColor]     = useState("");
  const [priceIdx, setPriceIdx]     = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [form, setForm] = useState({
    category:"color", title:"", description:"", imageUrl:"", sourceUrl:"",
    sourceName:"Manual", market:"MY", brand:"", colorName:"",
    priceMin:"", priceMax:"", rankPosition:"", salesData:"", season:"",
  });

  useEffect(() => {
    fetch("/api/trends").then(r => r.json()).then(setTrends).catch(() => setTrends([]));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/trends", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        ...form,
        rankPosition: form.rankPosition ? parseInt(form.rankPosition) : null,
        priceMin: form.priceMin ? parseFloat(form.priceMin) : null,
        priceMax: form.priceMax ? parseFloat(form.priceMax) : null,
        isManual: true,
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); setTrends(t => [d, ...t]); setModal(false); }
  }

  async function autoRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    const r = await fetch("/api/trends/auto-refresh", { method: "POST" });
    const d = await r.json();
    setRefreshing(false);
    if (r.ok) {
      setRefreshMsg(`✓ Added ${d.added} new trend items from Zalora`);
      const res = await fetch("/api/trends");
      if (res.ok) setTrends(await res.json());
    } else {
      setRefreshMsg(`Error: ${d.error}`);
    }
  }

  const priceRange = PRICE_RANGES[priceIdx];

  // Unique brands and colors for filter dropdowns
  const brands = Array.from(new Set(trends.map(t => t.brand).filter(Boolean))) as string[];
  const colors  = Array.from(new Set(trends.map(t => t.colorName).filter(Boolean))) as string[];

  const filtered = trends.filter(t => {
    if (cat    !== "all" && t.category !== cat) return false;
    if (market !== "all" && t.market   !== market) return false;
    if (brandFilter && t.brand !== brandFilter) return false;
    if (colorFilter && t.colorName !== colorFilter) return false;
    if (priceIdx > 0) {
      const lo = t.priceMin ?? 0;
      const hi = t.priceMax ?? t.priceMin ?? 0;
      if (hi > 0 && (hi < priceRange.min || lo > priceRange.max)) return false;
    }
    const q = search.toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const autoCount   = filtered.filter(t => !t.isManual).length;
  const manualCount = filtered.filter(t => t.isManual).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trend Board</h1>
          <p className="text-gray-500 text-sm">{filtered.length} trend items · {autoCount} auto · {manualCount} manual</p>
        </div>
        <div className="flex gap-2">
          <button onClick={autoRefresh} disabled={refreshing}
            className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Auto-Refresh Trends"}
          </button>
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Trend
          </button>
        </div>
      </div>

      {refreshMsg && (
        <div className={`p-3 rounded-lg text-sm ${refreshMsg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {refreshMsg}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 w-48" placeholder="Search trends…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  cat === c ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {MARKETS.map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  market === m ? "bg-gray-800 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}>{m}</button>
            ))}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showFilters || brandFilter || colorFilter || priceIdx > 0
                ? "bg-brand-50 text-brand-700 border-brand-200"
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}>
            <SlidersHorizontal size={13} /> More filters
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-3 flex-wrap items-center p-3 bg-gray-50 rounded-xl">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Brand</label>
              <select className="input text-sm py-1.5 w-40" value={brandFilter} onChange={e => setBrand(e.target.value)}>
                <option value="">All brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Color</label>
              <select className="input text-sm py-1.5 w-40" value={colorFilter} onChange={e => setColor(e.target.value)}>
                <option value="">All colors</option>
                {colors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Price Range</label>
              <select className="input text-sm py-1.5 w-44" value={priceIdx} onChange={e => setPriceIdx(Number(e.target.value))}>
                {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
              </select>
            </div>
            {(brandFilter || colorFilter || priceIdx > 0) && (
              <button onClick={() => { setBrand(""); setColor(""); setPriceIdx(0); }}
                className="text-xs text-gray-500 hover:text-red-500 mt-4">Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* Trend Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="card overflow-hidden hover:shadow-lg transition-shadow group">
            <div className="aspect-square overflow-hidden bg-gray-100 flex items-center justify-center">
              {trendPhotoUrl(t) ? (
                <img
                  src={trendPhotoUrl(t)!}
                  alt={t.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => { (e.target as HTMLImageElement).parentElement!.classList.add("bg-gradient-to-br", "from-gray-100", "to-gray-200"); (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2">
                  <TrendingUp size={28} className="text-gray-300" />
                  <span className="text-xs text-gray-400 capitalize">{t.category}</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CAT_COLORS[t.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {t.category}
                </span>
                <div className="flex items-center gap-1.5">
                  {!t.isManual && <span title="Auto-generated"><Sparkles size={10} className="text-brand-400" /></span>}
                  {t.market && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Globe size={10} />{t.market}</span>}
                  {t.rankPosition && <span className="text-xs font-bold text-brand-600">#{t.rankPosition}</span>}
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{t.title}</h3>
              {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>}

              {/* Brand / Color / Price tags */}
              <div className="flex flex-wrap gap-1 mt-2">
                {t.brand && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t.brand}</span>}
                {t.colorName && <span className="text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">{t.colorName}</span>}
                {(t.priceMin || t.priceMax) && (
                  <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">
                    {t.priceMin && t.priceMax && t.priceMin !== t.priceMax
                      ? `RM ${t.priceMin}–${t.priceMax}`
                      : `RM ${t.priceMin ?? t.priceMax}`}
                  </span>
                )}
              </div>

              {t.salesData && (
                <div className="mt-2 bg-green-50 rounded-lg px-2 py-1.5 text-xs text-green-700">
                  <span className="font-medium">Sales data: </span>{t.salesData}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  {t.sourceName && <span>{t.sourceName}</span>}
                  {t.season && <span className="ml-2">{t.season}</span>}
                </div>
                {t.sourceUrl && (
                  <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1">
                    View source <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-4 card p-16 text-center text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No trend items match your filters.</p>
            <p className="text-sm mt-1">Try "Auto-Refresh Trends" to pull the latest data automatically.</p>
          </div>
        )}
      </div>

      {/* Add Trend Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">Add Trend Observation</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    <option value="color">Color Trend</option>
                    <option value="material">Material Trend</option>
                    <option value="accessory">Accessory / Hardware</option>
                    <option value="silhouette">Silhouette / Shape</option>
                    <option value="style">Style / Design</option>
                  </select>
                </div>
                <div>
                  <label className="label">Market</label>
                  <select className="input" value={form.market} onChange={e => setForm(f=>({...f,market:e.target.value}))}>
                    <option value="MY">Malaysia</option>
                    <option value="TH">Thailand</option>
                    <option value="GLOBAL">Global</option>
                    <option value="CN">China</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Trend Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Bow Embellishment Flats" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
                  placeholder="Why it's trending, key design elements…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Brand</label>
                  <input className="input" value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))} placeholder="Zara, H&M, Charles & Keith…" />
                </div>
                <div>
                  <label className="label">Primary Color</label>
                  <input className="input" value={form.colorName} onChange={e => setForm(f=>({...f,colorName:e.target.value}))} placeholder="Butter Yellow" />
                </div>
                <div>
                  <label className="label">Price Min (RM)</label>
                  <input className="input" type="number" value={form.priceMin} onChange={e => setForm(f=>({...f,priceMin:e.target.value}))} placeholder="89" />
                </div>
                <div>
                  <label className="label">Price Max (RM)</label>
                  <input className="input" type="number" value={form.priceMax} onChange={e => setForm(f=>({...f,priceMax:e.target.value}))} placeholder="149" />
                </div>
                <div>
                  <label className="label">Source URL</label>
                  <input className="input" type="url" value={form.sourceUrl} onChange={e => setForm(f=>({...f,sourceUrl:e.target.value}))} placeholder="https://…" />
                </div>
                <div>
                  <label className="label">Source Name</label>
                  <input className="input" value={form.sourceName} onChange={e => setForm(f=>({...f,sourceName:e.target.value}))} placeholder="Pinterest, Lyst…" />
                </div>
                <div>
                  <label className="label">Product Image URL</label>
                  <input className="input" value={form.imageUrl} onChange={e => setForm(f=>({...f,imageUrl:e.target.value}))} placeholder="https://…" />
                </div>
                <div>
                  <label className="label">Rank Position</label>
                  <input className="input" type="number" value={form.rankPosition} onChange={e => setForm(f=>({...f,rankPosition:e.target.value}))} placeholder="1" />
                </div>
              </div>
              <div>
                <label className="label">Sales Volume / Data</label>
                <textarea className="input" rows={2} value={form.salesData} onChange={e => setForm(f=>({...f,salesData:e.target.value}))}
                  placeholder="e.g. #1 best-seller on Zalora MY past 30 days, 2.3k sold" />
              </div>
              <div>
                <label className="label">Season</label>
                <input className="input" value={form.season} onChange={e => setForm(f=>({...f,season:e.target.value}))} placeholder="SS2026" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving||!form.title}>{saving?"Saving…":"Add Trend"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
