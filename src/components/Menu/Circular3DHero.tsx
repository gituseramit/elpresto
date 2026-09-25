"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Star,
  Flame,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useCartStore, MenuItem } from "@/store/useCartStore";

export interface ShowcaseDish {
  id: string;
  name: string;
  tagline: string;
  price: number;
  rating: number;
  reviewsCount: string;
  description: string;
  category: string;
  imageUrl: string;
  badge: string;
  isVeg?: boolean;
}

const SHOWCASE_DISHES: ShowcaseDish[] = [
  {
    id: "itp6",
    name: "EL PRESTO SPECIAL PIZZA",
    tagline: "100% Whole Wheat Artisan Dough",
    price: 199,
    rating: 4.9,
    reviewsCount: "680+",
    description:
      "Chef's prized recipe with spiced herb sauce, juicy paneer cubes, crunchy peppers & stretchy real mozzarella on crisp stoneground atta.",
    category: "Chef's Signature",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    badge: "🔥 Chef Special",
    isVeg: true,
  },
  {
    id: "dhm6",
    name: "Farmhouse Whole Wheat Pizza",
    tagline: "Garden Fresh & Zero Palm Oil",
    price: 179,
    rating: 4.8,
    reviewsCount: "420+",
    description:
      "Packed with crunchy capsicum, diced sweet onions, farm mushrooms and sweet corn on 100% pure wheat crust.",
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
    badge: "🌱 Best Value",
    isVeg: true,
  },
  {
    id: "itp1",
    name: "Paneer Makhani Pizza",
    tagline: "Desi Butter Gravy Crust",
    price: 149,
    rating: 4.9,
    reviewsCount: "510+",
    description:
      "Rich buttery makhani gravy smothered over soft malai paneer, baked to golden perfection with aromatic kasuri methi.",
    category: "Indian Tadka",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
    badge: "🧀 Extra Cheese",
    isVeg: true,
  },
  {
    id: "bg4",
    name: "Paneer Deluxe Protein Burger",
    tagline: "Whole Grain Bun • Grilled Patty",
    price: 99,
    rating: 4.7,
    reviewsCount: "380+",
    description:
      "Thick grilled paneer patty topped with crisp ice-cold lettuce, vine tomatoes, and signature garlic yogurt mayo.",
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    badge: "🍔 Protein Hit",
    isVeg: true,
  },
  {
    id: "sd2",
    name: "Stuffed Cheesy Garlic Bread",
    tagline: "Pure Melted Mozzarella Stuffed",
    price: 99,
    rating: 4.9,
    reviewsCount: "740+",
    description:
      "Golden pull-apart loaf baked with roasted garlic butter, fresh parsley, and an overflowing core of stringy mozzarella.",
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800&q=80",
    badge: "⭐ Hot Favorite",
    isVeg: true,
  },
  {
    id: "bv1",
    name: "Desi Chilled Cold Coffee",
    tagline: "Zero Refined Sugar • Fresh Cream",
    price: 49,
    rating: 4.8,
    reviewsCount: "620+",
    description:
      "Slow-brewed dark roast blended with chilled thick cream and raw country sweetness. 100% pure guilt-free energy booster!",
    category: "Beverages",
    imageUrl:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80",
    badge: "☕ Instant Refresh",
    isVeg: true,
  },
];

