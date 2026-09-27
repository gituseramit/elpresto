import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Flame,
  Star,
  Clock,
  Truck,
  ShieldCheck,
  Heart,
  ChevronRight,
  MapPin,
  Sparkles,
  Zap,
  Trophy,
  Utensils,
} from "lucide-react";

/* ============================================================= */
/* Metadata                                                      */
/* ============================================================= */

export const metadata: Metadata = {
  title: "EL PRESTO Cafeteria | 100% Whole Wheat Pizza & Zero Palm Oil",
  description:
    "Order hot, guilt-free pizzas, burgers, and cold coffee from EL PRESTO Cafeteria. 100% whole wheat atta, zero palm oil, real mozzarella. Fast pickup at UCER or live GPS delivery in Naini, Prayagraj.",
  keywords: [
    "whole wheat pizza Prayagraj",
    "healthy pizza Naini",
    "EL PRESTO Cafeteria",
    "pizza delivery UCER",
    "zero palm oil food",
  ],
  alternates: { canonical: "https://elpresto.co.in/" },
  openGraph: {
    title: "EL PRESTO Cafeteria | 100% Whole Wheat & Zero Palm Oil",
    description:
      "Hot, guilt-free pizzas baked on 100% whole wheat atta with real mozzarella and zero palm oil. Delivered in 15 minutes.",
    url: "https://elpresto.co.in/",
    siteName: "EL PRESTO Cafeteria",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EL PRESTO Cafeteria | 100% Whole Wheat & Zero Palm Oil",
    description:
      "Hot, guilt-free pizzas baked on 100% whole wheat atta with real mozzarella and zero palm oil.",
  },
};

/* ============================================================= */
/* Static data                                                   */
/* ============================================================= */

interface FeaturedItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
  description: string;
  badge: string;
  rating: number;
  orders: string;
}

const featuredItems: FeaturedItem[] = [
  {
    id: "itp6",
    name: "EL PRESTO SPECIAL PIZZA",
    category: "Chef's Signature",
    price: 199,
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Our legendary chef's special with secret spiced sauce, exotic veggies & premium mozzarella.",
    badge: "⭐ Most Popular",
    rating: 4.9,
    orders: "600+",
  },
  {
    id: "dhm6",
    name: "Farmhouse Pizza",
    category: "Double Healthy Mania",
    price: 179,
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Crisp capsicum, sweet onions, juicy tomatoes & mushrooms on 100% whole wheat crust.",
    badge: "🌱 100% Whole Wheat",
    rating: 4.8,
    orders: "420+",
  },
  {
    id: "itp1",
    name: "Paneer Makhani Pizza",
    category: "Indian Tadka",
    price: 149,
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Rich and creamy butter makhani gravy topped with soft malai paneer cubes.",
    badge: "🔥 Desi Twist",
    rating: 4.9,
    orders: "380+",
  },
  {
    id: "bv1",
    name: "Desi Cold Coffee",
    category: "Healthy Beverage",
    price: 49,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Zero refined sugar, rich brewed coffee with chilled cream. Refresh without guilt!",
    badge: "☕ Guilt-Free",
    rating: 4.7,
    orders: "520+",
  },
  {
    id: "bg4",
    name: "Paneer Deluxe Burger",
    category: "Burgers",
    price: 99,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Crispy grilled paneer patty layered with fresh lettuce, tomatoes & tangy garlic spread.",
    badge: "🍔 Protein Power",
    rating: 4.8,
    orders: "290+",
  },
  {
    id: "sd2",
    name: "Stuffed Garlic Bread",
    category: "Sides",
    price: 99,
    image:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800&q=70&auto=format",
    imageWidth: 800,
    imageHeight: 600,
    description:
      "Golden baked garlic loaf loaded with melting mozzarella cheese and aromatic Italian herbs.",
    badge: "🧀 Extra Cheesy",
    rating: 4.9,
    orders: "410+",
  },
];

interface Pillar {
  emoji: string;
  title: string;
  description: string;
}

