"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/store/useCartStore";
import {
  ArrowLeft,
  CheckCircle2,
  X,
  User,
  Phone,
  MapPin,
  Truck,
  ShoppingBag,
  Home,
  Compass,
  CreditCard,
  Tag,
  Sparkles,
  ShieldCheck,
  Lock,
  PartyPopper,
  Receipt,
  ChevronRight,
  BadgePercent,
  Loader2,
  Navigation,
  AlertTriangle,
  Building,
  Info,
} from "lucide-react";
import Link from "next/link";
import LocationPicker from "@/components/Map/LocationPicker";
import {
  DEFAULT_DELIVERY_SETTINGS,
  calculateDeliveryFee,
  calculateDistance,
  DeliverySettings,
} from "@/lib/delivery";
import { useAuth } from "@/contexts/AuthContext";
import { validatePromoCode, recordPromoUsage } from "@/lib/promoService";
import { PromoCode, Order } from "@/lib/types";
import {
  DEFAULT_MAIN_BRANCH_ID,
  getActiveBranches,
  resolveNearestBranch,
  getBranchMenuAvailabilityMap,
  isBranchOpen,
  type Branch,
  type ResolveNearestBranchResult,
} from "@/lib/branchService";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

/* ================================================================ */
/* Types                                                            */
/* ================================================================ */

type OrderMode = "takeaway" | "delivery";
type ToastKind = "success" | "error" | "info";

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface DeliveryCoords {
  lat: number;
  lng: number;
  distanceKm: number;
  isWithinRadius: boolean;
}

interface ResolvedAddress {
  road?: string;
  suburb?: string;
  city?: string;
  postcode?: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  on: (event: string, handler: (response: unknown) => void) => void;
  open: () => void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

/* ================================================================ */
/* SectionHeader                                                    */
/* ================================================================ */

function SectionHeader({
  icon,
  title,
  subtitle,
  step,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  step?: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/60"
        aria-hidden="true"
      >
        {icon}
        {step !== undefined && (
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-gray-900 text-[10px] font-black text-white">
            {step}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black tracking-tight text-gray-900 sm:text-base">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] font-semibold text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================ */
/* Field                                                            */
/* ================================================================ */

function Field({
  label,
  icon,
  children,
  htmlFor,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-600"
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md transition-all focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/15";

/* ================================================================ */
/* Toast                                                            */
/* ================================================================ */

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
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${iconTone}`}
          aria-hidden="true"
        >
          {state.kind === "success" ? (
            <CheckCircle2 size={15} />
          ) : state.kind === "error" ? (
            <AlertTriangle size={15} />
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

/* ================================================================ */
/* Helpers                                                          */
/* ================================================================ */

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `#ELP-${stamp}${rand}`;
}

function generateDeliveryOtp(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(1000 + (buf[0] % 9000));
  }
  return String(1000 + Math.floor(Math.random() * 9000));
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function normalisePincode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/* ================================================================ */
/* Page                                                             */
/* ================================================================ */

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCartStore();
  const { user, userProfile, loading: authLoading } = useAuth();

  const [hydrated, setHydrated] = useState(false);

  const [settings, setSettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS
  );

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    type: "takeaway" as OrderMode,
    instructions: "",
    houseFlat: "",
    streetArea: "",
    landmark: "",
    city: "Prayagraj",
    pincode: "211010",
  });

  const [deliveryCoords, setDeliveryCoords] = useState<DeliveryCoords>({
    lat: DEFAULT_DELIVERY_SETTINGS.cafeLat + 0.005,
    lng: DEFAULT_DELIVERY_SETTINGS.cafeLng + 0.005,
    distanceKm: 0.5,
    isWithinRadius: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrderSummary, setPlacedOrderSummary] = useState<Order | null>(
    null
  );
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [createdDeliveryOtp, setCreatedDeliveryOtp] = useState<string | null>(
    null
  );
  const [paymentError, setPaymentError] = useState("");

  /* multi-branch */
  const [branches, setBranches] = useState<Branch[]>([]);
  const [resolvedBranch, setResolvedBranch] = useState<Branch | null>(null);
  const [manualBranchId, setManualBranchId] = useState<string | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [cartAvailabilityWarning, setCartAvailabilityWarning] = useState<
    string[]
  >([]);

  /* promo */
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccessMsg, setPromoSuccessMsg] = useState("");

  /* feedback */
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  /* submission idempotency */
  const submitInFlightRef = useRef(false);
  const orderCreatedRef = useRef(false);

  const showToast = useCallback(
    (kind: ToastKind, message: string) => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
      const id = ++toastIdRef.current;
      setToast({ id, kind, message });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  /* -------------------------------------------------------------- */
  /* Hydration                                                     */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    setHydrated(true);
  }, []);

  /* Cleanup toast timer on unmount */
  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  /* -------------------------------------------------------------- */
  /* Auth guard                                                    */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (hydrated && !authLoading && !user) {
      router.push("/auth?redirect=/checkout");
    }
  }, [hydrated, authLoading, user, router]);

