"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  UserCheck,
  Building,
  KeyRound,
  ExternalLink,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { Branch, UserRole } from "@/lib/types";
import {
  getActiveDelegationSession,
  startDelegationSession,
  stopDelegationSession,
  DelegationSession,
} from "@/lib/rbac";
import { useRouter } from "next/navigation";

interface DelegationModalProps {
  branches: Branch[];
  isOpen: boolean;
  onClose: () => void;
  developerEmail: string;
}

const DELEGATABLE_ROLES: { role: UserRole; label: string; portalRoute: string; icon: string }[] = [
  { role: "ADMIN", label: "Store Operations Admin", portalRoute: "/admin", icon: "🛡️" },
  { role: "KITCHEN_MANAGER", label: "Kitchen Display & KOT Manager", portalRoute: "/kitchen", icon: "👨‍🍳" },
  { role: "COUNTER_MANAGER", label: "Counter POS & In-Store Cashier", portalRoute: "/counter", icon: "🏪" },
  { role: "DELIVERY_MANAGER", label: "Fleet & Rider Dispatch Manager", portalRoute: "/delivery", icon: "🛵" },
];

export default function DelegationModal({
  branches,
  isOpen,
  onClose,
  developerEmail,
}: DelegationModalProps) {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<DelegationSession | null>(
    getActiveDelegationSession()
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches[0]?.id || "branch-main"
  );
  const [selectedRole, setSelectedRole] = useState<UserRole>("ADMIN");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleStartDelegation = async () => {
    setIsProcessing(true);
    const targetBranch = branches.find((b) => b.id === selectedBranchId);
    const roleConfig = DELEGATABLE_ROLES.find((r) => r.role === selectedRole);

    try {
      await startDelegationSession({
        delegatedRole: selectedRole,
        targetBranchId: selectedBranchId,
        targetBranchName: targetBranch?.name || selectedBranchId,
        developerUid: "dev-root",
        developerEmail: developerEmail || "developer@elpresto.co.in",
      });

      setActiveSession(getActiveDelegationSession());
      setIsProcessing(false);

      if (roleConfig) {
        if (confirm(`Delegation session active as ${roleConfig.label} for ${targetBranch?.name}. Would you like to open the portal now?`)) {
          router.push(roleConfig.portalRoute);
          onClose();
        }
      }
    } catch (err: any) {
      alert("Delegation error: " + err.message);
      setIsProcessing(false);
    }
  };

  const handleStopDelegation = async () => {
    setIsProcessing(true);
    try {
      await stopDelegationSession();
      setActiveSession(null);
    } catch (err: any) {
      alert("Error stopping session: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Delegated Role Access</h3>
              <p className="text-xs text-slate-400">
                Securely act on behalf of branch operations with full audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Active Session Warning */}
        {activeSession ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                <ShieldAlert size={16} />
                <span>Active Delegated Session in Progress</span>
              </div>
              <p className="text-xs text-slate-300">
                You are currently acting as{" "}
                <span className="font-bold text-white uppercase">{activeSession.delegatedRole}</span> for{" "}
                <span className="font-bold text-white">{activeSession.targetBranchName}</span>.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-400">
                Started: {new Date(activeSession.startedAt).toLocaleTimeString()}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={handleStopDelegation}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-red-600/80 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-600 transition"
              >
                <LogOut size={14} /> Stop Delegated Session
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target Branch */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Target Branch / Outlet
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Role Selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Delegated Role to Assume
              </label>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DELEGATABLE_ROLES.map((item) => {
                  const isSelected = selectedRole === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setSelectedRole(item.role)}
                      className={`flex items-start gap-2.5 rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-amber-500/50 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30"
                          : "border-white/5 bg-slate-950/60 hover:border-white/10 text-slate-300"
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white">{item.label}</p>
                        <p className="text-[10px] font-mono text-slate-400">{item.portalRoute}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-slate-300">
              <AlertTriangle size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                All actions taken under delegated access will be stamped with your Developer identity and permanently recorded in the Audit Logs.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartDelegation}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-amber-500/25 transition active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                Authorize & Start Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
