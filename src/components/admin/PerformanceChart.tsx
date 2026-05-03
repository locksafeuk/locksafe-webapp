"use client";

import { useMemo, useState } from "react";

export interface DailyPerformancePoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "revenue"
  | "ctr"
  | "cpc"
  | "roas";

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  format: (v: number) => string;
  /** Derive value from a row when the metric is a ratio. */
  derive?: (p: DailyPerformancePoint) => number;
}

const GBP = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const INT = (v: number) => Math.round(v).toLocaleString("en-GB");
const PCT = (v: number) => `${v.toFixed(2)}%`;
const X = (v: number) => `${v.toFixed(2)}x`;

const METRICS: Record<MetricKey, MetricDef> = {
  spend: { key: "spend", label: "Spend", color: "#f97316", format: GBP },
  revenue: { key: "revenue", label: "Revenue", color: "#16a34a", format: GBP },
  impressions: {
    key: "impressions",
    label: "Impressions",
    color: "#0ea5e9",
    format: INT,
  },
  clicks: { key: "clicks", label: "Clicks", color: "#6366f1", format: INT },
  conversions: {
    key: "conversions",
    label: "Conversions",
    color: "#a855f7",
    format: INT,
  },
  ctr: {
    key: "ctr",
    label: "CTR",
    color: "#06b6d4",
    format: PCT,
    derive: (p) => (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0),
  },
  cpc: {
    key: "cpc",
    label: "CPC",
    color: "#ef4444",
    format: GBP,
    derive: (p) => (p.clicks > 0 ? p.spend / p.clicks : 0),
  },
  roas: {
    key: "roas",
    label: "ROAS",
    color: "#10b981",
    format: X,
    derive: (p) => (p.spend > 0 ? p.revenue / p.spend : 0),
  },
};

const TABS: MetricKey[] = [
  "spend",
  "clicks",
  "impressions",
  "conversions",
  "revenue",
  "ctr",
  "cpc",
  "roas",
];

interface PerformanceChartProps {
  data: DailyPerformancePoint[];
  /** Width is responsive; this is the SVG viewBox width used for layout math. */
  height?: number;
}

function getValue(point: DailyPerformancePoint, metric: MetricDef): number {
  if (metric.derive) return metric.derive(point);
  return (point as unknown as Record<string, number>)[metric.key] ?? 0;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function PerformanceChart({
  data,
  height = 260,
}: PerformanceChartProps) {
  const [metric, setMetric] = useState<MetricKey>("spend");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Sort by date ascending so the line reads left-to-right.
  const sorted = useMemo(() => {
    return [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [data]);

  const def = METRICS[metric];
  const values = useMemo(
    () => sorted.map((p) => getValue(p, def)),
    [sorted, def],
  );

  const summary = useMemo(() => {
    const total = values.reduce((s, v) => s + v, 0);
    const avg = values.length > 0 ? total / values.length : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    return { total, avg, max };
  }, [values]);

  if (sorted.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg text-sm text-slate-500">
        No performance data yet.
      </div>
    );
  }

  // SVG layout
  const W = 800; // viewBox width
  const H = height;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const yMaxRaw = Math.max(...values, 0);
  const yMax = yMaxRaw === 0 ? 1 : yMaxRaw * 1.1;

  const xFor = (i: number) =>
    sorted.length === 1
      ? PAD_L + innerW / 2
      : PAD_L + (i / (sorted.length - 1)) * innerW;
  const yFor = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

  const linePath = sorted
    .map(
      (_, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(values[i]).toFixed(2)}`,
    )
    .join(" ");
  const areaPath =
    `${linePath} L ${xFor(sorted.length - 1).toFixed(2)} ${PAD_T + innerH} ` +
    `L ${xFor(0).toFixed(2)} ${PAD_T + innerH} Z`;

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH - p * innerH,
    value: yMax * p,
  }));

  // X-axis labels — show ~6 evenly spaced labels
  const labelCount = Math.min(6, sorted.length);
  const xLabelIdx = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / Math.max(labelCount - 1, 1)) * (sorted.length - 1)),
  );

  const hovered = hoverIdx !== null ? sorted[hoverIdx] : null;
  const hoveredValue = hoverIdx !== null ? values[hoverIdx] : null;

  return (
    <div>
      {/* Metric tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map((k) => {
          const m = METRICS[k];
          const active = k === metric;
          return (
            <button
              type="button"
              key={k}
              onClick={() => setMetric(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
              style={
                active
                  ? { backgroundColor: m.color, borderColor: m.color }
                  : undefined
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Total
          </div>
          <div className="text-base font-bold text-slate-900">
            {def.format(summary.total)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Avg / day
          </div>
          <div className="text-base font-bold text-slate-900">
            {def.format(summary.avg)}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Peak day
          </div>
          <div className="text-base font-bold text-slate-900">
            {def.format(summary.max)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${def.label} over time`}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={def.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={def.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y grid + labels */}
          {yTicks.map((t) => (
            <g key={`yt-${t.y}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={t.y}
                y2={t.y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 8}
                y={t.y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
              >
                {def.format(t.value)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xLabelIdx.map((idx) => (
            <text
              key={idx}
              x={xFor(idx)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {formatDateShort(sorted[idx].date)}
            </text>
          ))}

          {/* Area + line */}
          <path d={areaPath} fill={`url(#grad-${metric})`} />
          <path
            d={linePath}
            fill="none"
            stroke={def.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Points */}
          {sorted.map((p, i) => (
            <circle
              key={`pt-${p.date}`}
              cx={xFor(i)}
              cy={yFor(values[i])}
              r={hoverIdx === i ? 4.5 : 3}
              fill="#ffffff"
              stroke={def.color}
              strokeWidth="2"
            />
          ))}

          {/* Hover hit-zones */}
          {sorted.map((p, i) => {
            const x = xFor(i);
            const left = i === 0 ? PAD_L : (xFor(i - 1) + x) / 2;
            const right =
              i === sorted.length - 1 ? W - PAD_R : (x + xFor(i + 1)) / 2;
            return (
              <rect
                key={`hit-${p.date}`}
                x={left}
                y={PAD_T}
                width={Math.max(right - left, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}

          {/* Hover guideline */}
          {hoverIdx !== null && (
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke={def.color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
          )}
        </svg>

        {/* Tooltip */}
        {hovered && hoveredValue !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
            style={{
              left: `${(xFor(hoverIdx ?? 0) / W) * 100}%`,
              top: `${(yFor(hoveredValue) / H) * 100}%`,
              marginTop: -8,
            }}
          >
            <div className="font-semibold">{formatDateShort(hovered.date)}</div>
            <div className="text-slate-300">
              {def.label}:{" "}
              <span className="text-white font-semibold">
                {def.format(hoveredValue)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
