"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
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
  PartyPopper,
  Phone,
  RefreshCw,
  ShoppingBag,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LiveMap from "@/components/Map/LiveMap";
import { DEFAULT_DELIVERY_SETTINGS, DeliverySettings } from "@/lib/delivery";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { announceActiveOrderChanged } from "@/lib/activeOrderEvents";
import { getOrderStatus, isActiveOrder, type OrderStatusEvent } from "@/lib/orderStatus";

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
  statusHistory?: OrderStatusEvent[];
  updatedAt?: unknown;
  deliveryLocationUpdatedAt?: unknown;
  deliveryDistance?: number;
  items?: OrderItem[];
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
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

function formatArrivalWindow(durationMinutes: number): string {
  const format = (offset: number) =>
    new Date(Date.now() + Math.max(0, offset) * 60_000).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${format(durationMinutes - 3)}–${format(durationMinutes + 3)}`;
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
  const status = getOrderStatus(order);

  if (status === "cancelled" || status === "rejected") return status;

  if (delivery) {
    if (status === "delivered" || status === "completed") return "delivered";
    if (status === "out_for_delivery") return "out_for_delivery";
    if (status === "assigned" || status === "ready") return "ready";
    if (status === "preparing") return "preparing";
    return "received";
  }

  if (status === "completed" || status === "delivered") return "completed";
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

function OrderProgress({
  currentStage,
  isDelivery,
}: {
  currentStage: string;
  isDelivery: boolean;
}) {
  const stages = isDelivery ? DELIVERY_STAGES : TAKEAWAY_STAGES;
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.key === currentStage));
  const inset = 50 / stages.length;
  const trackWidth = 100 - inset * 2;
  const progress = stages.length > 1 ? (currentIndex / (stages.length - 1)) * trackWidth : 0;

  return (
    <section aria-label="Order progress" className="rounded-2xl bg-white p-4 dark:bg-slate-900 sm:p-5">
      <div className="relative">
        <div aria-hidden="true" className="absolute top-4 h-1 rounded-full bg-stone-100 dark:bg-slate-700" style={{ left: `${inset}%`, right: `${inset}%` }} />
        <div aria-hidden="true" className="absolute top-4 h-1 rounded-full bg-lime-500 transition-all duration-700 motion-reduce:transition-none" style={{ left: `${inset}%`, width: `${progress}%` }} />
        <ol className="relative flex justify-between">
          {stages.map((stage, index) => {
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex;
            return (
              <li key={stage.key} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm ring-4 ring-white dark:ring-slate-900 ${isCurrent || isDone ? "bg-lime-400 text-stone-950" : "bg-stone-100 text-stone-400 dark:bg-slate-700 dark:text-slate-400"}`}>
                  {isDone ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{stage.emoji}</span>}
                </span>
                <span className={`mt-2 text-[9px] font-extrabold leading-tight sm:text-xs ${isCurrent ? "text-stone-900 dark:text-white" : isDone ? "text-stone-600 dark:text-slate-300" : "text-stone-400 dark:text-slate-500"}`}>
                  <span className="sm:hidden">{stage.shortLabel}</span>
                  <span className="hidden sm:inline">{stage.label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  preparing: "Preparing in the kitchen",
  ready: "Ready",
  assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  completed: "Picked up",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

function OrderStatusHistory({
  history,
  currentStatus,
  createdAt,
  updatedAt,
}: {
  history?: OrderStatusEvent[];
  currentStatus: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  const events = history?.length
    ? history.slice(-8).reverse()
    : currentStatus
    ? [{ status: currentStatus as OrderStatusEvent["status"], at: updatedAt || createdAt, by: "" }]
    : [];

  return (
    <section
      aria-label="Order status timeline"
      className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-md backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800 sm:p-6"
    >
      <h3 className="text-sm font-black text-gray-900 dark:text-white">Live status timeline</h3>
      {events.length ? (
        <ol className="mt-4 space-y-3">
          {events.map((event, index) => {
            const at = toDate(event.at);
            const status = String(event.status || "pending").toLowerCase();
            return (
              <li key={`${status}-${at?.getTime() || index}-${index}`} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? "bg-orange-500 ring-4 ring-orange-100" : "bg-emerald-500"}`}
                />
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-100">
                    {ORDER_STATUS_LABELS[status] || status.replace(/_/g, " ")}
                    {event.byName ? <span className="font-medium text-gray-500 dark:text-slate-400"> · {event.byName}</span> : null}
                  </span>
                  <time className="shrink-0 text-[10px] font-semibold text-gray-500 dark:text-slate-400">
                    {at ? `${at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${formatISTTime(at)}` : "Time unavailable"}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-2 text-xs font-medium text-gray-500 dark:text-slate-400">
          Status updates will appear here as your order progresses.
        </p>
      )}
    </section>
  );
}

/* ================================================================ */
/* Page                                                            */
/* ================================================================ */

export default function TrackOrderPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<OrderData[]>([]);
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(true);
  const [activeOrdersError, setActiveOrdersError] = useState("");
  const [activeOrdersRetryKey, setActiveOrdersRetryKey] = useState(0);
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
  const requestedOrderIdRef = useRef<string | null>(null);
  const manualOrderSelectionRef = useRef(false);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

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
      announceActiveOrderChanged();
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

  /* Resolve direct links first, then restore guest tracking from this device. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const requestedOrderId = new URLSearchParams(window.location.search).get("orderId");
      requestedOrderIdRef.current = requestedOrderId;
      if (requestedOrderId) {
        setOrderId(requestedOrderId);
        return;
      }
      const saved = window.localStorage.getItem("activeOrderId");
      setOrderId(saved || null);
    } catch (err) {
      console.warn("Could not read activeOrderId:", err);
      setOrderId(null);
    }
  }, []);

  /* The account's active order list works on every signed-in device. */
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setActiveOrders([]);
      setActiveOrdersLoading(false);
      return;
    }

    setActiveOrdersLoading(true);
    setActiveOrdersError("");
    const accountOrdersQuery = query(
      collection(db, "orders"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    return onSnapshot(
      accountOrdersQuery,
      (snapshot) => {
        const allOrders: OrderData[] = snapshot.docs.map((order) => ({
          id: order.id,
          ...(order.data() as Omit<OrderData, "id">),
        }));
        const liveOrders = allOrders.filter(isActiveOrder);
        setActiveOrders(liveOrders);
        setActiveOrdersLoading(false);

        if (requestedOrderIdRef.current || phoneVerifiedOrderId) return;
        const currentlySelectedOrder = allOrders.find(
          (order) => order.id === orderIdRef.current
        );
        if (currentlySelectedOrder && !isActiveOrder(currentlySelectedOrder)) {
          setOrderData(currentlySelectedOrder);
          return;
        }
        if (liveOrders.length === 0) {
          setOrderId(null);
          setOrderData(null);
          try {
            window.localStorage.removeItem("activeOrderId");
            announceActiveOrderChanged();
          } catch {
            /* ignore unavailable storage */
          }
          return;
        }

        if (!manualOrderSelectionRef.current) {
          setOrderId(liveOrders[0].id);
          try {
            window.localStorage.setItem("activeOrderId", liveOrders[0].id);
          } catch {
            /* Firebase remains the source of truth when storage is unavailable. */
          }
        }
      },
      (subscriptionError) => {
        console.error("Active order subscription failed:", subscriptionError);
        setActiveOrdersError("Unable to load your live orders. Check your connection and retry.");
        setActiveOrdersLoading(false);
      }
    );
  }, [user?.uid, authLoading, phoneVerifiedOrderId, activeOrdersRetryKey]);

  useEffect(() => {
    if (authLoading || user || phoneVerifiedOrderId || !requestedOrderIdRef.current) return;
    const returnToTrack = `/track?orderId=${encodeURIComponent(requestedOrderIdRef.current)}`;
    router.replace(`/auth?redirect=${encodeURIComponent(returnToTrack)}`);
  }, [router, user, authLoading, phoneVerifiedOrderId]);

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
            announceActiveOrderChanged();
          } catch {
            /* ignore */
          }
          setOrderId(null);
          return;
        }
        const raw = snap.data() as Omit<OrderData, "id">;
        const data: OrderData = { id: snap.id, ...raw };

        // Direct links are account-scoped; legacy guest orders require a
        // successful phone verification before the document can be shown.
        const belongsToSignedInCustomer = Boolean(
          user?.uid && data.customerId === user.uid
        );
        const verifiedGuestOrder = data.id === phoneVerifiedOrderId;
        if (!belongsToSignedInCustomer && !verifiedGuestOrder) {
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
        if (!isActiveOrder(data)) {
          try {
            window.localStorage.removeItem("activeOrderId");
            announceActiveOrderChanged();
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

  if (authLoading || loading || (user && activeOrdersLoading) || (user && activeOrders.length > 0 && !orderId)) {
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
              No active orders right now
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              {user
                ? "Your new orders will appear here automatically, with live updates from the kitchen and delivery team."
                : "Look up a guest order with its order number and checkout phone."}
            </p>
            {activeOrdersError && (
              <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-left text-xs font-semibold text-red-700">
                <p>{activeOrdersError}</p>
                <button
                  type="button"
                  onClick={() => setActiveOrdersRetryKey((key) => key + 1)}
                  className="mt-2 font-black underline underline-offset-2"
                >
                  Retry live orders
                </button>
              </div>
            )}
            {!user && (
              <form onSubmit={lookupOrder} className="mb-5 space-y-3 text-left">
                <label className="block text-xs font-bold text-gray-700">Order number<input autoComplete="off" required value={lookupOrderNumber} onChange={(event) => setLookupOrderNumber(event.target.value)} placeholder="e.g. #ELP-AB12CD" className="mt-1 w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-3 text-sm text-gray-900 outline-none focus:border-orange-400" /></label>
                <label className="block text-xs font-bold text-gray-700">Phone used at checkout<input autoComplete="tel" inputMode="tel" required value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder="10 digit phone number" className="mt-1 w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-3 text-sm text-gray-900 outline-none focus:border-orange-400" /></label>
                {lookupError && <p role="alert" className="text-xs font-semibold text-red-600">{lookupError}</p>}
                <button disabled={lookupBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-black text-white disabled:opacity-60">{lookupBusy ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />} Track order</button>
              </form>
            )}
            <div className="flex flex-col gap-3">
              <Link
                href="/menu"
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-orange-500/50 active:scale-95"
              >
                <ShoppingBag size={15} aria-hidden="true" /> Order now
              </Link>
              {user && (
                <Link
                  href="/profile#orders"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 py-3.5 text-sm font-black text-gray-700 shadow-sm backdrop-blur-md transition hover:bg-white active:scale-95"
                >
                  View order history
                </Link>
              )}
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

  const orderNumberLabel = orderData.orderNumber || orderData.id.slice(0, 8);
  const delivery = isDeliveryOrder(orderData);
  const stageKey = derivedStage;
  const isCancelled = stageKey === "cancelled" || stageKey === "rejected";

  const orderSwitcher = activeOrders.length > 1 ? (
    <label className="mb-5 block rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">
        You have {activeOrders.length} live orders
      </span>
      <select
        aria-label="Choose an active order to track"
        value={orderId || ""}
        onChange={(event) => {
          const nextId = event.target.value;
          manualOrderSelectionRef.current = true;
          setError(null);
          setOrderData(null);
          setOrderId(nextId);
          setLoading(true);
          try {
            window.localStorage.setItem("activeOrderId", nextId);
            announceActiveOrderChanged();
          } catch {
            /* account query remains the cross-device source of truth */
          }
        }}
        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        {activeOrders.map((order) => (
          <option key={order.id} value={order.id}>
            {order.orderNumber || order.id.slice(0, 8)} · {getOrderStatus(order).replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  ) : null;

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
      ? "Your order is on the way!"
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
      ? "Delivered"
      : liveRoadStats?.durationMinutes
      ? formatArrivalWindow(liveRoadStats.durationMinutes)
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
      <div className="min-h-screen bg-[#f4f7f3] px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-6">
      <div className="container mx-auto max-w-5xl px-0 sm:px-4">
          {orderSwitcher}

          <div className="space-y-5 sm:space-y-6">
            {/* Map-first layout keeps live delivery information immediately visible. */}
            <section className="relative overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_18px_50px_-24px_rgba(35,49,39,0.35)] dark:border-slate-800 dark:bg-slate-900">
              <div className="relative h-[min(46svh,420px)] min-h-[280px] w-full bg-[#e9eee8]">
                {mapReady ? (
                  <LiveMap
                    riderLat={riderLat}
                    riderLng={riderLng}
                    customerLat={customerLat}
                    customerLng={customerLng}
                    cafeLat={settings.cafeLat}
                    cafeLng={settings.cafeLng}
                    customerName={orderData.customerName}
                    onRouteCalculated={setLiveRoadStats}
                    className="absolute inset-0 h-full w-full"
                    showHud={false}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#e6eee6,#f7f6ef)] p-6 text-center">
                    <div className="max-w-xs rounded-2xl bg-white/85 p-5 shadow-sm">
                      <MapPin className="mx-auto mb-2 text-orange-600" size={26} aria-hidden="true" />
                      <p className="text-sm font-extrabold text-stone-900">Delivery map is getting ready</p>
                      <p className="mt-1 text-xs text-stone-600">Your address map will appear when the location is available.</p>
                    </div>
                  </div>
                )}
                <Link href="/menu" aria-label="Back to menu" className="absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-stone-800 shadow-md ring-1 ring-black/5 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                  <ArrowLeft size={18} aria-hidden="true" />
                </Link>
                <span className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-2 text-[11px] font-black text-stone-800 shadow-md ring-1 ring-black/5">
                  #{orderNumberLabel}
                </span>
                {isOutForDelivery && (
                  <span className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-stone-950/85 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">
                    <span className={`h-2 w-2 rounded-full bg-lime-400 ${reducedMotion ? "" : "animate-pulse"}`} />
                    Live rider location
                  </span>
                )}
              </div>
            </section>

            {/* HERO */}
            <div
              className={`relative overflow-hidden rounded-[28px] border border-stone-100 bg-white p-5 shadow-[0_14px_40px_-24px_rgba(35,49,39,0.3)] transition dark:border-slate-800 dark:bg-slate-900 sm:p-7 ${
                statusChangePulse && !reducedMotion
                  ? "ring-4 ring-orange-300/60"
                  : ""
              }`}
            >
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
                      <h1 className="text-xl font-black leading-tight text-stone-950 dark:text-white sm:text-2xl">
                        {heroTitle}
                      </h1>
                      <p className="mt-1 truncate text-xs font-semibold text-stone-600 dark:text-stone-300">
                        Order{" "}
                        <span className="font-mono text-stone-900 dark:text-white">
                          #{orderNumberLabel}
                        </span>
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-stone-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-lime-300">
                          <Navigation size={14} aria-hidden="true" />
                          {isDelivered
                            ? "Delivered"
                            : liveRoadStats?.durationMinutes
                            ? `Arrives ${etaText}`
                            : "Calculating arrival time"}
                        </span>
                        {distanceKm !== null && <span className="text-stone-500 dark:text-slate-400">· {distanceText} away</span>}
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

              </div>
            </div>

            {/* GAMIFIED TRACKER */}
            {isCancelled ? (
              <div role="status" className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950">
                <h2 className="text-lg font-black">This order was {stageKey}.</h2>
                <p className="mt-1 text-sm">If you have a question about this order or its payment, contact <a className="font-bold underline" href="mailto:support@elpresto.co.in">support@elpresto.co.in</a>.</p>
              </div>
            ) : (
              <OrderProgress currentStage={stageKey} isDelivery />
            )}
            <details className="group rounded-2xl border border-stone-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-white">
                Recent status updates
                <span aria-hidden="true" className="text-stone-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-3">
                <OrderStatusHistory
                  history={orderData.statusHistory}
                  currentStatus={getOrderStatus(orderData)}
                  createdAt={orderData.createdAt}
                  updatedAt={orderData.updatedAt}
                />
              </div>
            </details>

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

            {/* RIDER AND DESTINATION */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <section className="flex min-w-0 items-center gap-3 rounded-[24px] border border-stone-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime-100 text-xl">
                  {orderData.deliveryPersonName ? orderData.deliveryPersonName.trim().slice(0, 1).toUpperCase() : "🛵"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-stone-950 dark:text-white">
                    {orderData.deliveryPersonName || "Finding your delivery partner"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-slate-300">
                    <Truck size={13} aria-hidden="true" />
                    {orderData.deliveryPersonName ? "Your delivery partner" : "We’ll show their details here"}
                  </p>
                  {Boolean(orderData.deliveryLocationUpdatedAt) && (
                    <p className="mt-1 text-[10px] font-semibold text-stone-500 dark:text-slate-400">
                      Location updated {formatISTTime(orderData.deliveryLocationUpdatedAt)}
                    </p>
                  )}
                </div>
                <a href="tel:+916392512314" aria-label="Call El Presto support" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-stone-50 px-3 text-xs font-extrabold text-stone-800 ring-1 ring-stone-200 transition hover:bg-lime-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <Phone size={17} aria-hidden="true" />
                  <span>Support</span>
                </a>
              </section>

              <section className="flex min-w-0 items-start gap-3 rounded-[24px] border border-stone-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-700">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-slate-400">Delivering to</p>
                  <p className="mt-1 text-sm font-bold leading-snug text-stone-900 dark:text-white">{fullAddress}</p>
                </div>
              </section>
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
            <details className="group rounded-3xl border border-stone-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 dark:text-white">
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
                    className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs dark:bg-slate-800"
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
                href="tel:+916392512314"
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
    <div className="storefront-theme min-h-screen bg-[#f4f7f3] px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-6">
      <div className="container mx-auto max-w-2xl">
        {orderSwitcher}

        <div className="space-y-5 sm:space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_18px_50px_-24px_rgba(35,49,39,0.35)] dark:border-slate-800 dark:bg-slate-900">
            <div className="relative h-[min(48svh,380px)] min-h-[260px] w-full bg-[#e9eee8]">
              <LiveMap
                riderLat={pickupLat}
                riderLng={pickupLng}
                customerLat={pickupLat}
                customerLng={pickupLng}
                cafeLat={pickupLat}
                cafeLng={pickupLng}
                customerName={orderData.orderLocation?.kind === "pickup" ? "Pickup outlet" : orderData.customerName}
                className="absolute inset-0 h-full w-full"
                showHud={false}
              />
              <Link href="/menu" aria-label="Back to menu" className="absolute left-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-stone-800 shadow-md ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                <ArrowLeft size={18} aria-hidden="true" />
              </Link>
              <span className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-2 text-[11px] font-black text-stone-800 shadow-md ring-1 ring-black/5">#{orderNumberLabel}</span>
            </div>
          </section>

          {/* HERO */}
          <div
            className={`relative overflow-hidden rounded-3xl border border-stone-100 bg-white p-5 text-center shadow-[0_14px_40px_-24px_rgba(35,49,39,0.3)] transition dark:border-slate-800 dark:bg-slate-900 sm:p-7 ${
              statusChangePulse && !reducedMotion
                ? "ring-4 ring-orange-300/60"
                : ""
            }`}
          >
            <div className="relative flex flex-col items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-3xl shadow-lg shadow-orange-500/30 ring-1 ring-white/60"
              >
                {takeawayEmoji}
              </div>
              <h1 className="text-2xl font-black leading-tight text-gray-900 dark:text-white sm:text-3xl">
                {takeawayTitle}
              </h1>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400">
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
          {isCancelled ? (
            <div role="status" className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950">
              <h2 className="text-lg font-black">This order was {stageKey}.</h2>
              <p className="mt-1 text-sm">If you have a question about this order or its payment, contact <a className="font-bold underline" href="mailto:support@elpresto.co.in">support@elpresto.co.in</a>.</p>
            </div>
          ) : (
            <OrderProgress currentStage={stageKey} isDelivery={false} />
          )}
          <OrderStatusHistory
            history={orderData.statusHistory}
            currentStatus={getOrderStatus(orderData)}
            createdAt={orderData.createdAt}
            updatedAt={orderData.updatedAt}
          />

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
            <div className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
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