  /* -------------------------------------------------------------- */
  /* Autofill                                                      */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (userProfile) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || userProfile.name || "",
        phone: prev.phone || userProfile.phone || "",
      }));
    }
  }, [userProfile]);

  /* -------------------------------------------------------------- */
  /* Initial branch load + geolocation                             */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const activeList = await getActiveBranches();
        if (cancelled) return;
        setBranches(activeList);

        const initialBranch =
          activeList.find((b) => b.isDefault) || activeList[0];
        if (initialBranch) {
          setResolvedBranch(initialBranch);
          setSettings((prev) => ({
            ...prev,
            cafeName: initialBranch.name,
            cafeLat: initialBranch.lat,
            cafeLng: initialBranch.lng,
            deliveryRadiusKm: initialBranch.deliveryRadiusKm,
            baseDeliveryFee: initialBranch.baseDeliveryFee,
            freeDeliveryThreshold: initialBranch.freeDeliveryThreshold,
          }));
        }

        // If only one branch, no need to detect location.
        if (activeList.length === 1) return;

        if (
          typeof window !== "undefined" &&
          "geolocation" in navigator
        ) {
          setIsDetectingLocation(true);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const { latitude, longitude } = pos.coords;
              const res = resolveNearestBranch(
                latitude,
                longitude,
                activeList,
                { isDelivery: false }
              );
              setResolvedBranch(res.branch);
              setDeliveryCoords({
                lat: latitude,
                lng: longitude,
                distanceKm: res.distanceKm,
                isWithinRadius: res.isWithinRadius,
              });
              setSettings((prev) => ({
                ...prev,
                cafeName: res.branch.name,
                cafeLat: res.branch.lat,
                cafeLng: res.branch.lng,
                deliveryRadiusKm: res.branch.deliveryRadiusKm,
                baseDeliveryFee: res.branch.baseDeliveryFee,
                freeDeliveryThreshold: res.branch.freeDeliveryThreshold,
              }));
              setIsDetectingLocation(false);
            },
            () => {
              if (!cancelled) setIsDetectingLocation(false);
            },
            { timeout: 7000, enableHighAccuracy: true }
          );
        }
      } catch (err) {
        console.warn("Branch initialization error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------------- */
  /* Recompute branch when coords / type / manual branch changes   */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (branches.length === 0) return;

    if (manualBranchId) {
      const selected = branches.find((b) => b.id === manualBranchId);
      if (selected) {
        const dist =
          Math.round(
            calculateDistance(
              deliveryCoords.lat,
              deliveryCoords.lng,
              selected.lat,
              selected.lng
            ) * 100
          ) / 100;
        const within = dist <= selected.deliveryRadiusKm;
        setResolvedBranch(selected);
        setDeliveryCoords((prev) => ({
          ...prev,
          distanceKm: dist,
          isWithinRadius: within,
        }));
        setSettings((prev) => ({
          ...prev,
          cafeName: selected.name,
          cafeLat: selected.lat,
          cafeLng: selected.lng,
          deliveryRadiusKm: selected.deliveryRadiusKm,
          baseDeliveryFee: selected.baseDeliveryFee,
          freeDeliveryThreshold: selected.freeDeliveryThreshold,
        }));
        return;
      }
    }

    const res = resolveNearestBranch(
      deliveryCoords.lat,
      deliveryCoords.lng,
      branches,
      { isDelivery: formData.type === "delivery" }
    );
    setResolvedBranch(res.branch);
    setDeliveryCoords((prev) => ({
      ...prev,
      distanceKm: res.distanceKm,
      isWithinRadius: res.isWithinRadius,
    }));
    setSettings((prev) => ({
      ...prev,
      cafeName: res.branch.name,
      cafeLat: res.branch.lat,
      cafeLng: res.branch.lng,
      deliveryRadiusKm: res.branch.deliveryRadiusKm,
      baseDeliveryFee: res.branch.baseDeliveryFee,
      freeDeliveryThreshold: res.branch.freeDeliveryThreshold,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deliveryCoords.lat,
    deliveryCoords.lng,
    formData.type,
    manualBranchId,
    branches,
  ]);

  /* -------------------------------------------------------------- */
  /* Menu availability scoping per branch                          */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!resolvedBranch) return;
    let cancelled = false;

    (async () => {
      try {
        const availabilityMap = await getBranchMenuAvailabilityMap(
          resolvedBranch.id
        );
        if (cancelled) return;
        const unavailable: string[] = [];
        items.forEach((cartItem) => {
          if (
            cartItem.id &&
            availabilityMap[cartItem.id]?.available === false
          ) {
            unavailable.push(cartItem.name);
          }
        });
        setCartAvailabilityWarning(unavailable);
      } catch (err) {
        console.warn("Could not check branch menu availability:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedBranch, items]);

  /* -------------------------------------------------------------- */
  /* Live order status listener                                    */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!orderId) return;
    let unsub: (() => void) | null = null;

    unsub = onSnapshot(
      doc(db, "orders", orderId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.deliveryOtp && !createdDeliveryOtp) {
          setCreatedDeliveryOtp(String(data.deliveryOtp));
        }
      },
      (err) => {
        console.warn("Order tracking listener error:", err);
      }
    );

    return () => {
      if (unsub) unsub();
    };
  }, [orderId, createdDeliveryOtp]);

  /* -------------------------------------------------------------- */
  /* Manual location detect                                        */
  /* -------------------------------------------------------------- */

  const handleManualLocationDetect = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      showToast(
        "error",
        "Geolocation is not supported on this browser. Please pick your address on the map."
      );
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setManualBranchId(null);
        if (branches.length > 0) {
          const res = resolveNearestBranch(latitude, longitude, branches, {
            isDelivery: formData.type === "delivery",
          });
          setResolvedBranch(res.branch);
          setDeliveryCoords({
            lat: latitude,
            lng: longitude,
            distanceKm: res.distanceKm,
            isWithinRadius: res.isWithinRadius,
          });
          setSettings((prev) => ({
            ...prev,
            cafeName: res.branch.name,
            cafeLat: res.branch.lat,
            cafeLng: res.branch.lng,
            deliveryRadiusKm: res.branch.deliveryRadiusKm,
            baseDeliveryFee: res.branch.baseDeliveryFee,
            freeDeliveryThreshold: res.branch.freeDeliveryThreshold,
          }));
        }
        setIsDetectingLocation(false);
      },
      () => {
        setIsDetectingLocation(false);
        showToast(
          "error",
          "Location access denied. Please pick your address on the map or choose your outlet manually."
        );
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  }, [branches, formData.type, showToast]);

  /* -------------------------------------------------------------- */
  /* Calculations (memoized)                                       */
  /* -------------------------------------------------------------- */

  const subtotal = useMemo(() => getTotal(), [getTotal, items]);
  const isDelivery = formData.type === "delivery";

  const deliveryFee = useMemo(
    () =>
      isDelivery
        ? calculateDeliveryFee(subtotal, deliveryCoords.distanceKm, settings)
        : 0,
    [isDelivery, subtotal, deliveryCoords.distanceKm, settings]
  );

  const clampedPromoDiscount = useMemo(
    () => Math.min(Math.max(0, promoDiscount), subtotal),
    [promoDiscount, subtotal]
  );

  const discountedSubtotal = useMemo(
    () => Math.max(0, subtotal - clampedPromoDiscount),
    [subtotal, clampedPromoDiscount]
  );

  const finalTotal = useMemo(
    () => discountedSubtotal + deliveryFee,
    [discountedSubtotal, deliveryFee]
  );

  /* -------------------------------------------------------------- */
  /* Promo handlers                                                */
  /* -------------------------------------------------------------- */

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Please enter a promo code.");
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    setPromoSuccessMsg("");
    try {
      const result = await validatePromoCode(code, subtotal, user?.uid);
      if (!result.valid) {
        setPromoError(result.error || "Invalid promo code.");
        setAppliedPromo(null);
        setPromoDiscount(0);
        return;
      }
      const discount = Math.min(
        Math.max(0, result.discountAmount || 0),
        subtotal
      );
      setAppliedPromo(result.promo || null);
      setPromoDiscount(discount);
      setPromoSuccessMsg(
        result.promo?.code
          ? `Code "${result.promo.code}" applied — you saved ₹${discount}`
          : `Promo applied — you saved ₹${discount}`
      );
    } catch (err) {
      console.warn("Promo apply failed:", err);
      setPromoError("Failed to apply promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoInput, subtotal, user?.uid]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoInput("");
    setPromoError("");
    setPromoSuccessMsg("");
  }, []);

  /* -------------------------------------------------------------- */
  /* Submit flow                                                   */
  /* -------------------------------------------------------------- */

  const submitOrderWithPayment = useCallback(
    async (
      paymentDetails?: {
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
      }
    ) => {
      if (orderCreatedRef.current) return;

      if (!resolvedBranch) {
        throw new Error("No outlet resolved for this order.");
      }
      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const newOrderNum = generateOrderNumber();
      const fullAddressString = isDelivery
        ? `${formData.houseFlat}, ${formData.streetArea}${
            formData.landmark ? `, Near ${formData.landmark}` : ""
          }, ${formData.city} - ${formData.pincode}`
        : "Pickup / Takeaway";

      const otp = isDelivery ? generateDeliveryOtp() : undefined;

      const orderPayload: Record<string, unknown> = {
        orderNumber: newOrderNum,
        customerName: formData.name.trim(),
        customerPhone: formData.phone.trim(),
        phone: formData.phone.trim(),
        type: formData.type,
        orderType: formData.type,
        instructions: formData.instructions.trim(),
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        })),
        subtotal,
        discount: clampedPromoDiscount,
        discountAmount: clampedPromoDiscount,
        promoCode: appliedPromo?.code || null,
        deliveryFee: isDelivery ? deliveryFee : 0,
        total: finalTotal,
        paymentMethod: "online",
        paymentStatus: "paid",
        status: "pending",
        source: "website",
        orderSource: "website",
        branchId: resolvedBranch.id,
        branchName: resolvedBranch.name,
        branchCode: resolvedBranch.code || "BR-01",
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: Timestamp.now(),
        customerId: user.uid,
        customerEmail: user.email || "",
        razorpayOrderId: paymentDetails?.razorpayOrderId || null,
        razorpayPaymentId: paymentDetails?.razorpayPaymentId || null,
      };

      if (isDelivery) {
        orderPayload.deliveryOtp = otp;
        orderPayload.deliveryDistance = deliveryCoords.distanceKm;
        orderPayload.deliveryStatus = "pending";
        orderPayload.deliveryAddress = {
          houseFlat: formData.houseFlat,
          streetArea: formData.streetArea,
          landmark: formData.landmark,
          city: formData.city,
          pincode: formData.pincode,
          fullAddress: fullAddressString,
        };
        orderPayload.deliveryLatitude = deliveryCoords.lat;
        orderPayload.deliveryLongitude = deliveryCoords.lng;
        orderPayload.customerLocation = {
          lat: deliveryCoords.lat,
          lng: deliveryCoords.lng,
          address: fullAddressString,
        };
        orderPayload.location = {
          address: fullAddressString,
          pincode: formData.pincode,
          lat: deliveryCoords.lat,
          lng: deliveryCoords.lng,
        };
      } else {
        orderPayload.location = "Pickup at Counter";
      }

      // Firestore write — fail loudly; do not clear the cart on failure.
      const docRef = await addDoc(collection(db, "orders"), orderPayload);
      orderCreatedRef.current = true;

      // Record promo usage (best-effort, but do not fail the order).
      if (appliedPromo && clampedPromoDiscount > 0) {
        try {
          await recordPromoUsage(
            appliedPromo,
            newOrderNum,
            user.uid,
            clampedPromoDiscount
          );
        } catch (err) {
          console.warn("Promo usage recording failed:", err);
        }
      }

      setOrderId(docRef.id);
      setOrderNumber(newOrderNum);
      setCreatedDeliveryOtp(otp || null);
      setPlacedOrderSummary({
        id: docRef.id,
        ...(orderPayload as unknown as Order),
      });

      try {
        window.localStorage.setItem("activeOrderId", docRef.id);
      } catch {
        /* ignore */
      }

      clearCart();
    },
    [
      resolvedBranch,
      user,
      isDelivery,
      formData,
      items,
      subtotal,
      clampedPromoDiscount,
      appliedPromo,
      deliveryFee,
      finalTotal,
      deliveryCoords,
      clearCart,
    ]
  );

  const initiateRazorpayCheckout = useCallback(async () => {
    if (submitInFlightRef.current) return;

    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      setPaymentError(
        "Payment gateway is not configured. Please contact support."
      );
      return;
    }

    const amountInPaise = Math.round(finalTotal * 100);
    if (amountInPaise < 100) {
      setPaymentError("Minimum payable order amount is ₹1.00");
      return;
    }

    const RazorpayCtor = (window as unknown as { Razorpay?: RazorpayConstructor })
      .Razorpay;
    if (!RazorpayCtor) {
      setPaymentError(
        "Payment gateway is still loading. Please wait a moment and try again."
      );
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setPaymentError("");

    try {
      const receiptId = `rcpt_${Date.now()}`;
      let orderIdFromBackend: string | undefined;

      try {
        const res = await fetch("/api/create-order/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // NOTE: The server MUST recompute this from the cart/order
            // context. This is a hint only.
            amount: amountInPaise,
            currency: "INR",
            receipt: receiptId,
          }),
        });
        if (res.ok) {
          const orderData = await res.json();
          orderIdFromBackend = orderData.order_id;
        }
      } catch (apiErr) {
        console.warn("Backend unavailable, using standard checkout.", apiErr);
      }

      const options: RazorpayOptions = {
        key: razorpayKey,
        amount: amountInPaise,
        currency: "INR",
        name: "EL PRESTO Cafeteria",
        description: `Order Payment for ${formData.name || "Customer"}`,
        ...(orderIdFromBackend ? { order_id: orderIdFromBackend } : {}),
        prefill: {
          name: formData.name,
          contact: formData.phone,
          email: user?.email || "",
        },
        theme: { color: "#D92312" },
        handler: async (response) => {
          try {
            // Signature verification — fail closed.
            if (
              response.razorpay_signature &&
              response.razorpay_order_id
            ) {
              try {
                const verifyRes = await fetch("/api/verify-payment/", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
                if (!verifyRes.ok) {
                  setPaymentError(
                    "Payment could not be verified. Please contact support with your payment ID."
                  );
                  setIsSubmitting(false);
                  submitInFlightRef.current = false;
                  return;
                }
                const verifyData = await verifyRes.json();
                if (verifyData.success !== true) {
                  setPaymentError(
                    "Payment verification was rejected. Please contact support."
                  );
                  setIsSubmitting(false);
                  submitInFlightRef.current = false;
                  return;
                }
              } catch (verErr) {
                console.error("Signature verification error:", verErr);
                setPaymentError(
                  "Could not reach the verification server. Please contact support before retrying."
                );
                setIsSubmitting(false);
                submitInFlightRef.current = false;
                return;
              }
            }

            await submitOrderWithPayment({
              razorpayOrderId:
                response.razorpay_order_id ||
                orderIdFromBackend ||
                "standard_checkout",
              razorpayPaymentId: response.razorpay_payment_id,
            });
          } catch (handlerErr) {
            console.error("Order completion error:", handlerErr);
            setPaymentError(
              handlerErr instanceof Error
                ? `Could not finalize order: ${handlerErr.message}`
                : "Could not finalize order. Please contact support."
            );
          } finally {
            setIsSubmitting(false);
            submitInFlightRef.current = false;
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            submitInFlightRef.current = false;
            setPaymentError(
              "Payment window was closed before completion. You can retry anytime."
            );
          },
        },
      };

      const rzp = new RazorpayCtor(options);
      rzp.on("payment.failed", (failResponse: unknown) => {
        const fr = failResponse as {
          error?: { description?: string };
        };
        const reason =
          fr?.error?.description ||
          "Payment failed or was declined by the bank.";
        setPaymentError(`⚠️ ${reason} Please choose another method or retry.`);
        setIsSubmitting(false);
        submitInFlightRef.current = false;
      });
      rzp.open();
    } catch (err) {
      console.error("Error launching Razorpay:", err);
      setPaymentError(
        err instanceof Error
          ? err.message
          : "Failed to start payment. Please try again."
      );
      setIsSubmitting(false);
      submitInFlightRef.current = false;
    }
  }, [finalTotal, formData, user, submitOrderWithPayment]);

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (items.length === 0) {
        showToast("error", "Your cart is empty.");
        return;
      }
      if (!resolvedBranch) {
        showToast("error", "No outlet resolved for this order.");
        return;
      }
      if (isDelivery && !deliveryCoords.isWithinRadius) {
        showToast(
          "error",
          `Delivery is not available to this location. It is outside our ${settings.deliveryRadiusKm} km radius.`
        );
        return;
      }
      if (isDelivery) {
        if (!formData.houseFlat.trim() || !formData.streetArea.trim()) {
          showToast(
            "error",
            "Please fill in your flat/house number and street/area."
          );
          return;
        }
      }
      await initiateRazorpayCheckout();
    },
    [
      items.length,
      resolvedBranch,
      isDelivery,
      deliveryCoords.isWithinRadius,
      settings.deliveryRadiusKm,
      formData.houseFlat,
      formData.streetArea,
      initiateRazorpayCheckout,
      showToast,
    ]
  );

  /* -------------------------------------------------------------- */
  /* Loading                                                       */
  /* -------------------------------------------------------------- */

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-orange-500" />
          <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
            Loading checkout…
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* ORDER CONFIRMED                                                  */
  /* ================================================================ */

  if (orderNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-8 sm:px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-6 text-center shadow-[0_25px_70px_-25px_rgba(217,35,18,0.35)] backdrop-blur-2xl sm:p-10">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl"
            />

            <div className="relative flex flex-col items-center">
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"
                />
                <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-2xl shadow-emerald-500/40 ring-4 ring-white">
                  <PartyPopper size={36} />
                </div>
              </div>

              <h1 className="mt-5 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
                Order Confirmed!
              </h1>
              <p className="mt-1 max-w-md text-sm font-semibold text-gray-500">
                {isDelivery
                  ? "Your delicious meal is being prepared and will be delivered soon!"
                  : "Your order has been sent to the kitchen for pickup."}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-4 text-left shadow-sm backdrop-blur-md sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Order Number
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
                    {orderNumber}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                  {isDelivery ? "🏠 Home Delivery" : "🛍️ Takeaway"}
                </span>
              </div>

              {isDelivery && createdDeliveryOtp && (
                <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-4 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
                      <span className="text-lg" aria-hidden="true">
                        🔑
                      </span>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Delivery OTP
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-800/80">
                      Share this PIN with the delivery partner.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl border-2 border-emerald-400 bg-white/95 px-5 py-2 shadow-md">
                    <span className="select-all font-mono text-2xl font-black tracking-[0.4em] text-emerald-700 sm:text-3xl">
                      {createdDeliveryOtp}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-y border-gray-200/70 py-3">
                {placedOrderSummary?.items?.map((item, idx) => (
                  <div
                    key={`${item.id || item.name}-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2 font-semibold text-gray-700">
                      <span className="mr-1.5 font-black text-orange-600">
                        {item.quantity}×
                      </span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-black text-gray-900">
                      ₹{Math.round((item.price || 0) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-bold">
                    ₹{Math.round(placedOrderSummary?.subtotal || 0)}
                  </span>
                </div>
                {(placedOrderSummary?.discount || 0) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>
                      Promo
                      {placedOrderSummary?.promoCode
                        ? ` (${placedOrderSummary.promoCode})`
                        : ""}
                    </span>
                    <span>
                      -₹{Math.round(placedOrderSummary?.discount || 0)}
                    </span>
                  </div>
                )}
                {isDelivery && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span className="font-bold">
                      {(placedOrderSummary?.deliveryFee || 0) === 0
                        ? "Free"
                        : `₹${Math.round(placedOrderSummary?.deliveryFee || 0)}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200/70 pt-3">
                  <span className="text-sm font-black text-gray-900">
                    Paid Total
                  </span>
                  <span className="text-xl font-black text-orange-600">
                    ₹{Math.round(placedOrderSummary?.total || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/track"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                Track Live Order <ChevronRight size={16} />
              </Link>
              <Link
                href="/menu"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/70 py-3.5 text-sm font-black text-gray-700 shadow-sm backdrop-blur-md transition-all hover:bg-white active:scale-95"
              >
                Order More
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /* CHECKOUT FORM                                                    */
  /* ================================================================ */

  return (
    <>
      <Toast state={toast} onDismiss={dismissToast} />

      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <Link
              href="/menu"
              aria-label="Back to menu"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/60 bg-white/70 text-gray-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-orange-600"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
                Checkout
              </h1>
              <p className="truncate text-[11px] font-semibold text-gray-500 sm:text-xs">
                Complete your details & proceed to secure payment
              </p>
            </div>
            <div className="ml-auto hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 shadow-sm sm:flex">
              <ShieldCheck size={12} aria-hidden="true" /> Secure
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:gap-6">
            {/* LEFT: FORM */}
            <div className="space-y-5">
              <form
                id="checkout-form"
                onSubmit={handleFormSubmit}
                className="space-y-5"
                noValidate
              >
                {/* Contact */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={1}
                    icon={<User size={18} />}
                    title="Contact Information"
                    subtitle="We'll use this to reach you about your order"
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Full Name"
                      htmlFor="customer-name"
                      icon={<User size={11} />}
                    >
                      <input
                        id="customer-name"
                        required
                        type="text"
                        autoComplete="name"
                        className={inputCls}
                        placeholder="e.g. Rahul Sharma"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label="Phone Number"
                      htmlFor="customer-phone"
                      icon={<Phone size={11} />}
                    >
                      <input
                        id="customer-phone"
                        required
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        className={inputCls}
                        placeholder="10-digit mobile number"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: normalisePhone(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>
                </div>

                {/* Order mode */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={2}
                    icon={<Truck size={18} />}
                    title="Delivery or Pickup"
                    subtitle="Choose how you want to receive your order"
                  />

                  <div
                    role="radiogroup"
                    aria-label="Order mode"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={formData.type === "takeaway"}
                      onClick={() =>
                        setFormData({ ...formData, type: "takeaway" })
                      }
                      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        formData.type === "takeaway"
                          ? "border-transparent bg-gradient-to-br from-[#D92312] to-[#B8190B] text-white shadow-lg shadow-red-500/25"
                          : "border-white/60 bg-white/70 text-gray-800 shadow-sm hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"
                      />
                      <div className="relative flex items-start gap-3">
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${
                            formData.type === "takeaway"
                              ? "bg-white/20 text-white"
                              : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          <ShoppingBag size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">
                            Pickup / Takeaway
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] font-semibold ${
                              formData.type === "takeaway"
                                ? "text-white/80"
                                : "text-gray-500"
                            }`}
                          >
                            Collect at counter · No delivery fee
                          </p>
                        </div>
                        {formData.type === "takeaway" && (
                          <CheckCircle2
                            size={18}
                            className="shrink-0 text-white"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={formData.type === "delivery"}
                      onClick={() =>
                        setFormData({ ...formData, type: "delivery" })
                      }
                      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        formData.type === "delivery"
                          ? "border-transparent bg-gradient-to-br from-[#D92312] to-[#B8190B] text-white shadow-lg shadow-red-500/25"
                          : "border-white/60 bg-white/70 text-gray-800 shadow-sm hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"
                      />
                      <div className="relative flex items-start gap-3">
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors ${
                            formData.type === "delivery"
                              ? "bg-white/20 text-white"
                              : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          <Truck size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">Home Delivery</p>
                          <p
                            className={`mt-0.5 text-[11px] font-semibold ${
                              formData.type === "delivery"
                                ? "text-white/80"
                                : "text-gray-500"
                            }`}
                          >
                            Delivered to your door · ₹
                            {settings.baseDeliveryFee}
                          </p>
                        </div>
                        {formData.type === "delivery" && (
                          <CheckCircle2
                            size={18}
                            className="shrink-0 text-white"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Serving Outlet */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <SectionHeader
                      step={3}
                      icon={<Building size={18} />}
                      title="Serving Outlet"
                      subtitle={
                        formData.type === "delivery"
                          ? "Nearest kitchen dispatching your delivery"
                          : "Kitchen counter fulfilling your pickup"
                      }
                    />
                    <button
                      type="button"
                      onClick={handleManualLocationDetect}
                      disabled={isDetectingLocation}
                      className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:opacity-50"
                    >
                      {isDetectingLocation ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />{" "}
                          Detecting…
                        </>
                      ) : (
                        <>
                          <Navigation size={13} /> Auto-Detect Outlet
                        </>
                      )}
                    </button>
                  </div>

                  {resolvedBranch && (
                    <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur-md">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] font-black text-orange-600">
                              {resolvedBranch.code || "OUTLET"}
                            </span>
                            <h3 className="truncate text-sm font-black text-gray-900">
                              {resolvedBranch.name}
                            </h3>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                            {resolvedBranch.address}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isBranchOpen(resolvedBranch) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-500/20">
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                              />
                              Open Now ·{" "}
                              {resolvedBranch.operatingHours?.closeTime
                                ? "Until " +
                                  resolvedBranch.operatingHours.closeTime
                                : "Active"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-500/20">
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                              />
                              Closed · Opens{" "}
                              {resolvedBranch.operatingHours?.openTime ||
                                "10:00"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-[11px] font-semibold text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          📍{" "}
                          <span className="font-bold text-gray-900">
                            {deliveryCoords.distanceKm} km
                          </span>{" "}
                          from your location
                        </span>
                        <span className="text-gray-300">•</span>
                        <span>
                          Delivery Radius:{" "}
                          <span className="font-bold text-gray-900">
                            {resolvedBranch.deliveryRadiusKm} km
                          </span>
                        </span>
                        {isDelivery && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>
                              Delivery Fee:{" "}
                              <span className="font-bold text-orange-600">
                                ₹{deliveryFee === 0 ? "Free" : deliveryFee}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {branches.length > 1 && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <label
                            htmlFor="branch-override"
                            className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400"
                          >
                            Switch Fulfilling Outlet (Manual Override)
                          </label>
                          <select
                            id="branch-override"
                            value={manualBranchId || resolvedBranch.id}
                            onChange={(e) =>
                              setManualBranchId(e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:border-orange-400 focus:outline-none"
                          >
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {isDelivery && !deliveryCoords.isWithinRadius && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/95 p-3.5 text-xs text-red-800"
                    >
                      <AlertTriangle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-black text-red-900">
                          Delivery Not Available to This Area
                        </p>
                        <p className="mt-0.5">
                          Sorry, we do not currently deliver to your location
                          ({deliveryCoords.distanceKm} km away). Our maximum
                          delivery radius from{" "}
                          {resolvedBranch?.name || "our hub"} is{" "}
                          {settings.deliveryRadiusKm} km.
                        </p>
                        <p className="mt-1 font-bold text-red-700">
                          👉 Please choose Takeaway / Pickup, or select a
                          delivery address closer to our kitchen.
                        </p>
                      </div>
                    </div>
                  )}

                  {cartAvailabilityWarning.length > 0 && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/95 p-3.5 text-xs text-amber-900"
                    >
                      <AlertTriangle
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-black text-amber-950">
                          Branch Menu Availability Notice
                        </p>
                        <p className="mt-0.5">
                          The following item
                          {cartAvailabilityWarning.length > 1
                            ? "s are"
                            : " is"}{" "}
                          currently marked unavailable at this branch (
                          {resolvedBranch?.name}):
                        </p>
                        <p className="mt-1 font-black text-amber-800">
                          {cartAvailabilityWarning.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery details */}
                {isDelivery && (
                  <div className="space-y-4 rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                    <SectionHeader
                      step={4}
                      icon={<MapPin size={18} />}
                      title="Delivery Address"
                      subtitle={`Delivery available within ${settings.deliveryRadiusKm} km radius`}
                    />

                    <LocationPicker
                      cafeLat={settings.cafeLat}
                      cafeLng={settings.cafeLng}
                      radiusKm={settings.deliveryRadiusKm}
                      initialLat={deliveryCoords.lat}
                      initialLng={deliveryCoords.lng}
                      onLocationSelect={(data) => setDeliveryCoords(data)}
                      onAddressResolved={(addr: ResolvedAddress) => {
                        setFormData((prev) => ({
                          ...prev,
                          streetArea:
                            prev.streetArea || addr.road || addr.suburb || "",
                          city: addr.city || prev.city || "Prayagraj",
                          pincode: addr.postcode || prev.pincode || "211010",
                        }));
                      }}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field
                        label="Flat / House / Room"
                        htmlFor="delivery-house"
                        icon={<Home size={11} />}
                      >
                        <input
                          id="delivery-house"
                          required={isDelivery}
                          type="text"
                          autoComplete="address-line1"
                          className={inputCls}
                          placeholder="e.g. Room 304, Hostel A"
                          value={formData.houseFlat}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              houseFlat: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Street / Area / Campus"
                        htmlFor="delivery-street"
                        icon={<Building size={11} />}
                      >
                        <input
                          id="delivery-street"
                          required={isDelivery}
                          type="text"
                          autoComplete="address-line2"
                          className={inputCls}
                          placeholder="e.g. UCER Campus, Naini"
                          value={formData.streetArea}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              streetArea: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <Field
                      label="Landmark (optional)"
                      htmlFor="delivery-landmark"
                      icon={<Compass size={11} />}
                    >
                      <input
                        id="delivery-landmark"
                        type="text"
                        className={inputCls}
                        placeholder="e.g. Near Library Gate"
                        value={formData.landmark}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            landmark: e.target.value,
                          })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City" htmlFor="delivery-city">
                        <input
                          id="delivery-city"
                          required={isDelivery}
                          type="text"
                          autoComplete="address-level2"
                          className={inputCls}
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Pincode" htmlFor="delivery-pincode">
                        <input
                          id="delivery-pincode"
                          required={isDelivery}
                          type="text"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={6}
                          className={inputCls}
                          placeholder="211010"
                          value={formData.pincode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              pincode: normalisePincode(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>

                    {!deliveryCoords.isWithinRadius && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3"
                      >
                        <X
                          size={16}
                          className="mt-0.5 shrink-0 text-red-500"
                          aria-hidden="true"
                        />
                        <p className="text-xs font-bold text-red-700">
                          This location is outside our{" "}
                          {settings.deliveryRadiusKm} km delivery radius.
                          Please pick a closer point or switch to Pickup.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={isDelivery ? 5 : 4}
                    icon={<CreditCard size={18} />}
                    title="Payment Method"
                    subtitle="Secure online payment via Razorpay"
                  />

                  <div className="flex items-start gap-3 rounded-2xl border-2 border-orange-500 bg-orange-500/10 p-4 shadow-md ring-1 ring-orange-400">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                      <CreditCard size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-black text-gray-900">
                          Razorpay
                        </p>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                          Secure &amp; Instant
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                        UPI · Cards · Netbanking · Wallets
                      </p>
                    </div>
                    <CheckCircle2
                      size={18}
                      className="shrink-0 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>

                  {paymentError && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3"
                    >
                      <X
                        size={16}
                        className="mt-0.5 shrink-0 text-red-500"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-bold text-red-700">
                        {paymentError}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    icon={<Receipt size={18} />}
                    title="Special Instructions"
                    subtitle="Anything we should know? (optional)"
                  />
                  <label htmlFor="checkout-instructions" className="sr-only">
                    Special instructions
                  </label>
                  <textarea
                    id="checkout-instructions"
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="e.g. Extra spicy, call upon arrival, leave at gate…"
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        instructions: e.target.value,
                      })
                    }
                  />
                </div>
              </form>
            </div>

            {/* RIGHT: SUMMARY */}
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start">
              <div className="flex max-h-full flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/60 shadow-[0_20px_60px_-25px_rgba(217,35,18,0.3)] backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-white/60 bg-gradient-to-r from-orange-50/80 to-amber-50/50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                      <Receipt size={15} />
                    </div>
                    <h2 className="text-sm font-black text-gray-900">
                      Order Summary
                    </h2>
                  </div>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600 shadow-sm">
                    {items.reduce((s, i) => s + i.quantity, 0)} items
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700">
                            {item.quantity}×
                          </span>
                          <span className="truncate font-semibold text-gray-800">
                            {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-black text-gray-900">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Promo */}
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
                      <Tag size={13} className="text-orange-500" />
                      Promo Code
                    </div>

                    {!appliedPromo ? (
                      <div className="flex gap-2">
                        <label htmlFor="promo-input" className="sr-only">
                          Promo code
                        </label>
                        <input
                          id="promo-input"
                          type="text"
                          placeholder="Enter code"
                          value={promoInput}
                          onChange={(e) =>
                            setPromoInput(e.target.value.toUpperCase())
                          }
                          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs font-black uppercase text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                        >
                          {promoLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <BadgePercent
                            size={16}
                            className="shrink-0 text-emerald-600"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-black text-emerald-900">
                              {appliedPromo.code}
                            </p>
                            <p className="truncate text-[10px] font-bold text-emerald-700">
                              Saved ₹{Math.round(clampedPromoDiscount)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          aria-label="Remove promo code"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {promoError && (
                      <p
                        role="alert"
                        className="mt-2 text-[11px] font-bold text-red-600"
                      >
                        {promoError}
                      </p>
                    )}
                    {promoSuccessMsg && !promoError && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-[11px] font-bold text-emerald-600"
                      >
                        ✓ {promoSuccessMsg}
                      </p>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="space-y-2 rounded-2xl border border-white/70 bg-white/60 p-4 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span className="font-semibold">Subtotal</span>
                      <span className="font-black text-gray-900">
                        ₹{Math.round(subtotal)}
                      </span>
                    </div>

                    {clampedPromoDiscount > 0 && (
                      <div className="flex justify-between font-black text-emerald-600">
                        <span>Promo Discount</span>
                        <span>−₹{Math.round(clampedPromoDiscount)}</span>
                      </div>
                    )}

                    {isDelivery && (
                      <div className="flex items-center justify-between text-gray-600">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Truck size={13} className="text-orange-500" />
                          Delivery Fee
                        </span>
                        {deliveryFee === 0 ? (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                            Free
                          </span>
                        ) : (
                          <span className="font-black text-gray-900">
                            ₹{Math.round(deliveryFee)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-200/70 pt-3">
                      <span className="text-sm font-black text-gray-900">
                        Total Amount
                      </span>
                      <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-2xl font-black text-transparent">
                        ₹{Math.round(finalTotal)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={
                      isSubmitting ||
                      items.length === 0 ||
                      (isDelivery && !deliveryCoords.isWithinRadius)
                    }
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#D92312] to-[#B8190B] py-4 text-sm font-black text-white shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] hover:shadow-red-500/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    />
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing Payment…
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        Pay ₹{Math.round(finalTotal)} Securely
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                    <span className="flex items-center gap-1">
                      <ShieldCheck
                        size={11}
                        className="text-emerald-500"
                        aria-hidden="true"
                      />{" "}
                      100% Secure
                    </span>
                    <span className="h-3 w-px bg-gray-300" />
                    <span className="flex items-center gap-1">
                      <Sparkles
                        size={11}
                        className="text-orange-500"
                        aria-hidden="true"
                      />{" "}
                      Instant Confirm
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
    </>
  );
}