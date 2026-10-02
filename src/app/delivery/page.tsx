"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Truck,
  Phone,
  Navigation,
  CheckCircle,
  MapPin,
  Clock,
  Compass,
  LogOut,
  AlertCircle,
  ShoppingBag,
  Check,
  Bell,
  BellOff,
  Search,
  X,
  TrendingUp,
  IndianRupee,
  Route,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Award,
  Eye,
  ChevronDown,
  Flame,
  Package,
  User,
  Activity,
} from "lucide-react";
import LiveMap from "@/components/Map/LiveMap";
import { db } from "@/lib/firebase";
import { DEFAULT_DELIVERY_SETTINGS, DeliverySettings } from "@/lib/delivery";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { subscribePanelStatus } from "@/lib/panelAuth";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import {
  subscribeDayOrders,
  getISTDateString,
  formatISTDisplayDate,
} from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";
import StaffAttendanceAction from "@/components/StaffAttendanceAction";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

interface DeliveryAddress {
  houseFlat?: string;
  streetArea?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  fullAddress?: string;
}

interface DeliveryOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  phone?: string;
  type?: string;
  orderType?: string;
  status: string;
  deliveryStatus?: string;
  deliveryAddress?: DeliveryAddress | string;
  location?: unknown;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistance?: number;
  deliveryFee?: number;
  items: DeliveryOrderItem[];
  total: number;
  instructions?: string;
  createdAt: unknown;
  deliveredAt?: unknown;
  deliveryOtp?: string;
  paymentStatus?: string;
  branchId?: string;
}

interface StaffSession {
  email?: string;
  name?: string;
  role?: string;
  staffId?: string;
  branchId?: string;
  [key: string]: unknown;
}

type SortMode = "distance" | "time" | "value";
type FilterMode = "all" | "ready" | "out_for_delivery";
type ToastKind = "success" | "error" | "info";

