import Link from "next/link";
import Image from "next/image";
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
  Utensils,
  Phone,
  Leaf,
  Award,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= */
/* Site constants (single source of truth for repeated claims)   */
/* ============================================================= */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elpresto.co.in";
const PHONE_DISPLAY = "+91 63925 12314";
const PHONE_TEL = "+916392512314";
const INSTAGRAM_URL = "https://instagram.com/elprestopizza";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=75&auto=format";

/* ============================================================= */
/* Metadata                                                      */
/* ============================================================= */

const OG_TITLE = "EL PRESTO | 100% Whole Wheat & Zero Palm Oil";
const OG_DESC =
  "Hot, guilt-free pizzas baked on 100% whole wheat atta with real mozzarella and zero palm oil.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: "EL PRESTO | 100% Whole Wheat Pizza & Zero Palm Oil" },
  description:
    "Order hot, guilt-free pizzas, burgers, and cold coffee from EL PRESTO. 100% whole wheat atta, zero palm oil, real mozzarella. Pickup at UCER or live GPS delivery in Naini, Prayagraj.",
  keywords: [
    "whole wheat pizza Prayagraj",
    "healthy pizza Naini",
    "EL PRESTO",
    "pizza delivery UCER",
    "zero palm oil food",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: "/",
    siteName: "EL PRESTO",
    type: "website",
    locale: "en_IN",
    images: [{ url: HERO_IMAGE, width: 1000, height: 1000, alt: "EL PRESTO whole wheat pizza" }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: [HERO_IMAGE],
  },
};

/* ============================================================= */
/* Types & data                                                  */
/* ============================================================= */

interface FeaturedItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  badge: string;
  cta: string;
  /** Show the "100% atta" tag. Only true where the crust really is whole wheat. */
  atta: boolean;
}

const featuredItems: FeaturedItem[] = [
  {
    id: "itp6",
    name: "EL PRESTO Special Pizza",
    category: "Chef's Signature",
    price: 199,
    image: HERO_IMAGE.replace("w=1000", "w=800"),
    description:
      "Our legendary chef's special with secret spiced sauce, exotic veggies & premium mozzarella.",
    badge: "Most popular",
    cta: "Order hot & fresh",
    atta: true,
  },
  {
    id: "dhm6",
    name: "Farmhouse Pizza",
    category: "Double Healthy Mania",
    price: 179,
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=75&auto=format",
    description:
      "Crisp capsicum, sweet onions, juicy tomatoes & mushrooms on 100% whole wheat crust.",
    badge: "100% whole wheat",
    cta: "Order hot & fresh",
    atta: true,
  },
  {
    id: "itp1",
    name: "Paneer Makhani Pizza",
    category: "Indian Tadka",
    price: 149,
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=75&auto=format",
    description:
      "Rich and creamy butter makhani gravy topped with soft malai paneer cubes.",
    badge: "Desi twist",
    cta: "Order hot & fresh",
    atta: true,
  },
  {
    id: "bv1",
    name: "Cold Coffee",
    category: "Beverages",
    price: 60,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=75&auto=format",
    description:
      "Zero refined sugar, rich brewed coffee with chilled cream. Refresh without guilt!",
    badge: "Guilt-free",
    cta: "Order chilled",
    atta: false,
  },
  {
    id: "bg4",
    name: "Paneer Deluxe Burger",
    category: "Burgers",
    price: 99,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=75&auto=format",
    description:
      "Crispy grilled paneer patty layered with fresh lettuce, tomatoes & tangy garlic spread.",
    badge: "Protein power",
    cta: "Order hot & fresh",
    atta: false,
  },
  {
    id: "sd2",
    name: "Stuffed Garlic Bread",
    category: "Sides",
    price: 139,
    image:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800&q=75&auto=format",
    description:
      "Golden baked garlic loaf loaded with melting mozzarella cheese and aromatic Italian herbs.",
    badge: "Extra cheesy",
    cta: "Order hot & fresh",
    atta: false,
  },
];

