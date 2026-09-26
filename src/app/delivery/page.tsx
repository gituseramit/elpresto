"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Truck,
  Phone,
  Navigation,
  CheckCircle,
  MapPin,
  Clock,
  Compass,
  Lock,
  LogOut,
  AlertCircle,
  RefreshCw,
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
  Target,
  Zap,
  Eye,
  ChevronDown,
  Flame,
  Package,
  User,
  Activity,
} from "lucide-react";
import Link from "next/link";
import LiveMap from "@/components/Map/LiveMap";
import { db } from "@/lib/firebase";
import { DEFAULT_DELIVERY_SETTINGS, DeliverySettings } from "@/lib/delivery";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { verifyPanelAccess, subscribePanelStatus } from "@/lib/panelAuth";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import { subscribeDayOrders, getISTDateString, formatISTDisplayDate } from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";
import { getActiveBranches, Branch, DeliveryPartner } from "@/lib/branchService";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */
interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  phone?: string;
  type: string;
  status: string;
  deliveryStatus?: string;
  deliveryAddress?: {
    houseFlat?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    pincode?: string;
    fullAddress?: string;
  };
  location?: any;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistance?: number;
  deliveryFee?: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  instructions?: string;
  createdAt: string | any;
  deliveryOtp?: string;
  paymentStatus?: string;
}

type SortMode = "distance" | "time" | "value";
type FilterMode = "all" | "ready" | "out_for_delivery";

/* ============================================================= */
/* Haversine distance (km)                                       */
/* ============================================================= */
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

