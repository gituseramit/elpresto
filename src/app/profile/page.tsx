"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
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
  Sparkles,
  TrendingUp,
  Clock,
  KeyRound,
  Receipt,
  Crown,
  Building2,
  Truck,
  BadgeCheck,
  Copy,
  Search,
  ExternalLink,
  Info,
  ShoppingBag,
  Navigation,
} from "lucide-react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RatingModal from "@/components/RatingModal";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

type ProfileTab = "profile" | "addresses" | "orders";
type OrderFilter = "all" | "active" | "completed" | "cancelled";
type ToastKind = "success" | "error" | "info";

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface OrderItemShape {
  id?: string;
  name: string;
  quantity: number;
  price: number;
}

interface ProfileOrder {
  id: string;
  orderNumber?: string;
  status?: string;
  deliveryStatus?: string;
  orderType?: string;
  type?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryOtp?: string;
  cancelReason?: string;
  items?: OrderItemShape[];
  createdAt?: unknown;
}

interface AddressForm {
  label: string;
  houseFlat: string;
  streetArea: string;
  landmark: string;
  city: string;
  pincode: string;
}

/* ============================================================= */
/* Constants                                                     */
/* ============================================================= */

const MAX_ORDERS_FETCH = 100;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
  preparing: "bg-blue-500/15 text-blue-700 ring-blue-500/30",
  ready: "bg-purple-500/15 text-purple-700 ring-purple-500/30",
  assigned: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30",
  out_for_delivery: "bg-orange-500/15 text-orange-700 ring-orange-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  delivered: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-700 ring-red-500/30",
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

type StatusIcon = ComponentType<{ size?: number; className?: string }>;

const STATUS_ICONS: Record<string, StatusIcon> = {
  pending: Clock,
  preparing: Sparkles,
  ready: CheckCircle2,
  assigned: Truck,
  out_for_delivery: Truck,
  completed: BadgeCheck,
  delivered: BadgeCheck,
  cancelled: X,
};

const ORDER_STEPS: { key: string; label: string; icon: StatusIcon }[] = [
  { key: "pending", label: "Placed", icon: Clock },
  { key: "preparing", label: "Preparing", icon: Sparkles },
  { key: "ready", label: "Ready", icon: CheckCircle2 },
  { key: "out_for_delivery", label: "On the way", icon: Truck },
  { key: "completed", label: "Done", icon: BadgeCheck },
];

const DEFAULT_ADDRESS_FORM: AddressForm = {
  label: "",
  houseFlat: "",
  streetArea: "",
  landmark: "",
  city: "Prayagraj",
  pincode: "211010",
};

const inputCls =
  "w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/15";