interface Toast {
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

/* ============================================================= */
/* Constants                                                     */
/* ============================================================= */

const SOUND_STORAGE_KEY = "elpestro_rider_sound";
const SEEN_ORDERS_MAX = 2000;
const GPS_WRITE_INTERVAL_MS = 6000;

/* ============================================================= */
/* Helpers                                                       */
/* ============================================================= */

function safeString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function getElapsedMins(createdAt: unknown): number {
  const d = toDate(createdAt);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function getISTDateKey(value: unknown): string {
  const d = toDate(value);
  try {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return "";
  }
}

function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getOrderLat(order: DeliveryOrder): number | undefined {
  if (typeof order.deliveryLatitude === "number") return order.deliveryLatitude;
  const loc = order.location as { lat?: number } | undefined;
  if (loc && typeof loc === "object" && typeof loc.lat === "number") {
    return loc.lat;
  }
  return undefined;
}

function getOrderLng(order: DeliveryOrder): number | undefined {
  if (typeof order.deliveryLongitude === "number") return order.deliveryLongitude;
  const loc = order.location as { lng?: number } | undefined;
  if (loc && typeof loc === "object" && typeof loc.lng === "number") {
    return loc.lng;
  }
  return undefined;
}

function getFullAddress(order: DeliveryOrder): string {
  if (typeof order.deliveryAddress === "string") return order.deliveryAddress;
  if (order.deliveryAddress?.fullAddress) {
    return order.deliveryAddress.fullAddress;
  }
  const loc = order.location as { address?: string } | string | undefined;
  if (typeof loc === "string") return loc;
  if (loc && typeof loc === "object" && typeof loc.address === "string") {
    return loc.address;
  }
  return "Address not specified";
}

function getRiderIdentity(session: StaffSession | null): {
  id: string;
  name: string;
} {
  const id =
    safeString(session?.staffId) ||
    safeString(session?.email) ||
    "rider_portal";
  const name =
    safeString(session?.name) ||
    safeString(session?.email) ||
    "El Presto Delivery Partner";
  return { id, name };
}

/* ============================================================= */
/* Status badge                                                  */
/* ============================================================= */

function StatusBadge({
  status,
  orderStatus,
}: {
  status?: string;
  orderStatus?: string;
}) {
  const isReady = orderStatus === "ready" || status === "ready";
  const s = isReady ? "ready" : status || "pending";
  const map: Record<string, { label: string; cls: string }> = {
    ready: {
      label: "Ready for Delivery",
      cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    },
    pending: {
      label: "Ready for Delivery",
      cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    },
    assigned: {
      label: "Assigned",
      cls: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
    },
    out_for_delivery: {
      label: "In Transit",
      cls: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    },
    delivered: {
      label: "Delivered",
      cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    },
  };
  const info = map[s] || map.ready;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

/* ============================================================= */
/* Stat tile                                                     */
/* ============================================================= */

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "orange" | "blue" | "emerald" | "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    orange: "from-orange-500 to-amber-500 shadow-orange-500/25",
    blue: "from-blue-500 to-indigo-500 shadow-blue-500/25",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    amber: "from-amber-500 to-yellow-500 shadow-amber-500/25",
    purple: "from-purple-500 to-pink-500 shadow-purple-500/25",
  };
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-slate-900/60 p-3 backdrop-blur-xl">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-white/10 ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className="font-mono text-base font-black leading-tight text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ============================================================= */
/* Toast stack                                                   */
/* ============================================================= */

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[200] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2">
      {toasts.map((t) => {
        const base =
          t.kind === "success"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
            : t.kind === "error"
            ? "border-red-500/40 bg-red-500/15 text-red-200"
            : "border-white/10 bg-slate-800/90 text-slate-100";
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-black shadow-lg backdrop-blur ${base}`}
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === "success" ? (
                <CheckCircle size={14} />
              ) : t.kind === "error" ? (
                <AlertCircle size={14} />
              ) : (
                <Bell size={14} />
              )}
            </span>
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
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
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-sm font-black text-white">{state.title}</h3>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            {state.message}
          </p>
        </div>
        <div className="flex gap-2 border-t border-white/5 bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700 disabled:opacity-60"
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
/* Main component                                                */
/* ============================================================= */

export default function DeliveryPortal() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>("");

  /* ---- Data ---- */
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getISTDateString(0)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  /* ---- Tracking ---- */
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<
    string | null
  >(null);
  const [riderCoords, setRiderCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [orderRoadStats, setOrderRoadStats] = useState<
    Record<string, { distanceKm: number; durationMinutes: number }>
  >({});
  const [settings, setSettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS
  );

  /* ---- OTP modal ---- */
  const [otpModalOrder, setOtpModalOrder] = useState<DeliveryOrder | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  /* ---- UI ---- */
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [newOrderPulse, setNewOrderPulse] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  /* ---- Toasts / confirm ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastIdRef = useRef(0);

  /* ---- Refs ---- */
  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenOrdersRef = useRef<Set<string>>(new Set());
  const lastGpsWriteRef = useRef<number>(0);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const pulseTimeoutRef = useRef<number | null>(null);
  const staffSessionRef = useRef<StaffSession | null>(null);

  /* ============================================================= */
  /* Toasts                                                        */
  /* ============================================================= */

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ============================================================= */
  /* Session bootstrap                                             */
  /* ============================================================= */

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    import("@/lib/staffAuth")
      .then(({ getStaffSession, isSessionValid }) => {
        if (cancelled) return;
        try {
          const session = getStaffSession("delivery") as StaffSession | null;
          if (session && isSessionValid(session as never)) {
            setStaffSession(session);
            setIsAuthenticated(true);
            if (session.branchId) setActiveBranchId(session.branchId);
          }
        } finally {
          setIsVerifyingAuth(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load staff session:", err);
        if (!cancelled) setIsVerifyingAuth(false);
      });

    const unsub = subscribePanelStatus("delivery", () => {
      // Clean up state on forced logout.
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsAuthenticated(false);
      setStaffSession(null);
      setOrders([]);
      seenOrdersRef.current.clear();
      setActiveTrackingOrderId(null);
      setGpsActive(false);
      import("@/lib/staffAuth")
        .then(({ clearStaffSession }) => clearStaffSession("delivery"))
        .catch(() => {
          /* ignore */
        });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  /* Keep refs in sync */
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    staffSessionRef.current = staffSession;
  }, [staffSession]);

  /* Audio cleanup */
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {
          /* ignore */
        });
        audioCtxRef.current = null;
      }
      if (pulseTimeoutRef.current != null) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  /* ============================================================= */
  /* Settings fetch                                                */
  /* ============================================================= */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (cancelled) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            cafeName:
              data.cafeName || DEFAULT_DELIVERY_SETTINGS.cafeName,
            cafeLat:
              data.cafeLat ||
              data.restaurantLat ||
              DEFAULT_DELIVERY_SETTINGS.cafeLat,
            cafeLng:
              data.cafeLng ||
              data.restaurantLng ||
              DEFAULT_DELIVERY_SETTINGS.cafeLng,
            deliveryRadiusKm: data.deliveryRadiusKm || 7,
            baseDeliveryFee: data.baseDeliveryFee || 30,
            freeDeliveryThreshold: data.freeDeliveryThreshold || 499,
            deliveryEnabled:
              data.deliveryEnabled !== undefined
                ? data.deliveryEnabled
                : true,
          });
        }
      } catch (err) {
        console.warn("Using default delivery settings:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================= */
  /* Sound                                                         */
  /* ============================================================= */

  const playNewOrderChime = useCallback(() => {
    if (!soundEnabledRef.current) return;
    if (typeof window === "undefined") return;
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {
          /* ignore */
        });
      }
      const now = ctx.currentTime;
      [880, 1108, 1318].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        const start = now + i * 0.12;
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (next) playNewOrderChime();
      return next;
    });
  }, [playNewOrderChime]);

  /* ============================================================= */
  /* Logout                                                        */
  /* ============================================================= */

  const handleLogout = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsAuthenticated(false);
    setStaffSession(null);
    setOrders([]);
    seenOrdersRef.current.clear();
    setActiveTrackingOrderId(null);
    setGpsActive(false);
    import("@/lib/staffAuth")
      .then(({ clearStaffSession }) => clearStaffSession("delivery"))
      .catch(() => {
        /* ignore */
      });
  }, []);

  /* ============================================================= */
  /* Realtime subscription                                         */
  /* ============================================================= */

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!activeBranchId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeDayOrders(
      selectedDate,
      (list) => {
        const deliveryList: DeliveryOrder[] = [];
        list.forEach((docData: any) => {
          if (
            docData.type === "delivery" ||
            docData.orderType === "delivery"
          ) {
            deliveryList.push(docData as DeliveryOrder);
          }
        });

        const newOnes = deliveryList.filter(
          (o) =>
            o.deliveryStatus !== "delivered" &&
            !seenOrdersRef.current.has(o.id) &&
            seenOrdersRef.current.size > 0
        );
        if (newOnes.length > 0) {
          playNewOrderChime();
          setNewOrderPulse(true);
          if (pulseTimeoutRef.current != null) {
            window.clearTimeout(pulseTimeoutRef.current);
          }
          pulseTimeoutRef.current = window.setTimeout(() => {
            setNewOrderPulse(false);
            pulseTimeoutRef.current = null;
          }, 2500);
        }

        deliveryList.forEach((o) => seenOrdersRef.current.add(o.id));
        if (seenOrdersRef.current.size > SEEN_ORDERS_MAX) {
          const trimmed = Array.from(seenOrdersRef.current).slice(
            -SEEN_ORDERS_MAX
          );
          seenOrdersRef.current = new Set(trimmed);
        }

        setOrders(deliveryList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Delivery orders error:", err);
        setError("Unable to load orders. Please try again.");
        setLoading(false);
      },
      activeBranchId
    );
    return () => unsubscribe();
  }, [
    isAuthenticated,
    selectedDate,
    activeBranchId,
    playNewOrderChime,
  ]);

  /* Reset seen IDs on date/branch change */
  useEffect(() => {
    seenOrdersRef.current.clear();
  }, [selectedDate, activeBranchId]);

  /* ============================================================= */
  /* GPS                                                           */
  /* ============================================================= */

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    setActiveTrackingOrderId(null);
  }, []);

  const startGpsTracking = useCallback(
    (orderId: string) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGpsError("GPS is not supported on this device/browser.");
        return;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastGpsWriteRef.current = 0;
      setActiveTrackingOrderId(orderId);
      setGpsActive(true);
      setGpsError(null);

      const rider = getRiderIdentity(staffSessionRef.current);
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setRiderCoords({ lat: latitude, lng: longitude });
          setGpsAccuracy(Math.round(accuracy));
          setGpsActive(true);
          const now = Date.now();
          if (now - lastGpsWriteRef.current >= GPS_WRITE_INTERVAL_MS) {
            lastGpsWriteRef.current = now;
            try {
              await updateDoc(doc(db, "orders", orderId), {
                deliveryStatus: "out_for_delivery",
                deliveryPersonLatitude: latitude,
                deliveryPersonLongitude: longitude,
                deliveryPersonLocation: { lat: latitude, lng: longitude, updatedAt: Timestamp.now() },
                deliveryPersonName: rider.name,
                deliveryPersonId: rider.id,
                deliveryLocationUpdatedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                updatedBy: rider.id,
              });
            } catch (err) {
              console.error("GPS update error:", err);
            }
          }
        },
        (err) => {
          setGpsActive(false);
          setGpsError(err.message || "GPS connection lost");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      watchIdRef.current = id;
    },
    []
  );

  /* ============================================================= */
  /* Order actions                                                 */
  /* ============================================================= */

  const handleStartDelivery = useCallback(
    async (order: DeliveryOrder) => {
      if (busyOrderId) return;

      const canStart =
        order.status === "ready" ||
        order.deliveryStatus === "ready" ||
        order.deliveryStatus === "pending" ||
        order.deliveryStatus === "assigned" ||
        order.status === "out_for_delivery" ||
        order.deliveryStatus === "out_for_delivery";

      if (!canStart) {
        pushToast(
          "error",
          "This order has not been marked ready by the kitchen yet."
        );
        return;
      }

      setBusyOrderId(order.id);
      const rider = getRiderIdentity(staffSessionRef.current);
      try {
        await updateDoc(doc(db, "orders", order.id), {
          status: "out_for_delivery",
          deliveryStatus: "out_for_delivery",
          deliveryPersonName: rider.name,
          deliveryPersonId: rider.id,
          updatedAt: Timestamp.now(),
          updatedBy: rider.id,
        });
        // Start GPS only after the write succeeded.
        startGpsTracking(order.id);
        pushToast("success", `Delivery started for ${order.orderNumber}.`);
      } catch (err: any) {
        console.error("Error starting delivery:", err);
        pushToast(
          "error",
          `Failed to start delivery: ${err?.message || err}`
        );
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, pushToast, startGpsTracking]
  );

  const openOtpModal = useCallback((order: DeliveryOrder) => {
    setOtpModalOrder(order);
    setEnteredOtp("");
    setOtpError("");
  }, []);

  const handleVerifyOtpAndDeliver = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otpModalOrder) return;
      setOtpError("");

      const inputOtp = enteredOtp.trim();

      // Fail closed: refuse delivery if the order has no OTP on record.
      if (!otpModalOrder.deliveryOtp) {
        setOtpError(
          "This order has no OTP on record. Please contact the dispatcher."
        );
        return;
      }
      if (!/^\d{4}$/.test(inputOtp)) {
        setOtpError("Please enter the 4-digit OTP provided by the customer.");
        return;
      }
      if (inputOtp !== otpModalOrder.deliveryOtp) {
        setOtpError(
          "❌ Incorrect OTP! Please ask the customer for their 4-digit code."
        );
        return;
      }

      setIsVerifyingOtp(true);
      const rider = getRiderIdentity(staffSessionRef.current);
      try {
        await updateDoc(doc(db, "orders", otpModalOrder.id), {
          status: "completed",
          deliveryStatus: "delivered",
          deliveredAt: Timestamp.now(),
          otpVerified: true,
          deliveredBy: rider.id,
          deliveredByName: rider.name,
          updatedAt: Timestamp.now(),
          updatedBy: rider.id,
        });

        // If this order was the one being tracked, stop GPS.
        if (activeTrackingOrderId === otpModalOrder.id) {
          stopGpsTracking();
        }
        pushToast(
          "success",
          `Order ${otpModalOrder.orderNumber} delivered successfully.`
        );
        setOtpModalOrder(null);
        setEnteredOtp("");
      } catch (err: any) {
        console.error("Error completing delivery:", err);
        setOtpError("Could not complete delivery. Please retry.");
      } finally {
        setIsVerifyingOtp(false);
      }
    },
    [
      otpModalOrder,
      enteredOtp,
      activeTrackingOrderId,
      stopGpsTracking,
      pushToast,
    ]
  );

  const openNavigationApp = useCallback(
    (lat?: number, lng?: number) => {
      if (typeof lat !== "number" || typeof lng !== "number") {
        pushToast("error", "Customer coordinates are not set.");
        return;
      }
      const originParam = riderCoords
        ? `&origin=${riderCoords.lat},${riderCoords.lng}`
        : `&origin=${settings.cafeLat},${settings.cafeLng}`;
      const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [riderCoords, settings.cafeLat, settings.cafeLng, pushToast]
  );

  /* ============================================================= */
  /* OTP modal escape                                              */
  /* ============================================================= */

  useEffect(() => {
    if (!otpModalOrder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isVerifyingOtp) {
        setOtpModalOrder(null);
        setEnteredOtp("");
        setOtpError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [otpModalOrder, isVerifyingOtp]);

  /* ============================================================= */
  /* Derived                                                       */
  /* ============================================================= */

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.deliveryStatus !== "delivered" &&
          o.status !== "cancelled" &&
          (o.status === "ready" ||
            o.deliveryStatus === "ready" ||
            o.status === "out_for_delivery" ||
            o.deliveryStatus === "out_for_delivery")
      ),
    [orders]
  );

  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.deliveryStatus === "delivered"),
    [orders]
  );

  const deliveredToday = useMemo(() => {
    const today = getISTDateString(0);
    return deliveredOrders.filter(
      (o) => getISTDateKey(o.deliveredAt) === today
    ).length;
  }, [deliveredOrders]);

  const earningsToday = useMemo(() => {
    const today = getISTDateString(0);
    return deliveredOrders
      .filter((o) => getISTDateKey(o.deliveredAt) === today)
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  }, [deliveredOrders]);

  const riderLat = riderCoords?.lat ?? settings.cafeLat;
  const riderLng = riderCoords?.lng ?? settings.cafeLng;

  const processedOrders = useMemo(() => {
    let list = [...activeOrders];

    if (filterMode === "ready") {
      list = list.filter(
        (o) =>
          (o.status === "ready" ||
            o.deliveryStatus === "ready" ||
            o.deliveryStatus === "pending" ||
            o.deliveryStatus === "assigned") &&
          o.deliveryStatus !== "out_for_delivery" &&
          o.status !== "out_for_delivery"
      );
    } else if (filterMode === "out_for_delivery") {
      list = list.filter(
        (o) =>
          o.deliveryStatus === "out_for_delivery" ||
          o.status === "out_for_delivery"
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          safeString(o.customerPhone).includes(q) ||
          safeString(o.phone).includes(q)
      );
    }

    const withDistance = list.map((o) => {
      const cLat = getOrderLat(o);
      const cLng = getOrderLng(o);
      let distance = o.deliveryDistance || 999;
      if (
        typeof cLat === "number" &&
        typeof cLng === "number"
      ) {
        distance = calcDistance(riderLat, riderLng, cLat, cLng);
      }
      return { order: o, distance };
    });

    withDistance.sort((a, b) => {
      if (sortMode === "distance") return a.distance - b.distance;
      if (sortMode === "value")
        return (b.order.total || 0) - (a.order.total || 0);
      return (
        toDate(b.order.createdAt).getTime() -
        toDate(a.order.createdAt).getTime()
      );
    });

    return withDistance;
  }, [
    activeOrders,
    filterMode,
    searchQuery,
    sortMode,
    riderLat,
    riderLng,
  ]);

  /* ============================================================= */
  /* Login gate                                                    */
  /* ============================================================= */

  if (isVerifyingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <StaffLoginForm
        panel="delivery"
        panelDisplayName="Delivery Partner & Fleet Dispatch"
        panelIcon={<Truck size={28} />}
        onSuccess={(session: unknown) => {
          const s = (session as StaffSession) || null;
          setStaffSession(s);
          setIsAuthenticated(true);
          if (s?.branchId) setActiveBranchId(s.branchId);
        }}
      />
    );
  }

  /* ============================================================= */
  /* Render                                                        */
  /* ============================================================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20 text-white">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <StaffAttendanceAction token={staffSession?.token as string | undefined} branchId={staffSession?.branchId as string | undefined} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-white/10">
              <Truck size={20} />
              {gpsActive && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-slate-950 bg-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black leading-tight sm:text-base">
                EL PRESTO Delivery
              </h1>
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-orange-400">
                Driver Portal · UCER Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider sm:flex ${
                gpsActive
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-white/5 bg-slate-800/60 text-slate-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  gpsActive ? "animate-pulse bg-emerald-400" : "bg-slate-500"
                }`}
              />
              {gpsActive ? `GPS ±${gpsAccuracy}m` : "GPS Idle"}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              aria-label={
                soundEnabled
                  ? "Mute new order alerts"
                  : "Enable new order alerts"
              }
              aria-pressed={soundEnabled}
              className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                soundEnabled
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/5 bg-slate-800 text-slate-500"
              }`}
              title={
                soundEnabled
                  ? "Mute new order alerts"
                  : "Enable new order alerts"
              }
            >
              {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4">
        {/* NEW ORDER PULSE */}
        {newOrderPulse && (
          <div
            role="status"
            className="animate-pulse rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-600/20 to-amber-600/20 px-4 py-3 text-xs font-black uppercase tracking-wider text-orange-300"
          >
            🔔 New delivery order received!
          </div>
        )}

        {/* GPS BANNER */}
        {activeTrackingOrderId && (
          <div className="relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900/60 p-4 backdrop-blur-xl">
            <span className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/40" />
                  <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-blue-200">
                    Live GPS Sharing Active
                  </p>
                  <p className="text-[11px] font-semibold text-blue-300/70">
                    Customer can see your location in real time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirm({
                    title: "Pause live GPS sharing?",
                    message:
                      "The customer will stop seeing your location until you resume.",
                    confirmLabel: "Pause GPS",
                    destructive: true,
                    onConfirm: () => stopGpsTracking(),
                  })
                }
                className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/15 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-red-300 transition hover:bg-red-500/25"
              >
                Pause GPS
              </button>
            </div>
          </div>
        )}

        {gpsError && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 p-3">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
            <p className="flex-1 text-xs font-semibold text-red-300">
              GPS Warning: {gpsError}
            </p>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              aria-label="Dismiss GPS warning"
              className="shrink-0 rounded-md p-0.5 text-red-300 transition hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatTile
            label="Active"
            value={activeOrders.length}
            icon={<Package size={16} />}
            tone="orange"
          />
          <StatTile
            label="In Transit"
            value={
              activeOrders.filter(
                (o) => o.deliveryStatus === "out_for_delivery"
              ).length
            }
            icon={<Truck size={16} />}
            tone="blue"
          />
          <StatTile
            label="Delivered Today"
            value={deliveredToday}
            icon={<CheckCircle size={16} />}
            tone="emerald"
          />
          <StatTile
            label="Earnings Today"
            value={`₹${Math.round(earningsToday)}`}
            icon={<IndianRupee size={16} />}
            tone="amber"
          />
        </div>

        {/* DATE */}
        <div className="flex items-center justify-center">
          <DateNavigator
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            orderCount={orders.length}
            isLoading={loading}
          />
        </div>

        {/* TABS */}
        <div
          role="tablist"
          aria-label="Delivery views"
          className="grid grid-cols-2 gap-1 rounded-2xl border border-white/5 bg-slate-900/60 p-1 backdrop-blur-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "active"}
            onClick={() => setActiveTab("active")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "active"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Package size={14} /> Active
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">
              {activeOrders.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "history"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CheckCircle size={14} /> Completed
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">
              {deliveredOrders.length}
            </span>
          </button>
        </div>

        {/* ACTIVE TAB */}
        {activeTab === "active" ? (
          <>
            {activeOrders.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <label htmlFor="rider-search" className="sr-only">
                    Search orders
                  </label>
                  <input
                    id="rider-search"
                    type="text"
                    placeholder="Search by order #, name, or phone…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-9 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                    {[
                      { id: "all" as const, label: "All Active" },
                      { id: "ready" as const, label: "Ready to Deliver" },
                      {
                        id: "out_for_delivery" as const,
                        label: "In Transit",
                      },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterMode(f.id)}
                        aria-pressed={filterMode === f.id}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                          filterMode === f.id
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                    <span className="px-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <ArrowUpDown size={11} className="inline" /> Sort:
                    </span>
                    {[
                      {
                        id: "distance" as const,
                        label: "Nearest",
                        icon: Route,
                      },
                      { id: "time" as const, label: "Newest", icon: Clock },
                      {
                        id: "value" as const,
                        label: "Highest ₹",
                        icon: TrendingUp,
                      },
                    ].map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSortMode(s.id)}
                          aria-pressed={sortMode === s.id}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                            sortMode === s.id
                              ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <Icon size={11} /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/40 py-20">
                <Loader2 size={32} className="animate-spin text-orange-500" />
                <p className="mt-4 text-sm font-black text-slate-400">
                  Loading deliveries…
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center rounded-3xl border border-red-500/20 bg-red-500/5 py-20">
                <AlertCircle size={32} className="text-red-400" />
                <p className="mt-4 text-sm font-black text-red-300">{error}</p>
              </div>
            ) : processedOrders.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/40 py-20">
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
                  <ShoppingBag size={36} className="text-slate-600" />
                </div>
                <p className="mt-4 text-sm font-black text-slate-400">
                  No active deliveries
                </p>
                <p className="mt-1 max-w-xs text-center text-xs font-semibold text-slate-600">
                  {searchQuery || filterMode !== "all"
                    ? "Try clearing your filters or search"
                    : "New delivery orders will appear here automatically"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {processedOrders.map(({ order, distance }) => {
                  const cLat = getOrderLat(order);
                  const cLng = getOrderLng(order);
                  const isCurrentTracking =
                    activeTrackingOrderId === order.id;
                  const fullAddress = getFullAddress(order);
                  const phoneNum = order.customerPhone || order.phone || "";
                  const elapsed = getElapsedMins(order.createdAt);
                  const isLate =
                    elapsed >= 25 &&
                    order.deliveryStatus !== "out_for_delivery";
                  const road = orderRoadStats[order.id];
                  const distanceLabel = road
                    ? `${road.distanceKm} km`
                    : distance < 900
                    ? `${distance.toFixed(1)} km`
                    : `${order.deliveryDistance || "?"} km`;
                  const etaLabel = road
                    ? `~${road.durationMinutes} min`
                    : distance < 900
                    ? `~${Math.max(3, Math.round(distance * 3))} min`
                    : "—";
                  const isMapOpen = expandedMapId === order.id;
                  const isBusy = busyOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className={`relative flex flex-col overflow-hidden rounded-3xl border backdrop-blur-xl transition ${
                        isCurrentTracking
                          ? "border-blue-500/50 bg-gradient-to-br from-blue-950/40 to-slate-900/60 ring-1 ring-blue-500/30"
                          : isLate
                          ? "border-red-500/40 bg-gradient-to-br from-red-950/30 to-slate-900/60"
                          : "border-white/5 bg-slate-900/60 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/40 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-sm font-black text-white">
                            {order.orderNumber}
                          </span>
                          <StatusBadge
                            status={order.deliveryStatus}
                            orderStatus={order.status}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isLate && (
                            <span className="flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300 ring-1 ring-red-500/40">
                              <Flame size={9} /> Late
                            </span>
                          )}
                          <span
                            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${
                              distance < 1
                                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                                : distance < 3
                                ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            <Route size={9} /> {distanceLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-black text-white">
                              <User
                                size={13}
                                className="shrink-0 text-orange-400"
                              />
                              <span className="truncate">
                                {order.customerName}
                              </span>
                            </p>
                            {phoneNum && (
                              <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-400">
                                {phoneNum}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-base font-black text-emerald-400">
                              ₹{Math.round(order.total || 0)}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] font-bold text-slate-500">
                              {elapsed}m ago
                            </p>
                          </div>
                        </div>

                        <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-slate-400">
                          <MapPin
                            size={12}
                            className="mt-0.5 shrink-0 text-orange-400"
                          />
                          <span className="line-clamp-2">{fullAddress}</span>
                        </p>

                        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/40 px-2.5 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-400">
                            <Clock size={11} /> ETA {etaLabel}
                          </div>
                          <span className="h-3 w-px bg-white/10" />
                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Package size={11} /> {order.items?.length || 0}{" "}
                            items
                          </div>
                        </div>

                        <p className="line-clamp-1 text-[11px] font-semibold text-slate-500">
                          {order.items
                            ?.map((i) => `${i.quantity}× ${i.name}`)
                            .join(" · ")}
                        </p>

                        {order.instructions && (
                          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold italic text-amber-300">
                            💬 {order.instructions}
                          </p>
                        )}

                        {isMapOpen &&
                          typeof cLat === "number" &&
                          typeof cLng === "number" && (
                            <div className="overflow-hidden rounded-2xl border border-white/10">
                              <LiveMap
                                riderLat={riderCoords?.lat}
                                riderLng={riderCoords?.lng}
                                customerLat={cLat}
                                customerLng={cLng}
                                cafeLat={settings.cafeLat}
                                cafeLng={settings.cafeLng}
                                customerName={order.customerName}
                                onRouteCalculated={(route: {
                                  distanceKm: number;
                                  durationMinutes: number;
                                }) => {
                                  setOrderRoadStats((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      distanceKm: route.distanceKm,
                                      durationMinutes:
                                        route.durationMinutes,
                                    },
                                  }));
                                }}
                                className="h-48 w-full"
                              />
                            </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/5 p-3 sm:grid-cols-4">
                        {phoneNum ? (
                          <a
                            href={`tel:${phoneNum.replace(/[^\d+]/g, "")}`}
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <Phone size={12} /> Call
                          </a>
                        ) : (
                          <span className="rounded-xl border border-white/5 bg-slate-800/40 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-600">
                            No phone
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openNavigationApp(cLat, cLng)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/20"
                        >
                          <Navigation size={12} /> Navigate
                        </button>

                        {order.deliveryStatus !== "out_for_delivery" &&
                        order.status !== "out_for_delivery" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStartDelivery(order)}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95 disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Truck size={12} />
                            )}
                            Start
                          </button>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/20 py-2 text-[10px] font-black uppercase tracking-wider text-blue-300">
                            <Compass size={12} className="animate-spin" />{" "}
                            Transit
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openOtpModal(order)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:scale-[1.03] active:scale-95"
                        >
                          <Check size={12} /> Done
                        </button>

                        {typeof cLat === "number" &&
                          typeof cLng === "number" && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMapId(
                                  isMapOpen ? null : order.id
                                )
                              }
                              className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-slate-800/60 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-slate-700/60 sm:col-span-4"
                            >
                              <Eye size={12} />
                              {isMapOpen ? "Hide Map" : "Show Route Map"}
                              <ChevronDown
                                size={12}
                                className={`transition-transform ${
                                  isMapOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* HISTORY TAB */
          <div className="space-y-3">
            {deliveredOrders.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/40 py-20">
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
                  <Award size={36} className="text-slate-600" />
                </div>
                <p className="mt-4 text-sm font-black text-slate-400">
                  No completed deliveries yet
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Delivered orders will show up here
                </p>
              </div>
            ) : (
              deliveredOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl transition hover:border-white/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">
                        {order.orderNumber}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                        ✓ Delivered
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                      👤 {order.customerName}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-slate-500">
                      {getFullAddress(order)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="font-mono text-sm font-black text-emerald-400">
                        ₹{Math.round(order.total || 0)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Earned ₹{Math.round(order.deliveryFee || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* OTP MODAL */}
      {otpModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Verify delivery OTP"
          onClick={() => {
            if (isVerifyingOtp) return;
            setOtpModalOrder(null);
            setEnteredOtp("");
            setOtpError("");
          }}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl" />

            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            <button
              type="button"
              onClick={() => {
                if (isVerifyingOtp) return;
                setOtpModalOrder(null);
                setEnteredOtp("");
                setOtpError("");
              }}
              aria-label="Close OTP modal"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-400 transition hover:text-white"
            >
              <X size={14} />
            </button>

            <div className="relative px-6 pb-6 pt-5 sm:pt-8">
              <div className="mb-5 text-center">
                <div className="relative mx-auto mb-3 w-fit">
                  <span className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/40" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-white/20">
                    <Sparkles size={26} />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">
                  Verify Delivery OTP
                </h3>
                <p className="mt-1 font-mono text-sm font-black text-orange-400">
                  {otpModalOrder.orderNumber}
                </p>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                  Ask{" "}
                  <span className="font-black text-white">
                    {otpModalOrder.customerName}
                  </span>{" "}
                  for the 4-digit confirmation code shown on their tracking
                  screen.
                </p>
              </div>

              {otpError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3"
                >
                  <AlertCircle
                    size={15}
                    className="mt-0.5 shrink-0 text-red-400"
                  />
                  <p className="text-xs font-bold text-red-300">{otpError}</p>
                </div>
              )}

              <form
                onSubmit={handleVerifyOtpAndDeliver}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="otp-input"
                    className="mb-2 block text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    4-Digit Customer Code
                  </label>
                  <input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoFocus
                    required
                    placeholder="• • • •"
                    value={enteredOtp}
                    onChange={(e) =>
                      setEnteredOtp(
                        e.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                    className="w-full rounded-2xl border-2 border-emerald-500/60 bg-slate-800/60 px-4 py-3.5 text-center font-mono text-3xl font-black tracking-[0.4em] text-emerald-400 placeholder-slate-600 shadow-inner transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 sm:text-4xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isVerifyingOtp) return;
                      setOtpModalOrder(null);
                      setEnteredOtp("");
                      setOtpError("");
                    }}
                    className="rounded-xl border border-white/5 bg-slate-800 py-3 text-sm font-black text-slate-300 transition hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp || enteredOtp.length !== 4}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Verifying…
                      </>
                    ) : (
                      <>
                        <Check size={15} /> Verify & Complete
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
