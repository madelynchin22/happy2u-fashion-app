"use client";
import { useEffect, useState, useRef } from "react";
import {
  Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  ShoppingCart, Wand2, Upload, X,
} from "lucide-react";
import Link from "next/link";

type SuggestionItem = {
  productType: string; name: string; category: string; colorway: string;
  material: string; heelHeight?: string; hardware?: string;
  keyDesignElements: string; whyTrending: string;
  suggestedRetailRm: string; targetMarket: string;
  recommendedManufacturer?: string; priority: "high" | "medium" | "low";
};

type AIResult = {
  season: string; summary: string; suggestions: SuggestionItem[];
  generatedAt: string;
};

type TrendItem = { id: string; category: string; title: string; market?: string };

const PRIORITY_COLORS = {
  high:   "bg-green-100 text-green-800 border-green-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low:    "bg-gray-100  text-gray-700  border-gray-200",
};

const CAT_EMOJI: Record<string, string> = {
  heels:"👠", flats:"🥿", sandals:"👡", boots:"🥾", bags:"👜",
  accessories:"✨", shoe_care:"🧴", keychain:"🔑", merchandiser:"🎁",
};

function buildImageUrl(s: SuggestionItem, seed: number): string {
  const keyword = s.productType === "bag" ? "handbag,bag,product" :
    s.category === "heels" ? "high+heels,shoes,product" :
    s.category === "flats" ? "flat+shoes,shoes,product" :
    s.category === "sandals" ? "sandals,shoes,product" :
    s.category === "boots" ? "boots,shoes,product" : "shoes,footwear,product";
  return `https://loremflickr.com/512/512/${keyword}?random=${seed}&lock=${seed}`;
}

