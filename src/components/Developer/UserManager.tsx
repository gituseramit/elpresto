"use client";

import React, { useState } from "react";
import {
  Users,
  Shield,
  UserPlus,
  Edit2,
  CheckCircle2,
  XCircle,
  Key,
  Building,
  Check,
  Search,
  Filter,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Branch, StaffProfile, UserRole, Permission } from "@/lib/types";
import { ROLE_DEFAULT_PERMISSIONS, logAuditEvent } from "@/lib/rbac";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { hash } from "bcryptjs";

interface UserManagerProps {
  staffProfiles: StaffProfile[];
  branches: Branch[];
  onRefresh: () => void;
  developerEmail: string;
}

const ALL_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "DEVELOPER",
  "ADMIN",
  "BRANCH_MANAGER",
  "KITCHEN_MANAGER",
  "KITCHEN_STAFF",
  "COUNTER_MANAGER",
  "DELIVERY_MANAGER",
  "DELIVERY_PARTNER",
  "CUSTOMER",
];

const ALL_PERMISSIONS: Permission[] = [
  "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.assign", "orders.deliver",
  "menu.view", "menu.create", "menu.edit", "menu.delete",
  "kitchen.view", "kitchen.manage",
  "counter.view", "counter.manage",
  "delivery.view", "delivery.assign", "delivery.track",
  "users.view", "users.manage",
  "branches.view", "branches.manage",
  "promos.manage",
  "payments.view", "payments.manage",
  "reports.view", "system.manage",
];

