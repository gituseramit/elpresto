"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Truck,
  Navigation,
  Trophy,
  Sparkles,
  PartyPopper,
  Star,
  Zap,
  Phone,
  RefreshCw,
  ShoppingBag,
  Info,
} from "lucide-react";
import Link from "next/link";
import LiveMap from "@/components/Map/LiveMap";
import { DEFAULT_DELIVERY_SETTINGS, DeliverySettings } from "@/lib/delivery";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

/* ================================================================ */
/* Types                                                            */
/* ================================================================ */

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
}

interface DeliveryAddress {
  houseFlat?: string;
  streetArea?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  fullAddress?: string;
}

interface OrderLocation {
  lat?: number;
  lng?: number;
  address?: string;
  pincode?: string;
}

interface OrderData {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  customerPhone?: string;
  type?: string;
  orderType?: string;
  branchId?: string;
  location?: OrderLocation | string;
  orderLocation?: OrderLocation & { branchId?: string; kind?: "delivery" | "pickup" };
  deliveryAddress?: DeliveryAddress | string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryPersonLatitude?: number;
  deliveryPersonLongitude?: number;
  deliveryPersonLocation?: { lat?: number; lng?: number };
  deliveryPersonName?: string;
  deliveryStatus?: string;
  deliveryLocationUpdatedAt?: unknown;
  deliveryDistance?: number;
  items?: OrderItem[];
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  total?: number;
  status?: string;
  instructions?: string;
  createdAt?: unknown;
  deliveryOtp?: string;
}

interface Stage {
  key: string;
  label: string;
  shortLabel: string;
  emoji: string;
  gradient: string;
  ring: string;
  points: number;
}

interface RoadStats {
  distanceKm: number;
  durationMinutes: number;
}

/* ================================================================ */
/* Stage definitions                                                */
/* ================================================================ */

const DELIVERY_STAGES: Stage[] = [
  {
    key: "received",
    label: "Order Placed",
    shortLabel: "Placed",
    emoji: "📝",
    gradient: "from-blue-500 to-cyan-500",
    ring: "ring-blue-200",
    points: 10,
  },
  {
    key: "preparing",
    label: "In Kitchen",
    shortLabel: "Cooking",
    emoji: "👨‍🍳",
    gradient: "from-orange-500 to-amber-500",
    ring: "ring-orange-200",
    points: 30,
  },
  {
    key: "ready",
    label: "Ready",
    shortLabel: "Ready",
    emoji: "🍕",
    gradient: "from-amber-500 to-yellow-500",
    ring: "ring-amber-200",
    points: 50,
  },
  {
    key: "out_for_delivery",
    label: "On the Way",
    shortLabel: "On Way",
    emoji: "🛵",
    gradient: "from-purple-500 to-pink-500",
    ring: "ring-purple-200",
    points: 70,
  },
  {
    key: "delivered",
    label: "Delivered",
    shortLabel: "Done",
    emoji: "🎉",
    gradient: "from-emerald-500 to-green-500",
    ring: "ring-emerald-200",
    points: 100,
  },
];

const TAKEAWAY_STAGES: Stage[] = [
  {
    key: "received",
    label: "Order Placed",
    shortLabel: "Placed",
    emoji: "📝",
    gradient: "from-blue-500 to-cyan-500",
    ring: "ring-blue-200",
    points: 10,
  },
  {
    key: "preparing",
    label: "In Kitchen",
    shortLabel: "Cooking",
    emoji: "👨‍🍳",
    gradient: "from-orange-500 to-amber-500",
    ring: "ring-orange-200",
    points: 30,
  },
  {
    key: "ready",
    label: "Ready",
    shortLabel: "Ready",
    emoji: "🍕",
    gradient: "from-amber-500 to-yellow-500",
    ring: "ring-amber-200",
    points: 50,
  },
  {
    key: "completed",
    label: "Picked Up",
    shortLabel: "Done",
    emoji: "🎉",
    gradient: "from-emerald-500 to-green-500",
    ring: "ring-emerald-200",
    points: 100,
  },
];

/* ================================================================ */
/* Helpers                                                          */
/* ================================================================ */

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

function formatISTTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  try {
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleTimeString();
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isDeliveryOrder(order: OrderData | null): boolean {
  if (!order) return false;
  return order.type === "delivery" || order.orderType === "delivery";
}

function getCustomerLat(order: OrderData | null): number | undefined {
  if (!order) return undefined;
  if (typeof order.deliveryLatitude === "number") return order.deliveryLatitude;
  const loc = order.location;
  if (loc && typeof loc === "object" && typeof loc.lat === "number") {
    return loc.lat;
  }
  if (typeof order.orderLocation?.lat === "number") return order.orderLocation.lat;
  return undefined;
}

function getCustomerLng(order: OrderData | null): number | undefined {
  if (!order) return undefined;
  if (typeof order.deliveryLongitude === "number") return order.deliveryLongitude;
  const loc = order.location;
  if (loc && typeof loc === "object" && typeof loc.lng === "number") {
    return loc.lng;
  }
  if (typeof order.orderLocation?.lng === "number") return order.orderLocation.lng;
  return undefined;
}

function getFullAddress(order: OrderData | null): string {
  if (!order) return "";
  if (typeof order.deliveryAddress === "string") return order.deliveryAddress;
  if (order.deliveryAddress?.fullAddress) {
    return order.deliveryAddress.fullAddress;
  }
  const loc = order.location;
  if (typeof loc === "string") return loc;
  if (loc && typeof loc === "object" && typeof loc.address === "string") {
    return loc.address;
  }
  return "";
}

function deriveStageKey(order: OrderData | null): string {
  if (!order) return "received";
  const delivery = isDeliveryOrder(order);
  const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
  const status = String(order.status || "").toLowerCase();

  if (delivery) {
    if (deliveryStatus === "delivered") return "delivered";
    if (deliveryStatus === "out_for_delivery" || status === "out_for_delivery") {
      return "out_for_delivery";
    }
    if (deliveryStatus === "assigned") return "ready";
    if (status === "ready" || deliveryStatus === "ready") return "ready";
    if (status === "preparing") return "preparing";
    return "received";
  }

  if (status === "completed") return "completed";
  if (status === "ready") return "ready";
  if (status === "preparing") return "preparing";
  return "received";
}

/* ================================================================ */
/* Reduced motion hook                                              */
/* ================================================================ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ================================================================ */
/* Gamified tracker                                                 */
/* ================================================================ */

function GamifiedTracker({
  currentStage,
  isDelivery,
  reducedMotion,
}: {
  currentStage: string;
  isDelivery: boolean;
  reducedMotion: boolean;
}) {
  const stages = isDelivery ? DELIVERY_STAGES : TAKEAWAY_STAGES;
  const total = stages.length;

  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.key === currentStage)
  );

  const inset = 50 / total;
  const span = 100 - inset * 2;
  const fillWidth = total > 1 ? (currentIndex / (total - 1)) * span : 0;

  const earnedXP = stages
    .slice(0, currentIndex + 1)
    .reduce((sum, s) => sum + s.points, 0);
  const maxXP = stages.reduce((sum, s) => sum + s.points, 0);
  const percent = Math.round((earnedXP / maxXP) * 100);
  const isFinalStage =
    currentStage === "delivered" || currentStage === "completed";

  return (
    <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.25)] backdrop-blur-2xl md:p-7">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md shadow-orange-500/30 ring-1 ring-white/60"
          >
            <Trophy size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight text-gray-900">
              Order Journey
            </p>
            <p className="truncate text-[10px] font-black uppercase tracking-wider text-amber-600">
              {earnedXP} / {maxXP} XP earned
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            Progress
          </p>
          <p className="bg-gradient-to-r from-orange-500 to-emerald-500 bg-clip-text text-xl font-black leading-none text-transparent">
            {percent}%
          </p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Order progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-8 h-2.5 overflow-hidden rounded-full bg-gray-200/80 ring-1 ring-white/60"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-500 transition-all duration-1000 ease-out ${
            reducedMotion ? "" : "shadow-[0_0_12px_rgba(251,146,60,0.55)]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-gray-200 md:top-6"
          style={{ left: `${inset}%`, right: `${inset}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all duration-1000 ease-out md:top-6"
          style={{ left: `${inset}%`, width: `${fillWidth}%` }}
        />

        <div className="relative flex justify-between">
          {stages.map((stage, i) => {
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            const isUnlocked = i <= currentIndex;

            return (
              <div
                key={stage.key}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <div className="relative">
                  {isActive && !isFinalStage && !reducedMotion && (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 animate-ping rounded-full bg-gradient-to-br ${stage.gradient} opacity-40`}
                    />
                  )}
                  <div
                    className={`relative grid h-10 w-10 place-items-center rounded-full border-4 border-white text-lg shadow-lg transition-all duration-500 md:h-12 md:w-12 md:text-xl ${
                      isDone
                        ? `bg-gradient-to-br ${stage.gradient}`
                        : isActive
                        ? `scale-110 bg-gradient-to-br ${stage.gradient} ring-4 ${stage.ring}`
                        : "bg-gray-200 opacity-60 grayscale"
                    }`}
                  >
                    <span aria-hidden="true">{stage.emoji}</span>
                    {isDone && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-emerald-600 shadow-sm md:h-5 md:w-5"
                      >
                        <Check size={10} strokeWidth={4} />
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`mt-2 truncate text-center text-[10px] font-black leading-tight md:text-xs ${
                    isUnlocked ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  <span className="hidden sm:inline">{stage.label}</span>
                  <span className="sm:hidden">{stage.shortLabel}</span>
                </span>

                {(isDone || isActive) && (
                  <span
                    className={`mt-0.5 flex items-center gap-0.5 text-[9px] font-black ${
                      isDone ? "text-emerald-600" : "text-orange-500"
                    }`}
                  >
                    <Zap size={9} fill="currentColor" aria-hidden="true" />
                    +{stage.points}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {currentIndex < total - 1 && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-4 py-2.5">
          <Sparkles
            size={15}
            className="shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <p className="text-xs font-bold text-amber-800">
            Next milestone:{" "}
            <span className="text-orange-600">
              {stages[currentIndex + 1].label}
            </span>{" "}
            · +{stages[currentIndex + 1].points} XP
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* Stat card                                                        */
/* ================================================================ */

function StatCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "blue" | "orange" | "emerald" | "purple";
}) {
  const tones: Record<string, string> = {
    blue: "from-blue-500 to-cyan-500 shadow-blue-500/25",
    orange: "from-orange-500 to-amber-500 shadow-orange-500/25",
    emerald: "from-emerald-500 to-green-500 shadow-emerald-500/25",
    purple: "from-purple-500 to-pink-500 shadow-purple-500/25",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 p-3.5 backdrop-blur-md">
      <div
        aria-hidden="true"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-white/50 ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <p className="truncate text-base font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/* ================================================================ */
/* Page                                                            */
/* ================================================================ */

export default function TrackOrderPage() {
  const { user, loading: authLoading } = useAuth();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRoadStats, setLiveRoadStats] = useState<RoadStats | null>(null);
  const [settings, setSettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS
  );
  const [lastStatusKey, setLastStatusKey] = useState<string>("");
  const [statusChangePulse, setStatusChangePulse] = useState(false);
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [phoneVerifiedOrderId, setPhoneVerifiedOrderId] = useState<string | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const statusAnnounceRef = useRef<HTMLParagraphElement>(null);
  const statusPulseTimerRef = useRef<number | null>(null);

  const lookupOrder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupBusy(true);
    setLookupError("");
    try {
      const response = await fetch("/api/order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: lookupOrderNumber, phone: lookupPhone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order not found.");
      window.localStorage.setItem("activeOrderId", result.orderId);
      setPhoneVerifiedOrderId(result.orderId);
      setOrderData(null);
      setOrderId(result.orderId);
      setLoading(true);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Order lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }, [lookupOrderNumber, lookupPhone]);

  /* Load order id from storage */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("activeOrderId");
      setOrderId(saved || null);
    } catch (err) {
      console.warn("Could not read activeOrderId:", err);
      setOrderId(null);
    }
  }, []);

  /* Settings */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "general"));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            cafeName: data.cafeName || DEFAULT_DELIVERY_SETTINGS.cafeName,
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
              data.deliveryEnabled !== undefined ? data.deliveryEnabled : true,
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

  useEffect(() => {
    if (!orderData?.branchId) return;
    return onSnapshot(doc(db, "branches", orderData.branchId), (snapshot) => {
      const branch = snapshot.data();
      if (!branch || !Number.isFinite(branch.lat) || !Number.isFinite(branch.lng)) return;
      setSettings((previous) => ({ ...previous, cafeName: branch.name || previous.cafeName, cafeLat: branch.lat, cafeLng: branch.lng }));
    });
  }, [orderData?.branchId]);

  /* Realtime listener */
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    if (authLoading) return;

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, "orders", orderId),
      (snap) => {
        if (!snap.exists()) {
          setOrderData(null);
          setError(null);
          setLoading(false);
          try {
            window.localStorage.removeItem("activeOrderId");
          } catch {
            /* ignore */
          }
          setOrderId(null);
          return;
        }
        const raw = snap.data() as Omit<OrderData, "id">;
        const data: OrderData = { id: snap.id, ...raw };

        // Ownership check — orders with customerId must match the current user.
        if (
          data.customerId &&
          user?.uid &&
          data.customerId !== user.uid && data.id !== phoneVerifiedOrderId
        ) {
          setOrderData(null);
          setError(
            "This order does not belong to your account. Please sign in with the correct account."
          );
          setLoading(false);
          return;
        }

        setOrderData(data);
        setLoading(false);

        // Clear activeOrderId if the order is finished.
        if (
          data.deliveryStatus === "delivered" ||
          data.status === "completed"
        ) {
          try {
            window.localStorage.removeItem("activeOrderId");
          } catch {
            /* ignore */
          }
        }
      },
      (err) => {
        console.error("Tracking listener error:", err);
        setError("Unable to load order tracking. Please retry.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId, user?.uid, authLoading, phoneVerifiedOrderId]);

  /* Derived stage */
  const derivedStage = useMemo(() => deriveStageKey(orderData), [orderData]);

  /* Status change pulse + announcement */
  useEffect(() => {
    if (!derivedStage) return;
    if (derivedStage === lastStatusKey) return;
    if (lastStatusKey !== "") {
      setStatusChangePulse(true);
      if (statusPulseTimerRef.current != null) {
        window.clearTimeout(statusPulseTimerRef.current);
      }
      statusPulseTimerRef.current = window.setTimeout(() => {
        setStatusChangePulse(false);
        statusPulseTimerRef.current = null;
      }, 2500);
    }
    setLastStatusKey(derivedStage);
  }, [derivedStage, lastStatusKey]);

  useEffect(() => {
    return () => {
      if (statusPulseTimerRef.current != null) {
        window.clearTimeout(statusPulseTimerRef.current);
      }
    };
  }, []);

  /* Retry handler */
  const handleRetry = useCallback(() => {
    if (!orderId) return;
    setError(null);
    setLoading(true);
    // Re-read by re-setting orderId via storage
    try {
      const saved = window.localStorage.getItem("activeOrderId");
      setOrderId(saved || null);
    } catch {
      /* ignore */
    }
  }, [orderId]);

  /* ================================================================ */
  /* Loading                                                          */
  /* ================================================================ */

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-b-orange-500" />
          <p className="text-xs font-black uppercase tracking-widest text-orange-500">
            Loading tracker…
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* Error                                                            */
  /* ================================================================ */

  if (error && !orderData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40 px-4 py-8">
        <div className="container mx-auto max-w-md">
          <div className="rounded-3xl border border-red-200 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mb-6 flex justify-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-red-50">
                <AlertCircle
                  size={40}
                  className="text-red-500"
                  aria-hidden="true"
                />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-black text-gray-900">
              Unable to Load Order
            </h2>
            <p className="mb-6 text-sm text-gray-600">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleRetry}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                <RefreshCw size={15} aria-hidden="true" /> Retry
              </button>
              <Link
                href="/menu"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 py-3.5 text-sm font-black text-gray-700 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-95"
              >
                Back to Menu
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* No active order                                                  */
  /* ================================================================ */

  if (!orderData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40 px-4 py-8">
        <div className="container mx-auto max-w-md">
          <div className="rounded-3xl border border-white/50 bg-white/55 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mb-6 flex justify-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-inner">
                <Search
                  size={40}
                  className="text-orange-400"
                  aria-hidden="true"
                />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-black text-gray-900">
              No Active Orders
            </h2>
            <p className="mb-8 text-sm text-gray-600">
              Look up an order from any device using its number and checkout phone.
            </p>
            <form onSubmit={lookupOrder} className="mb-5 space-y-3 text-left">
              <label className="block text-xs font-bold text-gray-700">Order number<input autoComplete="off" required value={lookupOrderNumber} onChange={(event) => setLookupOrderNumber(event.target.value)} placeholder="e.g. #ELP-AB12CD" className="mt-1 w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-3 text-sm text-gray-900 outline-none focus:border-orange-400" /></label>
              <label className="block text-xs font-bold text-gray-700">Phone used at checkout<input autoComplete="tel" inputMode="tel" required value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder="10 digit phone number" className="mt-1 w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-3 text-sm text-gray-900 outline-none focus:border-orange-400" /></label>
              {lookupError && <p role="alert" className="text-xs font-semibold text-red-600">{lookupError}</p>}
              <button disabled={lookupBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-black text-white disabled:opacity-60">{lookupBusy ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />} Track order</button>
            </form>
            <div className="flex flex-col gap-3">
              <Link
                href="/menu"
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-orange-500/50 active:scale-95"
              >
                <ShoppingBag size={15} aria-hidden="true" /> Explore Menu
              </Link>
              <Link
                href="/profile#orders"
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 py-3.5 text-sm font-black text-gray-700 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-95"
              >
                View Past Orders
              </Link>
              <a
                href="tel:+916392512314"
                className="text-center text-xs font-semibold text-gray-500 underline decoration-gray-300 underline-offset-4 transition hover:text-[#D92312]"
              >
                Need help finding an order? Call +91 63925 12314
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* Shared header                                                    */
  /* ================================================================ */

  const BackLink = (
    <Link
      href="/menu"
      className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-2 text-sm font-bold text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <ArrowLeft size={16} aria-hidden="true" /> Back to Menu
    </Link>
  );

  const orderNumberLabel = orderData.orderNumber || orderData.id.slice(0, 8);
  const delivery = isDeliveryOrder(orderData);
  const stageKey = derivedStage;
  const isDeliveredOrCompleted =
    stageKey === "delivered" || stageKey === "completed";

  /* ================================================================ */
  /* DELIVERY VIEW                                                    */
  /* ================================================================ */

  if (delivery) {
    const isDelivered = stageKey === "delivered";
    const isOutForDelivery = stageKey === "out_for_delivery";
    const isReady = stageKey === "ready";
    const isPreparing = stageKey === "preparing";

    const customerLat = getCustomerLat(orderData);
    const customerLng = getCustomerLng(orderData);
    const riderLat = orderData.deliveryPersonLatitude ?? orderData.deliveryPersonLocation?.lat;
    const riderLng = orderData.deliveryPersonLongitude ?? orderData.deliveryPersonLocation?.lng;

    const fullAddress = getFullAddress(orderData) || "Delivery Address";

    const heroEmoji = isDelivered
      ? "🎉"
      : isOutForDelivery
      ? "🛵"
      : isReady
      ? "🍕"
      : isPreparing
      ? "👨‍🍳"
      : "📝";

    const heroTitle = isDelivered
      ? "Order Delivered!"
      : isOutForDelivery
      ? "Rider is on the way"
      : isReady
      ? "Fresh out of the oven"
      : isPreparing
      ? "Cooking your order"
      : "Order received";

    const badgeText = isDelivered
      ? "Delivered"
      : isOutForDelivery
      ? "Out for Delivery"
      : isReady
      ? "Ready for pickup"
      : isPreparing
      ? "Preparing at Kitchen"
      : "Order Placed";

    const badgeClass = isDelivered
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : isOutForDelivery
      ? "bg-blue-100 text-blue-700 ring-blue-200"
      : isReady
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : isPreparing
      ? "bg-orange-100 text-orange-700 ring-orange-200"
      : "bg-blue-100 text-blue-700 ring-blue-200";

    const etaText = isDelivered
      ? "Done"
      : liveRoadStats?.durationMinutes
      ? `~${liveRoadStats.durationMinutes} min`
      : "Calculating…";

    const distanceKm =
      typeof liveRoadStats?.distanceKm === "number"
        ? liveRoadStats.distanceKm
        : typeof orderData.deliveryDistance === "number"
        ? orderData.deliveryDistance
        : null;

    const distanceText = distanceKm !== null ? `${distanceKm} km` : "—";

    const totalNumber = safeNumber(orderData.total);
    const totalText = `₹${Math.round(totalNumber).toLocaleString("en-IN")}`;

    const mapReady =
      typeof customerLat === "number" && typeof customerLng === "number";

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
        <div className="container mx-auto max-w-4xl">
          {BackLink}

          <div className="space-y-5 sm:space-y-6">
            {/* HERO */}
            <div
              className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.3)] backdrop-blur-2xl transition sm:p-7 ${
                statusChangePulse && !reducedMotion
                  ? "ring-4 ring-orange-300/60"
                  : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl"
              />

              <div className="relative flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-lg shadow-orange-500/30 ring-1 ring-white/60"
                    >
                      {heroEmoji}
                    </div>
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-black leading-tight text-gray-900 sm:text-2xl">
                        {heroTitle}
                      </h1>
                      <p className="truncate text-xs font-bold text-gray-500">
                        Order{" "}
                        <span className="font-mono text-gray-800">
                          #{orderNumberLabel}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      aria-live="polite"
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ring-2 sm:text-xs ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                    {isOutForDelivery && !isDelivered && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-600 ring-2 ring-red-200 sm:text-xs">
                        <span
                          aria-hidden="true"
                          className="relative flex h-2 w-2"
                        >
                          {!reducedMotion && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          )}
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        Live GPS
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="ETA"
                    value={etaText}
                    icon={<Navigation size={16} />}
                    tone="blue"
                  />
                  <StatCard
                    label="Distance"
                    value={distanceText}
                    icon={<MapPin size={16} />}
                    tone="orange"
                  />
                  <StatCard
                    label="Order Total"
                    value={totalText}
                    icon={<Star size={16} />}
                    tone="emerald"
                  />
                </div>
              </div>
            </div>

            {/* GAMIFIED TRACKER */}
            <GamifiedTracker
              currentStage={stageKey}
              isDelivery
              reducedMotion={reducedMotion}
            />

            {/* MAP */}
            {mapReady ? (
              <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                <LiveMap
                  riderLat={riderLat}
                  riderLng={riderLng}
                  customerLat={customerLat}
                  customerLng={customerLng}
                  cafeLat={settings.cafeLat}
                  cafeLng={settings.cafeLng}
                  customerName={orderData.customerName}
                  onRouteCalculated={setLiveRoadStats}
                  className="h-[300px] w-full sm:h-[380px] md:h-[420px]"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 backdrop-blur-md">
                <AlertCircle
                  size={18}
                  className="shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <p className="text-xs font-bold text-amber-800">
                  Delivery location is not available for this order. Live map
                  will appear once the rider shares their position.
                </p>
              </div>
            )}

            {/* OTP */}
            {orderData.deliveryOtp && !isDelivered && (
              <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-4 shadow-lg backdrop-blur-md sm:p-5">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl"
                />
                <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span aria-hidden="true" className="text-xl">
                        🔑
                      </span>
                      <p className="text-sm font-black text-emerald-950 sm:text-base">
                        Delivery OTP
                      </p>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                        Required
                      </span>
                    </div>
                    <p className="max-w-md text-xs font-semibold text-emerald-800/80">
                      Share this 4-digit code with the delivery partner to
                      receive your order.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl border-2 border-emerald-400 bg-white/95 px-6 py-3 shadow-md">
                    <span className="select-all font-mono text-3xl font-black tracking-[0.3em] text-emerald-700 sm:text-4xl">
                      {orderData.deliveryOtp}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* RIDER + ADDRESS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-md backdrop-blur-xl">
                <div
                  aria-hidden="true"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 text-2xl ring-1 ring-white/60"
                >
                  🛵
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-900">
                    {orderData.deliveryPersonName || "Delivery Partner"}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] font-semibold text-gray-500">
                    <Truck size={12} aria-hidden="true" />
                    {orderData.deliveryPersonName
                      ? "Assigned Rider"
                      : "Awaiting assignment"}
                  </p>
                  {Boolean(orderData.deliveryLocationUpdatedAt) && (
                    <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                      GPS updated:{" "}
                      {formatISTTime(orderData.deliveryLocationUpdatedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-md backdrop-blur-xl">
                <div
                  aria-hidden="true"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 ring-1 ring-white/60"
                >
                  <MapPin size={20} className="text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">
                    Delivery Address
                  </p>
                  <p className="mt-0.5 text-xs font-semibold leading-snug text-gray-600">
                    {fullAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* CUSTOMER INSTRUCTIONS */}
            {orderData.instructions && (
              <div className="flex items-start gap-3 rounded-3xl border border-blue-200 bg-blue-50/70 p-4 shadow-md backdrop-blur-md">
                <Info
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-500"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                    Your Instructions
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-blue-900">
                    {orderData.instructions}
                  </p>
                </div>
              </div>
            )}

            {/* DELIVERED CELEBRATION */}
            {isDelivered && (
              <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 p-6 text-center shadow-lg">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl"
                />
                <div className="relative flex flex-col items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-white"
                  >
                    <PartyPopper size={30} />
                  </div>
                  <h3 className="text-lg font-black text-emerald-950">
                    Order Delivered!
                  </h3>
                  <p className="max-w-md text-sm font-semibold text-emerald-800/80">
                    You earned{" "}
                    <span className="font-black text-emerald-600">
                      +100 XP
                    </span>{" "}
                    · Thanks for ordering with EL PRESTO!
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <Link
                      href="/menu"
                      className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                    >
                      Order Again
                    </Link>
                    <Link
                      href="/profile#orders"
                      className="rounded-xl border border-white/60 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-700 shadow-sm transition hover:bg-white"
                    >
                      Rate & Review
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ORDER ITEMS */}
            <details className="group rounded-3xl border border-white/60 bg-white/45 p-5 shadow-md backdrop-blur-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">📋</span> View Order Items
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-600">
                    {orderData.items?.length || 0}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-xs font-bold text-gray-400 transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="mt-4 space-y-2 border-t border-white/60 pt-4">
                {(orderData.items || []).map((item, idx) => (
                  <div
                    key={`${item.id || item.name}-${idx}`}
                    className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-xs"
                  >
                    <span className="truncate pr-2 font-semibold text-gray-700">
                      <span className="mr-1.5 font-black text-orange-600">
                        {item.quantity}×
                      </span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-black text-gray-900">
                      ₹
                      {Math.round(
                        safeNumber(item.price) * item.quantity
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-white/60 pt-3">
                  <span className="text-sm font-black text-gray-800">
                    Total
                  </span>
                  <span className="text-lg font-black text-orange-600">
                    {totalText}
                  </span>
                </div>
              </div>
            </details>

            {/* SUPPORT */}
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] font-bold text-gray-500">
              <span>Need help?</span>
              <a
                href="tel:+919999999999"
                className="flex items-center gap-1 text-orange-600 hover:underline"
              >
                <Phone size={11} aria-hidden="true" /> Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Screen reader status announcements */}
        <p
          ref={statusAnnounceRef}
          aria-live="polite"
          className="sr-only"
        >
          {badgeText}
        </p>
      </div>
    );
  }

  /* ================================================================ */
  /* TAKEAWAY VIEW                                                    */
  /* ================================================================ */

  const liveStatus = stageKey;
  const isCompleted = liveStatus === "completed";
  const isReady = liveStatus === "ready";
  const isPreparing = liveStatus === "preparing";

  const takeawayEmoji = isCompleted ? "🎉" : isReady ? "🍕" : "👨‍🍳";
  const takeawayTitle = isCompleted
    ? "Order Picked Up!"
    : isReady
    ? "Ready for Pickup!"
    : "We're cooking your order";

  const takeawayBadgeText = isCompleted
    ? "Picked Up"
    : isReady
    ? "Ready"
    : isPreparing
    ? "Preparing"
    : "Order Placed";

  const takeawayBadgeClass = isCompleted
    ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
    : isReady
    ? "bg-amber-100 text-amber-700 ring-amber-200"
    : isPreparing
    ? "bg-orange-100 text-orange-700 ring-orange-200"
    : "bg-blue-100 text-blue-700 ring-blue-200";

  const totalText = `₹${Math.round(safeNumber(orderData.total)).toLocaleString(
    "en-IN"
  )}`;
  const pickupLat = getCustomerLat(orderData) ?? settings.cafeLat;
  const pickupLng = getCustomerLng(orderData) ?? settings.cafeLng;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
      <div className="container mx-auto max-w-2xl">
        {BackLink}

        <div className="space-y-5 sm:space-y-6">
          {/* HERO */}
          <div
            className={`relative overflow-hidden rounded-3xl border border-white/60 bg-white/55 p-5 text-center shadow-[0_15px_50px_-15px_rgba(217,35,18,0.3)] backdrop-blur-2xl transition sm:p-7 ${
              statusChangePulse && !reducedMotion
                ? "ring-4 ring-orange-300/60"
                : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl"
            />
            <div className="relative flex flex-col items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-3xl shadow-lg shadow-orange-500/30 ring-1 ring-white/60"
              >
                {takeawayEmoji}
              </div>
              <h1 className="text-2xl font-black leading-tight text-gray-900 sm:text-3xl">
                {takeawayTitle}
              </h1>
              <p className="text-xs font-bold text-gray-500">
                Pickup at Counter • UCER Campus
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-white/60 bg-white/70 px-4 py-1.5 font-mono text-sm font-black tracking-wider text-gray-900 shadow-sm">
                  #{orderNumberLabel}
                </span>
                <span
                  aria-live="polite"
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ring-2 ${takeawayBadgeClass}`}
                >
                  {takeawayBadgeText}
                </span>
              </div>
            </div>
          </div>

          {/* TRACKER */}
          <GamifiedTracker
            currentStage={stageKey}
            isDelivery={false}
            reducedMotion={reducedMotion}
          />

          {typeof pickupLat === "number" && typeof pickupLng === "number" && <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/50 shadow-lg backdrop-blur-xl"><div className="border-b border-white/60 px-4 py-3"><p className="text-xs font-black text-gray-800">{orderData.orderLocation?.kind === "pickup" ? "Pickup outlet location" : "Order location"}</p><p className="mt-0.5 text-[10px] font-semibold text-gray-500">{orderData.orderLocation?.address || getFullAddress(orderData)}</p></div><LiveMap riderLat={pickupLat} riderLng={pickupLng} customerLat={pickupLat} customerLng={pickupLng} cafeLat={pickupLat} cafeLng={pickupLng} customerName={orderData.orderLocation?.kind === "pickup" ? "Pickup outlet" : orderData.customerName} className="h-[260px] w-full" showHud={false} /></section>}

          {/* STATUS MESSAGES */}
          {isReady && (
            <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-orange-50/80 p-4 shadow-md backdrop-blur-md">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <p className="text-sm font-bold text-amber-900">
                Your order is hot and ready at the counter! Show your order
                number to collect it. 🔥
              </p>
            </div>
          )}

          {isCompleted && (
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 p-6 text-center shadow-lg">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl"
              />
              <div className="relative flex flex-col items-center gap-3">
                <div
                  aria-hidden="true"
                  className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-white"
                >
                  <CheckCircle2 size={30} />
                </div>
                <h3 className="text-lg font-black text-emerald-950">
                  Order Picked Up!
                </h3>
                <p className="max-w-md text-sm font-semibold text-emerald-800/80">
                  You earned{" "}
                  <span className="font-black text-emerald-600">+100 XP</span>{" "}
                  · Thank you for dining with EL PRESTO!
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/menu"
                    className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                  >
                    Order Again
                  </Link>
                  <Link
                    href="/profile#orders"
                    className="rounded-xl border border-white/60 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-700 shadow-sm transition hover:bg-white"
                  >
                    Rate & Review
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* INSTRUCTIONS */}
          {orderData.instructions && (
            <div className="flex items-start gap-3 rounded-3xl border border-blue-200 bg-blue-50/70 p-4 shadow-md backdrop-blur-md">
              <Info
                size={18}
                className="mt-0.5 shrink-0 text-blue-500"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                  Your Instructions
                </p>
                <p className="mt-0.5 text-sm font-semibold text-blue-900">
                  {orderData.instructions}
                </p>
              </div>
            </div>
          )}

          {/* ORDER SUMMARY */}
          <div className="rounded-3xl border border-white/60 bg-white/50 p-5 shadow-md backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-gray-900">
                <span aria-hidden="true">🧾</span> Order Summary
              </h3>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-black text-orange-600">
                {orderData.items?.length || 0} items
              </span>
            </div>
            {orderData.items && orderData.items.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {orderData.items.map((item, idx) => (
                  <div
                    key={`${item.id || item.name}-${idx}`}
                    className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-black text-orange-600">
                        {item.quantity}×
                      </span>
                      <span className="truncate font-semibold text-gray-700">
                        {item.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-black text-gray-900">
                      ₹
                      {Math.round(
                        safeNumber(item.price) * item.quantity
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs font-semibold text-gray-400">
                No items in this order.
              </p>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-white/70 pt-4">
              <span className="text-sm font-black text-gray-800">Total</span>
              <span className="text-xl font-black text-orange-600">
                {totalText}
              </span>
            </div>
          </div>

          {/* SUPPORT */}
          <div className="flex items-center justify-center gap-2 pt-1 text-[11px] font-bold text-gray-500">
            <span>Need help?</span>
            <a
              href="tel:+919999999999"
              className="flex items-center gap-1 text-orange-600 hover:underline"
            >
              <Phone size={11} aria-hidden="true" /> Contact Support
            </a>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {takeawayBadgeText}
      </p>
    </div>
  );
}
