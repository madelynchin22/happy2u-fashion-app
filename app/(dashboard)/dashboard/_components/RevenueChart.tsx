"use client";

interface RevenueChartProps {
  data?: number[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const points = data && data.length > 0
    ? data
    : Array.from({ length: 30 }, (_, i) => {
        const base = 1800 + (i / 29) * 1800;
        const wave = Math.sin(i * 0.7 + 0.5) * 600;
        return Math.round(base + wave);
      });

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const W = 900;
  const H = 200;
  const PAD_L = 70;
  const PAD_R = 20;
  const PAD_T = 10;
  const PAD_B = 30;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const toX = (i: number) => PAD_L + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - min) / range) * chartH;

  const linePath = points.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
  const areaPath = `${linePath} L ${toX(points.length - 1)} ${PAD_T + chartH} L ${toX(0)} ${PAD_T + chartH} Z`;

  const yTicks = [1500, 2000, 2500, 3000, 3500, 4000, 4500];
  const xLabels = [1, 6, 11, 16, 21, 26];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Revenue trend · last 30 days</h2>
        <p className="text-xs text-gray-400 text-right">Daily revenue · all<br />channels</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y grid lines + labels */}
        {yTicks.map(tick => {
          const y = PAD_T + chartH - ((tick - min) / range) * chartH;
          if (y < PAD_T || y > PAD_T + chartH) return null;
          return (
            <g key={tick}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                RM {tick >= 1000 ? `${tick / 1000}k` : tick}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* X-axis labels */}
        {xLabels.map(label => {
          const idx = label - 1;
          const x = toX(idx);
          return (
            <text key={label} x={x} y={H - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
