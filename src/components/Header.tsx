"use client";

import Link from "next/link";
import {
  ShoppingCart,
  Activity,
  LogOut,
  User,
  ChevronDown,
  Package,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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
    <header className="sticky top-0 z-40 w-full border-b border-orange-100 bg-white shadow-[0_4px_25px_-5px_rgba(217,35,18,0.06)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          aria-label="EL PRESTO home"
          className="flex items-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
        >
          <img
            src="/logo.png"
            alt="EL PRESTO"
            width={120}
            height={44}
            className="h-10 w-auto object-contain sm:h-11"
          />
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 text-sm font-black text-gray-800 md:flex"
        >
          <Link
            href="/"
            aria-current={isActive("/") ? "page" : undefined}
            className={`transition-colors hover:text-[#D92312] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${
              isActive("/") ? "text-[#D92312]" : ""
            }`}
          >
            Home
          </Link>

          <Link
            href="/menu"
            aria-current={isActive("/menu") ? "page" : undefined}
            className={`flex items-center gap-1 transition-colors hover:text-[#D92312] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${
              isActive("/menu") ? "text-[#D92312]" : "text-gray-900"
            }`}
          >
            <span>Menu</span>
            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-[#D92312]">
              HOT 🔥
            </span>
          </Link>

          {hasActiveOrder && (
            <Link
              href="/track"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D92312] to-[#F59E0B] px-4 py-1.5 text-xs font-black text-white shadow-md shadow-red-500/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            >
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live Order
            </Link>
          )}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          {/* Mobile live-order pill */}
          {hasActiveOrder && (
            <Link
              href="/track"
              aria-label="Live order status"
              className="flex items-center justify-center rounded-full bg-gradient-to-r from-[#D92312] to-[#F59E0B] p-2 text-white shadow-md md:hidden"
            >
              <Activity size={18} aria-hidden="true" />
            </Link>
          )}

          {/* Cart */}
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open shopping cart${
              itemCount > 0 ? ` (${itemCount} items)` : ""
            }`}
            className="relative rounded-2xl border border-transparent p-2.5 text-gray-800 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-[#D92312] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
          >
            <ShoppingCart
              size={22}
              className="stroke-[2.2]"
              aria-hidden="true"
            />
            {itemCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#D92312] px-1 text-xs font-black text-white shadow-md"
              >
                {itemCount}
              </span>
            )}
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
                className="rounded-xl bg-gradient-to-r from-[#D92312] to-[#B8190B] px-5 py-2 text-sm font-black text-white shadow-md shadow-red-500/20 transition-transform hover:-translate-y-0.5 hover:from-[#B8190B] hover:to-[#991409] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-95"
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