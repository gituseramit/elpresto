"use client";

import React, { useState } from "react";
import { Crown, Flame, Award, TrendingUp, Sparkles } from "lucide-react";

interface CategoryItem {
  name: string;
  revenue: number;
  itemsSold?: number;
}

interface Modern3DCategoryChartProps {
  data: CategoryItem[];
  title?: string;
  subtitle?: string;
}

export default function Modern3DCategoryChart({
  data,
  title = "3D Category Performance Pillars",
  subtitle = "Revenue depth and sales distribution by section",
}: Modern3DCategoryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-60 w-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-950/40 p-6 text-center">
        <Crown size={28} className="text-slate-700 mb-2" />
        <p className="text-xs font-bold text-slate-500">No category sales recorded</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.revenue || 0), 100);
  const totalRevenue = data.reduce((sum, d) => sum + (d.revenue || 0), 0);

  // Take top 6 categories
  const topCategories = data.slice(0, 6);

  return (
    <div className="relative w-full rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-4 sm:p-5 backdrop-blur-2xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <Sparkles size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wide text-white">{title}</h4>
            <p className="text-[10px] font-semibold text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400 border border-emerald-500/20">
          <TrendingUp size={12} />
          <span>₹{Math.round(totalRevenue).toLocaleString()} Total</span>
        </div>
      </div>

      {/* 3D Pillars Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-2">
        {topCategories.map((cat, idx) => {
          const rev = cat.revenue || 0;
          const pctOfMax = Math.min(100, Math.max(12, Math.round((rev / maxVal) * 100)));
          const pctOfTotal = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : "0";
          const isHovered = hoveredIdx === idx;
          const isTopOne = idx === 0;

          return (
            <div
              key={`cat-pillar-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-3 transition-all duration-300 cursor-pointer ${
                isHovered
                  ? "border-emerald-400/40 bg-slate-800/80 -translate-y-1.5 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-400/30"
                  : isTopOne
                  ? "border-amber-500/30 bg-slate-900/60 shadow-lg shadow-amber-500/5"
                  : "border-white/5 bg-slate-950/40 hover:border-white/10 hover:bg-slate-900/40"
              }`}
            >
              {/* Badge & Rank */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-md font-mono text-[10px] font-black ${
                    isTopOne
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                      : idx === 1
                      ? "bg-slate-400 text-slate-950"
                      : idx === 2
                      ? "bg-amber-700 text-white"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  #{idx + 1}
                </span>

                {isTopOne ? (
                  <Crown size={14} className="text-amber-400 animate-bounce" />
                ) : (
                  <span className="font-mono text-[9px] font-bold text-slate-500">
                    {pctOfTotal}%
                  </span>
                )}
              </div>

              {/* 3D Vertical Pillar Cylinder / Block */}
              <div className="relative my-2 flex h-32 w-full items-end justify-center rounded-xl bg-slate-950/60 p-2 overflow-hidden border border-white/5">
                {/* 3D Ground Shadow */}
                <div className="absolute bottom-1 h-3 w-4/5 rounded-full bg-emerald-500/20 blur-sm" />

                {/* Vertical Extruded 3D Bar */}
                <div
                  className="relative w-10 transition-all duration-500 flex flex-col justify-end"
                  style={{ height: `${pctOfMax}%` }}
                >
                  {/* Top 3D Cap */}
                  <div
                    className={`h-3 w-full rounded-t-lg transition-colors ${
                      isHovered
                        ? "bg-gradient-to-r from-emerald-200 to-white shadow-md shadow-emerald-400/40"
                        : isTopOne
                        ? "bg-gradient-to-r from-amber-300 to-yellow-100"
                        : "bg-gradient-to-r from-emerald-400 to-teal-300"
                    }`}
                    style={{
                      transform: "perspective(200px) rotateX(25deg)",
                      transformOrigin: "bottom",
                    }}
                  />

                  {/* Front Face with Linear Gradient & Depth Border */}
                  <div
                    className={`w-full flex-1 rounded-b-lg border-t-0 border-x transition-all ${
                      isHovered
                        ? "border-emerald-300 bg-gradient-to-b from-emerald-400 via-emerald-600 to-slate-900 shadow-lg shadow-emerald-500/30"
                        : isTopOne
                        ? "border-amber-400/50 bg-gradient-to-b from-amber-500 via-orange-600 to-slate-900"
                        : "border-emerald-500/30 bg-gradient-to-b from-emerald-500 via-teal-700 to-slate-900"
                    }`}
                  >
                    {/* Front Specular Sheen */}
                    <div className="h-full w-1 bg-white/20 ml-1 rounded-full" />
                  </div>
                </div>

                {/* Floating Metric on Hover */}
                {isHovered && (
                  <div className="absolute top-2 rounded-md bg-slate-900/90 px-1.5 py-0.5 font-mono text-[9px] font-black text-emerald-300 shadow ring-1 ring-white/10">
                    ₹{rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev}
                  </div>
                )}
              </div>

              {/* Category Details */}
              <div className="mt-1 min-w-0">
                <p className="truncate text-xs font-black text-white group-hover:text-emerald-300 transition-colors">
                  {cat.name}
                </p>
                <div className="mt-1 flex items-baseline justify-between font-mono text-[10px]">
                  <span className="font-black text-emerald-400">
                    ₹{Math.round(rev).toLocaleString()}
                  </span>
                  {cat.itemsSold !== undefined && (
                    <span className="font-semibold text-slate-500">
                      {cat.itemsSold} sold
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
