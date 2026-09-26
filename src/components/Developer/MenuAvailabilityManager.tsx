"use client";

import React, { useState, useEffect } from "react";
import {
  Utensils,
  Search,
  CheckCircle2,
  XCircle,
  Building,
  DollarSign,
  Tag,
  Save,
  Loader2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Branch, MenuItem } from "@/lib/types";
import {
  getBranchMenuAvailabilityMap,
  setBranchItemAvailability,
} from "@/lib/branchService";
import { logAuditEvent } from "@/lib/rbac";
import { DUMMY_MENU } from "@/data/menu";

interface MenuAvailabilityManagerProps {
  branches: Branch[];
  developerEmail: string;
}

export default function MenuAvailabilityManager({
  branches,
  developerEmail,
}: MenuAvailabilityManagerProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches[0]?.id || "branch-main"
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { available: boolean; priceOverride?: number | null }>
  >({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // Load menu items from Firestore (with DUMMY_MENU fallback)
  useEffect(() => {
    const loadItems = async () => {
      try {
        const { collection, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const snap = await getDocs(collection(db, "menuItems"));
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as MenuItem[];
          setMenuItems(list);
        } else {
          setMenuItems(DUMMY_MENU);
        }
      } catch (err) {
        setMenuItems(DUMMY_MENU);
      }
    };
    loadItems();
  }, []);

  // Load availability map whenever selected branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    const loadAvailability = async () => {
      setLoading(true);
      const map = await getBranchMenuAvailabilityMap(selectedBranchId);
      setAvailabilityMap(map);
      setLoading(false);
    };
    loadAvailability();
  }, [selectedBranchId]);

  const categories = [
    "ALL",
    ...Array.from(new Set(menuItems.map((i) => i.category || "General"))),
  ];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleToggle = async (item: MenuItem) => {
    const current = availabilityMap[item.id];
    const currentAvail = current !== undefined ? current.available : item.available !== false;
    const nextAvail = !currentAvail;

    // Optimistic UI update
    setAvailabilityMap((prev) => ({
      ...prev,
      [item.id]: {
        available: nextAvail,
        priceOverride: prev[item.id]?.priceOverride ?? null,
      },
    }));

    setSavingItemId(item.id);
    try {
      await setBranchItemAvailability(
        selectedBranchId,
        item.id,
        nextAvail,
        current?.priceOverride ?? null
      );

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: selectedBranchId,
        action: nextAvail ? "MENU_ITEM_ENABLED_FOR_BRANCH" : "MENU_ITEM_DISABLED_FOR_BRANCH",
        targetType: "menu",
        targetId: item.id,
        metadata: {
          itemName: item.name,
          branchId: selectedBranchId,
          available: nextAvail,
        },
      });
    } catch (err: any) {
      alert("Failed to update availability: " + err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  const handlePriceOverride = async (item: MenuItem, newPriceStr: string) => {
    const newPrice = newPriceStr ? parseFloat(newPriceStr) : null;
    setSavingItemId(item.id);
    try {
      const current = availabilityMap[item.id];
      const isAvail = current !== undefined ? current.available : item.available !== false;

      await setBranchItemAvailability(selectedBranchId, item.id, isAvail, newPrice);

      setAvailabilityMap((prev) => ({
        ...prev,
        [item.id]: {
          available: isAvail,
          priceOverride: newPrice,
        },
      }));
    } catch (err: any) {
      alert("Error setting price override: " + err.message);
    } finally {
      setSavingItemId(null);
    }
  };

  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="space-y-6">
      {/* Header and Branch Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Utensils size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Centralized Menu & Branch Availability
            </h3>
            <p className="text-xs text-slate-400">
              Configure per-branch availability & local price overrides without duplicating catalog items
            </p>
          </div>
        </div>

        {/* Branch Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Active Outlet:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-xl">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                categoryFilter === cat
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-950 text-slate-400 border border-white/5 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none"
          />
        </div>
      </div>

      {/* Menu Availability Table */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-slate-950/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Item Details</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Base Price</th>
                <th className="px-4 py-3">Outlet Price Override</th>
                <th className="px-4 py-3 text-right">Outlet Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-semibold text-slate-300">
              {filteredItems.map((item) => {
                const override = availabilityMap[item.id];
                const isAvailable =
                  override !== undefined ? override.available : item.available !== false;
                const priceOverrideVal = override?.priceOverride;
                const isSavingThis = savingItemId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{item.description || "No description"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      ₹{item.price}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-mono">₹</span>
                        <input
                          type="number"
                          placeholder={item.price.toString()}
                          defaultValue={priceOverrideVal !== null && priceOverrideVal !== undefined ? priceOverrideVal : ""}
                          onBlur={(e) => handlePriceOverride(item, e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 font-mono text-xs text-emerald-400 font-bold focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={isSavingThis}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 ${
                          isAvailable
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                        }`}
                      >
                        {isSavingThis ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isAvailable ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        <span>{isAvailable ? "Available" : "Disabled"}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
