"use client";

import React, { useState } from "react";
import { PieChart as PieIcon, Sparkles } from "lucide-react";

interface DonutSlice {
  name: string;
  value: number;
}

interface Modern3DDonutChartProps {
  data: DonutSlice[];
  title?: string;
  totalLabel?: string;
  colors?: string[];
  height?: number;
}

const DEFAULT_3D_COLORS = [
  { top: "#f97316", side: "#c2410c", rim: "#fdba74" }, // Orange
  { top: "#3b82f6", side: "#1d4ed8", rim: "#93c5fd" }, // Blue
  { top: "#10b981", side: "#047857", rim: "#6ee7b7" }, // Emerald
  { top: "#a855f7", side: "#7e22ce", rim: "#d8b4fe" }, // Purple
  { top: "#eab308", side: "#a16207", rim: "#fde047" }, // Amber
  { top: "#ec4899", side: "#be185d", rim: "#f472b6" }, // Pink
];

export default function Modern3DDonutChart({
  data,
  title = "3D Order Distribution",
  totalLabel = "Total Volume",
  colors,
  height = 270,
}: Modern3DDonutChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex h-60 w-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-950/40 p-6 text-center">
        <PieIcon size={28} className="text-slate-700 mb-2" />
        <p className="text-xs font-bold text-slate-500">No volume recorded</p>
      </div>
    );
  }

  // 3D Donut Dimensions
  const cx = 150;
  const cy = 115;
  const rx = 100;
  const ry = 62; // Elliptical tilt for 3D perspective
  const innerRx = 55;
  const innerRy = 34;
  const depth = 22; // 3D extrusion depth

  // Calculate angles
  let currentAngle = -Math.PI / 2; // start from top
  const slices = data.map((item, i) => {
    const val = item.value || 0;
    const sliceAngle = (val / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = currentAngle + sliceAngle / 2;
    currentAngle = endAngle;

    const colorScheme =
      DEFAULT_3D_COLORS[i % DEFAULT_3D_COLORS.length];

    return {
      ...item,
      percentage: total > 0 ? (val / total) * 100 : 0,
      startAngle,
      endAngle,
      midAngle,
      color: colorScheme,
    };
  });

  // Helper to compute SVG arc coordinates
  const getPoint = (angle: number, radiusX: number, radiusY: number, offsetY = 0) => ({
    x: cx + radiusX * Math.cos(angle),
    y: cy + radiusY * Math.sin(angle) + offsetY,
  });

  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-4 sm:p-5 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-orange-500/10 text-orange-400">
            <Sparkles size={13} />
          </div>
          <h4 className="text-xs font-black tracking-wide text-white">{title}</h4>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-400">
          3D Radial
        </span>
      </div>

      {/* SVG 3D Canvas */}
      <div className="relative flex items-center justify-center my-1">
        <svg
          viewBox="0 0 300 230"
          className="w-full max-w-[280px] overflow-visible"
          style={{ filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.6))" }}
        >
          <defs>
            <filter id="donut-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>

          {/* 3D Base Shadow on Ground */}
          <ellipse
            cx={cx}
            cy={cy + depth + 10}
            rx={rx * 0.95}
            ry={ry * 0.9}
            fill="rgba(0, 0, 0, 0.65)"
            filter="url(#donut-shadow)"
          />

          {/* 1. 3D CYLINDER DEPTH SIDES (Bottom half visible extrusions) */}
          <g className="cylinder-depth">
            {slices.map((slice, i) => {
              // Only draw front-facing depth arcs (between 0 and PI)
              const isHovered = activeIdx === i;
              const liftX = isHovered ? Math.cos(slice.midAngle) * 5 : 0;
              const liftY = isHovered ? Math.sin(slice.midAngle) * 3 : 0;

              // Outer boundary points
              const p1Top = getPoint(slice.startAngle, rx, ry);
              const p2Top = getPoint(slice.endAngle, rx, ry);
              const p1Bottom = getPoint(slice.startAngle, rx, ry, depth);
              const p2Bottom = getPoint(slice.endAngle, rx, ry, depth);

              // Large arc flag
              const largeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;

              return (
                <path
                  key={`side-${i}`}
                  d={`
                    M ${p1Top.x + liftX} ${p1Top.y + liftY}
                    A ${rx} ${ry} 0 ${largeArc} 1 ${p2Top.x + liftX} ${p2Top.y + liftY}
                    L ${p2Bottom.x + liftX} ${p2Bottom.y + liftY}
                    A ${rx} ${ry} 0 ${largeArc} 0 ${p1Bottom.x + liftX} ${p1Bottom.y + liftY}
                    Z
                  `}
                  fill={isHovered ? slice.color.top : slice.color.side}
                  opacity={0.92}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="0.5"
                  className="transition-all duration-200"
                />
              );
            })}
          </g>

          {/* 2. TOP 3D DONUT SLICES */}
          <g className="top-slices">
            {slices.map((slice, i) => {
              const isHovered = activeIdx === i;
              const liftX = isHovered ? Math.cos(slice.midAngle) * 6 : 0;
              const liftY = isHovered ? Math.sin(slice.midAngle) * 4 : 0;

              const p1Out = getPoint(slice.startAngle, rx, ry);
              const p2Out = getPoint(slice.endAngle, rx, ry);
              const p1In = getPoint(slice.startAngle, innerRx, innerRy);
              const p2In = getPoint(slice.endAngle, innerRx, innerRy);

              const largeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;

              return (
                <g
                  key={`slice-${i}`}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                >
                  <path
                    d={`
                      M ${p1In.x + liftX} ${p1In.y + liftY}
                      L ${p1Out.x + liftX} ${p1Out.y + liftY}
                      A ${rx} ${ry} 0 ${largeArc} 1 ${p2Out.x + liftX} ${p2Out.y + liftY}
                      L ${p2In.x + liftX} ${p2In.y + liftY}
                      A ${innerRx} ${innerRy} 0 ${largeArc} 0 ${p1In.x + liftX} ${p1In.y + liftY}
                      Z
                    `}
                    fill={isHovered ? "#ffffff" : slice.color.top}
                    stroke={slice.color.rim}
                    strokeWidth={isHovered ? "2" : "1"}
                    className="transition-all duration-200"
                    style={{
                      filter: isHovered
                        ? "drop-shadow(0 0 10px rgba(255,255,255,0.4))"
                        : "none",
                    }}
                  />
                </g>
              );
            })}
          </g>

          {/* 3. CENTER GLASS KPI BADGE */}
          <g className="center-kpi pointer-events-none">
            <ellipse
              cx={cx}
              cy={cy}
              rx={innerRx - 5}
              ry={innerRy - 4}
              fill="rgba(15, 23, 42, 0.95)"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="9"
              fontWeight="bold"
              className="uppercase tracking-widest"
            >
              {activeIdx !== null ? slices[activeIdx].name : "Total"}
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="14"
              fontWeight="900"
              fontFamily="monospace"
            >
              {activeIdx !== null ? slices[activeIdx].value : total}
            </text>
          </g>
        </svg>
      </div>

      {/* Modern Interactive Legend */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
        {slices.map((slice, i) => {
          const isHovered = activeIdx === i;
          return (
            <div
              key={`legend-${i}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              className={`flex items-center justify-between gap-1.5 rounded-xl border p-2 transition cursor-pointer ${
                isHovered
                  ? "border-white/25 bg-white/10 shadow-md ring-1 ring-white/20"
                  : "border-white/5 bg-slate-950/40 hover:border-white/10 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: slice.color.top }}
                />
                <span className="truncate text-[11px] font-bold text-slate-300">
                  {slice.name}
                </span>
              </div>
              <div className="flex items-baseline gap-1 shrink-0 font-mono text-[10px]">
                <span className="font-black text-white">{slice.value}</span>
                <span className="font-semibold text-slate-500">
                  ({slice.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
