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
  Camera,
  MapPin,
  Clock,
  Phone,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { DUMMY_MENU } from "@/data/menu";

/* ============================================================= */
/* Audio — pizza chime on add to cart                            */
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
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio blocked
  }
}

/* ============================================================= */
/* Category Card Data (Clean, compact category showcase)         */
/* ============================================================= */
const CATEGORY_CARDS = [
  {
    slug: "Healthy Mania",
    label: "Healthy Mania",
    tagline: "Whole-wheat favourites, freshly baked.",
    from: "₹99",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  },
  {
    slug: "Double Healthy Mania",
    label: "Double Healthy Mania",
    tagline: "Extra cheese. More joy.",
    from: "₹129",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
  },
  {
    slug: "Indian Tadka Pizza",
    label: "Indian Tadka Pizza",
    tagline: "A little spice, a lot of soul.",
    from: "₹149",
    image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
  },
  {
    slug: "Medium Pizzas",
    label: "Medium Pizzas (9 inch)",
    tagline: "Made for sharing.",
    from: "₹279",
    image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
  },
  {
    slug: "Large Pizzas",
    label: "Large Pizzas (12 inch)",
    tagline: "Good times, served large.",
    from: "₹399",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
  },
  {
    slug: "Subs",
    label: "Healthy Subs",
    tagline: "Freshly stacked and toasted.",
    from: "₹79",
    image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&q=80",
  },
  {
    slug: "Fries",
    label: "Crispy Fries",
    tagline: "Golden, crisp, and ready.",
    from: "₹59",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
  },
  {
    slug: "Bowls",
    label: "Protein Bowls",
    tagline: "Balanced bites, made fresh.",
    from: "₹89",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
  },
  {
    slug: "Burgers",
    label: "Desi & Deluxe Burgers",
    tagline: "Satisfying, made with care.",
    from: "₹69",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  },
  {
    slug: "Sides",
    label: "Garlic Breads & Sides",
    tagline: "The perfect side for your slice.",
    from: "₹39",
    image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
  },
  {
    slug: "Desserts",
    label: "Choco Lava & Desserts",
    tagline: "A sweet ending.",
    from: "₹49",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
  },
  {
    slug: "Beverages",
    label: "Cold Coffee & Drinks",
    tagline: "Cool sips from our kitchen.",
    from: "₹20",
    image: "https://images.unsplash.com/photo-1517093602195-b40af9688b46?w=600&q=80",
  },
];

/* 6 Top Best Sellers for quick instant ordering */
const BEST_SELLERS = [
  "itp6", // EL PRESTO SPECIAL
  "hm6",  // Margherita
  "dhm6", // Farmhouse
  "itp4", // Peri Peri Paneer
  "bg4",  // Paneer Deluxe Burger
  "bv1",  // Cold Coffee
];

