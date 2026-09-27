"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

type AuthTab = "login" | "signup";

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

/* ============================================================= */
/* Helpers                                                       */
/* ============================================================= */

/**
 * Sanitise a redirect target. Only allow same-origin paths.
 * Rejects: absolute URLs, protocol-relative URLs (//evil.com),
 * javascript:, data:, backslash tricks.
 */
function sanitiseRedirect(raw: string | null): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  if (!trimmed.startsWith("/")) return "/";
  if (trimmed.startsWith("//")) return "/";
  if (trimmed.startsWith("/\\")) return "/";
  if (trimmed.includes("://")) return "/";
  // Disallow CR/LF injection
  if (/[\r\n]/.test(trimmed)) return "/";
  return trimmed;
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Pragmatic email check — Firebase is the source of truth.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorCode(err: unknown): string {
  if (!err) return "";
  const e = err as FirebaseLikeError;
  if (typeof e.code === "string" && e.code) return e.code;
  return "";
}

function getErrorMessage(err: unknown): string {
  const code = getErrorCode(err);
  const msgs: Record<string, string> = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-login-credentials": "Invalid email or password.",
    "auth/email-already-in-use":
      "An account with this email already exists. Try logging in.",
    "auth/weak-password": "Please choose a stronger password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests":
      "Too many failed attempts. Please wait a minute and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/popup-blocked":
      "Popup was blocked. Please allow popups for this site and try again.",
    "auth/network-request-failed":
      "Network error. Please check your connection and try again.",
    "auth/account-exists-with-different-credential":
      "This email is already linked to a different sign-in method. Please use that method.",
    "auth/credential-already-in-use":
      "This credential is already linked to another account.",
    "auth/operation-not-allowed":
      "This sign-in method is not enabled. Please contact support.",
    "auth/user-disabled":
      "This account has been disabled. Please contact support.",
    "auth/requires-recent-login":
      "Please log in again to continue this action.",
    "auth/internal-error":
      "Something went wrong on our end. Please try again.",
  };
  return msgs[code] || "Something went wrong. Please try again.";
}

/* ============================================================= */
/* Field primitives                                              */
/* ============================================================= */

const baseInputCls =
  "w-full rounded-xl border border-gray-200 bg-white/70 py-3 pl-10 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60";

const basePasswordInputCls = baseInputCls + " pr-11";