export default function Circular3DHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const activeDish = SHOWCASE_DISHES[activeIndex];
  const total = SHOWCASE_DISHES.length;

  // Auto-rotate every 5s while not hovered
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(
      () => setActiveIndex((p) => (p + 1) % total),
      5000
    );
    return () => clearInterval(id);
  }, [isPaused, total]);

  const handlePrev = () => setActiveIndex((p) => (p - 1 + total) % total);
  const handleNext = () => setActiveIndex((p) => (p + 1) % total);

  const handleAddToCart = () => {
    const menuItem: MenuItem = {
      id: activeDish.id,
      name: activeDish.name,
      price: activeDish.price,
      category: activeDish.category,
      imageUrl: activeDish.imageUrl,
      available: true,
      description: activeDish.description,
    };
    addItem(menuItem);
  };

  const isItemInCart = cartItems.some((i) => i.id === activeDish.id);

  return (
    <section
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden bg-[#0A0403] py-14 text-white sm:py-20 md:py-24"
    >
      {/* ---- Scoped keyframes (no external CSS needed) ---- */}
      <style>{`
        @keyframes luxFadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes luxImageIn {
          from { opacity: 0; transform: scale(1.06) rotate(-2deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes luxSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .lux-fade-up  { animation: luxFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        .lux-image-in { animation: luxImageIn 1s cubic-bezier(0.16,1,0.3,1) both; }
        .lux-spin     { animation: luxSpin 45s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .lux-fade-up, .lux-image-in, .lux-spin { animation: none !important; }
        }
      `}</style>

      {/* ---- Ambient luxury glow ---- */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.18),transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(217,35,18,0.14),transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.10),transparent)] blur-3xl" />

      {/* ---- Hairline gold accents ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      <div className="container relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        {/* ============ HEADER ============ */}
        <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400 sm:text-[11px]">
              Signature Collection
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70 sm:text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Live Kitchen · Freshly Baked</span>
          </div>
        </div>

        {/* ============ MAIN GRID ============ */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ---------- LEFT: CIRCULAR PORTRAIT ---------- */}
          <div className="order-1 lg:col-span-6">
            <div className="relative mx-auto w-full max-w-[420px]">
              {/* rotating dashed halo */}
              <div className="lux-spin pointer-events-none absolute -inset-6 rounded-full border border-dashed border-amber-500/25" />
              {/* soft gold halo */}
              <div className="pointer-events-none absolute -inset-3 rounded-full border border-amber-500/15" />
              <div className="pointer-events-none absolute -inset-2 rounded-full bg-amber-500/10 blur-2xl" />

              {/* gold gradient ring */}
              <div className="relative aspect-square rounded-full bg-gradient-to-tr from-amber-500 via-amber-200 to-red-600 p-[3px] shadow-[0_25px_80px_-15px_rgba(245,158,11,0.55)]">
                {/* dark inner gap */}
                <div className="relative h-full w-full rounded-full bg-[#0A0403] p-1.5">
                  {/* keyed image for smooth fade */}
                  <div
                    key={activeDish.id}
                    className="lux-image-in relative h-full w-full overflow-hidden rounded-full"
                  >
                    <Image
                      src={activeDish.imageUrl}
                      alt={activeDish.name}
                      fill
                      sizes="(max-width: 768px) 90vw, 420px"
                      priority
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
                  </div>
                </div>
              </div>

              {/* floating rating chip */}
              <div className="absolute -left-1 top-4 z-20 flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/75 px-3 py-1.5 backdrop-blur-md sm:-left-2">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-black text-white">
                  {activeDish.rating}
                </span>
                <span className="text-[10px] text-gray-400">
                  · {activeDish.reviewsCount}
                </span>
              </div>

              {/* floating veg chip */}
              <div className="absolute -right-1 bottom-6 z-20 flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-black/75 px-3 py-1.5 backdrop-blur-md sm:-right-2">
                <span className="flex h-3 w-3 items-center justify-center rounded-sm border border-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-bold text-emerald-300">
                  100% Atta
                </span>
              </div>

              {/* nav arrows */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous dish"
                className="absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/40 bg-black/60 text-amber-300 backdrop-blur-md transition-all hover:scale-110 hover:border-amber-400 hover:bg-black/80 active:scale-95 sm:-left-3"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next dish"
                className="absolute right-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/40 bg-black/60 text-amber-300 backdrop-blur-md transition-all hover:scale-110 hover:border-amber-400 hover:bg-black/80 active:scale-95 sm:-right-3"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* ---------- RIGHT: DETAILS ---------- */}
          <div
            key={activeDish.id}
            className="lux-fade-up order-2 space-y-5 lg:col-span-6"
          >
            {/* badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-500/40 bg-red-600/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-300">
                {activeDish.badge}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                {activeDish.category}
              </span>
            </div>

            {/* name + tagline */}
            <div className="space-y-2">
              <h2
                className="text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl md:text-5xl"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {activeDish.name}
              </h2>
              <p className="text-sm font-semibold italic text-amber-400/90 sm:text-base">
                {activeDish.tagline}
              </p>
            </div>

            {/* ornamental divider */}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
              <Sparkles size={14} className="text-amber-500" />
              <span className="h-px flex-1 bg-gradient-to-l from-amber-500/50 to-transparent" />
            </div>

            {/* description */}
            <p className="text-sm leading-relaxed text-gray-300/90 sm:text-base">
              {activeDish.description}
            </p>

            {/* meta trio */}
            <div className="flex flex-wrap items-center gap-4 pt-1 sm:gap-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-black text-white">
                    {activeDish.rating}{" "}
                    <span className="text-[10px] font-bold text-gray-400">
                      / 5
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    {activeDish.reviewsCount} reviews
                  </div>
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                  <ShieldCheck size={14} className="text-emerald-400" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-black text-white">
                    No Palm Oil
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    Quality assured
                  </div>
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
                  <Flame size={14} className="text-red-400" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-black text-white">
                    Baked Fresh
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    In 12 mins
                  </div>
                </div>
              </div>
            </div>

            {/* price + CTA */}
            <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black tracking-tight text-amber-400 sm:text-5xl">
                  ₹{activeDish.price}
                </span>
                <span className="text-sm text-gray-500 line-through">
                  ₹{Math.round(activeDish.price * 1.3)}
                </span>
                <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                  SAVE 23%
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 px-7 py-3.5 text-sm font-black uppercase tracking-wider text-black shadow-[0_15px_40px_-12px_rgba(245,158,11,0.7)] transition-all hover:scale-[1.03] hover:shadow-[0_20px_50px_-12px_rgba(245,158,11,0.9)] active:scale-95"
              >
                <Plus size={18} strokeWidth={3} />
                <span>{isItemInCart ? "Add Another" : "Add to Cart"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============ THUMBNAIL RAIL ============ */}
        <div className="mt-12 sm:mt-16">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80">
              Explore the Menu
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {SHOWCASE_DISHES.map((dish, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  aria-label={`View ${dish.name}`}
                  aria-current={isActive}
                  className={`group relative h-12 w-12 shrink-0 rounded-full p-[2px] transition-all duration-500 sm:h-14 sm:w-14 ${
                    isActive
                      ? "scale-110 bg-gradient-to-tr from-amber-400 via-amber-200 to-red-600 shadow-[0_0_25px_-4px_rgba(245,158,11,0.8)]"
                      : "bg-white/10 hover:bg-white/30"
                  }`}
                >
                  <span className="relative block h-full w-full overflow-hidden rounded-full">
                    <Image
                      src={dish.imageUrl}
                      alt={dish.name}
                      fill
                      sizes="64px"
                      className={`object-cover transition-transform duration-500 ${
                        isActive ? "scale-100" : "scale-95 group-hover:scale-105"
                      }`}
                    />
                  </span>
                  {isActive && (
                    <span className="pointer-events-none absolute -inset-1 rounded-full border border-amber-400/40" />
                  )}
                </button>
              );
            })}
          </div>

          {/* counter */}
          <div className="mt-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/60">
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")} · {activeDish.category}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}