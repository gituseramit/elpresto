"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/store/useCartStore";
import {
  ArrowLeft,
  CheckCircle2,
  QrCode,
  X,
  User,
  Phone,
  MapPin,
  Truck,
  ShoppingBag,
  Building,
  Home,
  Compass,
  CreditCard,
  Tag,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Lock,
  PartyPopper,
  Receipt,
  ChevronRight,
  BadgePercent,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import LocationPicker from "@/components/Map/LocationPicker";
import {
  DEFAULT_DELIVERY_SETTINGS,
  calculateDeliveryFee,
  DeliverySettings,
} from "@/lib/delivery";
import { useAuth } from "@/contexts/AuthContext";
import { validatePromoCode, recordPromoUsage } from "@/lib/promoService";
import { PromoCode } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Reusable: Section header                                            */
/* ------------------------------------------------------------------ */
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
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/60">
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

/* ------------------------------------------------------------------ */
/* Reusable: Text input                                                */
/* ------------------------------------------------------------------ */
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
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-600">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm backdrop-blur-md transition-all focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/15";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal, clearCart } = useCartStore();
  const [hydrated, setHydrated] = useState(false);
  const { user, userProfile, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS
  );

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    type: "takeaway" as "takeaway" | "delivery",
    instructions: "",
    houseFlat: "",
    streetArea: "",
    landmark: "",
    city: "Prayagraj",
    pincode: "211010",
  });

  const [deliveryCoords, setDeliveryCoords] = useState({
    lat: DEFAULT_DELIVERY_SETTINGS.cafeLat + 0.005,
    lng: DEFAULT_DELIVERY_SETTINGS.cafeLng + 0.005,
    distanceKm: 0.5,
    isWithinRadius: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "upi_qr">("razorpay");
  const [placedOrderSummary, setPlacedOrderSummary] = useState<any>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [liveStatus, setLiveStatus] = useState("preparing");
  const [liveDeliveryStatus, setLiveDeliveryStatus] = useState("pending");
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [createdDeliveryOtp, setCreatedDeliveryOtp] = useState<string | null>(null);

  /* promo */
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccessMsg, setPromoSuccessMsg] = useState("");

  useEffect(() => setHydrated(true), []);

  /* auth guard */
  useEffect(() => {
    if (hydrated && !authLoading && !user) {
      router.push("/auth?redirect=/checkout");
    }
  }, [hydrated, authLoading, user, router]);

  /* autofill */
  useEffect(() => {
    if (userProfile) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || userProfile.name || "",
        phone: prev.phone || userProfile.phone || "",
      }));
    }
  }, [userProfile]);

  /* fetch settings */
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
            cafeLat: data.cafeLat || data.restaurantLat || DEFAULT_DELIVERY_SETTINGS.cafeLat,
            cafeLng: data.cafeLng || data.restaurantLng || DEFAULT_DELIVERY_SETTINGS.cafeLng,
            deliveryRadiusKm: data.deliveryRadiusKm || 7,
            baseDeliveryFee:
              data.baseDeliveryFee !== undefined ? data.baseDeliveryFee : 30,
            freeDeliveryThreshold: data.freeDeliveryThreshold || 499,
            deliveryEnabled:
              data.deliveryEnabled !== undefined ? data.deliveryEnabled : true,
          });
        }
      } catch (err) {
        console.warn("Using default delivery settings:", err);
      }
    };
    fetchSettings();
  }, []);

  /* realtime order listener */
  useEffect(() => {
    let unsubscribe: any;
    const listenToOrder = async () => {
      if (!orderId) return;
      try {
        const { doc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        unsubscribe = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setLiveStatus(data.status);
            if (data.deliveryStatus) setLiveDeliveryStatus(data.deliveryStatus);
            if (data.deliveryOtp) setCreatedDeliveryOtp(data.deliveryOtp);
          }
        });
      } catch (err) {
        console.error("Tracking error:", err);
      }
    };
    listenToOrder();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [orderId]);

  /* calculations */
  const subtotal = getTotal();
  const isDelivery = formData.type === "delivery";
  const deliveryFee = isDelivery
    ? calculateDeliveryFee(subtotal, deliveryCoords.distanceKm, settings)
    : 0;
  const discountedSubtotal = Math.max(0, subtotal - promoDiscount);
  const finalTotal = discountedSubtotal + deliveryFee;
  const totalAmountStr = finalTotal.toFixed(2);

  const upiId =
    process.env.NEXT_PUBLIC_UPI_ID || "thanksamitkeshari-2@okaxis";
  const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=ELPESTRO&am=${totalAmountStr}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    upiString
  )}`;

  /* promo */
  const handleApplyPromo = async () => {
    if (!promoInput.trim()) {
      setPromoError("Please enter a promo code.");
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    setPromoSuccessMsg("");
    try {
      const result = await validatePromoCode(promoInput, subtotal, user?.uid);
      if (!result.valid) {
        setPromoError(result.error || "Invalid promo code.");
        setAppliedPromo(null);
        setPromoDiscount(0);
      } else {
        setAppliedPromo(result.promo || null);
        setPromoDiscount(result.discountAmount);
        setPromoSuccessMsg(
          `Code "${result.promo?.code}" applied — you saved ₹${result.discountAmount}`
        );
      }
    } catch (err) {
      setPromoError("Failed to apply promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoInput("");
    setPromoError("");
    setPromoSuccessMsg("");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (isDelivery && !deliveryCoords.isWithinRadius) {
      alert(
        `Sorry, delivery is not available at this location. It is outside our ${settings.deliveryRadiusKm} km delivery radius.`
      );
      return;
    }
    setPaymentError("");
    if (paymentMethod === "upi_qr") {
      setShowQR(true);
      return;
    }
    await initiateRazorpayCheckout();
  };

  const initiateRazorpayCheckout = async () => {
    setIsSubmitting(true);
    setPaymentError("");
    try {
      const amountInPaise = Math.round(finalTotal * 100);
      if (amountInPaise < 100) {
        alert("Minimum payable order amount is ₹1.00");
        setIsSubmitting(false);
        return;
      }
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        alert(
          "Payment gateway is initializing. Please check your internet connection and try again."
        );
        setIsSubmitting(false);
        return;
      }

      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_live_TdSLGs65hSMWBD";
      const receiptId = `rcpt_${Date.now()}`;
      let orderIdFromBackend: string | undefined;

      try {
        const res = await fetch("/api/create-order/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
        console.warn("Backend unavailable, using standard checkout.");
      }

      const options: any = {
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
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) {
          try {
            if (response.razorpay_signature && response.razorpay_order_id) {
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
                if (verifyRes.ok) {
                  const verifyData = await verifyRes.json();
                  if (!verifyData.success) {
                    setPaymentError(
                      "Payment verification rejected by server. Please contact support."
                    );
                    setIsSubmitting(false);
                    return;
                  }
                }
              } catch (verErr) {
                console.warn("Signature verification skipped:", verErr);
              }
            }
            await submitOrderWithPayment("online", "paid", {
              razorpayOrderId:
                response.razorpay_order_id || orderIdFromBackend || "standard_checkout",
              razorpayPaymentId: response.razorpay_payment_id,
            });
          } catch (handlerErr) {
            console.error("Order completion error:", handlerErr);
            setPaymentError(
              "Error recording order in database. Please contact support."
            );
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
            setPaymentError(
              "Payment window was closed before completion. You can retry anytime."
            );
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (failResponse: any) {
        console.error("Payment failed:", failResponse.error);
        const reason =
          failResponse.error?.description ||
          "Payment failed or was declined by bank.";
        setPaymentError(`⚠️ ${reason} Please choose another method or retry.`);
        setIsSubmitting(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error("Error launching Razorpay:", err);
      setPaymentError(err.message || "Failed to start payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  const submitOrderWithPayment = async (
    chosenMethod: "cash" | "online" | "upi_qr",
    chosenPaymentStatus: "paid" | "pending",
    paymentDetails?: { razorpayOrderId?: string; razorpayPaymentId?: string }
  ) => {
    setIsSubmitting(true);
    try {
      const newOrderNum = `#ELP-${Math.floor(100 + Math.random() * 900)}`;
      const fullAddressString = isDelivery
        ? `${formData.houseFlat}, ${formData.streetArea}${
            formData.landmark ? `, Near ${formData.landmark}` : ""
          }, ${formData.city} - ${formData.pincode}`
        : "Pickup / Takeaway";

      const orderData: any = {
        orderNumber: newOrderNum,
        customerName: formData.name,
        customerPhone: formData.phone,
        phone: formData.phone,
        type: formData.type,
        orderType: formData.type,
        instructions: formData.instructions || "",
        items: items,
        subtotal: subtotal,
        discount: promoDiscount,
        discountAmount: promoDiscount,
        promoCode: appliedPromo?.code || null,
        deliveryFee: isDelivery ? deliveryFee : 0,
        total: finalTotal,
        paymentMethod: chosenMethod,
        paymentStatus: chosenPaymentStatus,
        status: "pending",
        source: "website",
        createdAt: new Date().toISOString(),
        razorpayOrderId: paymentDetails?.razorpayOrderId || null,
        razorpayPaymentId: paymentDetails?.razorpayPaymentId || null,
        ...(user ? { customerId: user.uid, customerEmail: user.email || "" } : {}),
      };

      if (isDelivery) {
        const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
        orderData.deliveryOtp = randomOtp;
        setCreatedDeliveryOtp(randomOtp);
        orderData.deliveryDistance = deliveryCoords.distanceKm;
        orderData.deliveryStatus = "pending";
        orderData.deliveryAddress = {
          houseFlat: formData.houseFlat,
          streetArea: formData.streetArea,
          landmark: formData.landmark,
          city: formData.city,
          pincode: formData.pincode,
          fullAddress: fullAddressString,
        };
        orderData.deliveryLatitude = deliveryCoords.lat;
        orderData.deliveryLongitude = deliveryCoords.lng;
        orderData.location = {
          address: fullAddressString,
          pincode: formData.pincode,
          lat: deliveryCoords.lat,
          lng: deliveryCoords.lng,
        };
      } else {
        orderData.location = "Pickup at Counter";
      }

      setPlacedOrderSummary(orderData);

      try {
        const { collection, addDoc, Timestamp } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        orderData.createdAt = Timestamp.now();
        orderData.createdAtISO = new Date().toISOString();
        const docRef = await addDoc(collection(db, "orders"), orderData);
        setOrderId(docRef.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("activeOrderId", docRef.id);
        }
        if (appliedPromo) {
          await recordPromoUsage(appliedPromo, newOrderNum, user?.uid, promoDiscount);
        }
      } catch (err) {
        console.warn("Firebase save fallback:", err);
        setOrderId("mock-" + Date.now());
      }

      clearCart();
      setShowQR(false);
      setOrderNumber(newOrderNum);
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("There was an error placing your order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOnlinePayment = () => {
    submitOrderWithPayment("upi_qr", "paid");
  };

  /* ---------------- loading ---------------- */
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/60 to-orange-50/40">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-b-orange-500" />
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
            {/* glow blobs */}
            <span className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />

            <div className="relative flex flex-col items-center">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
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

            {/* summary card */}
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
                  {formData.type === "delivery" ? "🏠 Home Delivery" : "🛍️ Takeaway"}
                </span>
              </div>

              {/* OTP */}
              {isDelivery && createdDeliveryOtp && (
                <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-400/70 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-4 sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left">
                    <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
                      <span className="text-lg">🔑</span>
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

              {/* items */}
              <div className="space-y-2 border-y border-gray-200/70 py-3">
                {placedOrderSummary?.items?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2 font-semibold text-gray-700">
                      <span className="mr-1.5 font-black text-orange-600">
                        {item.quantity}×
                      </span>
                      {item.name}
                    </span>
                    <span className="shrink-0 font-black text-gray-900">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              {/* totals */}
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-bold">
                    ₹{Math.round(placedOrderSummary?.subtotal || 0)}
                  </span>
                </div>
                {placedOrderSummary?.discount > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>Promo ({placedOrderSummary?.promoCode})</span>
                    <span>-₹{placedOrderSummary.discount}</span>
                  </div>
                )}
                {isDelivery && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee</span>
                    <span className="font-bold">
                      {placedOrderSummary?.deliveryFee === 0
                        ? "Free"
                        : `₹${placedOrderSummary?.deliveryFee}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200/70 pt-3">
                  <span className="text-sm font-black text-gray-900">Paid Total</span>
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
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-rose-50/50 px-3 py-6 sm:px-4 sm:py-8">
        <div className="container mx-auto max-w-6xl">
          {/* header */}
          <div className="mb-6 flex items-center gap-3">
            <Link
              href="/menu"
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
              <ShieldCheck size={12} /> Secure
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:gap-6">
            {/* ===================================================== */}
            {/* LEFT: FORM                                            */}
            {/* ===================================================== */}
            <div className="space-y-5">
              <form
                id="checkout-form"
                onSubmit={handleFormSubmit}
                className="space-y-5"
              >
                {/* ---------------- Contact ---------------- */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={1}
                    icon={<User size={18} />}
                    title="Contact Information"
                    subtitle="We'll use this to reach you about your order"
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Full Name" icon={<User size={11} />}>
                      <input
                        required
                        type="text"
                        className={inputCls}
                        placeholder="e.g. Rahul Sharma"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Phone Number" icon={<Phone size={11} />}>
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{10}"
                        inputMode="numeric"
                        className={inputCls}
                        placeholder="10-digit mobile number"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>

                {/* ---------------- Order mode ---------------- */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={2}
                    icon={<Truck size={18} />}
                    title="Delivery or Pickup"
                    subtitle="Choose how you want to receive your order"
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* takeaway */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "takeaway" })}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        formData.type === "takeaway"
                          ? "border-transparent bg-gradient-to-br from-[#D92312] to-[#B8190B] text-white shadow-lg shadow-red-500/25"
                          : "border-white/60 bg-white/70 text-gray-800 shadow-sm hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
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
                          <p className="text-sm font-black">Pickup / Takeaway</p>
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
                          <CheckCircle2 size={18} className="shrink-0 text-white" />
                        )}
                      </div>
                    </button>

                    {/* delivery */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "delivery" })}
                      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        formData.type === "delivery"
                          ? "border-transparent bg-gradient-to-br from-[#D92312] to-[#B8190B] text-white shadow-lg shadow-red-500/25"
                          : "border-white/60 bg-white/70 text-gray-800 shadow-sm hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
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
                            Delivered to your door · ₹{settings.baseDeliveryFee}
                          </p>
                        </div>
                        {formData.type === "delivery" && (
                          <CheckCircle2 size={18} className="shrink-0 text-white" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* ---------------- Delivery details ---------------- */}
                {isDelivery && (
                  <div className="space-y-4 rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                    <SectionHeader
                      step={3}
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
                      onAddressResolved={(addr) => {
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
                      <Field label="Flat / House / Room" icon={<Home size={11} />}>
                        <input
                          required={isDelivery}
                          type="text"
                          className={inputCls}
                          placeholder="e.g. Room 304, Hostel A"
                          value={formData.houseFlat}
                          onChange={(e) =>
                            setFormData({ ...formData, houseFlat: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Street / Area / Campus" icon={<Building size={11} />}>
                        <input
                          required={isDelivery}
                          type="text"
                          className={inputCls}
                          placeholder="e.g. UCER Campus, Naini"
                          value={formData.streetArea}
                          onChange={(e) =>
                            setFormData({ ...formData, streetArea: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Landmark (optional)" icon={<Compass size={11} />}>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. Near Library Gate"
                        value={formData.landmark}
                        onChange={(e) =>
                          setFormData({ ...formData, landmark: e.target.value })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City">
                        <input
                          required={isDelivery}
                          type="text"
                          className={inputCls}
                          value={formData.city}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Pincode">
                        <input
                          required={isDelivery}
                          type="text"
                          inputMode="numeric"
                          className={inputCls}
                          placeholder="211010"
                          value={formData.pincode}
                          onChange={(e) =>
                            setFormData({ ...formData, pincode: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    {!deliveryCoords.isWithinRadius && (
                      <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3">
                        <X size={16} className="mt-0.5 shrink-0 text-red-500" />
                        <p className="text-xs font-bold text-red-700">
                          This location is outside our {settings.deliveryRadiusKm} km
                          delivery radius. Please pick a closer point or switch to Pickup.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------- Payment ---------------- */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    step={isDelivery ? 4 : 3}
                    icon={<CreditCard size={18} />}
                    title="Payment Method"
                    subtitle="Choose how you'd like to pay"
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Razorpay */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("razorpay")}
                      className={`group relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        paymentMethod === "razorpay"
                          ? "border-orange-500 bg-orange-500/10 shadow-md ring-1 ring-orange-400"
                          : "border-white/60 bg-white/70 hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-all ${
                          paymentMethod === "razorpay"
                            ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <CreditCard size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-black text-gray-900">
                            Razorpay
                          </p>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                            Instant
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                          UPI · Cards · Netbanking · Wallets
                        </p>
                      </div>
                      {paymentMethod === "razorpay" && (
                        <CheckCircle2 size={18} className="shrink-0 text-orange-500" />
                      )}
                    </button>

                    {/* UPI QR */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi_qr")}
                      className={`group relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                        paymentMethod === "upi_qr"
                          ? "border-orange-500 bg-orange-500/10 shadow-md ring-1 ring-orange-400"
                          : "border-white/60 bg-white/70 hover:border-orange-200 hover:bg-white"
                      }`}
                    >
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-all ${
                          paymentMethod === "upi_qr"
                            ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Smartphone size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-black text-gray-900">
                            UPI / QR
                          </p>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">
                            GPay · PhonePe
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                          Scan QR or tap to launch your UPI app
                        </p>
                      </div>
                      {paymentMethod === "upi_qr" && (
                        <CheckCircle2 size={18} className="shrink-0 text-orange-500" />
                      )}
                    </button>
                  </div>

                  {paymentError && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-3">
                      <X size={16} className="mt-0.5 shrink-0 text-red-500" />
                      <p className="text-xs font-bold text-red-700">{paymentError}</p>
                    </div>
                  )}
                </div>

                {/* ---------------- Instructions ---------------- */}
                <div className="rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_10px_40px_-15px_rgba(217,35,18,0.15)] backdrop-blur-2xl sm:p-6">
                  <SectionHeader
                    icon={<Receipt size={18} />}
                    title="Special Instructions"
                    subtitle="Anything we should know? (optional)"
                  />
                  <textarea
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="e.g. Extra spicy, call upon arrival, leave at gate…"
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                  />
                </div>
              </form>
            </div>

            {/* ===================================================== */}
            {/* RIGHT: SUMMARY                                        */}
            {/* ===================================================== */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/60 shadow-[0_20px_60px_-25px_rgba(217,35,18,0.3)] backdrop-blur-2xl">
                {/* header */}
                <div className="flex items-center justify-between border-b border-white/60 bg-gradient-to-r from-orange-50/80 to-amber-50/50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                      <Receipt size={15} />
                    </div>
                    <h2 className="text-sm font-black text-gray-900">Order Summary</h2>
                  </div>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600 shadow-sm">
                    {items.reduce((s, i) => s + i.quantity, 0)} items
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  {/* items */}
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

                  {/* promo */}
                  <div className="rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
                      <Tag size={13} className="text-orange-500" />
                      Promo Code
                    </div>

                    {!appliedPromo ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter code"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
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
                          <BadgePercent size={16} className="shrink-0 text-emerald-600" />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-black text-emerald-900">
                              {appliedPromo.code}
                            </p>
                            <p className="truncate text-[10px] font-bold text-emerald-700">
                              Saved ₹{promoDiscount}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-emerald-700 transition hover:bg-emerald-100"
                          title="Remove promo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {promoError && (
                      <p className="mt-2 text-[11px] font-bold text-red-600">
                        {promoError}
                      </p>
                    )}
                    {promoSuccessMsg && !promoError && (
                      <p className="mt-2 text-[11px] font-bold text-emerald-600">
                        ✓ {promoSuccessMsg}
                      </p>
                    )}
                  </div>

                  {/* totals */}
                  <div className="space-y-2 rounded-2xl border border-white/70 bg-white/60 p-4 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span className="font-semibold">Subtotal</span>
                      <span className="font-black text-gray-900">
                        ₹{Math.round(subtotal)}
                      </span>
                    </div>

                    {promoDiscount > 0 && (
                      <div className="flex justify-between font-black text-emerald-600">
                        <span>Promo Discount</span>
                        <span>−₹{Math.round(promoDiscount)}</span>
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

                  {/* CTA */}
                  <button
                    form="checkout-form"
                    type="submit"
                    disabled={
                      isSubmitting || (isDelivery && !deliveryCoords.isWithinRadius)
                    }
                    onClick={(e) => {
                      const form = document.getElementById(
                        "checkout-form"
                      ) as HTMLFormElement;
                      if (form?.reportValidity && !form.reportValidity()) return;
                      handleFormSubmit(e);
                    }}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#D92312] to-[#B8190B] py-4 text-sm font-black text-white shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] hover:shadow-red-500/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing Payment…
                      </>
                    ) : paymentMethod === "upi_qr" ? (
                      <>
                        <QrCode size={17} />
                        Pay ₹{Math.round(finalTotal)} via UPI
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        Pay ₹{Math.round(finalTotal)} Securely
                      </>
                    )}
                  </button>

                  {/* trust row */}
                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={11} className="text-emerald-500" /> 100% Secure
                    </span>
                    <span className="h-3 w-px bg-gray-300" />
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} className="text-orange-500" /> Instant Confirm
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* UPI QR MODAL                                                  */}
      {/* ============================================================ */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-white/60 bg-white/85 shadow-2xl backdrop-blur-2xl sm:rounded-3xl">
            {/* sheen */}
            <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            {/* decorative blobs */}
            <span className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-blue-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />

            {/* mobile drag handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>

            <button
              onClick={() => setShowQR(false)}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-gray-600 shadow-sm transition hover:bg-white hover:text-gray-900 sm:top-5"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="relative px-6 pb-6 pt-5 sm:pt-7">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/60">
                  <QrCode size={26} />
                </div>
                <h3 className="text-xl font-black tracking-tight text-gray-900">
                  Pay via UPI
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                  Scan the QR or tap the button below
                </p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-inner">
                <div className="flex flex-col items-center">
                  <img
                    src={qrCodeUrl}
                    alt="UPI Payment QR Code"
                    className="hidden h-44 w-44 rounded-2xl bg-white p-2 shadow-sm md:block"
                  />

                  {/* Mobile UPI intent */}
                  <a
                    href={upiString}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/30 transition active:scale-95 md:hidden"
                  >
                    <Smartphone size={16} /> Open UPI App
                  </a>

                  <div className="text-center">
                    <p className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-3xl font-black text-transparent">
                      ₹{totalAmountStr}
                    </p>
                    <p className="mt-1 max-w-full truncate font-mono text-[11px] font-bold text-gray-500">
                      {upiId}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirmOnlinePayment}
                disabled={isSubmitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Placing Order…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} /> I&apos;ve Paid — Place Order
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                <Lock size={10} /> Encrypted & secure transaction
              </p>
            </div>
          </div>
        </div>
      )}

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />
    </>
  );
}