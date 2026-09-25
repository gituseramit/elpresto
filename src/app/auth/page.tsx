"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye, EyeOff, Mail, Lock, User, Phone,
  ArrowLeft, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import Link from "next/link";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";

  const { user, loading: authLoading, loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword } = useAuth();

  const [tab, setTab] = useState<"login" | "signup">(defaultTab as "login" | "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", phone: "", email: "", password: "", confirmPassword: "" });

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirect);
    }
  }, [user, authLoading, redirect, router]);

  const getErrorMessage = (code: string) => {
    const msgs: Record<string, string> = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many failed attempts. Please try again later.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/popup-blocked": "Popup was blocked. Please allow popups and try again.",
      "auth/network-request-failed": "Network error. Please check your connection.",
    };
    return msgs[code] || "Something went wrong. Please try again.";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginForm.email || !loginForm.password) { setError("Please fill in all fields."); return; }
    setIsSubmitting(true);
    try {
      await loginWithEmail(loginForm.email, loginForm.password);
      router.replace(redirect);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally { setIsSubmitting(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { name, phone, email, password, confirmPassword } = signupForm;
    if (!name.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields."); return;
    }
    if (!/^\d{10}$/.test(phone.replace(/[\s-]/g, ""))) {
      setError("Please enter a valid 10-digit mobile number."); return;
    }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setIsSubmitting(true);
    try {
      await signupWithEmail(name.trim(), phone.trim(), email.trim(), password);
      router.replace(redirect);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally { setIsSubmitting(false); }
  };

  const handleGoogle = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      router.replace(redirect);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally { setIsSubmitting(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!forgotEmail.trim()) { setError("Please enter your email address."); return; }
    setIsSubmitting(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally { setIsSubmitting(false); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 to-orange-50/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/70 text-sm placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 to-orange-50/40 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-orange-600 transition-colors text-sm font-medium">
            <ArrowLeft size={15} /> Back to Home
          </Link>
          <div className="text-right">
            <div className="font-black text-lg text-gray-900 leading-none">EL PRESTO <span className="text-orange-600">PIZZA</span></div>
            <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">100% Whole Wheat</div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          {/* Orange header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-8 pt-8 pb-6 text-white text-center">
            <div className="text-4xl mb-2">🍕</div>
            <h1 className="text-2xl font-black">
              {showForgot ? "Reset Password" : tab === "login" ? "Welcome Back!" : "Create Account"}
            </h1>
            <p className="text-orange-100 text-sm mt-1">
              {showForgot
                ? "Enter your email to receive a reset link"
                : tab === "login"
                ? "Sign in to continue ordering"
                : "Join us for a delicious experience"}
            </p>
          </div>

          <div className="px-8 py-7">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-red-700 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Forgot Password flow */}
            {showForgot ? (
              forgotSent ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={52} className="text-green-500 mx-auto mb-3" />
                  <h2 className="font-bold text-gray-800 text-lg mb-1">Email Sent!</h2>
                  <p className="text-sm text-gray-500 mb-6">Check your inbox for the password reset link.</p>
                  <button
                    onClick={() => { setShowForgot(false); setForgotSent(false); setError(""); }}
                    className="text-orange-600 font-semibold text-sm hover:underline"
                  > Back to Login</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input type="email" placeholder="Your email address" value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)} className={inputCls} autoComplete="email" />
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                    {isSubmitting && <Loader2 size={17} className="animate-spin" />}
                    Send Reset Link
                  </button>
                  <button type="button" onClick={() => { setShowForgot(false); setError(""); }}
                    className="w-full text-sm text-gray-500 hover:text-orange-600 font-medium transition-colors text-center">
                     Back to Login
                  </button>
                </form>
              )
            ) : (
              <>
                {/* Tab toggle */}
                <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-6">
                  {(["login", "signup"] as const).map(t => (
                    <button key={t} onClick={() => { setTab(t); setError(""); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      {t === "login" ? "Login" : "Sign Up"}
                    </button>
                  ))}
                </div>

                {/* Google button */}
                <button onClick={handleGoogle} disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/50 transition-all text-sm font-semibold text-gray-700 bg-white/70 mb-5 disabled:opacity-60">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative flex items-center mb-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="px-3 text-xs text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Login form */}
                {tab === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type="email" placeholder="Email address" value={loginForm.email}
                        onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                        className={inputCls} autoComplete="email" />
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type={showPassword ? "text" : "password"} placeholder="Password"
                        value={loginForm.password}
                        onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/70 text-sm placeholder-gray-400"
                        autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="text-right -mt-1">
                      <button type="button" onClick={() => { setShowForgot(true); setError(""); setForgotEmail(loginForm.email); }}
                        className="text-xs text-orange-600 hover:underline font-medium">
                        Forgot Password?
                      </button>
                    </div>
                    <button type="submit" disabled={isSubmitting}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                      {isSubmitting && <Loader2 size={17} className="animate-spin" />}
                      Login to Account
                    </button>
                    <p className="text-center text-sm text-gray-500">
                      Don&apos;t have an account?{" "}
                      <button type="button" onClick={() => { setTab("signup"); setError(""); }} className="text-orange-600 font-bold hover:underline">Sign up free</button>
                    </p>
                  </form>
                )}

                {/* Signup form */}
                {tab === "signup" && (
                  <form onSubmit={handleSignup} className="space-y-3.5">
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type="text" placeholder="Full Name" value={signupForm.name}
                        onChange={e => setSignupForm(p => ({ ...p, name: e.target.value }))}
                        className={inputCls} autoComplete="name" />
                    </div>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type="tel" placeholder="Mobile Number (10 digits)" value={signupForm.phone}
                        onChange={e => setSignupForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        className={inputCls} autoComplete="tel" maxLength={10} />
                    </div>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type="email" placeholder="Email address" value={signupForm.email}
                        onChange={e => setSignupForm(p => ({ ...p, email: e.target.value }))}
                        className={inputCls} autoComplete="email" />
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type={showPassword ? "text" : "password"} placeholder="Password (min. 8 characters)"
                        value={signupForm.password}
                        onChange={e => setSignupForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/70 text-sm placeholder-gray-400"
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password"
                        value={signupForm.confirmPassword}
                        onChange={e => setSignupForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/70 text-sm placeholder-gray-400"
                        autoComplete="new-password" />
                      <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="submit" disabled={isSubmitting}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-1">
                      {isSubmitting && <Loader2 size={17} className="animate-spin" />}
                      Create My Account
                    </button>
                    <p className="text-[11px] text-gray-400 text-center">By signing up, you agree to our Terms &amp; Privacy Policy.</p>
                    <p className="text-center text-sm text-gray-500">
                      Already have an account?{" "}
                      <button type="button" onClick={() => { setTab("login"); setError(""); }} className="text-orange-600 font-bold hover:underline">Login</button>
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 to-orange-50/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
