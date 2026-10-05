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
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ThemeControl from "@/components/ThemeControl";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);

    if (document.visibilityState === "visible") startPolling();

    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
      stopPolling();
    };
  }, [mounted]);

  /* Close dropdown on route change */
  useEffect(() => {
    setDropdownOpen(false);
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
    <header className="customer-header sticky top-0 z-40 w-full border-b border-orange-100 bg-white shadow-[0_4px_25px_-5px_rgba(217,35,18,0.06)] dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        {/* Logo (Left): ElPresto with minimalist golden flame / pizza graphic */}
        <Link
          href="/"
          aria-label="ElPresto Italian Artisanal Pizzeria"
          className="group flex items-center gap-2 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9381E] via-[#E23E1D] to-[#E5A93B] text-white shadow-md shadow-red-600/30 transition-transform group-hover:rotate-6">
            <Flame size={22} className="fill-amber-200 text-amber-200" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#181413] text-[9px] text-[#E5A93B]">
              🍕
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif-luxury text-2xl font-black tracking-tight text-[#181413] dark:text-amber-100 sm:text-[26px]">
              El<span className="text-[#D9381E]">Presto</span>
            </span>
            <span className="font-script-italian -mt-1.5 text-xs text-[#2C5E3B] tracking-wider dark:text-emerald-400">
              Pizzeria Artigianale
            </span>
          </div>
        </Link>

        {/* Navigation Links (Center): Menu, Oven Specials, Dough Track */}
        <nav
          aria-label="Artisanal Navigation"
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
            href="/#popular-pizzas"
            className="group relative py-1.5 transition-colors hover:text-[#D9381E] dark:hover:text-[#E5A93B]"
          >
            <span>Oven Specials</span>
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#D9381E] transition-all duration-300 group-hover:w-full" />
          </Link>

          <Link
            href="/track"
            className="group relative py-1.5 transition-colors hover:text-[#D9381E] dark:hover:text-[#E5A93B]"
          >
            <span>Dough Track</span>
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#D9381E] transition-all duration-300 group-hover:w-full" />
          </Link>

          {hasActiveOrder && (
            <Link
              href="/track"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D9381E] to-[#E5A93B] px-3.5 py-1 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Live Oven
            </Link>
          )}
        </nav>

        {/* Search Bar & Action Utilities (Right) */}
        <div className="flex items-center gap-3">
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
            className="group relative flex items-center gap-2.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-[#1C1917] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D9381E] hover:bg-[#FAF7F2] hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
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
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-wider text-stone-500 group-hover:text-[#D9381E] dark:text-stone-400">
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
                className="rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] px-3 py-2 text-sm font-black text-white shadow-md shadow-red-500/20 transition-transform hover:-translate-y-0.5 hover:from-[#B8190B] hover:to-[#991409] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-95 min-[380px]:px-5"
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