function FieldLabel({
  htmlFor,
  children,
  className = "sr-only",
}: {
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Lock
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={basePasswordInputCls}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        {visible ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/* ============================================================= */
/* Auth Form                                                     */
/* ============================================================= */

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = {
    loginEmail: useId(),
    loginPassword: useId(),
    signupName: useId(),
    signupPhone: useId(),
    signupEmail: useId(),
    signupPassword: useId(),
    signupConfirm: useId(),
    forgotEmail: useId(),
    errorBanner: useId(),
  };

  const redirect = useMemo(
    () => sanitiseRedirect(searchParams.get("redirect")),
    [searchParams]
  );
  const initialTab: AuthTab =
    searchParams.get("tab") === "signup" ? "signup" : "login";

  const {
    user,
    loading: authLoading,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    resetPassword,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  /* Redirect when already logged in */
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirect);
    }
  }, [user, authLoading, redirect, router]);

  /* Autofocus the first field of the current view */
  useEffect(() => {
    if (authLoading) return;
    const t = window.setTimeout(() => {
      if (showForgot) {
        emailInputRef.current?.focus();
      } else {
        firstFieldRef.current?.focus();
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [authLoading, showForgot, tab]);

  /* Reset-password cooldown countdown */
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResetCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resetCooldown]);

  const clearMessages = useCallback(() => {
    setError("");
    setInfo("");
  }, []);

  const switchTab = useCallback(
    (next: AuthTab) => {
      setTab(next);
      setShowPassword(false);
      setShowConfirmPassword(false);
      clearMessages();
    },
    [clearMessages]
  );

  const openForgot = useCallback(() => {
    setShowForgot(true);
    setForgotSent(false);
    setForgotEmail(loginForm.email);
    clearMessages();
  }, [loginForm.email, clearMessages]);

  const closeForgot = useCallback(() => {
    setShowForgot(false);
    setForgotSent(false);
    clearMessages();
  }, [clearMessages]);

  /* ---------------- Handlers ---------------- */

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();
    const email = normaliseEmail(loginForm.email);
    const password = loginForm.password;
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
      router.replace(redirect);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();
    const name = signupForm.name.trim();
    const phone = normalisePhone(signupForm.phone);
    const email = normaliseEmail(signupForm.email);
    const password = signupForm.password;
    const confirmPassword = signupForm.confirmPassword;

    if (!name || !phone || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await signupWithEmail(name, phone, email, password);
      router.replace(redirect);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      router.replace(redirect);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();
    const email = normaliseEmail(forgotEmail);
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (resetCooldown > 0) return;
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setForgotSent(true);
      setResetCooldown(60);
    } catch (err) {
      // Firebase intentionally does not reveal whether the email exists.
      // Show a generic success-style message unless it's a rate-limit
      // or network error.
      const code = getErrorCode(err);
      if (
        code === "auth/too-many-requests" ||
        code === "auth/network-request-failed"
      ) {
        setError(getErrorMessage(err));
      } else {
        setForgotSent(true);
        setResetCooldown(60);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendReset = async () => {
    if (resetCooldown > 0) return;
    const email = normaliseEmail(forgotEmail);
    if (!email || !isValidEmail(email)) return;
    setIsSubmitting(true);
    clearMessages();
    try {
      await resetPassword(email);
      setInfo("Reset link sent again. Check your inbox.");
      setResetCooldown(60);
    } catch (err) {
      const code = getErrorCode(err);
      if (
        code === "auth/too-many-requests" ||
        code === "auth/network-request-failed"
      ) {
        setError(getErrorMessage(err));
      } else {
        setInfo("Reset link sent again. Check your inbox.");
        setResetCooldown(60);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- Loading gate ---------------- */

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3"
        >
          <Loader2
            size={32}
            className="animate-spin text-orange-500"
            aria-hidden="true"
          />
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  const headerTitle = showForgot
    ? "Reset Password"
    : tab === "login"
    ? "Welcome Back!"
    : "Create Account";
  const headerSubtitle = showForgot
    ? "Enter your email to receive a reset link"
    : tab === "login"
    ? "Sign in to continue ordering"
    : "Join us for a delicious experience";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40 px-4 py-10 sm:py-12">
      <div className="w-full max-w-md">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to Home
          </Link>
          <div className="text-right">
            <div className="text-lg font-black leading-none text-gray-900">
              EL PRESTO <span className="text-orange-600">PIZZA</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              100% Whole Wheat
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-6 pb-6 pt-8 text-center text-white sm:px-8">
            <div aria-hidden="true" className="mb-2 text-4xl">
              🍕
            </div>
            <h1 className="text-2xl font-black">{headerTitle}</h1>
            <p className="mt-1 text-sm text-orange-100">{headerSubtitle}</p>
          </div>

          <div className="px-6 py-7 sm:px-8">
            {/* Error banner */}
            {error && (
              <div
                id={ids.errorBanner}
                role="alert"
                aria-live="assertive"
                className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            {/* Info banner */}
            {info && !error && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{info}</span>
              </div>
            )}

            {/* ---------------- Forgot Password flow ---------------- */}
            {showForgot ? (
              forgotSent ? (
                <div className="py-4 text-center">
                  <CheckCircle2
                    size={52}
                    className="mx-auto mb-3 text-green-500"
                    aria-hidden="true"
                  />
                  <h2 className="mb-1 text-lg font-bold text-gray-800">
                    Email Sent!
                  </h2>
                  <p className="mb-4 text-sm text-gray-500">
                    If an account exists for{" "}
                    <span className="font-semibold">{forgotEmail}</span>,
                    you&apos;ll receive a password reset link shortly.
                  </p>
                  <div className="mb-6 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={resendReset}
                      disabled={isSubmitting || resetCooldown > 0}
                      className="flex items-center gap-2 text-sm font-semibold text-orange-600 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                    >
                      {isSubmitting ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                      {resetCooldown > 0
                        ? `Resend in ${resetCooldown}s`
                        : "Resend reset link"}
                    </button>
                    <button
                      type="button"
                      onClick={closeForgot}
                      className="text-sm font-semibold text-gray-500 transition hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="relative">
                    <FieldLabel htmlFor={ids.forgotEmail}>
                      Email address
                    </FieldLabel>
                    <Mail
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      id={ids.forgotEmail}
                      ref={emailInputRef}
                      type="email"
                      placeholder="Your email address"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={baseInputCls}
                      autoComplete="email"
                      disabled={isSubmitting}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                  >
                    {isSubmitting && (
                      <Loader2
                        size={17}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {isSubmitting ? "Sending…" : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForgot}
                    className="w-full text-center text-sm font-medium text-gray-500 transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  >
                    Back to Login
                  </button>
                </form>
              )
            ) : (
              <>
                {/* Tab toggle */}
                <div
                  role="tablist"
                  aria-label="Sign in or create account"
                  className="mb-6 flex rounded-2xl bg-gray-100/80 p-1"
                >
                  {(["login", "signup"] as const).map((t) => {
                    const active = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => switchTab(t)}
                        className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                          active
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {t === "login" ? "Login" : "Sign Up"}
                      </button>
                    );
                  })}
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-200 bg-white/70 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-orange-300 hover:bg-orange-50/50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative mb-5 flex items-center">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="px-3 text-xs font-medium text-gray-400">
                    or
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Login form */}
                {tab === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                      <FieldLabel htmlFor={ids.loginEmail}>
                        Email address
                      </FieldLabel>
                      <Mail
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id={ids.loginEmail}
                        ref={firstFieldRef}
                        type="email"
                        placeholder="Email address"
                        value={loginForm.email}
                        onChange={(e) =>
                          setLoginForm((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        className={baseInputCls}
                        autoComplete="email"
                        disabled={isSubmitting}
                      />
                    </div>

                    <PasswordField
                      id={ids.loginPassword}
                      label="Password"
                      value={loginForm.password}
                      onChange={(v) =>
                        setLoginForm((p) => ({ ...p, password: v }))
                      }
                      visible={showPassword}
                      onToggleVisible={() => setShowPassword((v) => !v)}
                      placeholder="Password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                    />

                    <div className="-mt-1 text-right">
                      <button
                        type="button"
                        onClick={openForgot}
                        className="text-xs font-medium text-orange-600 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                    >
                      {isSubmitting && (
                        <Loader2
                          size={17}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {isSubmitting ? "Signing in…" : "Login to Account"}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("signup")}
                        className="font-bold text-orange-600 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      >
                        Sign up free
                      </button>
                    </p>
                  </form>
                )}

                {/* Signup form */}
                {tab === "signup" && (
                  <form onSubmit={handleSignup} className="space-y-3.5">
                    <div className="relative">
                      <FieldLabel htmlFor={ids.signupName}>
                        Full Name
                      </FieldLabel>
                      <User
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id={ids.signupName}
                        ref={firstFieldRef}
                        type="text"
                        placeholder="Full Name"
                        value={signupForm.name}
                        onChange={(e) =>
                          setSignupForm((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        className={baseInputCls}
                        autoComplete="name"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FieldLabel htmlFor={ids.signupPhone}>
                        Mobile Number
                      </FieldLabel>
                      <Phone
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id={ids.signupPhone}
                        type="tel"
                        inputMode="numeric"
                        placeholder="Mobile Number (10 digits)"
                        value={signupForm.phone}
                        onChange={(e) =>
                          setSignupForm((p) => ({
                            ...p,
                            phone: normalisePhone(e.target.value),
                          }))
                        }
                        className={baseInputCls}
                        autoComplete="tel"
                        maxLength={10}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="relative">
                      <FieldLabel htmlFor={ids.signupEmail}>
                        Email address
                      </FieldLabel>
                      <Mail
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id={ids.signupEmail}
                        type="email"
                        placeholder="Email address"
                        value={signupForm.email}
                        onChange={(e) =>
                          setSignupForm((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        className={baseInputCls}
                        autoComplete="email"
                        disabled={isSubmitting}
                      />
                    </div>

                    <PasswordField
                      id={ids.signupPassword}
                      label="Password"
                      value={signupForm.password}
                      onChange={(v) =>
                        setSignupForm((p) => ({ ...p, password: v }))
                      }
                      visible={showPassword}
                      onToggleVisible={() => setShowPassword((v) => !v)}
                      placeholder="Password (min. 8 characters)"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />

                    <PasswordField
                      id={ids.signupConfirm}
                      label="Confirm Password"
                      value={signupForm.confirmPassword}
                      onChange={(v) =>
                        setSignupForm((p) => ({ ...p, confirmPassword: v }))
                      }
                      visible={showConfirmPassword}
                      onToggleVisible={() =>
                        setShowConfirmPassword((v) => !v)
                      }
                      placeholder="Confirm Password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                    >
                      {isSubmitting && (
                        <Loader2
                          size={17}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {isSubmitting
                        ? "Creating account…"
                        : "Create My Account"}
                    </button>

                    <p className="text-center text-[11px] text-gray-400">
                      By signing up, you agree to our{" "}
                      <Link
                        href="/terms"
                        className="underline transition hover:text-orange-600"
                      >
                        Terms
                      </Link>{" "}
                      &amp;{" "}
                      <Link
                        href="/privacy"
                        className="underline transition hover:text-orange-600"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>

                    <p className="text-center text-sm text-gray-500">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchTab("login")}
                        className="font-bold text-orange-600 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      >
                        Login
                      </button>
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Having trouble? Contact{" "}
          <a
            href="mailto:support@elpresto.co.in"
            className="underline transition hover:text-orange-600"
          >
            support@elpresto.co.in
          </a>
        </p>
      </div>
    </main>
  );
}

/* ============================================================= */
/* Page                                                          */
/* ============================================================= */

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
          <Loader2
            size={32}
            className="animate-spin text-orange-500"
            aria-label="Loading"
          />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}