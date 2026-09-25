"use client";

import { useState, useEffect, useMemo } from "react";
import { CATEGORIES, DUMMY_MENU } from "@/data/menu";
import Circular3DHero from "@/components/Menu/Circular3DHero";
import TrendingNow from "@/components/Menu/TrendingNow";
import { subscribeAllProductRatings, ProductRatingSummary } from "@/lib/ratingService";

import { useCartStore, MenuItem } from "@/store/useCartStore";
import {
  Search,
  X,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Flame,
  Sparkles,
  Plus,
  Minus,
  Leaf,
  ShoppingBag,
  Trophy,
  Zap,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

const FREE_DELIVERY_THRESHOLD = 499;

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DUMMY_MENU);
  const [productRatings, setProductRatings] = useState<
    Record<string, ProductRatingSummary>
  >({});

  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);
  const getTotal = useCartStore((state) => state.getTotal);

  /* ---------- Live Firestore menu ---------- */
  useEffect(() => {
    let unsubscribe: any;
    const fetchMenu = async () => {
      try {
        const q = query(collection(db, "menuItems"));
        unsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            if (!querySnapshot.empty) {
              const items = querySnapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() } as MenuItem)
              );
              const map = new Map<string, MenuItem>();
              DUMMY_MENU.forEach((item) => map.set(item.id, item));
              items.forEach((item) => map.set(item.id, item));
              setMenuItems(Array.from(map.values()));
            }
          },
          (err) => console.warn("Firestore menu fallback to local:", err)
        );
      } catch (error) {
        console.warn("Error fetching live menu:", error);
      }
    };
    fetchMenu();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /* ---------- Ratings ---------- */
  useEffect(() => {
    const unsub = subscribeAllProductRatings((summaries) => {
      setProductRatings(summaries);
    });
    return () => unsub();
  }, []);

  const getQuantityInCart = (id: string) => {
    const item = cartItems.find((i) => i.id === id);
    return item ? item.quantity : 0;
  };

  /* ---------- Filters ---------- */
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [menuItems, searchQuery]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>(CATEGORIES.filter((cat) => cat !== "All"));
    menuItems.forEach((item) => {
      if (item.subcategory && item.subcategory !== "General") {
        set.add(item.subcategory);
      } else if (item.category && item.category !== "Food") {
        set.add(item.category);
      }
    });
    return Array.from(set);
  }, [menuItems]);

  const categorizedMenu = useMemo(() => {
    const grouped: { [key: string]: MenuItem[] } = {};
    categoriesList.forEach((cat) => {
      const items = filteredItems.filter(
        (item) => item.category === cat || item.subcategory === cat
      );
      if (items.length > 0) grouped[cat] = items;
    });
    const knownCats = new Set(categoriesList);
    const otherItems = filteredItems.filter(
      (i) => !knownCats.has(i.category) && !knownCats.has(i.subcategory || "")
    );
    if (otherItems.length > 0) grouped["Specials & Combos"] = otherItems;
    return grouped;
  }, [categoriesList, filteredItems]);

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalCartPrice = getTotal();
  const remainingForFreeDelivery = Math.max(
    0,
    FREE_DELIVERY_THRESHOLD - totalCartPrice
  );
  const freeDeliveryProgress = Math.min(
    100,
    (totalCartPrice / FREE_DELIVERY_THRESHOLD) * 100
  );

  const scrollToCategory = (catName: string) => {
    setActiveCategory(catName);
    if (catName === "All") {
      window.scrollTo({ top: 200, behavior: "smooth" });
      return;
    }
    const id =
      "category-" + catName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-orange-50/30 to-rose-50/30 pb-32">
      {/* ============================================================ */}
      {/* 0. 3D CIRCULAR HERO                                           */}
      {/* ============================================================ */}
      <Circular3DHero />

      {/* ============================================================ */}
      {/* 1. RESTAURANT HEADER BANNER                                    */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden px-4 pt-6 sm:pt-8">
        <div className="container mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.2)] backdrop-blur-2xl sm:p-7">
            <span className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-rose-400/15 blur-3xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              {/* Left: brand + info */}
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    100% Pure Veg
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 shadow-sm">
                    🌾 Stoneground Atta
                  </span>
                  <span className="rounded-full border border-red-200 bg-red-50/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 shadow-sm">
                    🚫 Zero Palm Oil
                  </span>
                </div>

                <h1 className="flex flex-wrap items-baseline gap-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl md:text-5xl">
                  <span>EL PRESTO</span>
                  <span className="bg-gradient-to-r from-[#D92312] to-[#F59E0B] bg-clip-text text-transparent">
                    KITCHEN
                  </span>
                </h1>

                <p className="mt-2 max-w-xl text-xs font-medium leading-relaxed text-gray-700 sm:text-sm">
                  Artisan stone-baked pizzas, whole-wheat burgers, gourmet
                  protein sides & fresh desi cold beverages. Prepared fresh on
                  every order!
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#D92312]" /> UCER Campus,
                    Naini
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-[#D92312]" /> 10–15 Mins
                    Dispatch
                  </span>
                </div>
              </div>

              {/* Right: trust badges */}
              <div className="flex shrink-0 items-center gap-2.5">
                <div className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 px-3.5 py-2.5 text-white shadow-lg shadow-emerald-600/25">
                  <Star size={18} className="fill-amber-300 text-amber-300" />
                  <div>
                    <p className="text-base font-black leading-none">4.9</p>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-100">
                      1.2k+ ratings
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 to-orange-50 px-3.5 py-2.5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-700">
                    🛵 Free Delivery
                  </p>
                  <p className="mt-0.5 text-[11px] font-black text-[#D92312]">
                    On Orders ₹499+
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. STICKY SEARCH + CATEGORY NAV                                */}
      {/* ============================================================ */}
      <div className="sticky top-0 z-30 mt-5 border-b border-white/60 bg-white/75 backdrop-blur-2xl">
        <div className="container mx-auto max-w-6xl space-y-2.5 px-4 py-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={17}
            />
            <input
              type="text"
              placeholder="Search pizzas, burgers, shakes, sides…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 py-3 pl-11 pr-10 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/15"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => scrollToCategory("All")}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                activeCategory === "All"
                  ? "bg-gray-950 text-white shadow-md"
                  : "border border-white/70 bg-white/70 text-gray-800 shadow-sm backdrop-blur-md hover:border-red-300 hover:bg-orange-50/60"
              }`}
            >
              🔥 All
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-black ${
                  activeCategory === "All"
                    ? "bg-white/25 text-white"
                    : "bg-orange-100 text-amber-900"
                }`}
              >
                {filteredItems.length}
              </span>
            </button>
            {categoriesList.map((cat) => {
              const count = categorizedMenu[cat]?.length || 0;
              if (count === 0 && searchQuery) return null;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                    isActive
                      ? "bg-gradient-to-r from-[#D92312] to-[#B8190B] text-white shadow-md shadow-red-500/25"
                      : "border border-white/70 bg-white/70 text-gray-800 shadow-sm backdrop-blur-md hover:border-red-300 hover:bg-orange-50/60"
                  }`}
                >
                  <span>{cat}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-black ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-orange-100 text-amber-900"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. TRENDING NOW                                                */}
      {/* ============================================================ */}
      <TrendingNow productRatings={productRatings} />

      {/* ============================================================ */}
      {/* 4. MENU SECTIONS                                               */}
      {/* ============================================================ */}
      <div className="container mx-auto max-w-6xl px-4 pt-6">
        {Object.keys(categorizedMenu).length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-white/60 bg-white/60 py-20 text-center shadow-sm backdrop-blur-xl">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-orange-50">
              <Search size={32} className="text-orange-400" />
            </div>
            <p className="mt-4 text-base font-black text-gray-800">
              No dishes found
            </p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Try a different keyword or clear the search
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-5 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
            >
              <X size={13} /> Clear Search
            </button>
          </div>
        ) : (
          Object.entries(categorizedMenu).map(([categoryName, items]) => {
            const sectionId =
              "category-" +
              categoryName.toLowerCase().replace(/[^a-z0-9]/g, "-");

            return (
              <section
                key={categoryName}
                id={sectionId}
                className="mb-10 scroll-mt-32"
              >
                {/* Section header */}
                <div className="mb-4 flex items-center gap-3 border-b-2 border-orange-100/60 pb-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                    <Flame size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                      {categoryName}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 font-mono text-[11px] font-black text-orange-700">
                    {items.length}
                  </span>
                </div>

                {/* Item cards grid */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {items.map((item) => {
                    const qty = getQuantityInCart(item.id);
                    const rating = productRatings[item.id];
                    const displayRating = rating?.averageRating || 4.8;
                    const reviewCount = rating?.totalRatings || 0;
                    const originalPrice = Math.round(item.price * 1.25);

                    return (
                      <div
                        key={item.id}
                        className="group relative flex gap-3 overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_15px_40px_-12px_rgba(217,35,18,0.15)] sm:gap-4 sm:p-4"
                      >
                        {/* Left: content */}
                        <div className="flex min-w-0 flex-1 flex-col justify-between pr-1">
                          {/* Badges */}
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                              <span className="grid h-2.5 w-2.5 place-items-center rounded-sm border border-emerald-600 bg-white">
                                <span className="h-1 w-1 rounded-full bg-emerald-600" />
                              </span>
                              Veg
                            </span>
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
                              🌾 Whole Wheat
                            </span>
                            {originalPrice > item.price && (
                              <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700">
                                20% OFF
                              </span>
                            )}
                          </div>

                          {/* Name + rating */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="line-clamp-2 text-sm font-black leading-snug text-gray-950 transition-colors group-hover:text-[#D92312] sm:text-base">
                              {item.name}
                            </h3>

                            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-900">
                              <Star
                                size={10}
                                className="fill-amber-400 text-amber-500"
                              />
                              {displayRating.toFixed(1)}
                              <span className="text-[9px] font-bold text-amber-700">
                                ({reviewCount > 0 ? reviewCount : "New"})
                              </span>
                            </div>
                          </div>

                          {/* Price */}
                          <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                            <span className="font-mono text-lg font-black text-[#D92312]">
                              ₹{item.price}
                            </span>
                            {originalPrice > item.price && (
                              <span className="font-mono text-[11px] font-bold text-gray-400 line-through">
                                ₹{originalPrice}
                              </span>
                            )}
                          </p>

                          {/* Description */}
                          {item.description && (
                            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-relaxed text-gray-600 sm:text-xs">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Right: image + action */}
                        <div className="flex shrink-0 flex-col items-center">
                          <div className="relative mb-2.5 h-24 w-24 overflow-hidden rounded-2xl border border-orange-100 bg-orange-50 shadow-inner sm:h-28 sm:w-28">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                sizes="(max-width: 768px) 96px, 112px"
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl">
                                🍕
                              </div>
                            )}

                            {/* Sold-out overlay */}
                            {!item.available && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                                <span className="rounded-md bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                  Sold Out
                                </span>
                              </div>
                            )}

                            {/* Corner rating ribbon */}
                            {item.available && (
                              <span className="absolute -bottom-1 left-1 rounded-full border border-white bg-white/95 px-1.5 py-0.5 text-[9px] font-black text-amber-700 shadow-sm backdrop-blur-md">
                                ⭐ {displayRating.toFixed(1)}
                              </span>
                            )}
                          </div>

                          {/* Add / stepper */}
                          {item.available && (
                            <div className="w-full max-w-[112px]">
                              {qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addItem(item)}
                                  className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-[#D92312] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#D92312] shadow-sm transition-all hover:scale-[1.03] hover:bg-red-50 active:scale-95"
                                >
                                  <Plus size={13} strokeWidth={3} /> Add
                                </button>
                              ) : (
                                <div className="flex items-center justify-between overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(item.id, qty - 1)
                                    }
                                    className="grid h-8 w-8 place-items-center transition hover:bg-emerald-700 active:scale-90"
                                  >
                                    <Minus size={13} strokeWidth={3} />
                                  </button>
                                  <span className="font-mono text-sm font-black">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(item.id, qty + 1)
                                    }
                                    className="grid h-8 w-8 place-items-center transition hover:bg-emerald-700 active:scale-90"
                                  >
                                    <Plus size={13} strokeWidth={3} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        {/* End of menu marker */}
        {Object.keys(categorizedMenu).length > 0 && (
          <div className="flex flex-col items-center pb-6 pt-4 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
              <Sparkles size={20} className="text-orange-500" />
            </div>
            <p className="mt-3 text-xs font-black uppercase tracking-widest text-gray-400">
              You&apos;ve reached the end
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
              Craving something specific? Use the search above!
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. FLOATING CART BAR                                          */}
      {/* ============================================================ */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-3 right-3 z-40 mx-auto max-w-2xl animate-in slide-in-from-bottom-5 duration-300 sm:left-4 sm:right-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gray-950/95 p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-4">
            <span className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />

            {/* Free-delivery progress */}
            <div className="relative mb-2.5 flex items-center justify-between gap-3">
              {remainingForFreeDelivery > 0 ? (
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  <Zap size={11} className="animate-pulse" />
                  Add ₹{Math.round(remainingForFreeDelivery)} more for FREE
                  delivery
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <CheckCircle2 size={11} /> Unlocked free delivery! 🎉
                </p>
              )}
              <p className="shrink-0 font-mono text-[10px] font-black text-gray-400">
                {Math.round(totalCartPrice)}/{FREE_DELIVERY_THRESHOLD}
              </p>
            </div>

            <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${freeDeliveryProgress}%` }}
              />
            </div>

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#D92312] to-[#F59E0B] text-xl text-white shadow-lg shadow-red-500/30">
                  🛒
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-gray-950 bg-white px-1 font-mono text-[10px] font-black text-[#D92312]">
                    {totalCartCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    {totalCartCount} {totalCartCount === 1 ? "item" : "items"}
                  </p>
                  <p className="truncate font-mono text-base font-black leading-tight text-white">
                    ₹{Math.round(totalCartPrice)}
                    <span className="ml-1 text-[10px] font-normal text-gray-400">
                      total
                    </span>
                  </p>
                </div>
              </div>

              <Link
                href="/checkout"
                className="group/btn relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#D92312] via-[#E11D48] to-[#F59E0B] px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/30 transition-all hover:scale-[1.03] active:scale-95 sm:px-6 sm:text-xs"
              >
                <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                <span className="relative flex items-center gap-1.5">
                  <ShoppingBag size={14} />
                  Checkout
                  <ChevronRight
                    size={14}
                    className="transition-transform group-hover/btn:translate-x-1"
                  />
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}