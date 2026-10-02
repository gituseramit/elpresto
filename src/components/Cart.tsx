"use client";

import { useEffect, useState } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getPackingCharge } from "@/lib/commerce";

export default function Cart() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();
  const [packingEnabled, setPackingEnabled] = useState(false);
  const [packingRates, setPackingRates] = useState<Record<string, number>>({});
  const packing = getPackingCharge(items, packingEnabled, packingRates);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    document.addEventListener("open-cart", handleOpen);
    return () => document.removeEventListener("open-cart", handleOpen);
  }, []);

  useEffect(() => onSnapshot(doc(db, "settings", "general"), (snapshot) => {
    const data = snapshot.data();
    setPackingEnabled(data?.packingChargesEnabled === true);
    setPackingRates(data?.packingChargeByCategory || {});
  }), []);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[400px] bg-[var(--surface)] shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Your Cart</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-5 text-center text-gray-500 space-y-4">
              <div className="grid h-24 w-24 place-items-center rounded-full border border-orange-100 bg-orange-50 text-[#D92312]">
                <ShoppingBag size={40} strokeWidth={1.7} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900">Your cart is waiting</p>
                <p className="mt-1 max-w-xs text-sm leading-relaxed text-gray-500">Add something freshly baked and we’ll keep your order together here.</p>
              </div>
              <Link
                href="/menu"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D92312] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#B8190B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                Browse the menu <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Img</div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm line-clamp-1">{item.name}</h3>
                    <p className="text-[var(--primary)] font-bold">₹{(item.price || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-full px-2 py-1">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm hover:text-[var(--primary)]"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm hover:bg-[var(--primary-hover)]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-orange-100 bg-gradient-to-b from-orange-50/40 to-white shadow-inner">
            <div className="space-y-1.5 mb-4 text-xs">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Subtotal</span>
                <span>₹{(getTotal() || 0).toFixed(2)}</span>
              </div>
              {packing.total > 0 && <div className="flex justify-between text-gray-600 font-medium"><span>Packing charge</span><span>₹{packing.total.toFixed(2)}</span></div>}
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Doorstep Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-orange-100 text-lg">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-2xl text-[#D92312]">₹{((getTotal() || 0) + packing.total).toFixed(2)}</span>
              </div>
            </div>

            <a 
              href="/checkout" 
              onClick={() => setIsOpen(false)}
              className="w-full py-4 bg-gradient-to-r from-[#D92312] via-[#E11D48] to-[#F59E0B] hover:from-[#B8190B] hover:to-[#D97706] text-white text-base font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-500/25 active:scale-95 uppercase tracking-wider"
            >
              <span>Place Order Now</span>
              <span className="text-xl">→</span>
            </a>

            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-bold text-gray-500">
              <span className="flex items-center gap-1">🔒 100% Safe Payment</span>
              <span className="flex items-center gap-1">⚡ 15 Mins Kitchen Prep</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
