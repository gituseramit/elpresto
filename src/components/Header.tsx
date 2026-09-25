"use client";

import Link from "next/link";
import { ShoppingCart, Utensils, Activity, LogOut, User, ChevronDown, Package } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, userProfile, loading: authLoading, logout } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const checkOrder = () => setHasActiveOrder(!!localStorage.getItem("activeOrderId"));
    checkOrder();
    window.addEventListener("storage", checkOrder);
    const interval = setInterval(checkOrder, 2000);
    return () => { window.removeEventListener("storage", checkOrder); clearInterval(interval); };
  }, [mounted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Hide header on staff routes
  const isStaffRoute = ["/kitchen", "/admin", "/track", "/delivery", "/counter"].some(r => pathname?.startsWith(r));
  if (isStaffRoute) return null;

  const displayName = userProfile?.name || user?.displayName || user?.email?.split("@")[0] || "Account";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-xl border-b border-orange-100 shadow-[0_4px_25px_-5px_rgba(217,35,18,0.06)]">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center group transition-transform active:scale-95">
          <img
            src="https://i.postimg.cc/FzwvsB1x/dde.png"
            alt="EL PRESTO"
            className="h-10 sm:h-11 w-auto object-contain"
          />
        </Link>

        <nav className="hidden md:flex gap-7 font-black text-sm text-gray-800 items-center">
          <Link href="/" className="hover:text-[#D92312] transition-colors">Home</Link>
          <Link href="/menu" className="hover:text-[#D92312] transition-colors flex items-center gap-1 text-gray-900">
            <span>Menu</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-red-100 text-[#D92312] font-black tracking-wide">HOT 🔥</span>
          </Link>
          {hasActiveOrder && (
            <Link href="/track" className="flex items-center gap-1.5 text-white bg-gradient-to-r from-[#D92312] to-[#F59E0B] px-4 py-1.5 rounded-full transition-all text-xs font-black shadow-md shadow-red-500/25 hover:shadow-lg hover:scale-105">
              <Activity size={14} className="animate-spin" /> Live Order Status
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {hasActiveOrder && (
            <Link href="/track" className="md:hidden flex items-center justify-center p-2 text-white bg-gradient-to-r from-[#D92312] to-[#F59E0B] rounded-full shadow-md">
              <Activity size={18} />
            </Link>
          )}

          {/* Cart button with delicious craving glow */}
          <button
            onClick={() => document.dispatchEvent(new Event("open-cart"))}
            className="relative p-2.5 text-gray-800 hover:text-[#D92312] transition-colors rounded-2xl hover:bg-orange-50 border border-transparent hover:border-orange-200"
            aria-label="Open Shopping Cart"
          >
            <ShoppingCart size={22} className="stroke-[2.2]" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-xs font-black text-white bg-[#D92312] rounded-full border-2 border-white shadow-md animate-bounce">
                {itemCount}
              </span>
            )}
          </button>

          {/* Auth UI */}
          {mounted && !authLoading && (
            user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-orange-50 transition-colors group border border-orange-100"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D92312] to-[#F59E0B] flex items-center justify-center text-white text-xs font-black shadow-sm">
                    {initials}
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 bg-orange-50/40">
                      <p className="font-extrabold text-gray-900 text-sm truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link href="/profile" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-[#D92312] transition-colors font-semibold">
                      <User size={15} /> My Profile
                    </Link>
                    <Link href="/profile#orders" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-[#D92312] transition-colors font-semibold">
                      <Package size={15} /> My Orders
                    </Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold">
                        <LogOut size={15} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth"
                className="px-5 py-2 bg-gradient-to-r from-[#D92312] to-[#B8190B] hover:from-[#B8190B] hover:to-[#991409] text-white text-sm font-black rounded-xl transition-all shadow-md shadow-red-500/20 hover:scale-105 active:scale-95">
                Login
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
