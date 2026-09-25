"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import Link from "next/link";
import LiveMap from "@/components/Map/LiveMap";
import { DEFAULT_DELIVERY_SETTINGS, DeliverySettings } from "@/lib/delivery";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  id: string;
  orderNumber: string;
  customerName: string;
  phone?: string;
  customerPhone?: string;
  type: "takeaway" | "delivery";
  location?: any;
  deliveryAddress?: {
    houseFlat?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    pincode?: string;
    fullAddress?: string;
  };
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryPersonLatitude?: number;
  deliveryPersonLongitude?: number;
  deliveryPersonName?: string;
  deliveryStatus?: string;
  deliveryLocationUpdatedAt?: string;
  deliveryDistance?: number;
  items: OrderItem[];
  total: number;
  status: string;
  instructions?: string;
  createdAt: any;
  deliveryOtp?: string;
}

/* ------------------------------------------------------------------ */
/* Stage definitions                                                   */
/* ------------------------------------------------------------------ */
interface Stage {
  key: string;
  label: string;
  shortLabel: string;
  emoji: string;
  gradient: string;
  ring: string;
  points: number;
}

const DELIVERY_STAGES: Stage[] = [
  { key: "received",         label: "Order Placed", shortLabel: "Placed",  emoji: "📝", gradient: "from-blue-500 to-cyan-500",     ring: "ring-blue-200",    points: 10 },
  { key: "preparing",        label: "In Kitchen",   shortLabel: "Cooking", emoji: "👨‍🍳", gradient: "from-orange-500 to-amber-500",  ring: "ring-orange-200",  points: 30 },
  { key: "ready",            label: "Ready",        shortLabel: "Ready",   emoji: "🍕", gradient: "from-amber-500 to-yellow-500",  ring: "ring-amber-200",   points: 50 },
  { key: "out_for_delivery", label: "On the Way",   shortLabel: "On Way",  emoji: "🛵", gradient: "from-purple-500 to-pink-500",   ring: "ring-purple-200",  points: 70 },
  { key: "delivered",        label: "Delivered",    shortLabel: "Done",    emoji: "🎉", gradient: "from-emerald-500 to-green-500", ring: "ring-emerald-200", points: 100 },
];

const TAKEAWAY_STAGES: Stage[] = [
  { key: "received",  label: "Order Placed", shortLabel: "Placed",  emoji: "📝", gradient: "from-blue-500 to-cyan-500",    ring: "ring-blue-200",    points: 10 },
  { key: "preparing", label: "In Kitchen",   shortLabel: "Cooking", emoji: "👨‍🍳", gradient: "from-orange-500 to-amber-500", ring: "ring-orange-200",  points: 30 },
  { key: "ready",     label: "Ready",        shortLabel: "Ready",   emoji: "🍕", gradient: "from-amber-500 to-yellow-500", ring: "ring-amber-200",   points: 50 },
  { key: "completed", label: "Picked Up",    shortLabel: "Done",    emoji: "🎉", gradient: "from-emerald-500 to-green-500", ring: "ring-emerald-200", points: 100 },
];

