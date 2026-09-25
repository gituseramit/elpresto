"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Flame, Star, Plus, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCartStore, MenuItem } from "@/store/useCartStore";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeTrendingSettings, TrendingSettings, DEFAULT_TRENDING_SETTINGS } from "@/lib/trendingService";
import { DUMMY_MENU } from "@/data/menu";

interface TrendingItem extends MenuItem {
  orderCount?: number;
  ratingValue?: number;
  trendingRank?: number;
}

export default function TrendingNow({
  productRatings = {},
}: {
  productRatings?: Record<string, { averageRating: number; totalRatings: number }>;
}) {
  const [trendingSettings, setTrendingSettings] = useState<TrendingSettings>(DEFAULT_TRENDING_SETTINGS);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  // Subscribe to Trending Admin Settings
  useEffect(() => {
    return subscribeTrendingSettings((settings) => {
      setTrendingSettings(settings);
    });
  }, []);

  // Fetch recent orders to compute true popularity
  useEffect(() => {
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
      return onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => d.data());
        setLiveOrders(docs);
      });
    } catch {
      return () => {};
    }
  }, []);

  // Calculate top trending dishes
  const trendingItems = useMemo<TrendingItem[]>(() => {
    if (!trendingSettings.enabled) return [];

    // If Admin set Manual mode, pick specific manual items
    if (trendingSettings.mode === "manual" && trendingSettings.manualItemIds.length > 0) {
      const selected = trendingSettings.manualItemIds
        .map((id) => DUMMY_MENU.find((m) => m.id === id))
        .filter(Boolean) as MenuItem[];
      return selected.slice(0, trendingSettings.maxItems || 6).map((item, idx) => ({
        ...item,
        trendingRank: idx + 1,
        ratingValue: productRatings[item.id]?.averageRating || 4.9,
      }));
    }

    // Auto Mode: Count frequency in orders
    const frequencyMap: Record<string, { count: number; name: string }> = {};
    liveOrders.forEach((order) => {
      if (order.status !== "cancelled" && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const key = item.id || item.name;
          if (!frequencyMap[key]) frequencyMap[key] = { count: 0, name: item.name };
          frequencyMap[key].count += item.quantity || 1;
        });
      }
    });

    // Match with menu items
    const rankedFromOrders = Object.entries(frequencyMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, data]) => {
        const found = DUMMY_MENU.find((m) => m.id === key || m.name.toLowerCase() === data.name.toLowerCase());
        if (!found) return null;
        return {
          ...found,
          orderCount: data.count,
          ratingValue: productRatings[found.id]?.averageRating || 4.9,
        };
      })
      .filter(Boolean) as TrendingItem[];

    // Fallback: fill with bestsellers if not enough live orders yet
    const usedIds = new Set(rankedFromOrders.map((i) => i.id));
    const fallbackList = DUMMY_MENU.filter((m) => !usedIds.has(m.id)).slice(0, 8);

    const merged = [...rankedFromOrders, ...fallbackList].slice(0, trendingSettings.maxItems || 6);

    return merged.map((item, idx) => ({
      ...item,
      trendingRank: idx + 1,
      ratingValue: productRatings[item.id]?.averageRating || 4.8,
    }));
  }, [liveOrders, trendingSettings, productRatings]);

  if (!trendingSettings.enabled || trendingItems.length === 0) {
    return null;
  }

  const scrollContainer = (dir: "left" | "right") => {
    const el = document.getElementById("trending-scroll-container");
    if (el) {
      const scrollAmount = dir === "left" ? -320 : 320;
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <section className="container mx-auto max-w-6xl px-4 pt-8 pb-4">
      {/* Heading Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#D92312] text-xs font-black uppercase tracking-wider mb-1">
            <Flame size={14} className="fill-[#D92312] animate-bounce" />
            <span>Community Favorites</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2">
            Trending Now Across Prayagraj
          </h2>
        </div>

        {/* Carousel controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollContainer("left")}
            className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-orange-50 text-gray-700 shadow-xs active:scale-95 transition"
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollContainer("right")}
            className="p-2 bg-white rounded-xl border border-gray-200 hover:bg-orange-50 text-gray-700 shadow-xs active:scale-95 transition"
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Cards Container */}
      <div
        id="trending-scroll-container"
        className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 hide-scrollbar scroll-smooth"
      >
        {trendingItems.map((dish) => {
          const qtyInCart = cartItems.find((i) => i.id === dish.id)?.quantity || 0;

          return (
            <div
              key={dish.id}
              className="flex-shrink-0 w-64 sm:w-72 bg-white rounded-3xl p-4 border border-orange-100/90 shadow-[0_4px_18px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_30px_rgba(217,35,18,0.12)] hover:border-red-200 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Image Container with Badges */}
                <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-orange-50 mb-3 border border-orange-100/80">
                  {dish.imageUrl ? (
                    <Image
                      src={dish.imageUrl}
                      alt={dish.name}
                      fill
                      sizes="288px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🍕</div>
                  )}

                  {/* Rank Pill */}
                  <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-[#D92312] to-[#F59E0B] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                    <Flame size={12} className="fill-white" />
                    <span>#{dish.trendingRank} TRENDING</span>
                  </div>

                  {/* Pure Veg Indicator */}
                  <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md text-[9px] font-black text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>100% Atta</span>
                  </div>
                </div>

                {/* Title & Category */}
                <h3 className="font-black text-sm text-gray-950 group-hover:text-[#D92312] transition line-clamp-1">
                  {dish.name}
                </h3>
                <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 font-medium leading-relaxed">
                  {dish.description || "Fresh stoneground atta base, farm toppings & real cheese."}
                </p>
              </div>

              {/* Price & Add to Cart Button */}
              <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-black text-base text-[#D92312] font-mono">₹{dish.price}</span>
                  <span className="text-[10px] text-gray-400 line-through ml-1.5">
                    ₹{Math.round(dish.price * 1.25)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => addItem(dish)}
                  className="px-3.5 py-1.5 bg-white hover:bg-red-50 text-[#D92312] font-black text-xs rounded-xl border-2 border-[#D92312] shadow-xs hover:shadow-md transition active:scale-95 flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>{qtyInCart > 0 ? `ADD (${qtyInCart})` : "ADD"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