/* ============================================================= */
/* Main Component                                                */
/* ============================================================= */
export default function ItalianArtisanalPizzeria() {
  const [addedItemNotice, setAddedItemNotice] = useState<string | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const addItem = useCartStore((state) => state.addItem);

  const handleAddToCart = (item: (typeof DUMMY_MENU)[0]) => {
    playPizzaChime();
    addItem(item);
    setAddedItemNotice(item.name);
    setTimeout(() => setAddedItemNotice(null), 2400);
    if (typeof document !== "undefined") {
      document.dispatchEvent(new Event("open-cart"));
    }
  };

  const bestSellerItems = BEST_SELLERS.map((id) =>
    DUMMY_MENU.find((i) => i.id === id)
  ).filter(Boolean) as (typeof DUMMY_MENU)[0][];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#FAF7F2] via-[#FDFBF7] to-[#F5EFEB] text-[#1C1917] selection:bg-[#D9381E] selection:text-white">

      {/* Cart Added Toast */}
      {addedItemNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#181413] px-5 py-3.5 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D9381E]">
            <Check size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-200 uppercase tracking-widest">Cart mein add ho gaya! 🎉</p>
            <p className="text-sm font-semibold">{addedItemNotice}</p>
          </div>
        </div>
      )}

      {/* Soft ambient warmth behind the food photography */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ember-pulse absolute right-0 top-20 h-96 w-96 rounded-full bg-radial from-[#E23E1D]/15 via-[#E5A93B]/8 to-transparent blur-3xl" />
        <div className="ember-pulse absolute -left-20 bottom-1/4 h-[500px] w-[500px] rounded-full bg-radial from-[#D9381E]/12 via-[#E5A93B]/5 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10">

        {/* ======================================================== */}
        {/* HERO SECTION                                              */}
        {/* ======================================================== */}
        <section className="relative overflow-hidden px-6 pb-20 pt-10 sm:px-10 md:pb-28 md:pt-16 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">

              {/* Left Column Content */}
              <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
                <div className="inline-flex items-center gap-2">
                  <span className="font-script-italian text-2xl font-bold text-[#D9381E] sm:text-3xl">
                    Seedha oven se, garam aur fresh
                  </span>
                  <span className="h-px w-10 bg-[#D9381E]/40" />
                </div>

                <h1 className="font-serif-luxury text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-[#181413] sm:text-6xl md:text-7xl">
                  Artisanal Pizza,{" "}
                  <span className="relative inline-block text-[#D9381E]">
                    Just Baked.
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
                  </span>
                </h1>

                <p className="font-cormorant-craft mx-auto max-w-xl text-lg italic leading-relaxed text-[#1C1917]/80 sm:text-xl lg:mx-0">
                  Hot from the oven. Generous with the good stuff.
                </p>

                <p className="mx-auto max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base lg:mx-0">
                  Whole-wheat crust, real mozzarella and fresh toppings, baked to order in Naini.
                  No maida. No palm oil. Just the good stuff, served hot.
                </p>

                <div className="mx-auto grid max-w-xl grid-cols-3 gap-2 text-left lg:mx-0" aria-label="Nutrition ingredient highlights">
                  {[
                    { name: "Whole wheat", nutrient: "Carbs + fibre" },
                    { name: "Paneer & cheese", nutrient: "Protein sources" },
                    { name: "Fresh veg", nutrient: "Fibre source" },
                  ].map((item) => (
                    <div key={item.name} className="rounded-xl border border-amber-200/80 bg-white/80 px-2.5 py-2.5 shadow-sm sm:px-3.5">
                      <p className="text-[11px] font-black leading-tight text-stone-900 sm:text-xs">{item.name}</p>
                      <p className="mt-1 text-[10px] leading-tight text-stone-600 sm:text-[11px]">{item.nutrient}</p>
                    </div>
                  ))}
                </div>
                <p className="-mt-4 text-left text-[10px] text-stone-500 lg:text-left">Ingredient-level highlights; exact nutrition varies by recipe.</p>

                {/* CTAs */}
                <div className="flex flex-col items-center gap-4 pt-4 sm:flex-row sm:justify-center lg:justify-start">
                  <Link
                    href="/menu"
                    className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E23E1D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-red-600/30 transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-red-300"
                  >
                    <span>Menu Dekho & Order Karo</span>
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </Link>

                  <a
                    href="#hamara-menu"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-stone-300 bg-white/80 px-7 py-3.5 text-base font-bold text-[#181413] shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#D9381E] hover:text-[#D9381E]"
                  >
                    Categories Dekho
                  </a>
                </div>

                <Link
                  href="/menu#nutrition-guide"
                  className="inline-flex items-center gap-2 pt-1 text-sm font-bold text-[#9B291B] underline decoration-[#D9381E]/30 underline-offset-4 transition-colors hover:text-[#D9381E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E]"
                >
                  Ingredient &amp; nutrition notes <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {/* Right Column Visual */}
              <div className="relative flex justify-center lg:col-span-5">
                <div className="relative w-full max-w-lg">
                  <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-[#D9381E]/20 via-[#E5A93B]/25 to-transparent blur-2xl" />
                  <div className="group relative overflow-hidden rounded-[2.5rem] border border-amber-200/60 bg-gradient-to-br from-white via-[#FAF7F2] to-amber-50/50 p-4 shadow-[0_25px_60px_rgba(217,56,30,0.18)] transition-all duration-500 hover:shadow-[0_30px_70px_rgba(217,56,30,0.25)]">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[2rem]">
                      <Image
                        src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=85"
                        alt="El Presto signature whole wheat pizza"
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 42vw"
                        className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-[#D9381E] shadow-lg backdrop-blur-md">
                        <Flame size={14} className="fill-[#D9381E]" />
                        <span>Made fresh to order</span>
                      </div>
                      <div className="absolute bottom-5 left-5 right-5 text-white">
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                          <span>Fresh from our Naini kitchen</span>
                        </div>
                        <h2 className="font-serif-luxury mt-1 text-2xl font-bold text-white">
                          Real ingredients. Big flavour.
                        </h2>
                        <p className="font-script-italian text-lg text-amber-100">
                Stone-ground whole wheat, real mozzarella, baked fresh to order.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* ABOUT SECTION / HAMARI KAHANI                            */}
        {/* ======================================================== */}
        <section
          id="hamari-kahani"
          className="border-y border-stone-200/70 bg-gradient-to-r from-[#FAF7F2] via-white to-[#F5EFEB] px-6 py-20 sm:px-10 lg:px-14"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
              {/* Image */}
              <div className="relative lg:col-span-6">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  <div className="absolute -inset-4 rounded-3xl border-2 border-dashed border-[#E5A93B]/40" />
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=1000&q=80"
                      alt="Whole wheat pizza dough aur fresh ingredients"
                      fill
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#E5A93B]">
                        Hamara Asli Andaaz
                      </p>
                      <p className="font-serif-luxury text-xl font-bold">
                        Pyaar Se Banaya, Dil Se Khilaya!
                      </p>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-amber-300 bg-[#181413] p-4 text-white shadow-xl sm:block">
                    <p className="font-serif-luxury text-3xl font-extrabold text-[#E5A93B]">100%</p>
                    <p className="text-xs text-stone-300">Whole Wheat Atta</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-6 lg:col-span-6">
                <div>
                  <span className="font-script-italian text-3xl font-bold text-[#D9381E]">
                    Hamari Kahani
                  </span>
                  <h2 className="font-serif-luxury mt-2 text-3xl font-extrabold tracking-tight text-[#181413] sm:text-4xl md:text-5xl">
                    Simple Ingredients. A Better Pizza.
                  </h2>
                </div>

                <p className="font-cormorant-craft text-lg italic text-stone-700 sm:text-xl">
                  &ldquo;Har pizza fresh bake hota hai—golden crust, stretchy mozzarella aur simple ingredients
                  jo har bite ko khaas banayein.&rdquo;
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { title: "Whole-wheat crust", sub: "Stone-ground flour, never maida." },
                    { title: "Real mozzarella", sub: "No artificial cheese analogues." },
                    { title: "No palm oil", sub: "Made with quality cooking oils." },
                    { title: "Baked to order", sub: "Prepared fresh when you order." },
                  ].map((f) => (
                    <div key={f.title} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[#B76C13]"><Check size={17} aria-hidden="true" /></span>
                      <div>
                        <span className="text-xs font-bold text-stone-900">{f.title}</span>
                        <p className="text-xs text-stone-500">{f.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

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
                      Dekho Kaise Banta Hai Pizza
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* COMPACT MENU CATEGORIES SHOWCASE                         */}
        {/* ======================================================== */}
        <section id="hamara-menu" className="px-6 py-20 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <span className="font-script-italian text-3xl font-bold text-[#D9381E]">
                Hamara Menu
              </span>
              <h2 className="font-serif-luxury mt-1 text-3xl font-extrabold tracking-tight text-[#181413] sm:text-5xl">
                Kya Khaaoge Aaj?
              </h2>
              <p className="font-cormorant-craft mx-auto mt-2 max-w-xl text-lg italic text-stone-600">
                Pick a category and find your next favourite.
              </p>
              <Link
                href="/menu#nutrition-guide"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-xs font-bold text-stone-700 transition hover:border-[#D9381E] hover:text-[#D9381E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E]"
              >
                Ingredient &amp; nutrition notes <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
              {CATEGORY_CARDS.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/menu?category=${encodeURIComponent(cat.slug)}`}
                  className="group relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:border-[#D9381E]/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] focus-visible:ring-offset-2"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={cat.image}
                      alt={cat.label}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                    <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-extrabold text-[#D9381E] shadow">
                      {cat.from} se
                    </span>


                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="font-serif-luxury text-sm font-bold leading-tight text-white line-clamp-1">
                        {cat.label}
                      </p>
                      <p className="text-xs text-amber-100 line-clamp-1 mt-1">
                        {cat.tagline}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href={`/menu?category=${encodeURIComponent("Extra Toppings")}`}
              className="group mx-auto mt-6 flex max-w-4xl items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-white to-amber-50 px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D9381E]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] focus-visible:ring-offset-2 sm:px-7"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#181413] text-amber-300"><Plus size={20} aria-hidden="true" /></span>
                <span className="min-w-0 text-left">
                  <span className="block text-xs font-black uppercase tracking-wider text-[#D9381E]">Make it yours</span>
                  <span className="mt-0.5 block truncate font-serif-luxury text-base font-bold text-[#181413] sm:text-lg">Add extra toppings and cheese</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-stone-700 sm:text-sm">From ₹10 <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
            </Link>

            <div className="mt-12 text-center">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E23E1D] px-8 py-4 font-bold text-white shadow-xl shadow-red-600/25 transition-all duration-200 hover:scale-105 hover:shadow-2xl"
              >
                <span>Poora Menu Kholo ({DUMMY_MENU.length}+ Items)</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* BEST SELLERS STRIP                                        */}
        {/* ======================================================== */}
        <section id="best-sellers" className="scroll-mt-20 border-t border-stone-200/70 bg-[#181413] px-6 py-16 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <span className="font-script-italian text-3xl font-bold text-[#E5A93B]">
                Sabka Favourite
              </span>
              <h2 className="font-serif-luxury mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Best Sellers — Har Baar Hit!
              </h2>
              <p className="mt-2 text-sm text-stone-400">
                Our favourites, ready to add to your order.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {bestSellerItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all duration-300 hover:bg-white/10 hover:border-[#D9381E]/50"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span
                      className={`absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded border bg-white ${item.isVeg ? "border-emerald-500" : "border-red-500"}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 justify-between p-3">
                    <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{item.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-serif-luxury text-base font-black text-[#E5A93B]">
                        ₹{item.price.toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        aria-label={`Add ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#D9381E] text-white transition-all hover:scale-110 active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* FOLLOW ALONG SECTION                                     */}
        {/* ======================================================== */}
        <section className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#181413] px-6 py-9 text-white shadow-2xl sm:px-10 sm:py-12 lg:px-14">
              <div className="absolute -left-10 -top-10 h-72 w-72 rounded-full bg-radial from-[#D9381E]/30 to-transparent blur-3xl" />
              <div className="absolute -right-10 -bottom-10 h-72 w-72 rounded-full bg-radial from-[#E5A93B]/20 to-transparent blur-3xl" />

              <div className="relative z-10 flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
                <div className="flex items-start gap-4 sm:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-amber-200">
                    <Camera size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E5A93B]">Follow along</p>
                    <h2 className="font-serif-luxury mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      Fresh from our kitchen.
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-300">
                      See our latest pizzas, store updates and what’s coming out of the oven.
                    </p>
                  </div>
                </div>
                <a
                  href="https://instagram.com/elprestopizza"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-[#D9381E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-[#B8190B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#181413]"
                >
                  Follow @elprestopizza <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* FOOTER                                                    */}
        {/* ======================================================== */}
        <footer className="border-t border-stone-300/80 bg-[#FAF7F2] px-6 pb-12 pt-16 text-[#1C1917] sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

              {/* Brand */}
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
                      Naini ka Apna Pizza Joint
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-stone-600">
                  Freshly baked pizzas, burgers and more from our kitchen in Naini, Prayagraj.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <a href="https://instagram.com/elprestopizza" target="_blank" rel="noreferrer" aria-label="Instagram"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#D9381E] hover:bg-[#D9381E] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E]">
                    <Camera size={16} aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Menu */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">Hamara Menu</h3>
                <ul className="space-y-2 text-xs font-medium text-stone-600">
                  {["Healthy Mania", "Double Healthy Mania", "Indian Tadka Pizza", "Medium Pizzas", "Large Pizzas", "Subs", "Fries", "Bowls", "Burgers", "Sides", "Desserts", "Beverages", "Extra Toppings"].map((item) => (
                    <li key={item}>
                      <Link href={`/menu?category=${encodeURIComponent(item)}`} className="transition-colors hover:text-[#D9381E]">{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Links */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">Quick Links</h3>
                <ul className="space-y-2 text-xs font-medium text-stone-600">
                  <li><Link href="/menu?mode=delivery" className="hover:text-[#D9381E]">Delivery & Takeaway</Link></li>
                  <li><Link href="/track" className="hover:text-[#D9381E]">Live Track Order</Link></li>
                  <li><Link href="/checkout" className="hover:text-[#D9381E]">Cart & Checkout</Link></li>
                  <li><Link href="/terms" className="hover:text-[#D9381E]">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-[#D9381E]">Privacy Policy</Link></li>
                  <li><Link href="/refunds" className="hover:text-[#D9381E]">Refund Policy</Link></li>
                </ul>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="font-serif-luxury text-sm font-bold uppercase tracking-wider text-[#181413]">Kahan Milenge?</h3>
                <div className="space-y-2 text-xs text-stone-600">
                  <p className="flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-[#D9381E]" />
                    <span>United College of Engineering &amp; Research (UCER), Naini, Prayagraj, UP – 211010</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="shrink-0 text-[#E5A93B]" />
                    <span>Roz khula: 10:00 AM – 11:00 PM</span>
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
              <p>© {new Date().getFullYear()} EL PRESTO. Sab haq surakshit hain. Made with ❤️ in Prayagraj</p>
              <div className="flex items-center gap-3">
                {["UPI", "Razorpay", "PhonePe", "Paytm", "Cash"].map((pm) => (
                  <span key={pm} className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-bold text-stone-700">{pm}</span>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* YouTube Video Modal */}
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
                Dekho Kaise Banta Hai Hamara Pizza! 🍕🔥
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
                title="Pizza banane ka process dekho!"
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