/* ------------------------------------------------------------------ */
/* Gamified tracker                                                    */
/* ------------------------------------------------------------------ */
function GamifiedTracker({
  currentStage,
  isDelivery,
}: {
  currentStage: string;
  isDelivery: boolean;
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
  const percent = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.25)] backdrop-blur-2xl md:p-7">
      {/* Header row */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md shadow-orange-500/30 ring-1 ring-white/60">
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

      {/* XP bar */}
      <div className="mb-8 h-2.5 overflow-hidden rounded-full bg-gray-200/80 ring-1 ring-white/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-500 shadow-[0_0_12px_rgba(251,146,60,0.55)] transition-all duration-1000 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Stage tracker */}
      <div className="relative">
        {/* Track background */}
        <div
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-gray-200 md:top-6"
          style={{ left: `${inset}%`, right: `${inset}%` }}
        />
        {/* Track progress */}
        <div
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all duration-1000 ease-out md:top-6"
          style={{ left: `${inset}%`, width: `${fillWidth}%` }}
        />

        {/* Stage nodes */}
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
                  {isActive && currentStage !== "delivered" && currentStage !== "completed" && (
                    <span
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
                    {stage.emoji}
                    {isDone && (
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-emerald-600 shadow-sm md:h-5 md:w-5">
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
                    <Zap size={9} fill="currentColor" />+{stage.points}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone hint */}
      {currentIndex < total - 1 && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-4 py-2.5">
          <Sparkles size={15} className="shrink-0 text-amber-500" />
          <p className="text-xs font-bold text-amber-800">
            Next milestone:{" "}
            <span className="text-orange-600">{stages[currentIndex + 1].label}</span>{" "}
            · +{stages[currentIndex + 1].points} XP
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small reusable stat card                                            */
/* ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function TrackOrderPage() {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [liveRoadStats, setLiveRoadStats] = useState<{
    distanceKm: number;
    durationMinutes: number;
  } | null>(null);

  const [settings, setSettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---------- settings ---------- */
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
          const data = docSnap.data();
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
        console.warn("Using default delivery settings in track:", err);
      }
    };
    fetchSettings();
  }, []);

  /* ---------- realtime listener ---------- */
  useEffect(() => {
    if (!mounted) return;

    const savedOrderId = localStorage.getItem("activeOrderId");
    if (!savedOrderId) {
      setLoading(false);
      return;
    }

    let unsubscribe: any;

    const startListening = async () => {
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");

        unsubscribe = onSnapshot(
          doc(db, "orders", savedOrderId),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = { id: docSnap.id, ...docSnap.data() } as OrderData;
              if (
                data.type === "delivery" &&
                !data.deliveryOtp &&
                data.status !== "completed"
              ) {
                const genOtp = Math.floor(1000 + Math.random() * 9000).toString();
                data.deliveryOtp = genOtp;
                import("firebase/firestore").then(({ updateDoc, doc: fDoc }) => {
                  updateDoc(fDoc(db, "orders", docSnap.id), {
                    deliveryOtp: genOtp,
                  }).catch(console.error);
                });
              }
              setOrderData(data);
            } else {
              setOrderData(null);
              localStorage.removeItem("activeOrderId");
            }
            setLoading(false);
          },
          (err) => {
            console.error("Tracking listener error:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Failed to load order:", err);
        setLoading(false);
      }
    };

    startListening();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [mounted]);

  /* ---------- derived stage ---------- */
  const derivedStage = useMemo(() => {
    if (!orderData) return "received";
    if (orderData.type === "delivery") {
      if (orderData.deliveryStatus === "delivered") return "delivered";
      if (
        orderData.deliveryStatus === "out_for_delivery" ||
        orderData.status === "out_for_delivery"
      )
        return "out_for_delivery";
      if (orderData.status === "ready") return "ready";
      if (orderData.status === "preparing") return "preparing";
      return "received";
    }
    if (orderData.status === "completed") return "completed";
    if (orderData.status === "ready") return "ready";
    if (orderData.status === "preparing") return "preparing";
    return "received";
  }, [orderData]);

  /* ================================================================ */
  /* Loading                                                          */
  /* ================================================================ */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-b-orange-500" />
          <p className="text-xs font-black uppercase tracking-widest text-orange-500">
            Loading tracker…
          </p>
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
                <Search size={40} className="text-orange-400" />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-black text-gray-900">
              No Active Orders
            </h2>
            <p className="mb-8 text-sm text-gray-600">
              You don&apos;t have any recent orders to track on this device.
            </p>
            <Link
              href="/menu"
              className="block w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-orange-500/50 active:scale-95"
            >
              🍕 Explore Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* Shared header bits                                               */
  /* ================================================================ */
  const BackLink = (
    <Link
      href="/menu"
      className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-2 text-sm font-bold text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:text-orange-600"
    >
      <ArrowLeft size={16} /> Back to Menu
    </Link>
  );

  /* ================================================================ */
  /* DELIVERY VIEW                                                    */
  /* ================================================================ */
  if (orderData.type === "delivery") {
    const isDelivered = orderData.deliveryStatus === "delivered";
    const isOutForDelivery =
      orderData.deliveryStatus === "out_for_delivery" ||
      orderData.status === "out_for_delivery";
    const isAssigned =
      orderData.deliveryStatus === "assigned" ||
      orderData.status === "assigned";
    const isReady = orderData.status === "ready";

    const customerLat =
      orderData.deliveryLatitude ||
      (typeof orderData.location === "object" ? orderData.location?.lat : undefined) ||
      settings.cafeLat + 0.008;
    const customerLng =
      orderData.deliveryLongitude ||
      (typeof orderData.location === "object" ? orderData.location?.lng : undefined) ||
      settings.cafeLng + 0.008;

    const riderLat = orderData.deliveryPersonLatitude;
    const riderLng = orderData.deliveryPersonLongitude;

    const fullAddress =
      orderData.deliveryAddress?.fullAddress ||
      (typeof orderData.location === "string"
        ? orderData.location
        : orderData.location?.address) ||
      "Delivery Address";

    let badgeText = "Preparing at Kitchen";
    let badgeClass = "bg-orange-100 text-orange-700 ring-orange-200";
    let heroEmoji = "👨‍🍳";
    let heroTitle = "Cooking your order";
    if (isDelivered) {
      badgeText = "Delivered";
      badgeClass = "bg-emerald-100 text-emerald-700 ring-emerald-200";
      heroEmoji = "🎉";
      heroTitle = "Order Delivered!";
    } else if (isOutForDelivery) {
      badgeText = "Out for Delivery";
      badgeClass = "bg-blue-100 text-blue-700 ring-blue-200";
      heroEmoji = "🛵";
      heroTitle = "Rider is on the way";
    } else if (isAssigned) {
      badgeText = "Partner Assigned";
      badgeClass = "bg-amber-100 text-amber-700 ring-amber-200";
      heroEmoji = "🧑‍✈️";
      heroTitle = "Partner assigned";
    } else if (isReady) {
      badgeText = "Ready for pickup";
      badgeClass = "bg-emerald-100 text-emerald-700 ring-emerald-200";
      heroEmoji = "🍕";
      heroTitle = "Fresh out of the oven";
    }

    const etaMinutes = liveRoadStats?.durationMinutes;
    const distanceKm =
      liveRoadStats?.distanceKm ?? orderData.deliveryDistance ?? null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
        <div className="container mx-auto max-w-4xl">
          {BackLink}

          <div className="space-y-5 sm:space-y-6">
            {/* ---------------- HERO ---------------- */}
            <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_15px_50px_-15px_rgba(217,35,18,0.3)] backdrop-blur-2xl sm:p-7">
              {/* glow blobs */}
              <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
              <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />

              <div className="relative flex flex-col gap-5">
                {/* top row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-lg shadow-orange-500/30 ring-1 ring-white/60">
                      {heroEmoji}
                    </div>
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-black leading-tight text-gray-900 sm:text-2xl">
                        {heroTitle}
                      </h1>
                      <p className="truncate text-xs font-bold text-gray-500">
                        Order <span className="text-gray-800">#{orderData.orderNumber}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ring-2 sm:text-xs ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                    {isOutForDelivery && !isDelivered && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-600 ring-2 ring-red-200 sm:text-xs">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        Live GPS
                      </span>
                    )}
                  </div>
                </div>

                {/* stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="ETA"
                    value={
                      isDelivered
                        ? "Done"
                        : etaMinutes
                        ? `~${etaMinutes} min`
                        : "Calculating…"
                    }
                    icon={<Navigation size={16} />}
                    tone="blue"
                  />
                  <StatCard
                    label="Distance"
                    value={
                      distanceKm !== null ? `${distanceKm} km` : "—"
                    }
                    icon={<MapPin size={16} />}
                    tone="orange"
                  />
                  <StatCard
                    label="Order Total"
                    value={`₹${orderData.total?.toFixed(2)}`}
                    icon={<Star size={16} />}
                    tone="emerald"
                  />
                </div>
              </div>
            </div>

            {/* ---------------- GAMIFIED TRACKER ---------------- */}
            <GamifiedTracker currentStage={derivedStage} isDelivery />

            {/* ---------------- MAP ---------------- */}
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

            {/* ---------------- OTP ---------------- */}
            {orderData.deliveryOtp && !isDelivered && (
              <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-4 shadow-lg backdrop-blur-md sm:p-5">
                <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />
                <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="text-xl">🔑</span>
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
                    <span className="select-all font-mono text-3xl font-black tracking-[0.4em] text-emerald-700 sm:text-4xl">
                      {orderData.deliveryOtp}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- RIDER + ADDRESS ---------------- */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-md backdrop-blur-xl">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 text-2xl ring-1 ring-white/60">
                  🛵
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-900">
                    {orderData.deliveryPersonName || "El Presto Delivery Partner"}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] font-semibold text-gray-500">
                    <Truck size={12} /> Official Rider • UCER Hub
                  </p>
                  {orderData.deliveryLocationUpdatedAt && (
                    <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                      GPS updated:{" "}
                      {new Date(orderData.deliveryLocationUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-md backdrop-blur-xl">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 ring-1 ring-white/60">
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

            {/* ---------------- DELIVERED CELEBRATION ---------------- */}
            {isDelivered && (
              <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 p-6 text-center shadow-lg">
                <span className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
                <span className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" />
                <div className="relative flex flex-col items-center gap-3">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                    <PartyPopper size={30} />
                  </div>
                  <h3 className="text-lg font-black text-emerald-950">
                    Order Delivered! 🎉
                  </h3>
                  <p className="max-w-md text-sm font-semibold text-emerald-800/80">
                    You earned{" "}
                    <span className="font-black text-emerald-600">
                      +100 XP
                    </span>{" "}
                    · Thanks for ordering with EL PRESTO!
                  </p>
                </div>
              </div>
            )}

            {/* ---------------- ORDER ITEMS ---------------- */}
            <details className="group rounded-3xl border border-white/60 bg-white/45 p-5 shadow-md backdrop-blur-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-gray-800">
                <span className="flex items-center gap-2">
                  📋 View Order Items
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-600">
                    {orderData.items?.length || 0}
                  </span>
                </span>
                <span className="text-xs font-bold text-gray-400 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="mt-4 space-y-2 border-t border-white/60 pt-4">
                {orderData.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-gray-700">
                      <span className="mr-1.5 font-black text-orange-600">
                        {item.quantity}×
                      </span>
                      {item.name}
                    </span>
                    <span className="font-black text-gray-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-white/60 pt-3">
                  <span className="text-sm font-black text-gray-800">Total</span>
                  <span className="text-lg font-black text-orange-600">
                    ₹{orderData.total?.toFixed(2)}
                  </span>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* TAKEAWAY VIEW                                                    */
  /* ================================================================ */
  const liveStatus = orderData.status || "preparing";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
      <div className="container mx-auto max-w-2xl">
        {BackLink}

        <div className="space-y-5 sm:space-y-6">
          {/* ---------------- HERO ---------------- */}
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/55 p-5 text-center shadow-[0_15px_50px_-15px_rgba(217,35,18,0.3)] backdrop-blur-2xl sm:p-7">
            <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
            <div className="relative flex flex-col items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-3xl shadow-lg shadow-orange-500/30 ring-1 ring-white/60">
                {liveStatus === "completed" ? "🎉" : liveStatus === "ready" ? "🍕" : "👨‍🍳"}
              </div>
              <h1 className="text-2xl font-black leading-tight text-gray-900 sm:text-3xl">
                {liveStatus === "completed"
                  ? "Order Picked Up!"
                  : liveStatus === "ready"
                  ? "Ready for Pickup!"
                  : "We're cooking your order"}
              </h1>
              <p className="text-xs font-bold text-gray-500">
                Pickup at Counter • UCER Campus
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-sm font-black tracking-wider text-gray-900 shadow-sm">
                  #{orderData.orderNumber}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ring-2 ${
                    liveStatus === "completed"
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : liveStatus === "ready"
                      ? "bg-amber-100 text-amber-700 ring-amber-200"
                      : "bg-orange-100 text-orange-700 ring-orange-200"
                  }`}
                >
                  {liveStatus}
                </span>
              </div>
            </div>
          </div>

          {/* ---------------- GAMIFIED TRACKER ---------------- */}
          <GamifiedTracker currentStage={derivedStage} isDelivery={false} />

          {/* ---------------- STATUS MESSAGES ---------------- */}
          {liveStatus === "ready" && (
            <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-orange-50/80 p-4 shadow-md backdrop-blur-md">
              <AlertCircle
                className="mt-0.5 shrink-0 text-amber-500"
                size={20}
              />
              <p className="text-sm font-bold text-amber-900">
                Your order is hot and ready at the counter! Show your order
                number to collect it. 🔥
              </p>
            </div>
          )}

          {liveStatus === "completed" && (
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 p-6 text-center shadow-lg">
              <span className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                  <CheckCircle2 size={30} />
                </div>
                <h3 className="text-lg font-black text-emerald-950">
                  Order Picked Up! 🎉
                </h3>
                <p className="max-w-md text-sm font-semibold text-emerald-800/80">
                  You earned{" "}
                  <span className="font-black text-emerald-600">+100 XP</span>{" "}
                  · Thank you for dining with EL PRESTO!
                </p>
              </div>
            </div>
          )}

          {/* ---------------- ORDER SUMMARY ---------------- */}
          <div className="rounded-3xl border border-white/60 bg-white/50 p-5 shadow-md backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">
                🧾 Order Summary
              </h3>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-black text-orange-600">
                {orderData.items?.length || 0} items
              </span>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {orderData.items?.map((item: any, idx: number) => (
                <div
                  key={idx}
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
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/70 pt-4">
              <span className="text-sm font-black text-gray-800">Total</span>
              <span className="text-xl font-black text-orange-600">
                ₹{orderData.total?.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}