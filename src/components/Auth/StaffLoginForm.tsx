"use client";

import React, { useState, useEffect } from "react";
import { Lock, User, Eye, EyeOff, Loader2, ShieldAlert, Key, AlertCircle } from "lucide-react";
import {
  verifyStaffLogin,
  getFriendlyError,
  StaffSession,
  changePassword,
} from "@/lib/staffAuth";

interface StaffLoginFormProps {
  panel: string;
  panelDisplayName: string;
  panelIcon: React.ReactNode;
  onSuccess: (session: StaffSession) => void;
  isDark?: boolean; // true for dark panels (kitchen/delivery), false for light
}

export default function StaffLoginForm({
  panel,
  panelDisplayName,
  panelIcon,
  onSuccess,
  isDark = true,
}: StaffLoginFormProps) {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Password change flow (for mustChangePassword accounts)
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingSession, setPendingSession] = useState<StaffSession | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState("");

  const inputBase = isDark
    ? "w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
    : "w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 placeholder-gray-400 transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20";

  const labelBase = isDark
    ? "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400"
    : "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !password) {
      setError("Please enter your staff ID and password.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      const result = await verifyStaffLogin(staffId.trim(), password, panel);
      if (result.success && result.session) {
        if (result.session.mustChangePassword) {
          setPendingSession(result.session);
          setShowChangePassword(true);
        } else {
          onSuccess(result.session);
        }
      } else {
        setError(getFriendlyError(result.reason || "unknown", result.minutesLeft));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError("");
    if (newPassword.length < 8) {
      setChangeError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("Passwords do not match.");
      return;
    }
    if (!pendingSession) return;

    setChangingPassword(true);
    try {
      const result = await changePassword(
        pendingSession.token,
        pendingSession.staffId,
        undefined,
        newPassword
      );
      if (result.success) {
        // Update session and proceed
        onSuccess({ ...pendingSession, mustChangePassword: false });
      } else {
        setChangeError(getFriendlyError(result.reason || "unknown"));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (showChangePassword && pendingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="w-full max-w-sm">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <Key size={24} className="text-white" />
              </div>
              <h2 className="text-lg font-black text-white">Set Your Password</h2>
              <p className="mt-1 text-sm text-orange-100">
                Welcome, {pendingSession.name}! Please create a new secure password.
              </p>
            </div>
            <div className="p-6">
              {changeError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {changeError}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className={labelBase}>New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      className={inputBase}
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((v) => !v)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-200"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>Confirm Password</label>
                  <input
                    type="password"
                    className={inputBase}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {changingPassword && <Loader2 size={16} className="animate-spin" />}
                  Set Password & Continue
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      {/* Ambient glow */}
      <span className="pointer-events-none fixed left-1/4 top-1/4 h-80 w-80 rounded-full bg-orange-500/5 blur-3xl" />
      <span className="pointer-events-none fixed bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 to-amber-500 p-8 text-center">
            <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg ring-1 ring-white/30">
                {panelIcon}
              </div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-orange-100">
                EL PRESTO PIZZA
              </div>
              <h1 className="text-xl font-black text-white">{panelDisplayName}</h1>
              <p className="mt-1 text-xs text-orange-100">Sign in with your staff credentials</p>
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-xs font-semibold text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelBase}>Staff ID</label>
                <div className="relative">
                  <User
                    size={14}
                    className="absolute left-3.5 top-3.5 text-slate-400"
                  />
                  <input
                    type="text"
                    className={`${inputBase} pl-10`}
                    placeholder="e.g. kitchen_amit"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div>
                <label className={labelBase}>Password</label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3.5 top-3.5 text-slate-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputBase} pl-10 pr-10`}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3.5 text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.01] hover:opacity-95 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  "Sign In to Panel"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-[10px] font-semibold text-slate-600">
              Contact your administrator if you cannot access your account.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-600">
          <Lock size={10} />
          Secured · EL PRESTO Staff Portal
        </div>
      </div>
    </div>
  );
}