function getElapsedMins(createdAt: any): number {
  if (!createdAt) return 0;
  const d = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

/* ============================================================= */
/* Reusable small components                                     */
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
/* Main component                                                */
/* ============================================================= */
export default function DeliveryPortal() {
  /* ---- Auth ---- */
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<any>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>("branch-main");
  const [branchPartners, setBranchPartners] = useState<DeliveryPartner[]>([]);
  const isElevatedUser = staffSession?.role === "DEVELOPER" || staffSession?.role === "SUPER_ADMIN";
  /* ---- Data ---- */
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getISTDateString(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastGpsWriteRef = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  /* ---- Tracking ---- */
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(null);
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [orderRoadStats, setOrderRoadStats] = useState<
    Record<string, { distanceKm: number; durationMinutes: number }>
  >({});
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);

  /* ---- OTP modal ---- */
  const [otpModalOrder, setOtpModalOrder] = useState<DeliveryOrder | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  /* ---- UI ---- */
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [newOrderPulse, setNewOrderPulse] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<any>(null);
  const seenOrdersRef = useRef<Set<string>>(new Set());

  /* =============================================== */
  /* Effects                                         */
  /* =============================================== */
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@/lib/staffAuth").then(({ getStaffSession, isSessionValid }) => {
        const session = getStaffSession("delivery");
        if (session && isSessionValid(session)) {
          setStaffSession(session);
          setIsAuthenticated(true);
          if (session.branchId) {
            setActiveBranchId(session.branchId);
          }
        }
        setIsVerifyingAuth(false);
      });
      const soundPref = localStorage.getItem("elpestro_rider_sound");
      if (soundPref === "false") setSoundEnabled(false);
    }

    const unsub = subscribePanelStatus("delivery", () => {
      stopGpsTracking();
      setIsAuthenticated(false);
      setStaffSession(null);
      import("@/lib/staffAuth").then(({ clearStaffSession }) => clearStaffSession("delivery"));
      sessionStorage.removeItem("elpestro_delivery_auth");
    });
    return () => unsub();
  }, []);

  /* Load branches & branch-scoped delivery partners */
  useEffect(() => {
    getActiveBranches().then((list) => setBranches(list)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeBranchId) return;
    const qPartners = query(
      collection(db, "deliveryPartners"),
      where("assignedBranchId", "==", activeBranchId)
    );
    const unsub = onSnapshot(qPartners, (snap: any) => {
      setBranchPartners(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isAuthenticated, activeBranchId]);

  const handleBranchSwitch = async (newBranchId: string) => {
    if (!isElevatedUser) return;
    setActiveBranchId(newBranchId);
    const { logAuditEvent } = await import("@/lib/rbac");
    logAuditEvent({
      actorId: staffSession?.staffId || "dev",
      actorName: staffSession?.name || "Developer",
      actorRole: staffSession?.role || "DEVELOPER",
      branchId: newBranchId,
      action: "CROSS_BRANCH_VIEW",
      targetType: "delivery",
      targetId: newBranchId,
      metadata: { fromBranchId: activeBranchId, toBranchId: newBranchId },
    }).catch(() => {});
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { doc: fDoc, getDoc } = await import("firebase/firestore");
        const docSnap = await getDoc(fDoc(db, "settings", "general"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            cafeName: data.cafeName || DEFAULT_DELIVERY_SETTINGS.cafeName,
            cafeLat: data.cafeLat || data.restaurantLat || DEFAULT_DELIVERY_SETTINGS.cafeLat,
            cafeLng: data.cafeLng || data.restaurantLng || DEFAULT_DELIVERY_SETTINGS.cafeLng,
            deliveryRadiusKm: data.deliveryRadiusKm || 7,
            baseDeliveryFee: data.baseDeliveryFee || 30,
            freeDeliveryThreshold: data.freeDeliveryThreshold || 499,
            deliveryEnabled: data.deliveryEnabled !== undefined ? data.deliveryEnabled : true,
          });
        }
      } catch (err) {
        console.warn("Using default delivery settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleLogout = () => {
    stopGpsTracking();
    setIsAuthenticated(false);
    setStaffSession(null);
    import("@/lib/staffAuth").then(({ clearStaffSession }) => clearStaffSession("delivery"));
    sessionStorage.removeItem("elpestro_delivery_auth");
  };

  /* ---- Sound ---- */
  const playNewOrderChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
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
    } catch (e) {}
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("elpestro_rider_sound", String(next));
    if (next) playNewOrderChime();
  };

  /* ---- Realtime subscription ---- */
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeDayOrders(
      selectedDate,
      (list) => {
        const deliveryList: DeliveryOrder[] = [];
        list.forEach((docData) => {
          if (docData.type === "delivery" || docData.orderType === "delivery") {
            deliveryList.push(docData as DeliveryOrder);
          }
        });

        // detect new orders
        const newOnes = deliveryList.filter(
          (o) =>
            o.deliveryStatus !== "delivered" &&
            !seenOrdersRef.current.has(o.id) &&
            seenOrdersRef.current.size > 0
        );
        if (newOnes.length > 0) {
          playNewOrderChime();
          setNewOrderPulse(true);
          setTimeout(() => setNewOrderPulse(false), 2500);
        }
        deliveryList.forEach((o) => seenOrdersRef.current.add(o.id));

        setOrders(deliveryList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Delivery orders error:", err);
        setError("Unable to load orders. Please try again.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated, selectedDate, soundEnabled]);

  // Keep selectedOrder in sync with orders list without re-subscribing
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find((o) => o.id === selectedOrder.id);
      if (updated && (updated.deliveryStatus !== selectedOrder.deliveryStatus || updated.status !== selectedOrder.status)) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    return () => {
      stopGpsTracking();
    };
  }, []);

  /* ---- GPS ---- */
  const startGpsTracking = (orderId: string) => {
    if (!navigator.geolocation) {
      setGpsError("GPS is not supported on this device/browser.");
      return;
    }
    stopGpsTracking();
    setActiveTrackingOrderId(orderId);
    setGpsActive(true);
    setGpsError(null);

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setRiderCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setGpsActive(true);
        const now = Date.now();
        // Throttle Firestore writes: at most once every 6 seconds to prevent freezing
        if (now - lastGpsWriteRef.current >= 6000) {
          lastGpsWriteRef.current = now;
          try {
            await updateDoc(doc(db, "orders", orderId), {
              deliveryStatus: "out_for_delivery",
              deliveryPersonLatitude: latitude,
              deliveryPersonLongitude: longitude,
              deliveryPersonName: "El Presto Delivery Partner",
              deliveryLocationUpdatedAt: new Date().toISOString(),
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
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    setActiveTrackingOrderId(null);
  };

  /* ---- Actions ---- */
  const handleAccept = async (order: DeliveryOrder) => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        deliveryStatus: "assigned",
        deliveryPersonName: "El Presto Delivery Partner",
        deliveryPersonId: "rider_portal",
      });
    } catch (err: any) {
      alert("Error accepting delivery: " + err.message);
    }
  };

  const handleStartDelivery = async (order: DeliveryOrder) => {
    if (
      order.status !== "ready" &&
      order.deliveryStatus !== "ready" &&
      order.status !== "out_for_delivery" &&
      order.deliveryStatus !== "out_for_delivery"
    ) {
      alert("This order has not been marked ready by the kitchen yet. You can only start delivery once it is marked ready.");
      return;
    }
    startGpsTracking(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "out_for_delivery",
        deliveryStatus: "out_for_delivery",
        deliveryPersonName: "El Presto Delivery Partner",
        deliveryPersonId: "rider_portal",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleMarkDelivered = (order: DeliveryOrder) => {
    setOtpModalOrder(order);
    setEnteredOtp("");
    setOtpError("");
  };

  const handleVerifyOtpAndDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalOrder) return;
    setOtpError("");
    const inputOtp = enteredOtp.trim();
    if (!inputOtp) {
      setOtpError("Please enter the 4-digit OTP provided by the customer.");
      return;
    }
    if (otpModalOrder.deliveryOtp && inputOtp !== otpModalOrder.deliveryOtp) {
      setOtpError("❌ Incorrect OTP! Please ask the customer for their 4-digit code.");
      return;
    }
    setIsVerifyingOtp(true);
    stopGpsTracking();
    try {
      await updateDoc(doc(db, "orders", otpModalOrder.id), {
        status: "completed",
        deliveryStatus: "delivered",
        deliveredAt: new Date().toISOString(),
        otpVerified: true,
      });
      setOtpModalOrder(null);
      setEnteredOtp("");
    } catch (err: any) {
      setOtpError("Error completing delivery: " + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const openNavigationApp = (lat?: number, lng?: number) => {
    if (!lat || !lng) {
      alert("Customer coordinates are not set.");
      return;
    }
    const originParam = riderCoords
      ? `&origin=${riderCoords.lat},${riderCoords.lng}`
      : `&origin=${settings.cafeLat},${settings.cafeLng}`;
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  /* ---- Derived ---- */
  // Delivery partner only sees orders after they are marked READY by the kitchen (or already in transit)
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return deliveredOrders.filter((o: any) => {
      const t = o.deliveredAt ? new Date(o.deliveredAt).getTime() : 0;
      return t >= ts;
    }).length;
  }, [deliveredOrders]);

  const earningsToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return deliveredOrders
      .filter((o: any) => {
        const t = o.deliveredAt ? new Date(o.deliveredAt).getTime() : 0;
        return t >= ts;
      })
      .reduce((sum: number, o: any) => sum + (o.deliveryFee || 0), 0);
  }, [deliveredOrders]);

  const riderLat = riderCoords?.lat ?? settings.cafeLat;
  const riderLng = riderCoords?.lng ?? settings.cafeLng;

  /* ---- Sort + filter active orders (distance priority default) ---- */
  const processedOrders = useMemo(() => {
    let list = [...activeOrders];

    // Filter by status
    if (filterMode !== "all") {
      if (filterMode === "ready") {
        list = list.filter(
          (o) =>
            (o.status === "ready" || o.deliveryStatus === "ready" || o.deliveryStatus === "pending") &&
            o.deliveryStatus !== "out_for_delivery" &&
            o.status !== "out_for_delivery"
        );
      } else if (filterMode === "out_for_delivery") {
        list = list.filter(
          (o) =>
            o.deliveryStatus === "out_for_delivery" || o.status === "out_for_delivery"
        );
      } else {
        list = list.filter((o) => (o.deliveryStatus || "pending") === filterMode);
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customerPhone?.includes(q) ||
          o.phone?.includes(q)
      );
    }

    // Compute distance for sorting
    const withDistance = list.map((o) => {
      const cLat = o.deliveryLatitude || o.location?.lat;
      const cLng = o.deliveryLongitude || o.location?.lng;
      let distance = o.deliveryDistance || 999;
      if (cLat && cLng) {
        distance = calcDistance(riderLat, riderLng, cLat, cLng);
      }
      return { order: o, distance };
    });

    withDistance.sort((a, b) => {
      if (sortMode === "distance") return a.distance - b.distance;
      if (sortMode === "value") return (b.order.total || 0) - (a.order.total || 0);
      // time (newest first)
      return (
        new Date(b.order.createdAt || 0).getTime() -
        new Date(a.order.createdAt || 0).getTime()
      );
    });

    return withDistance;
  }, [activeOrders, filterMode, searchQuery, sortMode, riderLat, riderLng]);

  /* =============================================== */
  /* LOGIN SCREEN                                    */
  /* =============================================== */
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
        onSuccess={(session) => {
          setStaffSession(session);
          setIsAuthenticated(true);
          if (session.branchId) {
            setActiveBranchId(session.branchId);
          }
        }}
      />
    );
  }
  /* =============================================== */
  /* MAIN PORTAL                                     */
  /* =============================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pb-20">
      {/* ============================================ */}
      {/* HEADER                                       */}
      {/* ============================================ */}
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
            {/* GPS chip */}
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

            {/* Sound toggle */}
            <button
              onClick={toggleSound}
              className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                soundEnabled
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/5 bg-slate-800 text-slate-500"
              }`}
              title={soundEnabled ? "Mute new order alerts" : "Enable new order alerts"}
            >
              {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4">
        {/* ============================================ */}
        {/* NEW ORDER PULSE BANNER                        */}
        {/* ============================================ */}
        {newOrderPulse && (
          <div className="animate-pulse rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-600/20 to-amber-600/20 px-4 py-3 text-xs font-black uppercase tracking-wider text-orange-300">
            🔔 New delivery order received!
          </div>
        )}

        {/* ============================================ */}
        {/* GPS TRACKING BANNER                           */}
        {/* ============================================ */}
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
                onClick={stopGpsTracking}
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
            <p className="text-xs font-semibold text-red-300">
              GPS Warning: {gpsError}
            </p>
          </div>
        )}

        {/* ============================================ */}
        {/* STATS GRID                                    */}
        {/* ============================================ */}
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
              activeOrders.filter((o) => o.deliveryStatus === "out_for_delivery")
                .length
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

        {/* ============================================ */}
        {/* TABS                                          */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/5 bg-slate-900/60 p-1 backdrop-blur-xl">
          <button
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

        {/* ============================================ */}
        {/* ACTIVE TAB                                    */}
        {/* ============================================ */}
        {activeTab === "active" ? (
          <>
            {/* Filter + sort toolbar */}
            {activeOrders.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
                {/* Search */}
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Search by order #, name, or phone…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-9 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Sort + filter row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Filter pills */}
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                    {[
                      { id: "all", label: "All Active" },
                      { id: "ready", label: "Ready to Deliver" },
                      { id: "out_for_delivery", label: "In Transit" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterMode(f.id as FilterMode)}
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

                  {/* Sort toggle */}
                  <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                    <span className="px-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <ArrowUpDown size={11} className="inline" /> Sort:
                    </span>
                    {[
                      { id: "distance", label: "Nearest", icon: Route },
                      { id: "time", label: "Newest", icon: Clock },
                      { id: "value", label: "Highest ₹", icon: TrendingUp },
                    ].map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSortMode(s.id as SortMode)}
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

            {/* Orders list */}
            {processedOrders.length === 0 ? (
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
                  const cLat = order.deliveryLatitude || order.location?.lat;
                  const cLng = order.deliveryLongitude || order.location?.lng;
                  const isCurrentTracking = activeTrackingOrderId === order.id;
                  const fullAddress =
                    order.deliveryAddress?.fullAddress ||
                    (typeof order.location === "string"
                      ? order.location
                      : order.location?.address) ||
                    "Address not specified";
                  const phoneNum = order.customerPhone || order.phone || "";
                  const elapsed = getElapsedMins(order.createdAt);
                  const isLate =
                    elapsed >= 25 && order.deliveryStatus !== "out_for_delivery";
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
                      {/* Distance ribbon */}
                      <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/40 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-sm font-black text-white">
                            {order.orderNumber}
                          </span>
                          <StatusBadge status={order.deliveryStatus} orderStatus={order.status} />
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

                      {/* Body */}
                      <div className="flex-1 space-y-3 p-4">
                        {/* Customer row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-black text-white">
                              <User size={13} className="shrink-0 text-orange-400" />
                              <span className="truncate">{order.customerName}</span>
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

                        {/* Address */}
                        <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-slate-400">
                          <MapPin
                            size={12}
                            className="mt-0.5 shrink-0 text-orange-400"
                          />
                          <span className="line-clamp-2">{fullAddress}</span>
                        </p>

                        {/* ETA chip */}
                        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/40 px-2.5 py-2">
                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-400">
                            <Clock size={11} /> ETA {etaLabel}
                          </div>
                          <span className="h-3 w-px bg-white/10" />
                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Package size={11} /> {order.items?.length || 0} items
                          </div>
                        </div>

                        {/* Items preview */}
                        <p className="line-clamp-1 text-[11px] font-semibold text-slate-500">
                          {order.items
                            ?.map((i) => `${i.quantity}× ${i.name}`)
                            .join(" · ")}
                        </p>

                        {/* Instructions */}
                        {order.instructions && (
                          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold italic text-amber-300">
                            💬 {order.instructions}
                          </p>
                        )}

                        {/* Optional map (expandable) */}
                        {isMapOpen && cLat && cLng && (
                          <div className="overflow-hidden rounded-2xl border border-white/10">
                            <LiveMap
                              riderLat={riderCoords?.lat}
                              riderLng={riderCoords?.lng}
                              customerLat={cLat}
                              customerLng={cLng}
                              cafeLat={settings.cafeLat}
                              cafeLng={settings.cafeLng}
                              customerName={order.customerName}
                              onRouteCalculated={(route) => {
                                setOrderRoadStats((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    distanceKm: route.distanceKm,
                                    durationMinutes: route.durationMinutes,
                                  },
                                }));
                              }}
                              className="h-48 w-full"
                            />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 border-t border-white/5 p-3 sm:grid-cols-4">
                        {phoneNum ? (
                          <a
                            href={`tel:${phoneNum}`}
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
                          onClick={() => openNavigationApp(cLat, cLng)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/20"
                        >
                          <Navigation size={12} /> Navigate
                        </button>

                        {order.deliveryStatus !== "out_for_delivery" ? (
                          <button
                            onClick={() => handleStartDelivery(order)}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                          >
                            <Truck size={12} /> Start
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveTrackingOrderId(order.id)}
                            disabled
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/20 py-2 text-[10px] font-black uppercase tracking-wider text-blue-300"
                          >
                            <Compass size={12} className="animate-spin" /> Transit
                          </button>
                        )}

                        <button
                          onClick={() => handleMarkDelivered(order)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:scale-[1.03] active:scale-95"
                        >
                          <Check size={12} /> Done
                        </button>

                        {/* Map toggle row (full width) */}
                        {cLat && cLng && (
                          <button
                            onClick={() =>
                              setExpandedMapId(isMapOpen ? null : order.id)
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
          /* ============================================ */
          /* HISTORY TAB                                   */
          /* ============================================ */
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
                      {order.deliveryAddress?.fullAddress || "Delivered"}
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

      {/* ============================================ */}
      {/* OTP VERIFICATION MODAL                        */}
      {/* ============================================ */}
      {otpModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl sm:rounded-3xl">
            {/* Decorative glow */}
            <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl" />

            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            <button
              onClick={() => {
                setOtpModalOrder(null);
                setEnteredOtp("");
                setOtpError("");
              }}
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
                  for the 4-digit confirmation code shown on their tracking screen.
                </p>
              </div>

              {otpError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-xs font-bold text-red-300">{otpError}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtpAndDeliver} className="space-y-4">
                <div>
                  <label className="mb-2 block text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    4-Digit Customer Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoFocus
                    required
                    placeholder="• • • •"
                    value={enteredOtp}
                    onChange={(e) =>
                      setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="w-full rounded-2xl border-2 border-emerald-500/60 bg-slate-800/60 py-3.5 px-4 text-center font-mono text-3xl font-black tracking-[0.4em] text-emerald-400 placeholder-slate-600 shadow-inner transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 sm:text-4xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
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
                        <Loader2 size={14} className="animate-spin" /> Verifying…
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


