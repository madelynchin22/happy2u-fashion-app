"use client";
import { useEffect, useState } from "react";
import { Plus, Star, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TrendItem = {
  id: string; category: string; title: string; description?: string;
  imageUrl?: string; sourceUrl?: string; sourceName?: string;
  market?: string; brand?: string; colorName?: string;
  priceMin?: number; priceMax?: number;
  rankPosition?: number; salesData?: string;
  trendScore?: number; season?: string; scrapedAt: string; isManual: boolean;
};

const CAT_COLORS: Record<string, string> = {
  color:      "bg-purple-100 text-purple-700",
  material:   "bg-amber-100 text-amber-700",
  accessory:  "bg-orange-100 text-orange-700",
  silhouette: "bg-blue-100 text-blue-700",
  style:      "bg-red-100 text-red-700",
};

function getMomentum(score?: number): { label: string; icon: string; cls: string } | null {
  if (score == null) return null;
  if (score >= 65) return { label: "Rising",   icon: "↑", cls: "bg-green-200 text-green-800" };
  if (score >= 35) return { label: "Stable",   icon: "→", cls: "bg-amber-200 text-amber-800" };
  return               { label: "Declining", icon: "↓", cls: "bg-red-100 text-red-700" };
}

function CategoryIcon({ category }: { category: string }) {
  const cls = "stroke-gray-400 fill-none stroke-[1.5]";
  switch (category) {
    case "silhouette":
      return (
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <rect x="20" y="24" width="40" height="44" rx="4" className={cls} />
          <path d="M30 24 v-6 a10 10 0 0 1 20 0 v6" className={cls} />
          <rect x="32" y="36" width="16" height="2" rx="1" className={cls} />
          <rect x="32" y="44" width="16" height="2" rx="1" className={cls} />
          <rect x="32" y="52" width="10" height="2" rx="1" className={cls} />
        </svg>
      );
    case "style":
      return (
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <path d="M24 58 L28 32 Q40 22 52 32 L56 58 Z" className={cls} />
          <path d="M28 32 Q34 26 40 24 Q46 26 52 32" className={cls} />
          <ellipse cx="40" cy="24" rx="6" ry="4" className={cls} />
        </svg>
      );
    case "material":
      return (
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <line x1="20" y1="34" x2="60" y2="34" className={cls} strokeLinecap="round" />
          <line x1="20" y1="44" x2="60" y2="44" className={cls} strokeLinecap="round" />
          <line x1="28" y1="54" x2="52" y2="54" className={cls} strokeLinecap="round" />
        </svg>
      );
    case "color":
      return (
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <circle cx="40" cy="40" r="20" className={cls} />
          <line x1="40" y1="26" x2="40" y2="54" className={cls} strokeLinecap="round" />
          <line x1="26" y1="40" x2="54" y2="40" className={cls} strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          <diamond cx="40" cy="40" r="20" className={cls} />
          <path d="M40 20 L56 40 L40 60 L24 40 Z" className={cls} />
        </svg>
      );
  }
}

const CATS = ["all","color","material","silhouette","style"];
const SECONDARY = ["all_markets","rising_only","not_acting"];
const SECONDARY_LABELS: Record<string, string> = {
  all_markets: "All markets",
  rising_only: "Rising only",
  not_acting:  "Not yet acting",
};

export default function TrendsPage() {
  const [trends, setTrends]     = useState<TrendItem[]>([]);
  const [saved, setSaved]       = useState<Set<string>>(new Set());
  const [cat, setCat]           = useState("all");
  const [secondary, setSecondary] = useState("all_markets");
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [form, setForm] = useState({
    category:"color", title:"", description:"", imageUrl:"", sourceUrl:"",
    sourceName:"Manual", market:"MY", brand:"", colorName:"",
    priceMin:"", priceMax:"", rankPosition:"", salesData:"", season:"", trendScore:"",
  });

  useEffect(() => {
    fetch("/api/trends").then(r => r.json()).then(data => {
      setTrends(data);
      setLastRefresh(new Date());
    }).catch(() => setTrends([]));
  }, []);

  function toggleSave(id: string) {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function addTrend() {
    setSaving(true);
    const res = await fetch("/api/trends", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        ...form,
        rankPosition: form.rankPosition ? parseInt(form.rankPosition) : null,
        priceMin: form.priceMin ? parseFloat(form.priceMin) : null,
        priceMax: form.priceMax ? parseFloat(form.priceMax) : null,
        trendScore: form.trendScore ? parseFloat(form.trendScore) : null,
        isManual: true,
      }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); setTrends(t => [d, ...t]); setModal(false); }
  }

  async function autoRefresh() {
    setRefreshing(true);
    const r = await fetch("/api/trends/auto-refresh", { method: "POST" });
    if (r.ok) {
      const res = await fetch("/api/trends");
      if (res.ok) setTrends(await res.json());
      setLastRefresh(new Date());
    }
    setRefreshing(false);
  }

  const filtered = trends.filter(t => {
    if (cat !== "all" && t.category !== cat) return false;
    if (secondary === "rising_only") {
      const m = getMomentum(t.trendScore);
      if (m?.label !== "Rising") return false;
    }
    return true;
  });

  const savedCount  = saved.size;
  const actingCount = 0;
  const totalCount  = filtered.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trend board</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalCount} trends · {actingCount} acting on · {savedCount} saved
            {lastRefresh && ` · last refresh ${formatDistanceToNow(lastRefresh)} ago`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={autoRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            {refreshing ? "Refreshing…" : <>Auto-refresh <ArrowUpRight size={13} /></>}
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Plus size={14} /> Add trend
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              cat === c
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}>
            {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {SECONDARY.map(s => (
          <button key={s} onClick={() => setSecondary(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              secondary === s
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}>
            {SECONDARY_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(t => {
          const momentum = getMomentum(t.trendScore);
          const isSaved  = saved.has(t.id);
          const daysSeen = Math.floor((Date.now() - new Date(t.scrapedAt).getTime()) / 86_400_000);

          return (
            <div key={t.id} className="card overflow-hidden">
              {/* Image / icon area */}
              <div className="relative bg-[#f2ede4] flex items-center justify-center" style={{ height: 130 }}>
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt={t.title} className="w-full h-full object-contain p-2" />
                ) : (
                  <CategoryIcon category={t.category} />
                )}
                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${CAT_COLORS[t.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {t.category}
                </span>
                {momentum && (
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${momentum.cls}`}>
                    {momentum.icon} {momentum.label}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-semibold text-gray-900 leading-tight text-sm">{t.title}</h3>
                  {t.market && <span className="text-[10px] text-gray-400 shrink-0">{t.market}</span>}
                </div>

                {t.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-wrap">
                  {(t.priceMin || t.priceMax) && (
                    <span>RM {t.priceMin ?? ""}{t.priceMin && t.priceMax && t.priceMin !== t.priceMax ? `–${t.priceMax}` : ""}</span>
                  )}
                  {(t.priceMin || t.priceMax) && t.sourceName && <span>·</span>}
                  {t.sourceName && <span>{t.sourceName} · {t.isManual ? "manual" : "auto"}</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-0.5">
                  <a
                    href={`/dashboard/samples/new?trendTitle=${encodeURIComponent(t.title)}&trendCategory=${encodeURIComponent(t.category)}`}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    → Sample <ArrowUpRight size={10} />
                  </a>
                  <button onClick={() => toggleSave(t.id)}
                    className={`p-1.5 rounded-lg border transition-colors ${isSaved ? "border-amber-300 bg-amber-50 text-amber-500" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                    <Star size={13} fill={isSaved ? "currentColor" : "none"} />
                  </button>
                </div>

                {isSaved ? (
                  <p className="text-[10px] text-green-600">Saved</p>
                ) : t.salesData ? (
                  <p className="text-[10px] text-green-600">Acting on</p>
                ) : (
                  <p className="text-[10px] text-gray-400">Not yet acting</p>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-4 card p-16 text-center text-gray-400">
            <p className="font-medium">No trends match your filters.</p>
            <p className="text-sm mt-1">Try clicking Auto-refresh to pull the latest data.</p>
          </div>
        )}
      </div>

      {/* Add Trend Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">Add trend observation</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                    <option value="color">Color</option>
                    <option value="material">Material</option>
                    <option value="accessory">Accessory</option>
                    <option value="silhouette">Silhouette</option>
                    <option value="style">Style</option>
                  </select>
                </div>
                <div>
                  <label className="label">Market</label>
                  <select className="input" value={form.market} onChange={e => setForm(f=>({...f,market:e.target.value}))}>
                    <option value="MY">Malaysia</option>
                    <option value="TH">Thailand</option>
                    <option value="GLOBAL">Global</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Trend title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Mary Jane revival" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Why it's trending, key design elements…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price Min (RM)</label>
                  <input className="input" type="number" value={form.priceMin} onChange={e => setForm(f=>({...f,priceMin:e.target.value}))} placeholder="89" />
                </div>
                <div>
                  <label className="label">Price Max (RM)</label>
                  <input className="input" type="number" value={form.priceMax} onChange={e => setForm(f=>({...f,priceMax:e.target.value}))} placeholder="199" />
                </div>
                <div>
                  <label className="label">Source name</label>
                  <input className="input" value={form.sourceName} onChange={e => setForm(f=>({...f,sourceName:e.target.value}))} placeholder="Zalora, Lyst…" />
                </div>
                <div>
                  <label className="label">Trend score (0–100)</label>
                  <input className="input" type="number" min="0" max="100" value={form.trendScore} onChange={e => setForm(f=>({...f,trendScore:e.target.value}))} placeholder="65" />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <input className="input" value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))} placeholder="Zara, H&M…" />
                </div>
                <div>
                  <label className="label">Primary color</label>
                  <input className="input" value={form.colorName} onChange={e => setForm(f=>({...f,colorName:e.target.value}))} placeholder="Butter Yellow" />
                </div>
                <div>
                  <label className="label">Product image URL</label>
                  <input className="input" value={form.imageUrl} onChange={e => setForm(f=>({...f,imageUrl:e.target.value}))} placeholder="https://…" />
                </div>
                <div>
                  <label className="label">Source URL</label>
                  <input className="input" type="url" value={form.sourceUrl} onChange={e => setForm(f=>({...f,sourceUrl:e.target.value}))} placeholder="https://…" />
                </div>
              </div>
              <div>
                <label className="label">Sales data / notes</label>
                <textarea className="input" rows={2} value={form.salesData} onChange={e => setForm(f=>({...f,salesData:e.target.value}))} placeholder="e.g. Sample SR-2026-001" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addTrend} className="btn-primary flex-1" disabled={saving || !form.title}>
                {saving ? "Saving…" : "Add trend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