const pillars: Pillar[] = [
  {
    emoji: "🌾",
    title: "100% Whole Wheat",
    description:
      "No maida, no compromise. Pure stone-ground wheat flour crust baked light & crispy.",
  },
  {
    emoji: "🚫",
    title: "Zero Palm Oil",
    description:
      "We never use cheap palm oils. Cooked clean with premium cold-pressed oils.",
  },
  {
    emoji: "🧀",
    title: "Real Mozzarella",
    description:
      "Real dairy cheese that melts with rich pull and zero artificial cheese analogs.",
  },
  {
    emoji: "🥗",
    title: "Farm Fresh Toppings",
    description:
      "Vibrant veggies, fresh herbs, and soft cottage paneer sourced fresh every morning.",
  },
];

interface CategoryCard {
  name: string;
  price: string;
  emoji: string;
}

const categories: CategoryCard[] = [
  { name: "Healthy Mania", price: "From ₹99", emoji: "🍕" },
  { name: "Double Healthy Mania", price: "From ₹129", emoji: "🌱" },
  { name: "Indian Tadka Pizza", price: "From ₹149", emoji: "🌶️" },
  { name: "Large Feast Pizzas", price: "From ₹399", emoji: "👑" },
  { name: "Healthy Subs & Burgers", price: "From ₹69", emoji: "🍔" },
  { name: "Fries & Protein Bowls", price: "From ₹59", emoji: "🍟" },
  { name: "Desi Cold Coffee", price: "Just ₹49", emoji: "☕" },
  { name: "Choco Lava & Desserts", price: "From ₹49", emoji: "🍫" },
];

const marqueeItems: string[] = [
  "🔥 100% Whole Wheat Atta",
  "🌱 Zero Maida",
  "🧀 Real Mozzarella",
  "⚡ 15-Min Delivery",
  "🚫 Zero Palm Oil",
  "❤️ Loved by 1,200+ Foodies",
  "🌾 Freshly Baked",
  "🎉 Guilt-Free & Tasty",
];

const orderingSteps = [
  {
    num: "1",
    title: "Choose Your Food",
    desc: "Browse our whole wheat pizzas, burgers, fries, bowls, and cold coffee.",
    tone: "orange" as const,
    Icon: Utensils,
  },
  {
    num: "2",
    title: "Pickup or Delivery",
    desc: "Choose counter pickup at UCER or pin your delivery location on our interactive map.",
    tone: "amber" as const,
    Icon: Truck,
  },
  {
    num: "3",
    title: "Track in Real-Time",
    desc: "Pay seamlessly with any UPI app and watch your order progress live until it reaches you!",
    tone: "emerald" as const,
    Icon: Zap,
  },
];

/* ============================================================= */
/* Static gradient backgrounds — cheaper than blur-3xl layers    */
/* ============================================================= */

const heroBackgroundStyle: React.CSSProperties = {
  background:
    "radial-gradient(500px circle at 25% 0%, rgba(239,68,68,0.10), transparent 60%)," +
    "radial-gradient(450px circle at 90% 33%, rgba(245,158,11,0.14), transparent 60%)," +
    "radial-gradient(420px circle at 0% 100%, rgba(244,63,94,0.10), transparent 60%)",
};

const pillarsBackgroundStyle: React.CSSProperties = {
  background:
    "radial-gradient(600px circle at 100% 0%, rgba(245,158,11,0.15), transparent 55%)," +
    "radial-gradient(600px circle at 0% 100%, rgba(0,0,0,0.30), transparent 55%)",
};