/* ============================================================= */
/* Helpers                                                       */
/* ============================================================= */

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function normalisePincode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  if (typeof v?.toDate === "function") {
    try {
      return v.toDate();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTime(value: unknown): number {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

function generateAddressId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `addr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStatusKey(order: ProfileOrder): string {
  if (order.status === "cancelled") return "cancelled";
  if (order.deliveryStatus === "delivered") return "delivered";
  if (
    order.deliveryStatus === "out_for_delivery" ||
    order.status === "out_for_delivery"
  ) {
    return "out_for_delivery";
  }
  if (order.deliveryStatus === "assigned") return "assigned";
  if (order.status === "ready") return "ready";
  if (order.status === "preparing") return "preparing";
  if (order.status === "completed") return "completed";
  return order.status || "pending";
}

function isActiveOrder(order: ProfileOrder): boolean {
  const s = getStatusKey(order);
  return s !== "completed" && s !== "delivered" && s !== "cancelled";
}

function getStepIndex(statusKey: string): number {
  const idx = ORDER_STEPS.findIndex((s) => s.key === statusKey);
  if (idx >= 0) return idx;
  if (statusKey === "assigned") return 3;
  if (statusKey === "delivered") return ORDER_STEPS.length - 1;
  return -1;
}

function getInitials(name: string): string {
  const parts = name.split(" ").map((n) => n.trim()).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/* ============================================================= */
/* Toast                                                         */
/* ============================================================= */

function Toast({
  state,
  onDismiss,
}: {
  state: ToastState | null;
  onDismiss: () => void;
}) {
  if (!state) return null;
  const tone =
    state.kind === "success"
      ? "border-emerald-200 bg-white"
      : state.kind === "error"
      ? "border-red-200 bg-white"
      : "border-slate-200 bg-white";
  const iconTone =
    state.kind === "success"
      ? "bg-emerald-500"
      : state.kind === "error"
      ? "bg-red-500"
      : "bg-slate-700";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex justify-center px-3"
    >
      <div
        className={`pointer-events-auto flex w-[min(460px,100%)] items-center gap-3 rounded-2xl border ${tone} px-4 py-3 shadow-xl`}
      >
        <div
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${iconTone}`}
        >
          {state.kind === "success" ? (
            <CheckCircle2 size={15} />
          ) : state.kind === "error" ? (
            <AlertCircle size={15} />
          ) : (
            <Info size={15} />
          )}
        </div>
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-800">
          {state.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:text-slate-900"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================= */
/* Confirm dialog                                                */
/* ============================================================= */

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, busy, onClose]);

  if (!state) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await state.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl"
      >
        <div className="p-5">
          <h3 className="text-sm font-black text-gray-900">{state.title}</h3>
          <p className="mt-1.5 text-xs font-semibold text-gray-500">
            {state.message}
          </p>
        </div>
        <div className="flex gap-2 border-t border-gray-100 bg-gray-50/70 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl bg-gray-200 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-300 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-2.5 text-xs font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-60 ${
              state.destructive
                ? "bg-red-600 shadow-red-500/25 hover:bg-red-500"
                : "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/25"
            }`}
          >
            {busy ? "Working…" : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================= */
/* Field                                                         */
/* ============================================================= */

function Field({
  label,
  icon,
  children,
  htmlFor,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500"
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </label>
      <div className="rounded-xl border border-white/60 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

/* ============================================================= */
/* MiniStat                                                      */
/* ============================================================= */

function MiniStat({
  icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: "orange" | "emerald" | "amber";
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    orange: "from-orange-500 to-amber-500 shadow-orange-500/25",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    amber: "from-amber-500 to-yellow-500 shadow-amber-500/25",
  };
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/60 bg-white/60 p-3 text-center shadow-sm backdrop-blur-md">
      <div
        aria-hidden="true"
        className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-white/50 ${tones[tone]}`}
      >
        {icon}
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </p>
      {loading ? (
        <div className="mt-1 h-4 w-12 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="font-mono text-sm font-black text-gray-900">{value}</p>
      )}
    </div>
  );
}

/* ============================================================= */
/* Order progress timeline                                       */
/* ============================================================= */