const pillars: { id: string; Icon: LucideIcon; title: string; description: string }[] = [
  {
    id: "wheat",
    Icon: Leaf,
    title: "100% whole wheat",
    description:
      "No maida, no compromise. Pure stone-ground wheat flour crust baked light & crispy.",
  },
  {
    id: "palm",
    Icon: ShieldCheck,
    title: "Zero palm oil",
    description:
      "We never use cheap palm oils. Cooked clean with premium cold-pressed oils.",
  },
  {
    id: "cheese",
    Icon: Award,
    title: "Real mozzarella",
    description:
      "Real dairy cheese that melts with rich pull and zero artificial cheese analogs.",
  },
  {
    id: "fresh",
    Icon: Sparkles,
    title: "Farm-fresh toppings",
    description:
      "Vibrant veggies, fresh herbs, and soft cottage paneer sourced fresh every morning.",
  },
];

const categories = [
  { name: "Healthy Mania", price: "From ₹99", slug: "healthy-mania", emoji: "🍕" },
  { name: "Double Healthy Mania", price: "From ₹129", slug: "double-healthy-mania", emoji: "🧀" },
  { name: "Indian Tadka Pizza", price: "From ₹149", slug: "indian-tadka", emoji: "🌶️" },
  { name: "Large Feast Pizzas", price: "From ₹399", slug: "large-feast", emoji: "🎉" },
  { name: "Healthy Subs & Burgers", price: "From ₹69", slug: "subs-burgers", emoji: "🍔" },
  { name: "Fries & Protein Bowls", price: "From ₹59", slug: "fries-bowls", emoji: "🍟" },
  { name: "Cold Coffee", price: "From ₹60", slug: "cold-coffee", emoji: "☕" },
  { name: "Choco Lava & Desserts", price: "From ₹49", slug: "desserts", emoji: "🍫" },
];

const orderingSteps: { num: string; title: string; desc: string; Icon: LucideIcon; tone: string }[] = [
  {
    num: "1",
    title: "Choose your food",
    desc: "Browse whole wheat pizzas, burgers, fries, bowls, and cold coffee.",
    Icon: Utensils,
    tone: "from-orange-500 to-amber-500 shadow-orange-500/25",
  },
  {
    num: "2",
    title: "Pickup or delivery",
    desc: "Collect at the UCER counter, or pin your drop location on our live map.",
    Icon: Truck,
    tone: "from-amber-500 to-yellow-500 shadow-amber-500/25",
  },
  {
    num: "3",
    title: "Track in real time",
    desc: "Pay with any UPI app and watch your order progress live until it reaches you.",
    Icon: Zap,
    tone: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
  },
];

const quickLinks = [
  { href: "/menu", label: "Explore menu" },
  { href: "/track", label: "Track live order" },
  { href: "/checkout", label: "Cart & checkout" },
  { href: "/about", label: "Our story" },
];

const legalLinks = [
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refunds", label: "Refunds & cancellation" },
];

/* ============================================================= */
/* Shared styles                                                 */
/* ============================================================= */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300";
const lift =
  "transition-transform hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const btnRed = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] font-bold text-white shadow-md shadow-red-500/25 ${lift} ${focusRing}`;
const btnDark = `inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 font-bold text-white shadow-md hover:bg-black ${lift} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400`;
const arrow =
  "transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0";
const footLink =
  "transition-colors hover:text-orange-400 focus-visible:text-orange-400 focus-visible:outline-none focus-visible:underline";

const heroBackground = {
  background:
    "radial-gradient(520px circle at 20% 0%, rgba(217,35,18,0.10), transparent 60%)," +
    "radial-gradient(460px circle at 92% 35%, rgba(245,158,11,0.15), transparent 60%)," +
    "radial-gradient(420px circle at 0% 100%, rgba(217,35,18,0.08), transparent 60%)",
} as const;

/* ============================================================= */
/* Page                                                          */
/* ============================================================= */

