"use client";

import { Monitor, Moon, Sun, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";

const options: {
  id: ThemePreference;
  label: string;
  icon: typeof Sun;
  detail: string;
}[] = [
  { id: "system", label: "System default", icon: Monitor, detail: "Follow device" },
  { id: "light", label: "Light", icon: Sun, detail: "Bright interface" },
  { id: "dark", label: "Dark", icon: Moon, detail: "Low-light interface" },
];

export default function ThemeControl({
  className = "",
  fixed = false,
}: {
  className?: string;
  fixed?: boolean;
}) {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const CurrentIcon = preference === "system" ? Monitor : preference === "dark" ? Moon : Sun;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`${fixed ? "fixed right-4 top-4 z-[110]" : "relative"} ${className}`}>
      <button
        type="button"
        aria-label={`Theme: ${preference === "system" ? `System default (${resolvedTheme})` : preference}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose appearance"
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-orange-200 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <CurrentIcon size={17} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className="absolute right-0 top-[calc(100%+0.55rem)] z-[100] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900 dark:text-white"
        >
          <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Appearance
          </p>
          {options.map(({ id, label, detail, icon: Icon }) => {
            const selected = preference === id;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPreference(id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                  selected
                    ? "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected ? "bg-white/80 dark:bg-white/10" : "bg-slate-100 dark:bg-slate-800"}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{label}</span>
                  <span className="block text-[10px] opacity-65">{detail}</span>
                </span>
                {selected && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