export default function UserManager({
  staffProfiles,
  branches,
  onRefresh,
  developerEmail,
}: UserManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [modalUser, setModalUser] = useState<Partial<StaffProfile> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userPasswordInput, setUserPasswordInput] = useState("");

  const filteredUsers = staffProfiles.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "ALL" || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleOpenAdd = () => {
    setUserPasswordInput("");
    setModalUser({
      name: "",
      email: "",
      phone: "+91 ",
      role: "BRANCH_MANAGER",
      branchId: branches[0]?.id || "branch-main",
      active: true,
      customPermissions: [],
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUser?.email || !modalUser?.name || !modalUser?.role) return;
    setIsSaving(true);
    try {
      const isNew = !modalUser.id;
      const id = modalUser.id || (modalUser.staffId?.trim().toLowerCase()) || `staff-${Date.now().toString().slice(-6)}`;
      const cleanStaffId = (modalUser.staffId || modalUser.email?.split("@")[0] || id).trim().toLowerCase();

      let passwordData: any = {};
      if (userPasswordInput.trim()) {
        if (userPasswordInput.trim().length < 8) {
          alert("Password must be at least 8 characters.");
          setIsSaving(false);
          return;
        }
        const hashedPassword = await hash(userPasswordInput.trim(), 10);
        passwordData = {
          passwordHash: hashedPassword,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        };
      }

      await setDoc(
        doc(db, "staffProfiles", id),
        {
          ...modalUser,
          id,
          staffId: cleanStaffId,
          ...passwordData,
          active: modalUser.active !== false,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      await logAuditEvent({
        actorId: "dev-session",
        actorName: developerEmail || "Developer",
        actorRole: "DEVELOPER",
        branchId: modalUser.branchId,
        action: isNew ? "STAFF_CREATED" : "STAFF_ROLE_UPDATED",
        targetType: "user",
        targetId: id,
        metadata: {
          email: modalUser.email,
          role: modalUser.role,
          branchId: modalUser.branchId,
        },
      });

      setModalUser(null);
      onRefresh();
    } catch (err: any) {
      alert("Error saving staff profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCustomPermission = (perm: Permission) => {
    if (!modalUser) return;
    const current = modalUser.customPermissions || [];
    const exists = current.includes(perm);
    const updated = exists ? current.filter((p) => p !== perm) : [...current, perm];
    setModalUser({ ...modalUser, customPermissions: updated });
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-400">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Staff & RBAC Governance</h3>
            <p className="text-xs text-slate-400">Manage 10 platform roles and granular permissions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search staff by name/email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-black text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/20"
          >
            <UserPlus size={14} /> Add Staff
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-slate-950/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Staff Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Assigned Outlet</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-semibold text-slate-300">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No staff members registered. Click &quot;Add Staff&quot; above to create accounts.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const branchObj = branches.find((b) => b.id === u.branchId);
                const branchLabel = u.branchId === "ALL" ? "Global (All Outlets)" : branchObj?.name || u.branchId;

                const roleBadgeCls = {
                  DEVELOPER: "bg-red-500/15 text-red-400 border-red-500/30",
                  SUPER_ADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/30",
                  ADMIN: "bg-orange-500/15 text-orange-400 border-orange-500/30",
                  BRANCH_MANAGER: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
                  KITCHEN_MANAGER: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                  KITCHEN_STAFF: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
                  COUNTER_MANAGER: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                  COUNTER_STAFF: "bg-sky-500/15 text-sky-400 border-sky-500/30",
                  DELIVERY_MANAGER: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
                  DELIVERY_PARTNER: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                  CUSTOMER: "bg-slate-700/30 text-slate-400 border-slate-600/30",
                }[u.role] || "bg-slate-800 text-slate-300 border-white/10";

                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{u.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-mono font-bold border ${roleBadgeCls}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-300">
                      {branchLabel}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {u.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.active !== false ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {u.active !== false ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setModalUser(u); setUserPasswordInput(""); }}
                        className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10 hover:text-white"
                      >
                        <Edit2 size={12} className="inline mr-1" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Add User Modal */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-4">
              {modalUser.id ? `Edit Staff: ${modalUser.name}` : "Create Staff Profile"}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                  <input
                    type="text"
                    required
                    value={modalUser.name || ""}
                    onChange={(e) => setModalUser({ ...modalUser, name: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                  <input
                    type="email"
                    required
                    value={modalUser.email || ""}
                    onChange={(e) => setModalUser({ ...modalUser, email: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Staff ID (Username)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kitchen_amit"
                    value={modalUser.staffId || ""}
                    onChange={(e) => setModalUser({ ...modalUser, staffId: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    {modalUser.id ? "Reset Password (leave empty to keep)" : "Initial Password (min 8 chars)"}
                  </label>
                  <input
                    type="password"
                    placeholder={modalUser.id ? "New password..." : "Set password..."}
                    value={userPasswordInput}
                    onChange={(e) => setUserPasswordInput(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Role</label>
                  <select
                    value={modalUser.role || "BRANCH_MANAGER"}
                    onChange={(e) => setModalUser({ ...modalUser, role: e.target.value as UserRole })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white font-mono"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Outlet</label>
                  <select
                    value={modalUser.branchId || "ALL"}
                    onChange={(e) => setModalUser({ ...modalUser, branchId: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <option value="ALL">Global (All Outlets)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Granular Permission Overrides */}
              <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">Granular Permission Matrix</span>
                  <span className="text-[10px] text-slate-400">
                    Role defaults automatically apply unless customized
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = (modalUser.customPermissions || []).includes(perm);
                    const isDefault = (ROLE_DEFAULT_PERMISSIONS[modalUser.role as UserRole] || []).includes(perm);

                    return (
                      <label
                        key={perm}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10px] font-mono cursor-pointer transition ${
                          isChecked
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                            : isDefault
                            ? "bg-slate-900 border-white/10 text-slate-300"
                            : "bg-slate-950 border-white/5 text-slate-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCustomPermission(perm)}
                          className="h-3.5 w-3.5 rounded accent-purple-500"
                        />
                        <span className="truncate">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="u-active-cb"
                  checked={modalUser.active !== false}
                  onChange={(e) => setModalUser({ ...modalUser, active: e.target.checked })}
                  className="h-4 w-4 rounded accent-purple-500"
                />
                <label htmlFor="u-active-cb" className="text-xs font-bold text-white">
                  User Account Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setModalUser(null)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

