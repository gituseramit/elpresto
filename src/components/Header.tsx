"use client";

import Link from "next/link";
import {
  ShoppingCart,
  Activity,
  LogOut,
  User,
  ChevronDown,
  Package,
  Menu as MenuIcon,
  Flame,
  Search,
  X,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ThemeControl from "@/components/ThemeControl";
import { ACTIVE_ORDER_CHANGED_EVENT } from "@/lib/activeOrderEvents";

/* ============================================================= */
/* Helpers                                                       */
/* ============================================================= */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/* ============================================================= */
/* Header                                                        */
/* ============================================================= */

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const items = useCartStore((state) => state.items);
  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );
  const cartTotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0),
    [items]
  );

  const [headerSearch, setHeaderSearch] = useState("");
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      router.push(`/menu?q=${encodeURIComponent(headerSearch.trim())}`);
    } else {
      router.push("/menu");
    }
  };

  const { user, userProfile, loading: authLoading, logout } = useAuth();

  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /* Hydration guard for localStorage reads */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Detect an active order via storage / focus events + a low-frequency
   * poll that only runs while the tab is visible. */
  useEffect(() => {
    if (!mounted) return;

    const check = () => {
      try {
        setHasActiveOrder(!!window.localStorage.getItem("activeOrderId"));
      } catch {
        setHasActiveOrder(false);
      }
    };
    check();

    let interval: number | null = null;
    const startPolling = () => {
      if (interval != null) return;
      interval = window.setInterval(check, 5000);
    };
    const stopPolling = () => {
      if (interval != null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        check();
        startPolling();
      } else {
        stopPolling();
      }
    };

    window.addEventListener("storage", check);
    window.addEventListener(ACTIVE_ORDER_CHANGED_EVENT, check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);

    if (document.visibilityState === "visible") startPolling();

    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener(ACTIVE_ORDER_CHANGED_EVENT, check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
      stopPolling();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  /* Close dropdown on route change */
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  /* Close dropdown on outside click / touch and on Escape */
  useEffect(() => {
    if (!dropdownOpen) return;

    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const openCart = useCallback(() => {
    document.dispatchEvent(new Event("open-cart"));
  }, []);

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    await logout();
    router.push("/");
  }, [logout, router]);

  const displayName =
    userProfile?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Account";
  const initials = getInitials(displayName);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;

  return (
    <header className="customer-header sticky top-0 z-40 w-full border-b border-orange-100 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-2.5 sm:px-4">
        {/* Logo (Left): ElPresto with minimalist golden flame / pizza graphic */}
        <Link
          href="/"
          aria-label="ElPresto Italian Artisanal Pizzeria"
          className="group flex items-center gap-1.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:gap-2"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9381E] via-[#E23E1D] to-[#E5A93B] text-white shadow-md shadow-red-600/30 transition-transform group-hover:rotate-6 sm:h-10 sm:w-10">
            <Flame size={22} className="fill-amber-200 text-amber-200" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#181413] text-base leading-none text-[#E5A93B]">
              🍕
            </span>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-serif-luxury whitespace-nowrap text-[22px] font-black tracking-tight text-[#181413] dark:text-amber-100 sm:text-[26px]">
              El<span className="text-[#D9381E]">Presto</span>
            </span>
            <span className="font-script-italian -mt-1.5 hidden whitespace-nowrap text-xs tracking-wider text-[#2C5E3B] dark:text-emerald-400 min-[400px]:block">
              Pizzeria Artigianale
            </span>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-sm font-semibold tracking-wide text-[#1C1917] dark:text-stone-200 md:flex"
        >
          <Link
            href="/menu"
            className="group relative py-1.5 transition-colors hover:text-[#D9381E] dark:hover:text-[#E5A93B]"
          >
            <span>Menu</span>
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#D9381E] transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link
            href="/#best-sellers"
            className="group relative py-1.5 transition-colors hover:text-[#D9381E] dark:hover:text-[#E5A93B]"
          >
            <span>Best Sellers</span>
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#D9381E] transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link
            href="/track"
            aria-label={hasActiveOrder ? "Track your live order" : "Live track order"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors ${hasActiveOrder ? "bg-orange-50 text-[#B8190B] dark:bg-orange-500/10 dark:text-orange-300" : "hover:text-[#D9381E] dark:hover:text-[#E5A93B]"}`}
          >
            {hasActiveOrder && <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#D9381E]" />}
            <Activity size={15} aria-hidden="true" />
            <span>{hasActiveOrder ? "Track Live Order" : "Live Track Order"}</span>
          </Link>
        </nav>

        {/* Search Bar & Action Utilities (Right) */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <div className="relative md:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenuOpen}
              aria-controls="customer-mobile-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-[#181413] transition hover:border-[#D9381E] hover:text-[#D9381E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] dark:border-stone-700 dark:bg-stone-900 dark:text-white"
            >
              {mobileMenuOpen ? <X size={19} aria-hidden="true" /> : <MenuIcon size={19} aria-hidden="true" />}
            </button>
            <nav
              id="customer-mobile-navigation"
              aria-label="Mobile navigation"
              hidden={!mobileMenuOpen}
              className="fixed right-3 top-[4.75rem] z-50 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl dark:border-stone-700 dark:bg-slate-900"
            >
              <Link href="/menu" className="block rounded-xl px-4 py-3 text-sm font-bold text-stone-800 transition hover:bg-orange-50 hover:text-[#D9381E] dark:text-stone-100 dark:hover:bg-white/5">Menu</Link>
              <Link href="/#best-sellers" className="block rounded-xl px-4 py-3 text-sm font-bold text-stone-800 transition hover:bg-orange-50 hover:text-[#D9381E] dark:text-stone-100 dark:hover:bg-white/5">Best Sellers</Link>
              <Link href="/menu#nutrition-guide" className="block rounded-xl px-4 py-3 text-sm font-bold text-stone-800 transition hover:bg-orange-50 hover:text-[#D9381E] dark:text-stone-100 dark:hover:bg-white/5">Ingredients &amp; Nutrition</Link>
              <Link href="/track" className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${hasActiveOrder ? "bg-orange-50 text-[#B8190B] dark:bg-orange-500/10 dark:text-orange-300" : "text-stone-800 hover:bg-orange-50 hover:text-[#D9381E] dark:text-stone-100 dark:hover:bg-white/5"}`}>
                <span className="inline-flex items-center gap-2"><Activity size={16} aria-hidden="true" />{hasActiveOrder ? "Track your live order" : "Live Track Order"}</span>
                {hasActiveOrder && <span className="rounded-full bg-[#D9381E] px-2 py-0.5 text-xs font-black uppercase tracking-wider text-white">Live</span>}
              </Link>
              {mounted && !authLoading && !user && (
                <Link href="/auth" className="block rounded-xl bg-[#D9381E] px-4 py-3 text-sm font-bold text-white min-[380px]:hidden">Sign in / Create account</Link>
              )}
            </nav>
          </div>

          {/* Pill-shaped search input */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative hidden lg:block"
          >
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search pizzas, toppings..."
              className="w-52 rounded-full border border-stone-200 bg-[#FAF7F2] py-2 pl-9 pr-4 text-xs font-medium text-[#1C1917] placeholder-stone-400 transition-all focus:w-64 focus:border-[#D9381E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9381E]/20 dark:border-stone-700 dark:bg-stone-900 dark:text-white dark:placeholder-stone-500"
            />
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
          </form>

          <ThemeControl />

          {/* Shopping Cart / Pizza Box Widget */}
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open Pizza Box with ${itemCount} items`}
            className="group relative flex h-10 w-10 shrink-0 items-center justify-center gap-2.5 rounded-full border border-stone-200 bg-white px-2 text-xs font-bold text-[#1C1917] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D9381E] hover:bg-[#FAF7F2] hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 sm:h-auto sm:w-auto sm:justify-start sm:px-4 sm:py-2"
          >
            <div className="relative">
              <span className="text-base" role="img" aria-label="Pizza Box">
                📦
              </span>
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#D9381E] text-[10px] font-black text-white">
                  {itemCount}
                </span>
              )}
            </div>
            <div className="hidden flex-col text-left sm:flex">
              <span className="text-xs uppercase tracking-wider text-stone-600 group-hover:text-[#D9381E] dark:text-stone-400">
                Your Box
              </span>
              <span className="font-serif-luxury font-bold text-[#181413] dark:text-white">
                ₹{cartTotal.toFixed(2)}
              </span>
            </div>
          </button>

          {/* Auth */}
          {mounted && !authLoading && (
            user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-1.5 rounded-full border border-orange-100 py-1 pl-1 pr-2.5 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#D92312] to-[#F59E0B] text-xs font-black text-white shadow-sm"
                  >
                    {initials}
                  </span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`text-gray-400 transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white py-2 shadow-2xl"
                  >
                    <div className="border-b border-gray-50 bg-orange-50/40 px-4 py-3">
                      <p className="truncate text-sm font-extrabold text-gray-900">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      href="/profile"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-orange-50 hover:text-[#D92312]"
                    >
                      <User size={15} aria-hidden="true" /> My Profile
                    </Link>

                    <Link
                      href="/profile#orders"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-orange-50 hover:text-[#D92312]"
                    >
                      <Package size={15} aria-hidden="true" /> My Orders
                    </Link>

                    <div className="mt-1 border-t border-gray-100 pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut size={15} aria-hidden="true" /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="hidden rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] px-3 py-2 text-sm font-black text-white shadow-md shadow-red-500/20 transition-transform hover:-translate-y-0.5 hover:from-[#B8190B] hover:to-[#991409] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-95 min-[380px]:block min-[380px]:px-5"
              >
                Login
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
