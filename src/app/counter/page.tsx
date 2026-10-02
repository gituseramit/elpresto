"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Utensils,
  LogOut,
  Bike,
  Store,
  Bell,
  BellOff,
  Loader2,
  Maximize2,
  Minimize2,
  Undo2,
  Pencil,
  Copy,
  Star,
  Keyboard,
  Wifi,
  StickyNote,
  RotateCcw,
  Info,
  ChevronRight,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { DUMMY_MENU } from "@/data/menu";
import { Order, MenuItem, Category } from "@/lib/types";
import { printThermalReceipt, printKOT } from "@/lib/printer";
import { initializeCategoriesIfEmpty } from "@/lib/categories";
import { subscribePanelStatus } from "@/lib/panelAuth";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import {
  subscribeDayOrders,
  getISTDateString,
  formatISTDisplayDate,
} from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";
import StaffAttendanceAction from "@/components/StaffAttendanceAction";
import {
  DEFAULT_MAIN_BRANCH_ID,
  getActiveBranches,
  getCountersForBranch,
} from "@/lib/branchService";
import type { Branch, Counter } from "@/lib/types";
import { getPackingCharge } from "@/lib/commerce";

/* ============================================================ */
/* Types                                                        */
/* ============================================================ */

type OrderType = "counter" | "delivery";
type PaymentMethod = "cash" | "online";
type PaymentStatus = "paid" | "pending";
type DiscountMode = "percent" | "flat";
type ActiveTab = "pos" | "history";

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

interface StaffSession {
  email?: string;
  name?: string;
  role?: string;
  staffId?: string;
  branchId?: string;
  [key: string]: unknown;
}

interface LinkedCustomer {
  uid: string;
  name: string;
  phone: string;
}