export default function AISuggestionsPage() {
  const [result, setResult]         = useState<AIResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [trends, setTrends]         = useState<TrendItem[]>([]);
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [photoMap, setPhotoMap]       = useState<Record<string, string>>({});
  const [imgErrors, setImgErrors]     = useState<Record<string, boolean>>({});
  const [loadingImgs, setLoadingImgs] = useState<Record<string, boolean>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [season, setSeason]           = useState("SS2026");
  const [markets, setMarkets]         = useState<string[]>(["MY", "TH"]);
  const [additionalNotes, setNotes]   = useState("");
  const [hasApiKey, setHasApiKey]     = useState(true);

  useEffect(() => {
    fetch("/api/trends").then(r => r.json()).then(setTrends).catch(() => {});
    const saved = localStorage.getItem("ai-collection-result");
    if (saved) { try { setResult(JSON.parse(saved)); } catch {} }
    const savedPhotos = localStorage.getItem("ai-suggestion-photos");
    if (savedPhotos) { try { setPhotoMap(JSON.parse(savedPhotos)); } catch {} }
  }, []);

  function savePhotos(map: Record<string, string>) {
    setPhotoMap(map);
    localStorage.setItem("ai-suggestion-photos", JSON.stringify(map));
  }

  function photoKey(i: number) {
    return result ? `${result.generatedAt}-${i}` : `${i}`;
  }

  function generateAIImage(index: number, s: SuggestionItem) {
    const seed = Math.floor(Math.random() * 999999);
    const url = buildImageUrl(s, seed);
    const key = photoKey(index);
    setImgErrors(prev => { const n = {...prev}; delete n[key]; return n; });
    setLoadingImgs(prev => ({ ...prev, [key]: true }));
    savePhotos({ ...photoMap, [key]: url });
  }

  function handleFileUpload(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const key = photoKey(index);
      savePhotos({ ...photoMap, [key]: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(index: number) {
    const key = photoKey(index);
    const newMap = { ...photoMap };
    delete newMap[key];
    savePhotos(newMap);
    setImgErrors(prev => { const n = {...prev}; delete n[key]; return n; });
  }

  function toggleMarket(m: string) {
    setMarkets(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function generate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/ai-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season, targetMarkets: markets, additionalNotes }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Generation failed");
      if (d.error?.includes("ANTHROPIC_API_KEY")) setHasApiKey(false);
      return;
    }
    const data = await res.json();
    setResult(data);
    localStorage.setItem("ai-collection-result", JSON.stringify(data));
    // Clear old photos when regenerating
    savePhotos({});
  }

  const highPriority = result?.suggestions.filter(s => s.priority === "high") ?? [];
  const midPriority  = result?.suggestions.filter(s => s.priority === "medium") ?? [];
  const lowPriority  = result?.suggestions.filter(s => s.priority === "low") ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-brand-500" size={24} /> AI Collection Suggestions
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Claude AI analyses your trend board + past best sellers to suggest your next collection
          </p>
        </div>
        {result && (
          <p className="text-xs text-gray-400">
            Generated: {new Date(result.generatedAt).toLocaleDateString("en-MY", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
          </p>
        )}
      </div>

      {/* Config panel */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Generation Settings</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Target Season</label>
            <input className="input" value={season} onChange={e => setSeason(e.target.value)} placeholder="SS2026" />
          </div>
          <div>
            <label className="label">Target Markets</label>
            <div className="flex gap-2 mt-1">
              {["MY","TH","GLOBAL"].map(m => (
                <button key={m} onClick={() => toggleMarket(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    markets.includes(m)
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Additional Notes for AI (optional)</label>
          <textarea className="input" rows={3} value={additionalNotes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Focus on office-wear styles. Budget range RM 89-189. Avoid open-toe designs this season." />
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">
          <span>📊 {trends.length} trend items will be analysed</span>
          <span>·</span>
          <span>💡 Add more trends in <Link href="/dashboard/trends" className="text-brand-600 hover:underline">Trend Board</Link></span>
          <span>·</span>
          <span>⭐ Add past sales in <Link href="/dashboard/best-sellers" className="text-brand-600 hover:underline">Best Sellers</Link></span>
        </div>

        {!hasApiKey && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
              <AlertCircle size={16} /> Anthropic API Key required
            </p>
            <p className="text-xs text-amber-700 mt-1">
              1. Get a free API key at <span className="font-mono">console.anthropic.com</span><br />
              2. Open <span className="font-mono">/Users/madelynchin/Claude/happy2u-app/.env</span><br />
              3. Replace <span className="font-mono">sk-ant-replace-with-your-key</span> with your actual key<br />
              4. Restart the app
            </p>
          </div>
        )}

        {error && !error.includes("API_KEY") && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <button onClick={generate} disabled={loading || markets.length === 0}
          className="btn-primary flex items-center gap-2 px-6">
          {loading
            ? <><RefreshCw size={16} className="animate-spin" /> Generating with Claude AI…</>
            : <><Sparkles size={16} /> Generate {season} Collection</>
          }
        </button>
        {loading && <p className="text-xs text-gray-400 mt-2">This takes 15-30 seconds. Claude is analysing your trends and past sales…</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="card p-6 bg-gradient-to-br from-brand-50 to-white border-brand-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="text-brand-600" size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{result.season} Collection — AI Summary</h2>
                <p className="text-gray-700 text-sm mt-1 leading-relaxed">{result.summary}</p>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="text-green-700 font-medium">● {highPriority.length} High Priority</span>
                  <span className="text-amber-700 font-medium">● {midPriority.length} Medium</span>
                  <span className="text-gray-500 font-medium">● {lowPriority.length} Lower Priority</span>
                </div>
              </div>
            </div>
          </div>

          {/* Suggestion cards */}
          {result.suggestions.map((s, i) => {
            const key = photoKey(i);
            const photo = photoMap[key];
            const imgError = imgErrors[key];

            return (
              <div key={i}
                className={`card border overflow-hidden transition-shadow hover:shadow-md ${
                  s.priority === "high" ? "border-green-200" : s.priority === "medium" ? "border-amber-200" : "border-gray-200"
                }`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Photo or emoji */}
                      <div className="flex-shrink-0">
                        {photo ? (
                          <div className="relative group w-20 h-20">
                            {/* Always render img so it loads; show spinner overlay while loading */}
                            {loadingImgs[key] && !imgError && (
                              <div className="absolute inset-0 rounded-xl border border-brand-200 bg-brand-50 flex flex-col items-center justify-center gap-1 z-10">
                                <RefreshCw size={14} className="animate-spin text-brand-400" />
                                <span className="text-[9px] text-brand-500 font-medium">Generating…</span>
                              </div>
                            )}
                            {imgError ? (
                              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-red-200 bg-red-50 flex flex-col items-center justify-center gap-1 cursor-pointer"
                                onClick={() => generateAIImage(i, s)}>
                                <span className="text-[9px] text-red-400 text-center px-1">Failed.<br/>Click retry</span>
                              </div>
                            ) : (
                              <img
                                src={photo}
                                alt={s.name}
                                className={`w-20 h-20 object-cover rounded-xl border border-gray-200 ${loadingImgs[key] ? "opacity-0" : ""}`}
                                onLoad={() => setLoadingImgs(prev => { const n={...prev}; delete n[key]; return n; })}
                                onError={() => {
                                  setImgErrors(prev => ({ ...prev, [key]: true }));
                                  setLoadingImgs(prev => { const n={...prev}; delete n[key]; return n; });
                                }}
                              />
                            )}
                            {!loadingImgs[key] && !imgError && (
                              <button
                                onClick={() => removePhoto(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center z-20"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-3xl">
                            {CAT_EMOJI[s.category] ?? "👠"}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{s.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${PRIORITY_COLORS[s.priority]}`}>
                            {s.priority} priority
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{s.productType}</span>
                          <span className="text-xs text-gray-400">{s.targetMarket}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{s.colorway} · {s.material}</p>

                        {/* Photo action buttons */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => generateAIImage(i, s)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors"
                          >
                            <Wand2 size={11} /> AI Image
                          </button>
                          <label className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer">
                            <Upload size={11} /> Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              ref={el => { fileRefs.current[i] = el; }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(i, f); }}
                            />
                          </label>
                          {(photo || imgError) && (
                            <button onClick={() => removePhoto(i)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-brand-700 text-sm">{s.suggestedRetailRm}</p>
                      {s.recommendedManufacturer && (
                        <p className="text-xs text-gray-400 mt-0.5">{s.recommendedManufacturer}</p>
                      )}
                    </div>
                  </div>

                  {/* Expand/collapse */}
                  <button onClick={() => setExpanded(expanded === i ? null : i)}
                    className="mt-3 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800">
                    {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expanded === i ? "Less detail" : "Full details"}
                  </button>

                  {expanded === i && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {/* Full-size image if available */}
                      {photo && !imgError && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Product Visual</p>
                          <img
                            src={photo}
                            alt={s.name}
                            className="w-full max-w-sm rounded-xl border border-gray-200 object-cover"
                            style={{ maxHeight: 320 }}
                            onError={() => setImgErrors(prev => ({ ...prev, [key]: true }))}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Key Design Elements</p>
                          <p className="text-sm text-gray-800">{s.keyDesignElements}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Why It's Trending</p>
                          <p className="text-sm text-gray-800">{s.whyTrending}</p>
                        </div>
                        {s.heelHeight && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Heel</p>
                            <p className="text-sm text-gray-800">{s.heelHeight}</p>
                          </div>
                        )}
                        {s.hardware && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hardware</p>
                            <p className="text-sm text-gray-800">{s.hardware}</p>
                          </div>
                        )}
                        <div className="col-span-2 pt-2">
                          <Link href="/dashboard/samples/new"
                            className="btn-secondary text-xs flex items-center gap-1.5 w-fit">
                            <ShoppingCart size={13} /> Create Sample Order for this product
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="text-center pt-2">
            <button onClick={generate} disabled={loading}
              className="btn-secondary flex items-center gap-2 mx-auto text-sm">
              <RefreshCw size={14} /> Regenerate with same settings
            </button>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="card p-16 text-center text-gray-400">
          <Sparkles size={40} className="mx-auto mb-4 text-brand-200" />
          <p className="font-medium text-gray-600">No suggestions generated yet</p>
          <p className="text-sm mt-1">Fill in the settings above and click Generate to get AI-powered collection ideas.</p>
          <p className="text-xs mt-3">For best results: add trend items in the Trend Board and past best sellers first.</p>
        </div>
      )}
    </div>
  );
}
