"use client";

import React, { useState } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Printer,
  Compass,
  DollarSign,
  ShieldCheck,
  Percent,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Branch } from "@/lib/types";
import { saveBranch, DEFAULT_MAIN_BRANCH_ID, provisionStationsForBranch } from "@/lib/branchService";
import { logAuditEvent } from "@/lib/rbac";

interface BranchManagerProps {
  branches: Branch[];
  onRefresh: () => void;
  developerEmail: string;
}

export default function BranchManager({
  branches,
  onRefresh,
  developerEmail,
}: BranchManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialForm: Partial<Branch> = {
    name: "",
    code: "",
    address: "",
    lat: 25.4358,
    lng: 81.8463,
    contactPhone: "+91 ",
    contactEmail: "",
    operatingHours: {
      openTime: "10:00",
      closeTime: "23:00",
      isOpen: true,
    },
    active: true,
    deliveryRadiusKm: 7,
    baseDeliveryFee: 30,
    freeDeliveryThreshold: 499,
    printerConfig: {
      cafeName: "EL PRESTO PIZZA",
      phone: "+91 6392512314",
      address: "Prayagraj",
      paperWidth: "58mm",
      footerText: "*** THANK YOU! VISIT AGAIN ***",
    },
    taxSettings: {
      gstNumber: "09AABCE1234F1Z5",
      vatPercent: 5,
    },
  };

  const [formData, setFormData] = useState<Partial<Branch>>(initialForm);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormData(initialForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData(branch);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      alert("Please provide both Branch Name and Code.");
      return;
    }

    setIsSaving(true);
    try {
      const isNew = !editingBranch?.id;
      const branchId = editingBranch?.id || `branch-${formData.code.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;

      await saveBranch({
        ...formData,
        id: branchId,
      });

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: branchId,
        action: isNew ? "BRANCH_CREATED" : "BRANCH_UPDATED",
        targetType: "branch",
        targetId: branchId,
        metadata: {
          name: formData.name,
          code: formData.code,
          active: formData.active,
        },
      });

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert("Error saving branch: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    const nextState = !branch.active;
    if (branch.id === DEFAULT_MAIN_BRANCH_ID && !nextState) {
      if (!confirm("Warning: Deactivating the primary default branch may affect unassigned orders. Continue?")) {
        return;
      }
    }

    try {
      await saveBranch({
        id: branch.id,
        active: nextState,
      });

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: branch.id,
        action: nextState ? "BRANCH_ACTIVATED" : "BRANCH_DEACTIVATED",
        targetType: "branch",
        targetId: branch.id,
        metadata: { name: branch.name, code: branch.code },
      });

      onRefresh();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Branch & Outlet Registry</h2>
            <p className="text-xs font-semibold text-slate-400">
              Manage multi-outlet locations, operating hours, and localized parameters
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:scale-[1.02] active:scale-95"
        >
          <Plus size={16} /> Add Outlet
        </button>
      </div>

      {/* Outlets Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => {
          const isMain = branch.id === DEFAULT_MAIN_BRANCH_ID || branch.isDefault;

          return (
            <div
              key={branch.id}
              className={`relative flex flex-col justify-between rounded-3xl border p-5 backdrop-blur-xl transition duration-300 ${
                branch.active
                  ? "border-white/10 bg-slate-900/70 hover:border-indigo-500/40 shadow-xl"
                  : "border-white/5 bg-slate-950/50 opacity-75"
              }`}
            >
              <div>
                {/* Header tags */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1 font-mono text-[10px] font-black text-indigo-400 border border-indigo-500/20">
                      {branch.code || "OUTLET"}
                    </span>
                    {isMain && (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/20">
                        Default Hub
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleActive(branch)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition ${
                      branch.active
                        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                        : "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                    }`}
                  >
                    {branch.active ? (
                      <>
                        <CheckCircle2 size={12} /> Active
                      </>
                    ) : (
                      <>
                        <XCircle size={12} /> Inactive
                      </>
                    )}
                  </button>
                </div>

                <h3 className="text-base font-black text-white">{branch.name}</h3>

                {/* Details list */}
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="shrink-0 text-slate-500 mt-0.5" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                    <Compass size={13} className="text-slate-500" />
                    <span>
                      {branch.lat?.toFixed(4)}, {branch.lng?.toFixed(4)}
                    </span>
                    <span className="text-indigo-400 ml-auto font-bold">
                      {branch.deliveryRadiusKm} km radius
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Phone size={12} /> {branch.contactPhone || "No phone"}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} /> {branch.operatingHours?.openTime} - {branch.operatingHours?.closeTime}
                    </span>
                  </div>
                </div>

                {/* Localized Delivery / Fees info */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 text-[11px] font-mono border border-white/5">
                  <span className="text-slate-400">Base Fee: ₹{branch.baseDeliveryFee}</span>
                  <span className="text-emerald-400">Free Above: ₹{branch.freeDeliveryThreshold}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-3">
                <button
                  onClick={() => handleOpenEdit(branch)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
                >
                  <Edit2 size={13} /> Edit Outlet
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await provisionStationsForBranch(branch.id, branch.name);
                    alert(`Dedicated Kitchen and Counter stations verified & active for ${branch.name}.`);
                    onRefresh();
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                  title="Auto-provision or verify dedicated Kitchen and Counter stations"
                >
                  ⚡ Stations
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-base font-black text-white">
                  {editingBranch ? `Edit Outlet: ${editingBranch.name}` : "Register New Outlet"}
                </h3>
                <p className="text-xs text-slate-400">Configure parameters for this restaurant branch</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Outlet Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. EL PRESTO - Civil Lines"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Branch Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="BR-02"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">Physical Address</label>
                <textarea
                  rows={2}
                  required
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, Landmark, City, Pincode"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-indigo-400 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lat || ""}
                    onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lng || ""}
                    onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Radius (km)</label>
                  <input
                    type="number"
                    required
                    value={formData.deliveryRadiusKm || 7}
                    onChange={(e) => setFormData({ ...formData, deliveryRadiusKm: parseFloat(e.target.value) || 7 })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Base Fee (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.baseDeliveryFee || 30}
                    onChange={(e) => setFormData({ ...formData, baseDeliveryFee: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone || ""}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail || ""}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
                <p className="text-xs font-bold text-white mb-2">Operating Hours</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-center">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Open Time</label>
                    <input
                      type="time"
                      value={formData.operatingHours?.openTime || "10:00"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          operatingHours: {
                            ...formData.operatingHours!,
                            openTime: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Close Time</label>
                    <input
                      type="time"
                      value={formData.operatingHours?.closeTime || "23:00"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          operatingHours: {
                            ...formData.operatingHours!,
                            closeTime: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="branch-active-cb"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="h-4 w-4 rounded accent-indigo-500"
                    />
                    <label htmlFor="branch-active-cb" className="text-xs font-bold text-white">
                      Outlet Active
                    </label>
                  </div>
                </div>
              </div>

              {/* Printer Details */}
              <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Printer size={14} className="text-indigo-400" />
                  <p className="text-xs font-bold text-white">Thermal Printer Header</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Receipt Store Name</label>
                    <input
                      type="text"
                      value={formData.printerConfig?.cafeName || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          printerConfig: {
                            ...formData.printerConfig!,
                            cafeName: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Paper Width</label>
                    <select
                      value={formData.printerConfig?.paperWidth || "58mm"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          printerConfig: {
                            ...formData.printerConfig!,
                            paperWidth: e.target.value as "58mm" | "80mm",
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="58mm">58mm (F2C Mobile)</option>
                      <option value="80mm">80mm (Desktop Thermal)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-5 py-2 text-xs font-black text-white shadow-lg shadow-indigo-500/25 transition active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Save Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

