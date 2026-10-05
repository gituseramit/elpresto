"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Flame,
  ArrowRight,
  Play,
  Plus,
  Check,
  Star,
  MapPin,
  Clock,
  Phone,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { DUMMY_MENU, CATEGORIES } from "@/data/menu";


/* ============================================================= */
/* Audio Haptic Helper for adding to box                         */
/* ============================================================= */
function playPizzaChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Warm culinary chime: 587.33Hz (D5) -> 880Hz (A5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio permission restrictions
  }
}

/* ============================================================= */
/* Category Emoji Map                                            */
/* ============================================================= */
const CATEGORY_EMOJI: Record<string, string> = {
  "Healthy Mania": "🌾",
  "Double Healthy Mania": "🧀",
  "Indian Tadka Pizza": "🌶️",
  "Medium Pizzas": "🍕",
  "Large Pizzas": "🍕",
  Subs: "🥖",
  Fries: "🍟",
  Bowls: "🥗",
  Burgers: "🍔",
  Sides: "🧄",
  Desserts: "🍫",
  Beverages: "☕",
  "Extra Toppings": "✨",
};

/* ============================================================= */
/* Main Italian Artisanal Landing Page Component                 */
/* ============================================================= */
export default function ItalianArtisanalPizzeria() {
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [addedItemNotice, setAddedItemNotice] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const addItem = useCartStore((state) => state.addItem);

  const handleAddToBox = (item: (typeof DUMMY_MENU)[0]) => {
    playPizzaChime();
    addItem(item);

    setAddedItemNotice(item.name);
    setTimeout(() => {
      setAddedItemNotice(null);
    }, 2400);

    if (typeof document !== "undefined") {
      document.dispatchEvent(new Event("open-cart"));
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) return;
    setNewsletterSubscribed(true);
    playPizzaChime();
    setTimeout(() => {
      setEmailInput("");
    }, 1500);
  };

  const availableCategories = ["All", ...CATEGORIES.filter((c) => c !== "All")];

  const filteredItems =
    selectedFilter === "All"
      ? DUMMY_MENU.filter((item) => item.available)
      : DUMMY_MENU.filter(
          (item) => item.available && item.category === selectedFilter
        );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#FAF7F2] via-[#FDFBF7] to-[#F5EFEB] text-[#1C1917] selection:bg-[#D9381E] selection:text-white">
      {/* Toast Notice for Added Item */}
      {addedItemNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#181413] px-5 py-3.5 text-white shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9381E] text-white">
            <Check size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-200 uppercase tracking-widest">
              Added to Your Box
            </p>
            <p className="text-sm font-semibold">{addedItemNotice}</p>
          </div>
        </div>
      )}

      {/* Floating Garnishes Ambient Layer */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Soft Basil Leaf 1 */}
        <div className="basil-float-1 absolute -left-10 top-44 h-36 w-36 opacity-35 blur-[1px]">
          <span className="text-7xl select-none">🍃</span>
        </div>
        {/* Soft Basil Leaf 2 */}
        <div className="basil-float-2 absolute right-8 top-1/3 h-28 w-28 opacity-30 blur-[0.5px]">
          <span className="text-6xl select-none">🌿</span>
        </div>
        {/* Chili Flakes */}
        <div className="basil-float-1 absolute left-1/4 top-3/4 opacity-25">
          <span className="text-4xl select-none">🌶️</span>
        </div>
        {/* Warm Oven Ember Glow */}
        <div className="ember-pulse absolute right-0 top-20 h-96 w-96 rounded-full bg-radial from-[#E23E1D]/15 via-[#E5A93B]/8 to-transparent blur-3xl" />
        <div className="ember-pulse absolute -left-20 bottom-1/4 h-[500px] w-[500px] rounded-full bg-radial from-[#D9381E]/12 via-[#E5A93B]/5 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ============================================================= */}
        {/* 3. HERO SECTION (Landing View)                                */}
        {/* ============================================================= */}
        <section className="relative overflow-hidden px-6 pb-20 pt-10 sm:px-10 md:pb-28 md:pt-16 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Left Column Content */}
              <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
                {/* Tagline */}
                <div className="inline-flex items-center gap-2">
                  <span className="font-script-italian text-2xl font-bold text-[#D9381E] sm:text-3xl">
                    Wood-Fired Neapolitan Tradition
                  </span>
                  <span className="h-px w-10 bg-[#D9381E]/40" />
                </div>

                {/* Headline */}
                <h1 className="font-serif-luxury text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-[#181413] sm:text-6xl md:text-7xl">
                  Taste Pure{" "}
                  <span className="relative inline-block text-[#D9381E]">
                    Wood-Fired
                    <svg
                      aria-hidden="true"
                      className="absolute -bottom-2 left-0 h-3 w-full text-[#E5A93B]"
                      viewBox="0 0 200 12"
                      preserveAspectRatio="none"
                      fill="none"
                    >
                      <path
                        d="M2 8 Q 50 2, 100 6 T 198 4"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>{" "}
                  Pizza
                </h1>

                {/* Subtext Quote */}
                <p className="font-cormorant-craft mx-auto max-w-xl text-lg italic leading-relaxed text-[#1C1917]/80 sm:text-xl lg:mx-0">
                  &ldquo;At The Table With Good Food And True Friends, One Never Grows Old.&rdquo;
                </p>

                <p className="mx-auto max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base lg:mx-0">
                  Every artisan pie is hand-stretched from our 72-hour cold-fermented sourdough,
                  spread with crushed San Marzano D.O.P. tomatoes, fresh Mozzarella di Bufala, and
                  charred in our 900°F Vesuvius volcanic stone oven for 90 seconds.
                </p>

                {/* CTAs */}
                <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center lg:justify-start">
                  <Link
                    href="/menu"
                    className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E23E1D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-600/40 focus:outline-none focus:ring-4 focus:ring-red-300"
                  >
                    <span>Order Fresh Slice</span>
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </Link>

                  <a
                    href="#popular-pizzas"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-stone-300 bg-white/80 px-7 py-3.5 text-base font-bold text-[#181413] shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#D9381E] hover:bg-white hover:text-[#D9381E]"
                  >
                    Explore Menu
                  </a>
                </div>

                {/* Floating Seal / Rotating Circular Badge */}
                <div className="pt-4 flex items-center justify-center lg:justify-start">
                  <div className="relative flex h-28 w-28 items-center justify-center">
                    <svg
                      className="orbit-slow absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                    >
                      <path
                        id="badgeCirclePath"
                        d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                        fill="none"
                      />
                      <text className="text-[7.2px] font-black uppercase tracking-[2.5px] fill-[#D9381E]">
                        <textPath href="#badgeCirclePath" startOffset="0%">
                          • 72-HOUR SLOW FERMENTATION • 900°F VESUVIUS BRICK OVEN
                        </textPath>
                      </text>
                    </svg>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#D9381E] to-[#E5A93B] text-white shadow-md shadow-amber-600/30">
                      <Flame size={20} className="fill-amber-100 text-amber-100 animate-pulse" />
                    </div>
                  </div>
                  <div className="ml-4 text-left">
                    <p className="text-xs font-black uppercase tracking-wider text-[#D9381E]">
                      Artisan Authenticity
                    </p>
                    <p className="font-serif-luxury text-sm font-bold text-stone-800">
                      100% Italian Caputo 00 &amp; Campania Mozzarella
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column Visual (3D Isometric Pizza Peel Render) */}
              <div className="relative flex justify-center lg:col-span-5">
                <div className="relative w-full max-w-lg">
                  {/* Backdrop Glow */}
                  <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-[#D9381E]/20 via-[#E5A93B]/25 to-transparent blur-2xl" />

                  {/* Wood-fired Pizza Platter Card */}
                  <div className="group relative overflow-hidden rounded-[2.5rem] border border-amber-200/60 bg-gradient-to-br from-white via-[#FAF7F2] to-amber-50/50 p-4 shadow-[0_25px_60px_rgba(217,56,30,0.18)] transition-all duration-500 hover:shadow-[0_30px_70px_rgba(217,56,30,0.25)]">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[2rem]">
                      <Image
                        src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=85"
                        alt="Artisan wood-fired Neapolitan pizza with blistered crust and fresh mozzarella pull"
                        fill
                        priority
                        className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Pill Tag */}
                      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#D9381E] shadow-lg backdrop-blur-md">
                        <Flame size={14} className="fill-[#D9381E]" />
                        <span>Blistered 900°F Crust</span>
                      </div>

                      {/* Bottom Caption */}
                      <div className="absolute bottom-5 left-5 right-5 text-white">
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Star size={13} fill="currentColor" />
                          <span>San Marzano DOP &amp; Mozzarella di Bufala</span>
                        </div>
                        <h2 className="font-serif-luxury mt-1 text-2xl font-bold text-white">
                          Margherita Verace
                        </h2>
                        <p className="font-script-italian text-lg text-amber-100">
                          Freshly torn Genovese Basil &amp; Cold-Pressed Olio
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Floating Badges */}
                  <div className="absolute -bottom-4 -left-4 hidden items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md sm:flex">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-2xl">
                      🍕
                    </span>
                    <div>
                      <p className="text-xs font-black text-[#181413]">Slow Proofed</p>
                      <p className="font-serif-luxury text-xs font-bold text-[#D9381E]">
                        72h Sourdough
                      </p>
                    </div>
                  </div>

                  <div className="absolute -right-4 top-10 hidden items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md sm:flex">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">
                      🌿
                    </span>
                    <div>
                      <p className="text-xs font-black text-[#181413]">100% Organic</p>
                      <p className="text-xs font-bold text-[#2C5E3B]">Caputo 00 Flour</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 4. "ABOUT US" SECTION (Our Heritage / Il Mestiere)           */}
        {/* ============================================================= */}
        <section
          id="heritage"
          className="border-y border-stone-200/70 bg-gradient-to-r from-[#FAF7F2] via-white to-[#F5EFEB] px-6 py-20 sm:px-10 lg:px-14"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Left Column Image (Proofed dough, tomatoes, olive oil) */}
              <div className="relative lg:col-span-6">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  {/* Decorative line-art circles */}
                  <div className="absolute -inset-4 rounded-3xl border-2 border-dashed border-[#E5A93B]/40" />

                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=1000&q=80"
                      alt="Artisan sourdough dough fermentation, ripe San Marzano tomatoes, and copper olive oil cruet"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#E5A93B]">
                        Tradizione Napoletana
                      </p>
                      <p className="font-serif-luxury text-xl font-bold">
                        Proofed With Patience, Fired With Passion
                      </p>
                    </div>
                  </div>

                  {/* Corner Callout */}
                  <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-amber-300 bg-[#181413] p-4 text-white shadow-xl sm:block">
                    <p className="font-serif-luxury text-3xl font-extrabold text-[#E5A93B]">90s</p>
                    <p className="text-xs text-stone-300">Fast 900°F Vesuvius Bake</p>
                  </div>
                </div>
              </div>

              {/* Right Column Content */}
              <div className="space-y-6 lg:col-span-6">
                <div>
                  <span className="font-script-italian text-3xl font-bold text-[#D9381E]">
                    Our Heritage
                  </span>
                  <h2 className="font-serif-luxury mt-2 text-3xl font-extrabold tracking-tight text-[#181413] sm:text-4xl md:text-5xl">
                    Crafted By Fire, Flour &amp; Patience 🍕
                  </h2>
                </div>

                <p className="font-cormorant-craft text-lg italic text-stone-700 sm:text-xl">
                  &ldquo;Pizza Is Not Fast Food; It Is A Living Craft. We Honor Centuries-Old
                  Neapolitan Tradition Using Italian Type-00 Flour, Mineral Spring Water, And A
                  72-Hour Natural Sourdough Fermentation Fired For 90 Seconds At 900°F.&rdquo;
                </p>

                {/* Feature Badges */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-lg">
                      🌾
                    </span>
                    <span className="text-xs font-bold text-stone-900">
                      100% Organic Caputo 00 Flour
                    </span>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-lg">
                      🧀
                    </span>
                    <span className="text-xs font-bold text-stone-900">
                      Campania Mozzarella di Bufala DOP
                    </span>
                  </div>
                </div>

                {/* Video Play CTA */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setVideoModalOpen(true)}
                    className="group inline-flex items-center gap-4 rounded-full border border-stone-200 bg-white px-5 py-3 shadow-md transition-all duration-300 hover:border-[#D9381E] hover:bg-[#FAF7F2] hover:shadow-lg"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D9381E] text-white shadow-md shadow-red-600/30 transition-transform group-hover:scale-110">
                      <Play size={18} className="ml-0.5 fill-white text-white" />
                    </span>
                    <span className="font-serif-luxury text-sm font-bold text-[#181413]">
                      Watch Master Pizzaiolo Craft
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 5. "POPULAR PIZZAS" SECTION (Product Grid)                   */}
        {/* ============================================================= */}
        <section id="popular-pizzas" className="px-6 py-20 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            {/* Header */}
            <div className="mb-12 text-center">
              <span className="font-script-italian text-3xl font-bold text-[#D9381E]">
                Il Nostro Menu
              </span>
              <h2 className="font-serif-luxury mt-1 text-3xl font-extrabold tracking-tight text-[#181413] sm:text-5xl">
                Our Full Menu
              </h2>
              <p className="font-cormorant-craft mx-auto mt-2 max-w-xl text-lg italic text-stone-600">
                100% whole wheat base · real mozzarella · zero palm oil · made fresh to order.
              </p>

              {/* Filter Tabs — real categories */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {availableCategories.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedFilter(tab)}
                    className={`rounded-full px-4 py-2 text-xs font-bold tracking-wide transition-all duration-200 ${
                      selectedFilter === tab
                        ? "bg-[#D9381E] text-white shadow-md shadow-red-600/30"
                        : "border border-stone-200 bg-white text-stone-700 hover:border-[#D9381E] hover:text-[#D9381E]"
                    }`}
                  >
                    {tab !== "All" && (CATEGORY_EMOJI[tab] ?? "🍴")} {tab}
                  </button>
                ))}
              </div>
            </div>


            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-5 italian-card-shadow transition-all duration-300 hover:-translate-y-1.5 hover:border-[#D9381E]/40 hover:italian-card-shadow-hover"
                >
                  {/* Image */}
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-100">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />

                      {/* Veg / Non-veg indicator */}
                      <span
                        className={`absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 bg-white ${
                          item.isVeg ? "border-emerald-600" : "border-red-600"
                        }`}
                        title={item.isVeg ? "Pure Veg" : "Non-Veg"}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            item.isVeg ? "bg-emerald-600" : "bg-red-600"
                          }`}
                        />
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                          {CATEGORY_EMOJI[item.category] ?? "🍴"} {item.category}
                        </span>
                      </div>

                      <h3 className="font-serif-luxury text-base font-bold leading-snug text-[#181413] transition-colors group-hover:text-[#D9381E] line-clamp-2">
                        {item.name}
                      </h3>

                      <p className="text-xs leading-relaxed text-stone-500 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Price & Add */}
                  <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-stone-400">
                        Price
                      </span>
                      <p className="font-serif-luxury text-2xl font-black text-[#181413]">
                        ₹{item.price.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToBox(item)}
                      aria-label={`Add ${item.name} to cart`}
                      className="group/btn flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-[#FAF7F2] text-[#D9381E] shadow-sm transition-all duration-200 hover:scale-110 hover:border-[#D9381E] hover:bg-[#D9381E] hover:text-white hover:shadow-lg active:scale-95"
                    >
                      <Plus size={22} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>


            {/* Bottom Menu Action */}
            <div className="mt-14 text-center">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-8 py-3.5 font-bold text-[#181413] shadow-sm transition-all duration-200 hover:border-[#D9381E] hover:bg-[#FAF7F2] hover:text-[#D9381E]"
              >
                <span>View Full Menu ({DUMMY_MENU.length}+ Items)</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 6. "NEWLY ADDED" FEATURED PROMO BANNER                        */}
        {/* ============================================================= */}
        <section className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-amber-300/60 bg-gradient-to-br from-[#FAF7F2] via-white to-[#F5EFEB] p-8 shadow-2xl md:p-12 lg:p-16">
              {/* Warm Oven Glow Backdrop */}
              <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-radial from-[#D9381E]/20 via-[#E5A93B]/15 to-transparent blur-3xl" />

              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                {/* Left Content */}
                <div className="space-y-6 lg:col-span-7">
                  <span className="font-script-italian text-3xl font-bold text-[#D9381E]">
                    Chef&apos;s Signature
                  </span>

                  <h2 className="font-serif-luxury text-3xl font-extrabold tracking-tight text-[#181413] sm:text-5xl">
                    EL PRESTO SPECIAL Pizza ⭐
                  </h2>

                  <p className="font-cormorant-craft text-lg italic text-stone-700 sm:text-xl">
                    A secret blend of premium toppings on a 100% whole wheat base — our chef&apos;s
                    most-loved signature creation. Baked fresh to order.
                  </p>

                  <div className="flex items-baseline gap-3">
                    <span className="font-serif-luxury text-4xl font-black text-[#D9381E]">
                      ₹199
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      Best Seller Today
                    </span>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const special = DUMMY_MENU.find((i) => i.id === "itp6");
                        if (special) handleAddToBox(special);
                      }}
                      className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E23E1D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-600/40"
                    >
                      <span>Add to Cart — ₹199</span>
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </button>
                  </div>
                </div>

                {/* Right Visual (Brass pizza cutter & olive oil drizzle) */}
                <div className="relative lg:col-span-5">
                  <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-stone-200 bg-stone-100 shadow-xl">
                    <Image
                      src="https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=900&q=80"
                      alt="Antique brass pizza cutter slicing through a blistered artisan crust with cold-pressed olive oil drizzle"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <span className="text-xs uppercase tracking-widest text-amber-300">
                        Olio Extravergine DOP
                      </span>
                      <p className="font-serif-luxury text-sm font-bold">
                        Drizzled With First Cold-Pressed Tuscan Olives
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 7. NEWSLETTER SUBSCRIPTION BANNER                            */}
        {/* ============================================================= */}
        <section className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-[#181413] px-8 py-14 text-white shadow-2xl md:px-16 md:py-20">
              {/* Radial Ember Accent */}
              <div className="absolute -left-10 -top-10 h-72 w-72 rounded-full bg-radial from-[#D9381E]/30 to-transparent blur-3xl" />
              <div className="absolute -right-10 -bottom-10 h-72 w-72 rounded-full bg-radial from-[#E5A93B]/20 to-transparent blur-3xl" />

              <div className="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                {/* Left Visual Icon / Slice */}
                <div className="flex items-center justify-center lg:col-span-4">
                  <div className="relative flex h-36 w-36 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
                    <span className="text-7xl select-none animate-bounce">🍕</span>
                    <span className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#D9381E] text-xs">
                      ✨
                    </span>
                  </div>
                </div>

                {/* Right Content & Form */}
                <div className="space-y-4 text-center lg:col-span-8 lg:text-left">
                  <span className="font-script-italian text-3xl font-bold text-[#E5A93B]">
                    Secret Recipes &amp; Private Tastings
                  </span>

                  <h2 className="font-serif-luxury text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    Subscribe for Wood-Fired Specials
                  </h2>

                  <p className="max-w-xl text-sm leading-relaxed text-stone-400">
                    Receive our weekly secret menu drops, pizzaiolo sourdough masterclass notes, and
                    complimentary burrata vouchers directly to your inbox.
                  </p>

                  <form onSubmit={handleSubscribe} className="pt-2">
                    {newsletterSubscribed ? (
                      <div className="inline-flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-6 py-3.5 text-sm font-bold text-emerald-300">
                        <Check size={18} />
                        <span>Grazie! Welcome to the ElPresto Private Tasting Club.</span>
                      </div>
                    ) : (
                      <div className="flex max-w-md flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Enter Mail Address"
                          className="flex-1 rounded-full border border-white/10 bg-white/10 px-6 py-3.5 text-sm text-white placeholder-stone-400 outline-none transition focus:border-[#D9381E] focus:bg-white/15 focus:ring-2 focus:ring-[#D9381E]/30"
                        />
                        <button
                          type="submit"
                          className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E23E1D] px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                          <span>Subscribe</span>
                          <ArrowRight
                            size={16}
                            className="transition-transform group-hover:translate-x-1"
                          />
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 8. FOOTER SECTION                                            */}
        {/* ============================================================= */}
        <footer className="border-t border-stone-300/80 bg-[#FAF7F2] px-6 pb-12 pt-16 text-[#1C1917] sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {/* Column 1 (Brand) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9381E] to-[#E5A93B] text-white shadow-md">
                    <Flame size={20} className="fill-amber-100" />
                  </div>
                  <div>
                    <span className="font-serif-luxury text-2xl font-black text-[#181413]">
                      El<span className="text-[#D9381E]">Presto</span>
                    </span>
                    <p className="font-script-italian -mt-1 text-xs text-[#2C5E3B]">
                      Pizzeria Artigianale
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-stone-600">
                  Honoring the sacred art of Neapolitan pizza since inception. 72-hour slow cold
                  fermentation, San Marzano D.O.P. tomatoes, and live volcanic wood fire.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <a
                    href="https://instagram.com/elprestopizza"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#D9381E] hover:bg-[#D9381E] hover:text-white"
                  >
                    📷
                  </a>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#D9381E] hover:bg-[#D9381E] hover:text-white"
                  >
                    📘
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#D9381E] hover:bg-[#D9381E] hover:text-white"
                  >
                    ▶️
                  </a>
                </div>
              </div>

              {/* Column 2 (Menu) */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">
                  Artisan Menu
                </h3>
                <ul className="space-y-2 text-xs font-medium text-stone-600">
                  <li>
                    <Link href="/menu" className="hover:text-[#D9381E]">
                      Classiche Napoletane
                    </Link>
                  </li>
                  <li>
                    <Link href="/menu" className="hover:text-[#D9381E]">
                      Pizze Bianche &amp; Tartufo
                    </Link>
                  </li>
                  <li>
                    <Link href="/menu" className="hover:text-[#D9381E]">
                      Calzoni Al Forno
                    </Link>
                  </li>
                  <li>
                    <Link href="/menu" className="hover:text-[#D9381E]">
                      Antipasti &amp; Burrata Boards
                    </Link>
                  </li>
                  <li>
                    <Link href="/menu" className="hover:text-[#D9381E]">
                      Italian Dolci &amp; Tiramisù
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 3 (Trattoria) */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">
                  La Trattoria
                </h3>
                <ul className="space-y-2 text-xs font-medium text-stone-600">
                  <li>
                    <a href="#heritage" className="hover:text-[#D9381E]">
                      72h Sourdough Story
                    </a>
                  </li>
                  <li>
                    <Link href="/menu?mode=delivery" className="hover:text-[#D9381E]">
                      Delivery &amp; Takeaway
                    </Link>
                  </li>
                  <li>
                    <Link href="/track" className="hover:text-[#D9381E]">
                      Live Dough Tracker
                    </Link>
                  </li>
                  <li>
                    <a href="tel:+916392512314" className="hover:text-[#D9381E]">
                      Table Booking &amp; Catering
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 4 (Address & Hours) */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">
                  Address &amp; Hours
                </h3>
                <div className="space-y-2 text-xs text-stone-600">
                  <p className="flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-[#D9381E]" />
                    <span>United College of Engineering &amp; Research (UCER), Naini, Prayagraj, UP – 211010</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="shrink-0 text-[#E5A93B]" />
                    <span>Open Daily: 10:00 AM – 11:00 PM</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone size={16} className="shrink-0 text-emerald-600" />
                    <a href="tel:+916392512314" className="hover:text-[#D9381E]">+91 63925 12314</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-stone-300 pt-6 text-xs text-stone-500 sm:flex-row">
              <p>© {new Date().getFullYear()} ElPresto Artisanal Pizzeria. All rights reserved.</p>

              {/* Indian payment methods */}
              <div className="flex items-center gap-3 text-stone-400">
                <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">
                  UPI
                </span>
                <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">
                  Razorpay
                </span>
                <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">
                  PhonePe
                </span>
                <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">
                  Paytm
                </span>
                <span className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">
                  Cash
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Pizzaiolo Video Modal */}
      {videoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setVideoModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-[#181413] p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-serif-luxury text-xl font-bold text-amber-200">
                Master Pizzaiolo at the 900°F Vesuvius Oven
              </h3>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="rounded-full bg-white/10 p-2 text-stone-300 hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <iframe
                className="h-full w-full"
                src="https://www.youtube-nocookie.com/embed/1-SJGQ2HLp8?autoplay=1"
                title="Master Neapolitan Pizza Crafting"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}