function OrderTimeline({ statusKey }: { statusKey: string }) {
  if (statusKey === "cancelled") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-3 text-xs font-bold text-red-700"
      >
        <X size={14} aria-hidden="true" />
        This order was cancelled.
      </div>
    );
  }

  const currentIdx = getStepIndex(statusKey);
  const safeIdx = currentIdx < 0 ? 0 : currentIdx;

  return (
    <div
      aria-label="Order progress"
      className="rounded-2xl border border-orange-200/60 bg-white/70 p-3"
    >
      <div className="flex items-center justify-between gap-1">
        {ORDER_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const done = idx <= safeIdx;
          const active = idx === safeIdx;
          return (
            <div
              key={step.key}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className={`relative grid h-8 w-8 place-items-center rounded-full ring-2 transition ${
                  done
                    ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white ring-orange-200"
                    : "bg-white text-gray-400 ring-gray-200"
                } ${active ? "shadow-md shadow-orange-500/40" : ""}`}
              >
                <Icon size={14} aria-hidden="true" />
                {active && statusKey !== "completed" && statusKey !== "delivered" && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-full bg-orange-500/40"
                  />
                )}
              </div>
              <span
                className={`text-center text-[9px] font-black uppercase tracking-wider ${
                  done ? "text-orange-700" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================= */
/* Skeleton                                                      */
/* ============================================================= */

function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/60 bg-white/70 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 rounded bg-gray-200" />
            <div className="h-4 w-16 rounded bg-gray-200" />
          </div>
          <div className="mt-2 h-3 w-40 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================= */
/* Main                                                          */
/* ============================================================= */

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    loading: authLoading,
    updateUserProfile,
    logout,
  } = useAuth();

  /* ---- UI ---- */
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });

  /* ---- Address ---- */
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(
    DEFAULT_ADDRESS_FORM
  );
  const [addressError, setAddressError] = useState("");

  /* ---- Orders ---- */
  const [orders, setOrders] = useState<ProfileOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ratingModalOrder, setRatingModalOrder] = useState<ProfileOrder | null>(
    null
  );
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  /* ---- Feedback ---- */
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);
  const saveSuccessTimerRef = useRef<number | null>(null);
  const fetchCancelledRef = useRef(false);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = ++toastIdRef.current;
    setToast({ id, kind, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null)
        window.clearTimeout(toastTimerRef.current);
      if (saveSuccessTimerRef.current != null)
        window.clearTimeout(saveSuccessTimerRef.current);
    };
  }, []);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?redirect=/profile");
    }
  }, [authLoading, user, router]);

  /* ---- Sync profile form ---- */
  useEffect(() => {
    if (userProfile && !editMode) {
      setProfileForm({
        name: userProfile.name || "",
        phone: userProfile.phone || "",
      });
    }
  }, [userProfile, editMode]);

  /* ---- Hash-based tab (#orders) ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "orders" || h === "addresses" || h === "profile") {
        setActiveTab(h as ProfileTab);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  /* ---- Fetch orders on mount ---- */
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const q = query(
        collection(db, "orders"),
        where("customerId", "==", user.uid),
        limit(MAX_ORDERS_FETCH)
      );
      const snap = await getDocs(q);
      if (fetchCancelledRef.current) return;

      const list: ProfileOrder[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ProfileOrder, "id">),
      }));

      list.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
      setOrders(list);
    } catch (err) {
      console.error("Failed to load orders:", err);
      if (!fetchCancelledRef.current) {
        setOrdersError("Unable to load orders right now. Please try again.");
      }
    } finally {
      if (!fetchCancelledRef.current) setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchCancelledRef.current = false;
    void fetchOrders();
    return () => {
      fetchCancelledRef.current = true;
    };
  }, [user, fetchOrders]);

  /* ---- Derived ---- */
  const displayName =
    userProfile?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Customer";
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const addresses = useMemo(
    () => userProfile?.savedAddresses || [],
    [userProfile?.savedAddresses]
  );
  const isGoogleUser = useMemo(
    () =>
      Boolean(
        user?.providerData?.some((p) => p.providerId === "google.com")
      ),
    [user?.providerData]
  );

  const completedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          getStatusKey(o) === "completed" || getStatusKey(o) === "delivered"
      ),
    [orders]
  );
  const totalSpent = useMemo(
    () =>
      completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [completedOrders]
  );
  const totalSaved = useMemo(
    () =>
      completedOrders.reduce(
        (sum, o) => sum + (Number(o.discount) || 0),
        []
      ),
    [completedOrders]
  );
  const activeOrdersCount = useMemo(
    () => orders.filter(isActiveOrder).length,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (orderFilter === "active") {
      list = list.filter(isActiveOrder);
    } else if (orderFilter === "completed") {
      list = list.filter((o) => {
        const k = getStatusKey(o);
        return k === "completed" || k === "delivered";
      });
    } else if (orderFilter === "cancelled") {
      list = list.filter((o) => getStatusKey(o) === "cancelled");
    }
    const q = orderSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const num = (o.orderNumber || "").toLowerCase();
        const itemNames = (o.items || [])
          .map((it) => (it.name || "").toLowerCase())
          .join(" ");
        return num.includes(q) || itemNames.includes(q);
      });
    }
    return list;
  }, [orders, orderFilter, orderSearch]);

  /* ============================================================= */
  /* Profile actions                                              */
  /* ============================================================= */

  const handleSaveProfile = useCallback(async () => {
    setSaveError("");
    const name = profileForm.name.trim();
    const phone = normalisePhone(profileForm.phone);

    if (!name) {
      setSaveError("Name cannot be empty.");
      return;
    }
    if (phone && phone.length !== 10) {
      setSaveError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({ name, phone });
      setEditMode(false);
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current != null) {
        window.clearTimeout(saveSuccessTimerRef.current);
      }
      saveSuccessTimerRef.current = window.setTimeout(() => {
        setSaveSuccess(false);
        saveSuccessTimerRef.current = null;
      }, 3000);
      showToast("success", "Profile updated.");
    } catch (err) {
      console.error("Profile save failed:", err);
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [profileForm, updateUserProfile, showToast]);

  const cancelEdit = useCallback(() => {
    setEditMode(false);
    setSaveError("");
    setProfileForm({
      name: userProfile?.name || "",
      phone: userProfile?.phone || "",
    });
  }, [userProfile]);

  /* ============================================================= */
  /* Address actions                                              */
  /* ============================================================= */

  const openAddAddress = useCallback(() => {
    setAddressForm(DEFAULT_ADDRESS_FORM);
    setEditingAddressId(null);
    setAddressError("");
    setShowAddressForm(true);
  }, []);

  const openEditAddress = useCallback((addr: SavedAddress) => {
    setAddressForm({
      label: addr.label || "",
      houseFlat: addr.houseFlat || "",
      streetArea: addr.streetArea || "",
      landmark: addr.landmark || "",
      city: addr.city || "Prayagraj",
      pincode: addr.pincode || "211010",
    });
    setEditingAddressId(addr.id);
    setAddressError("");
    setShowAddressForm(true);
  }, []);

  const closeAddressForm = useCallback(() => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressError("");
    setAddressForm(DEFAULT_ADDRESS_FORM);
  }, []);

  const handleSaveAddress = useCallback(async () => {
    setAddressError("");
    const label = addressForm.label.trim();
    const houseFlat = addressForm.houseFlat.trim();
    const streetArea = addressForm.streetArea.trim();
    if (!label || !houseFlat || !streetArea) {
      setAddressError("Please fill in Label, House/Flat, and Street/Area.");
      return;
    }

    const addr: SavedAddress = {
      id: editingAddressId || generateAddressId(),
      label,
      houseFlat,
      streetArea,
      ...(addressForm.landmark.trim()
        ? { landmark: addressForm.landmark.trim() }
        : {}),
      city: addressForm.city.trim() || "Prayagraj",
      pincode: normalisePincode(addressForm.pincode) || "211010",
      fullAddress: `${houseFlat}, ${streetArea}, ${
        addressForm.city.trim() || "Prayagraj"
      } - ${normalisePincode(addressForm.pincode) || "211010"}`,
    };

    const existing = userProfile?.savedAddresses || [];
    const next = editingAddressId
      ? existing.map((a) => (a.id === editingAddressId ? addr : a))
      : [...existing, addr];

    try {
      await updateUserProfile({ savedAddresses: next });
      closeAddressForm();
      showToast(
        "success",
        editingAddressId ? "Address updated." : "Address added."
      );
    } catch (err) {
      console.error("Address save failed:", err);
      setAddressError("Failed to save address. Please try again.");
    }
  }, [
    addressForm,
    editingAddressId,
    userProfile?.savedAddresses,
    updateUserProfile,
    closeAddressForm,
    showToast,
  ]);

  const handleDeleteAddress = useCallback(
    (addr: SavedAddress) => {
      setConfirm({
        title: "Delete address?",
        message: `Remove "${addr.label}" from your saved addresses?`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          const existing = userProfile?.savedAddresses || [];
          const next = existing.filter((a) => a.id !== addr.id);
          try {
            await updateUserProfile({ savedAddresses: next });
            showToast("success", "Address removed.");
          } catch (err) {
            console.error("Address delete failed:", err);
            showToast("error", "Failed to remove address. Please try again.");
          }
        },
      });
    },
    [userProfile?.savedAddresses, updateUserProfile, showToast]
  );

  /* ============================================================= */
  /* Logout                                                       */
  /* ============================================================= */

  const handleLogout = useCallback(() => {
    setConfirm({
      title: "Sign out?",
      message: "You'll need to sign in again to place an order.",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: async () => {
        try {
          await logout();
          router.push("/");
        } catch (err) {
          console.error("Logout failed:", err);
          showToast("error", "Sign out failed. Please try again.");
        }
      },
    });
  }, [logout, router, showToast]);

  /* ============================================================= */
  /* Order helpers                                                */
  /* ============================================================= */

  const handleCopyOrderNumber = useCallback(
    async (order: ProfileOrder) => {
      const text = order.orderNumber || order.id.slice(0, 8);
      try {
        await navigator.clipboard.writeText(text);
        setCopiedOrderId(order.id);
        window.setTimeout(() => setCopiedOrderId(null), 1800);
      } catch {
        showToast("error", "Could not copy to clipboard.");
      }
    },
    [showToast]
  );

  /* ============================================================= */
  /* Loading gate                                                 */
  /* ============================================================= */

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-orange-500" />
          <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================= */
  /* Tabs config                                                  */
  /* ============================================================= */

  const tabs: { id: ProfileTab; label: string; icon: StatusIcon }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "orders", label: "Orders", icon: Package },
  ];

  const orderFilters: { id: OrderFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  /* ============================================================= */
  /* Render                                                       */
  /* ============================================================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
      <Toast state={toast} onDismiss={dismissToast} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      <div className="mx-auto max-w-3xl">
        <Link
          href="/menu"
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm font-bold text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-orange-600"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to Menu
        </Link>

        {/* HERO */}
        <div className="relative mb-5 overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.2)] backdrop-blur-2xl sm:p-7">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-rose-400/15 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-center sm:self-auto">
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 text-2xl font-black text-white shadow-xl shadow-orange-500/30 ring-4 ring-white">
                {initials}
              </div>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="truncate text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                  <Crown size={10} aria-hidden="true" /> Member
                </span>
              </div>
              <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-sm font-semibold text-gray-500 sm:justify-start">
                <Mail size={13} aria-hidden="true" /> {user.email || "—"}
              </p>
              {isGoogleUser && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 shadow-sm">
                  <svg
                    aria-hidden="true"
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
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
                  Google Account
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-red-500 shadow-sm transition hover:bg-red-100 active:scale-95"
            >
              <LogOut size={13} aria-hidden="true" /> Logout
            </button>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2.5 border-t border-white/60 pt-5">
            <MiniStat
              icon={<Package size={14} />}
              label="Orders"
              value={orders.length}
              tone="orange"
              loading={ordersLoading}
            />
            <MiniStat
              icon={<BadgeCheck size={14} />}
              label="Completed"
              value={completedOrders.length}
              tone="emerald"
              loading={ordersLoading}
            />
            <MiniStat
              icon={<TrendingUp size={14} />}
              label="Total Spent"
              value={`₹${Math.round(totalSpent)}`}
              tone="amber"
              loading={ordersLoading}
            />
          </div>

          {totalSaved > 0 && (
            <p className="relative mt-3 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600">
              🎉 You&apos;ve saved ₹{Math.round(totalSaved)} with promos
            </p>
          )}
        </div>

        {/* TABS */}
        <div
          role="tablist"
          aria-label="Profile sections"
          className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-white/60 bg-white/60 p-1.5 shadow-sm backdrop-blur-xl"
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const badge =
              id === "addresses"
                ? addresses.length
                : id === "orders"
                ? activeOrdersCount > 0
                  ? activeOrdersCount
                  : orders.length
                : undefined;
            const badgePulse = id === "orders" && activeOrdersCount > 0;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setRatingModalOrder(null);
                }}
                className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
                  active
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black ${
                      active
                        ? "bg-white/25 text-white"
                        : badgePulse
                        ? "bg-orange-500 text-white"
                        : "bg-gray-200 text-gray-700"
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
                <div
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                >
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
                  type="button"
                  onClick={() => {
                    setEditMode(true);
                    setSaveError("");
                    setSaveSuccess(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-orange-600 shadow-sm transition hover:bg-orange-100 active:scale-95"
                >
                  <Edit3 size={13} aria-hidden="true" /> Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelEdit}
                  aria-label="Cancel editing"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/70 text-gray-500 shadow-sm transition hover:text-red-500"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {saveSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm"
              >
                <CheckCircle2 size={15} aria-hidden="true" /> Profile updated
                successfully!
              </div>
            )}
            {saveError && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-bold text-red-600 shadow-sm"
              >
                <AlertCircle size={15} aria-hidden="true" /> {saveError}
              </div>
            )}

            <div className="space-y-4">
              <Field
                label="Full Name"
                icon={<User size={11} />}
                htmlFor="profile-name"
              >
                {editMode ? (
                  <input
                    id="profile-name"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900">
                    {userProfile?.name || "—"}
                  </p>
                )}
              </Field>

              <Field
                label="Mobile Number"
                icon={<Phone size={11} />}
                htmlFor="profile-phone"
              >
                {editMode ? (
                  <input
                    id="profile-phone"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        phone: normalisePhone(e.target.value),
                      }))
                    }
                    className={inputCls}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel"
                  />
                ) : (
                  <p className="text-sm font-bold text-gray-900">
                    {userProfile?.phone || "—"}
                  </p>
                )}
              </Field>

              <Field label="Email Address" icon={<Mail size={11} />}>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-gray-700">
                  {user.email || "—"}
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
                type="button"
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
                    <Save size={15} aria-hidden="true" /> Save Changes
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
                <div
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25"
                >
                  <MapPin size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 sm:text-base">
                    Saved Addresses
                  </h2>
                  <p className="text-[11px] font-semibold text-gray-500">
                    {addresses.length} address
                    {addresses.length === 1 ? "" : "es"} saved
                  </p>
                </div>
              </div>
              {!showAddressForm && (
                <button
                  type="button"
                  onClick={openAddAddress}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-orange-600 shadow-sm transition hover:bg-orange-100 active:scale-95"
                >
                  <Plus size={13} aria-hidden="true" /> Add
                </button>
              )}
            </div>

            {addresses.length === 0 && !showAddressForm && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-orange-50">
                  <MapPin
                    size={30}
                    className="text-orange-400"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-4 text-sm font-black text-gray-700">
                  No saved addresses
                </p>
                <p className="mt-1 max-w-xs text-xs font-semibold text-gray-500">
                  Add a delivery address for faster checkout
                </p>
                <button
                  type="button"
                  onClick={openAddAddress}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                >
                  <Plus size={13} aria-hidden="true" /> Add First Address
                </button>
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((addr) => {
                const labelLower = (addr.label || "").toLowerCase();
                const Icon: StatusIcon =
                  labelLower.includes("home") || labelLower.includes("house")
                    ? Home
                    : labelLower.includes("office") ||
                      labelLower.includes("work")
                    ? Briefcase
                    : Building2;
                return (
                  <div
                    key={addr.id}
                    className="group flex items-start gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:border-orange-200 hover:bg-white hover:shadow-md"
                  >
                    <div
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-500 ring-1 ring-white/60"
                    >
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
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditAddress(addr)}
                        aria-label={`Edit ${addr.label}`}
                        title="Edit address"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-gray-400 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500 active:scale-90"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr)}
                        aria-label={`Delete ${addr.label}`}
                        title="Delete address"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-90"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {showAddressForm && (
              <div className="mt-5 rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-amber-50/60 p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-gray-800">
                    <Sparkles
                      size={14}
                      className="text-orange-500"
                      aria-hidden="true"
                    />
                    {editingAddressId ? "Edit Address" : "New Address"}
                  </h3>
                  <button
                    type="button"
                    onClick={closeAddressForm}
                    aria-label="Close address form"
                    className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>

                {addressError && (
                  <div
                    role="alert"
                    className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs font-bold text-red-600"
                  >
                    <AlertCircle size={13} aria-hidden="true" /> {addressError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label htmlFor="addr-label" className="sr-only">
                      Label
                    </label>
                    <input
                      id="addr-label"
                      placeholder="Label (e.g. Home, Office)"
                      value={addressForm.label}
                      onChange={(e) =>
                        setAddressForm((p) => ({ ...p, label: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="addr-house" className="sr-only">
                      House / Flat
                    </label>
                    <input
                      id="addr-house"
                      placeholder="House / Flat / Building"
                      value={addressForm.houseFlat}
                      onChange={(e) =>
                        setAddressForm((p) => ({
                          ...p,
                          houseFlat: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="addr-street" className="sr-only">
                      Street / Area
                    </label>
                    <input
                      id="addr-street"
                      placeholder="Street / Area / Colony"
                      value={addressForm.streetArea}
                      onChange={(e) =>
                        setAddressForm((p) => ({
                          ...p,
                          streetArea: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="addr-landmark" className="sr-only">
                      Landmark
                    </label>
                    <input
                      id="addr-landmark"
                      placeholder="Landmark (optional)"
                      value={addressForm.landmark}
                      onChange={(e) =>
                        setAddressForm((p) => ({
                          ...p,
                          landmark: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="addr-city" className="sr-only">
                        City
                      </label>
                      <input
                        id="addr-city"
                        placeholder="City"
                        value={addressForm.city}
                        onChange={(e) =>
                          setAddressForm((p) => ({
                            ...p,
                            city: e.target.value,
                          }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="addr-pincode" className="sr-only">
                        Pincode
                      </label>
                      <input
                        id="addr-pincode"
                        placeholder="Pincode"
                        value={addressForm.pincode}
                        onChange={(e) =>
                          setAddressForm((p) => ({
                            ...p,
                            pincode: normalisePincode(e.target.value),
                          }))
                        }
                        className={inputCls}
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAddress}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
                  >
                    <Save size={13} aria-hidden="true" />
                    {editingAddressId ? "Update Address" : "Save Address"}
                  </button>
                  <button
                    type="button"
                    onClick={closeAddressForm}
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
              <div
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25"
              >
                <Receipt size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 sm:text-base">
                  My Orders
                </h2>
                <p className="text-[11px] font-semibold text-gray-500">
                  {orders.length} order{orders.length === 1 ? "" : "s"} on
                  record
                </p>
              </div>
            </div>

            {orders.length > 0 && !ordersLoading && (
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <label htmlFor="order-search" className="sr-only">
                    Search orders
                  </label>
                  <input
                    id="order-search"
                    type="search"
                    placeholder="Search by order number or item…"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/60 bg-white/70 py-2.5 pl-10 pr-9 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md focus:border-orange-400 focus:bg-white focus:outline-none"
                  />
                  {orderSearch && (
                    <button
                      type="button"
                      onClick={() => setOrderSearch("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-gray-100"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div
                  role="tablist"
                  aria-label="Filter orders"
                  className="flex flex-wrap gap-1.5"
                >
                  {orderFilters.map((f) => {
                    const active = orderFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => setOrderFilter(f.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                          active
                            ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                            : "border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {ordersLoading && <OrderSkeleton />}

            {!ordersLoading && ordersError && (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50/80 py-10 text-center"
              >
                <AlertCircle
                  size={26}
                  className="text-red-500"
                  aria-hidden="true"
                />
                <p className="text-sm font-black text-red-700">
                  {ordersError}
                </p>
                <button
                  type="button"
                  onClick={() => void fetchOrders()}
                  className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-purple-50">
                  <Package
                    size={30}
                    className="text-purple-400"
                    aria-hidden="true"
                  />
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
                  <ShoppingBag size={13} aria-hidden="true" /> Browse Menu
                </Link>
              </div>
            )}

            {!ordersLoading &&
              !ordersError &&
              orders.length > 0 &&
              filteredOrders.length === 0 && (
                <div className="flex flex-col items-center py-10 text-center">
                  <Search
                    size={26}
                    className="text-gray-300"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-black text-gray-600">
                    No orders match your filters
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearch("");
                      setOrderFilter("all");
                    }}
                    className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-600 transition hover:bg-gray-50"
                  >
                    Clear filters
                  </button>
                </div>
              )}

            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const statusKey = getStatusKey(order);
                const statusLabel = STATUS_LABELS[statusKey] || statusKey;
                const statusColor =
                  STATUS_COLORS[statusKey] ||
                  "bg-gray-100 text-gray-600 ring-gray-300";
                const StatusIcon = STATUS_ICONS[statusKey] || Package;
                const isExpanded = expandedOrderId === order.id;
                const created = toDate(order.createdAt);
                const active = isActiveOrder(order);
                const isDelivery =
                  order.orderType === "delivery" || order.type === "delivery";
                const orderNum = order.orderNumber || order.id.slice(0, 8);

                return (
                  <div
                    key={order.id}
                    className={`overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur-md transition-all ${
                      active
                        ? "border-orange-200 shadow-orange-500/10"
                        : "border-white/60"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                      className="w-full p-4 text-left transition-colors hover:bg-orange-50/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-black text-gray-900">
                              {orderNum}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${statusColor}`}
                            >
                              <StatusIcon size={9} aria-hidden="true" />
                              {statusLabel}
                            </span>
                            {active && (
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
                              />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-gray-400">
                            {created
                              ? created.toLocaleDateString("en-IN", {
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
                            ₹{Math.round(Number(order.total) || 0)}
                          </p>
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-gray-400 shadow-sm transition group-hover:text-orange-500">
                            {isExpanded ? (
                              <ChevronUp size={14} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={14} aria-hidden="true" />
                            )}
                          </span>
                        </div>
                      </div>

                      {order.deliveryOtp &&
                        isDelivery &&
                        statusKey !== "completed" &&
                        statusKey !== "delivered" &&
                        statusKey !== "cancelled" && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                            <KeyRound size={10} aria-hidden="true" /> OTP Ready
                          </div>
                        )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/60 bg-orange-50/30 px-4 pb-4 pt-4">
                        <OrderTimeline statusKey={statusKey} />

                        {statusKey === "cancelled" && order.cancelReason && (
                          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/70 p-3 text-xs font-semibold text-red-700">
                            <AlertCircle
                              size={14}
                              className="mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              <span className="font-black">Reason: </span>
                              {order.cancelReason}
                            </span>
                          </div>
                        )}

                        {order.deliveryOtp &&
                          isDelivery &&
                          statusKey !== "completed" &&
                          statusKey !== "delivered" &&
                          statusKey !== "cancelled" && (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-3">
                              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                <KeyRound size={12} aria-hidden="true" /> Share
                                with rider
                              </span>
                              <span className="select-all rounded-xl border border-emerald-300 bg-white px-3 py-1 font-mono text-base font-black tracking-widest text-emerald-700 shadow-sm">
                                {order.deliveryOtp}
                              </span>
                            </div>
                          )}

                        {order.items && order.items.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {order.items.map((item, i) => (
                              <div
                                key={`${item.id || item.name}-${i}`}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="truncate pr-2 font-semibold text-gray-700">
                                  <span className="mr-1.5 font-black text-orange-600">
                                    {item.quantity}×
                                  </span>
                                  {item.name}
                                </span>
                                <span className="shrink-0 font-mono font-black text-gray-900">
                                  ₹
                                  {Math.round(
                                    (Number(item.price) || 0) * item.quantity
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 space-y-1.5 border-t border-orange-200/60 pt-3">
                          {(Number(order.deliveryFee) || 0) > 0 && (
                            <div className="flex justify-between text-xs font-semibold text-gray-500">
                              <span>Delivery Fee</span>
                              <span className="font-mono">
                                ₹{Math.round(Number(order.deliveryFee))}
                              </span>
                            </div>
                          )}
                          {(Number(order.discount) || 0) > 0 && (
                            <div className="flex justify-between text-xs font-bold text-emerald-600">
                              <span>Discount</span>
                              <span className="font-mono">
                                −₹{Math.round(Number(order.discount))}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t border-orange-200/60 pt-2">
                            <span className="text-sm font-black text-gray-900">
                              Total
                            </span>
                            <span className="font-mono text-lg font-black text-orange-600">
                              ₹{Math.round(Number(order.total) || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-orange-200/60 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                            {order.paymentMethod && (
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-gray-600 ring-1 ring-gray-200">
                                {order.paymentMethod}
                              </span>
                            )}
                            {order.paymentStatus && (
                              <span
                                className={`rounded-full px-2 py-0.5 ring-1 ${
                                  order.paymentStatus === "paid"
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                    : "bg-amber-50 text-amber-700 ring-amber-200"
                                }`}
                              >
                                {order.paymentStatus}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyOrderNumber(order)}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 shadow-sm transition hover:border-orange-200 hover:text-orange-600"
                              aria-label={`Copy order number ${orderNum}`}
                            >
                              {copiedOrderId === order.id ? (
                                <>
                                  <CheckCircle2
                                    size={11}
                                    aria-hidden="true"
                                  />{" "}
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={11} aria-hidden="true" /> Copy
                                </>
                              )}
                            </button>

                            {active && (
                              <Link
                                href="/track"
                                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 shadow-sm transition hover:bg-blue-100"
                              >
                                <Navigation
                                  size={11}
                                  aria-hidden="true"
                                />{" "}
                                Track
                              </Link>
                            )}

                            {(statusKey === "completed" ||
                              statusKey === "delivered") && (
                              <button
                                type="button"
                                onClick={() => setRatingModalOrder(order)}
                                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900 shadow-sm transition hover:scale-[1.03] active:scale-95"
                              >
                                <Star
                                  size={12}
                                  className="fill-amber-500 text-amber-500"
                                  aria-hidden="true"
                                />
                                Rate
                              </button>
                            )}
                          </div>
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
                userName={
                  userProfile?.name || user.displayName || "Customer"
                }
                onSuccess={() => void fetchOrders()}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}