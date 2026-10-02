"use client";

import React, { useId, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  ShieldAlert,
  User,
} from "lucide-react";
import {
  verifyStaffLogin,
  getFriendlyError,
  StaffSession,
  changePassword,
} from "@/lib/staffAuth";
import ThemeControl from "@/components/ThemeControl";

interface StaffLoginFormProps {
  panel: string;
  panelDisplayName: string;
  panelIcon: React.ReactNode;
  onSuccess: (session: StaffSession) => void;
  isDark?: boolean;
}

export default function StaffLoginForm({
  panel,
  panelDisplayName,
  panelIcon,
  onSuccess,
}: StaffLoginFormProps) {
  const formId = useId();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingSession, setPendingSession] = useState<StaffSession | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!staffId.trim() || !password) {
      setError("Enter your staff ID and password to continue.");
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

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChangeError("");
    if (newPassword.length < 8) {
      setChangeError("Choose a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("The passwords do not match.");
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
        onSuccess({ ...pendingSession, mustChangePassword: false });
      } else {
        setChangeError(getFriendlyError(result.reason || "unknown"));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const brandPanel = (
    <aside className="staff-login-brand flex flex-col justify-between p-6 sm:p-9 lg:min-h-[660px] lg:p-11">
      <div className="flex items-center gap-3">
        <div className="staff-login-brand-mark" aria-hidden="true">EP</div>
        <div>
          <p className="staff-login-brand-name">EL PRESTO</p>
          <p className="staff-login-brand-caption">TEAM OPERATIONS</p>
        </div>
      </div>

      <div className="mt-8 lg:mt-auto lg:pb-8">
        <p className="staff-login-kicker">YOUR WORKSPACE</p>
        <h2 className="staff-login-brand-heading mt-3 max-w-md">
          Your shift starts here.
        </h2>
        <p className="staff-login-brand-copy mt-4 max-w-sm">
          Sign in to your assigned workspace to keep orders, service, and handoffs moving.
        </p>
      </div>

      <div className="staff-login-brand-foot mt-6 hidden items-center justify-between gap-4 lg:flex">
        <span>ADMIN</span><span aria-hidden="true">·</span><span>DEVELOPER</span><span aria-hidden="true">·</span><span>KITCHEN</span><span aria-hidden="true">·</span><span>DELIVERY</span><span aria-hidden="true">·</span><span>COUNTER</span><span aria-hidden="true">·</span><span>ATTENDANCE</span>
      </div>
    </aside>
  );

  return (
    <main className="staff-login-portal grid min-h-[100svh] place-items-center px-4 py-8 sm:px-6 lg:px-8">
      <ThemeControl fixed />
      <div className="staff-login-frame grid w-full max-w-6xl overflow-hidden rounded-[2rem] border lg:grid-cols-[1fr_0.92fr]">
        {brandPanel}

        <section className="staff-login-form-surface flex items-center px-6 py-8 sm:px-10 sm:py-11 lg:px-14" aria-labelledby={`${formId}-title`}>
          <div className="mx-auto w-full max-w-md">
            <div className="staff-login-role flex items-center gap-3">
              <span className="staff-login-role-icon" aria-hidden="true">{panelIcon}</span>
              <div className="min-w-0">
                <p className="staff-login-kicker">STAFF ACCESS</p>
                <p className="staff-login-role-name truncate">{panelDisplayName}</p>
              </div>
            </div>

            {showChangePassword && pendingSession ? (
              <div className="mt-8">
                <h1 id={`${formId}-title`} className="staff-login-title">Set your password</h1>
                <p className="staff-login-copy mt-2">
                  Welcome, {pendingSession.name}. Create a new password to finish setting up your account.
                </p>

                {changeError && (
                  <div id={`${formId}-error`} className="staff-login-error mt-6" role="alert" aria-live="assertive">
                    <ShieldAlert size={17} aria-hidden="true" />
                    <p>{changeError}</p>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor={`${formId}-new-password`} className="staff-login-label">New password</label>
                    <div className="staff-login-input-wrap">
                      <Key size={17} aria-hidden="true" className="staff-login-input-icon" />
                      <input
                        id={`${formId}-new-password`}
                        type={showNewPass ? "text" : "password"}
                        className="staff-login-input"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="staff-login-input-action"
                        onClick={() => setShowNewPass((visible) => !visible)}
                        aria-label={showNewPass ? "Hide new password" : "Show new password"}
                        aria-pressed={showNewPass}
                      >
                        {showNewPass ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`${formId}-confirm-password`} className="staff-login-label">Confirm password</label>
                    <div className="staff-login-input-wrap">
                      <Lock size={17} aria-hidden="true" className="staff-login-input-icon" />
                      <input
                        id={`${formId}-confirm-password`}
                        type="password"
                        className="staff-login-input"
                        placeholder="Enter it once more"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={changingPassword} className="staff-login-submit">
                    {changingPassword ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                    {changingPassword ? "Saving password…" : "Save password and continue"}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <h1 id={`${formId}-title`} className="staff-login-title">Welcome back.</h1>
                  <p className="staff-login-copy mt-2">Sign in to continue to {panelDisplayName}.</p>
                </div>

                {error && (
                  <div id={`${formId}-error`} className="staff-login-error mt-6" role="alert" aria-live="assertive">
                    <ShieldAlert size={17} aria-hidden="true" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor={`${formId}-staff-id`} className="staff-login-label">Staff ID</label>
                    <div className="staff-login-input-wrap">
                      <User size={17} aria-hidden="true" className="staff-login-input-icon" />
                      <input
                        id={`${formId}-staff-id`}
                        type="text"
                        className="staff-login-input"
                        placeholder="Enter your staff ID"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${formId}-error` : undefined}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`${formId}-password`} className="staff-login-label">Password</label>
                    <div className="staff-login-input-wrap">
                      <Lock size={17} aria-hidden="true" className="staff-login-input-icon" />
                      <input
                        id={`${formId}-password`}
                        type={showPassword ? "text" : "password"}
                        className="staff-login-input"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${formId}-error` : undefined}
                        required
                      />
                      <button
                        type="button"
                        className="staff-login-input-action"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="staff-login-submit">
                    {isSubmitting ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                    {isSubmitting ? "Checking your access…" : "Sign in"}
                  </button>
                </form>

                <div className="staff-login-note mt-7">
                  <Lock size={15} aria-hidden="true" />
                  <p>Access is limited to your assigned role. Contact your administrator if you need help signing in.</p>
                </div>
              </>
            )}

            <p className="staff-login-footer mt-8">EL PRESTO <span aria-hidden="true">·</span> STAFF PORTAL</p>
          </div>
        </section>
      </div>
    </main>
  );
}
