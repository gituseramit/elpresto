"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { SavedAddress } from "@/lib/types";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  LogOut,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Home,
  AlertCircle,
  Star,
  Briefcase,
  Heart,
  Shield,
  Sparkles,
  TrendingUp,
  Clock,
  KeyRound,
  Receipt,
  Crown,
  Zap,
  Building2,
  Truck,
  BadgeCheck,
} from "lucide-react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RatingModal from "@/components/RatingModal";

type ProfileTab = "profile" | "addresses" | "orders";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  preparing: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  ready: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  assigned: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  out_for_delivery: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 ring-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  preparing: "Preparing",
  ready: "Food Ready",
  assigned: "Driver Assigned",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  preparing: Sparkles,
  ready: CheckCircle2,
  assigned: Truck,
  out_for_delivery: Truck,
  completed: BadgeCheck,
  delivered: BadgeCheck,
  cancelled: X,
};

const inputCls =
  "w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/15";

export default function ProfilePage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, updateUserProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "",
    houseFlat: "",
    streetArea: "",
    landmark: "",
    city: "Prayagraj",
    pincode: "211010",
  });
  const [addressError, setAddressError] = useState("");

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ratingModalOrder, setRatingModalOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth?redirect=/profile");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (userProfile) {
      setProfileForm({ name: userProfile.name || "", phone: userProfile.phone || "" });
    }
  }, [userProfile]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#orders") {
      setActiveTab("orders");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "orders" && user) fetchOrders();
  }, [activeTab, user]);

  const fetchOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const qById = query(collection(db, "orders"), where("customerId", "==", user.uid));
      const snapshotById = await getDocs(qById);
      const docsById = snapshotById.docs.map((d) => ({ id: d.id, ...d.data() } as any));

      let docsByEmail: any[] = [];
      if (user.email) {
        const qByEmail = query(collection(db, "orders"), where("customerEmail", "==", user.email));
        const snapshotByEmail = await getDocs(qByEmail);
        docsByEmail = snapshotByEmail.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      }

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const doc of [...docsById, ...docsByEmail]) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          merged.push(doc);
        }
      }
      merged.sort((a, b) => {
        const ta = a.createdAt ?? "";
        const tb = b.createdAt ?? "";
        return tb > ta ? 1 : tb < ta ? -1 : 0;
      });
      setOrders(merged);
    } catch (err: any) {
      console.error("Failed to load orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaveError("");
    if (!profileForm.name.trim()) {
      setSaveError("Name cannot be empty.");
      return;
    }
    if (profileForm.phone && !/^\d{10}$/.test(profileForm.phone.replace(/[\s-]/g, ""))) {
      setSaveError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    setAddressError("");
    if (!newAddress.label.trim() || !newAddress.houseFlat.trim() || !newAddress.streetArea.trim()) {
      setAddressError("Please fill in Label, House/Flat, and Street/Area fields.");
      return;
    }
    const addr: SavedAddress = {
      id: Date.now().toString(),
      label: newAddress.label.trim(),
      houseFlat: newAddress.houseFlat.trim(),
      streetArea: newAddress.streetArea.trim(),
      ...(newAddress.landmark ? { landmark: newAddress.landmark.trim() } : {}),
      city: newAddress.city.trim() || "Prayagraj",
      pincode: newAddress.pincode.trim() || "211010",
      fullAddress: `${newAddress.houseFlat}, ${newAddress.streetArea}, ${newAddress.city} - ${newAddress.pincode}`,
    };
    try {
      const existing = userProfile?.savedAddresses || [];
      await updateUserProfile({ savedAddresses: [...existing, addr] });
      setShowAddAddress(false);
      setNewAddress({ label: "", houseFlat: "", streetArea: "", landmark: "", city: "Prayagraj", pincode: "211010" });
    } catch {
      setAddressError("Failed to save address.");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const updated = (userProfile?.savedAddresses || []).filter((a) => a.id !== id);
    await updateUserProfile({ savedAddresses: updated });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  /* ---------- Loading ---------- */
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-b-orange-500" />
          <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  const displayName =
    userProfile?.name || user.displayName || user.email?.split("@")[0] || "Customer";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const addresses = userProfile?.savedAddresses || [];
  const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");

  const completedOrdersCount = orders.filter(
    (o) => o.status === "completed" || o.deliveryStatus === "delivered"
  ).length;
  const totalSpent = orders
    .filter((o) => o.status === "completed" || o.deliveryStatus === "delivered")
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          href="/menu"
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm font-bold text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-orange-600"
        >
          <ArrowLeft size={15} /> Back to Menu
        </Link>

        {/* ============================================================= */}
        {/* PROFILE HERO CARD                                              */}
        {/* ============================================================= */}
        <div className="relative mb-5 overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.2)] backdrop-blur-2xl sm:p-7">
          <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="relative shrink-0 self-center sm:self-auto">
              <span className="absolute inset-0 animate-ping rounded-3xl bg-orange-400/30" />
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 text-2xl font-black text-white shadow-xl shadow-orange-500/30 ring-4 ring-white">
                {initials}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="truncate text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                  <Crown size={10} /> Member
                </span>
              </div>
              <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-sm font-semibold text-gray-500 sm:justify-start">
                <Mail size={13} /> {user.email}
              </p>
              {isGoogleUser && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 shadow-sm">
                  <svg className="h-3 w-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google Account
                </span>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-red-500 shadow-sm transition hover:bg-red-100 active:scale-95"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>

          {/* Mini stats row */}
          <div className="relative mt-5 grid grid-cols-3 gap-2.5 border-t border-white/60 pt-5">
            <MiniStat
              icon={<Package size={14} />}
              label="Orders"
              value={orders.length || 0}
              tone="orange"
            />
            <MiniStat
              icon={<BadgeCheck size={14} />}
              label="Completed"
              value={completedOrdersCount}
              tone="emerald"
            />
            <MiniStat
              icon={<TrendingUp size={14} />}
              label="Total Spent"
              value={`₹${Math.round(totalSpent)}`}
              tone="amber"
            />
          </div>
        </div>

        {/* ============================================================= */}
        {/* TABS                                                          */}
        {/* ============================================================= */}
        <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-white/60 bg-white/60 p-1.5 shadow-sm backdrop-blur-xl">
          {(
            [
              { id: "profile", label: "Profile", icon: User },
              { id: "addresses", label: "Addresses", icon: MapPin },
              { id: "orders", label: "Orders", icon: Package },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const badge =
              id === "addresses"
                ? addresses.length
                : id === "orders"
                ? orders.length
                : undefined;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
                  active
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black ${
                      active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ============================================================= */}
        {/* PROFILE TAB                                                    */}
        {/* ============================================================= */}
        {activeTab === "profile" && (
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                  <User size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 sm:text-base">
                    Personal Information
                  </h2>
                  <p className="text-[11px] font-semibold text-gray-500">
                    Keep your details up to date
                  </p>
                </div>
              </div>

              {!editMode ? (
                <button
                  onClick={() => {
                    setEditMode(true);
                    setSaveError("");
                    setSaveSuccess(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-orange-600 shadow-sm transition hover:bg-orange-100 active:scale-95"
                >
                  <Edit3 size={13} /> Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    setEditMode(false);
                    setSaveError("");
                    setProfileForm({
                      name: userProfile?.name || "",
                      phone: userProfile?.phone || "",
                    });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/70 text-gray-500 shadow-sm transition hover:text-red-500"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {saveSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">
                <CheckCircle2 size={15} /> Profile updated successfully!
              </div>
            )}
            {saveError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-bold text-red-600 shadow-sm">
                <AlertCircle size={15} /> {saveError}
              </div>
            )}

            <div className="space-y-4">
              <Field
                label="Full Name"
                icon={<User size={11} />}
              >
                {editMode ? (
                  <input
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="Your full name"
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900">
                    {userProfile?.name || "—"}
                  </p>
                )}
              </Field>

              <Field label="Mobile Number" icon={<Phone size={11} />}>
                {editMode ? (
                  <input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    className={inputCls}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    maxLength={10}
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900">
                    {userProfile?.phone || "—"}
                  </p>
                )}
              </Field>

              <Field label="Email Address" icon={<Mail size={11} />}>
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                  {user.email}
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                    ✓ Verified
                  </span>
                </p>
                {isGoogleUser && (
                  <p className="mt-1 text-[11px] font-semibold text-gray-400">
                    Managed by Google — cannot be changed here.
                  </p>
                )}
              </Field>
            </div>

            {editMode && (
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] hover:shadow-orange-500/40 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* ADDRESSES TAB                                                  */}
        {/* ============================================================= */}
        {activeTab === "addresses" && (
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25">
                  <MapPin size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 sm:text-base">
                    Saved Addresses
                  </h2>
                  <p className="text-[11px] font-semibold text-gray-500">
                    {addresses.length} address{addresses.length === 1 ? "" : "es"} saved
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddAddress(true);
                  setAddressError("");
                }}
                className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-orange-600 shadow-sm transition hover:bg-orange-100 active:scale-95"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {addresses.length === 0 && !showAddAddress && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-orange-50">
                  <MapPin size={30} className="text-orange-400" />
                </div>
                <p className="mt-4 text-sm font-black text-gray-700">
                  No saved addresses
                </p>
                <p className="mt-1 max-w-xs text-xs font-semibold text-gray-500">
                  Add a delivery address for faster checkout
                </p>
                <button
                  onClick={() => setShowAddAddress(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                >
                  <Plus size={13} /> Add First Address
                </button>
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((addr) => {
                const labelLower = addr.label.toLowerCase();
                const Icon =
                  labelLower.includes("home") || labelLower.includes("house")
                    ? Home
                    : labelLower.includes("office") || labelLower.includes("work")
                    ? Briefcase
                    : Building2;
                return (
                  <div
                    key={addr.id}
                    className="group flex items-start gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:border-orange-200 hover:bg-white hover:shadow-md"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-500 ring-1 ring-white/60">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-black text-gray-900">
                        {addr.label}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-snug text-gray-500">
                        {addr.fullAddress}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                      title="Delete address"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {showAddAddress && (
              <div className="mt-5 rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-amber-50/60 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-gray-800">
                    <Sparkles size={14} className="text-orange-500" /> New Address
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddAddress(false);
                      setAddressError("");
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>

                {addressError && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs font-bold text-red-600">
                    <AlertCircle size={13} /> {addressError}
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    placeholder="Label (e.g. Home, Office)"
                    value={newAddress.label}
                    onChange={(e) =>
                      setNewAddress((p) => ({ ...p, label: e.target.value }))
                    }
                    className={inputCls}
                  />
                  <input
                    placeholder="House / Flat / Building"
                    value={newAddress.houseFlat}
                    onChange={(e) =>
                      setNewAddress((p) => ({ ...p, houseFlat: e.target.value }))
                    }
                    className={inputCls}
                  />
                  <input
                    placeholder="Street / Area / Colony"
                    value={newAddress.streetArea}
                    onChange={(e) =>
                      setNewAddress((p) => ({ ...p, streetArea: e.target.value }))
                    }
                    className={inputCls}
                  />
                  <input
                    placeholder="Landmark (optional)"
                    value={newAddress.landmark}
                    onChange={(e) =>
                      setNewAddress((p) => ({ ...p, landmark: e.target.value }))
                    }
                    className={inputCls}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) =>
                        setNewAddress((p) => ({ ...p, city: e.target.value }))
                      }
                      className={inputCls}
                    />
                    <input
                      placeholder="Pincode"
                      value={newAddress.pincode}
                      onChange={(e) =>
                        setNewAddress((p) => ({
                          ...p,
                          pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      className={inputCls}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddAddress}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
                  >
                    <Save size={13} /> Save Address
                  </button>
                  <button
                    onClick={() => {
                      setShowAddAddress(false);
                      setAddressError("");
                    }}
                    className="rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* ORDERS TAB                                                     */}
        {/* ============================================================= */}
        {activeTab === "orders" && (
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-7">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25">
                <Receipt size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 sm:text-base">
                  My Orders
                </h2>
                <p className="text-[11px] font-semibold text-gray-500">
                  {orders.length} order{orders.length === 1 ? "" : "s"} on record
                </p>
              </div>
            </div>

            {ordersLoading && (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-b-orange-500" />
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
                  Loading orders…
                </p>
              </div>
            )}

            {!ordersLoading && orders.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-purple-50">
                  <Package size={30} className="text-purple-400" />
                </div>
                <p className="mt-4 text-sm font-black text-gray-700">
                  No orders yet
                </p>
                <p className="mt-1 max-w-xs text-xs font-semibold text-gray-500">
                  Your order history will appear here after your first order
                </p>
                <Link
                  href="/menu"
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                >
                  🍕 Browse Menu
                </Link>
              </div>
            )}

            <div className="space-y-3">
              {orders.map((order) => {
                const status =
                  order.deliveryStatus === "delivered"
                    ? "delivered"
                    : order.status;
                const statusLabel = STATUS_LABELS[status] || status;
                const statusColor =
                  STATUS_COLORS[status] || "bg-gray-100 text-gray-600 ring-gray-300";
                const StatusIcon = STATUS_ICONS[status] || Package;
                const isExpanded = expandedOrderId === order.id;
                const date = order.createdAt?.toDate?.()
                  ? new Date(order.createdAt.toDate())
                  : order.createdAt
                  ? new Date(order.createdAt)
                  : null;
                const isActive =
                  status !== "completed" &&
                  status !== "delivered" &&
                  status !== "cancelled";

                return (
                  <div
                    key={order.id}
                    className={`overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur-md transition-all ${
                      isActive
                        ? "border-orange-200 shadow-orange-500/10"
                        : "border-white/60"
                    }`}
                  >
                    <button
                      onClick={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                      className="w-full p-4 text-left transition-colors hover:bg-orange-50/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-black text-gray-900">
                              {order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${statusColor}`}
                            >
                              <StatusIcon size={9} /> {statusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-gray-400">
                            {date
                              ? date.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}{" "}
                            ·{" "}
                            <span className="uppercase">
                              {order.orderType || order.type || "takeaway"}
                            </span>
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <p className="font-mono text-base font-black text-gray-900">
                            ₹{order.total}
                          </p>
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-gray-400 shadow-sm transition group-hover:text-orange-500">
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </span>
                        </div>
                      </div>

                      {order.deliveryOtp &&
                        status !== "completed" &&
                        status !== "delivered" && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            <KeyRound size={10} /> OTP Ready
                          </div>
                        )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/60 bg-orange-50/30 px-4 pb-4 pt-4">
                        {order.deliveryOtp &&
                          status !== "completed" &&
                          status !== "delivered" && (
                            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-3">
                              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                <KeyRound size={12} /> Share with rider
                              </span>
                              <span className="select-all rounded-xl border border-emerald-300 bg-white px-3 py-1 font-mono text-base font-black tracking-widest text-emerald-700 shadow-sm">
                                {order.deliveryOtp}
                              </span>
                            </div>
                          )}

                        <div className="space-y-1.5">
                          {(order.items || []).map((item: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="truncate pr-2 font-semibold text-gray-700">
                                <span className="mr-1.5 font-black text-orange-600">
                                  {item.quantity}×
                                </span>
                                {item.name}
                              </span>
                              <span className="shrink-0 font-mono font-black text-gray-900">
                                ₹{(item.price * item.quantity).toFixed(0)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-1.5 border-t border-orange-200/60 pt-3">
                          {order.deliveryFee > 0 && (
                            <div className="flex justify-between text-xs font-semibold text-gray-500">
                              <span>Delivery Fee</span>
                              <span className="font-mono">
                                ₹{order.deliveryFee}
                              </span>
                            </div>
                          )}
                          {order.discount > 0 && (
                            <div className="flex justify-between text-xs font-bold text-emerald-600">
                              <span>Discount</span>
                              <span className="font-mono">
                                −₹{order.discount}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t border-orange-200/60 pt-2">
                            <span className="text-sm font-black text-gray-900">
                              Total
                            </span>
                            <span className="font-mono text-lg font-black text-orange-600">
                              ₹{order.total}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-orange-200/60 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-gray-600 ring-1 ring-gray-200">
                              {order.paymentMethod}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 ring-1 ${
                                order.paymentStatus === "paid"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-amber-50 text-amber-700 ring-amber-200"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </div>

                          {(status === "completed" || status === "delivered") && (
                            <button
                              type="button"
                              onClick={() => setRatingModalOrder(order)}
                              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900 shadow-sm transition hover:scale-[1.03] active:scale-95"
                            >
                              <Star
                                size={12}
                                className="fill-amber-500 text-amber-500"
                              />
                              Rate Dishes
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {ratingModalOrder && user && (
              <RatingModal
                isOpen={!!ratingModalOrder}
                onClose={() => setRatingModalOrder(null)}
                order={ratingModalOrder}
                userId={user.uid}
                userName={userProfile?.name || user.displayName || "Customer"}
                onSuccess={() => fetchOrders()}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================= */
/* Reusable components                                           */
/* ============================================================= */

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "orange" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    orange: "from-orange-500 to-amber-500 shadow-orange-500/25",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    amber: "from-amber-500 to-yellow-500 shadow-amber-500/25",
  };
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/60 p-3 text-center shadow-sm backdrop-blur-md">
      <div
        className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-white/50 ${tones[tone]}`}
      >
        {icon}
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <p className="font-mono text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
        {icon}
        {label}
      </label>
      <div className="rounded-xl border border-white/60 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}