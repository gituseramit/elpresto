"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle,
  Search,
  Maximize2,
  Minimize2,
  Bell,
  BellOff,
  LogOut,
  Printer,
  Check,
  X,
  Plus,
  PlusCircle,
  Utensils,
  Receipt,
  Flame,
  ArrowUpDown,
  FileText,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Eye,
  Trash2,
  Edit,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Loader2,
  Sun,
  Moon,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATEGORIES, DUMMY_MENU } from "@/data/menu";
import { subscribePanelStatus } from "@/lib/panelAuth";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import {
  subscribeDayOrders,
  getISTDateString,
  formatISTDisplayDate,
} from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";
import StaffAttendanceAction from "@/components/StaffAttendanceAction";

/* ============================================================
   TYPES
   ============================================================ */

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
}

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  phone?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: string;
  type?: "takeaway" | "delivery";
  orderType?: "takeaway" | "delivery";
  createdAt: any;
  completedAt?: any;
  instructions?: string;
  kitchenNotes?: string;
  deliveryStatus?: string;
  deliveryDistance?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  source?: string;
  cancelReason?: string;
  branchId?: string;
  createdBy?: string;
  updatedBy?: string;
}

interface StaffSession {
  email?: string;
  name?: string;
  role?: string;
  branchId?: string;
  [key: string]: unknown;
}

interface KitchenSettings {
  stationName: string;
  soundEnabled: boolean;
  warningThresholdMins: number;
  defaultSort: "oldest" | "newest";
}

type ThemeMode = "light" | "dark" | "system";

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

/* ============================================================
   CONSTANTS
   ============================================================ */

const THEME_STORAGE_KEY = "elpestro_kitchen_theme";
const SETTINGS_STORAGE_KEY = "elpestro_kitchen_settings";
const SEEN_ORDER_IDS_MAX = 2000;
const ORDERS_LIMIT_HINT = 500;

