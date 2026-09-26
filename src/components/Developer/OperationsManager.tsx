"use client";

import React, { useState } from "react";
import {
  ChefHat,
  Store,
  Bike,
  ShoppingBag,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  Printer,
  Layers,
  MapPin,
  Clock,
  Search,
  Filter,
  RefreshCw,
  X,
  Loader2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Branch, Kitchen, Counter, DeliveryPartner, Order } from "@/lib/types";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { logAuditEvent } from "@/lib/rbac";

interface OperationsManagerProps {
  branches: Branch[];
  kitchens: Kitchen[];
  counters: Counter[];
  deliveryPartners: DeliveryPartner[];
  orders: Order[];
  selectedBranchId: string;
  onRefresh: () => void;
  developerEmail: string;
}

export default function OperationsManager({
  branches,
  kitchens,
  counters,
  deliveryPartners,
  orders,
  selectedBranchId,
  onRefresh,
  developerEmail,
}: OperationsManagerProps) {
  const [activeTab, setActiveTab] = useState<"kitchens" | "counters" | "delivery" | "orders">("kitchens");

  // Filtering by active branch selection
  const filteredKitchens =
    selectedBranchId === "ALL"
      ? kitchens
      : kitchens.filter((k) => k.branchId === selectedBranchId);

  const filteredCounters =
    selectedBranchId === "ALL"
      ? counters
      : counters.filter((c) => c.branchId === selectedBranchId);

  const filteredPartners =
    selectedBranchId === "ALL"
      ? deliveryPartners
      : deliveryPartners.filter((p) => p.assignedBranchId === selectedBranchId);

  const filteredOrders =
    selectedBranchId === "ALL"
      ? orders
      : orders.filter((o) => (o.branchId || "branch-main") === selectedBranchId);

  // Modals
  const [kitchenModal, setKitchenModal] = useState<Partial<Kitchen> | null>(null);
  const [counterModal, setCounterModal] = useState<Partial<Counter> | null>(null);
  const [partnerModal, setPartnerModal] = useState<Partial<DeliveryPartner> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Helper to get branch name
  const getBranchName = (bId: string) => {
    const b = branches.find((item) => item.id === bId);
    return b ? `${b.name} (${b.code})` : bId;
  };

  /* ---- Kitchen Actions ---- */
  const handleSaveKitchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitchenModal?.name || !kitchenModal?.branchId) return;
    setIsSaving(true);
    try {
      const isNew = !kitchenModal.id;
      const id = kitchenModal.id || `kitchen-${Date.now().toString().slice(-6)}`;
      await setDoc(
        doc(db, "kitchens", id),
        {
          ...kitchenModal,
          id,
          active: kitchenModal.active !== false,
          supportedCategories: kitchenModal.supportedCategories || [],
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp(), orderQueueCount: 0 } : {}),
        },
        { merge: true }
      );

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: kitchenModal.branchId,
        action: isNew ? "KITCHEN_CREATED" : "KITCHEN_UPDATED",
        targetType: "kitchen",
        targetId: id,
        metadata: { name: kitchenModal.name },
      });

      setKitchenModal(null);
      onRefresh();
    } catch (err: any) {
      alert("Error saving kitchen: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /* ---- Counter Actions ---- */
  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterModal?.name || !counterModal?.branchId) return;
    setIsSaving(true);
    try {
      const isNew = !counterModal.id;
      const id = counterModal.id || `counter-${Date.now().toString().slice(-6)}`;
      await setDoc(
        doc(db, "counters", id),
        {
          ...counterModal,
          id,
          active: counterModal.active !== false,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: counterModal.branchId,
        action: isNew ? "COUNTER_CREATED" : "COUNTER_UPDATED",
        targetType: "counter",
        targetId: id,
        metadata: { name: counterModal.name, counterNumber: counterModal.counterNumber },
      });

      setCounterModal(null);
      onRefresh();
    } catch (err: any) {
      alert("Error saving counter: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /* ---- Partner Actions ---- */
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerModal?.name || !partnerModal?.mobile || !partnerModal?.assignedBranchId) return;
    setIsSaving(true);
    try {
      const isNew = !partnerModal.id;
      const id = partnerModal.id || `partner-${Date.now().toString().slice(-6)}`;
      await setDoc(
        doc(db, "deliveryPartners", id),
        {
          ...partnerModal,
          id,
          active: partnerModal.active !== false,
          availability: partnerModal.availability || "AVAILABLE",
          completedDeliveriesCount: partnerModal.completedDeliveriesCount || 0,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: partnerModal.assignedBranchId,
        action: isNew ? "DELIVERY_PARTNER_CREATED" : "DELIVERY_PARTNER_UPDATED",
        targetType: "delivery",
        targetId: id,
        metadata: { name: partnerModal.name, mobile: partnerModal.mobile },
      });

      setPartnerModal(null);
      onRefresh();
    } catch (err: any) {
      alert("Error saving partner: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePartnerAvailabilityToggle = async (partner: DeliveryPartner) => {
    const nextAvail =
      partner.availability === "AVAILABLE"
        ? "BUSY"
        : partner.availability === "BUSY"
        ? "OFFLINE"
        : "AVAILABLE";
    try {
      await updateDoc(doc(db, "deliveryPartners", partner.id), {
        availability: nextAvail,
        updatedAt: serverTimestamp(),
      });
      onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-1.5 rounded-2xl bg-slate-950 p-1.5 border border-white/10">
          {[
            { id: "kitchens", label: "Kitchen Stations", icon: ChefHat, count: filteredKitchens.length },
            { id: "counters", label: "POS Counters", icon: Store, count: filteredCounters.length },
            { id: "delivery", label: "Delivery Fleet", icon: Bike, count: filteredPartners.length },
            { id: "orders", label: "Cross-Branch Orders", icon: ShoppingBag, count: filteredOrders.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  active
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${active ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Resource Button */}
        {activeTab === "kitchens" && (
          <button
            onClick={() =>
              setKitchenModal({
                name: "",
                branchId: selectedBranchId !== "ALL" ? selectedBranchId : branches[0]?.id || "branch-main",
                active: true,
                supportedCategories: [],
              })
            }
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-500 transition"
          >
            <Plus size={14} /> Add Kitchen
          </button>
        )}
        {activeTab === "counters" && (
          <button
            onClick={() =>
              setCounterModal({
                name: "",
                counterNumber: `C-0${filteredCounters.length + 1}`,
                branchId: selectedBranchId !== "ALL" ? selectedBranchId : branches[0]?.id || "branch-main",
                active: true,
              })
            }
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-500 transition"
          >
            <Plus size={14} /> Add Counter
          </button>
        )}
        {activeTab === "delivery" && (
          <button
            onClick={() =>
              setPartnerModal({
                name: "",
                mobile: "+91 ",
                assignedBranchId: selectedBranchId !== "ALL" ? selectedBranchId : branches[0]?.id || "branch-main",
                active: true,
                availability: "AVAILABLE",
                vehicleType: "scooter",
              })
            }
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-500 transition"
          >
            <Plus size={14} /> Add Rider
          </button>
        )}
      </div>

      {/* ---------------- 1. KITCHENS TAB ---------------- */}
      {activeTab === "kitchens" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKitchens.map((k) => (
            <div
              key={k.id}
              className="flex flex-col justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/20">
                    {k.id}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      k.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {k.active ? "Active" : "Offline"}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white">{k.name}</h4>
                <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-500" />
                  {getBranchName(k.branchId)}
                </p>

                <div className="mt-3 rounded-xl bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Routed Categories:
                  </span>
                  {k.supportedCategories && k.supportedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {k.supportedCategories.map((c) => (
                        <span key={c} className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-emerald-400 font-semibold text-[10px]">
                      ✓ Handles All Menu Categories (Main Station)
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={() => setKitchenModal(k)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  <Edit2 size={12} /> Edit Station
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- 2. COUNTERS TAB ---------------- */}
      {activeTab === "counters" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCounters.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-400 border border-blue-500/20">
                    {c.counterNumber}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      c.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {c.active ? "Active" : "Closed"}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white">{c.name}</h4>
                <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-500" />
                  {getBranchName(c.branchId)}
                </p>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 rounded-xl bg-slate-950/60 p-2.5">
                  <Printer size={13} className="text-indigo-400" />
                  <span>
                    Paper: {c.printerConfig?.paperWidth || "58mm"} (F2C Mobile)
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={() => setCounterModal(c)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                >
                  <Edit2 size={12} /> Edit Counter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- 3. DELIVERY FLEET TAB ---------------- */}
      {activeTab === "delivery" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPartners.map((p) => {
            const availCls = {
              AVAILABLE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
              BUSY: "bg-amber-500/15 text-amber-400 border-amber-500/30",
              OFFLINE: "bg-slate-700/30 text-slate-400 border-slate-600/30",
            }[p.availability || "OFFLINE"];

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">🛵</span>
                    <button
                      onClick={() => handlePartnerAvailabilityToggle(p)}
                      title="Click to toggle status"
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase border transition hover:scale-105 ${availCls}`}
                    >
                      {p.availability || "OFFLINE"}
                    </button>
                  </div>

                  <h4 className="text-sm font-black text-white">{p.name}</h4>
                  <p className="mt-0.5 text-xs text-slate-400">{p.mobile}</p>
                  <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin size={11} /> {getBranchName(p.assignedBranchId)}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <span className="text-slate-500 block">Deliveries:</span>
                      <span className="font-bold text-white text-xs">
                        {p.completedDeliveriesCount || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Order:</span>
                      <span className="font-bold text-indigo-400 text-xs">
                        {p.currentOrderId || "None"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
                  <button
                    onClick={() => setPartnerModal(p)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                  >
                    <Edit2 size={12} /> Edit Rider
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- 4. CROSS-BRANCH ORDERS TAB ---------------- */}
      {activeTab === "orders" && (
        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-slate-950/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-semibold text-slate-300">
              {filteredOrders.slice(0, 50).map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-mono font-bold text-white">
                    {o.orderNumber}
                  </td>
                  <td className="px-4 py-3 font-bold text-indigo-400">
                    {getBranchName(o.branchId || "branch-main")}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {o.type === "delivery" ? "🛵 Delivery" : "🛍️ Takeaway"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                    {o.items?.map((i) => `${i.name} (${i.quantity})`).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                    ₹{Math.round(o.total || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-orange-400">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        o.paymentStatus === "paid"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {o.paymentStatus || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase text-[10px] text-slate-500">
                    {o.orderSource || o.source || "web"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kitchen Modal */}
      {kitchenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-4">
              {kitchenModal.id ? "Edit Kitchen Station" : "Create Kitchen Station"}
            </h3>
            <form onSubmit={handleSaveKitchen} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Station Name</label>
                <input
                  type="text"
                  required
                  value={kitchenModal.name || ""}
                  onChange={(e) => setKitchenModal({ ...kitchenModal, name: e.target.value })}
                  placeholder="e.g. Pizza & Bakery KDS"
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Branch</label>
                <select
                  value={kitchenModal.branchId || ""}
                  onChange={(e) => setKitchenModal({ ...kitchenModal, branchId: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="k-active-cb"
                  checked={kitchenModal.active !== false}
                  onChange={(e) => setKitchenModal({ ...kitchenModal, active: e.target.checked })}
                  className="h-4 w-4 rounded accent-indigo-500"
                />
                <label htmlFor="k-active-cb" className="text-xs font-bold text-white">
                  Station Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setKitchenModal(null)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Save Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter Modal */}
      {counterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-4">
              {counterModal.id ? "Edit POS Counter" : "Register POS Counter"}
            </h3>
            <form onSubmit={handleSaveCounter} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Counter Label</label>
                  <input
                    type="text"
                    required
                    value={counterModal.name || ""}
                    onChange={(e) => setCounterModal({ ...counterModal, name: e.target.value })}
                    placeholder="Express POS 1"
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Counter Number</label>
                  <input
                    type="text"
                    required
                    value={counterModal.counterNumber || ""}
                    onChange={(e) => setCounterModal({ ...counterModal, counterNumber: e.target.value })}
                    placeholder="C-01"
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Branch</label>
                <select
                  value={counterModal.branchId || ""}
                  onChange={(e) => setCounterModal({ ...counterModal, branchId: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="c-active-cb"
                  checked={counterModal.active !== false}
                  onChange={(e) => setCounterModal({ ...counterModal, active: e.target.checked })}
                  className="h-4 w-4 rounded accent-indigo-500"
                />
                <label htmlFor="c-active-cb" className="text-xs font-bold text-white">
                  Counter Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setCounterModal(null)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Save Counter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Partner Modal */}
      {partnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-4">
              {partnerModal.id ? "Edit Delivery Rider" : "Register Delivery Rider"}
            </h3>
            <form onSubmit={handleSavePartner} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Rider Full Name</label>
                <input
                  type="text"
                  required
                  value={partnerModal.name || ""}
                  onChange={(e) => setPartnerModal({ ...partnerModal, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={partnerModal.mobile || ""}
                    onChange={(e) => setPartnerModal({ ...partnerModal, mobile: e.target.value })}
                    placeholder="+91 9876543210"
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</label>
                  <select
                    value={partnerModal.vehicleType || "scooter"}
                    onChange={(e) => setPartnerModal({ ...partnerModal, vehicleType: e.target.value as any })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <option value="scooter">🛵 Scooter</option>
                    <option value="bike">🏍️ Motorcycle</option>
                    <option value="bicycle">🚲 Bicycle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Hub / Branch</label>
                <select
                  value={partnerModal.assignedBranchId || ""}
                  onChange={(e) => setPartnerModal({ ...partnerModal, assignedBranchId: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Availability</label>
                <select
                  value={partnerModal.availability || "AVAILABLE"}
                  onChange={(e) => setPartnerModal({ ...partnerModal, availability: e.target.value as any })}
                  className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="AVAILABLE">AVAILABLE (Eligible for orders)</option>
                  <option value="BUSY">BUSY (On active delivery)</option>
                  <option value="OFFLINE">OFFLINE (Shift ended)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setPartnerModal(null)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Save Rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