/* ============================================================= */
/* Page                                                          */
/* ============================================================= */

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <>
      {/* ============================================================ */}
      {/* 1. HERO                                                       */}
      {/* ============================================================ */}
      <section className="relative px-4 pb-16 pt-8 md:pb-24 md:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={heroBackgroundStyle}
        />

        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left: text */}
            <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50/95 px-4 py-1.5 text-xs font-black text-[#D92312] shadow-sm md:text-sm">
                <span
                  aria-hidden="true"
                  className="relative flex h-2.5 w-2.5"
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#D92312] opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#D92312]" />
                </span>
                <span>HOT, MELTING &amp; GUILT-FREE • 100% WHOLE WHEAT</span>
              </div>

              <h1 className="text-4xl font-black leading-[1.04] tracking-tight text-gray-950 sm:text-5xl md:text-6xl lg:text-7xl">
                Crave The Crust.{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-[#D92312] via-[#F59E0B] to-[#B8190B] bg-clip-text text-transparent">
                    Love The Health.
                  </span>
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 h-3 w-full text-amber-400"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path
                      d="M2 8 Q 50 2, 100 6 T 198 4"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p className="mx-auto max-w-xl text-base font-medium leading-relaxed text-gray-800 sm:text-lg md:text-xl lg:mx-0">
                Sizzling artisan pizzas baked on{" "}
                <strong className="font-bold text-gray-950">
                  100% whole-wheat atta
                </strong>
                , smothered with{" "}
                <strong className="font-bold text-gray-950">
                  real stretchy mozzarella
                </strong>{" "}
                and zero palm oil. Hot, fresh &amp; delivered to your doorstep
                in 15 mins!
              </p>

              <div className="flex flex-col items-center gap-3.5 pt-2 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/menu"
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#D92312] via-[#E11D48] to-[#F59E0B] px-9 py-4 text-lg font-black text-white shadow-xl shadow-red-500/30 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 active:scale-95 sm:w-auto"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  />
                  <span className="relative flex items-center justify-center gap-3">
                    <span aria-hidden="true" className="text-2xl">
                      🍕
                    </span>
                    <span>Order Now · Starts ₹99</span>
                    <ArrowRight
                      size={20}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>

                <Link
                  href="/track"
                  className="group flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-orange-200 bg-white px-7 py-4 text-base font-extrabold text-gray-900 shadow-md transition-transform hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 sm:w-auto"
                >
                  <Truck
                    size={20}
                    aria-hidden="true"
                    className="text-[#D92312] transition-transform group-hover:-translate-x-0.5"
                  />
                  <span>Live GPS Tracking</span>
                </Link>
              </div>

              <ul className="grid grid-cols-2 gap-2.5 pt-3 sm:grid-cols-4">
                <li>
                  <TrustChip
                    emoji="🌾"
                    title="100% Atta"
                    sub="Zero Maida"
                    tone="emerald"
                  />
                </li>
                <li>
                  <TrustChip
                    emoji="🌴"
                    title="0% Palm Oil"
                    sub="Healthy Oils"
                    tone="emerald"
                  />
                </li>
                <li>
                  <TrustChip
                    emoji="🧀"
                    title="Real Cheese"
                    sub="Mozzarella"
                    tone="amber"
                  />
                </li>
                <li>
                  <TrustChip
                    emoji="⚡"
                    title="15 Mins Prep"
                    sub="Piping Hot"
                    tone="red"
                  />
                </li>
              </ul>
            </div>

            {/* Right: hero image */}
            <div className="relative flex justify-center lg:col-span-5">
              <div className="relative w-full max-w-md">
                <div className="relative aspect-square rounded-[2.5rem] bg-gradient-to-tr from-[#D92312]/20 via-amber-400/20 to-red-600/30 p-3.5 shadow-[0_20px_50px_rgba(217,35,18,0.25)]">
                  <div className="group relative h-full w-full overflow-hidden rounded-[2rem] shadow-inner">
                    <img
                      src="https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000&q=75&auto=format"
                      alt="Hot whole-wheat pizza with melted mozzarella"
                      width={1000}
                      height={1000}
                      loading="eager"
                      // @ts-expect-error — valid HTML attribute, not yet in React's types
                      fetchpriority="high"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                    />

                    <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-amber-500 px-3.5 py-1.5 text-xs font-black text-white shadow-lg">
                      <Flame
                        size={12}
                        aria-hidden="true"
                        className="motion-safe:animate-pulse"
                      />
                      BESTSELLER
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-full bg-[#D92312] px-3 py-0.5 text-[11px] font-black uppercase tracking-wider shadow-sm">
                          Chef&apos;s Signature
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Star
                            size={11}
                            fill="currentColor"
                            aria-hidden="true"
                          />{" "}
                          4.9
                        </span>
                      </div>
                      <h2 className="text-2xl font-black">
                        EL PRESTO SPECIAL
                      </h2>
                      <p className="mt-0.5 line-clamp-1 text-xs font-medium text-amber-100">
                        100% Stoneground Whole Wheat • Rich Mozzarella Pull
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floating badges — hidden on very small screens to avoid overlap */}
                <div className="absolute -bottom-4 -left-4 hidden items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-xl sm:flex">
                  <div
                    aria-hidden="true"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-xl font-black text-[#D92312]"
                  >
                    ⚡
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-950">
                      Fast 15-Min Kitchen
                    </p>
                    <p className="text-[11px] font-bold text-emerald-700">
                      100% Hot &amp; Fresh
                    </p>
                  </div>
                </div>

                <div className="absolute -top-3 -left-3 hidden items-center gap-2.5 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-xl sm:flex">
                  <span aria-hidden="true" className="text-2xl">
                    ☕
                  </span>
                  <div>
                    <p className="text-xs font-black text-gray-900">
                      Desi Cold Coffee
                    </p>
                    <p className="text-[11px] font-black text-[#D92312]">
                      Only ₹49
                    </p>
                  </div>
                </div>

                <div className="absolute -right-3 top-1/2 hidden items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3.5 py-2.5 shadow-xl lg:flex">
                  <div className="flex -space-x-1">
                    {["😋", "🤤", "😍"].map((e, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-amber-100 text-xs"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                    1200+ Foodies
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. MARQUEE                                                    */}
      {/* ============================================================ */}
      <section
        aria-hidden="true"
        className="relative overflow-hidden border-y border-orange-200/60 bg-gradient-to-r from-[#D92312] via-[#B8190B] to-[#F59E0B] py-3.5"
      >
        <div className="marquee-track flex gap-8 whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-2 text-sm font-black uppercase tracking-wider text-white/95"
            >
              {item}
              <span className="text-amber-200">•</span>
            </span>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. PICKUP & DELIVERY                                          */}
      {/* ============================================================ */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-orange-700">
              <Sparkles size={12} aria-hidden="true" /> Two Ways to Feast
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Choose Your Experience
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-gray-600">
              Pickup in 10 mins at the counter or get it delivered hot to your
              door.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Pickup */}
            <div className="group relative overflow-hidden rounded-[2rem] border border-orange-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(217,35,18,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_20px_50px_rgba(217,35,18,0.15)] md:p-9">
              <div className="relative space-y-3.5">
                <div
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-3xl text-white shadow-md shadow-amber-500/20 transition-transform group-hover:rotate-6 group-hover:scale-110"
                >
                  🛍️
                </div>
                <h3 className="text-2xl font-black text-gray-950">
                  Campus Counter Pickup
                </h3>
                <p className="text-sm font-medium leading-relaxed text-gray-700">
                  Skip the long lunch crowds at UCER! Place your order online,
                  get an instant kitchen token, and collect your food piping hot
                  directly from the El Presto counter.
                </p>
              </div>

              <div className="relative mt-6 flex items-center justify-between border-t border-orange-100 pt-6">
                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#D92312]">
                  <span aria-hidden="true" className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Fresh in 10 mins
                </span>
                <Link
                  href="/menu"
                  className="group/btn flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-3 text-xs font-black text-white shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 active:scale-95"
                >
                  Order Pickup
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform group-hover/btn:translate-x-1"
                  />
                </Link>
              </div>
            </div>

            {/* Delivery */}
            <div className="group relative overflow-hidden rounded-[2rem] border-2 border-red-200/80 bg-gradient-to-br from-red-500/10 via-amber-500/10 to-white p-7 shadow-[0_10px_30px_rgba(217,35,18,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:border-red-300 hover:shadow-[0_20px_50px_rgba(217,35,18,0.18)] md:p-9">
              <div className="relative space-y-3.5">
                <div
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#D92312] to-[#F59E0B] text-3xl text-white shadow-lg shadow-red-500/30 transition-transform group-hover:rotate-6 group-hover:scale-110"
                >
                  🛵
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-2xl font-black text-gray-950">
                    Live GPS Doorstep Delivery
                  </h3>
                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-800">
                    Active Now
                  </span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-gray-700">
                  Direct to your hostel room, campus gate, or residence in
                  Naini! Pin your exact drop location on our live road map and
                  track your rider in real time.
                </p>
              </div>

              <div className="relative mt-6 flex items-center justify-between border-t border-red-100 pt-6">
                <span className="text-xs font-black uppercase tracking-wide text-emerald-800">
                  📍 7 km Delivery Radius
                </span>
                <Link
                  href="/menu"
                  className="group/btn flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] px-6 py-3 text-xs font-black text-white shadow-md shadow-red-500/30 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300 active:scale-95"
                >
                  Order Delivery
                  <ChevronRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform group-hover/btn:translate-x-1"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. CATEGORIES                                                 */}
      {/* ============================================================ */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#D92312]">
                <Flame size={12} aria-hidden="true" /> Fresh Ingredients · Zero
                Preservatives
              </span>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-gray-950 md:text-4xl">
                Explore Mouthwatering Categories
              </h2>
            </div>
            <Link
              href="/menu"
              className="group flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-[#D92312] transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
            >
              View Full Menu
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <li key={cat.name}>
                <Link
                  href="/menu"
                  className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-transform hover:-translate-y-1 hover:border-[#D92312] hover:bg-orange-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
                >
                  <div
                    aria-hidden="true"
                    className="text-3xl transition-transform group-hover:scale-110 group-hover:rotate-6"
                  >
                    {cat.emoji}
                  </div>
                  <div className="relative mt-4">
                    <h3 className="text-sm font-extrabold text-gray-900 transition-colors group-hover:text-[#D92312] md:text-base">
                      {cat.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-black text-amber-600">
                      {cat.price}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="absolute right-4 top-4 text-[#D92312] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. BEST SELLERS                                               */}
      {/* ============================================================ */}
      <section className="border-y border-orange-200/60 bg-gradient-to-b from-orange-50/60 to-amber-50/40 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-100 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#D92312]">
              <Trophy size={12} aria-hidden="true" /> Most Loved By 1,200+
              Students
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 md:text-5xl">
              Top Customer Favorites
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-700 md:text-base">
              Hand-tossed with 100% whole wheat, authentic Italian herbs, and
              rich melting mozzarella pull.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredItems.map((item, idx) => (
              <li
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-transform duration-300 hover:-translate-y-2 hover:border-red-200 hover:shadow-[0_20px_50px_rgba(217,35,18,0.18)]"
              >
                <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                  <img
                    src={item.image}
                    alt={item.name}
                    width={item.imageWidth}
                    height={item.imageHeight}
                    /* First item is above the fold on mobile → load eagerly. */
                    loading={idx === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-orange-100 bg-white/95 px-3 py-1 text-[11px] font-black text-gray-900 shadow-md">
                    {item.badge}
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                    🌾 100% Atta
                  </span>

                  <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-gray-900 shadow-sm">
                    <Star
                      size={10}
                      aria-hidden="true"
                      className="fill-amber-400 text-amber-400"
                    />
                    {item.rating} · {item.orders}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                  <div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[#D92312]">
                        {item.category}
                      </span>
                      <span className="text-xl font-black text-gray-950">
                        ₹{item.price}
                      </span>
                    </div>
                    <h3 className="line-clamp-1 text-lg font-black text-gray-900 transition-colors group-hover:text-[#D92312]">
                      {item.name}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-relaxed text-gray-600">
                      {item.description}
                    </p>
                  </div>

                  <Link
                    href="/menu"
                    className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] py-3 text-xs font-black text-white shadow-md shadow-red-500/20 transition-transform hover:-translate-y-0.5 hover:from-[#B8190B] hover:to-[#991409] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300 active:scale-95"
                  >
                    <span>Order Hot &amp; Fresh</span>
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="transition-transform group-hover/btn:translate-x-1"
                    />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 text-center">
            <Link
              href="/menu"
              className="group inline-flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3.5 text-sm font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400"
            >
              <Utensils size={16} aria-hidden="true" />
              <span>Explore All 46+ Menu Items</span>
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. PILLARS                                                    */}
      {/* ============================================================ */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div
            className="relative overflow-hidden rounded-[3rem] border border-red-400/30 bg-gradient-to-br from-[#800C04] via-[#A8170D] to-[#D92312] p-8 text-white shadow-[0_25px_60px_-15px_rgba(217,35,18,0.4)] md:p-14"
            style={pillarsBackgroundStyle}
          >
            <div className="relative z-10 mx-auto mb-10 max-w-2xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200">
                <ShieldCheck size={12} aria-hidden="true" /> 100% Purity &amp;
                Taste Promise
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Why Thousands Trust EL PRESTO
              </h2>
              <p className="mt-2 text-sm font-medium text-red-100 md:text-base">
                Fast food doesn&apos;t have to be junk food. We proved that
                pizza can be healthy, guilt-free, and super tasty.
              </p>
            </div>

            <ul className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((pillar, idx) => (
                <li
                  key={idx}
                  className="group flex flex-col items-center rounded-3xl border border-white/20 bg-black/20 p-6 text-center shadow-inner transition-transform hover:-translate-y-1 hover:bg-black/30"
                >
                  <span
                    aria-hidden="true"
                    className="mb-3 text-4xl drop-shadow-md transition-transform group-hover:scale-110 group-hover:-rotate-6"
                  >
                    {pillar.emoji}
                  </span>
                  <h3 className="mb-1.5 text-base font-black text-white">
                    {pillar.title}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-amber-100/90">
                    {pillar.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. HOW IT WORKS                                               */}
      {/* ============================================================ */}
      <section className="border-t border-white/40 bg-white/40 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-orange-700">
              <Zap size={12} aria-hidden="true" /> Simple 3-Step Process
            </span>
            <h2 className="mt-3 text-3xl font-black text-gray-900 md:text-4xl">
              How Ordering Works
            </h2>
          </div>

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {orderingSteps.map((step) => {
              const Icon = step.Icon;
              const toneCls =
                step.tone === "orange"
                  ? "from-orange-500 to-amber-500 shadow-orange-500/25"
                  : step.tone === "amber"
                  ? "from-amber-500 to-yellow-500 shadow-amber-500/25"
                  : "from-emerald-500 to-teal-500 shadow-emerald-500/25";
              return (
                <li
                  key={step.num}
                  className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white p-6 text-center shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className={`relative mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${toneCls}`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-gray-900 text-[11px] font-black text-white"
                    >
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-gray-600">
                    {step.desc}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. FOOTER                                                     */}
      {/* ============================================================ */}
      <footer className="mt-auto border-t border-gray-800 bg-gray-900 px-4 pb-8 pt-14 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-[#D92312] to-[#F59E0B] text-lg shadow-lg shadow-red-500/30"
                >
                  🍕
                </span>
                <span className="text-lg font-black tracking-tight text-white">
                  EL PRESTO
                </span>
              </div>
              <p className="text-xs leading-relaxed text-gray-400">
                Healthy &amp; Tasty Italian Cuisines. 100% whole wheat pizzas,
                no maida, freshly baked everyday.
              </p>
              <div className="flex gap-3 pt-2">
                <a
                  href="https://instagram.com/elprestopizza"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="EL PRESTO on Instagram"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-gray-300 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick links */}
            <nav aria-label="Quick links" className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-gray-200">
                Quick Links
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>
                  <Link
                    href="/menu"
                    className="transition-colors hover:text-orange-400 focus-visible:text-orange-400 focus-visible:outline-none"
                  >
                    Explore Menu
                  </Link>
                </li>
                <li>
                  <Link
                    href="/track"
                    className="transition-colors hover:text-orange-400 focus-visible:text-orange-400 focus-visible:outline-none"
                  >
                    Track Live Order
                  </Link>
                </li>
                <li>
                  <Link
                    href="/checkout"
                    className="transition-colors hover:text-orange-400 focus-visible:text-orange-400 focus-visible:outline-none"
                  >
                    Cart &amp; Checkout
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Hub */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-gray-200">
                Our Hub Location
              </h3>
              <p className="flex items-start gap-1.5 text-xs text-gray-400">
                <MapPin
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-orange-500"
                />
                <span>
                  United College of Engineering and Research (UCER), Naini,
                  Prayagraj, UP 211010
                </span>
              </p>
              <p className="flex items-center gap-1.5 pt-1 text-xs text-gray-400">
                <Clock
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-orange-500"
                />
                <span>Open Everyday: 10:00 AM - 11:00 PM</span>
              </p>
            </div>

            {/* Notice */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-gray-200">
                Online Ordering Only
              </h3>
              <p className="text-xs leading-relaxed text-gray-400">
                All orders are placed securely through our web app for
                immediate kitchen prep and live GPS dispatch.
              </p>
              <div className="pt-1">
                <Link
                  href="/menu"
                  className="inline-flex items-center gap-1 text-xs font-bold text-orange-400 transition-colors hover:text-orange-300 focus-visible:text-orange-300 focus-visible:outline-none"
                >
                  Order Online Now{" "}
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-800 pt-6 text-center text-xs text-gray-500 sm:flex-row">
            <p>© {year} EL PRESTO PIZZA. All rights reserved.</p>
            <p className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Heart
                size={11}
                aria-hidden="true"
                className="fill-red-500 text-red-500"
              />
              Healthy. Tasty. Always. 🌾
            </p>
          </div>
        </div>
      </footer>

      {/* Marquee animation — scoped, GPU-promoted, reduced-motion aware */}
      <style>{`
        .marquee-track {
          animation: marquee-scroll 30s linear infinite;
          will-change: transform;
          contain: content;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
          }
        }
        @keyframes marquee-scroll {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>

      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            name: "EL PRESTO Cafeteria",
            description:
              "100% whole wheat pizzas, zero palm oil, real mozzarella. Fast pickup or live GPS delivery in Naini, Prayagraj.",
            url: "https://elpresto.co.in/",
            telephone: "+91 6392512314",
            priceRange: "₹₹",
            servesCuisine: ["Pizza", "Italian", "Healthy Fast Food"],
            address: {
              "@type": "PostalAddress",
              streetAddress:
                "United College of Engineering and Research, Naini",
              addressLocality: "Prayagraj",
              addressRegion: "UP",
              postalCode: "211010",
              addressCountry: "IN",
            },
            openingHours: "Mo-Su 10:00-23:00",
          }),
        }}
      />
    </>
  );
}

/* ============================================================= */
/* Small components                                              */
/* ============================================================= */

function TrustChip({
  emoji,
  title,
  sub,
  tone,
}: {
  emoji: string;
  title: string;
  sub: string;
  tone: "emerald" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-200/80 hover:border-emerald-400",
    amber: "border-amber-200/80 hover:border-amber-400",
    red: "border-red-200/80 hover:border-red-400",
  };
  const textTones: Record<string, string> = {
    emerald: "text-emerald-950",
    amber: "text-amber-950",
    red: "text-red-950",
  };
  const subTones: Record<string, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border bg-white px-3.5 py-2.5 text-xs font-black shadow-sm transition-colors ${tones[tone]}`}
    >
      <span aria-hidden="true" className="text-lg">
        {emoji}
      </span>
      <div className="text-left">
        <p className={`leading-tight ${textTones[tone]}`}>{title}</p>
        <p className={`text-[10px] font-bold ${subTones[tone]}`}>{sub}</p>
      </div>
    </div>
  );
}