interface ToastState {
  id: number;
  type: "success" | "info" | "error";
  message: string;
  undo?: () => void;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/* ============================================================ */
/* Constants                                                    */
/* ============================================================ */

const CART_STORAGE_KEY = "elpestro_counter_cart_v2";
const SOUND_STORAGE_KEY = "elpestro_counter_sound";
const DELIVERY_FEE = 30;
const FREQUENT_ITEMS_LIMIT = 8;
const RECENT_ORDERS_SCAN = 100;
const ACTIVE_ORDERS_PREVIEW = 15;
const SEEN_ORDERS_MAX = 2000;

const DISCOUNT_PRESETS = [
  { label: "5%", mode: "percent" as const, value: 5 },
  { label: "10%", mode: "percent" as const, value: 10 },
  { label: "₹20", mode: "flat" as const, value: 20 },
  { label: "₹50", mode: "flat" as const, value: 50 },
];

/* ============================================================ */
/* Helpers                                                      */
/* ============================================================ */

function toDate(value: unknown): Date {
  if (!value) return new Date();
  const v = value as { toDate?: () => Date };
  if (typeof v?.toDate === "function") return v.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function getElapsed(createdAt: unknown): number {
  const d = toDate(createdAt);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

type Urgency = "ready" | "critical" | "warn" | "ok";

function urgencyOf(elapsed: number, status: string): Urgency {
  if (status === "ready") return "ready";
  if (elapsed >= 20) return "critical";
  if (elapsed >= 12) return "warn";
  return "ok";
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function generateOrderNumber(type: OrderType): string {
  const prefix = type === "delivery" ? "D" : "C";
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `#ELP-${prefix}${stamp}${rand}`;
}

function getStaffIdentity(session: StaffSession | null): {
  id: string;
  name: string;
} {
  const id =
    String(session?.staffId || session?.email || "counter").trim() || "counter";
  const name =
    String(session?.name || session?.email || "Counter Staff").trim() ||
    "Counter Staff";
  return { id, name };
}

function normaliseOrderType(raw: unknown): OrderType {
  const s = String(raw || "").toLowerCase();
  if (s === "delivery") return "delivery";
  return "counter";
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function sanitiseTel(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

/* ============================================================ */
/* Toast                                                        */
/* ============================================================ */

function Toast({
  state,
  onDismiss,
}: {
  state: ToastState | null;
  onDismiss: () => void;
}) {
  if (!state) return null;
  const tone =
    state.type === "success"
      ? "border-emerald-200 bg-white"
      : state.type === "error"
      ? "border-red-200 bg-white"
      : "border-slate-200 bg-white";
  const iconTone =
    state.type === "success"
      ? "bg-emerald-500"
      : state.type === "error"
      ? "bg-red-500"
      : "bg-slate-700";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[80] w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-2xl border ${tone} px-4 py-3 shadow-xl`}
      >
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${iconTone}`}
        >
          {state.type === "success" ? (
            <CheckCircle size={15} />
          ) : state.type === "error" ? (
            <AlertCircle size={15} />
          ) : (
            <Info size={15} />
          )}
        </div>
        <p className="min-w-0 flex-1 text-sm font-bold text-slate-800">
          {state.message}
        </p>
        {state.undo && (
          <button
            type="button"
            onClick={() => {
              state.undo?.();
              onDismiss();
            }}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"
          >
            <Undo2 size={10} /> Undo
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-md p-0.5 text-slate-400 transition hover:text-slate-900"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Confirm dialog                                               */
/* ============================================================ */

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
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-900">{state.title}</h3>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">
            {state.message}
          </p>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
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
                : "bg-[#D92312] shadow-red-500/25 hover:bg-[#B8190B]"
            }`}
          >
            {busy ? "Working…" : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Main                                                         */
/* ============================================================ */

export default function CounterPOSPage() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [activeCounter, setActiveCounter] = useState<Counter | null>(null);
  const isElevatedUser =
    staffSession?.role === "DEVELOPER" ||
    staffSession?.role === "SUPER_ADMIN";

  /* ---- View ---- */
  const [activeTab, setActiveTab] = useState<ActiveTab>("pos");
  const [isMobileOrdersOpen, setIsMobileOrdersOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* ---- Data ---- */
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [firestoreCategories, setFirestoreCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getISTDateString(0)
  );
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  /* ---- Menu filters ---- */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");

  /* ---- Cart ---- */
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("counter");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  /* ---- Discount ---- */
  const [discountMode, setDiscountMode] = useState<DiscountMode>("flat");
  const [discountValue, setDiscountValue] = useState<number>(0);

  /* ---- Payment ---- */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [counterPaymentStatus, setCounterPaymentStatus] =
    useState<PaymentStatus>("paid");

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(
    null
  );

  /* ---- Customer linking ---- */
  const [linkedCustomer, setLinkedCustomer] = useState<LinkedCustomer | null>(
    null
  );

  /* ---- Per-item notes ---- */
  const [noteEditingItem, setNoteEditingItem] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  /* ---- Print ---- */
  const [printStatus, setPrintStatus] = useState<
    "idle" | "printing" | "success" | "error"
  >("idle");
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---- Feedback ---- */
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  /* ---- Alerts ---- */
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const [packingEnabled, setPackingEnabled] = useState(false);
  const [packingRates, setPackingRates] = useState<Record<string, number>>({});
  const [ordersSearch, setOrdersSearch] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);

  /* ---- Refs ---- */
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartSnapshotRef = useRef<CartItem[] | null>(null);
  const toastIdRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const printStatusTimerRef = useRef<number | null>(null);

  // Refs mirror state used inside keyboard handler to avoid stale closures.
  const cartItemsRef = useRef(cartItems);
  const customerNameRef = useRef(customerName);
  const customerPhoneRef = useRef(customerPhone);
  const orderTypeRef = useRef(orderType);
  const discountModeRef = useRef(discountMode);
  const discountValueRef = useRef(discountValue);
  const paymentMethodRef = useRef(paymentMethod);
  const counterPaymentStatusRef = useRef(counterPaymentStatus);
  const linkedCustomerRef = useRef(linkedCustomer);
  const editingOrderIdRef = useRef(editingOrderId);
  const isSubmittingRef = useRef(isSubmitting);
  const staffSessionRef = useRef(staffSession);
  const activeBranchIdRef = useRef(activeBranchId);
  const activeCounterRef = useRef(activeCounter);
  const soundEnabledRef = useRef(soundEnabled);
  const packingEnabledRef = useRef(packingEnabled);
  const packingRatesRef = useRef(packingRates);

  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);
  useEffect(() => {
    customerNameRef.current = customerName;
  }, [customerName]);
  useEffect(() => {
    customerPhoneRef.current = customerPhone;
  }, [customerPhone]);
  useEffect(() => {
    orderTypeRef.current = orderType;
  }, [orderType]);
  useEffect(() => {
    discountModeRef.current = discountMode;
  }, [discountMode]);
  useEffect(() => {
    discountValueRef.current = discountValue;
  }, [discountValue]);
  useEffect(() => {
    paymentMethodRef.current = paymentMethod;
  }, [paymentMethod]);
  useEffect(() => {
    counterPaymentStatusRef.current = counterPaymentStatus;
  }, [counterPaymentStatus]);
  useEffect(() => {
    linkedCustomerRef.current = linkedCustomer;
  }, [linkedCustomer]);
  useEffect(() => {
    editingOrderIdRef.current = editingOrderId;
  }, [editingOrderId]);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);
  useEffect(() => {
    staffSessionRef.current = staffSession;
  }, [staffSession]);
  useEffect(() => {
    activeBranchIdRef.current = activeBranchId;
  }, [activeBranchId]);
  useEffect(() => {
    activeCounterRef.current = activeCounter;
  }, [activeCounter]);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => { packingEnabledRef.current = packingEnabled; }, [packingEnabled]);
  useEffect(() => { packingRatesRef.current = packingRates; }, [packingRates]);

  useEffect(() => onSnapshot(doc(db, "settings", "general"), (snapshot) => {
    const data = snapshot.data();
    if (!data) return;
    setPackingEnabled(data.packingChargesEnabled === true);
    setPackingRates(data.packingChargeByCategory || {});
  }), []);

  /* ============================================================ */
  /* Toast helper                                                 */
  /* ============================================================ */

  const showToast = useCallback(
    (
      message: string,
      type: ToastState["type"] = "success",
      undo?: () => void
    ) => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
      const id = ++toastIdRef.current;
      setToast({ id, message, type, undo });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 4500);
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

  /* ============================================================ */
  /* Session bootstrap                                            */
  /* ============================================================ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    import("@/lib/staffAuth")
      .then(({ getStaffSession, isSessionValid }) => {
        if (cancelled) return;
        try {
          const session = getStaffSession("counter") as StaffSession | null;
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

    // Load saved cart
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved?.cartItems) && saved.cartItems.length > 0) {
          setCartItems(saved.cartItems as CartItem[]);
          setOrderType(normaliseOrderType(saved.orderType));
          setCustomerName(String(saved.customerName || ""));
          setCustomerPhone(normalisePhone(String(saved.customerPhone || "")));
          setPaymentMethod(
            saved.paymentMethod === "online" ? "online" : "cash"
          );
          setCounterPaymentStatus(
            saved.counterPaymentStatus === "pending" ? "pending" : "paid"
          );
          if (
            saved.discountMode === "percent" ||
            saved.discountMode === "flat"
          ) {
            setDiscountMode(saved.discountMode);
            setDiscountValue(Math.max(0, safeNumber(saved.discountValue)));
          }
        }
      }
    } catch (err) {
      console.warn("Cart restore failed:", err);
    }

    const unsub = subscribePanelStatus("counter", () => {
      setIsAuthenticated(false);
      setStaffSession(null);
      setCartItems([]);
      seenOrderIdsRef.current.clear();
      try {
        window.sessionStorage.removeItem("elpestro_counter_auth");
      } catch {
        /* ignore */
      }
      import("@/lib/staffAuth")
        .then(({ clearStaffSession }) => clearStaffSession("counter"))
        .catch(() => {
          /* ignore */
        });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  /* Persist cart */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        cartItems,
        orderType,
        customerName,
        customerPhone,
        discountMode,
        discountValue,
        paymentMethod,
        counterPaymentStatus,
      };
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    cartItems,
    orderType,
    customerName,
    customerPhone,
    discountMode,
    discountValue,
    paymentMethod,
    counterPaymentStatus,
  ]);

  /* Fullscreen state sync */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* Audio + toast + print-status cleanup */
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {
          /* ignore */
        });
        audioCtxRef.current = null;
      }
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (printStatusTimerRef.current != null) {
        window.clearTimeout(printStatusTimerRef.current);
      }
    };
  }, []);

  /* Reset soundEnabledRef on external change */
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  /* Load branches */
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getActiveBranches()
      .then((list) => {
        if (!cancelled) setBranches(list);
      })
      .catch((err) => {
        console.warn("Failed to load branches:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /* Resolve counter for branch */
  useEffect(() => {
    if (!activeBranchId) {
      setActiveCounter(null);
      return;
    }
    let cancelled = false;
    getCountersForBranch(activeBranchId)
      .then((counters) => {
        if (cancelled) return;
        if (counters.length > 0) {
          setActiveCounter(counters[0]);
        } else {
          setActiveCounter({
            id: `counter-${activeBranchId}`,
            branchId: activeBranchId,
            name: "Main Counter",
            counterNumber: "1",
            active: true,
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load counters:", err);
        if (!cancelled) {
          setActiveCounter({
            id: `counter-${activeBranchId}`,
            branchId: activeBranchId,
            name: "Main Counter",
            counterNumber: "1",
            active: true,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBranchId]);

  /* ============================================================ */
  /* Sound                                                        */
  /* ============================================================ */

  const playChime = useCallback(() => {
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
      [880, 1174].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        const s = now + i * 0.14;
        gain.gain.setValueAtTime(0.22, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.18);
        osc.start(s);
        osc.stop(s + 0.18);
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
      if (next) playChime();
      return next;
    });
  }, [playChime]);

  /* ============================================================ */
  /* Logout                                                       */
  /* ============================================================ */

  const handleLogout = useCallback(() => {
    const doLogout = () => {
      setIsAuthenticated(false);
      setStaffSession(null);
      setOrders([]);
      setLastPlacedOrder(null);
      seenOrderIdsRef.current.clear();
      try {
        window.sessionStorage.removeItem("elpestro_counter_auth");
      } catch {
        /* ignore */
      }
      import("@/lib/staffAuth")
        .then(({ clearStaffSession }) => clearStaffSession("counter"))
        .catch(() => {
          /* ignore */
        });
    };

    if (cartItemsRef.current.length > 0) {
      setConfirm({
        title: "Sign out with items in cart?",
        message:
          "Your current cart will be cleared when you sign out. Continue?",
        confirmLabel: "Sign out",
        destructive: true,
        onConfirm: doLogout,
      });
    } else {
      doLogout();
    }
  }, []);

  /* ============================================================ */
  /* Data subscriptions                                           */
  /* ============================================================ */

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const cats = await initializeCategoriesIfEmpty();
        if (!cancelled) setFirestoreCategories(cats);
      } catch (err) {
        console.warn("Firestore categories unavailable:", err);
      }
    })();

    const unsubMenu = onSnapshot(
      collection(db, "menuItems"),
      (snap) => {
        const map = new Map<string, MenuItem>();
        (DUMMY_MENU as MenuItem[]).forEach((item) => map.set(item.id, item));
        snap.docs.forEach((d) => {
          const data = d.data() as Partial<MenuItem>;
          map.set(d.id, {
            id: d.id,
            name: String(data.name || "Unnamed"),
            price: safeNumber(data.price),
            category: String(data.category || ""),
            subcategory: data.subcategory ? String(data.subcategory) : undefined,
            description: data.description
              ? String(data.description)
              : undefined,
            available: data.available !== false,
          } as MenuItem);
        });
        setMenuItems(Array.from(map.values()));
      },
      (err) => {
        console.error("Menu subscription error:", err);
      }
    );

    return () => {
      cancelled = true;
      unsubMenu();
    };
  }, [isAuthenticated]);

  /* Orders subscription — needs branch to be set. */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!activeBranchId) {
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    setOrdersError(null);

    const unsubscribe = subscribeDayOrders(
      selectedDate,
      (fetched: Order[]) => {
        const newPending = fetched.filter(
          (o) =>
            o.status === "pending" &&
            !seenOrderIdsRef.current.has(o.id) &&
            seenOrderIdsRef.current.size > 0
        );
        if (newPending.length > 0) playChime();
        fetched.forEach((o) => seenOrderIdsRef.current.add(o.id));
        if (seenOrderIdsRef.current.size > SEEN_ORDERS_MAX) {
          const trimmed = Array.from(seenOrderIdsRef.current).slice(
            -SEEN_ORDERS_MAX
          );
          seenOrderIdsRef.current = new Set(trimmed);
        }
        setOrders(fetched);
        setOrdersLoading(false);
        setOrdersError(null);
      },
      (err) => {
        console.error("Orders error:", err);
        setOrdersError("Unable to load orders. Please try again.");
        setOrdersLoading(false);
      },
      activeBranchId
    );

    return () => unsubscribe();
  }, [isAuthenticated, selectedDate, activeBranchId, playChime]);

  /* Reset seen IDs on date/branch change */
  useEffect(() => {
    seenOrderIdsRef.current.clear();
    setShowAllOrders(false);
  }, [selectedDate, activeBranchId]);

  /* ============================================================ */
  /* Derived                                                      */
  /* ============================================================ */

  const categoryNames = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    menuItems.forEach((item) => {
      const cat = (item.category || "").trim();
      if (!cat || cat === "Food" || cat === "General") return;
      if (seen.has(cat)) return;
      seen.add(cat);
      ordered.push(cat);
    });
    return ordered;
  }, [menuItems]);

  const currentSubcategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      const cat = (item.category || "").trim();
      const sub = (item.subcategory || "").trim();
      if (!sub || sub === "General") return;
      if (selectedCategory === "all" || cat === selectedCategory) {
        set.add(sub);
      }
    });
    if (selectedCategory !== "all") {
      const firestoreCat = firestoreCategories.find(
        (c) => c.name === selectedCategory
      );
      firestoreCat?.subcategories?.forEach((s) => {
        if (s.enabled && s.name) set.add(s.name);
      });
    }
    return Array.from(set);
  }, [menuItems, firestoreCategories, selectedCategory]);

  const filteredMenuItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (selectedCategory !== "all") {
        if ((item.category || "").trim() !== selectedCategory) return false;
      }
      if (selectedSubcategory !== "all") {
        if ((item.subcategory || "").trim() !== selectedSubcategory)
          return false;
      }
      if (!q) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.description?.toLowerCase().includes(q)) return true;
      if (String(item.price).includes(q)) return true;
      return false;
    });
  }, [menuItems, selectedCategory, selectedSubcategory, searchQuery]);

  const groupedMenu = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    filteredMenuItems.forEach((item) => {
      const key =
        selectedCategory === "all"
          ? item.category || "Other"
          : item.subcategory && item.subcategory !== "General"
          ? item.subcategory
          : item.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([title, items]) => ({
      title,
      items,
    }));
  }, [filteredMenuItems, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: menuItems.length };
    menuItems.forEach((item) => {
      const cat = (item.category || "").trim();
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  const frequentItems = useMemo(() => {
    const counts: Record<string, { item: MenuItem; count: number }> = {};
    orders.slice(0, RECENT_ORDERS_SCAN).forEach((o) => {
      o.items?.forEach((it) => {
        const id = String(it.id || "");
        if (!id) return;
        if (!counts[id]) {
          const found = menuItems.find((m) => m.id === id);
          if (found) counts[id] = { item: found, count: 0 };
        }
        if (counts[id]) counts[id].count += it.quantity || 1;
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, FREQUENT_ITEMS_LIMIT)
      .map((x) => x.item);
  }, [orders, menuItems]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0),
    [cartItems]
  );
  const packing = useMemo(() => getPackingCharge(cartItems.map((ci) => ({ category: ci.item.category, quantity: ci.quantity })), packingEnabled, packingRates), [cartItems, packingEnabled, packingRates]);

  const computedDiscount = useMemo(() => {
    const v = Math.max(0, safeNumber(discountValue));
    if (discountMode === "percent") {
      const pct = Math.min(100, v);
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(v, subtotal);
  }, [discountMode, discountValue, subtotal]);

  const finalTotal = useMemo(
    () => Math.max(0, subtotal - computedDiscount) + packing.total,
    [subtotal, computedDiscount, packing.total]
  );
  const cartCount = useMemo(
    () => cartItems.reduce((s, ci) => s + ci.quantity, 0),
    [cartItems]
  );
  const grandTotal = useMemo(
    () => finalTotal + (orderType === "delivery" ? DELIVERY_FEE : 0),
    [finalTotal, orderType]
  );

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "completed" &&
          o.status !== "cancelled" &&
          o.deliveryStatus !== "delivered"
      ),
    [orders]
  );

  const completedOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "completed" || o.deliveryStatus === "delivered"
      ),
    [orders]
  );

  const filteredActiveOrders = useMemo(() => {
    let list = [...activeOrders];
    const q = ordersSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          String(o.phone || o.customerPhone || "").includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = toDate(a.createdAt).getTime();
      const tb = toDate(b.createdAt).getTime();
      return ta - tb;
    });
    if (!showAllOrders) {
      list = list.slice(0, ACTIVE_ORDERS_PREVIEW);
    }
    return list;
  }, [activeOrders, ordersSearch, showAllOrders]);

  /* ============================================================ */
  /* Cart actions                                                 */
  /* ============================================================ */

  const addToCart = useCallback((item: MenuItem) => {
    if (item.available === false) return;
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id !== itemId) return ci;
          const next = ci.quantity + delta;
          return next > 0 ? { ...ci, quantity: next } : null;
        })
        .filter((x): x is CartItem => x !== null)
    );
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const saveItemNote = useCallback(() => {
    if (!noteEditingItem) return;
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.item.id === noteEditingItem
          ? { ...ci, notes: noteText.trim() || undefined }
          : ci
      )
    );
    setNoteEditingItem(null);
    setNoteText("");
  }, [noteEditingItem, noteText]);

  const confirmClearCart = useCallback(() => {
    if (cartItems.length === 0) return;
    setConfirm({
      title: "Clear cart?",
      message: `Remove ${cartCount} item${
        cartCount === 1 ? "" : "s"
      } from the current bill?`,
      confirmLabel: "Clear cart",
      destructive: true,
      onConfirm: () => {
        cartSnapshotRef.current = [...cartItems];
        const prevMode = discountMode;
        const prevValue = discountValue;
        setCartItems([]);
        setDiscountMode("flat");
        setDiscountValue(0);
        showToast("Cart cleared", "info", () => {
          if (cartSnapshotRef.current) {
            setCartItems(cartSnapshotRef.current);
            setDiscountMode(prevMode);
            setDiscountValue(prevValue);
            showToast("Cart restored", "success");
          }
        });
      },
    });
  }, [cartItems, cartCount, discountMode, discountValue, showToast]);

  const clearAllFields = useCallback(() => {
    setCartItems([]);
    setDiscountMode("flat");
    setDiscountValue(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setCounterPaymentStatus("paid");
    setOrderType("counter");
    setLinkedCustomer(null);
    setEditingOrderId(null);
    setEditingOrderNumber(null);
    setNoteEditingItem(null);
    setNoteText("");
  }, []);

  const recallOrder = useCallback(
    (order: Order) => {
      const doRecall = () => {
        const mapped: CartItem[] = (order.items || [])
          .map((it) => {
            const menu = menuItems.find((m) => m.id === it.id);
            if (!menu) return null;
            return {
              item: menu,
              quantity: it.quantity,
              notes: it.notes,
            } as CartItem;
          })
          .filter((x): x is CartItem => x !== null);

        if (mapped.length === 0) {
          showToast("Order items no longer available", "error");
          return;
        }

        setCartItems(mapped);
        setOrderType(normaliseOrderType(order.type || order.orderType));
        setCustomerName(order.customerName || "");
        setCustomerPhone(
          normalisePhone(order.phone || order.customerPhone || "")
        );
        setPaymentMethod(order.paymentMethod === "online" ? "online" : "cash");
        setCounterPaymentStatus(
          order.paymentStatus === "pending" ? "pending" : "paid"
        );

        const rawOrder = order as unknown as {
          discountMode?: string;
          discountValue?: number;
          discount?: number;
        };
        if (
          rawOrder.discountMode === "percent" ||
          rawOrder.discountMode === "flat"
        ) {
          setDiscountMode(rawOrder.discountMode);
          setDiscountValue(Math.max(0, safeNumber(rawOrder.discountValue)));
        } else if (safeNumber(order.discount) > 0) {
          setDiscountMode("flat");
          setDiscountValue(safeNumber(order.discount));
        } else {
          setDiscountMode("flat");
          setDiscountValue(0);
        }

        setEditingOrderId(order.id);
        setEditingOrderNumber(order.orderNumber);
        setIsMobileOrdersOpen(false);
        showToast(`Editing ${order.orderNumber}`, "info");
      };

      if (cartItems.length > 0 && editingOrderId !== order.id) {
        setConfirm({
          title: "Replace current cart?",
          message:
            "The current cart will be replaced with this order. Continue?",
          confirmLabel: "Replace",
          destructive: true,
          onConfirm: doRecall,
        });
      } else {
        doRecall();
      }
    },
    [cartItems.length, editingOrderId, menuItems, showToast]
  );

  const duplicateOrder = useCallback(
    (order: Order) => {
      const mapped: CartItem[] = (order.items || [])
        .map((it) => {
          const menu = menuItems.find((m) => m.id === it.id);
          if (!menu) return null;
          return { item: menu, quantity: it.quantity } as CartItem;
        })
        .filter((x): x is CartItem => x !== null);

      if (mapped.length === 0) {
        showToast("Original items unavailable", "error");
        return;
      }
      setCartItems(mapped);
      setOrderType(normaliseOrderType(order.type || order.orderType));
      setCustomerName(order.customerName || "");
      setCustomerPhone(
        normalisePhone(order.phone || order.customerPhone || "")
      );
      setEditingOrderId(null);
      setEditingOrderNumber(null);
      setIsMobileCartOpen(false);
      showToast("Duplicated into cart", "success");
    },
    [menuItems, showToast]
  );

  const applyDiscountPreset = useCallback(
    (preset: (typeof DISCOUNT_PRESETS)[number]) => {
      setDiscountMode(preset.mode);
      setDiscountValue(preset.value);
      showToast(`${preset.label} discount applied`, "info");
    },
    [showToast]
  );

  const handleSearchCustomer = useCallback(async () => {
    const phone = normalisePhone(customerPhone);
    if (!phone) return;
    try {
      const q = query(
        collection(db, "customers"),
        where("phone", "==", phone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setLinkedCustomer({
          uid: snap.docs[0].id,
          name: String(data.name || "Customer"),
          phone,
        });
        if (!customerName) setCustomerName(String(data.name || ""));
        showToast(`Linked: ${data.name || "Customer"}`, "success");
      } else {
        setLinkedCustomer(null);
        showToast("New customer", "info");
      }
    } catch (err) {
      console.error("Customer search failed:", err);
      showToast("Search failed", "error");
    }
  }, [customerPhone, customerName, showToast]);

  /* ============================================================ */
  /* Print                                                        */
  /* ============================================================ */

  const handlePrintReceipt = useCallback(
    async (order: Order) => {
      setPrintStatus("printing");
      const branchName =
        branches.find((b) => b.id === activeBranchId)?.name ||
        "EL PRESTO";
      try {
        const res = await printThermalReceipt(order, {
          paperWidth: "58mm",
          branchName,
          counterNumber: activeCounter?.counterNumber || "C-01",
          counterName: activeCounter?.name || "Counter",
        });
        setPrintStatus(res.success ? "success" : "error");
      } catch (err) {
        console.error("Print failed:", err);
        setPrintStatus("error");
      } finally {
        if (printStatusTimerRef.current != null) {
          window.clearTimeout(printStatusTimerRef.current);
        }
        printStatusTimerRef.current = window.setTimeout(() => {
          setPrintStatus("idle");
          printStatusTimerRef.current = null;
        }, 3000);
      }
    },
    [branches, activeBranchId, activeCounter]
  );

  const handlePrintKOT = useCallback(
    async (order: Order) => {
      const branchName =
        branches.find((b) => b.id === activeBranchId)?.name ||
        "EL PRESTO";
      try {
        await printKOT(order, {
          branchName,
          counterNumber: activeCounter?.counterNumber || "C-01",
        });
        showToast("KOT sent to kitchen", "success");
      } catch (err) {
        console.error("KOT print failed:", err);
        showToast("KOT print failed", "error");
      }
    },
    [branches, activeBranchId, activeCounter, showToast]
  );

  /* ============================================================ */
  /* Place order                                                  */
  /* ============================================================ */

  const handlePlaceOrder = useCallback(
    async (printAfter: boolean = true) => {
      if (isSubmittingRef.current) return;

      const items = cartItemsRef.current;
      if (items.length === 0) {
        showToast("Cart is empty", "error");
        return;
      }
      if (!activeBranchIdRef.current) {
        showToast("No branch selected. Please re-login.", "error");
        return;
      }

      setIsSubmitting(true);
      try {
        const oType = orderTypeRef.current;
        const sub = items.reduce(
          (sum, ci) => sum + ci.item.price * ci.quantity,
          0
        );
        const discountVal = Math.max(0, safeNumber(discountValueRef.current));
        const computed =
          discountModeRef.current === "percent"
            ? Math.round((sub * Math.min(100, discountVal)) / 100)
            : Math.min(discountVal, sub);
        const deliveryFee = oType === "delivery" ? DELIVERY_FEE : 0;
        const packingCharge = getPackingCharge(items.map((ci) => ({ category: ci.item.category, quantity: ci.quantity })), packingEnabledRef.current, packingRatesRef.current);
        const total = Math.max(0, sub - computed + packingCharge.total + deliveryFee);

        const editingId = editingOrderIdRef.current;
        const orderNumber =
          editingId && editingOrderNumber
            ? editingOrderNumber
            : generateOrderNumber(oType);

        const rider = getStaffIdentity(staffSessionRef.current);
        const counter = activeCounterRef.current;
        const branchId = activeBranchIdRef.current;
        const branch = branches.find((candidate) => candidate.id === branchId);

        const itemsPayload = items.map((ci) => ({
          id: ci.item.id,
          name: ci.item.name,
          quantity: ci.quantity,
          price: ci.item.price,
          ...(ci.notes ? { notes: ci.notes } : {}),
        }));

        const payload: Record<string, unknown> = {
          orderNumber,
          customerName:
            customerNameRef.current.trim() ||
            (oType === "delivery"
              ? "Delivery Customer"
              : "Walk-in Customer"),
          customerPhone: customerPhoneRef.current.trim() || "Counter",
          phone: customerPhoneRef.current.trim() || "Counter",
          type: oType,
          orderType: oType,
          kitchenNotes: editingId
            ? "Updated at Counter POS"
            : `Created at Counter POS (${oType.toUpperCase()})`,
          items: itemsPayload,
          subtotal: sub,
          packingCharge: packingCharge.total,
          packingChargeBreakdown: packingCharge.breakdown,
          discount: computed,
          discountMode: discountModeRef.current,
          discountValue: discountVal,
          deliveryFee,
          total,
          orderLocation: branch ? { lat: branch.lat, lng: branch.lng, address: branch.address, branchId, kind: "pickup" } : undefined,
          paymentMethod: paymentMethodRef.current,
          paymentStatus: counterPaymentStatusRef.current,
          source: "counter",
          orderSource: "counter",
          branchId,
          counterId: counter?.id || "counter-1",
          counterName: counter?.name || "Counter",
          updatedAt: Timestamp.now(),
          updatedBy: rider.id,
          ...(linkedCustomerRef.current
            ? { customerId: linkedCustomerRef.current.uid }
            : {}),
        };

        if (oType === "delivery") {
          payload.deliveryAddress = { fullAddress: "Campus Delivery" };
          payload.location = "Campus Delivery";
        } else {
          payload.location = "Counter";
        }

        if (editingId) {
          await updateDoc(doc(db, "orders", editingId), payload);
          const updated = { id: editingId, ...payload } as unknown as Order;
          setLastPlacedOrder(updated);
          showToast(`Order ${orderNumber} updated`, "success");
          if (printAfter) void handlePrintReceipt(updated);
        } else {
          payload.status = "pending";
          payload.createdAt = Timestamp.now();
          payload.createdBy = rider.id;
          if (oType === "delivery") payload.deliveryStatus = "pending";
          const ref = await addDoc(collection(db, "orders"), payload);
          const placed = { id: ref.id, ...payload } as unknown as Order;
          setLastPlacedOrder(placed);
          showToast(`Order ${orderNumber} placed`, "success");
          if (printAfter) void handlePrintReceipt(placed);
        }

        clearAllFields();
        setIsMobileCartOpen(false);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("Place order failed:", err);
        showToast("Error: " + msg, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingOrderNumber, handlePrintReceipt, showToast, clearAllFields, branches]
  );

  /* ============================================================ */
  /* Status / payment updates                                     */
  /* ============================================================ */

  const handleUpdateOrderStatus = useCallback(
    async (order: Order, newStatus: string) => {
      const rider = getStaffIdentity(staffSessionRef.current);
      const patch: Record<string, unknown> = {
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: rider.id,
      };

      if (newStatus === "completed") {
        patch.completedAt = Timestamp.now();
      }

      if (
        newStatus === "ready" &&
        (order.type === "delivery" || order.orderType === "delivery")
      ) {
        patch.deliveryStatus = "ready";
      }

      try {
        await updateDoc(doc(db, "orders", order.id), patch);
        showToast(`Order marked ${newStatus}`, "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        showToast("Error: " + msg, "error");
      }
    },
    [showToast]
  );

  const handleUpdatePaymentStatus = useCallback(
    async (orderId: string, newStatus: PaymentStatus) => {
      const rider = getStaffIdentity(staffSessionRef.current);
      try {
        await updateDoc(doc(db, "orders", orderId), {
          paymentStatus: newStatus,
          updatedAt: Timestamp.now(),
          updatedBy: rider.id,
        });
        showToast(`Payment ${newStatus}`, "success");
      } catch (err) {
        console.error("Payment update failed:", err);
        showToast("Error updating payment", "error");
      }
    },
    [showToast]
  );

  /* ============================================================ */
  /* Keyboard shortcuts                                           */
  /* ============================================================ */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (
          cartItemsRef.current.length > 0 &&
          !isSubmittingRef.current &&
          !editingOrderIdRef.current
        ) {
          void handlePlaceOrder(true);
        } else if (
          cartItemsRef.current.length > 0 &&
          !isSubmittingRef.current &&
          editingOrderIdRef.current
        ) {
          void handlePlaceOrder(true);
        }
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        if (cartItemsRef.current.length > 0 && !isSubmittingRef.current) {
          void handlePlaceOrder(false);
        }
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (cartItemsRef.current.length > 0) confirmClearCart();
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setIsMobileCartOpen(false);
        setIsMobileOrdersOpen(false);
        setNoteEditingItem(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlaceOrder, confirmClearCart]);

  /* ============================================================ */
  /* Branch switcher (elevated only)                              */
  /* ============================================================ */

  const handleBranchSwitch = useCallback(
    async (newBranchId: string) => {
      if (!isElevatedUser) return;
      const oldBranchId = activeBranchId;
      setActiveBranchId(newBranchId);
      try {
        const { logAuditEvent } = await import("@/lib/rbac");
        const rider = getStaffIdentity(staffSessionRef.current);
        await logAuditEvent({
          actorId: rider.id,
          actorName: rider.name,
          actorRole: String(staffSessionRef.current?.role || "DEVELOPER"),
          branchId: newBranchId,
          action: "CROSS_BRANCH_VIEW",
          targetType: "counter",
          targetId: newBranchId,
          metadata: { fromBranchId: oldBranchId, toBranchId: newBranchId },
        });
      } catch (err) {
        console.warn("Audit log failed:", err);
      }
    },
    [isElevatedUser, activeBranchId]
  );

  /* ============================================================ */
  /* Fullscreen                                                   */
  /* ============================================================ */

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        /* ignore */
      });
    } else {
      document.exitFullscreen().catch(() => {
        /* ignore */
      });
    }
  }, []);

  /* ============================================================ */
  /* Login gate                                                   */
  /* ============================================================ */

  if (isVerifyingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-[#D92312]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <StaffLoginForm
        panel="counter"
        panelDisplayName="Counter POS & Billing Station"
        panelIcon={<Store size={28} />}
        onSuccess={(session: unknown) => {
          const s = (session as StaffSession) || null;
          setStaffSession(s);
          setIsAuthenticated(true);
          if (s?.branchId) setActiveBranchId(s.branchId);
        }}
      />
    );
  }

  /* ============================================================ */
  /* Left panel — Orders                                          */
  /* ============================================================ */

  const OrdersListPanel = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">Orders</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
            {activeOrders.length}
          </span>
        </div>

        <div className="relative mt-2.5">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={13}
          />
          <label htmlFor="orders-search" className="sr-only">
            Search orders
          </label>
          <input
            id="orders-search"
            type="text"
            placeholder="Search orders..."
            value={ordersSearch}
            onChange={(e) => setOrdersSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none"
          />
          {ordersSearch && (
            <button
              type="button"
              onClick={() => setOrdersSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <button
          type="button"
          onClick={() => {
            if (cartItems.length > 0 && !editingOrderId) {
              setConfirm({
                title: "Start new order?",
                message: "Current cart will be lost. Continue?",
                confirmLabel: "Start new",
                destructive: true,
                onConfirm: () => {
                  clearAllFields();
                  setIsMobileOrdersOpen(false);
                  setActiveTab("pos");
                },
              });
            } else {
              clearAllFields();
              setIsMobileOrdersOpen(false);
              setActiveTab("pos");
            }
          }}
          className={`mb-3 flex w-full items-start gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-left transition active:scale-[0.99] ${
            editingOrderId
              ? "border-orange-300 bg-orange-50/60"
              : "border-red-200 bg-red-50/50 hover:border-red-400 hover:bg-red-50"
          }`}
        >
          <div
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${
              editingOrderId ? "bg-orange-500" : "bg-[#D92312]"
            }`}
          >
            <Plus size={15} strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">
              {editingOrderId ? "Cancel Edit" : "New Order"}
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              {editingOrderId
                ? `Editing ${editingOrderNumber || "order"}`
                : "Start a new order"}
            </p>
          </div>
        </button>

        <div className="space-y-2">
          {filteredActiveOrders.length === 0 ? (
            <div className="py-12 text-center">
              <Clock size={26} className="mx-auto text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-400">
                {ordersSearch ? "No matching orders" : "No active orders"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                New orders will appear here
              </p>
            </div>
          ) : (
            filteredActiveOrders.map((order) => {
              const elapsed = getElapsed(order.createdAt);
              const urgency = urgencyOf(elapsed, order.status);
              const isReady = order.status === "ready";
              const isPreparing = order.status === "preparing";
              const isPending = order.status === "pending";
              const paid = order.paymentStatus === "paid";
              const isDelivery =
                order.type === "delivery" || order.orderType === "delivery";

              const urgencyBar =
                urgency === "critical"
                  ? "bg-red-500"
                  : urgency === "warn"
                  ? "bg-amber-500"
                  : urgency === "ready"
                  ? "bg-emerald-500"
                  : "bg-slate-300";

              return (
                <div
                  key={order.id}
                  className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-slate-200"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-1 ${urgencyBar}`}
                  />
                  <div className="pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-slate-900">
                            {order.orderNumber}
                          </span>
                          {isDelivery && (
                            <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                              <Bike size={8} /> Dlv
                            </span>
                          )}
                          {isReady && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                              Ready
                            </span>
                          )}
                          {isPreparing && (
                            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                              Prep
                            </span>
                          )}
                          {isPending && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {order.customerName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-black text-slate-900">
                          ₹{Math.round(order.total || 0)}
                        </p>
                        <p
                          className={`text-[10px] font-bold ${
                            urgency === "critical"
                              ? "text-red-500"
                              : urgency === "warn"
                              ? "text-amber-600"
                              : "text-slate-400"
                          }`}
                        >
                          {elapsed}m
                        </p>
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {order.items
                          .slice(0, 2)
                          .map((it) => `${it.quantity}× ${it.name}`)
                          .join(", ")}
                        {order.items.length > 2 &&
                          ` +${order.items.length - 2}`}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1.5">
                      {!paid && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePaymentStatus(order.id, "paid")
                          }
                          className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Mark Paid
                        </button>
                      )}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateOrderStatus(order, "preparing")
                          }
                          className="flex-1 rounded-lg border border-orange-200 bg-orange-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
                        >
                          Start
                        </button>
                      )}
                      {isPreparing && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateOrderStatus(order, "ready")
                          }
                          className="flex-1 rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition hover:bg-blue-100"
                        >
                          Ready
                        </button>
                      )}
                      {isReady && !isDelivery && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateOrderStatus(order, "completed")
                          }
                          className="flex-1 rounded-lg bg-[#D92312] py-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-[#B8190B]"
                        >
                          Done
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => recallOrder(order)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        title="Edit / Recall"
                        aria-label={`Edit order ${order.orderNumber}`}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePrintReceipt(order)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        title="Print bill"
                        aria-label={`Print bill for ${order.orderNumber}`}
                      >
                        <Printer size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {!showAllOrders && activeOrders.length > ACTIVE_ORDERS_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllOrders(true)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronRight size={11} />
              Show {activeOrders.length - ACTIVE_ORDERS_PREVIEW} more
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={
              soundEnabled
                ? "Mute new order alerts"
                : "Enable new order alerts"
            }
            aria-pressed={soundEnabled}
            className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
              soundEnabled
                ? "border-red-200 bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-400"
            }`}
            title={soundEnabled ? "Sound on" : "Sound off"}
          >
            {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          </button>
          <div className="flex flex-1 items-center gap-1.5">
            <span
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700"
              title="Live sync active"
            >
              <Wifi size={11} /> Live
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-red-500"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ============================================================ */
  /* Right panel — Cart                                           */
  /* ============================================================ */

  const OrderPanel = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {editingOrderId ? "Editing Order" : "Current Order"}
            </h2>
            {editingOrderId && (
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-orange-600">
                {editingOrderNumber || "Order"} · saving overwrites
              </p>
            )}
          </div>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={confirmClearCart}
              className="text-xs font-bold text-slate-400 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              { id: "counter" as const, label: "Counter / Takeaway", icon: Store },
              { id: "delivery" as const, label: "Delivery", icon: Bike },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = orderType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOrderType(t.id)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cartItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
              <ShoppingCart size={22} className="text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-500">
              No items added
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Select items from the menu
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Press F2 to search · F1 for shortcuts
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cartItems.map((ci) => (
              <div
                key={ci.item.id}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-slate-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {ci.item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      ₹{ci.item.price} × {ci.quantity} ={" "}
                      <span className="font-bold text-slate-700">
                        ₹{ci.item.price * ci.quantity}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(ci.item.id, -1)}
                      aria-label={`Decrease quantity of ${ci.item.name}`}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-90"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-slate-900">
                      {ci.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(ci.item.id, 1)}
                      aria-label={`Increase quantity of ${ci.item.name}`}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-90"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(ci.item.id)}
                      aria-label={`Remove ${ci.item.name}`}
                      className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {noteEditingItem === ci.item.id ? (
                    <div className="flex flex-1 gap-1.5">
                      <label
                        htmlFor={`note-input-${ci.item.id}`}
                        className="sr-only"
                      >
                        Note for {ci.item.name}
                      </label>
                      <input
                        id={`note-input-${ci.item.id}`}
                        type="text"
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveItemNote();
                          if (e.key === "Escape") {
                            setNoteEditingItem(null);
                            setNoteText("");
                          }
                        }}
                        placeholder="Special instructions..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-[#D92312] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={saveItemNote}
                        className="rounded-lg bg-[#D92312] px-2 py-1 text-[10px] font-bold text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : ci.notes ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNoteEditingItem(ci.item.id);
                        setNoteText(ci.notes || "");
                      }}
                      className="flex flex-1 items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-left text-[11px] font-bold text-amber-800 transition hover:bg-amber-100"
                    >
                      <StickyNote size={10} />
                      <span className="truncate">{ci.notes}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNoteEditingItem(ci.item.id);
                        setNoteText("");
                      }}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                    >
                      <Plus size={9} /> Add note
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="customer-name" className="sr-only">
              Customer name
            </label>
            <input
              id="customer-name"
              type="text"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div className="relative">
            <label htmlFor="customer-phone" className="sr-only">
              Customer phone
            </label>
            <input
              id="customer-phone"
              type="tel"
              inputMode="numeric"
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(normalisePhone(e.target.value))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearchCustomer();
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            {customerPhone.length === 10 && !linkedCustomer && (
              <button
                type="button"
                onClick={() => void handleSearchCustomer()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white"
              >
                Find
              </button>
            )}
            {linkedCustomer && (
              <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                <CheckCircle size={9} /> Linked
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold text-slate-800">
              ₹{subtotal.toFixed(2)}
            </span>
          </div>
          {packing.total > 0 && <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Packing charge</span><span className="font-semibold text-slate-800">₹{packing.total.toFixed(2)}</span></div>}

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setDiscountMode("flat")}
                  aria-pressed={discountMode === "flat"}
                  className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                    discountMode === "flat"
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Flat amount (₹)"
                >
                  ₹
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode("percent")}
                  aria-pressed={discountMode === "percent"}
                  className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                    discountMode === "percent"
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Percentage (%)"
                >
                  %
                </button>
              </div>
              <label htmlFor="discount-value" className="sr-only">
                Discount value
              </label>
              <input
                id="discount-value"
                type="number"
                min="0"
                max={discountMode === "percent" ? 100 : undefined}
                value={discountValue || ""}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  setDiscountValue(
                    discountMode === "percent" ? Math.min(100, v) : v
                  );
                }}
                placeholder={discountMode === "percent" ? "%" : "₹"}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-[#D92312] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {DISCOUNT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyDiscountPreset(p)}
                  aria-pressed={
                    discountMode === p.mode && discountValue === p.value
                  }
                  className={`flex-1 rounded-lg border py-1 text-[10px] font-black transition ${
                    discountMode === p.mode && discountValue === p.value
                      ? "border-[#D92312] bg-red-50 text-[#D92312]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#D92312] hover:bg-red-50 hover:text-[#D92312]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {computedDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Discount
                {discountMode === "percent" ? ` (${discountValue}%)` : ""}
              </span>
              <span className="font-semibold text-emerald-600">
                −₹{computedDiscount.toFixed(2)}
              </span>
            </div>
          )}

          {orderType === "delivery" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Delivery fee</span>
              <span className="font-semibold text-slate-800">
                ₹{DELIVERY_FEE.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-base font-black text-slate-900">
              Grand Total
            </span>
            <span className="text-xl font-black text-[#D92312]">
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            aria-pressed={paymentMethod === "cash"}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
              paymentMethod === "cash"
                ? "border-[#D92312] bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("online")}
            aria-pressed={paymentMethod === "online"}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
              paymentMethod === "online"
                ? "border-[#D92312] bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            Online / UPI
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCounterPaymentStatus("paid")}
            aria-pressed={counterPaymentStatus === "paid"}
            className={`rounded-xl border py-2 text-xs font-bold transition ${
              counterPaymentStatus === "paid"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            ✓ Paid
          </button>
          <button
            type="button"
            onClick={() => setCounterPaymentStatus("pending")}
            aria-pressed={counterPaymentStatus === "pending"}
            className={`rounded-xl border py-2 text-xs font-bold transition ${
              counterPaymentStatus === "pending"
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            ⏳ Pending
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={confirmClearCart}
            disabled={cartItems.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={cartItems.length === 0 || isSubmitting}
            onClick={() => void handlePlaceOrder(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D92312] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#B8190B] active:scale-[0.98] disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />{" "}
                {editingOrderId ? "Updating…" : "Placing…"}
              </>
            ) : (
              <>
                <Printer size={13} />{" "}
                {editingOrderId ? "Update & Print" : "Generate Bill"}
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-300">
          F4 place · F6 save only · F8 clear
        </p>
      </div>
    </div>
  );

  /* ============================================================ */
  /* Main render                                                  */
  /* ============================================================ */

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <Toast state={toast} onDismiss={dismissToast} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <StaffAttendanceAction token={staffSession?.token as string | undefined} branchId={staffSession?.branchId} />

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOrdersOpen(true)}
            aria-label="Open orders panel"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 lg:hidden"
          >
            <ChevronRight size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#D92312] text-white">
              <Store size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black text-slate-900">
                EL PRESTO · Counter
              </h1>
              <p className="hidden truncate text-[11px] text-slate-500 sm:block">
                {activeCounter?.name || "Counter"} · {activeOrders.length}{" "}
                active · {cartCount} in cart
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isElevatedUser && branches.length > 1 && (
            <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 sm:flex">
              <label htmlFor="branch-select" className="sr-only">
                Switch branch
              </label>
              <select
                id="branch-select"
                value={activeBranchId}
                onChange={(e) => void handleBranchSwitch(e.target.value)}
                className="max-w-[140px] cursor-pointer bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {printStatus !== "idle" && (
            <span
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase sm:flex ${
                printStatus === "printing"
                  ? "bg-blue-50 text-blue-700"
                  : printStatus === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {printStatus === "printing" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Printer size={11} />
              )}
              {printStatus === "printing"
                ? "Printing"
                : printStatus === "success"
                ? "Printed"
                : "Failed"}
            </span>
          )}

          {lastPlacedOrder && (
            <button
              type="button"
              onClick={() => void handlePrintReceipt(lastPlacedOrder)}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 sm:flex"
              title="Reprint last receipt"
            >
              <Printer size={11} /> {lastPlacedOrder.orderNumber}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            aria-label="Show keyboard shortcuts"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 md:flex"
            title="Keyboard shortcuts (F1)"
          >
            <Keyboard size={11} /> F1
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 md:flex"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "pos" ? "history" : "pos")}
            className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:block"
          >
            {activeTab === "pos" ? "History" : "POS"}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            aria-label="Open cart"
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 lg:hidden"
          >
            <ShoppingCart size={16} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#D92312] px-1 font-mono text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      {activeTab === "pos" ? (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 border-r border-slate-200 lg:block">
            {OrdersListPanel}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900">
                    Menu ·{" "}
                    {orderType === "delivery"
                      ? "Delivery"
                      : "Counter / Takeaway"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Select items to add to current order
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DateNavigator
                    selectedDate={selectedDate}
                    onChangeDate={setSelectedDate}
                    variant="light"
                    orderCount={orders.length}
                    isLoading={ordersLoading}
                  />
                  <button
                    type="button"
                    onClick={() => searchInputRef.current?.focus()}
                    className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 sm:flex"
                  >
                    <Keyboard size={11} /> F2
                  </button>
                </div>
              </div>

              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <label htmlFor="menu-search" className="sr-only">
                  Search menu
                </label>
                <input
                  id="menu-search"
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear menu search"
                    className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="scrollbar-none mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedSubcategory("all");
                  }}
                  aria-pressed={selectedCategory === "all"}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    selectedCategory === "all"
                      ? "bg-[#D92312] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  All
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0 text-[10px] font-black ${
                      selectedCategory === "all"
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {categoryCounts.all || 0}
                  </span>
                </button>
                {categoryNames.map((catName) => {
                  const active = selectedCategory === catName;
                  const count = categoryCounts[catName] || 0;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(catName);
                        setSelectedSubcategory("all");
                      }}
                      aria-pressed={active}
                      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-[#D92312] text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {catName}
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0 text-[10px] font-black ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {currentSubcategories.length > 0 && (
                <div className="scrollbar-none mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategory("all")}
                    aria-pressed={selectedSubcategory === "all"}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      selectedSubcategory === "all"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    All
                  </button>
                  {currentSubcategories.map((subName) => (
                    <button
                      key={subName}
                      type="button"
                      onClick={() => setSelectedSubcategory(subName)}
                      aria-pressed={selectedSubcategory === subName}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition ${
                        selectedSubcategory === subName
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {subName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!searchQuery &&
              selectedCategory === "all" &&
              frequentItems.length > 0 && (
                <div className="border-b border-slate-200 bg-white px-5 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Frequently ordered
                    </span>
                  </div>
                  <div className="scrollbar-none flex gap-2 overflow-x-auto pb-0.5">
                    {frequentItems.map((item) => {
                      const inCart = cartItems.find(
                        (ci) => ci.item.id === item.id
                      );
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addToCart(item)}
                          className="group flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left transition hover:border-[#D92312] hover:bg-white active:scale-95"
                        >
                          <div className="min-w-0">
                            <p className="max-w-[120px] truncate text-xs font-bold text-slate-800">
                              {item.name}
                            </p>
                            <p className="text-[10px] font-black text-[#D92312]">
                              ₹{item.price}
                            </p>
                          </div>
                          {inCart ? (
                            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#D92312] px-1 font-mono text-[9px] font-black text-white">
                              {inCart.quantity}
                            </span>
                          ) : (
                            <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-slate-400 transition group-hover:border-[#D92312] group-hover:text-[#D92312]">
                              <Plus size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            <div className="flex-1 overflow-y-auto bg-white px-5 py-4">
              {groupedMenu.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
                    <Utensils size={22} className="text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    No items found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try a different search or category
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedMenu.map((group) => (
                    <div key={group.title}>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          {group.title}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0 text-[9px] font-black text-slate-500">
                          {group.items.length}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const inCart = cartItems.find(
                            (ci) => ci.item.id === item.id
                          );
                          const unavailable = item.available === false;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition ${
                                unavailable
                                  ? "opacity-40"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border-2 border-emerald-600 bg-white">
                                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 text-xs font-bold text-[#D92312]">
                                    ₹{item.price}
                                  </p>
                                </div>
                              </div>

                              {!unavailable && (
                                <div className="shrink-0">
                                  {inCart ? (
                                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1 py-0.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, -1)
                                        }
                                        aria-label={`Decrease ${item.name}`}
                                        className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-slate-100 active:scale-90"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="w-5 text-center font-mono text-xs font-bold text-slate-900">
                                        {inCart.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, 1)
                                        }
                                        aria-label={`Increase ${item.name}`}
                                        className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-slate-100 active:scale-90"
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => addToCart(item)}
                                      aria-label={`Add ${item.name}`}
                                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-[#D92312] hover:bg-red-50 hover:text-[#D92312] active:scale-95"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {unavailable && (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                                  Sold Out
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>

          <aside className="hidden w-96 shrink-0 border-l border-slate-200 lg:block">
            {OrderPanel}
          </aside>
        </div>
      ) : (
        /* History */
        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Order History
                </h2>
                <span className="text-xs text-slate-500">
                  {completedOrders.length} orders on this day
                </span>
              </div>
              <DateNavigator
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
                variant="light"
                orderCount={completedOrders.length}
                isLoading={ordersLoading}
              />
            </div>

            {ordersLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
                <Loader2
                  size={32}
                  className="mx-auto animate-spin text-[#D92312]"
                />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Loading orders...
                </p>
              </div>
            ) : ordersError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-12 text-center">
                <AlertCircle size={32} className="mx-auto text-red-500" />
                <p className="mt-3 text-sm font-bold text-red-700">
                  Unable to load orders. Please try again.
                </p>
                <p className="mt-1 text-xs text-red-500">{ordersError}</p>
                <button
                  type="button"
                  onClick={() => setSelectedDate((d) => d)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D92312] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#B8190B]"
                >
                  <RotateCcw size={13} /> Retry
                </button>
              </div>
            ) : completedOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
                <Printer size={36} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  No orders found for this date.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  There are no completed orders recorded for{" "}
                  {formatISTDisplayDate(selectedDate)}.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Payment</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedOrders.slice(0, 50).map((o) => {
                      const paid = (o.paymentStatus || "pending") === "paid";
                      return (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {o.orderNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {o.customerName}
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-500">
                            {o.type || o.orderType || "counter"}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            ₹{Math.round(o.total || 0)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                paid
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {paid ? "Paid" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {o.createdAt
                              ? toDate(o.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handlePrintReceipt(o)}
                                aria-label={`Print ${o.orderNumber}`}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50"
                                title="Print receipt"
                              >
                                <Printer size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateOrder(o)}
                                aria-label={`Duplicate ${o.orderNumber}`}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50"
                                title="Duplicate order"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile drawers */}
      {isMobileOrdersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Orders panel"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div
            onClick={() => setIsMobileOrdersOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl">
            {OrdersListPanel}
          </div>
        </div>
      )}

      {isMobileCartOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cart"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div
            onClick={() => setIsMobileCartOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 w-96 max-w-[90vw] bg-white shadow-2xl">
            {OrderPanel}
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setShowShortcuts(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#D92312] text-white">
                  <Keyboard size={15} />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: "F1", label: "Show shortcuts" },
                { key: "F2", label: "Focus menu search" },
                { key: "F4", label: "Place order & print bill" },
                { key: "F6", label: "Save without printing" },
                { key: "F8", label: "Clear current cart" },
                { key: "Esc", label: "Close modals / popups" },
                { key: "Enter", label: "Save item note (in field)" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-xs font-medium text-slate-600">
                    {label}
                  </span>
                  <kbd className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 shadow-sm">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
