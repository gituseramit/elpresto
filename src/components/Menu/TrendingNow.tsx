"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  Flame,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCartStore, type MenuItem } from "@/store/useCartStore";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeMenuCatalog } from "@/lib/menuCatalog";
import {
  subscribeTrendingSettings,
  DEFAULT_TRENDING_SETTINGS,
  type TrendingSettings,
} from "@/lib/trendingService";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

interface TrendingItem extends MenuItem {
  orderCount?: number;
  ratingValue?: number;
  trendingRank?: number;
}

interface OrderLineItem {
  id?: string;
  name?: string;
  quantity?: number;
}

interface OrderRecord {
  status?: string;
  items?: OrderLineItem[];
}

interface ProductRating {
  averageRating: number;
  totalRatings: number;
}

const SCROLL_STEP_PX = 320;

/* ============================================================= */
/* Component                                                     */
/* ============================================================= */

export default function TrendingNow({
  productRatings = {},
}: {
  productRatings?: Record<string, ProductRating>;
}) {
  const [trendingSettings, setTrendingSettings] = useState<TrendingSettings>(
    DEFAULT_TRENDING_SETTINGS
  );
  const [liveOrders, setLiveOrders] = useState<OrderRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  /* Cart quantity lookup — built once per cart change instead of
   * doing a linear .find() for every card. */
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const ci of cartItems) map.set(ci.id, ci.quantity);
    return map;
  }, [cartItems]);

  /* Subscribe to trending settings */
  useEffect(() => {
    return subscribeTrendingSettings((settings) => {
      setTrendingSettings(settings);
    });
  }, []);

  useEffect(() => {
    return subscribeMenuCatalog(
      setMenuItems,
      (err) => console.warn("Trending menu subscription error:", err),
    );
  }, []);

  /* Only subscribe to recent orders when we actually need them.
   * In manual mode or when trending is disabled, there is no reason
   * to keep a Firestore listener alive. */
  const needsOrderData =
    trendingSettings.enabled && trendingSettings.mode === "auto";

  useEffect(() => {
    if (!needsOrderData) {
      return;
    }

    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => d.data() as OrderRecord);
        setLiveOrders(docs);
      },
      (err) => {
        console.warn("Trending orders listener error:", err);
      }
    );

    return () => unsubscribe();
  }, [needsOrderData]);

  /* ---------- Compute trending list ---------- */
  const trendingItems = useMemo<TrendingItem[]>(() => {
    if (!trendingSettings.enabled) return [];

    const max = Math.min(4, Math.max(1, trendingSettings.maxItems || 4));

    /* Manual mode — admin-curated list */
    if (
      trendingSettings.mode === "manual" &&
      trendingSettings.manualItemIds.length > 0
    ) {
      return trendingSettings.manualItemIds
        .map((id) => menuItems.find((item) => item.id === id))
        .filter((item): item is MenuItem => Boolean(item && item.available !== false))
        .slice(0, max)
        .map((item, idx) => ({
          ...item,
          trendingRank: idx + 1,
          ...(productRatings[item.id]?.totalRatings ? { ratingValue: productRatings[item.id].averageRating } : {}),
        }));
    }

    /* Auto mode — rank by order frequency */
    const frequency = new Map<string, { count: number; name: string }>();
    for (const order of liveOrders) {
      if (order.status === "cancelled") continue;
      if (!Array.isArray(order.items)) continue;
      for (const item of order.items) {
        const key = String(item.id || item.name || "").trim();
        if (!key) continue;
        const prev = frequency.get(key);
        if (prev) {
          prev.count += item.quantity || 1;
        } else {
          frequency.set(key, {
            count: item.quantity || 1,
            name: String(item.name || ""),
          });
        }
      }
    }

    const ranked: TrendingItem[] = [];
    const rankedIds = new Set<string>();

    const sorted = Array.from(frequency.entries()).sort(
      (a, b) => b[1].count - a[1].count
    );

    for (const [key, data] of sorted) {
      const found = menuItems.find(
        (item) =>
          item.available !== false &&
          (item.id === key || item.name.toLowerCase() === data.name.toLowerCase())
      );
      if (!found || rankedIds.has(found.id)) continue;
      rankedIds.add(found.id);
      ranked.push({
        ...found,
        orderCount: data.count,
        ...(productRatings[found.id]?.totalRatings ? { ratingValue: productRatings[found.id].averageRating } : {}),
      });
      if (ranked.length >= max) break;
    }

    return ranked.map((item, idx) => ({
      ...item,
      trendingRank: idx + 1,
    }));
  }, [liveOrders, menuItems, trendingSettings, productRatings]);

  /* ---------- Carousel scroll ---------- */
  const scrollContainer = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === "left" ? -SCROLL_STEP_PX : SCROLL_STEP_PX,
      behavior: "smooth",
    });
  };

  if (!trendingSettings.enabled || trendingItems.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 pt-8">
      {/* Heading bar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#D92312]">
            <Flame
              size={14}
              className="fill-[#D92312]"
              aria-hidden="true"
            />
            <span>{trendingSettings.mode === "auto" ? "Live order picks" : "Kitchen picks"}</span>
          </div>
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-950 sm:text-2xl">
            {trendingSettings.mode === "auto" ? "Popular orders" : "Selected for you"}
          </h2>
        </div>

        {/* Carousel controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollContainer("left")}
            aria-label="Scroll trending items left"
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 transition-transform hover:-translate-y-0.5 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollContainer("right")}
            aria-label="Scroll trending items right"
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 transition-transform hover:-translate-y-0.5 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="hide-scrollbar flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-4 pt-1"
      >
        {trendingItems.map((dish) => {
          const qtyInCart = cartQuantities.get(dish.id) ?? 0;
          const isWholeWheat = /whole wheat|whole-wheat|atta|stone[- ]ground/i.test(dish.description || "");

          return (
            <article
              key={dish.id}
              className="group flex w-64 shrink-0 snap-start flex-col justify-between rounded-3xl border border-orange-100/90 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:border-red-200 hover:shadow-md sm:w-72"
            >
              <div>
                {/* Image */}
                <div className="relative mb-3 h-36 w-full overflow-hidden rounded-2xl border border-orange-100/80 bg-orange-50">
                  {dish.imageUrl ? (
                    <Image
                      src={dish.imageUrl}
                      alt={dish.name}
                      fill
                      sizes="(max-width: 640px) 256px, 288px"
                      loading="lazy"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full w-full items-center justify-center text-3xl"
                    >
                      🍕
                    </div>
                  )}

                  {/* Rank pill */}
                  <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#D92312] to-[#F59E0B] px-2.5 py-0.5 text-[10px] font-black text-white shadow-md">
                    <Flame
                      size={12}
                      className="fill-white"
                      aria-hidden="true"
                    />
                    <span>{trendingSettings.mode === "auto" ? `#${dish.trendingRank} TRENDING` : "FEATURED"}</span>
                  </div>

                  {/* Atta indicator — solid, no blur */}
                  {isWholeWheat && <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[9px] font-black text-emerald-800 shadow-sm">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-emerald-600"
                    />
                    <span>100% Atta</span>
                  </div>}
                </div>

                {/* Title + rating */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-sm font-black text-gray-950 transition-colors group-hover:text-[#D92312]">
                    {dish.name}
                  </h3>
                  {dish.ratingValue !== undefined && <span className="shrink-0 rounded-md border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-900">
                    ⭐ {dish.ratingValue.toFixed(1)}
                  </span>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-relaxed text-gray-500">
                  {dish.description || "Made fresh to order."}
                </p>
              </div>

              {/* Price + add */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="font-mono text-base font-black text-[#D92312]">
                  ₹{dish.price}
                </span>

                <button
                  type="button"
                  onClick={() => addItem(dish)}
                  aria-label={
                    qtyInCart > 0
                      ? `Add another ${dish.name} (currently ${qtyInCart} in cart)`
                      : `Add ${dish.name} to cart`
                  }
                  className="flex items-center gap-1 rounded-xl border-2 border-[#D92312] bg-white px-3.5 py-1.5 text-xs font-black text-[#D92312] shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-red-50 active:scale-95"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>{qtyInCart > 0 ? `ADD (${qtyInCart})` : "ADD"}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
