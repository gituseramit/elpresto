"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from "lucide-react";
import {
  getISTDateString,
  getISTDayBounds,
  formatISTDisplayDate,
} from "@/lib/orderQueries";

interface DateNavigatorProps {
  selectedDate: string;
  onChangeDate: (dateStr: string) => void;
  variant?: "dark" | "light";
  orderCount?: number;
  isLoading?: boolean;
}

export default function DateNavigator({
  selectedDate,
  onChangeDate,
  variant = "dark",
  orderCount,
  isLoading = false,
}: DateNavigatorProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const todayStr = getISTDateString(0);
  const isToday = selectedDate === todayStr;

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
    onChangeDate(getISTDateString(prev));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
    onChangeDate(getISTDateString(next));
  };

  const handleToday = () => {
    onChangeDate(todayStr);
  };

  const isDark = variant === "dark";

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-2xl p-1 text-xs font-bold transition-all ${
        isDark
          ? "border border-white/10 bg-slate-900/80 backdrop-blur-md text-white shadow-inner"
          : "border border-slate-200 bg-white text-slate-800 shadow-sm"
      }`}
    >
      {/* Previous Day */}
      <button
        type="button"
        onClick={handlePrevDay}
        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition active:scale-95 ${
          isDark
            ? "hover:bg-slate-800 text-slate-300 hover:text-white"
            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
        }`}
        title="Previous Day"
      >
        <ChevronLeft size={15} />
        <span className="hidden sm:inline text-[11px]">Prev</span>
      </button>

      {/* Date Picker Button */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            if (dateInputRef.current) {
              if (typeof dateInputRef.current.showPicker === "function") {
                dateInputRef.current.showPicker();
              } else {
                dateInputRef.current.focus();
              }
            }
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black transition ${
            isDark
              ? "bg-slate-800/80 hover:bg-slate-700/80 text-orange-400 border border-white/5"
              : "bg-slate-50 hover:bg-slate-100 text-[#D92312] border border-slate-200"
          }`}
        >
          <Calendar size={14} className={isDark ? "text-orange-400" : "text-[#D92312]"} />
          <span>{formatISTDisplayDate(selectedDate)}</span>
          {orderCount !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-black ${
                isDark
                  ? "bg-orange-500/20 text-orange-300"
                  : "bg-red-50 text-[#D92312]"
              }`}
            >
              {orderCount}
            </span>
          )}
        </button>

        {/* Hidden date picker input */}
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          max={todayStr}
          onChange={(e) => {
            if (e.target.value) {
              onChangeDate(e.target.value);
            }
          }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
          aria-label="Select order date"
        />
      </div>

      {/* Next Day */}
      <button
        type="button"
        onClick={handleNextDay}
        disabled={isToday}
        className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
          isDark
            ? "hover:bg-slate-800 text-slate-300 hover:text-white"
            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
        }`}
        title="Next Day"
      >
        <span className="hidden sm:inline text-[11px]">Next</span>
        <ChevronRight size={15} />
      </button>

      {/* Quick Today Button (only when not on today) */}
      {!isToday && (
        <button
          type="button"
          onClick={handleToday}
          className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-black uppercase tracking-wider transition ${
            isDark
              ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
              : "bg-red-100 text-[#D92312] hover:bg-red-200"
          }`}
          title="Return to Today"
        >
          <RotateCcw size={11} /> Today
        </button>
      )}
    </div>
  );
}
