"use client";

import React, { useState, useId } from "react";
import { Sparkles, Layers, Eye } from "lucide-react";

export interface DataPoint {
  name: string;
  revenue: number;
  orders?: number;
  itemsSold?: number;
}

interface Modern3DBarChartProps {
  data: DataPoint[];
  title?: string;
  theme?: "orange" | "emerald" | "purple";
  height?: number;
  showOrdersBadge?: boolean;
}

export default function Modern3DBarChart({
  data,
  title = "3D Revenue Visualization",
  theme = "orange",
  height = 290,
  showOrdersBadge = true,
}: Modern3DBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [viewAngle, setViewAngle] = useState<"isometric" | "high-depth" | "subtle">("isometric");
  const uniqueId = useId().replace(/:/g, "");

  // Fallback empty
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-950/40 p-6 text-center">
        <Layers size={32} className="text-slate-700 mb-2" />
        <p className="text-xs font-bold text-slate-500">No data points available for this period</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 100);
  // Add 18% headroom for 3D cap
  const maxScale = Math.ceil(maxVal * 1.18);

  // Depth angle presets
  const depthConfig = {
    isometric: { dx: 14, dy: -12 },
    "high-depth": { dx: 20, dy: -18 },
    subtle: { dx: 8, dy: -7 },
  }[viewAngle];

  // Theme palettes
  const palettes = {
    orange: {
      frontGrad: ["#ff782d", "#ea580c", "#c2410c"],
      topCap: "#fed7aa",
      topCapHover: "#ffffff",
      sideFace: "#9a3412",
      sideFaceHover: "#c2410c",
      glowColor: "rgba(249, 115, 22, 0.45)",
      accentText: "text-orange-400",
      accentBorder: "border-orange-500/30",
      accentBg: "bg-orange-500/10",
    },
    emerald: {
      frontGrad: ["#34d399", "#10b981", "#047857"],
      topCap: "#a7f3d0",
      topCapHover: "#ffffff",
      sideFace: "#065f46",
      sideFaceHover: "#047857",
      glowColor: "rgba(168, 85, 247, 0.45)",
      accentText: "text-emerald-400",
      accentBorder: "border-emerald-500/30",
      accentBg: "bg-emerald-500/10",
    },
    purple: {
      frontGrad: ["#c084fc", "#a855f7", "#7e22ce"],
      topCap: "#e9d5ff",
      topCapHover: "#ffffff",
      sideFace: "#6b21a8",
      sideFaceHover: "#7e22ce",
      glowColor: "rgba(168, 85, 247, 0.45)",
      accentText: "text-purple-400",
      accentBorder: "border-purple-500/30",
      accentBg: "bg-purple-500/10",
    },
  }[theme];

  // SVG dimensions
  const svgWidth = 620;
  const svgHeight = height;
  const paddingLeft = 65;
  const paddingRight = 40;
  const paddingTop = 36;
  const paddingBottom = 48;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;
  const baseline = paddingTop + chartH;

  const count = data.length;
  const step = chartW / Math.max(count, 1);
  const barWidth = Math.max(16, Math.min(36, step * 0.52));

  // Y axis grid lines (4 steps)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val: Math.round(maxScale * pct),
    y: baseline - chartH * pct,
  }));

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative w-full select-none overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-4 sm:p-5 backdrop-blur-2xl">
      {/* Header & 3D Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10">
            <Sparkles size={14} className={palettes.accentText} />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wide text-white">{title}</h4>
            <span className="text-[10px] font-semibold text-slate-400">
              Interactive 3D Isometric View
            </span>
          </div>
        </div>

        {/* 3D Depth Toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1 text-[10px] font-bold">
          <Eye size={12} className="ml-1.5 mr-0.5 text-slate-400" />
          {(["subtle", "isometric", "high-depth"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewAngle(mode)}
              className={`rounded-lg px-2.5 py-1 capitalize transition ${
                viewAngle === mode
                  ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Stage */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[480px] overflow-visible"
          style={{ filter: "drop-shadow(0 15px 30px rgba(0,0,0,0.5))" }}
        >
          <defs>
            {/* Front Face Gradient */}
            <linearGradient id={`front-grad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={palettes.frontGrad[0]} />
              <stop offset="60%" stopColor={palettes.frontGrad[1]} />
              <stop offset="100%" stopColor={palettes.frontGrad[2]} />
            </linearGradient>

            {/* Hover Front Face Gradient */}
            <linearGradient id={`front-grad-hover-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
              <stop offset="30%" stopColor={palettes.frontGrad[0]} />
              <stop offset="100%" stopColor={palettes.frontGrad[1]} />
            </linearGradient>

            {/* Specular Top Cap Gradient */}
            <linearGradient id={`top-cap-grad-${uniqueId}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={palettes.topCap} stopOpacity={0.8} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0.95} />
            </linearGradient>

            {/* 3D Floor Shadow Blur Filter */}
            <filter id={`shadow-blur-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id={`neon-glow-${uniqueId}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 3D Perspective Ground Grid Plane */}
          <g className="grid-floor opacity-35">
            {data.map((_, i) => {
              const xPos = paddingLeft + i * step + step / 2;
              return (
                <line
                  key={`floor-line-${i}`}
                  x1={xPos}
                  y1={baseline}
                  x2={xPos + depthConfig.dx * 1.5}
                  y2={baseline + depthConfig.dy * 1.5}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              );
            })}
            <line
              x1={paddingLeft}
              y1={baseline}
              x2={svgWidth - paddingRight}
              y2={baseline}
              stroke="#64748b"
              strokeWidth="1.5"
            />
            <line
              x1={paddingLeft + depthConfig.dx}
              y1={baseline + depthConfig.dy}
              x2={svgWidth - paddingRight + depthConfig.dx}
              y2={baseline + depthConfig.dy}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </g>

          {/* Y Axis Grid Lines with 3D depth offset */}
          <g className="y-axis">
            {yTicks.map((tick, i) => (
              <g key={`y-tick-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={svgWidth - paddingRight}
                  y2={tick.y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity={0.4}
                />
                <line
                  x1={svgWidth - paddingRight}
                  y1={tick.y}
                  x2={svgWidth - paddingRight + depthConfig.dx}
                  y2={tick.y + depthConfig.dy}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={paddingLeft - 12}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  ₹{tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : tick.val}
                </text>
              </g>
            ))}
          </g>

          {/* 3D Extruded Pillars */}
          <g className="bars-3d">
            {data.map((item, i) => {
              const rev = item.revenue || 0;
              const barH = Math.max(8, (rev / maxScale) * chartH);
              const isHovered = hoveredIdx === i;

              const slotCenter = paddingLeft + i * step + step / 2;
              const x = slotCenter - barWidth / 2;
              const y = baseline - barH;

              const dx = depthConfig.dx;
              const dy = depthConfig.dy;

              const liftY = isHovered ? -6 : 0;
              const actualY = y + liftY;
              const actualBase = baseline + liftY;

              return (
                <g
                  key={`bar3d-${i}`}
                  className="cursor-pointer transition-transform duration-300"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Floor Glow / Shadow */}
                  <ellipse
                    cx={x + barWidth / 2 + dx / 2}
                    cy={baseline + dy / 2 + 2}
                    rx={barWidth * 0.75}
                    ry={Math.abs(dy) * 0.65}
                    fill={isHovered ? palettes.glowColor : "rgba(0, 0, 0, 0.4)"}
                    filter={`url(#shadow-blur-${uniqueId})`}
                  />

                  {/* 1. FRONT FACE (Rectangle) */}
                  <rect
                    x={x}
                    y={actualY}
                    width={barWidth}
                    height={actualBase - actualY}
                    fill={`url(#${isHovered ? `front-grad-hover-${uniqueId}` : `front-grad-${uniqueId}`})`}
                    rx="3"
                    className="transition-all duration-200"
                    stroke={isHovered ? "#ffffff" : "rgba(255,255,255,0.15)"}
                    strokeWidth={isHovered ? "1.5" : "0.5"}
                  />

                  {/* Front Face Light Sheen Border */}
                  <line
                    x1={x + 1}
                    y1={actualY + 2}
                    x2={x + 1}
                    y2={actualBase - 2}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="1"
                  />

                  {/* 2. TOP FACE (3D Rhombus Cap) */}
                  <polygon
                    points={`
                      ${x},${actualY}
                      ${x + dx},${actualY + dy}
                      ${x + barWidth + dx},${actualY + dy}
                      ${x + barWidth},${actualY}
                    `}
                    fill={isHovered ? palettes.topCapHover : `url(#top-cap-grad-${uniqueId})`}
                    stroke={isHovered ? "#ffffff" : "rgba(255,255,255,0.3)"}
                    strokeWidth="0.8"
                    className="transition-all duration-200"
                  />

                  {/* 3. RIGHT SIDE FACE (3D Shaded Parallelogram) */}
                  <polygon
                    points={`
                      ${x + barWidth},${actualY}
                      ${x + barWidth + dx},${actualY + dy}
                      ${x + barWidth + dx},${actualBase + dy}
                      ${x + barWidth},${actualBase}
                    `}
                    fill={isHovered ? palettes.sideFaceHover : palettes.sideFace}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="0.5"
                    className="transition-all duration-200"
                  />

                  {/* X Axis Label */}
                  <text
                    x={slotCenter + dx / 2}
                    y={baseline + 20}
                    textAnchor="middle"
                    fill={isHovered ? "#ffffff" : "#94a3b8"}
                    fontSize="11"
                    fontWeight={isHovered ? "800" : "600"}
                    className="transition-colors"
                  >
                    {item.name}
                  </text>

                  {/* Value Tag on Top Cap */}
                  {rev > 0 && (
                    <text
                      x={slotCenter + dx}
                      y={actualY + dy - 6}
                      textAnchor="middle"
                      fill={isHovered ? "#ffffff" : "#cbd5e1"}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                      opacity={isHovered ? 1 : 0.8}
                    >
                      ₹{rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating 3D HUD Tooltip */}
        {activeItem && hoveredIdx !== null && (
          <div
            className="pointer-events-none absolute z-30 transition-all duration-150"
            style={{
              left: `${Math.min(
                Math.max(
                  paddingLeft + hoveredIdx * step + step / 2 - 70,
                  10
                ),
                svgWidth - 170
              )}px`,
              top: "12px",
            }}
          >
            <div className="flex flex-col gap-1 rounded-2xl border border-white/20 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 min-w-[140px]">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                  {activeItem.name}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  3D Pin
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-[10px] font-semibold text-slate-400">Revenue</span>
                <span className="font-mono text-xs font-black text-white">
                  ₹{activeItem.revenue.toLocaleString()}
                </span>
              </div>
              {showOrdersBadge && activeItem.orders !== undefined && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">Orders</span>
                  <span className="font-mono text-xs font-bold text-orange-400">
                    {activeItem.orders} orders
                  </span>
                </div>
              )}
              {activeItem.itemsSold !== undefined && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">Items Sold</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {activeItem.itemsSold} units
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Metrics Bar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-400 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Real-time 3D telemetry
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          Peak: ₹{maxVal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