const DEFAULT_SETTINGS: KitchenSettings = {
  stationName: "Main Kitchen Station",
  soundEnabled: true,
  warningThresholdMins: 15,
  defaultSort: "oldest",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40";

const labelCls =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDate(value: any): Date {
  if (!value) return new Date();
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatISTTime(value: any): string {
  const d = toDate(value);
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

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `#ELP-K${stamp}${rand}`;
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isOrderEditable(order: Order): boolean {
  if (order.status === "completed" || order.status === "cancelled") return false;
  const src = (order.source || "").toLowerCase().trim();
  return (
    src === "kitchen" ||
    src === "on_spot" ||
    src === "on spot" ||
    src === "walk-in" ||
    src === "pos"
  );
}

/* ============================================================
   STATUS PILL
   ============================================================ */

function StatusPill({
  status,
  isDelivery,
  isLate,
}: {
  status: string;
  isDelivery: boolean;
  isLate?: boolean;
}) {
  let label = status;
  let cls =
    "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30";

  if (status === "preparing") {
    label = "Preparing";
    cls =
      "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:ring-orange-500/30";
  } else if (status === "ready") {
    label = isDelivery ? "Ready · Rider" : "Ready";
    cls =
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30";
  } else if (status === "completed") {
    label = "Done";
    cls =
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600/40";
  } else if (status === "cancelled") {
    label = "Cancelled";
    cls =
      "bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-500/30";
  } else if (status === "pending") {
    label = isLate ? "New · Late" : "New";
    cls = isLate
      ? "bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/25 dark:text-red-200 dark:ring-red-500/40"
      : "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

/* ============================================================
   THEME TOGGLE
   ============================================================ */

function ThemeQuickToggle({
  themeMode,
  setThemeMode,
}: {
  themeMode: ThemeMode;
  setThemeMode: (t: ThemeMode) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycle: Record<ThemeMode, ThemeMode> = {
    light: "dark",
    dark: "system",
    system: "light",
  };

  const Icon = !mounted
    ? Monitor
    : themeMode === "light"
    ? Sun
    : themeMode === "dark"
    ? Moon
    : Monitor;

  const label =
    themeMode === "light"
      ? "Light theme"
      : themeMode === "dark"
      ? "Dark theme"
      : "System theme";

  return (
    <button
      type="button"
      onClick={() => setThemeMode(cycle[themeMode])}
      title={`${label} (click to cycle)`}
      aria-label={`${label}. Click to cycle theme.`}
      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
    >
      <Icon size={15} />
    </button>
  );
}

/* ============================================================
   TOASTS
   ============================================================ */

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
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
            : t.kind === "error"
            ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200"
            : "border-slate-300 bg-white text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100";
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
                <AlertTriangle size={14} />
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

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
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
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md dark:bg-black/75"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900/95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {state.title}
          </h3>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {state.message}
          </p>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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

/* ============================================================
   PAGE
   ============================================================ */

export default function KitchenSystem() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>("");
  const [activeBranchName, setActiveBranchName] = useState<string>("");

  /* ---- Theme ---- */
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {
      /* ignore */
    }
    return "light";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  /* ---- Layout ---- */
  const [activeTab, setActiveTab] = useState<
    "new" | "preparing" | "completed" | "settings"
  >("new");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  /* ---- Data ---- */
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getISTDateString(0)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "takeaway" | "delivery">(
    "all"
  );
  const [sortBy, setSortBy] = useState<"oldest" | "newest">("oldest");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  /* ---- Kitchen notes ---- */
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);
  const [noteInput, setNoteInput] = useState("");

  /* ---- Notifications ---- */
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const alertTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef<boolean>(DEFAULT_SETTINGS.soundEnabled);

  /* ---- Toasts / confirm ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastIdRef = useRef(0);

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

  /* ---- POS create order ---- */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>(
    () => DUMMY_MENU as MenuItem[]
  );
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [menuSearchFilter, setMenuSearchFilter] = useState<string>("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>("All");
  const [newOrderCustomer, setNewOrderCustomer] = useState("Walk-in Customer");
  const [newOrderPhone, setNewOrderPhone] = useState("");
  const [newOrderType, setNewOrderType] = useState<"takeaway" | "delivery">(
    "takeaway"
  );
  const [newOrderInstructions, setNewOrderInstructions] = useState("");
  const [newOrderPaymentMethod, setNewOrderPaymentMethod] = useState<
    "cash" | "online"
  >("cash");
  const [newOrderSource, setNewOrderSource] = useState<
    "kitchen" | "swiggy" | "zomato" | "website"
  >("kitchen");
  const [newOrderDiscount, setNewOrderDiscount] = useState<number>(0);
  const [newOrderItems, setNewOrderItems] = useState<
    { id: string; name: string; quantity: number; price: number }[]
  >([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [createOrderSuccessMsg, setCreateOrderSuccessMsg] = useState<
    string | null
  >(null);

  /* ---- Edit order ---- */
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<
    { id: string; name: string; quantity: number; price: number }[]
  >([]);
  const [editOrderInstructions, setEditOrderInstructions] = useState("");
  const [editOrderDiscount, setEditOrderDiscount] = useState<number>(0);
  const [editSelectedMenuItemId, setEditSelectedMenuItemId] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  /* ---- Settings ---- */
  const [kitchenSettings, setKitchenSettings] =
    useState<KitchenSettings>(DEFAULT_SETTINGS);

  /* ============================================================
     INIT SESSION + SETTINGS
     ============================================================ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    // Load local settings + theme synchronously (already done for theme)
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<KitchenSettings>;
        const merged: KitchenSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
        setKitchenSettings(merged);
        setSortBy(merged.defaultSort);
        soundEnabledRef.current = merged.soundEnabled;
      }
    } catch {
      /* ignore */
    }

    import("@/lib/staffAuth")
      .then(({ getStaffSession, isSessionValid }) => {
        if (cancelled) return;
        try {
          const session = getStaffSession("kitchen") as StaffSession | null;
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

    const unsub = subscribePanelStatus("kitchen", () => {
      setIsAuthenticated(false);
      setStaffSession(null);
      setOrders([]);
      seenOrderIdsRef.current.clear();
      import("@/lib/staffAuth")
        .then(({ clearStaffSession }) => clearStaffSession("kitchen"))
        .catch(() => {
          /* ignore */
        });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  /* Keep soundEnabledRef in sync with settings */
  useEffect(() => {
    soundEnabledRef.current = kitchenSettings.soundEnabled;
  }, [kitchenSettings.soundEnabled]);

  /* Resolve active branch name from orders' branchId or settings */
  useEffect(() => {
    if (!activeBranchId) {
      setActiveBranchName("");
      return;
    }
    // We don't have a branches collection subscription; show the ID as fallback.
    setActiveBranchName((prev) => prev || activeBranchId);
  }, [activeBranchId]);

  /* ============================================================
     THEME APPLICATION
     ============================================================ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;

    const apply = () => {
      const resolved: "light" | "dark" =
        themeMode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : themeMode;
      setResolvedTheme(resolved);
      if (resolved === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };

    apply();
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      /* ignore */
    }

    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  /* ============================================================
     FULLSCREEN SYNC
     ============================================================ */

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullScreen = useCallback(() => {
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

  /* ============================================================
     AUDIO
     ============================================================ */

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (!audioContextRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        audioContextRef.current = new Ctor();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {
          /* ignore */
        });
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      window.setTimeout(() => {
        if (!audioContextRef.current) return;
        const ctx2 = audioContextRef.current;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = 1174.66;
        gain2.gain.setValueAtTime(0.35, ctx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.2);
        osc2.start();
        osc2.stop(ctx2.currentTime + 0.2);
      }, 150);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          /* ignore */
        });
        audioContextRef.current = null;
      }
      if (alertTimeoutRef.current != null) {
        window.clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  /* ============================================================
     LOGOUT
     ============================================================ */

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setStaffSession(null);
    setOrders([]);
    seenOrderIdsRef.current.clear();
    setNewOrderAlert(null);
    import("@/lib/staffAuth")
      .then(({ clearStaffSession }) => clearStaffSession("kitchen"))
      .catch(() => {
        /* ignore */
      });
  }, []);

  /* ============================================================
     REALTIME ORDERS LISTENER
     ============================================================ */

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!activeBranchId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeDayOrders(
      selectedDate,
      (fetched: Order[]) => {
        const newlyAdded = fetched.filter(
          (o) =>
            (o.status === "pending" || o.status === "preparing") &&
            !seenOrderIdsRef.current.has(o.id)
        );

        if (newlyAdded.length > 0 && seenOrderIdsRef.current.size > 0) {
          if (soundEnabledRef.current) playNotificationSound();
          setNewOrderAlert(newlyAdded[0]);
          if (alertTimeoutRef.current != null) {
            window.clearTimeout(alertTimeoutRef.current);
          }
          alertTimeoutRef.current = window.setTimeout(() => {
            setNewOrderAlert(null);
            alertTimeoutRef.current = null;
          }, 6000);
        }

        fetched.forEach((o) => seenOrderIdsRef.current.add(o.id));
        // Cap the set to avoid unbounded growth
        if (seenOrderIdsRef.current.size > SEEN_ORDER_IDS_MAX) {
          const arr = Array.from(seenOrderIdsRef.current);
          const trimmed = arr.slice(-SEEN_ORDER_IDS_MAX);
          seenOrderIdsRef.current = new Set(trimmed);
        }

        setOrders(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Kitchen orders error:", err);
        setError("Unable to load orders. Please try again.");
        setLoading(false);
      },
      activeBranchId
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [
    isAuthenticated,
    selectedDate,
    activeBranchId,
    playNotificationSound,
  ]);

  /* Reset seen IDs on branch/date change */
  useEffect(() => {
    seenOrderIdsRef.current.clear();
  }, [selectedDate, activeBranchId]);

  /* ============================================================
     LIVE MENU
     ============================================================ */

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setMenuLoading(true);

    (async () => {
      try {
        const snap = await getDocs(collection(db, "menuItems"));
        if (cancelled) return;
        if (!snap.empty) {
          const map = new Map<string, MenuItem>();
          (DUMMY_MENU as MenuItem[]).forEach((item) => map.set(item.id, item));
          snap.docs.forEach((d) => {
            const data = d.data() as Partial<MenuItem>;
            map.set(d.id, {
              id: d.id,
              name: String(data.name || "Unnamed item"),
              price: safeNumber(data.price),
              category: data.category,
            });
          });
          setAvailableMenuItems(Array.from(map.values()));
        }
      } catch (e) {
        console.warn("Using default menu items:", e);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /* ============================================================
     STATUS UPDATE
     ============================================================ */

  const handleUpdateStatus = useCallback(
    async (orderId: string, newStatus: string, extraData: any = {}) => {
      try {
        await updateDoc(doc(db, "orders", orderId), {
          status: newStatus,
          updatedAt: Timestamp.now(),
          updatedBy: staffSession?.email || "kitchen",
          ...extraData,
        });
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: newStatus, ...extraData } : o
          )
        );
      } catch (err: any) {
        console.error("Error updating order:", err);
        pushToast("error", `Failed to update order: ${err?.message || err}`);
      }
    },
    [pushToast, staffSession]
  );

  /* ============================================================
     KITCHEN NOTE
     ============================================================ */

  const handleSaveKitchenNote = useCallback(async () => {
    if (!noteOrder) return;
    try {
      await updateDoc(doc(db, "orders", noteOrder.id), {
        kitchenNotes: noteInput,
        updatedAt: Timestamp.now(),
        updatedBy: staffSession?.email || "kitchen",
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === noteOrder.id ? { ...o, kitchenNotes: noteInput } : o
        )
      );
      setNoteOrder(null);
      setNoteInput("");
    } catch (err: any) {
      pushToast("error", `Failed to save note: ${err?.message || err}`);
    }
  }, [noteOrder, noteInput, pushToast, staffSession]);

  /* ============================================================
     CANCEL ORDER (with confirm modal, not window.prompt)
     ============================================================ */

  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const openCancelDialog = useCallback((order: Order) => {
    setCancelTarget(order);
    setCancelReasonInput("Item out of stock");
  }, []);

  const confirmCancelOrder = useCallback(async () => {
    if (!cancelTarget) return;
    const reason = cancelReasonInput.trim() || "Item out of stock";
    await handleUpdateStatus(cancelTarget.id, "cancelled", {
      cancelReason: reason,
    });
    setCancelTarget(null);
    setCancelReasonInput("");
  }, [cancelTarget, cancelReasonInput, handleUpdateStatus]);

  /* ============================================================
     PRINT KOT (escaped)
     ============================================================ */

  const handlePrintReceipt = useCallback((order: Order) => {
    const orderDate = toDate(order.createdAt);
    const isDelivery = (order.type || order.orderType) === "delivery";

    const itemsHtml = (order.items || [])
      .map((item) => {
        const noteHtml = item.notes
          ? `<tr><td style="font-size:11px;padding-left:18px;color:#333;">↳ ${escapeHtml(
              item.notes
            )}</td></tr>`
          : "";
        return `
        <tr>
          <td style="font-size:14px;font-weight:bold;">${escapeHtml(
            item.quantity
          )}x ${escapeHtml(item.name)}</td>
        </tr>${noteHtml}`;
      })
      .join("");

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KOT - ${escapeHtml(order.orderNumber)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: monospace; font-size: 13px; width: 72mm; padding: 8px; color: black; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
          .header h1 { font-size: 20px; font-weight: bold; }
          .header p { font-size: 11px; margin-top: 2px; }
          .meta { font-size: 12px; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          td { padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .instructions { background: #eee; padding: 4px; font-weight: bold; margin: 6px 0; font-size: 12px; }
          .notes { border: 1px dashed #000; padding: 4px; margin-top: 6px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>KITCHEN ORDER TICKET</h1>
          <p>EL PRESTO PIZZA • UCER CAMPUS</p>
          ${
            activeBranchName
              ? `<p>BRANCH: ${escapeHtml(activeBranchName)}</p>`
              : ""
          }
        </div>
        <div class="meta">
          <p style="font-size:18px;font-weight:bold;">ORDER: ${escapeHtml(
            order.orderNumber
          )}</p>
          <p>TYPE: ${escapeHtml(
            (isDelivery ? "DELIVERY" : "PICKUP").toUpperCase()
          )}</p>
          <p>TIME: ${escapeHtml(formatISTTime(orderDate))}</p>
          <p>CUSTOMER: ${escapeHtml(order.customerName)}</p>
          <p style="font-weight:bold;">PAYMENT: ${escapeHtml(
            (
              order.paymentMethod === "online" ? "ONLINE (PAID)" : "CASH"
            ).toUpperCase()
          )}</p>
          <p>TOTAL: ₹${escapeHtml(Math.round(safeNumber(order.total)))} ${
            order.deliveryFee
              ? `(Inc. ₹${escapeHtml(Math.round(safeNumber(order.deliveryFee)))} Delivery)`
              : ""
          }</p>
        </div>
        <table><tbody>${itemsHtml}</tbody></table>
        ${
          order.instructions
            ? `<div class="instructions">CUSTOMER NOTE: ${escapeHtml(
                order.instructions
              )}</div>`
            : ""
        }
        ${
          order.kitchenNotes
            ? `<div class="notes">KITCHEN NOTE: ${escapeHtml(
                order.kitchenNotes
              )}</div>`
            : ""
        }
      </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=380,height=550");
    if (!printWin) {
      pushToast(
        "error",
        "Print window was blocked. Please allow pop-ups for this site."
      );
      return;
    }
    printWin.document.write(receiptHtml);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }, [activeBranchName, pushToast]);

  /* ============================================================
     MENU FILTERS (memoized)
     ============================================================ */

  const filteredDropdownMenuItems = useMemo(() => {
    const q = menuSearchFilter.trim().toLowerCase();
    return availableMenuItems.filter((item) => {
      const matchesCategory =
        menuCategoryFilter === "All" || item.category === menuCategoryFilter;
      if (!matchesCategory) return false;
      if (!q) return true;
      const nameMatch = (item.name || "").toLowerCase().includes(q);
      const catMatch = (item.category || "").toLowerCase().includes(q);
      return nameMatch || catMatch;
    });
  }, [availableMenuItems, menuCategoryFilter, menuSearchFilter]);

  /* ============================================================
     POS CART HELPERS
     ============================================================ */

  const handleAddItemToOrder = useCallback(() => {
    if (!selectedMenuItemId) return;
    const menuItem = availableMenuItems.find((i) => i.id === selectedMenuItemId);
    if (!menuItem) return;
    setNewOrderItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === menuItem.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + selectedQuantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: menuItem.id,
          name: menuItem.name,
          quantity: selectedQuantity,
          price: safeNumber(menuItem.price),
        },
      ];
    });
    setSelectedQuantity(1);
  }, [availableMenuItems, selectedMenuItemId, selectedQuantity]);

  const handleAddItemDirect = useCallback((item: MenuItem) => {
    if (!item) return;
    setNewOrderItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          quantity: 1,
          price: safeNumber(item.price),
        },
      ];
    });
  }, []);

  const handleUpdateItemQuantity = useCallback((id: string, delta: number) => {
    setNewOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((x): x is { id: string; name: string; quantity: number; price: number } => Boolean(x))
    );
  }, []);

  const handleRemoveItemFromOrder = useCallback((id: string) => {
    setNewOrderItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /* ============================================================
     CREATE ORDER
     ============================================================ */

  const resetCreateForm = useCallback(() => {
    setNewOrderCustomer("Walk-in Customer");
    setNewOrderPhone("");
    setNewOrderInstructions("");
    setNewOrderItems([]);
    setNewOrderDiscount(0);
    setSelectedMenuItemId("");
    setSelectedQuantity(1);
    setNewOrderType("takeaway");
    setNewOrderPaymentMethod("cash");
    setNewOrderSource("kitchen");
  }, []);

  const handleCreateKitchenOrder = useCallback(
    async (printKOT: boolean = false) => {
      if (!activeBranchId) {
        pushToast("error", "No branch selected. Please re-login.");
        return;
      }
      if (newOrderItems.length === 0) {
        pushToast("error", "Please add at least one item from the menu.");
        return;
      }

      setIsSubmittingOrder(true);
      try {
        const newOrderNum = generateOrderNumber();
        const subtotal = newOrderItems.reduce(
          (acc, item) => acc + safeNumber(item.price) * item.quantity,
          0
        );
        const discount = Math.max(0, safeNumber(newOrderDiscount));
        const isDelivery = newOrderType === "delivery";
        const deliveryFee = 0; // Kitchen POS does not charge delivery
        const finalTotal = Math.max(0, subtotal + deliveryFee - discount);

        const orderData = {
          orderNumber: newOrderNum,
          customerName: newOrderCustomer.trim() || "Walk-in Customer",
          customerPhone: newOrderPhone.trim() || "Counter",
          phone: newOrderPhone.trim() || "Counter",
          type: newOrderType,
          orderType: newOrderType,
          instructions: newOrderInstructions.trim() || "",
          kitchenNotes:
            newOrderSource === "kitchen"
              ? "Created at POS counter (On Spot)"
              : `External channel: ${newOrderSource.toUpperCase()}`,
          items: newOrderItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: safeNumber(item.price),
          })),
          subtotal,
          discount,
          deliveryFee,
          total: finalTotal,
          paymentMethod: newOrderPaymentMethod,
          paymentStatus: newOrderPaymentMethod === "online" ? "paid" : "pending",
          status: "pending",
          source: newOrderSource,
          branchId: activeBranchId,
          createdBy: staffSession?.email || "kitchen",
          updatedBy: staffSession?.email || "kitchen",
          createdAt: Timestamp.now(),
          location: isDelivery
            ? "Direct Dine-in / Order"
            : "Kitchen Counter Pickup",
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        if (soundEnabledRef.current) playNotificationSound();

        setCreateOrderSuccessMsg(
          `Ticket ${newOrderNum} created & sent to New Orders!`
        );
        window.setTimeout(() => setCreateOrderSuccessMsg(null), 5000);

        if (printKOT) {
          handlePrintReceipt({ id: docRef.id, ...(orderData as any) });
        }

        resetCreateForm();
        setShowCreateModal(false);
        setActiveTab("new");
      } catch (err: any) {
        console.error("Failed to create order:", err);
        pushToast("error", `Failed to create order: ${err?.message || err}`);
      } finally {
        setIsSubmittingOrder(false);
      }
    },
    [
      activeBranchId,
      newOrderItems,
      newOrderDiscount,
      newOrderType,
      newOrderCustomer,
      newOrderPhone,
      newOrderInstructions,
      newOrderSource,
      newOrderPaymentMethod,
      playNotificationSound,
      handlePrintReceipt,
      pushToast,
      resetCreateForm,
      staffSession,
    ]
  );

  /* ============================================================
     EDIT ORDER
     ============================================================ */

  const handleStartEditOrder = useCallback(
    (order: Order) => {
      if (!isOrderEditable(order)) {
        pushToast(
          "info",
          "External orders (Website, Swiggy, Zomato) are locked and cannot be edited."
        );
        return;
      }
      setEditingOrder(order);
      setEditOrderItems(
        (order.items || []).map((i, idx) => ({
          id: i.id || `${order.id}-item-${idx}`,
          name: i.name,
          quantity: i.quantity || 1,
          price: safeNumber(i.price),
        }))
      );
      setEditOrderInstructions(order.instructions || "");
      setEditOrderDiscount(Math.max(0, safeNumber(order.discount)));
      setEditSelectedMenuItemId("");
    },
    [pushToast]
  );

  const handleAddItemToEditOrder = useCallback((itemToAdd: MenuItem) => {
    if (!itemToAdd) return;
    setEditOrderItems((prev) => {
      const exists = prev.find(
        (i) =>
          i.id === itemToAdd.id ||
          i.name.toLowerCase() === itemToAdd.name.toLowerCase()
      );
      if (exists) {
        return prev.map((i) =>
          i.id === exists.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: itemToAdd.id,
          name: itemToAdd.name,
          quantity: 1,
          price: safeNumber(itemToAdd.price),
        },
      ];
    });
  }, []);

  const handleUpdateEditItemQty = useCallback((id: string, delta: number) => {
    setEditOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter((x): x is { id: string; name: string; quantity: number; price: number } => Boolean(x))
    );
  }, []);

  const handleRemoveEditItem = useCallback((id: string) => {
    setEditOrderItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSaveEditedOrder = useCallback(async () => {
    if (!editingOrder) return;
    if (editOrderItems.length === 0) {
      pushToast("error", "Order must contain at least one item.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const subtotal = editOrderItems.reduce(
        (acc, i) => acc + safeNumber(i.price) * i.quantity,
        0
      );
      const deliveryFee = safeNumber(editingOrder.deliveryFee);
      const discount = Math.max(0, safeNumber(editOrderDiscount));
      const total = Math.max(0, subtotal + deliveryFee - discount);

      // Keep paymentStatus consistent if the total changed on an unpaid order.
      const paymentStatus =
        editingOrder.paymentStatus === "paid" ? "paid" : "pending";

      await updateDoc(doc(db, "orders", editingOrder.id), {
        items: editOrderItems,
        subtotal,
        discount,
        total,
        instructions: editOrderInstructions,
        paymentStatus,
        updatedAt: Timestamp.now(),
        updatedBy: staffSession?.email || "kitchen",
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id
            ? {
                ...o,
                items: editOrderItems,
                subtotal,
                discount,
                total,
                instructions: editOrderInstructions,
                paymentStatus,
              }
            : o
        )
      );

      pushToast("success", `Order ${editingOrder.orderNumber} updated.`);
      setEditingOrder(null);
    } catch (err: any) {
      pushToast("error", `Failed to update order: ${err?.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    editingOrder,
    editOrderItems,
    editOrderDiscount,
    editOrderInstructions,
    pushToast,
    staffSession,
  ]);

  /* ============================================================
     DERIVED DATA (memoized)
     ============================================================ */

  const getElapsedMinutes = useCallback((createdAt: any) => {
    const orderDate = toDate(createdAt);
    const diffMs = Date.now() - orderDate.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }, []);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (activeTab === "new") return o.status === "pending";
        if (activeTab === "preparing") return o.status === "preparing";
        if (activeTab === "completed") {
          return (
            o.status === "ready" ||
            o.status === "assigned" ||
            o.status === "out_for_delivery" ||
            o.status === "completed" ||
            o.deliveryStatus === "delivered"
          );
        }
        return true;
      })
      .filter((o) => {
        if (typeFilter === "all") return true;
        const t = (o.type || o.orderType || "takeaway").toLowerCase();
        if (typeFilter === "takeaway") {
          return t === "takeaway" || t === "counter" || t === "pickup";
        }
        return t === typeFilter;
      })
      .filter((o) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.items || []).some((i) =>
            (i?.name || "").toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        const timeA = toDate(a.createdAt).getTime();
        const timeB = toDate(b.createdAt).getTime();
        return sortBy === "oldest" ? timeA - timeB : timeB - timeA;
      });
  }, [orders, activeTab, typeFilter, searchQuery, sortBy]);

  const counts = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === "pending").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      completedToday: orders.filter(
        (o) =>
          o.status === "ready" ||
          o.status === "assigned" ||
          o.status === "out_for_delivery" ||
          o.status === "completed" ||
          o.deliveryStatus === "delivered"
      ).length,
    }),
    [orders]
  );

  /* Warn about large order volume */
  useEffect(() => {
    if (orders.length >= ORDERS_LIMIT_HINT) {
      pushToast(
        "info",
        `Large order volume (${orders.length}) for this date. Consider narrowing the filter.`
      );
    }
  }, [orders.length, pushToast]);

  /* ============================================================
     SIDEBAR: escape + scroll lock + focus
     ============================================================ */

  useEffect(() => {
    if (!isSidebarOpen) return;
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isSidebarOpen]);

  /* ============================================================
     LOGIN GATE
     ============================================================ */

  if (isVerifyingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <StaffLoginForm
        panel="kitchen"
        panelDisplayName="Kitchen Display & KOT System"
        panelIcon={<ChefHat size={28} />}
        onSuccess={(session: unknown) => {
          const s = (session as StaffSession) || null;
          setStaffSession(s);
          setIsAuthenticated(true);
          if (s?.branchId) setActiveBranchId(s.branchId);
        }}
      />
    );
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 selection:bg-orange-200/60 lg:flex-row dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-orange-500/30">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <StaffAttendanceAction token={staffSession?.token as string | undefined} branchId={staffSession?.branchId} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {/* ===================================================== */}
      {/* SIDEBAR                                                 */}
      {/* ===================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-slate-200 bg-white p-4 shadow-sm transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 dark:border-white/5 dark:bg-slate-900/95 dark:shadow-none dark:backdrop-blur-xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-white/10">
                <ChefHat size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black leading-tight text-slate-900 dark:text-white">
                  EL PRESTO
                </h1>
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-orange-500 dark:text-orange-400">
                  {kitchenSettings.stationName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation"
              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 transition hover:text-slate-900 lg:hidden dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setIsSidebarOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
          >
            <PlusCircle size={16} strokeWidth={2.5} /> New Order
          </button>

          <nav className="space-y-1">
            {[
              {
                id: "new" as const,
                label: "New Orders",
                icon: Bell,
                badge: counts.pending,
                activeCls:
                  "bg-amber-500 text-white shadow-md shadow-amber-500/30",
                badgeActive: "bg-white/25 text-white",
                iconCls: "text-amber-500",
              },
              {
                id: "preparing" as const,
                label: "Preparing",
                icon: Flame,
                badge: counts.preparing,
                activeCls:
                  "bg-orange-500 text-white shadow-md shadow-orange-500/30",
                badgeActive: "bg-white/25 text-white",
                iconCls: "text-orange-500",
              },
              {
                id: "completed" as const,
                label: "Ready / Done",
                icon: CheckCircle,
                badge: counts.completedToday,
                activeCls:
                  "bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
                badgeActive: "bg-white/25 text-white",
                iconCls: "text-emerald-500",
              },
              {
                id: "settings" as const,
                label: "Settings",
                icon: SettingsIcon,
                badge: undefined,
                activeCls: "bg-slate-900 text-white shadow-md dark:bg-slate-700",
                badgeActive: "",
                iconCls: "text-slate-400",
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsSidebarOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
                    isActive
                      ? tab.activeCls
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={16}
                      className={isActive ? "text-white" : tab.iconCls}
                    />
                    <span>{tab.label}</span>
                  </div>
                  {typeof tab.badge === "number" && tab.badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        isActive
                          ? tab.badgeActive
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 dark:border-white/5 dark:bg-slate-800/60 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live Kitchen
            </span>
            <span className="font-mono text-slate-400 dark:text-slate-500">
              {activeBranchName || "—"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden dark:bg-slate-950/70"
        />
      )}

      {/* ===================================================== */}
      {/* MAIN                                                    */}
      {/* ===================================================== */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/85">
          <div className="flex flex-col gap-3 px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation"
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <MenuIcon size={16} />
              </button>

              <div className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:flex dark:border-white/5 dark:bg-slate-950 dark:shadow-none">
                {[
                  {
                    id: "new" as const,
                    label: "New",
                    icon: Bell,
                    count: counts.pending,
                    activeCls:
                      "bg-amber-500 text-white shadow-md shadow-amber-500/30",
                    countActive: "bg-white/25 text-white",
                  },
                  {
                    id: "preparing" as const,
                    label: "Preparing",
                    icon: Flame,
                    count: counts.preparing,
                    activeCls:
                      "bg-orange-500 text-white shadow-md shadow-orange-500/30",
                    countActive: "bg-white/25 text-white",
                  },
                  {
                    id: "completed" as const,
                    label: "Ready",
                    icon: CheckCircle,
                    count: counts.completedToday,
                    activeCls:
                      "bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
                    countActive: "bg-white/25 text-white",
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                        active
                          ? tab.activeCls
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <Icon size={13} />
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 text-[9px] font-black ${
                          active
                            ? tab.countActive
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="sm:hidden">
                <label htmlFor="mobile-tab-select" className="sr-only">
                  Select tab
                </label>
                <select
                  id="mobile-tab-select"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 shadow-sm focus:outline-none dark:border-white/5 dark:bg-slate-800 dark:text-white"
                >
                  <option value="new">New ({counts.pending})</option>
                  <option value="preparing">
                    Preparing ({counts.preparing})
                  </option>
                  <option value="completed">
                    Ready ({counts.completedToday})
                  </option>
                  <option value="settings">Settings</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative hidden lg:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  size={13}
                />
                <label htmlFor="desktop-search" className="sr-only">
                  Search orders
                </label>
                <input
                  id="desktop-search"
                  type="text"
                  placeholder="Search ticket or item…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-52 rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500"
                />
              </div>

              <div className="hidden lg:block">
                <DateNavigator
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  orderCount={orders.length}
                  isLoading={loading}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowMobileFilters((v) => !v)}
                aria-label="Toggle filters"
                aria-pressed={showMobileFilters}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Filters"
              >
                <SlidersHorizontal size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !kitchenSettings.soundEnabled;
                  setKitchenSettings((prev) => ({
                    ...prev,
                    soundEnabled: next,
                  }));
                  if (next) playNotificationSound();
                }}
                aria-label={
                  kitchenSettings.soundEnabled
                    ? "Mute kitchen audio alerts"
                    : "Enable kitchen audio alerts"
                }
                aria-pressed={kitchenSettings.soundEnabled}
                className={`grid h-9 w-9 place-items-center rounded-xl border shadow-sm transition ${
                  kitchenSettings.soundEnabled
                    ? "border-orange-300 bg-orange-100 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-400"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                }`}
                title="Kitchen audio chime"
              >
                {kitchenSettings.soundEnabled ? (
                  <Bell size={15} />
                ) : (
                  <BellOff size={15} />
                )}
              </button>

              <ThemeQuickToggle
                themeMode={themeMode}
                setThemeMode={setThemeMode}
              />

              <button
                type="button"
                onClick={toggleFullScreen}
                aria-label={
                  isFullScreen ? "Exit fullscreen" : "Enter fullscreen"
                }
                aria-pressed={isFullScreen}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Toggle fullscreen"
              >
                {isFullScreen ? (
                  <Minimize2 size={15} />
                ) : (
                  <Maximize2 size={15} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95 lg:flex"
              >
                <Plus size={15} strokeWidth={3} /> New Order
              </button>
            </div>
          </div>

          {showMobileFilters && (
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-3 lg:hidden dark:border-white/5 dark:bg-slate-900/40">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={13}
                />
                <label htmlFor="mobile-search" className="sr-only">
                  Search orders
                </label>
                <input
                  id="mobile-search"
                  type="text"
                  placeholder="Search ticket or item…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <DateNavigator
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  orderCount={orders.length}
                  isLoading={loading}
                />
                <label htmlFor="mobile-type-filter" className="sr-only">
                  Order type filter
                </label>
                <select
                  id="mobile-type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm focus:outline-none dark:border-white/5 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">All types</option>
                  <option value="takeaway">Takeaway / Counter</option>
                  <option value="delivery">Delivery</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setSortBy(sortBy === "oldest" ? "newest" : "oldest")
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm dark:border-white/5 dark:bg-slate-800 dark:text-slate-300"
                >
                  <ArrowUpDown size={13} className="text-orange-500" />
                  {sortBy === "oldest" ? "Oldest" : "Newest"}
                </button>
              </div>
            </div>
          )}

          <div className="hidden items-center justify-between border-t border-slate-100 px-5 py-2 lg:flex dark:border-white/5">
            <div className="flex items-center gap-2">
              {[
                { id: "all" as const, label: "All" },
                { id: "takeaway" as const, label: "Takeaway / Counter" },
                { id: "delivery" as const, label: "Delivery" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  aria-pressed={typeFilter === f.id}
                  className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                    typeFilter === f.id
                      ? "bg-slate-900 text-white shadow-sm dark:bg-slate-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setSortBy(sortBy === "oldest" ? "newest" : "oldest")
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ArrowUpDown size={12} className="text-orange-500" />
              {sortBy === "oldest" ? "Oldest first" : "Newest first"}
            </button>
          </div>
        </header>

        {newOrderAlert && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-orange-300 bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg dark:border-orange-400/30 dark:from-orange-600 dark:to-amber-600"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <span className="truncate">
                NEW ORDER — {newOrderAlert.orderNumber} ·{" "}
                {newOrderAlert.items?.length} items
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNewOrderAlert(null)}
              className="shrink-0 rounded-md bg-black/20 px-2 py-0.5 transition hover:bg-black/40"
            >
              Dismiss
            </button>
          </div>
        )}

        {createOrderSuccessMsg && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-emerald-300 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-black text-white shadow-lg dark:border-emerald-400/30 dark:from-emerald-600 dark:to-teal-600"
          >
            <span className="flex items-center gap-2">
              <CheckCircle size={15} /> {createOrderSuccessMsg}
            </span>
            <button
              type="button"
              onClick={() => setCreateOrderSuccessMsg(null)}
              className="rounded-md bg-black/20 px-2 py-0.5 transition hover:bg-black/40"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">
          {activeTab === "settings" ? (
            <div className="mx-auto max-w-xl space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none">
                <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                    <SettingsIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Station Preferences
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Sound, identity, display and theme
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className={labelCls}>Appearance</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          id: "light" as ThemeMode,
                          label: "Light",
                          icon: Sun,
                        },
                        {
                          id: "dark" as ThemeMode,
                          label: "Dark",
                          icon: Moon,
                        },
                        {
                          id: "system" as ThemeMode,
                          label: "System",
                          icon: Monitor,
                        },
                      ].map((t) => {
                        const Icon = t.icon;
                        const active = themeMode === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setThemeMode(t.id)}
                            aria-pressed={active}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[11px] font-black transition ${
                              active
                                ? "border-orange-400 bg-orange-50 text-orange-600 shadow-sm dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-300"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-white/5 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
                            }`}
                          >
                            <Icon size={18} />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
                      System follows your device's light/dark setting
                      automatically.
                      {themeMode === "system" && (
                        <span className="ml-1 text-orange-500">
                          (Currently {resolvedTheme})
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>Kitchen / Station Name</label>
                    <input
                      type="text"
                      value={kitchenSettings.stationName}
                      onChange={(e) =>
                        setKitchenSettings({
                          ...kitchenSettings,
                          stationName: e.target.value,
                        })
                      }
                      className={inputCls}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/40">
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 dark:text-white">
                        Audio Alert
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Chime on new orders
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={kitchenSettings.soundEnabled}
                      onClick={() => {
                        const next = !kitchenSettings.soundEnabled;
                        setKitchenSettings({
                          ...kitchenSettings,
                          soundEnabled: next,
                        });
                        if (next) playNotificationSound();
                      }}
                      className={`shrink-0 rounded-xl px-3 py-1.5 font-black transition ${
                        kitchenSettings.soundEnabled
                          ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {kitchenSettings.soundEnabled ? "Enabled" : "Muted"}
                    </button>
                  </div>

                  <div>
                    <label className={labelCls}>
                      Lateness Warning (Minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={kitchenSettings.warningThresholdMins}
                      onChange={(e) =>
                        setKitchenSettings({
                          ...kitchenSettings,
                          warningThresholdMins: Math.min(
                            60,
                            Math.max(5, parseInt(e.target.value) || 15)
                          ),
                        })
                      }
                      className={inputCls}
                    />
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
                      Tickets open longer than this pulse red as a delay alert.
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>Default Sort Order</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={
                          kitchenSettings.defaultSort === "oldest"
                        }
                        onClick={() =>
                          setKitchenSettings({
                            ...kitchenSettings,
                            defaultSort: "oldest",
                          })
                        }
                        className={`rounded-xl border py-2.5 text-xs font-black transition ${
                          kitchenSettings.defaultSort === "oldest"
                            ? "border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-500 dark:bg-orange-500/15 dark:text-orange-300"
                            : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/5 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                      >
                        Oldest First (FIFO)
                      </button>
                      <button
                        type="button"
                        aria-pressed={
                          kitchenSettings.defaultSort === "newest"
                        }
                        onClick={() =>
                          setKitchenSettings({
                            ...kitchenSettings,
                            defaultSort: "newest",
                          })
                        }
                        className={`rounded-xl border py-2.5 text-xs font-black transition ${
                          kitchenSettings.defaultSort === "newest"
                            ? "border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-500 dark:bg-orange-500/15 dark:text-orange-300"
                            : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/5 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                      >
                        Newest First
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem(
                          SETTINGS_STORAGE_KEY,
                          JSON.stringify(kitchenSettings)
                        );
                        setSortBy(kitchenSettings.defaultSort);
                        pushToast("success", "Kitchen settings saved.");
                      } catch {
                        pushToast("error", "Could not save settings.");
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                  >
                    <Check size={15} /> Save Preferences
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center py-24 text-center">
                  <Loader2
                    size={36}
                    className="mx-auto animate-spin text-orange-500"
                  />
                  <p className="mt-4 text-sm font-black text-slate-700 dark:text-slate-300">
                    Loading orders…
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fetching live orders for {selectedDate}
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center py-24 text-center">
                  <AlertTriangle
                    size={36}
                    className="mx-auto mb-2 text-red-500"
                  />
                  <p className="text-sm font-black text-red-600 dark:text-red-300">
                    Unable to load orders.
                  </p>
                  <p className="mt-1 text-xs text-red-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedDate((d) => d)}
                    className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-orange-600"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center py-24 text-center">
                  <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-100 dark:bg-slate-900">
                    <ChefHat
                      size={38}
                      className="text-slate-400 dark:text-slate-700"
                    />
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-500 dark:text-slate-400">
                    No orders found
                  </p>
                  <p className="mt-1 max-w-xs text-xs font-semibold text-slate-400 dark:text-slate-600">
                    Nothing recorded for {formatISTDisplayDate(selectedDate)}{" "}
                    under this filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                  >
                    <PlusCircle size={15} /> Create New Order
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredOrders.map((order) => {
                    const elapsed = getElapsedMinutes(order.createdAt);
                    const isLate =
                      elapsed >= kitchenSettings.warningThresholdMins &&
                      order.status !== "completed" &&
                      order.status !== "cancelled";
                    const isDelivery =
                      (order.type || order.orderType) === "delivery";
                    const itemCount = order.items?.length || 0;
                    const itemSummary =
                      (order.items || [])
                        .slice(0, 3)
                        .map((i) => `${i.quantity}× ${i.name}`)
                        .join(" • ") +
                      (itemCount > 3 ? ` +${itemCount - 3} more` : "");
                    const src = (order.source || "").toLowerCase().trim();
                    const isExternal =
                      src === "swiggy" || src === "zomato" || src === "website";

                    let accent = "border-slate-200 dark:border-white/5";
                    let topBar = "bg-slate-300 dark:bg-slate-700";
                    if (isLate) {
                      accent =
                        "border-red-300 ring-1 ring-red-200 dark:border-red-500/40 dark:ring-red-500/20";
                      topBar = "bg-red-500";
                    } else if (order.status === "preparing") {
                      accent = "border-orange-200 dark:border-orange-500/30";
                      topBar = "bg-orange-500";
                    } else if (order.status === "ready") {
                      accent = "border-emerald-200 dark:border-emerald-500/30";
                      topBar = "bg-emerald-500";
                    } else if (order.status === "pending") {
                      accent = "border-amber-200 dark:border-amber-500/30";
                      topBar = "bg-amber-500";
                    } else if (
                      order.status === "completed" ||
                      order.deliveryStatus === "delivered"
                    ) {
                      accent = "border-slate-200 dark:border-white/5";
                      topBar = "bg-slate-400 dark:bg-slate-600";
                    }

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedOrder(order);
                          }
                        }}
                        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${accent}`}
                      >
                        <div className={`h-1 w-full ${topBar}`} />

                        <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                          <div className="min-w-0">
                            <p className="font-mono text-lg font-black tracking-tight text-slate-900 dark:text-white">
                              {order.orderNumber}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                              {order.customerName}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${
                                isLate
                                  ? "animate-pulse bg-red-500 text-white shadow-md shadow-red-500/40"
                                  : elapsed >= 10
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              <Clock size={9} />
                              {elapsed}m
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                              isDelivery
                                ? "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30"
                                : "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600/40"
                            }`}
                          >
                            {isDelivery ? (
                              <Truck size={9} />
                            ) : (
                              <ShoppingBag size={9} />
                            )}
                            {isDelivery ? "Delivery" : "Pickup"}
                          </span>

                          <StatusPill
                            status={order.status}
                            isDelivery={isDelivery}
                            isLate={isLate}
                          />

                          {isExternal && (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30">
                              {src}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 px-4 pt-3 pb-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Items · {itemCount}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-200">
                            {itemSummary || "No items"}
                          </p>
                          {order.instructions && (
                            <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
                              ⚠️ {order.instructions}
                            </p>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3 dark:border-white/5 dark:bg-slate-950/40"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.status === "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(order.id, "preparing")
                              }
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                            >
                              <Flame size={13} /> Start Cooking
                            </button>
                          )}

                          {order.status === "preparing" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(order.id, "ready", {
                                  kitchenCompletedAt: Timestamp.now(),
                                  ...(isDelivery
                                    ? { deliveryStatus: "pending" }
                                    : {}),
                                })
                              }
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-lg active:scale-95"
                            >
                              <CheckCircle size={13} /> Mark Ready
                            </button>
                          )}

                          {order.status === "ready" && !isDelivery && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(order.id, "completed", {
                                  completedAt: Timestamp.now(),
                                })
                              }
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-lg active:scale-95"
                            >
                              <Check size={13} /> Mark Served
                            </button>
                          )}

                          {order.status === "ready" && isDelivery && (
                            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-100 py-2.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              <Truck size={13} /> Awaiting Rider
                            </span>
                          )}

                          {(order.status === "completed" ||
                            order.deliveryStatus === "delivered") && (
                            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                              <CheckCircle size={13} /> Done
                            </span>
                          )}

                          {order.status === "cancelled" && (
                            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5 text-xs font-black uppercase tracking-wider text-red-600 dark:bg-red-500/15 dark:text-red-400">
                              <X size={13} /> Cancelled
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            aria-label="View order details"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/5 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-md sm:items-center sm:p-4 dark:bg-black/75"
          onClick={() => setSelectedOrder(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-[0_25px_80px_-20px_rgba(0,0,0,0.25)] sm:rounded-3xl dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.7)] dark:backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 dark:border-white/5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-black text-orange-500 dark:text-orange-400">
                  {selectedOrder.orderNumber}
                </span>
                <StatusPill
                  status={selectedOrder.status}
                  isDelivery={
                    (selectedOrder.type || selectedOrder.orderType) ===
                    "delivery"
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-800/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Customer
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">
                    {selectedOrder.customerName}
                  </p>
                  {selectedOrder.phone &&
                    selectedOrder.phone !== "Counter" && (
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {selectedOrder.phone}
                      </p>
                    )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-800/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Time Elapsed
                  </p>
                  <p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">
                    {getElapsedMinutes(selectedOrder.createdAt)} min
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {formatISTTime(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Order Items
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    {selectedOrder.items?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-800/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-100 font-mono text-sm font-black text-orange-600 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/30">
                          {item.quantity}×
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          {item.notes && (
                            <p className="mt-0.5 truncate text-[10px] font-bold text-amber-600 dark:text-amber-300">
                              📝 {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(selectedOrder.instructions || selectedOrder.kitchenNotes) && (
                <div className="space-y-2">
                  {selectedOrder.instructions && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <AlertTriangle
                        size={15}
                        className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                          Customer Note
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                          {selectedOrder.instructions}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedOrder.kitchenNotes && (
                    <div className="flex items-start gap-2 rounded-2xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-500/30 dark:bg-purple-500/10">
                      <ChefHat
                        size={15}
                        className="mt-0.5 shrink-0 text-purple-500 dark:text-purple-400"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-500">
                          Kitchen Note
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-purple-800 dark:text-purple-200">
                          {selectedOrder.kitchenNotes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/5 dark:bg-slate-800/40">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-bold">Total Amount</span>
                  <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                    ₹{Math.round(safeNumber(selectedOrder.total))}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-white/5">
                  <span className="font-bold text-slate-500 dark:text-slate-400">
                    Payment
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${
                      selectedOrder.paymentStatus === "paid"
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                        : "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
                    }`}
                  >
                    {selectedOrder.paymentStatus === "paid"
                      ? "✓ Paid"
                      : "⏳ Pending"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setNoteOrder(selectedOrder);
                  setNoteInput(selectedOrder.kitchenNotes || "");
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-100 dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <FileText size={13} /> Add Note
              </button>
              <button
                type="button"
                onClick={() => {
                  const o = selectedOrder;
                  setSelectedOrder(null);
                  handlePrintReceipt(o);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-100 dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Printer size={13} /> Print
              </button>
              {isOrderEditable(selectedOrder) &&
                selectedOrder.status !== "completed" &&
                selectedOrder.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => {
                      const o = selectedOrder;
                      setSelectedOrder(null);
                      handleStartEditOrder(o);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-700 transition hover:bg-amber-200 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                  >
                    <Edit size={13} /> Edit
                  </button>
                )}
              {selectedOrder.status !== "completed" &&
                selectedOrder.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => {
                      const o = selectedOrder;
                      setSelectedOrder(null);
                      openCancelDialog(o);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-red-600 transition hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <X size={13} /> Cancel
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* KITCHEN NOTE MODAL */}
      {noteOrder && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md dark:bg-black/75"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/5">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Add Kitchen Note
                </h3>
                <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-orange-500 dark:text-orange-400">
                  {noteOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteOrder(null)}
                aria-label="Close kitchen note"
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4">
              <label htmlFor="kitchen-note-input" className="sr-only">
                Kitchen note
              </label>
              <textarea
                id="kitchen-note-input"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="e.g. Extra sauce, 2 min delay on fries…"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40"
              />
            </div>

            <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => setNoteOrder(null)}
                className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKitchenNote}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md dark:bg-black/75"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900/95">
            <div className="border-b border-slate-100 p-4 dark:border-white/5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Cancel Order
              </h3>
              <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-orange-500 dark:text-orange-400">
                {cancelTarget.orderNumber}
              </p>
            </div>
            <div className="p-4">
              <label htmlFor="cancel-reason" className={labelCls}>
                Reason
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReasonInput("");
                }}
                className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white shadow-md shadow-red-500/25 transition hover:-translate-y-0.5 hover:bg-red-500"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL (POS) */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/40 p-0 backdrop-blur-md sm:items-center sm:p-4 dark:bg-black/85"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white sm:h-[92vh] sm:max-w-6xl sm:rounded-3xl dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white/90 p-4 dark:border-white/5 dark:bg-slate-900/90">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                  <ChefHat size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900 sm:text-base dark:text-white">
                    POS Order Entry
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-600 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/30">
                      Live
                    </span>
                  </h3>
                  <p className="truncate text-[11px] font-semibold text-slate-500">
                    Select items left, review live bill right
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close POS"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden lg:flex-row lg:divide-x lg:divide-y-0 dark:divide-white/5">
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/70 p-3 sm:p-4 dark:bg-slate-950/40">
                <div className="mb-3 shrink-0 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-slate-900/70 dark:shadow-none">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        <Utensils size={12} className="text-orange-500" />
                        Quick Add
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="pos-item-select" className="sr-only">
                        Choose menu item
                      </label>
                      <select
                        id="pos-item-select"
                        value={selectedMenuItemId}
                        onChange={(e) => setSelectedMenuItemId(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/5 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">— Choose item —</option>
                        {availableMenuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} • ₹{item.price} ({item.category})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedQuantity((q) => Math.max(1, q - 1))
                            }
                            aria-label="Decrease quantity"
                            className="px-2.5 py-2 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          >
                            −
                          </button>
                          <span className="min-w-[24px] px-2 text-center font-mono text-xs font-black text-slate-900 dark:text-white">
                            {selectedQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => q + 1)}
                            aria-label="Increase quantity"
                            className="px-2.5 py-2 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={!selectedMenuItemId}
                          onClick={handleAddItemToOrder}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                          <Plus size={13} strokeWidth={3} /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                      size={14}
                    />
                    <label htmlFor="pos-menu-search" className="sr-only">
                      Search menu
                    </label>
                    <input
                      id="pos-menu-search"
                      type="text"
                      placeholder="Search menu item or category…"
                      value={menuSearchFilter}
                      onChange={(e) => setMenuSearchFilter(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/5 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40"
                    />
                  </div>

                  <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1">
                    {["All", ...CATEGORIES].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMenuCategoryFilter(cat)}
                        aria-pressed={menuCategoryFilter === cat}
                        className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                          menuCategoryFilter === cat
                            ? "border-orange-500/30 bg-orange-500 text-white shadow-md shadow-orange-500/25"
                            : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/5 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  {menuLoading ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <Loader2
                        size={28}
                        className="animate-spin text-orange-500"
                      />
                      <p className="mt-2 text-xs font-black text-slate-500">
                        Loading menu…
                      </p>
                    </div>
                  ) : filteredDropdownMenuItems.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <Utensils
                        size={32}
                        className="text-slate-300 dark:text-slate-700"
                      />
                      <p className="mt-2 text-xs font-black text-slate-500">
                        No items match
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-600">
                        Try another category or clear your search
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                      {filteredDropdownMenuItems.map((item) => {
                        const inBill = newOrderItems.find(
                          (i) => i.id === item.id
                        );
                        return (
                          <div
                            key={item.id}
                            onClick={() =>
                              !inBill && handleAddItemDirect(item)
                            }
                            className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-3 shadow-sm transition-all ${
                              inBill
                                ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200 dark:border-orange-500/50 dark:bg-orange-950/25 dark:ring-orange-500/30"
                                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-md dark:border-white/5 dark:bg-slate-900 dark:hover:border-orange-500/40 dark:hover:bg-slate-900/80"
                            }`}
                          >
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                                <span className="truncate text-[10px] font-black uppercase tracking-widest text-orange-500 dark:text-orange-400">
                                  {item.category || "Menu"}
                                </span>
                              </div>
                              <p className="line-clamp-2 text-xs font-bold leading-snug text-slate-900 dark:text-white">
                                {item.name}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                              <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                                ₹{item.price}
                              </span>

                              {inBill ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center overflow-hidden rounded-lg border border-orange-300 bg-orange-100 dark:border-orange-500/50 dark:bg-orange-500/20"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateItemQuantity(item.id, -1)
                                    }
                                    aria-label="Decrease quantity"
                                    className="px-2 py-0.5 text-xs text-orange-600 transition hover:bg-orange-200 dark:text-orange-300 dark:hover:bg-orange-500/40"
                                  >
                                    −
                                  </button>
                                  <span className="px-1.5 font-mono text-xs font-black text-slate-900 dark:text-white">
                                    {inBill.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateItemQuantity(item.id, 1)
                                    }
                                    aria-label="Increase quantity"
                                    className="px-2 py-0.5 text-xs text-orange-600 transition hover:bg-orange-200 dark:text-orange-300 dark:hover:bg-orange-500/40"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddItemDirect(item);
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 transition group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-white dark:border-white/5 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <Plus size={12} strokeWidth={3} /> Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-col overflow-hidden bg-slate-50 lg:w-[420px] dark:bg-slate-900/60">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-xl bg-orange-100 text-orange-600 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/25">
                      <Receipt size={13} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                      Live Bill
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {newOrderItems.reduce((acc, i) => acc + i.quantity, 0)}
                    </span>
                  </div>
                  {newOrderItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: "Clear cart?",
                          message:
                            "This will remove all items from the current bill.",
                          confirmLabel: "Clear cart",
                          destructive: true,
                          onConfirm: () => setNewOrderItems([]),
                        })
                      }
                      className="text-[10px] font-black uppercase tracking-wider text-red-500 transition hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
                  <div>
                    <label className={labelCls}>Order Source</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          {
                            id: "kitchen",
                            label: "On Spot",
                            icon: "🏪",
                            sub: "Editable",
                            color: "emerald",
                          },
                          {
                            id: "swiggy",
                            label: "Swiggy",
                            icon: "🟠",
                            sub: "Locked",
                            color: "orange",
                          },
                          {
                            id: "zomato",
                            label: "Zomato",
                            icon: "🔴",
                            sub: "Locked",
                            color: "red",
                          },
                          {
                            id: "website",
                            label: "Website",
                            icon: "🌐",
                            sub: "Locked",
                            color: "blue",
                          },
                        ] as const
                      ).map((s) => {
                        const active = newOrderSource === s.id;
                        const activeCls =
                          s.color === "emerald"
                            ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/60 dark:text-emerald-300"
                            : s.color === "orange"
                            ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-500/15 dark:border-orange-500/60 dark:text-orange-300"
                            : s.color === "red"
                            ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-500/15 dark:border-red-500/60 dark:text-red-300"
                            : "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/60 dark:text-blue-300";
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setNewOrderSource(s.id)}
                            aria-pressed={active}
                            className={`flex flex-col rounded-xl border p-2 text-left transition ${
                              active
                                ? activeCls
                                : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/5 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-[11px] font-black">
                              <span>{s.icon}</span> {s.label}
                            </span>
                            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-80">
                              {s.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="pos-customer" className={labelCls}>
                        Customer
                      </label>
                      <input
                        id="pos-customer"
                        type="text"
                        value={newOrderCustomer}
                        onChange={(e) => setNewOrderCustomer(e.target.value)}
                        placeholder="Name / Table"
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40"
                      />
                    </div>
                    <div>
                      <label htmlFor="pos-phone" className={labelCls}>
                        Phone
                      </label>
                      <input
                        id="pos-phone"
                        type="text"
                        value={newOrderPhone}
                        onChange={(e) => setNewOrderPhone(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Order Type</label>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/5 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => setNewOrderType("takeaway")}
                          aria-pressed={newOrderType === "takeaway"}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderType === "takeaway"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          Pickup
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOrderType("delivery")}
                          aria-pressed={newOrderType === "delivery"}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderType === "delivery"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          Delivery
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Payment</label>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/5 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => setNewOrderPaymentMethod("cash")}
                          aria-pressed={newOrderPaymentMethod === "cash"}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderPaymentMethod === "cash"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOrderPaymentMethod("online")}
                          aria-pressed={newOrderPaymentMethod === "online"}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderPaymentMethod === "online"
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          📱 Online
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pos-notes" className={labelCls}>
                      Cooking Notes
                    </label>
                    <input
                      id="pos-notes"
                      type="text"
                      value={newOrderInstructions}
                      onChange={(e) =>
                        setNewOrderInstructions(e.target.value)
                      }
                      placeholder="e.g. Extra cheese…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-orange-500/40"
                    />
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/80">
                      <span>Item</span>
                      <span>Qty × Price</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {newOrderItems.length === 0 ? (
                        <div className="flex flex-col items-center py-8">
                          <ShoppingBag
                            size={24}
                            className="text-slate-300 dark:text-slate-700"
                          />
                          <p className="mt-2 text-[11px] font-black text-slate-500">
                            Cart is empty
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-600">
                            Tap items on the left to add
                          </p>
                        </div>
                      ) : (
                        newOrderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {item.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                ₹{item.price} each
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, -1)
                                  }
                                  aria-label="Decrease quantity"
                                  className="px-1.5 py-0.5 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                >
                                  −
                                </button>
                                <span className="px-1.5 font-mono text-xs font-black text-orange-500 dark:text-orange-400">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, 1)
                                  }
                                  aria-label="Increase quantity"
                                  className="px-1.5 py-0.5 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                >
                                  +
                                </button>
                              </div>

                              <span className="min-w-[46px] text-right font-mono text-xs font-black text-slate-900 dark:text-white">
                                ₹{item.price * item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveItemFromOrder(item.id)
                                }
                                aria-label={`Remove ${item.name}`}
                                className="p-0.5 text-slate-400 transition hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 space-y-2.5 border-t border-slate-100 bg-white px-4 py-3 dark:border-white/5 dark:bg-transparent">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span className="font-bold">Subtotal</span>
                      <span className="font-mono font-black text-slate-900 dark:text-white">
                        ₹
                        {newOrderItems.reduce(
                          (acc, i) => acc + (i.price || 0) * i.quantity,
                          0
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <label htmlFor="pos-discount" className="font-bold">
                        Discount (₹)
                      </label>
                      <input
                        id="pos-discount"
                        type="number"
                        min="0"
                        value={
                          newOrderDiscount === 0 ? "" : newOrderDiscount
                        }
                        onChange={(e) =>
                          setNewOrderDiscount(
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        placeholder="0"
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs font-black text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        Grand Total
                      </span>
                      <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                        ₹
                        {Math.max(
                          0,
                          newOrderItems.reduce(
                            (acc, i) => acc + (i.price || 0) * i.quantity,
                            0
                          ) - (newOrderDiscount || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={
                        isSubmittingOrder || newOrderItems.length === 0
                      }
                      onClick={() => handleCreateKitchenOrder(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Create + print KOT"
                    >
                      <Printer size={14} /> Print
                    </button>

                    <button
                      type="button"
                      disabled={
                        isSubmittingOrder || newOrderItems.length === 0
                      }
                      onClick={() => handleCreateKitchenOrder(false)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />{" "}
                          Placing…
                        </>
                      ) : (
                        <>
                          <Check size={15} /> Place Order
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-md sm:items-center sm:p-4 dark:bg-black/85"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur-2xl">
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 sm:text-base dark:text-white">
                    Edit Order
                  </h3>
                  <span className="font-mono text-sm font-black text-orange-500 dark:text-orange-400">
                    {editingOrder.orderNumber}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                    Editable
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                  {editingOrder.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                aria-label="Close edit order"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/5 dark:bg-slate-800/40">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Add Item From Menu
                </span>
                <div className="flex gap-2">
                  <label htmlFor="edit-item-select" className="sr-only">
                    Choose menu item
                  </label>
                  <select
                    id="edit-item-select"
                    value={editSelectedMenuItemId}
                    onChange={(e) =>
                      setEditSelectedMenuItemId(e.target.value)
                    }
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">— Choose item —</option>
                    {availableMenuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} • ₹{item.price}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!editSelectedMenuItemId}
                    onClick={() => {
                      const item = availableMenuItems.find(
                        (i) => i.id === editSelectedMenuItemId
                      );
                      if (item) handleAddItemToEditOrder(item);
                      setEditSelectedMenuItemId("");
                    }}
                    className="rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Items in order
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    {editOrderItems.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-950/60">
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {editOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-500">
                            ₹{item.price} each
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateEditItemQty(item.id, -1)
                              }
                              aria-label="Decrease quantity"
                              className="px-2 py-1 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            >
                              −
                            </button>
                            <span className="px-2 font-mono text-xs font-black text-orange-500 dark:text-orange-400">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateEditItemQty(item.id, 1)
                              }
                              aria-label="Increase quantity"
                              className="px-2 py-1 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <span className="min-w-[50px] text-right font-mono text-xs font-black text-slate-900 dark:text-white">
                            ₹{item.price * item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="p-1 text-slate-400 transition hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-instructions"
                  className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"
                >
                  Special Instructions
                </label>
                <input
                  id="edit-instructions"
                  type="text"
                  value={editOrderInstructions}
                  onChange={(e) =>
                    setEditOrderInstructions(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800/80 dark:text-white dark:focus:border-orange-500/40"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-discount"
                  className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"
                >
                  Discount (₹)
                </label>
                <input
                  id="edit-discount"
                  type="number"
                  min="0"
                  value={editOrderDiscount === 0 ? "" : editOrderDiscount}
                  onChange={(e) =>
                    setEditOrderDiscount(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right font-mono text-xs font-black text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none dark:border-white/5 dark:bg-slate-800/80 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-slate-950/60">
              <div className="text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Recalculated Total:
                </span>
                <span className="ml-2 font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                  ₹
                  {Math.max(
                    0,
                    editOrderItems.reduce(
                      (acc, i) => acc + (i.price || 0) * i.quantity,
                      0
                    ) -
                      safeNumber(editingOrder.deliveryFee) -
                      safeNumber(editOrderDiscount)
                  )}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-100 sm:flex-none dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit || editOrderItems.length === 0}
                  onClick={handleSaveEditedOrder}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:translate-y-0 sm:flex-none"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