export default function Home() {
  const year = new Date().getFullYear();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "EL PRESTO",
    description:
      "100% whole wheat pizzas, zero palm oil, real mozzarella. Fast pickup or live GPS delivery in Naini, Prayagraj.",
    url: `${SITE_URL}/`,
    image: HERO_IMAGE,
    hasMenu: `${SITE_URL}/menu`,
    telephone: PHONE_TEL,
    priceRange: "₹",
    servesCuisine: ["Pizza", "Italian", "Healthy Fast Food"],
    sameAs: [INSTAGRAM_URL],
    address: {
      "@type": "PostalAddress",
      streetAddress: "United College of Engineering and Research, Naini",
      addressLocality: "Prayagraj",
      addressRegion: "UP",
      postalCode: "211010",
      addressCountry: "IN",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "10:00",
      closes: "23:00",
    },
  };

  return (
    <>
      {/* ============================ 1. HERO ============================ */}
      <section className="relative isolate overflow-x-clip px-4 pb-16 pt-8 md:pb-24 md:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={heroBackground}
        />

        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12">
            <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50/95 px-4 py-1.5 text-xs font-bold text-[#D92312] shadow-sm md:text-sm">
                <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#D92312] opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#D92312]" />
                </span>
                Hot, melting &amp; guilt-free
              </p>

              <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight text-gray-950 sm:text-5xl md:text-6xl lg:text-7xl">
                Crave the crust.
                <span className="relative mt-1 block w-fit text-[#D92312] max-lg:mx-auto">
                  Love your health.
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

              <p className="mx-auto max-w-xl text-base font-medium leading-relaxed text-gray-700 sm:text-lg lg:mx-0">
                Pizzas baked on{" "}
                <strong className="font-bold text-gray-950">100% whole-wheat atta</strong>, topped
                with{" "}
                <strong className="font-bold text-gray-950">real stretchy mozzarella</strong> and
                zero palm oil. Pick up at UCER or get it delivered across Naini.
              </p>

              <div className="flex flex-col items-center gap-3.5 pt-2 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/menu"
                  className={`group w-full px-8 py-4 text-base sm:w-auto ${btnRed}`}
                >
                  Order online
                  <ArrowRight size={20} aria-hidden="true" className={arrow} />
                </Link>
                <Link
                  href="/menu?mode=delivery"
                  className="group flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-orange-200 bg-white px-6 py-4 text-base font-bold text-gray-900 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 sm:w-auto"
                >
                  <Truck size={20} aria-hidden="true" className="text-[#D92312]" />
                  Get it delivered
                </Link>
              </div>

              <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2 text-sm font-semibold text-gray-700 lg:justify-start">
                {["Zero maida", "Zero palm oil", "Real mozzarella", "15-min kitchen prep"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-[11px] text-emerald-700">
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero visual */}
            <div className="relative flex justify-center lg:col-span-5">
              <div className="relative w-full max-w-md">
                <div className="relative aspect-square rounded-[2.5rem] bg-gradient-to-tr from-[#D92312]/20 via-amber-400/20 to-red-600/30 p-3.5 shadow-[0_20px_50px_rgba(217,35,18,0.25)]">
                  <div className="group relative h-full w-full overflow-hidden rounded-[2rem]">
                    <Image
                      src={HERO_IMAGE}
                      alt="EL PRESTO Special whole-wheat pizza with melted mozzarella"
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 480px"
                      className="object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
                    />
                    <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-[#D92312] shadow-lg">
                      <Flame size={13} aria-hidden="true" />
                      Bestseller
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="flex items-center gap-1 text-xs font-bold text-amber-300">
                        <Star size={12} fill="currentColor" aria-hidden="true" /> Chef&apos;s Signature
                      </p>
                      <p className="mt-1 text-2xl font-black">EL PRESTO Special</p>
                      <p className="mt-0.5 text-xs font-medium text-amber-100">
                        Stone-ground whole wheat · rich mozzarella pull
                      </p>
                    </div>
                  </div>
                </div>

                {/* The one moving element: a slowly turning quality stamp */}
                <div
                  aria-hidden="true"
                  className="absolute -right-2 -top-5 grid h-24 w-24 place-items-center rounded-full bg-[#D92312] text-white shadow-xl ring-4 ring-white sm:-right-5 sm:h-28 sm:w-28"
                >
                  <svg viewBox="0 0 120 120" className="ep-spin absolute inset-0 h-full w-full">
                    <defs>
                      <path id="ep-ring" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
                    </defs>
                    <text fontSize="9.5" fontWeight="800" fill="currentColor">
                      <textPath href="#ep-ring" textLength="284" lengthAdjust="spacing">
                        100% WHOLE WHEAT • ZERO PALM OIL •{" "}
                      </textPath>
                    </text>
                  </svg>
                  <span className="text-2xl">🌾</span>
                </div>

                <div className="absolute -bottom-4 -left-4 hidden items-center gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-xl sm:flex">
                  <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-[#D92312]">
                    <Zap size={20} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-950">15-minute kitchen</p>
                    <p className="text-xs font-semibold text-emerald-700">Hot &amp; fresh</p>
                  </div>
                </div>

                <div className="absolute -right-3 top-[58%] hidden items-center gap-2.5 rounded-2xl border border-amber-200 bg-white px-3.5 py-2.5 shadow-xl sm:flex">
                  <span aria-hidden="true" className="text-2xl">☕</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Cold Coffee</p>
                    <p className="text-xs font-bold text-[#D92312]">₹60</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== 2. MARQUEE =========================== */}
      <section
        aria-hidden="true"
        className="relative overflow-hidden border-y border-orange-200/60 bg-gradient-to-r from-[#D92312] via-[#B8190B] to-[#F59E0B] py-3.5"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-white sm:text-sm">
          {["Made to order", "Pickup at UCER", "Delivery in Naini"].map((item) => (
            <span key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-200" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ============================ 3. STORY ============================ */}
      <section id="about" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-14">
            <div className="relative lg:col-span-5">
              <div className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-3xl bg-[#211712] p-8 text-white shadow-[0_20px_50px_rgba(50,27,16,0.18)] sm:min-h-[380px] sm:p-10">
                <div aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[36px] border-[#D92312]/25" />
                <div aria-hidden="true" className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border-[28px] border-amber-400/15" />
                <span className="relative text-xs font-bold uppercase tracking-[0.2em] text-amber-300">EL PRESTO · NAINI</span>
                <div className="relative">
                  <p className="text-5xl font-black leading-none tracking-tight sm:text-6xl">A better<br />kind of slice.</p>
                  <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/75">Thoughtful ingredients, comforting favourites, and convenient pickup or delivery from our UCER kitchen.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <h2 className="text-balance text-3xl font-black leading-tight tracking-tight text-gray-950 sm:text-4xl md:text-5xl">
                Comfort food, made with care
              </h2>

              <div className="mt-5 max-w-prose space-y-4 text-base leading-relaxed text-gray-700">
                <p>
                  EL PRESTO serves pizzas, burgers, sides, desserts, and drinks from our kitchen at UCER Campus in Naini. Choose a familiar favourite or try something new from the menu.
                </p>
                <p>
                  Order online for campus pickup or delivery in the surrounding area. Menu descriptions include ingredient details to help you choose; contact us with questions about allergens or specific ingredients before ordering.
                </p>
              </div>

              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link href="/menu" className={`group px-6 py-3 text-sm ${btnDark}`}>
                  Explore our menu
                  <ArrowRight size={16} aria-hidden="true" className={arrow} />
                </Link>
                <p className="text-sm font-medium text-gray-500">UCER Campus, Naini · Prayagraj</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== 4. PICKUP & DELIVERY ====================== */}
      <section className="border-y border-orange-100 bg-orange-50/40 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              Pick up or get it delivered
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-gray-600 sm:text-base">
              Ready at the counter in about 10 minutes, or hot at your door.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-3xl border border-orange-200/80 bg-white p-7 shadow-sm md:p-9">
              <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-3xl shadow-md shadow-amber-500/20">
                🛍️
              </span>
              <h3 className="mt-4 text-2xl font-black text-gray-950">Campus counter pickup</h3>
              <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-gray-700">
                Skip the lunch crowd at UCER. Order online, get an instant kitchen token, and
                collect your food piping hot from the EL PRESTO counter.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 pt-6">
                <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <span aria-hidden="true" className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Ready in 10 mins
                </span>
                <Link href="/menu?mode=pickup" className={`group/btn px-6 py-3 text-sm ${btnDark}`}>
                  Order pickup
                  <ChevronRight size={15} aria-hidden="true" className="transition-transform group-hover/btn:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border-2 border-red-200/80 bg-gradient-to-br from-red-50 via-amber-50 to-white p-7 shadow-sm md:p-9">
              <div className="flex items-start justify-between gap-3">
                <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#D92312] to-[#F59E0B] text-3xl shadow-lg shadow-red-500/25">
                  🛵
                </span>
                <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  Delivering daily
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-black text-gray-950">Live GPS doorstep delivery</h3>
              <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-gray-700">
                Delivered to your hostel room, campus gate, or home in Naini. Pin your exact drop
                location on the live map and follow your rider in real time.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-6">
                <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                  <MapPin size={14} aria-hidden="true" /> 7 km delivery radius
                </span>
                <Link href="/menu?mode=delivery" className={`group/btn px-6 py-3 text-sm ${btnRed}`}>
                  Order delivery
                  <ChevronRight size={15} aria-hidden="true" className="transition-transform group-hover/btn:translate-x-1 motion-reduce:transition-none" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== 5. CATEGORIES ========================== */}
      <section className="relative isolate overflow-hidden border-y border-orange-100 bg-[#fff8ee] px-4 py-16 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(520px circle at 8% 0%, rgba(217,35,18,0.08), transparent 62%)," +
              "radial-gradient(520px circle at 100% 100%, rgba(245,158,11,0.13), transparent 62%)",
          }}
        />
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#D92312]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Find your next favourite
              </p>
              <h2 className="text-balance text-3xl font-black tracking-tight text-gray-950 md:text-4xl">
                Explore the menu
              </h2>
              <p className="mt-2 max-w-lg text-sm font-medium leading-relaxed text-gray-600 sm:text-base">
                From wholesome whole-wheat pizzas to desi coffee and sweet treats, there’s
                something for every craving.
              </p>
            </div>
            <Link
              href="/menu"
              className={`group shrink-0 rounded-full px-5 py-3 text-sm ${btnDark}`}
            >
              Browse full menu
              <ArrowRight size={16} aria-hidden="true" className={arrow} />
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/menu?category=${cat.slug}`}
                  className={`group relative flex h-full min-h-40 flex-col justify-between overflow-hidden rounded-3xl border border-orange-100/90 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-900/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-44 sm:p-5 ${focusRing}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 text-3xl shadow-inner ring-1 ring-inset ring-orange-100 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:h-14 sm:w-14"
                    >
                      {cat.emoji}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 place-items-center rounded-full border border-orange-100 text-gray-400 transition-all duration-300 group-hover:border-[#D92312] group-hover:bg-[#D92312] group-hover:text-white"
                    >
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </span>
                  </div>
                  <div className="mt-5">
                    <h3 className="text-sm font-black leading-snug text-gray-900 transition-colors group-hover:text-[#D92312] sm:text-base">
                      {cat.name}
                    </h3>
                    <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800 ring-1 ring-inset ring-amber-100 sm:text-xs">
                      {cat.price}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* =========================== 6. BEST SELLERS ======================== */}
      <section className="border-y border-orange-200/60 bg-gradient-to-b from-orange-50/60 to-amber-50/40 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-black tracking-tight text-gray-950 md:text-5xl">
              From the menu
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-700 md:text-base">
              Hand-tossed on whole wheat, finished with Italian herbs and real mozzarella.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredItems.map((item) => (
              <li
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition-shadow duration-300 hover:border-red-200 hover:shadow-[0_20px_50px_rgba(217,35,18,0.15)] motion-reduce:transition-none"
              >
                <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-gray-900 shadow-md">
                    {item.badge === "Most popular" ? "Signature" : item.badge}
                  </span>
                  {item.atta && (
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-amber-300">
                      100% atta
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-[#D92312]">{item.category}</span>
                      <span className="text-xl font-black text-gray-950">₹{item.price}</span>
                    </div>
                    <h3 className="text-lg font-black text-gray-900">{item.name}</h3>
                    <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-relaxed text-gray-600">
                      {item.description}
                    </p>
                  </div>
                  <Link
                    href={`/menu?item=${item.id}`}
                    className={`group/btn w-full py-3 text-sm ${btnRed}`}
                  >
                    {item.cta}
                    <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover/btn:translate-x-1 motion-reduce:transition-none" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 text-center">
            <Link href="/menu" className={`group rounded-full px-8 py-3.5 text-sm ${btnDark}`}>
              <Utensils size={16} aria-hidden="true" />
              Explore the full menu
              <ArrowRight size={16} aria-hidden="true" className={arrow} />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ 7. PILLARS ============================ */}
      {/* Plain <div role="region"> + inline styles on purpose: a global `section {}`
          rule or a class conflict can no longer turn this dark band transparent. */}
      <div
        id="promise-section"
        role="region"
        aria-labelledby="promise-heading"
        className="relative isolate px-4 py-16 sm:py-20"
        style={{
          backgroundColor: "#1a1008",
          backgroundImage:
            "radial-gradient(600px circle at 85% 0%, rgba(245,158,11,0.14), transparent 60%)," +
            "radial-gradient(500px circle at 0% 100%, rgba(217,35,18,0.16), transparent 60%)",
          color: "#ffffff",
          borderRadius: 0,
          boxShadow: "none",
          backdropFilter: "none",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <h2
              id="promise-heading"
              className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl"
            >
              Our quality promise
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-amber-100/80 sm:text-base">
              Every pizza is baked on stone-ground whole wheat with real mozzarella and zero palm
              oil. No shortcuts.
            </p>
          </div>

          <ul aria-label="Our quality commitments" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {pillars.map(({ id, Icon, title, description }) => (
              <li
                key={id}
                className="flex flex-col rounded-2xl border border-amber-400/15 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5"
              >
                <span aria-hidden="true" className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/25 to-orange-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                  <Icon size={20} />
                </span>
                <h3 className="text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/75">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* =========================== 8. HOW IT WORKS ========================= */}
      <section className="border-t border-gray-100 bg-gray-50/70 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-3xl font-black text-gray-900 md:text-4xl">
            How ordering works
          </h2>

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {orderingSteps.map(({ num, title, desc, Icon, tone }) => (
              <li key={num} className="rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                <div className={`relative mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}>
                  <Icon size={22} aria-hidden="true" />
                  <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-gray-900 text-xs font-black text-white">
                    {num}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm font-medium leading-relaxed text-gray-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================= 9. FOOTER ============================ */}
      <footer className="border-t border-gray-800 bg-gray-950 px-4 pb-8 pt-14 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-[#D92312] to-[#F59E0B] text-lg shadow-lg shadow-red-500/30">
                  🍕
                </span>
                <span className="text-lg font-black tracking-tight">EL PRESTO</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                Healthy &amp; tasty Italian cuisine. 100% whole wheat pizzas, no maida, freshly
                baked every day.
              </p>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="EL PRESTO on Instagram (opens in a new tab)"
                className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-gray-200 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>

            <nav aria-label="Quick links" className="space-y-2.5">
              <h3 className="text-sm font-bold text-white">Quick links</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                {quickLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={footLink}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-white">Find us</h3>
              <p className="flex items-start gap-1.5 text-sm text-gray-300">
                <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-500" />
                <span>
                  United College of Engineering and Research (UCER), Naini, Prayagraj, UP 211010
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-300">
                <Clock size={15} aria-hidden="true" className="shrink-0 text-orange-500" />
                Open daily, 10:00 AM to 11:00 PM
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-300">
                <Phone size={15} aria-hidden="true" className="shrink-0 text-orange-500" />
                <a href={`tel:${PHONE_TEL}`} className={footLink}>{PHONE_DISPLAY}</a>
              </p>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-white">Order &amp; support</h3>
              <p className="text-sm leading-relaxed text-gray-300">
                Orders are placed securely through our web app for immediate kitchen prep and live
                GPS dispatch.
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                {legalLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={footLink}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-800 pt-6 text-center text-xs text-gray-400 sm:flex-row">
            <p>© {year} EL PRESTO. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <Heart size={12} aria-hidden="true" className="fill-red-500 text-red-500" />
              Healthy. Tasty. Always.
            </p>
          </div>
        </div>
      </footer>

      {/* Decorative stamp animation; respect reduced-motion preferences. */}
      <style>{`
        .ep-spin { animation: ep-spin 24s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ep-spin { animation: none; }
        }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Structured data (escape "<" so the JSON can never close the script tag) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
