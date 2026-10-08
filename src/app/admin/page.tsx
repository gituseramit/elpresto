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
  LayoutDashboard,
  ShieldCheck,
  ShoppingBag,
  Utensils,
  Layers,
  History,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  ChevronRight,
  Eye,
  CheckCircle,
  Clock,
  Bell,
  BellOff,
  RefreshCw,
  Download,
  IndianRupee,
  MapPin,
  Flame,
  Save,
  ToggleLeft,
  ToggleRight,
  CircleOff,
  TrendingUp,
  AlertTriangle,
  Check,
  Printer,
  Receipt,
  Truck,
  ExternalLink,
  Lock,
  Compass,
  Store,
  ChefHat,
  Key,
  Folder,
  Tag,
  Sparkles,
  Menu as MenuIcon,
  Loader2,
  Zap,
  Award,
  Coffee,
  Crown,
  Info,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { DUMMY_MENU } from "@/data/menu";
import { subscribeMenuCatalog } from "@/lib/menuCatalog";
import {
  DEFAULT_CATEGORIES,
  initializeCategoriesIfEmpty,
  resolveItemCategoryHierarchy,
} from "@/lib/categories";
import Modern3DBarChart from "@/components/Admin/Charts/Modern3DBarChart";
import Modern3DDonutChart from "@/components/Admin/Charts/Modern3DDonutChart";
import Modern3DCategoryChart from "@/components/Admin/Charts/Modern3DCategoryChart";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import AttendancePanel from "@/components/Admin/AttendancePanel";
import ThemeControl from "@/components/ThemeControl";
import LoyaltyRewardsManager from "@/components/Admin/LoyaltyRewardsManager";
import type { Category, Subcategory, PromoCode } from "@/lib/types";
import { executeTransactionalReset } from "@/lib/dbResetService";
import { getOrderStatus, updateOrderStatus as transitionOrderStatus } from "@/lib/orderStatus";

import { db } from "@/lib/firebase";
import {
  savePanelAccessSettings,
  DEFAULT_PANEL_CONFIGS,
  subscribePanelStatus,
  type PanelAccessData,
  type PanelKey,
  hashPin,
} from "@/lib/panelAuth";
import {
  saveTrendingSettings,
  DEFAULT_TRENDING_SETTINGS,
  type TrendingSettings,
} from "@/lib/trendingService";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

interface StaffSession {
  email?: string;
  name?: string;
  role?: string;
  staffId?: string;
  token?: string;
  branchId?: string;
  [key: string]: unknown;
}

interface MenuItemRecord {
  id: string;
  name?: string;
  price?: number;
  category?: string;
  subcategory?: string;
  description?: string;
  imageUrl?: string;
  available?: boolean;
  isVeg?: boolean;
  order?: number;
  ingredients?: string[] | string;
  ingredientsConfirmed?: boolean;
  allergens?: string[] | string;
  allergensConfirmed?: boolean;
  nutritionFacts?: {
    servingSize?: string;
    calories?: number;
    carbsG?: number;
    proteinG?: number;
    fatG?: number;
    fiberG?: number;
    sodiumMg?: number;
  };
  nutritionFactsConfirmed?: boolean;
}

interface OrderItemRecord {
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  notes?: string;
}

interface DeliveryAddressRecord {
  houseFlat?: string;
  streetArea?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  fullAddress?: string;
}

interface OrderRecord {
  id: string;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
  customerPhone?: string;
  type?: string;
  orderType?: string;
  status?: string;
  deliveryStatus?: string;
  deliveryPersonName?: string;
  deliveryAddress?: DeliveryAddressRecord | string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistance?: number;
  deliveryFee?: number;
  location?: { address?: string } | string;
  items?: OrderItemRecord[];
  subtotal?: number;
  discount?: number;
  total?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  instructions?: string;
  source?: string;
  kitchenNotes?: string;
  cancelReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

interface PromoUsageRecord {
  id: string;
  code?: string;
  orderNumber?: string;
  userId?: string;
  discountApplied?: number;
  usedAt?: unknown;
  [key: string]: unknown;
}

interface EnrichedMenuItem extends MenuItemRecord {
  resolvedCategory: string;
  resolvedSubcategory: string;
}

interface GeneralSettings {
  cafeName: string;
  phone: string;
  address: string;
  openTime: string;
  closeTime: string;
  orderingEnabled: boolean;
  soundEnabled: boolean;
  cafeLat: number;
  cafeLng: number;
  deliveryRadiusKm: number;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryEnabled: boolean;
  packingChargesEnabled: boolean;
  packingChargeByCategory: Record<string, number>;
  loyaltyEnabled: boolean;
  loyaltyPointsPerCurrency: number;
  [key: string]: unknown;
}

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

type PromoForm = Partial<PromoCode> & {
  code?: string;
  discountType?: "percentage" | "flat";
  discountValue?: number;
  minOrderValue?: number;
  maxDiscountCap?: number;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  active?: boolean;
  expiryDate?: string;
  description?: string;
};

/* ============================================================= */
/* Helpers                                                       */
/* ============================================================= */

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

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function formList(value: string): string[] {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function valueAsLines(value?: string[] | string): string {
  return Array.isArray(value) ? value.join("\n") : value || "";
}

function readMenuRecipeForm(formData: FormData) {
  const nutritionFacts: NonNullable<MenuItemRecord["nutritionFacts"]> = {};
  const servingSize = String(formData.get("servingSize") || "").trim();
  if (servingSize) nutritionFacts.servingSize = servingSize;

  const numberFields = [
    ["calories", "calories"],
    ["carbsG", "carbsG"],
    ["proteinG", "proteinG"],
    ["fatG", "fatG"],
    ["fiberG", "fiberG"],
    ["sodiumMg", "sodiumMg"],
  ] as const;
  for (const [field, key] of numberFields) {
    const rawValue = String(formData.get(field) || "").trim();
    if (!rawValue) continue;
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) nutritionFacts[key] = parsed;
  }

  const ingredients = formList(String(formData.get("ingredients") || ""));
  const allergens = formList(String(formData.get("allergens") || ""));
  return {
    ingredients,
    ingredientsConfirmed: formData.get("ingredientsConfirmed") === "on" && ingredients.length > 0,
    allergens,
    allergensConfirmed: formData.get("allergensConfirmed") === "on" && allergens.length > 0,
    nutritionFacts,
    nutritionFactsConfirmed:
      formData.get("nutritionFactsConfirmed") === "on" &&
      Boolean(nutritionFacts.servingSize) &&
      Object.keys(nutritionFacts).some((key) => key !== "servingSize"),
  };
}

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatISTDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatISTDateShort(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d.toLocaleDateString();
  }
}

function getStatusKey(order: OrderRecord): string {
  const delivery = String(order.deliveryStatus || "").toLowerCase();
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (delivery === "delivered") return "delivered";
  if (delivery === "out_for_delivery" || status === "out_for_delivery")
    return "out_for_delivery";
  if (delivery === "assigned") return "assigned";
  if (status === "ready" || delivery === "ready") return "ready";
  if (status === "preparing") return "preparing";
  if (status === "completed") return "completed";
  return status || "pending";
}

/* ============================================================= */
/* UI primitives                                                 */
/* ============================================================= */

const inputCls =
  "w-full rounded-xl border border-white/5 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

const labelCls =
  "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400";

function MenuRecipeEditor({
  idPrefix,
  item,
}: {
  idPrefix: "mi" | "mei";
  item?: MenuItemRecord;
}) {
  const facts = item?.nutritionFacts || {};
  const confirmCheckboxCls = "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500";

  return (
    <details className="group/recipe rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-amber-300 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>Ingredient, allergen &amp; nutrition details</span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0 transition-transform group-open/recipe:rotate-90" />
      </summary>
      <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
        <div>
          <label htmlFor={`${idPrefix}-ingredients`} className={labelCls}>Ingredients (one per line)</label>
          <textarea id={`${idPrefix}-ingredients`} name="ingredients" defaultValue={valueAsLines(item?.ingredients)} rows={3} placeholder="Whole-wheat flour&#10;Mozzarella&#10;Tomato sauce&#10;Capsicum" className={`${inputCls} resize-y`} />
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-slate-300">
            <input name="ingredientsConfirmed" type="checkbox" defaultChecked={item?.ingredientsConfirmed === true} className={confirmCheckboxCls} />
            <span>Kitchen-confirmed full ingredient list</span>
          </label>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-allergens`} className={labelCls}>Allergens (if confirmed; one per line)</label>
          <textarea id={`${idPrefix}-allergens`} name="allergens" defaultValue={valueAsLines(item?.allergens)} rows={2} placeholder="Milk&#10;Gluten / wheat" className={`${inputCls} resize-y`} />
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-slate-300">
            <input name="allergensConfirmed" type="checkbox" defaultChecked={item?.allergensConfirmed === true} className={confirmCheckboxCls} />
            <span>Kitchen-confirmed allergen notes</span>
          </label>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-serving-size`} className={labelCls}>Nutrition serving size</label>
          <input id={`${idPrefix}-serving-size`} name="servingSize" defaultValue={facts.servingSize || ""} placeholder="e.g. 1 medium pizza (serves 1)" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            ["calories", "Calories (kcal)", facts.calories],
            ["carbsG", "Carbs (g)", facts.carbsG],
            ["proteinG", "Protein (g)", facts.proteinG],
            ["fatG", "Fat (g)", facts.fatG],
            ["fiberG", "Fibre (g)", facts.fiberG],
            ["sodiumMg", "Sodium (mg)", facts.sodiumMg],
          ] as const).map(([name, label, value]) => (
            <div key={name}>
              <label htmlFor={`${idPrefix}-${name}`} className={labelCls}>{label}</label>
              <input id={`${idPrefix}-${name}`} name={name} type="number" min="0" step="any" defaultValue={value ?? ""} placeholder="—" className={inputCls} />
            </div>
          ))}
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-slate-300">
          <input name="nutritionFactsConfirmed" type="checkbox" defaultChecked={item?.nutritionFactsConfirmed === true} className={confirmCheckboxCls} />
          <span>Kitchen-confirmed values for this recipe and serving size</span>
        </label>
        <p className="text-[10px] leading-relaxed text-slate-500">Customer-facing figures are shown only after confirmation. Use measured recipe quantities and a defined serving size for macro values.</p>
      </div>
    </details>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/5 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/10"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-white sm:text-base">
            {title}
          </h3>
          {subtitle && (
            <p className="truncate text-[11px] font-semibold text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ============================================================= */
/* Toast                                                         */
/* ============================================================= */

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastState[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed right-3 top-3 z-[200] flex w-[min(380px,calc(100vw-1.5rem))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const tone =
          t.kind === "success"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
            : t.kind === "error"
            ? "border-red-500/40 bg-red-500/15 text-red-100"
            : "border-white/10 bg-slate-800/90 text-slate-100";
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-black shadow-lg backdrop-blur ${tone}`}
          >
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {t.kind === "success" ? (
                <CheckCircle size={14} />
              ) : t.kind === "error" ? (
                <AlertTriangle size={14} />
              ) : (
                <Info size={14} />
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
/* Confirm Dialog                                                */
/* ============================================================= */

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    confirmBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
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
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
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
            ref={confirmBtnRef}
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
/* Modal                                                         */
/* ============================================================= */

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl sm:rounded-3xl"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <span
            aria-hidden="true"
            className="h-1.5 w-12 rounded-full bg-slate-700"
          />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 p-4">
          <h3 className="truncate text-sm font-black text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================= */
/* Small components                                              */
/* ============================================================= */

function MetricCard({
  label,
  value,
  sub,
  icon,
  gradient,
  iconGradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  gradient: string;
  iconGradient: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] p-5 shadow-[0_12px_35px_-24px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-[#151e2e]"
    >
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${iconGradient} opacity-70`} />
      <span aria-hidden="true" className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-40 blur-3xl transition group-hover:opacity-70`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 font-mono text-3xl font-bold leading-none tracking-tight text-white lg:text-[2rem]">
            {value}
          </p>
          {sub && (
            <p className="mt-2 truncate text-xs font-medium text-slate-500">
              {sub}
            </p>
          )}
        </div>
        <div
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${iconGradient} text-white shadow-lg ring-1 ring-white/10`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "amber" | "orange" | "blue" | "emerald";
  icon: ReactNode;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    orange: "bg-orange-500/10 border-orange-500/25 text-orange-400",
    blue: "bg-blue-500/10 border-blue-500/25 text-blue-400",
    emerald: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
  };
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border p-3.5 ${tones[color]}`}
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-90">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
      </div>
      <div aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-black/20">
        {icon}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: "emerald" | "orange" | "blue";
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500",
    orange: "from-orange-500 to-amber-500",
    blue: "from-blue-500 to-indigo-500",
  };
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${tones[color]} text-white shadow-md`}
        >
          {icon}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-3 font-mono text-2xl font-black text-white lg:text-3xl">
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  emoji,
  label,
  accent,
}: {
  href: string;
  emoji: string;
  label: string;
  accent: "orange" | "blue" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    orange: "hover:border-orange-500/30 hover:bg-orange-500/5",
    blue: "hover:border-blue-500/30 hover:bg-blue-500/5",
    emerald: "hover:border-emerald-500/30 hover:bg-emerald-500/5",
    amber: "hover:border-amber-500/30 hover:bg-amber-500/5",
  };
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-between rounded-2xl border border-white/5 bg-slate-800/40 px-4 py-3 text-xs font-black text-slate-200 transition ${tones[accent]}`}
    >
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="text-base">
          {emoji}
        </span>
        {label}
      </span>
      <ExternalLink size={13} className="text-slate-500" aria-hidden="true" />
    </Link>
  );
}

function CategoryPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-black transition ${
        active
          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
          : "border border-white/5 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-black ${
          active ? "bg-white/25 text-white" : "bg-white/5 text-slate-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SubPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black transition ${
        active
          ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border border-white/5 bg-slate-800/60 text-slate-400 hover:text-slate-200"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className="font-mono text-[10px] opacity-80">({count})</span>
      )}
    </button>
  );
}

function IconAction({
  children,
  onClick,
  title,
  variant,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  variant?: "success" | "danger";
}) {
  let cls =
    "border-white/5 bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white";
  if (variant === "success")
    cls =
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25";
  if (variant === "danger")
    cls =
      "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={`grid h-7 w-7 place-items-center rounded-lg border transition active:scale-90 ${cls}`}
    >
      {children}
    </button>
  );
}

function StatusChip({ status }: { status: string }) {
  let cls = "bg-amber-500/15 text-amber-300 ring-amber-500/30";
  let label = status;
  if (status === "preparing") {
    cls = "bg-orange-500/15 text-orange-300 ring-orange-500/30";
    label = "Preparing";
  } else if (status === "ready") {
    cls = "bg-blue-500/15 text-blue-300 ring-blue-500/30";
    label = "Ready";
  } else if (status === "completed") {
    cls = "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    label = "Completed";
  } else if (status === "cancelled") {
    cls = "bg-red-500/15 text-red-300 ring-red-500/30";
    label = "Cancelled";
  } else if (status === "pending") {
    label = "New";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

function RuleTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "orange" | "emerald" | "slate";
}) {
  const tones: Record<string, string> = {
    orange: "text-orange-400",
    emerald: "text-emerald-400",
    slate: "text-slate-200",
  };
  return (
    <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate font-mono text-xs font-black ${tones[accent]}`}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================= */
/* Main Component                                                */
/* ============================================================= */

export default function AdminPage() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);

  /* ---- Panel access ---- */
  const [panelAccess, setPanelAccess] =
    useState<PanelAccessData>(DEFAULT_PANEL_CONFIGS);
  const [panelPinInputs, setPanelPinInputs] = useState<Record<string, string>>(
    {}
  );
  const [showPinMap, setShowPinMap] = useState<Record<string, boolean>>({});
  const [panelSaveMsg, setPanelSaveMsg] = useState<string | null>(null);

  /* ---- Trending ---- */
  const [trendingSettings, setTrendingSettings] = useState<TrendingSettings>(
    DEFAULT_TRENDING_SETTINGS
  );
  const [trendingSaveMsg, setTrendingSaveMsg] = useState<string | null>(null);

  /* ---- Data ---- */
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState({
    menu: true,
    categories: true,
    orders: true,
  });
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoUsageLogs, setPromoUsageLogs] = useState<PromoUsageRecord[]>([]);
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [showEditPromoModal, setShowEditPromoModal] = useState<PromoCode | null>(
    null
  );
  const [promoForm, setPromoForm] = useState<PromoForm>({
    code: "",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 199,
    maxDiscountCap: 100,
    usageLimitTotal: 100,
    usageLimitPerUser: 1,
    active: true,
    expiryDate: "",
    description: "",
  });

  /* ---- DB reset ---- */
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /* ---- UI ---- */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] =
    useState<Category | null>(null);
  const [showAddMenuItemModal, setShowAddMenuItemModal] = useState(false);
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false);
  const [showEditMenuItemModal, setShowEditMenuItemModal] =
    useState<EnrichedMenuItem | null>(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] =
    useState<OrderRecord | null>(null);
  const [searchOrders, setSearchOrders] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [searchMenu, setSearchMenu] = useState("");
  const [adminSelectedCategory, setAdminSelectedCategory] = useState("all");
  const [adminSelectedSubcategory, setAdminSelectedSubcategory] =
    useState("all");
  const [modalCategory, setModalCategory] = useState<string>("Food");
  const [modalSubcategory, setModalSubcategory] =
    useState<string>("Healthy Mania");
  const [isCustomSubcategory, setIsCustomSubcategory] = useState(false);
  const [customSubcategoryText, setCustomSubcategoryText] = useState("");
  const [showAddSubModal, setShowAddSubModal] = useState<Category | null>(null);
  const [newSubNameInput, setNewSubNameInput] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );

  /* ---- Kitchen filters ---- */
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState("all");
  const [kitchenSourceFilter, setKitchenSourceFilter] = useState("all");
  const [kitchenSearchQuery, setKitchenSearchQuery] = useState("");

  /* ---- Settings ---- */
  const [settings, setSettings] = useState<GeneralSettings>({
    cafeName: "EL PRESTO PIZZA",
    phone: "+91 6392512314",
    address: "United College of Engineering and Research, Naini, Prayagraj",
    openTime: "10:00",
    closeTime: "23:00",
    orderingEnabled: true,
    soundEnabled: true,
    cafeLat: 25.3409769,
    cafeLng: 81.9116436,
    deliveryRadiusKm: 7,
    baseDeliveryFee: 30,
    freeDeliveryThreshold: 499,
    deliveryEnabled: true,
    packingChargesEnabled: false,
    packingChargeByCategory: {},
    loyaltyEnabled: false,
    loyaltyPointsPerCurrency: 1,
  });

  /* ---- Feedback ---- */
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  /* ---- Refs ---- */
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(settings.soundEnabled);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersSnapshotReadyRef = useRef(false);
  const notificationTimeoutRef = useRef<number | null>(null);
  const trendingDebounceRef = useRef<number | null>(null);
  const assignRiderInputRef = useRef<HTMLInputElement>(null);
  const staffSessionRef = useRef<StaffSession | null>(null);

  /* ============================================================= */
  /* Toasts                                                        */
  /* ============================================================= */

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimersRef.current.delete(id);
    }, 4500);
    toastTimersRef.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---- Session bootstrap ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    import("@/lib/staffAuth")
      .then(({ getStaffSession, isSessionValid }) => {
        if (cancelled) return;
        try {
          const session = getStaffSession("admin") as StaffSession | null;
          if (session && isSessionValid(session as never)) {
            setStaffSession(session);
            setIsAuthenticated(true);
          }
        } finally {
          setIsVerifyingAuth(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load staff session:", err);
        if (!cancelled) setIsVerifyingAuth(false);
      });

    const unsub = subscribePanelStatus("admin", () => {
      setIsAuthenticated(false);
      setStaffSession(null);
      import("@/lib/staffAuth")
        .then(({ clearStaffSession }) => clearStaffSession("admin"))
        .catch(() => {
          /* ignore */
        });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    staffSessionRef.current = staffSession;
  }, [staffSession]);

  useEffect(() => {
    soundEnabledRef.current = settings.soundEnabled;
  }, [settings.soundEnabled]);

  /* Cleanup timers + audio on unmount */
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => window.clearTimeout(t));
      toastTimersRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          /* ignore */
        });
        audioContextRef.current = null;
      }
      if (notificationTimeoutRef.current != null) {
        window.clearTimeout(notificationTimeoutRef.current);
      }
      if (trendingDebounceRef.current != null) {
        window.clearTimeout(trendingDebounceRef.current);
      }
    };
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setStaffSession(null);
    setOrders([]);
    setMenuItems([]);
    setCategories([]);
    setPromoCodes([]);
    setPromoUsageLogs([]);
    seenOrderIdsRef.current.clear();
    import("@/lib/staffAuth")
      .then(({ clearStaffSession }) => clearStaffSession("admin"))
      .catch(() => {
        /* ignore */
      });
  }, []);

  /* ============================================================= */
  /* Realtime subscriptions                                       */
  /* ============================================================= */

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          try {
            const seeded = await initializeCategoriesIfEmpty();
            setCategories(seeded);
          } catch {
            setCategories(DEFAULT_CATEGORIES);
          }
        } else {
          setCategories(
            snap.docs.map(
              (d) => ({ id: d.id, ...d.data() } as Category)
            )
          );
        }
        setLoading((prev) => ({ ...prev, categories: false }));
      },
      (err) => {
        console.warn("Categories fallback:", err);
        setCategories(DEFAULT_CATEGORIES);
        setLoading((prev) => ({ ...prev, categories: false }));
      }
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribeMenuCatalog(
      (items) => {
        setMenuItems(items as MenuItemRecord[]);
        setLoading((prev) => ({ ...prev, menu: false }));
      },
      (err) => {
        console.warn("Menu items error:", err);
        setLoading((prev) => ({ ...prev, menu: false }));
        pushToast("error", "Could not load the live menu. Check your connection and retry.");
      }
    );
    return unsub;
  }, [isAuthenticated, pushToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as OrderRecord)
        );
        setOrders(data);
        setLoading((prev) => ({ ...prev, orders: false }));

        const newOrders = data.filter(
          (o) =>
            (o.status === "pending" || o.status === "preparing") &&
            !seenOrderIdsRef.current.has(o.id)
        );
        const shouldNotify = ordersSnapshotReadyRef.current && newOrders.length > 0;
        ordersSnapshotReadyRef.current = true;
        data.forEach((o) => seenOrderIdsRef.current.add(o.id));
        if (seenOrderIdsRef.current.size > 2000) {
          const trimmed = Array.from(seenOrderIdsRef.current).slice(-2000);
          seenOrderIdsRef.current = new Set(trimmed);
        }
        if (shouldNotify && soundEnabledRef.current) {
          playNotificationSound();
          if (notificationTimeoutRef.current != null) {
            window.clearTimeout(notificationTimeoutRef.current);
          }
          notificationTimeoutRef.current = window.setTimeout(() => {
            notificationTimeoutRef.current = null;
          }, 3000);
        }
      },
      (err) => {
        console.warn("Orders error:", err);
        setLoading((prev) => ({ ...prev, orders: false }));
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      doc(db, "settings", "panelAccess"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<PanelAccessData>;
          setPanelAccess((prev) => ({
            admin: { ...DEFAULT_PANEL_CONFIGS.admin, ...prev.admin, ...(data.admin || {}) },
            kitchen: {
              ...DEFAULT_PANEL_CONFIGS.kitchen,
              ...prev.kitchen,
              ...(data.kitchen || {}),
            },
            counter: {
              ...DEFAULT_PANEL_CONFIGS.counter,
              ...prev.counter,
              ...(data.counter || {}),
            },
            delivery: {
              ...DEFAULT_PANEL_CONFIGS.delivery,
              ...prev.delivery,
              ...(data.delivery || {}),
            },
          }));
        }
      },
      (err) => console.warn("panelAccess error:", err)
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      doc(db, "settings", "trending"),
      (snap) => {
        if (snap.exists()) {
          setTrendingSettings((prev) => ({
            ...DEFAULT_TRENDING_SETTINGS,
            ...prev,
            ...(snap.data() as Partial<TrendingSettings>),
          }));
        }
      },
      (err) => console.warn("trending error:", err)
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      doc(db, "settings", "general"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<GeneralSettings>;
          setSettings((prev) => ({ ...prev, ...data }));
        }
      },
      (err) => console.warn("settings error:", err)
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      query(collection(db, "promoCodes"), orderBy("createdAt", "desc")),
      (snap) =>
        setPromoCodes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCode))
        ),
      (err) => console.warn("promoCodes error:", err)
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      query(collection(db, "promoUsage"), orderBy("usedAt", "desc")),
      (snap) =>
        setPromoUsageLogs(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as PromoUsageRecord)
          )
        ),
      (err) => console.warn("promoUsage error:", err)
    );
    return unsub;
  }, [isAuthenticated]);

  /* ---- Sound ---- */
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
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      window.setTimeout(() => {
        if (!audioContextRef.current) return;
        const ctx2 = audioContextRef.current;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = 1100;
        osc2.type = "sine";
        gain2.gain.setValueAtTime(0.25, ctx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.15);
        osc2.start();
        osc2.stop(ctx2.currentTime + 0.15);
      }, 150);
    } catch {
      /* ignore */
    }
  }, []);

  /* ============================================================= */
  /* Audit helpers                                                */
  /* ============================================================= */

  const currentActor = useCallback(() => {
    const s = staffSessionRef.current;
    return {
      id: String(s?.staffId || s?.email || "admin"),
      name: String(s?.name || s?.email || "Admin"),
    };
  }, []);

  const writeWithAudit = useCallback(
    async <T extends Record<string, unknown>>(
      ref: Parameters<typeof updateDoc>[0],
      data: T
    ) => {
      const actor = currentActor();
      await updateDoc(ref, {
        ...data,
        updatedAt: Timestamp.now(),
        updatedBy: actor.id,
      });
    },
    [currentActor]
  );

  /* ============================================================= */
  /* Promo CRUD                                                   */
  /* ============================================================= */

  const savePromoCode = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const code = promoForm.code?.trim().toUpperCase();
      if (!code) {
        pushToast("error", "Please enter a promo code.");
        return;
      }
      const discountValue = safeNumber(promoForm.discountValue);
      if (promoForm.discountType === "percentage" && discountValue > 100) {
        pushToast("error", "Percentage discount cannot exceed 100%.");
        return;
      }
      if (discountValue <= 0) {
        pushToast("error", "Discount value must be greater than 0.");
        return;
      }
      const expiry = promoForm.expiryDate ? new Date(promoForm.expiryDate) : null;
      if (expiry && expiry.getTime() < Date.now()) {
        pushToast("error", "Expiry date must be in the future.");
        return;
      }

      const payload = {
        code,
        description: promoForm.description || "",
        discountType: promoForm.discountType || "percentage",
        discountValue,
        minOrderValue: Math.max(0, safeNumber(promoForm.minOrderValue)),
        maxDiscountCap: Math.max(0, safeNumber(promoForm.maxDiscountCap)),
        usageLimitTotal: Math.max(0, safeNumber(promoForm.usageLimitTotal)),
        usageLimitPerUser: Math.max(1, safeNumber(promoForm.usageLimitPerUser, 1)),
        active: promoForm.active !== false,
        expiryDate: promoForm.expiryDate || "",
      };
      try {
        if (showEditPromoModal) {
          await writeWithAudit(doc(db, "promoCodes", showEditPromoModal.id), payload);
          pushToast("success", `Promo "${code}" updated.`);
        } else {
          await addDoc(collection(db, "promoCodes"), {
            ...payload,
            usageCount: 0,
            createdAt: Timestamp.now(),
            createdBy: currentActor().id,
          });
          pushToast("success", `Promo "${code}" created.`);
        }
        setShowAddPromoModal(false);
        setShowEditPromoModal(null);
        setPromoForm({});
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        pushToast("error", `Failed to save promo: ${msg}`);
      }
    },
    [promoForm, showEditPromoModal, pushToast, writeWithAudit, currentActor]
  );

  const deletePromoCode = useCallback(
    (id: string, codeName: string) => {
      setConfirm({
        title: "Delete promo code?",
        message: `Remove promo "${codeName}"? This cannot be undone.`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, "promoCodes", id));
            pushToast("success", "Promo deleted.");
          } catch (err) {
            pushToast("error", "Failed to delete promo.");
          }
        },
      });
    },
    [pushToast]
  );

  const togglePromoActive = useCallback(
    async (id: string, current: boolean) => {
      try {
        await writeWithAudit(doc(db, "promoCodes", id), { active: !current });
      } catch (err) {
        pushToast("error", "Failed to toggle promo.");
      }
    },
    [writeWithAudit, pushToast]
  );

  /* ============================================================= */
  /* DB reset                                                     */
  /* ============================================================= */

  const handleExecuteDatabaseReset = useCallback(() => {
    if (resetConfirmText !== "CONFIRM-RESET-TRANSACTIONS-ZERO") {
      pushToast("error", "Enter the exact confirmation phrase.");
      return;
    }
    setConfirm({
      title: "Permanently reset transaction data?",
      message:
        "This will wipe all orders and promo redemptions. A pre-wipe backup is taken automatically. This cannot be undone.",
      confirmLabel: "Execute reset",
      destructive: true,
      onConfirm: async () => {
        setIsResettingDb(true);
        setResetMessage(null);
        try {
          const res = await executeTransactionalReset(
            resetConfirmText,
            currentActor().name
          );
          setResetMessage({
            type: res.success ? "success" : "error",
            text: res.message,
          });
          if (res.success) setResetConfirmText("");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Reset failed";
          setResetMessage({ type: "error", text: msg });
        } finally {
          setIsResettingDb(false);
        }
      },
    });
  }, [resetConfirmText, currentActor, pushToast]);

  /* ============================================================= */
  /* Category CRUD                                                */
  /* ============================================================= */

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (
        categories.some(
          (c) => c.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        pushToast("error", "Category already exists.");
        return;
      }
      try {
        const maxOrder = categories.reduce(
          (m, c) => Math.max(m, c.order || 0),
          0
        );
        await addDoc(collection(db, "categories"), {
          name: trimmed,
          order: maxOrder + 1,
          enabled: true,
          createdAt: Timestamp.now(),
          createdBy: currentActor().id,
        });
        pushToast("success", `Category "${trimmed}" added.`);
      } catch (err) {
        pushToast("error", "Failed to add category.");
      }
    },
    [categories, pushToast, currentActor]
  );

  const editCategory = useCallback(
    (id: string, currentName: string) => {
      setConfirm({
        title: "Rename category?",
        message:
          "Renaming a category may orphan menu items that reference it by name.",
        confirmLabel: "Rename",
        destructive: true,
        onConfirm: async () => {
          try {
            await writeWithAudit(doc(db, "categories", id), {
              name: currentName,
            });
            pushToast("success", "Category renamed.");
          } catch (err) {
            pushToast("error", "Failed to rename category.");
          }
        },
      });
    },
    [writeWithAudit, pushToast]
  );

  const deleteCategory = useCallback(
    (id: string, name: string) => {
      const inUse = menuItems.some(
        (item) =>
          item.category === id ||
          item.category === name ||
          item.category === name
      );
      if (inUse) {
        pushToast(
          "error",
          "Cannot delete category with menu items. Move items first."
        );
        return;
      }
      setConfirm({
        title: "Delete category?",
        message: `Remove "${name}"?`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, "categories", id));
            pushToast("success", "Category deleted.");
          } catch (err) {
            pushToast("error", "Failed to delete category.");
          }
        },
      });
    },
    [menuItems, pushToast]
  );

  const toggleCategoryEnabled = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      try {
        await writeWithAudit(doc(db, "categories", id), {
          enabled: !cat.enabled,
        });
      } catch (err) {
        pushToast("error", "Failed to toggle category.");
      }
    },
    [categories, writeWithAudit, pushToast]
  );

  const addSubcategoryToCategory = useCallback(
    async (categoryId: string, subName: string) => {
      const trimmed = subName.trim();
      if (!trimmed) return;
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const existingSubs: Subcategory[] = cat.subcategories || [];
      if (
        existingSubs.some(
          (s) => s.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        pushToast("error", "Subcategory already exists.");
        return;
      }
      const newSub: Subcategory = {
        id:
          "sub_" +
          trimmed.toLowerCase().replace(/[^a-z0-9]/g, "_") +
          "_" +
          Math.random().toString(36).slice(2, 6),
        name: trimmed,
        order: existingSubs.length + 1,
        enabled: true,
      };
      try {
        await writeWithAudit(doc(db, "categories", categoryId), {
          subcategories: [...existingSubs, newSub],
        });
        pushToast("success", `Subcategory "${trimmed}" added.`);
      } catch (err) {
        pushToast("error", "Failed to add subcategory.");
      }
    },
    [categories, writeWithAudit, pushToast]
  );

  const deleteSubcategoryFromCategory = useCallback(
    (categoryId: string, subId: string, subName: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      setConfirm({
        title: "Remove subcategory?",
        message: `Remove "${subName}" from ${cat.name}?`,
        confirmLabel: "Remove",
        destructive: true,
        onConfirm: async () => {
          const updatedSubs = (cat.subcategories || []).filter(
            (s) => s.id !== subId
          );
          try {
            await writeWithAudit(doc(db, "categories", categoryId), {
              subcategories: updatedSubs,
            });
            pushToast("success", "Subcategory removed.");
          } catch (err) {
            pushToast("error", "Failed to remove subcategory.");
          }
        },
      });
    },
    [categories, writeWithAudit, pushToast]
  );

  /* ============================================================= */
  /* Menu item CRUD                                               */
  /* ============================================================= */

  const addMenuItem = useCallback(
    async (item: Partial<MenuItemRecord>): Promise<boolean> => {
      setIsSavingMenuItem(true);
      try {
        const maxOrder = menuItems.reduce((m, i) => Math.max(m, i.order || 0), 0);
        await addDoc(collection(db, "menuItems"), {
          ...item,
          order: maxOrder + 1,
          available: true,
          createdAt: Timestamp.now(),
          createdBy: currentActor().id,
        });
        pushToast("success", `"${item.name}" added.`);
        return true;
      } catch (err) {
        console.error("Failed to add menu item:", err);
        pushToast("error", "Could not save the product. Your entries are still here; retry after checking the connection.");
        return false;
      } finally {
        setIsSavingMenuItem(false);
      }
    },
    [menuItems, pushToast, currentActor]
  );

  const editMenuItem = useCallback(
    async (id: string, updated: Partial<MenuItemRecord>): Promise<boolean> => {
      setIsSavingMenuItem(true);
      try {
        await writeWithAudit(doc(db, "menuItems", id), updated);
        pushToast("success", "Product updated.");
        return true;
      } catch (err) {
        console.error("Failed to update menu item:", err);
        pushToast("error", "Could not update the product. Your edits are still here; retry after checking the connection.");
        return false;
      } finally {
        setIsSavingMenuItem(false);
      }
    },
    [writeWithAudit, pushToast]
  );

  const deleteMenuItem = useCallback(
    (id: string, name: string) => {
      const linked = orders.some((o) =>
        (o.items || []).some((i) => i.id === id)
      );
      setConfirm({
        title: "Delete product?",
        message: linked
          ? `"${name}" is linked to past orders. Deleting may break history. Continue?`
          : `Remove "${name}" from the menu?`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, "menuItems", id));
            pushToast("success", "Product deleted.");
          } catch (err) {
            pushToast("error", "Failed to delete product.");
          }
        },
      });
    },
    [orders, pushToast]
  );

  const toggleMenuItemAvailable = useCallback(
    async (id: string) => {
      const item = menuItems.find((i) => i.id === id);
      if (!item) return;
      try {
        await writeWithAudit(doc(db, "menuItems", id), {
          available: item.available === false,
        });
      } catch (err) {
        console.error("Failed to toggle menu availability:", err);
        pushToast("error", "Could not update product availability.");
      }
    },
    [menuItems, writeWithAudit, pushToast]
  );

  /* ============================================================= */
  /* Order operations                                             */
  /* ============================================================= */

  const updateOrderStatus = useCallback(
    async (id: string, newStatus: string) => {
      try {
        await transitionOrderStatus(
          id,
          newStatus as import("@/lib/orderStatus").OrderStatus,
          {
            ...currentActor(),
            role: String(staffSessionRef.current?.role || "ADMIN"),
          }
        );
      } catch (err) {
        pushToast(
          "error",
          err instanceof Error ? err.message : "Failed to update order."
        );
      }
    },
    [currentActor, pushToast]
  );

  const cancelOrder = useCallback(
    (id: string, orderNumber: string) => {
      setConfirm({
        title: "Cancel order?",
        message: `Cancel order ${orderNumber}?`,
        confirmLabel: "Cancel order",
        destructive: true,
        onConfirm: async () => {
          try {
            await transitionOrderStatus(id, "cancelled", {
              ...currentActor(),
              role: String(staffSessionRef.current?.role || "ADMIN"),
            }, {
              cancelReason: "Cancelled by admin",
            });
            pushToast("success", "Order cancelled.");
          } catch (err) {
            pushToast("error", "Failed to cancel order.");
          }
        },
      });
    },
    [currentActor, pushToast]
  );

  const assignDeliveryPartner = useCallback(
    async (id: string, partnerName: string) => {
      try {
        await transitionOrderStatus(id, "assigned", {
          ...currentActor(),
          role: String(staffSessionRef.current?.role || "ADMIN"),
        }, {
          deliveryPersonName: partnerName || "El Presto Delivery Partner",
          deliveryStatus: "assigned",
        });
        pushToast("success", "Delivery partner assigned.");
      } catch (err) {
        pushToast("error", "Failed to assign partner.");
      }
    },
    [currentActor, pushToast]
  );

  const updateDeliveryStatus = useCallback(
    async (id: string, deliveryStatus: string) => {
      try {
        const order = orders.find((candidate) => candidate.id === id);
        const targetStatus =
          deliveryStatus === "pending"
            ? getOrderStatus(order)
            : (deliveryStatus as import("@/lib/orderStatus").OrderStatus);
        if (deliveryStatus === "pending" && targetStatus !== "pending" && targetStatus !== "ready") {
          throw new Error("Delivery progress cannot be moved backwards.");
        }
        await transitionOrderStatus(id, targetStatus, {
          ...currentActor(),
          role: String(staffSessionRef.current?.role || "ADMIN"),
        }, { deliveryStatus });
      } catch (err) {
        pushToast(
          "error",
          err instanceof Error ? err.message : "Failed to update delivery status."
        );
      }
    },
    [orders, currentActor, pushToast]
  );

  /* ============================================================= */
  /* Settings                                                     */
  /* ============================================================= */

  const updateSettings = useCallback(async () => {
    try {
      await setDoc(doc(db, "settings", "general"), settings, { merge: true });
      pushToast("success", "Settings saved.");
    } catch (err) {
      pushToast("error", "Failed to save settings.");
    }
  }, [settings, pushToast]);

  /* ============================================================= */
  /* Print receipt                                                */
  /* ============================================================= */

  const printReceipt = useCallback(
    (order: OrderRecord) => {
      const orderDate = toDate(order.createdAt) || new Date();
      const itemsHtml = (order.items || [])
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.quantity)}x ${escapeHtml(
              item.name
            )}</td><td style="text-align:right;">₹${(
              safeNumber(item.price) * (item.quantity || 1)
            ).toFixed(2)}</td></tr>`
        )
        .join("");

      const total =
        order.total != null
          ? safeNumber(order.total)
          : (order.items || []).reduce(
              (sum, i) => sum + safeNumber(i.price) * (i.quantity || 1),
              0
            );

      const receiptHtml = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Courier New',monospace;font-size:12px;line-height:1.4;width:58mm;margin:0 auto;padding:8px;background:#fff;color:#000;}
      .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;}
      .header h1{font-size:16px;font-weight:bold;} .header p{font-size:10px;margin:2px 0;}
      .order-info{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin:6px 0;} th,td{padding:2px 0;border-bottom:1px dotted #ccc;text-align:left;} th{font-weight:bold;border-bottom:1px solid #000;}
      .total{font-weight:bold;font-size:14px;text-align:right;border-top:1px solid #000;padding-top:6px;margin-top:4px;}
      .footer{text-align:center;font-size:10px;margin-top:8px;border-top:1px dashed #000;padding-top:6px;}
      .instructions{font-style:italic;color:#555;margin:4px 0;}
      </style></head><body>
      <div class="header"><h1>${escapeHtml(settings.cafeName)}</h1><p>${escapeHtml(
        settings.address
      )}</p><p>${escapeHtml(settings.phone)}</p></div>
      <div class="order-info"><span><strong>Order #${escapeHtml(
        order.orderNumber
      )}</strong></span><span>${escapeHtml(orderDate.toLocaleString())}</span></div>
      <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
      <p><strong>Type:</strong> ${
        order.type === "delivery" ? "Delivery" : "Pickup"
      }</p>
      <table><thead><tr><th>Item</th><th style="text-align:right;">Price</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total">Total: ₹${total.toFixed(2)}</div>
      ${
        order.instructions
          ? `<div class="instructions">${escapeHtml(order.instructions)}</div>`
          : ""
      }
      <div class="footer">Eat Without Guilt! Visit Again.</div>
      </body></html>`;

      const printWindow = window.open("", "_blank", "width=400,height=600");
      if (!printWindow) {
        pushToast("error", "Please allow popups to print receipt.");
        return;
      }
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    },
    [settings, pushToast]
  );

  /* ============================================================= */
  /* Derived (memoized)                                           */
  /* ============================================================= */

  const activeCategoriesList: Category[] = useMemo(
    () => (categories.length > 0 ? categories : DEFAULT_CATEGORIES),
    [categories]
  );

  const enrichedMenuItems: EnrichedMenuItem[] = useMemo(() => {
    return menuItems.map((item) => {
      const h = resolveItemCategoryHierarchy(item, activeCategoriesList);
      return {
        ...item,
        resolvedCategory: h.parentCategory,
        resolvedSubcategory: h.subcategory,
      };
    });
  }, [menuItems, activeCategoriesList]);

  const availableSubcategories = useMemo(() => {
    if (adminSelectedCategory === "all") {
      const set = new Set<string>();
      enrichedMenuItems.forEach((item) => {
        if (item.resolvedSubcategory) set.add(item.resolvedSubcategory);
      });
      return Array.from(set);
    }
    const cat = activeCategoriesList.find(
      (c) => c.name === adminSelectedCategory
    );
    if (cat && cat.subcategories && cat.subcategories.length > 0) {
      return cat.subcategories.map((s) => s.name);
    }
    const set = new Set<string>();
    enrichedMenuItems
      .filter((i) => i.resolvedCategory === adminSelectedCategory)
      .forEach((i) => {
        if (i.resolvedSubcategory) set.add(i.resolvedSubcategory);
      });
    return Array.from(set);
  }, [adminSelectedCategory, activeCategoriesList, enrichedMenuItems]);

  const filteredMenuItems = useMemo(() => {
    return enrichedMenuItems.filter((item) => {
      if (
        adminSelectedCategory !== "all" &&
        item.resolvedCategory !== adminSelectedCategory
      )
        return false;
      if (
        adminSelectedSubcategory !== "all" &&
        item.resolvedSubcategory !== adminSelectedSubcategory
      )
        return false;
      if (searchMenu.trim()) {
        const q = searchMenu.toLowerCase().trim();
        return (
          item.name?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.resolvedSubcategory?.toLowerCase().includes(q) ||
          item.resolvedCategory?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    enrichedMenuItems,
    adminSelectedCategory,
    adminSelectedSubcategory,
    searchMenu,
  ]);

  const groupedMenuItems = useMemo(() => {
    const map = new Map<
      string,
      { category: string; subcategory: string; items: EnrichedMenuItem[] }
    >();
    filteredMenuItems.forEach((item) => {
      const key = item.resolvedCategory + "::: " + item.resolvedSubcategory;
      if (!map.has(key)) {
        map.set(key, {
          category: item.resolvedCategory,
          subcategory: item.resolvedSubcategory,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [filteredMenuItems]);

  const todayStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const todayOrders = orders.filter((o) => {
      const d = toDate(o.createdAt);
      if (!d) return false;
      return d.getTime() >= todayStart && o.status !== "cancelled";
    });
    const revenue = todayOrders.reduce(
      (sum, o) => sum + safeNumber(o.total),
      0
    );
    const deliveryCount = orders.filter(
      (o) => o.type === "delivery" && o.status !== "cancelled"
    ).length;
    return {
      revenue,
      orderCount: todayOrders.length,
      deliveryCount,
    };
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      const k = getStatusKey(o) as keyof typeof counts;
      if (k in counts) counts[k] += 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderFilter !== "all") {
      if (orderFilter === "active") {
        list = list.filter((o) => {
          const k = getStatusKey(o);
          return k !== "completed" && k !== "cancelled" && k !== "delivered";
        });
      } else if (orderFilter === "delivered") {
        list = list.filter((o) => getStatusKey(o) === "delivered");
      } else {
        list = list.filter((o) => getStatusKey(o) === orderFilter);
      }
    }
    const q = searchOrders.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.phone || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, orderFilter, searchOrders]);

  const completedOrders = useMemo(
    () => orders.filter((o) => getStatusKey(o) === "completed" || getStatusKey(o) === "delivered"),
    [orders]
  );

  const filteredHistory = useMemo(() => {
    let list = completedOrders;
    const q = historySearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q)
      );
    }
    if (historyDateFilter) {
      const target = new Date(historyDateFilter);
      target.setHours(0, 0, 0, 0);
      const targetTs = target.getTime();
      const nextDay = targetTs + 86_400_000;
      list = list.filter((o) => {
        const d = toDate(o.createdAt);
        if (!d) return false;
        const ts = d.getTime();
        return ts >= targetTs && ts < nextDay;
      });
    }
    return list;
  }, [completedOrders, historySearch, historyDateFilter]);

  const kitchenOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusKey = getStatusKey(o);
      if (kitchenStatusFilter !== "all") {
        if (kitchenStatusFilter === "active") {
          if (
            statusKey === "completed" ||
            statusKey === "cancelled" ||
            statusKey === "delivered"
          )
            return false;
        } else if (statusKey !== kitchenStatusFilter) {
          return false;
        }
      }
      if (kitchenSourceFilter !== "all") {
        const src = (o.source || "").toLowerCase();
        if (kitchenSourceFilter === "kitchen") {
          if (
            src !== "kitchen" &&
            src !== "on_spot" &&
            src !== "on spot" &&
            src !== "pos" &&
            !(o.kitchenNotes && o.kitchenNotes.includes("kitchen"))
          )
            return false;
        } else if (kitchenSourceFilter === "website") {
          if (src !== "website") return false;
        } else if (kitchenSourceFilter === "swiggy") {
          if (src !== "swiggy") return false;
        } else if (kitchenSourceFilter === "zomato") {
          if (src !== "zomato") return false;
        }
      }
      if (kitchenSearchQuery.trim()) {
        const q = kitchenSearchQuery.toLowerCase();
        return (
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.items || []).some((i) =>
            (i.name || "").toLowerCase().includes(q)
          )
        );
      }
      return true;
    });
  }, [orders, kitchenStatusFilter, kitchenSourceFilter, kitchenSearchQuery]);

  /* ============================================================= */
  /* Reports                                                      */
  /* ============================================================= */

  const reportOrders = useMemo(() => {
    let filtered = orders.filter((o) => o.status !== "cancelled");
    const now = new Date();
    if (reportPeriod === "daily") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();
      filtered = filtered.filter((o) => {
        const d = toDate(o.createdAt);
        return d ? d.getTime() >= start : false;
      });
    } else if (reportPeriod === "weekly") {
      // ISO week starts on Monday.
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      const start = monday.getTime();
      filtered = filtered.filter((o) => {
        const d = toDate(o.createdAt);
        return d ? d.getTime() >= start : false;
      });
    } else if (reportPeriod === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filtered = filtered.filter((o) => {
        const d = toDate(o.createdAt);
        return d ? d.getTime() >= start : false;
      });
    }
    return filtered;
  }, [orders, reportPeriod]);

  const reportTotals = useMemo(() => {
    const revenue = reportOrders.reduce(
      (sum, o) => sum + safeNumber(o.total),
      0
    );
    const count = reportOrders.length;
    const avg = count > 0 ? revenue / count : 0;
    return { revenue, count, avg };
  }, [reportOrders]);

  const barData = useMemo(() => {
    if (reportOrders.length === 0) return [];
    const groups = new Map<
      string,
      { name: string; revenue: number; orders: number; ts: number }
    >();
    reportOrders.forEach((o) => {
      const d = toDate(o.createdAt);
      if (!d) return;
      const key = d.toDateString();
      const ts = d.getTime();
      if (!groups.has(key)) {
        groups.set(key, {
          name: d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
          }),
          revenue: 0,
          orders: 0,
          ts,
        });
      }
      const entry = groups.get(key)!;
      entry.revenue += safeNumber(o.total);
      entry.orders += 1;
    });
    return Array.from(groups.values())
      .sort((a, b) => a.ts - b.ts)
      .slice(-7)
      .map(({ name, revenue, orders }) => ({ name, revenue, orders }));
  }, [reportOrders]);

  const pieData = useMemo(() => {
    const takeaway = reportOrders.filter((o) => o.type !== "delivery").length;
    const delivery = reportOrders.filter((o) => o.type === "delivery").length;
    if (takeaway === 0 && delivery === 0) {
      return [];
    }
    return [
      { name: "Takeaway", value: takeaway },
      { name: "Delivery", value: delivery },
    ];
  }, [reportOrders]);

  const topItems = useMemo(() => {
    const counts: Record<string, number> = {};
    reportOrders.forEach((o) => {
      (o.items || []).forEach((i) => {
        const name = i.name || "Unknown";
        counts[name] = (counts[name] || 0) + (i.quantity || 1);
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [reportOrders]);

  const categoryAnalytics = useMemo(() => {
    const itemCategoryMap = new Map<string, string>();
    menuItems.forEach((m) => {
      if (m.name && m.category) {
        itemCategoryMap.set(m.name.toLowerCase().trim(), m.category);
      }
    });
    DUMMY_MENU.forEach((m) => {
      if (
        m.name &&
        m.category &&
        !itemCategoryMap.has(m.name.toLowerCase().trim())
      ) {
        itemCategoryMap.set(m.name.toLowerCase().trim(), m.category);
      }
    });

    const categoryStats: Record<
      string,
      {
        category: string;
        totalRevenue: number;
        itemsSold: number;
        orderCount: number;
        itemBreakdown: Record<
          string,
          { name: string; quantity: number; revenue: number }
        >;
      }
    > = {};

    let grandTotalRevenue = 0;
    let grandTotalItemsSold = 0;

    const validOrders = orders.filter((o) => o.status !== "cancelled");
    validOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const itemName = item.name || "Unknown Item";
        const itemKey = itemName.toLowerCase().trim();
        let cat =
          (item as { category?: string }).category ||
          itemCategoryMap.get(itemKey) ||
          "Specialties";
        const matchedCat = categories.find(
          (c) => c.id === cat || c.name === cat
        );
        if (matchedCat) cat = matchedCat.name;
        const qty = Number(item.quantity) || 1;
        const price = safeNumber(item.price);
        const itemRevenue = price * qty;
        grandTotalRevenue += itemRevenue;
        grandTotalItemsSold += qty;
        if (!categoryStats[cat]) {
          categoryStats[cat] = {
            category: cat,
            totalRevenue: 0,
            itemsSold: 0,
            orderCount: 0,
            itemBreakdown: {},
          };
        }
        const stat = categoryStats[cat];
        stat.totalRevenue += itemRevenue;
        stat.itemsSold += qty;
        stat.orderCount += 1;
        if (!stat.itemBreakdown[itemKey]) {
          stat.itemBreakdown[itemKey] = {
            name: itemName,
            quantity: 0,
            revenue: 0,
          };
        }
        stat.itemBreakdown[itemKey].quantity += qty;
        stat.itemBreakdown[itemKey].revenue += itemRevenue;
      });
    });

    const categoryList = Object.values(categoryStats).map((stat) => {
      const contributionPercent =
        grandTotalRevenue > 0
          ? (stat.totalRevenue / grandTotalRevenue) * 100
          : 0;
      const topItemsList = Object.values(stat.itemBreakdown)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      return { ...stat, contributionPercent, topItems: topItemsList };
    });
    categoryList.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const bestSellingCategory =
      categoryList.length > 0 ? categoryList[0] : null;
    const categoryBarData = categoryList.slice(0, 8).map((c) => ({
      name: c.category,
      revenue: Math.round(c.totalRevenue),
      itemsSold: c.itemsSold,
    }));
    const categoryPieData = categoryList.slice(0, 6).map((c) => ({
      name: c.category,
      value: Math.round(c.totalRevenue),
    }));
    return {
      categoryList,
      grandTotalRevenue,
      grandTotalItemsSold,
      bestSellingCategory,
      categoryBarData,
      categoryPieData,
    };
  }, [orders, menuItems, categories]);

  /* ============================================================= */
  /* CSV export                                                   */
  /* ============================================================= */

  const exportHistory = useCallback(() => {
    const headers = [
      "Order #",
      "Customer",
      "Phone",
      "Type",
      "Total",
      "Items",
      "Date",
    ];
    const rows = filteredHistory.map((o) => [
      o.orderNumber || "",
      o.customerName || "",
      o.phone || o.customerPhone || "",
      o.type || "",
      safeNumber(o.total).toFixed(2),
      (o.items || []).map((i) => `${i.name} x${i.quantity}`).join("; "),
      formatISTDate(o.createdAt),
    ]);
    const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((r) => r.map(escapeCsvField).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elpresto_orders_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "CSV exported.");
  }, [filteredHistory, pushToast]);

  /* ============================================================= */
  /* Trending debounced save                                      */
  /* ============================================================= */

  const queueTrendingSave = useCallback(
    (updated: TrendingSettings) => {
      setTrendingSettings(updated);
      if (trendingDebounceRef.current != null) {
        window.clearTimeout(trendingDebounceRef.current);
      }
      trendingDebounceRef.current = window.setTimeout(async () => {
        try {
          await saveTrendingSettings(updated);
          setTrendingSaveMsg("Saved");
          window.setTimeout(() => setTrendingSaveMsg(null), 2000);
        } catch (err) {
          pushToast("error", "Failed to save trending settings.");
        }
        trendingDebounceRef.current = null;
      }, 600);
    },
    [pushToast]
  );

  /* ============================================================= */
  /* Panel access                                                 */
  /* ============================================================= */

  const handleTogglePanel = useCallback(
    (panelKey: PanelKey) => {
      const current = panelAccess[panelKey];
      if (panelKey === "admin" && current.enabled) {
        setConfirm({
          title: "Disable admin panel?",
          message:
            "You will lock yourself out of the admin panel. Are you sure?",
          confirmLabel: "Disable",
          destructive: true,
          onConfirm: async () => {
            const updated: PanelAccessData = {
              ...panelAccess,
              [panelKey]: {
                ...current,
                enabled: false,
                updatedAt: Timestamp.now(),
              },
            };
            try {
              await savePanelAccessSettings(updated);
              setPanelAccess(updated);
              pushToast("error", "Admin panel disabled. Sign out to recover.");
            } catch (err) {
              pushToast("error", "Failed to update panel.");
            }
          },
        });
        return;
      }
      (async () => {
        const updated: PanelAccessData = {
          ...panelAccess,
          [panelKey]: {
            ...current,
            enabled: !current.enabled,
            updatedAt: Timestamp.now(),
          },
        };
        try {
          await savePanelAccessSettings(updated);
          setPanelAccess(updated);
          pushToast("success", `Updated ${current.name}.`);
        } catch (err) {
          pushToast("error", "Failed to update panel.");
        }
      })();
    },
    [panelAccess, pushToast]
  );

  const handleUpdatePanelPin = useCallback(
    async (panelKey: PanelKey) => {
      const newPin = panelPinInputs[panelKey]?.trim();
      if (!newPin || newPin.length < 4) {
        pushToast("error", "PIN must be at least 4 characters.");
        return;
      }
      const current = panelAccess[panelKey];
      try {
        const hashed = await hashPin(newPin);
        const updated: PanelAccessData = {
          ...panelAccess,
          [panelKey]: {
            ...current,
            pin: hashed,
            updatedAt: Timestamp.now(),
          },
        };
        await savePanelAccessSettings(updated);
        setPanelAccess(updated);
        setPanelPinInputs((prev) => ({ ...prev, [panelKey]: "" }));
        pushToast("success", `Updated PIN for ${current.name}.`);
      } catch (err) {
        pushToast("error", "Failed to save PIN.");
      }
    },
    [panelPinInputs, panelAccess, pushToast]
  );

  /* ============================================================= */
  /* Order details handlers                                       */
  /* ============================================================= */

  const handleAssignRider = useCallback(async () => {
    if (!showOrderDetailsModal) return;
    const name = assignRiderInputRef.current?.value || "";
    await assignDeliveryPartner(showOrderDetailsModal.id, name);
  }, [showOrderDetailsModal, assignDeliveryPartner]);

  /* ============================================================= */
  /* Renderers                                                    */
  /* ============================================================= */

  const renderDashboard = () => (
    <div className="space-y-6 sm:space-y-7">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.17),_transparent_48%),linear-gradient(120deg,#171f2e_0%,#111827_60%,#151a27_100%)] px-5 py-6 shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-orange-300/10" />
        <div aria-hidden="true" className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-orange-300/[0.07]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300"><span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.85)]" /> EL PRESTO · STORE CONTROL</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Good to see you{staffSession?.name ? `, ${staffSession.name.split(" ")[0]}` : ""}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Here’s what’s happening across your store today. Keep an eye on incoming orders and kitchen progress.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/15 px-3.5 py-2.5 text-xs font-medium text-slate-300"><Clock size={14} className="text-orange-300" />{new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date())}</span>
            <button type="button" onClick={() => setActiveTab("liveOrders")} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-400"><ShoppingBag size={14} /> Open orders <ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold text-white">Today at a glance</h2><p className="mt-1 text-xs text-slate-500">Live performance and fulfilment status</p></div>
        <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Updating live</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today's Revenue"
          value={`₹${Math.round(todayStats.revenue).toLocaleString("en-IN")}`}
          sub={`${todayStats.orderCount} orders today`}
          icon={<IndianRupee size={20} />}
          gradient="from-emerald-500/20 to-teal-500/5"
          iconGradient="from-emerald-500 to-teal-500"
        />
        <MetricCard
          label="Total Orders"
          value={todayStats.orderCount}
          sub={`${todayStats.deliveryCount} delivery`}
          icon={<ShoppingBag size={20} />}
          gradient="from-orange-500/20 to-amber-500/5"
          iconGradient="from-orange-500 to-amber-500"
        />
        <MetricCard
          label="In Kitchen"
          value={statusCounts.preparing}
          sub="Actively preparing"
          icon={<Flame size={20} />}
          gradient="from-amber-500/20 to-yellow-500/5"
          iconGradient="from-amber-500 to-yellow-500"
        />
        <MetricCard
          label="Ready / In Transit"
          value={statusCounts.ready}
          sub="Awaiting pickup"
          icon={<Truck size={20} />}
          gradient="from-blue-500/20 to-indigo-500/5"
          iconGradient="from-blue-500 to-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.85)] sm:p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/15"
              >
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Live Order Queue
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Real-time incoming orders
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("liveOrders")}
              className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-orange-400 transition hover:bg-white/10"
            >
              View all
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
            {filteredOrders.filter((o) => getStatusKey(o) !== "completed" && getStatusKey(o) !== "cancelled").length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/60">
                  <Coffee size={26} className="text-slate-600" aria-hidden="true" />
                </div>
                <p className="mt-3 text-xs font-black text-slate-400">
                  All caught up!
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  New orders will appear here automatically
                </p>
              </div>
            ) : (
              orders
                .filter((o) => {
                  const k = getStatusKey(o);
                  return k !== "completed" && k !== "cancelled";
                })
                .slice(0, 5)
                .map((o) => (
                  <div
                    key={o.id}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-3.5 transition hover:border-orange-500/30 hover:bg-slate-800/70"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-white">
                          {o.orderNumber}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                            o.type === "delivery"
                              ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                              : "bg-slate-700/60 text-slate-300 ring-slate-600/40"
                          }`}
                        >
                          {o.type === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}
                        </span>
                      </div>
                      <p className="truncate text-[11px] font-semibold text-slate-400">
                        {o.customerName} · {o.items?.length || 0} items
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm font-black text-emerald-400">
                        ₹{Math.round(safeNumber(o.total))}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(o.id, "ready")}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:scale-[1.03] active:scale-95"
                      >
                        Ready
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOrderDetailsModal(o)}
                        aria-label={`View order ${o.orderNumber}`}
                        className="grid h-8 w-8 place-items-center rounded-xl bg-slate-700/60 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#111827] p-4 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.85)] sm:p-5">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25"
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Quick Access</h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Portals & shortcuts
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <QuickLink
              href="/kitchen"
              emoji="🍳"
              label="Kitchen Live Board"
              accent="orange"
            />
            <QuickLink
              href="/counter"
              emoji="🏪"
              label="Counter POS"
              accent="blue"
            />
            <QuickLink
              href="/delivery"
              emoji="🛵"
              label="Delivery Fleet"
              accent="emerald"
            />
            <QuickLink
              href="/menu"
              emoji="🍕"
              label="Customer Menu"
              accent="amber"
            />
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-300">
              <Compass size={12} aria-hidden="true" /> Hub Coordinates
            </p>
            <p className="mt-1.5 truncate font-mono text-[11px] font-semibold text-slate-300">
              {settings.cafeLat}, {settings.cafeLng}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-slate-500">
              Radius: {settings.deliveryRadiusKm} km
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLiveOrders = () => (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={15}
              aria-hidden="true"
            />
            <label htmlFor="live-orders-search" className="sr-only">
              Search orders
            </label>
            <input
              id="live-orders-search"
              type="search"
              placeholder="Search order #, customer…"
              className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              value={searchOrders}
              onChange={(e) => setSearchOrders(e.target.value)}
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter orders"
            className="flex flex-wrap items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1"
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "preparing", label: "Preparing" },
                { id: "ready", label: "Ready" },
                { id: "completed", label: "Completed" },
              ] as const
            ).map((status) => (
              <button
                key={status.id}
                type="button"
                role="tab"
                aria-selected={orderFilter === status.id}
                onClick={() => setOrderFilter(status.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                  orderFilter === status.id
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
              <ShoppingBag
                size={36}
                className="text-slate-600"
                aria-hidden="true"
              />
            </div>
            <p className="mt-4 text-sm font-black text-slate-400">
              No orders matching this filter
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              Try changing your filter or search query
            </p>
          </div>
        ) : (
          filteredOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onPrint={() => printReceipt(o)}
              onView={() => setShowOrderDetailsModal(o)}
              onMarkPaid={async () => {
                try {
                  await writeWithAudit(doc(db, "orders", o.id), {
                    paymentStatus: "paid",
                  });
                  pushToast("success", "Marked paid.");
                } catch {
                  pushToast("error", "Failed to update payment.");
                }
              }}
              onMarkReady={() => updateOrderStatus(o.id, "ready")}
              onComplete={() => updateOrderStatus(o.id, "completed")}
              onCancel={() => cancelOrder(o.id, o.orderNumber || o.id)}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderKitchenOrders = () => (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/90 p-5 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-white/10"
            >
              <ChefHat size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-black text-white sm:text-lg">
                Kitchen Live Operations
                <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400 ring-1 ring-orange-500/30">
                  {statusCounts.pending +
                    statusCounts.preparing +
                    statusCounts.ready}{" "}
                  Active
                </span>
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Monitor cooking queue, prep timers, and order sources
              </p>
            </div>
          </div>

          <Link
            href="/kitchen"
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
          >
            Open Dedicated KDS{" "}
            <ExternalLink size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniMetric
          label="New"
          value={statusCounts.pending}
          color="amber"
          icon={<Bell size={18} />}
        />
        <MiniMetric
          label="Preparing"
          value={statusCounts.preparing}
          color="orange"
          icon={<Flame size={18} />}
        />
        <MiniMetric
          label="Ready"
          value={statusCounts.ready}
          color="blue"
          icon={<Truck size={18} />}
        />
        <MiniMetric
          label="Completed"
          value={statusCounts.completed}
          color="emerald"
          icon={<CheckCircle size={18} />}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={14}
              aria-hidden="true"
            />
            <label htmlFor="kitchen-search" className="sr-only">
              Search kitchen orders
            </label>
            <input
              id="kitchen-search"
              type="search"
              placeholder="Search ticket # or customer…"
              value={kitchenSearchQuery}
              onChange={(e) => setKitchenSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
              {[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "pending", label: "New" },
                { id: "preparing", label: "Prepping" },
                { id: "ready", label: "Ready" },
                { id: "completed", label: "Done" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setKitchenStatusFilter(s.id)}
                  aria-pressed={kitchenStatusFilter === s.id}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                    kitchenStatusFilter === s.id
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label htmlFor="kitchen-source" className="sr-only">
              Filter by order source
            </label>
            <select
              id="kitchen-source"
              value={kitchenSourceFilter}
              onChange={(e) => setKitchenSourceFilter(e.target.value)}
              className="rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black text-white focus:outline-none"
            >
              <option value="all">All Channels</option>
              <option value="kitchen">On Spot</option>
              <option value="website">Website</option>
              <option value="swiggy">Swiggy</option>
              <option value="zomato">Zomato</option>
            </select>
          </div>
        </div>
      </div>

      {kitchenOrders.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
            <ChefHat size={36} className="text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-400">
            No kitchen orders matching filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kitchenOrders.map((order) => {
            const src = (order.source || "").toLowerCase();
            const isEditable =
              src === "kitchen" ||
              src === "on_spot" ||
              src === "pos" ||
              (order.kitchenNotes && order.kitchenNotes.includes("kitchen"));
            const orderDate = toDate(order.createdAt) || new Date();
            const elapsedMins = Math.floor(
              (Date.now() - orderDate.getTime()) / 60000
            );
            const isLate = elapsedMins >= 15;

            return (
              <div
                key={order.id}
                className={`relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-md transition ${
                  isLate
                    ? "border-red-500/50 bg-red-950/20 ring-1 ring-red-500/20"
                    : "border-white/5 bg-slate-900 hover:border-white/10"
                }`}
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-base font-black text-white">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                            src === "swiggy"
                              ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                              : src === "zomato"
                              ? "bg-red-500/15 text-red-300 ring-red-500/30"
                              : isEditable
                              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                              : "bg-blue-500/15 text-blue-300 ring-blue-500/30"
                          }`}
                        >
                          {src === "swiggy"
                            ? "🟠 Swiggy"
                            : src === "zomato"
                            ? "🔴 Zomato"
                            : isEditable
                            ? "🏪 On Spot"
                            : "🌐 Website"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-bold text-slate-400">
                        👤 {order.customerName}
                      </p>
                    </div>

                    <span
                      className={`flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 font-mono text-[10px] font-black ${
                        isLate
                          ? "animate-pulse bg-red-500 text-white"
                          : elapsedMins >= 10
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      <Clock size={9} aria-hidden="true" /> {elapsedMins}m
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip status={getStatusKey(order)} />
                    {isEditable ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <Edit size={10} aria-hidden="true" /> Editable
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <Lock size={10} aria-hidden="true" /> Locked
                      </span>
                    )}
                  </div>
                </div>

                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-slate-800/40 p-2.5 text-xs">
                  {(order.items || []).map((item, i) => (
                    <div
                      key={`${item.id || item.name}-${i}`}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span className="truncate">
                        <strong className="mr-1.5 font-mono text-orange-400">
                          {item.quantity}×
                        </strong>
                        {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        ₹
                        {Math.round(
                          safeNumber(item.price) * (item.quantity || 1)
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {order.instructions && (
                  <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] font-bold text-amber-300">
                    📝 {order.instructions}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                  <span className="font-mono text-base font-black text-emerald-400">
                    ₹{Math.round(safeNumber(order.total))}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusKey(order) === "pending" && (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, "preparing")}
                        className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                      >
                        Start Prep
                      </button>
                    )}
                    {getStatusKey(order) === "preparing" && (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, "ready")}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-500 hover:scale-[1.03] active:scale-95"
                      >
                        Mark Ready
                      </button>
                    )}
                    {getStatusKey(order) === "ready" && (
                      <button
                        type="button"
                        onClick={() => updateOrderStatus(order.id, "completed")}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-500 hover:scale-[1.03] active:scale-95"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => printReceipt(order)}
                      aria-label={`Print order ${order.orderNumber}`}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      <Printer size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOrderDetailsModal(order)}
                      aria-label={`View order ${order.orderNumber}`}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMenuManagement = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={15}
              aria-hidden="true"
            />
            <label htmlFor="menu-search" className="sr-only">
              Search menu items
            </label>
            <input
              id="menu-search"
              type="search"
              placeholder="Search items by name, category, or description…"
              className="w-full rounded-2xl border border-white/5 bg-slate-800/80 py-3 pl-11 pr-9 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              value={searchMenu}
              onChange={(e) => setSearchMenu(e.target.value)}
            />
            {searchMenu && (
              <button
                type="button"
                onClick={() => setSearchMenu("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              {filteredMenuItems.length} of {enrichedMenuItems.length} products
            </span>
            <button
              type="button"
              onClick={() => {
                setModalCategory(
                  adminSelectedCategory !== "all"
                    ? adminSelectedCategory
                    : "Food"
                );
                const cat = activeCategoriesList.find(
                  (c) =>
                    c.name ===
                    (adminSelectedCategory !== "all"
                      ? adminSelectedCategory
                      : "Food")
                );
                setModalSubcategory(
                  adminSelectedSubcategory !== "all"
                    ? adminSelectedSubcategory
                    : cat?.subcategories?.[0]?.name || "General"
                );
                setIsCustomSubcategory(false);
                setCustomSubcategoryText("");
                setShowAddMenuItemModal(true);
              }}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
            >
              <Plus size={15} strokeWidth={3} aria-hidden="true" /> Add Product
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-white/5 pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Folder size={12} className="text-orange-400" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Categories
            </span>
          </div>

          <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-2">
            <CategoryPill
              active={adminSelectedCategory === "all"}
              label="All"
              count={enrichedMenuItems.length}
              onClick={() => {
                setAdminSelectedCategory("all");
                setAdminSelectedSubcategory("all");
              }}
            />
            {activeCategoriesList.map((cat) => {
              const count = enrichedMenuItems.filter(
                (i) => i.resolvedCategory === cat.name
              ).length;
              return (
                <CategoryPill
                  key={cat.id}
                  active={adminSelectedCategory === cat.name}
                  label={cat.name}
                  count={count}
                  onClick={() => {
                    setAdminSelectedCategory(cat.name);
                    setAdminSelectedSubcategory("all");
                  }}
                />
              );
            })}
          </div>

          {availableSubcategories.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto">
                <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sub:
                </span>
                <SubPill
                  active={adminSelectedSubcategory === "all"}
                  label="All"
                  onClick={() => setAdminSelectedSubcategory("all")}
                />
                {availableSubcategories.map((subName) => {
                  const count = enrichedMenuItems.filter(
                    (i) =>
                      (adminSelectedCategory === "all" ||
                        i.resolvedCategory === adminSelectedCategory) &&
                      i.resolvedSubcategory === subName
                  ).length;
                  return (
                    <SubPill
                      key={subName}
                      active={adminSelectedSubcategory === subName}
                      label={subName}
                      count={count}
                      onClick={() => setAdminSelectedSubcategory(subName)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {groupedMenuItems.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
            <Utensils size={36} className="text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-400">
            No products in this view
          </p>
          <p className="mt-1 max-w-md text-center text-xs font-semibold text-slate-600">
            {searchMenu
              ? `No items matching "${searchMenu}"`
              : "Add your first item to this category below."}
          </p>
          <button
            type="button"
            onClick={() => {
              setModalCategory(
                adminSelectedCategory !== "all"
                  ? adminSelectedCategory
                  : "Food"
              );
              setModalSubcategory(
                adminSelectedSubcategory !== "all"
                  ? adminSelectedSubcategory
                  : "Healthy Mania"
              );
              setIsCustomSubcategory(false);
              setCustomSubcategoryText("");
              setShowAddMenuItemModal(true);
            }}
            className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
          >
            <Plus size={14} strokeWidth={3} aria-hidden="true" /> Add Item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMenuItems.map((group) => (
            <div
              key={group.category + "-" + group.subcategory}
              className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    aria-hidden="true"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25"
                  >
                    <Utensils size={16} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {group.category}
                      </span>
                      <ChevronRight
                        size={12}
                        className="text-slate-600"
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-black text-white">
                        {group.subcategory}
                      </h3>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] font-black text-orange-400">
                        {group.items.length}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModalCategory(group.category);
                    setModalSubcategory(group.subcategory);
                    setIsCustomSubcategory(false);
                    setCustomSubcategoryText("");
                    setShowAddMenuItemModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-orange-300 transition hover:bg-orange-500/20"
                >
                  <Plus size={12} strokeWidth={3} aria-hidden="true" /> Add
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-4 transition hover:border-orange-500/20 hover:bg-slate-800/60"
                  >
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"
                          />
                          {item.isVeg !== false ? "Veg" : "Non-Veg"}
                        </span>
                        <div className="flex items-center gap-1">
                          <IconAction
                            onClick={() => toggleMenuItemAvailable(item.id)}
                            title={
                              item.available !== false
                                ? "Mark sold out"
                                : "Restore"
                            }
                            variant={
                              item.available !== false ? "success" : "danger"
                            }
                          >
                            {item.available !== false ? (
                              <CheckCircle size={13} />
                            ) : (
                              <CircleOff size={13} />
                            )}
                          </IconAction>
                          <IconAction
                            onClick={() => {
                              setModalCategory(
                                item.resolvedCategory || "Food"
                              );
                              setModalSubcategory(
                                item.resolvedSubcategory || "General"
                              );
                              setIsCustomSubcategory(false);
                              setCustomSubcategoryText("");
                              setShowEditMenuItemModal(item);
                            }}
                            title="Edit"
                          >
                            <Edit size={13} />
                          </IconAction>
                          <IconAction
                            onClick={() => deleteMenuItem(item.id, item.name || "")}
                            title="Delete"
                            variant="danger"
                          >
                            <Trash2 size={13} />
                          </IconAction>
                        </div>
                      </div>

                      <h4 className="line-clamp-1 text-sm font-black text-white">
                        {item.name}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                        {item.description ||
                          "Artisan recipe, prepared fresh with finest ingredients."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Price
                        </p>
                        <p className="font-mono text-base font-black text-white">
                          ₹{safeNumber(item.price)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                          item.available !== false
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-red-500/15 text-red-300 ring-red-500/30"
                        }`}
                      >
                        {item.available !== false ? "In Stock" : "Sold Out"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCategoryManagement = () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 ring-1 ring-white/10"
            >
              <Layers size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white sm:text-lg">
                Categories & Subcategories
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Organize customer menu sections and product hierarchy
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCategoryModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
          >
            <Plus size={15} strokeWidth={3} aria-hidden="true" /> Add Category
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {activeCategoriesList.map((cat) => {
          const itemCount = enrichedMenuItems.filter(
            (i) => i.resolvedCategory === cat.name
          ).length;
          const subs = cat.subcategories || [];

          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25"
                  >
                    <Folder size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">
                        {cat.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                          cat.enabled
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-red-500/15 text-red-300 ring-red-500/30"
                        }`}
                      >
                        {cat.enabled ? "Active" : "Hidden"}
                      </span>
                      <span className="font-mono text-[10px] font-black text-slate-500">
                        {itemCount} items
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <IconAction
                    onClick={() => toggleCategoryEnabled(cat.id)}
                    title={cat.enabled ? "Hide category" : "Show category"}
                  >
                    {cat.enabled ? (
                      <ToggleRight className="text-orange-500" size={20} />
                    ) : (
                      <ToggleLeft className="text-slate-500" size={20} />
                    )}
                  </IconAction>
                  <IconAction
                    onClick={() => {
                      const newName = window.prompt(
                        "Rename category",
                        cat.name
                      );
                      if (newName && newName.trim() && newName.trim() !== cat.name) {
                        editCategory(cat.id, newName.trim());
                      }
                    }}
                    title="Rename"
                  >
                    <Edit size={14} />
                  </IconAction>
                  <IconAction
                    onClick={() => deleteCategory(cat.id, cat.name)}
                    title="Delete"
                    variant="danger"
                  >
                    <Trash2 size={14} />
                  </IconAction>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Tag size={11} className="text-amber-400" aria-hidden="true" />
                    {subs.length} Subcategories
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubModal(cat);
                      setNewSubNameInput("");
                    }}
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-orange-400 transition hover:text-orange-300"
                  >
                    <Plus size={12} strokeWidth={3} aria-hidden="true" /> Add
                  </button>
                </div>

                {subs.length === 0 ? (
                  <p className="py-2 text-[11px] font-semibold italic text-slate-500">
                    No subcategories yet. Add one above.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {subs.map((sub) => {
                      const subItemCount = enrichedMenuItems.filter(
                        (i) =>
                          i.resolvedCategory === cat.name &&
                          i.resolvedSubcategory === sub.name
                      ).length;
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-white/10"
                        >
                          <span className="text-white">{sub.name}</span>
                          <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-300">
                            {subItemCount}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              deleteSubcategoryFromCategory(
                                cat.id,
                                sub.id,
                                sub.name
                              )
                            }
                            aria-label={`Remove ${sub.name}`}
                            className="text-slate-500 transition hover:text-red-400"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderOrderHistory = () => (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                size={15}
                aria-hidden="true"
              />
              <label htmlFor="history-search" className="sr-only">
                Search history
              </label>
              <input
                id="history-search"
                type="search"
                placeholder="Search history…"
                className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <label htmlFor="history-date" className="sr-only">
              Filter by date
            </label>
            <input
              id="history-date"
              type="date"
              className="rounded-xl border border-white/5 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-white focus:border-orange-500/40 focus:outline-none"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={exportHistory}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-200 transition hover:bg-slate-700"
          >
            <Download size={14} aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Order history">
            <thead className="bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Order #
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Total
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Payment
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Items
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <History
                        size={36}
                        className="text-slate-700"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-sm font-black text-slate-500">
                        No orders in history
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((o) => (
                  <tr
                    key={o.id}
                    className="text-slate-300 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono font-black text-white">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {o.customerName}
                    </td>
                    <td className="px-4 py-3">
                      {o.type === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-emerald-400">
                      ₹{Math.round(safeNumber(o.total))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                          (o.paymentStatus || "pending") === "paid"
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                        }`}
                      >
                        {(o.paymentStatus || "pending") === "paid"
                          ? "Paid"
                          : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatISTDateShort(o.createdAt)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-400">
                      {(o.items || [])
                        .map((i) => `${i.name} x${i.quantity}`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => printReceipt(o)}
                        aria-label={`Print receipt for ${o.orderNumber}`}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                      >
                        <Printer size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSalesReports = () => {
    const { categoryList, bestSellingCategory, categoryBarData, categoryPieData } =
      categoryAnalytics;

    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/10"
              >
                <BarChart3 size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-white sm:text-lg">
                  Sales & Revenue Analytics
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  Real-time store performance insights
                </p>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Report period"
              className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1"
            >
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  role="tab"
                  aria-selected={reportPeriod === period}
                  onClick={() => setReportPeriod(period)}
                  className={`rounded-lg px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                    reportPeriod === period
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Period Revenue"
            value={`₹${Math.round(reportTotals.revenue).toLocaleString("en-IN")}`}
            icon={<IndianRupee size={18} />}
            color="emerald"
          />
          <KpiCard
            label="Total Orders"
            value={reportTotals.count}
            icon={<ShoppingBag size={18} />}
            color="orange"
          />
          <KpiCard
            label="Avg Ticket"
            value={`₹${Math.round(reportTotals.avg).toLocaleString("en-IN")}`}
            icon={<TrendingUp size={18} />}
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Modern3DBarChart
              data={barData}
              title="Revenue Trend"
              theme="orange"
            />
          </div>

          <div className="flex flex-col justify-between gap-4">
            {pieData.length > 0 ? (
              <Modern3DDonutChart data={pieData} title="Order Split" />
            ) : (
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-center text-xs font-semibold text-slate-500">
                No orders in this period.
              </div>
            )}

            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Top Sellers
              </p>
              <div className="space-y-1.5 text-xs">
                {topItems.length === 0 ? (
                  <p className="text-[11px] italic text-slate-500">
                    No data yet.
                  </p>
                ) : (
                  topItems.map(([name, qty], idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-orange-500/15 font-mono text-[10px] font-black text-orange-400">
                          {idx + 1}
                        </span>
                        <span className="truncate font-semibold text-slate-300">
                          {name}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-black text-orange-400">
                        {qty}×
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-white/5 pt-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25"
              >
                <Crown size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Category-wise Sales Breakdown
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Revenue, volume, and top-selling items by menu section
                </p>
              </div>
            </div>

            {bestSellingCategory && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-black">
                <Award
                  size={13}
                  className="text-amber-400"
                  aria-hidden="true"
                />
                <span className="text-amber-300">
                  Best: {bestSellingCategory.category}
                </span>
                <span className="font-mono text-emerald-400">
                  ₹{Math.round(bestSellingCategory.totalRevenue)}
                </span>
                <span className="text-amber-400">
                  ({bestSellingCategory.contributionPercent.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {categoryBarData.length > 0 && (
            <>
              <Modern3DCategoryChart
                data={categoryBarData}
                title="Category Revenue & Volume"
                subtitle="Multi-dimensional sales performance by menu section"
              />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Modern3DBarChart
                    data={categoryBarData}
                    title="Category Revenue Comparison"
                    theme="emerald"
                  />
                </div>

                <div>
                  {categoryPieData.length > 0 && (
                    <Modern3DDonutChart
                      data={categoryPieData}
                      title="Category Share"
                      totalLabel="Category Sales"
                    />
                  )}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryList.map((cat, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl transition hover:border-white/10"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-orange-500/15 font-mono text-[10px] font-black text-orange-400">
                        #{idx + 1}
                      </span>
                      <h4 className="truncate text-sm font-black text-white">
                        {cat.category}
                      </h4>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-black text-emerald-400">
                      ₹{Math.round(cat.totalRevenue)}
                    </span>
                  </div>

                  <div className="mb-3 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Contribution</span>
                      <span className="text-orange-400">
                        {cat.contributionPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(5, cat.contributionPercent)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between border-t border-white/5 py-1.5 text-xs">
                    <span className="text-slate-400">Items sold</span>
                    <span className="font-mono font-black text-white">
                      {cat.itemsSold}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 py-1.5 text-xs">
                    <span className="text-slate-400">Orders</span>
                    <span className="font-mono font-black text-white">
                      {cat.orderCount}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-2">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Top Items
                  </p>
                  {cat.topItems.length === 0 ? (
                    <p className="text-[11px] italic text-slate-500">
                      No sales yet
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {cat.topItems.slice(0, 3).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-slate-300">
                            {item.name}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] font-black text-orange-400">
                            {item.quantity}× (₹{Math.round(item.revenue)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPromoCodes = () => (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25 ring-1 ring-white/10"
            >
              <Tag size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white sm:text-lg">
                Promo Codes Management
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Create and monitor promotional coupons
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPromoForm({
                code: "",
                discountType: "percentage",
                discountValue: 15,
                minOrderValue: 199,
                maxDiscountCap: 100,
                usageLimitTotal: 100,
                usageLimitPerUser: 1,
                active: true,
                expiryDate: "",
                description: "",
              });
              setShowEditPromoModal(null);
              setShowAddPromoModal(true);
            }}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
          >
            <Plus size={15} strokeWidth={3} aria-hidden="true" /> Create Promo
          </button>
        </div>
      </div>

      {promoCodes.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
            <Tag size={36} className="text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-400">
            No promo codes yet
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Create your first discount offer
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promoCodes.map((p) => {
            const isExpired =
              !!p.expiryDate && new Date(p.expiryDate).getTime() < Date.now();
            const isExhausted = p.usageLimitTotal
              ? (p.usageCount || 0) >= p.usageLimitTotal
              : false;
            const isLive = p.active && !isExpired && !isExhausted;
            const stateLabel = isLive
              ? "Live"
              : isExpired
              ? "Expired"
              : isExhausted
              ? "Limit hit"
              : "Inactive";

            return (
              <div
                key={p.id}
                className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl transition hover:border-white/10"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl"
                />

                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 font-mono text-base font-black text-white">
                        {p.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                          isLive
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                            : "bg-red-500/15 text-red-300 ring-red-500/30"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    {p.description && (
                      <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-slate-400">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconAction
                      onClick={() => {
                        setShowEditPromoModal(p);
                        setPromoForm({
                          code: p.code,
                          discountType: p.discountType,
                          discountValue: p.discountValue,
                          minOrderValue: p.minOrderValue,
                          maxDiscountCap: p.maxDiscountCap,
                          usageLimitTotal: p.usageLimitTotal,
                          usageLimitPerUser: p.usageLimitPerUser,
                          active: p.active,
                          expiryDate: p.expiryDate,
                          description: p.description,
                        });
                        setShowAddPromoModal(true);
                      }}
                      title="Edit"
                    >
                      <Edit size={13} />
                    </IconAction>
                    <IconAction
                      onClick={() => deletePromoCode(p.id, p.code)}
                      title="Delete"
                      variant="danger"
                    >
                      <Trash2 size={13} />
                    </IconAction>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <RuleTile
                    label="Discount"
                    value={
                      p.discountType === "percentage"
                        ? `${p.discountValue}% off`
                        : `₹${p.discountValue} flat`
                    }
                    accent="orange"
                  />
                  <RuleTile
                    label="Min Order"
                    value={`₹${p.minOrderValue || 0}`}
                    accent="slate"
                  />
                  <RuleTile
                    label="Max Cap"
                    value={p.maxDiscountCap ? `₹${p.maxDiscountCap}` : "None"}
                    accent="slate"
                  />
                  <RuleTile
                    label="Uses"
                    value={`${p.usageCount || 0} / ${p.usageLimitTotal || "∞"}`}
                    accent="emerald"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] font-bold text-slate-500">
                    Expires:{" "}
                    {p.expiryDate
                      ? formatISTDateShort(p.expiryDate)
                      : "Never"}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePromoActive(p.id, p.active)}
                    aria-pressed={p.active}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 transition hover:text-white"
                  >
                    {p.active ? (
                      <ToggleRight className="text-emerald-400" size={22} />
                    ) : (
                      <ToggleLeft className="text-slate-500" size={22} />
                    )}
                    {p.active ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <History
            size={15}
            className="text-orange-400"
            aria-hidden="true"
          />
          <h3 className="text-sm font-black text-white">
            Redemption Audit Log
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label="Promo usage">
            <thead className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th scope="col" className="py-2.5 pr-3">
                  Promo
                </th>
                <th scope="col" className="py-2.5 pr-3">
                  Order
                </th>
                <th scope="col" className="py-2.5 pr-3">
                  User
                </th>
                <th scope="col" className="py-2.5 pr-3">
                  Discount
                </th>
                <th scope="col" className="py-2.5">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {promoUsageLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-slate-500"
                  >
                    No redemption records yet.
                  </td>
                </tr>
              ) : (
                promoUsageLogs.slice(0, 15).map((log) => (
                  <tr
                    key={log.id}
                    className="text-slate-300 transition hover:bg-white/5"
                  >
                    <td className="py-2.5 pr-3 font-mono font-black text-orange-400">
                      {log.code}
                    </td>
                    <td className="py-2.5 pr-3 font-bold text-white">
                      {log.orderNumber}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-400">
                      {log.userId}
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-black text-emerald-400">
                      ₹{log.discountApplied}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {formatISTDate(log.usedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDbReset = () => (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950/50 via-red-900/20 to-slate-900/60 p-6 backdrop-blur-xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/20 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30"
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-white sm:text-lg">
              Database Reset to Zero
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-red-200/80">
              Purges all transactional data (past orders, invoices, promo
              redemption logs) back to zero. Product catalog, categories,
              store settings, and passwords are preserved.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-6 backdrop-blur-xl">
        <SectionHeader
          icon={<ShieldCheck size={18} />}
          title="Automated Safeguards"
          subtitle="Multiple layers of protection before deletion"
        />
        <ul className="space-y-3 text-xs">
          {[
            "Automatic pre-wipe backup to backups collection before any deletion",
            "Selective purge — only orders & promoUsage are cleared",
            "Explicit confirmation phrase requirement",
            "Full audit logging with date, time, and operator info",
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span className="text-slate-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-6 backdrop-blur-xl">
        <SectionHeader
          icon={<Key size={18} />}
          title="Execute Reset"
          subtitle="Type the exact phrase to unlock"
        />

        <div className="mb-4">
          <p className="mb-2 select-all rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[11px] font-black text-amber-300">
            CONFIRM-RESET-TRANSACTIONS-ZERO
          </p>
          <label htmlFor="reset-confirm" className="sr-only">
            Confirmation phrase
          </label>
          <input
            id="reset-confirm"
            type="text"
            placeholder="Type the phrase above…"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            className="w-full rounded-xl border border-white/5 bg-slate-800/70 px-4 py-3 font-mono text-xs font-semibold text-white placeholder-slate-500 transition focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {resetMessage && (
          <div
            role="status"
            className={`mb-4 rounded-xl p-3.5 text-xs font-bold ${
              resetMessage.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {resetMessage.text}
          </div>
        )}

        <button
          type="button"
          disabled={
            resetConfirmText !== "CONFIRM-RESET-TRANSACTIONS-ZERO" ||
            isResettingDb
          }
          onClick={handleExecuteDatabaseReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-xs font-black text-white shadow-lg shadow-red-600/30 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isResettingDb ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />{" "}
              Executing Reset…
            </>
          ) : (
            <>
              <AlertTriangle size={15} aria-hidden="true" /> Execute Reset to
              Zero
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSettings = () => {
    const handleChange = (key: keyof GeneralSettings, value: unknown) =>
      setSettings((prev) => ({ ...prev, [key]: value }));

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Store size={18} />}
            title="Store Profile"
            subtitle="Brand info and operating hours"
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="set-brand" className={labelCls}>
                Brand Name
              </label>
              <input
                id="set-brand"
                type="text"
                className={inputCls}
                value={settings.cafeName}
                onChange={(e) => handleChange("cafeName", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-phone" className={labelCls}>
                Order Hotline
              </label>
              <input
                id="set-phone"
                type="text"
                className={inputCls}
                value={settings.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="set-address" className={labelCls}>
                Address
              </label>
              <input
                id="set-address"
                type="text"
                className={inputCls}
                value={settings.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-open" className={labelCls}>
                Opening Time
              </label>
              <input
                id="set-open"
                type="time"
                className={inputCls}
                value={settings.openTime}
                onChange={(e) => handleChange("openTime", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="set-close" className={labelCls}>
                Closing Time
              </label>
              <input
                id="set-close"
                type="time"
                className={inputCls}
                value={settings.closeTime}
                onChange={(e) => handleChange("closeTime", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader icon={<Receipt size={18} />} title="Packing Charges" subtitle="Set an optional per-item packing charge by product category for delivery orders only" />
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div><p className="text-xs font-black text-white">Enable packing charges</p><p className="mt-0.5 text-[11px] text-slate-400">Charges are calculated by category for delivery orders only.</p></div>
            <button type="button" onClick={() => handleChange("packingChargesEnabled", !settings.packingChargesEnabled)} aria-pressed={settings.packingChargesEnabled}>{settings.packingChargesEnabled ? <ToggleRight className="text-orange-500" size={32} /> : <ToggleLeft className="text-slate-500" size={32} />}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.filter((category) => category.enabled).map((category) => <label key={category.id} className="text-xs font-bold text-slate-300">{category.name}<div className="mt-1 flex items-center gap-2"><span className="text-slate-500">₹</span><input type="number" min="0" step="0.5" disabled={!settings.packingChargesEnabled} value={settings.packingChargeByCategory?.[category.name] ?? 0} onChange={(event) => handleChange("packingChargeByCategory", { ...(settings.packingChargeByCategory || {}), [category.name]: Math.max(0, safeNumber(event.target.value)) })} className={inputCls} /></div></label>)}
            {categories.filter((category) => category.enabled).length === 0 && <p className="text-xs text-slate-500">Add enabled product categories to configure charges.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader icon={<Sparkles size={18} />} title="Loyalty Rewards" subtitle="Configure points and reward offers for customers" />
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div><p className="text-xs font-black text-white">Enable loyalty points</p><p className="mt-0.5 text-[11px] text-slate-400">Customers earn points on paid online orders and can redeem active offers.</p></div>
            <button type="button" onClick={() => handleChange("loyaltyEnabled", !settings.loyaltyEnabled)} aria-pressed={settings.loyaltyEnabled}>{settings.loyaltyEnabled ? <ToggleRight className="text-orange-500" size={32} /> : <ToggleLeft className="text-slate-500" size={32} />}</button>
          </div>
          <label className="block max-w-sm text-xs font-bold text-slate-300">Points earned per ₹1 paid<input type="number" min="0" step="0.1" disabled={!settings.loyaltyEnabled} value={settings.loyaltyPointsPerCurrency ?? 1} onChange={(event) => handleChange("loyaltyPointsPerCurrency", Math.max(0, safeNumber(event.target.value)))} className={`${inputCls} mt-1`} /></label>
          <p className="mt-3 text-xs text-slate-400">Customers earn points when they place paid online orders and redeem active offers at checkout.</p>
          <LoyaltyRewardsManager />
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Truck size={18} />}
            title="Delivery Hub & Radius"
            subtitle="Configure logistics and coverage"
          />

          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-white">
                Enable Home Delivery
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Show delivery option at customer checkout
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleChange("deliveryEnabled", !settings.deliveryEnabled)
              }
              aria-pressed={settings.deliveryEnabled}
              className="shrink-0"
            >
              {settings.deliveryEnabled ? (
                <ToggleRight className="text-orange-500" size={32} />
              ) : (
                <ToggleLeft className="text-slate-500" size={32} />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="set-lat" className={labelCls}>
                Hub Latitude
              </label>
              <input
                id="set-lat"
                type="number"
                step="0.0000001"
                className={inputCls}
                value={settings.cafeLat}
                disabled={!settings.deliveryEnabled}
                onChange={(e) =>
                  handleChange("cafeLat", safeNumber(e.target.value))
                }
              />
              <p className="mt-1.5 font-mono text-[10px] font-bold text-slate-500">
                UCER: 25.3409769
              </p>
            </div>
            <div>
              <label htmlFor="set-lng" className={labelCls}>
                Hub Longitude
              </label>
              <input
                id="set-lng"
                type="number"
                step="0.0000001"
                className={inputCls}
                value={settings.cafeLng}
                disabled={!settings.deliveryEnabled}
                onChange={(e) =>
                  handleChange("cafeLng", safeNumber(e.target.value))
                }
              />
              <p className="mt-1.5 font-mono text-[10px] font-bold text-slate-500">
                UCER: 81.9116436
              </p>
            </div>
            <div>
              <label htmlFor="set-radius" className={labelCls}>
                Delivery Radius (km)
              </label>
              <input
                id="set-radius"
                type="number"
                step="0.5"
                min="0"
                className={inputCls}
                value={settings.deliveryRadiusKm}
                disabled={!settings.deliveryEnabled}
                onChange={(e) =>
                  handleChange("deliveryRadiusKm", safeNumber(e.target.value))
                }
              />
            </div>
            <div>
              <label htmlFor="set-base-fee" className={labelCls}>
                Base Fee (₹)
              </label>
              <input
                id="set-base-fee"
                type="number"
                min="0"
                className={inputCls}
                value={settings.baseDeliveryFee}
                disabled={!settings.deliveryEnabled}
                onChange={(e) =>
                  handleChange("baseDeliveryFee", safeNumber(e.target.value))
                }
              />
            </div>
            <div>
              <label htmlFor="set-free-threshold" className={labelCls}>
                Free Delivery Above (₹)
              </label>
              <input
                id="set-free-threshold"
                type="number"
                min="0"
                className={inputCls}
                value={settings.freeDeliveryThreshold}
                disabled={!settings.deliveryEnabled}
                onChange={(e) =>
                  handleChange(
                    "freeDeliveryThreshold",
                    safeNumber(e.target.value)
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Flame size={18} />}
            title="Trending Section"
            subtitle="Control customer menu trending carousel"
            action={
              trendingSaveMsg ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  ✓ {trendingSaveMsg}
                </span>
              ) : undefined
            }
          />

          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-white">
                Enable Trending Now
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Show carousel at top of customer menu
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                queueTrendingSave({
                  ...trendingSettings,
                  enabled: !trendingSettings.enabled,
                })
              }
              aria-pressed={trendingSettings.enabled}
              className="shrink-0"
            >
              {trendingSettings.enabled ? (
                <ToggleRight className="text-orange-500" size={32} />
              ) : (
                <ToggleLeft className="text-slate-500" size={32} />
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="set-trending-mode" className={labelCls}>
                Calculation Mode
              </label>
              <select
                id="set-trending-mode"
                className={inputCls}
                value={trendingSettings.mode}
                onChange={(e) =>
                  queueTrendingSave({
                    ...trendingSettings,
                    mode: e.target.value as "auto" | "manual",
                  })
                }
              >
                <option value="auto">Automatic (from real orders)</option>
                <option value="manual">Manual (curated)</option>
              </select>
            </div>
            <div>
              <label htmlFor="set-trending-max" className={labelCls}>
                Max Items
              </label>
              <input
                id="set-trending-max"
                type="number"
                min="2"
                max="12"
                className={inputCls}
                value={trendingSettings.maxItems || 6}
                onChange={(e) =>
                  queueTrendingSave({
                    ...trendingSettings,
                    maxItems: Math.max(
                      2,
                      Math.min(12, parseInt(e.target.value) || 6)
                    ),
                  })
                }
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={updateSettings}
          className="mx-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
        >
          <Save size={16} aria-hidden="true" /> Save All Settings
        </button>
      </div>
    );
  };

  const renderPanelAccess = () => {
    const panelConfigs: {
      key: PanelKey;
      title: string;
      route: string;
      icon: LucideIcon;
      desc: string;
      gradient: string;
    }[] = [
      {
        key: "admin",
        title: "Admin Management Portal",
        route: "/admin",
        icon: ShieldCheck,
        desc: "Main operations, revenue analytics, menu, and settings.",
        gradient: "from-orange-500 to-amber-500",
      },
      {
        key: "kitchen",
        title: "Kitchen Station Display",
        route: "/kitchen",
        icon: ChefHat,
        desc: "Live order queue, KOT receipts, prep timers, and dispatch.",
        gradient: "from-amber-500 to-yellow-500",
      },
      {
        key: "counter",
        title: "Counter POS & Cashier",
        route: "/counter",
        icon: Store,
        desc: "Quick billing, thermal receipt printing, customer linking.",
        gradient: "from-blue-500 to-indigo-500",
      },
      {
        key: "delivery",
        title: "Delivery Fleet Portal",
        route: "/delivery",
        icon: Truck,
        desc: "GPS rider tracking, OTP verification, and order completion.",
        gradient: "from-emerald-500 to-teal-500",
      },
    ];

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111827] p-5 backdrop-blur-xl sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/10"
              >
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-white sm:text-lg">
                  Panel Access & Security
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  Manage access to all operational dashboards
                </p>
              </div>
            </div>
            {panelSaveMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-black text-emerald-300">
                ✓ {panelSaveMsg}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
              >
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    Centralized Developer &amp; Multi-Outlet Platform
                  </h3>
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-indigo-300">
                    Cross-Branch
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Manage multiple restaurant outlets, kitchens, counters,
                  delivery fleets, RBAC roles, and audit trails.
                </p>
              </div>
            </div>

            <Link
              href="/developer"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.02] active:scale-95"
            >
              Open Developer Hub →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {panelConfigs.map((item) => {
            const config =
              panelAccess[item.key] || DEFAULT_PANEL_CONFIGS[item.key];
            const Icon = item.icon;
            const isEnabled = config.enabled !== false;
            const showPin = showPinMap[item.key] || false;

            return (
              <div
                key={item.key}
                className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl transition ${
                  isEnabled
                    ? "border-white/5 bg-slate-900/60"
                    : "border-red-900/40 bg-red-950/20"
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden="true"
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg ring-1 ring-white/10 ${
                        isEnabled
                          ? `bg-gradient-to-br ${item.gradient}`
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-white">
                        {item.title}
                      </h3>
                      <p className="truncate font-mono text-[10px] font-bold text-slate-500">
                        {item.route}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ring-1 ${
                      isEnabled
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                        : "bg-red-500/15 text-red-300 ring-red-500/30"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        isEnabled
                          ? "animate-pulse bg-emerald-400"
                          : "bg-red-500"
                      }`}
                    />
                    {isEnabled ? "Active" : "Disabled"}
                  </span>
                </div>

                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  {item.desc}
                </p>

                <button
                  type="button"
                  onClick={() => handleTogglePanel(item.key)}
                  className={`mb-4 w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
                    isEnabled
                      ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  {isEnabled ? "Disable Access" : "Enable Access"}
                </button>

                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Key size={11} className="text-orange-400" aria-hidden="true" />{" "}
                      Current PIN
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="max-w-[140px] truncate rounded-lg border border-white/5 bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-black text-amber-300">
                        {showPin ? "•••• (hashed)" : "••••••••"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setShowPinMap((prev) => ({
                            ...prev,
                            [item.key]: !showPin,
                          }))
                        }
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 transition hover:text-white"
                      >
                        {showPin ? "Hide" : "Reveal"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <label
                      htmlFor={`pin-input-${item.key}`}
                      className="sr-only"
                    >
                      New PIN
                    </label>
                    <input
                      id={`pin-input-${item.key}`}
                      type="password"
                      autoComplete="new-password"
                      placeholder="New PIN (min 4 chars)…"
                      value={panelPinInputs[item.key] || ""}
                      onChange={(e) =>
                        setPanelPinInputs((prev) => ({
                          ...prev,
                          [item.key]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-xl border border-white/5 bg-slate-800/70 px-3 py-2 font-mono text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdatePanelPin(item.key)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ============================================================= */
  /* Nav                                                          */
  /* ============================================================= */

  const activeOrdersCount = useMemo(
    () =>
      orders.filter((o) => {
        const k = getStatusKey(o);
        return k === "preparing" || k === "ready";
      }).length,
    [orders]
  );
  const kitchenActiveCount = useMemo(
    () =>
      orders.filter((o) => {
        const k = getStatusKey(o);
        return k === "pending" || k === "preparing";
      }).length,
    [orders]
  );

  const navItems = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, badge: 0 },
      {
        id: "kitchen",
        label: "Kitchen Orders",
        icon: ChefHat,
        badge: kitchenActiveCount,
      },
      {
        id: "liveOrders",
        label: "Live Orders",
        icon: ShoppingBag,
        badge: activeOrdersCount,
      },
      { id: "menu", label: "Menu Items", icon: Utensils, badge: 0 },
      { id: "categories", label: "Categories", icon: Layers, badge: 0 },
      { id: "history", label: "Order History", icon: History, badge: 0 },
      { id: "attendance", label: "Staff Attendance", icon: Clock, badge: 0 },
      { id: "sales", label: "Sales Analytics", icon: BarChart3, badge: 0 },
      { id: "promoCodes", label: "Promo Codes", icon: Tag, badge: 0 },
      {
        id: "panelAccess",
        label: "Panel Access",
        icon: ShieldCheck,
        badge: 0,
      },
      {
        id: "dbReset",
        label: "Database Reset",
        icon: AlertTriangle,
        badge: 0,
      },
      { id: "settings", label: "Settings", icon: Settings, badge: 0 },
    ],
    [kitchenActiveCount, activeOrdersCount]
  );

  const tabTitle: Record<string, string> = {
    dashboard: "Operations Overview",
    kitchen: "Kitchen Orders Management",
    liveOrders: "Live Orders Dispatch",
    menu: "Menu Management",
    categories: "Categories & Subcategories",
    history: "Order History Archive",
    attendance: "Staff Attendance",
    sales: "Sales & Revenue Analytics",
    promoCodes: "Discounts & Promo Codes",
    panelAccess: "Panel Access & Security",
    dbReset: "Database Reset",
    settings: "Store Settings",
  };

  /* ============================================================= */
  /* Login gate                                                   */
  /* ============================================================= */

  if (isVerifyingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2
          size={32}
          className="animate-spin text-orange-500"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <StaffLoginForm
        panel="admin"
        panelDisplayName="Admin Operations Panel"
        panelIcon={<ShieldCheck size={28} />}
        onSuccess={(session: unknown) => {
          setStaffSession((session as StaffSession) || null);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  /* ============================================================= */
  /* Render                                                       */
  /* ============================================================= */

  return (
    <div className="admin-portal flex min-h-screen flex-col overflow-hidden bg-[#090d15] text-slate-100 lg:flex-row">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {/* SIDEBAR */}
      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col justify-between border-r border-white/[0.07] bg-[#0e1420] p-4 backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl shadow-lg shadow-orange-950/50 ring-1 ring-orange-200/20"
              >
                🍕
              </div>
              <div>
                <h1 className="text-sm font-black leading-tight text-white">
                  EL PRESTO
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                  Admin Panel
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation"
              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 transition hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/5 bg-slate-800/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Kitchen
              </p>
              <p className="mt-0.5 font-mono text-lg font-black text-orange-400">
                {kitchenActiveCount}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-800/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Live
              </p>
              <p className="mt-0.5 font-mono text-lg font-black text-emerald-400">
                {activeOrdersCount}
              </p>
            </div>
          </div>

          <nav aria-label="Admin sections" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.2)_transparent]">
            {navItems.map((tab) => {
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
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-orange-500/[0.14] text-orange-200 ring-1 ring-inset ring-orange-400/20"
                      : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-orange-500/20 text-orange-400"
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

        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
              />
              Live
            </span>
            <span className="font-mono">UCER</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-black text-red-400 transition hover:bg-red-500/20"
          >
            <LogOut size={14} aria-hidden="true" /> Sign Out
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[4.25rem] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0c111b]/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400 transition hover:text-white lg:hidden"
            >
              <MenuIcon size={16} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                {tabTitle[activeTab] || activeTab}
              </h2>
              <p className="hidden truncate text-[10px] font-black uppercase tracking-widest text-slate-500 sm:block">
                Live Store Operations
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 sm:flex">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
              />
              Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeControl />
            <button
              type="button"
              onClick={() => {
                const next = !settings.soundEnabled;
                setSettings((p) => ({ ...p, soundEnabled: next }));
                soundEnabledRef.current = next;
                if (next) playNotificationSound();
              }}
              aria-label={
                settings.soundEnabled ? "Mute alerts" : "Enable alerts"
              }
              aria-pressed={settings.soundEnabled}
              className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                settings.soundEnabled
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/5 bg-slate-800 text-slate-500"
              }`}
              title="Sound notifications"
            >
              {settings.soundEnabled ? (
                <Bell size={15} />
              ) : (
                <BellOff size={15} />
              )}
            </button>

            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-200 transition hover:bg-slate-700 sm:flex"
            >
              View Site <ExternalLink size={11} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 xl:p-8">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "kitchen" && renderKitchenOrders()}
          {activeTab === "liveOrders" && renderLiveOrders()}
          {activeTab === "menu" && renderMenuManagement()}
          {activeTab === "categories" && renderCategoryManagement()}
          {activeTab === "history" && renderOrderHistory()}
          {activeTab === "attendance" && <AttendancePanel token={staffSession?.token} role={staffSession?.role} />}
          {activeTab === "sales" && renderSalesReports()}
          {activeTab === "panelAccess" && renderPanelAccess()}
          {activeTab === "promoCodes" && renderPromoCodes()}
          {activeTab === "dbReset" && renderDbReset()}
          {activeTab === "settings" && renderSettings()}
        </main>
      </div>

      {/* MODALS */}
      <Modal
        isOpen={showAddPromoModal}
        onClose={() => {
          setShowAddPromoModal(false);
          setShowEditPromoModal(null);
        }}
        title={showEditPromoModal ? "Edit Promo Code" : "Create Promo Code"}
      >
        <form onSubmit={savePromoCode} className="space-y-4">
          <div>
            <label htmlFor="promo-code" className={labelCls}>
              Promo Code *
            </label>
            <input
              id="promo-code"
              type="text"
              required
              placeholder="e.g. PRESTO50"
              value={promoForm.code || ""}
              onChange={(e) =>
                setPromoForm({
                  ...promoForm,
                  code: e.target.value.toUpperCase(),
                })
              }
              className={`${inputCls} font-mono font-black`}
            />
          </div>

          <div>
            <label htmlFor="promo-desc" className={labelCls}>
              Description
            </label>
            <input
              id="promo-desc"
              type="text"
              placeholder="e.g. 15% off above ₹199"
              value={promoForm.description || ""}
              onChange={(e) =>
                setPromoForm({ ...promoForm, description: e.target.value })
              }
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="promo-type" className={labelCls}>
                Type *
              </label>
              <select
                id="promo-type"
                value={promoForm.discountType || "percentage"}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    discountType: e.target.value as "percentage" | "flat",
                  })
                }
                className={inputCls}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label htmlFor="promo-value" className={labelCls}>
                Value *
              </label>
              <input
                id="promo-value"
                type="number"
                required
                min="1"
                max={
                  promoForm.discountType === "percentage" ? 100 : undefined
                }
                value={promoForm.discountValue || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    discountValue: safeNumber(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="promo-min" className={labelCls}>
                Min Order (₹)
              </label>
              <input
                id="promo-min"
                type="number"
                min="0"
                value={promoForm.minOrderValue || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    minOrderValue: safeNumber(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="promo-cap" className={labelCls}>
                Max Cap (₹)
              </label>
              <input
                id="promo-cap"
                type="number"
                min="0"
                value={promoForm.maxDiscountCap || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    maxDiscountCap: safeNumber(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="promo-total" className={labelCls}>
                Total Uses
              </label>
              <input
                id="promo-total"
                type="number"
                min="1"
                value={promoForm.usageLimitTotal || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    usageLimitTotal: safeNumber(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="promo-per-user" className={labelCls}>
                Per User
              </label>
              <input
                id="promo-per-user"
                type="number"
                min="1"
                value={promoForm.usageLimitPerUser || 1}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    usageLimitPerUser: Math.max(
                      1,
                      safeNumber(e.target.value, 1)
                    ),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="promo-expiry" className={labelCls}>
                Expiry Date
              </label>
              <input
                id="promo-expiry"
                type="date"
                value={promoForm.expiryDate || ""}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, expiryDate: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="promo-active" className={labelCls}>
                Status
              </label>
              <select
                id="promo-active"
                value={promoForm.active ? "true" : "false"}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    active: e.target.value === "true",
                  })
                }
                className={inputCls}
              >
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => {
                setShowAddPromoModal(false);
                setShowEditPromoModal(null);
              }}
              className="rounded-xl px-4 py-2 text-xs font-black text-slate-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
            >
              Save Promo
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        title="Add Category"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") || "");
            if (name.trim()) {
              await addCategory(name);
              setShowAddCategoryModal(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="cat-name" className={labelCls}>
              Category name
            </label>
            <input
              id="cat-name"
              name="name"
              className={inputCls}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white transition hover:scale-[1.01] active:scale-95"
          >
            Create Category
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={!!showEditCategoryModal}
        onClose={() => setShowEditCategoryModal(null)}
        title="Rename Category"
      >
        {showEditCategoryModal && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") || "").trim();
              if (name && name !== showEditCategoryModal.name) {
                editCategory(showEditCategoryModal.id, name);
                setShowEditCategoryModal(null);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="cat-edit-name" className={labelCls}>
                New name
              </label>
              <input
                id="cat-edit-name"
                name="name"
                defaultValue={showEditCategoryModal.name}
                className={inputCls}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white transition hover:scale-[1.01] active:scale-95"
            >
              Rename Category
            </button>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={showAddMenuItemModal}
        onClose={() => setShowAddMenuItemModal(false)}
        title="Add Menu Product"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") || "").trim();
            const price = safeNumber(fd.get("price"));
            const category = modalCategory;
            const subcategory = isCustomSubcategory
              ? customSubcategoryText.trim()
              : modalSubcategory;
            if (!name) {
              pushToast("error", "Product name is required.");
              return;
            }
            if (price < 0) {
              pushToast("error", "Enter a valid price.");
              return;
            }
            if (!category || !subcategory) {
              pushToast("error", "Select category & subcategory.");
              return;
            }
            const saved = await addMenuItem({
              name,
              category,
              subcategory,
              price,
              description: String(fd.get("description") || "").trim(),
              ...readMenuRecipeForm(fd),
              imageUrl:
                String(fd.get("image") || "").trim() ||
                "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
              available: true,
              isVeg: fd.get("isVeg") === "on",
            });
            if (saved) setShowAddMenuItemModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="mi-name" className={labelCls}>
              Product Name *
            </label>
            <input
              id="mi-name"
              name="name"
              placeholder="e.g. Farmhouse Pizza"
              className={inputCls}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="mi-cat" className={labelCls}>
                Category *
              </label>
              <select
                id="mi-cat"
                value={modalCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setModalCategory(newCat);
                  const found = activeCategoriesList.find(
                    (c) => c.name === newCat
                  );
                  setModalSubcategory(
                    found?.subcategories?.[0]?.name || "General"
                  );
                  setIsCustomSubcategory(false);
                }}
                className={inputCls}
                required
              >
                {activeCategoriesList.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mi-sub" className={labelCls}>
                Subcategory *
              </label>
              <select
                id="mi-sub"
                value={isCustomSubcategory ? "__custom__" : modalSubcategory}
                onChange={(e) => {
                  if (e.target.value === "__custom__")
                    setIsCustomSubcategory(true);
                  else {
                    setIsCustomSubcategory(false);
                    setModalSubcategory(e.target.value);
                  }
                }}
                className={inputCls}
                required
              >
                {(
                  activeCategoriesList.find((c) => c.name === modalCategory)
                    ?.subcategories || []
                ).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom…</option>
              </select>
            </div>
          </div>

          {isCustomSubcategory && (
            <div>
              <label htmlFor="mi-custom-sub" className={labelCls}>
                New Subcategory Name *
              </label>
              <input
                id="mi-custom-sub"
                type="text"
                placeholder="e.g. Waffles"
                value={customSubcategoryText}
                onChange={(e) => setCustomSubcategoryText(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="mi-price" className={labelCls}>
                Price (₹) *
              </label>
              <input
                id="mi-price"
                name="price"
                type="number"
                step="1"
                min="0"
                placeholder="Price"
                className={inputCls}
                required
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  name="isVeg"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="flex items-center gap-1 text-xs font-black text-emerald-400">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-emerald-500"
                  />{" "}
                  Pure Veg
                </span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="mi-desc" className={labelCls}>
              Description
            </label>
            <textarea
              id="mi-desc"
              name="description"
              placeholder="Ingredients, toppings, base…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          <MenuRecipeEditor idPrefix="mi" />

          <div>
            <label htmlFor="mi-image" className={labelCls}>
              Image URL
            </label>
            <input
              id="mi-image"
              name="image"
              placeholder="https://… (leave blank for default)"
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => setShowAddMenuItemModal(false)}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingMenuItem}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              {isSavingMenuItem ? "Saving…" : "Save Product"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!showEditMenuItemModal}
        onClose={() => setShowEditMenuItemModal(null)}
        title="Edit Menu Product"
      >
        {showEditMenuItemModal && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get("name") || "").trim();
              const price = safeNumber(fd.get("price"));
              const category = modalCategory;
              const subcategory = isCustomSubcategory
                ? customSubcategoryText.trim()
                : modalSubcategory;
              if (!name) {
                pushToast("error", "Product name is required.");
                return;
              }
              const saved = await editMenuItem(showEditMenuItemModal.id, {
                name,
                category,
                subcategory,
                price,
                description: String(fd.get("description") || "").trim(),
                ...readMenuRecipeForm(fd),
                imageUrl:
                  String(fd.get("image") || "").trim() ||
                  showEditMenuItemModal.imageUrl ||
                  "",
                available: fd.get("available") === "on",
                isVeg: fd.get("isVeg") === "on",
              });
              if (saved) setShowEditMenuItemModal(null);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="mei-name" className={labelCls}>
                Product Name *
              </label>
              <input
                id="mei-name"
                name="name"
                defaultValue={showEditMenuItemModal.name}
                className={inputCls}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="mei-cat" className={labelCls}>
                  Category *
                </label>
                <select
                  id="mei-cat"
                  value={modalCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setModalCategory(newCat);
                    const found = activeCategoriesList.find(
                      (c) => c.name === newCat
                    );
                    setModalSubcategory(
                      found?.subcategories?.[0]?.name || "General"
                    );
                    setIsCustomSubcategory(false);
                  }}
                  className={inputCls}
                  required
                >
                  {activeCategoriesList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mei-sub" className={labelCls}>
                  Subcategory *
                </label>
                <select
                  id="mei-sub"
                  value={
                    isCustomSubcategory ? "__custom__" : modalSubcategory
                  }
                  onChange={(e) => {
                    if (e.target.value === "__custom__")
                      setIsCustomSubcategory(true);
                    else {
                      setIsCustomSubcategory(false);
                      setModalSubcategory(e.target.value);
                    }
                  }}
                  className={inputCls}
                  required
                >
                  {(
                    activeCategoriesList.find((c) => c.name === modalCategory)
                      ?.subcategories || []
                  ).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Add Custom…</option>
                </select>
              </div>
            </div>

            {isCustomSubcategory && (
              <div>
                <label htmlFor="mei-custom-sub" className={labelCls}>
                  New Subcategory Name *
                </label>
                <input
                  id="mei-custom-sub"
                  type="text"
                  value={customSubcategoryText}
                  onChange={(e) => setCustomSubcategoryText(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="mei-price" className={labelCls}>
                  Price (₹) *
                </label>
                <input
                  id="mei-price"
                  name="price"
                  type="number"
                  min="0"
                  defaultValue={showEditMenuItemModal.price}
                  className={inputCls}
                  required
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    name="available"
                    type="checkbox"
                    defaultChecked={showEditMenuItemModal.available !== false}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs font-black text-white">
                    In Stock
                  </span>
                </label>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    name="isVeg"
                    type="checkbox"
                    defaultChecked={showEditMenuItemModal.isVeg !== false}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="flex items-center gap-1 text-xs font-black text-emerald-400">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-emerald-500"
                    />{" "}
                    Veg
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="mei-desc" className={labelCls}>
                Description
              </label>
              <textarea
                id="mei-desc"
                name="description"
                defaultValue={showEditMenuItemModal.description || ""}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            <MenuRecipeEditor idPrefix="mei" item={showEditMenuItemModal} />

            <div>
              <label htmlFor="mei-image" className={labelCls}>
                Image URL
              </label>
              <input
                id="mei-image"
                name="image"
                defaultValue={showEditMenuItemModal.imageUrl || ""}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setShowEditMenuItemModal(null)}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingMenuItem}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95 disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingMenuItem ? "Saving…" : "Update Product"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!showAddSubModal}
        onClose={() => setShowAddSubModal(null)}
        title={`Add Subcategory to ${showAddSubModal?.name || "Category"}`}
      >
        {showAddSubModal && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (newSubNameInput.trim()) {
                await addSubcategoryToCategory(
                  showAddSubModal.id,
                  newSubNameInput
                );
                setShowAddSubModal(null);
                setNewSubNameInput("");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="new-sub-name" className={labelCls}>
                Subcategory Name
              </label>
              <input
                id="new-sub-name"
                type="text"
                placeholder="e.g. Pasta, Wraps…"
                value={newSubNameInput}
                onChange={(e) => setNewSubNameInput(e.target.value)}
                className={inputCls}
                autoFocus
                required
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setShowAddSubModal(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-black text-slate-300 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!showOrderDetailsModal}
        onClose={() => setShowOrderDetailsModal(null)}
        title="Order Details"
      >
        {showOrderDetailsModal && (
          <div className="space-y-4 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <span className="font-mono text-base font-black text-white">
                {showOrderDetailsModal.orderNumber}
              </span>
              <StatusChip status={getStatusKey(showOrderDetailsModal)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Customer
                </p>
                <p className="mt-1 truncate font-black text-white">
                  {showOrderDetailsModal.customerName}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Phone
                </p>
                <p className="mt-1 truncate font-black text-white">
                  {showOrderDetailsModal.phone ||
                    showOrderDetailsModal.customerPhone ||
                    "—"}
                </p>
              </div>
            </div>

            {showOrderDetailsModal.type === "delivery" && (
              <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-800/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-orange-400">
                    <Truck size={14} aria-hidden="true" /> Delivery Info
                  </span>
                  {showOrderDetailsModal.deliveryDistance && (
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      ~{showOrderDetailsModal.deliveryDistance} km
                    </span>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300">
                  {(typeof showOrderDetailsModal.deliveryAddress === "object" &&
                    showOrderDetailsModal.deliveryAddress?.fullAddress) ||
                    (typeof showOrderDetailsModal.location === "string"
                      ? showOrderDetailsModal.location
                      : showOrderDetailsModal.location?.address) ||
                    "Address not specified"}
                </p>

                <div>
                  <label htmlFor="delivery-status-select" className={labelCls}>
                    Delivery Status
                  </label>
                  <select
                    id="delivery-status-select"
                    className={inputCls}
                    value={
                      showOrderDetailsModal.deliveryStatus || "pending"
                    }
                    onChange={(e) =>
                      updateDeliveryStatus(
                        showOrderDetailsModal.id,
                        e.target.value
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="assign-rider-input" className={labelCls}>
                    Assign Delivery Partner
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="assign-rider-input"
                      ref={assignRiderInputRef}
                      type="text"
                      placeholder="e.g. Rahul Kumar"
                      defaultValue={
                        showOrderDetailsModal.deliveryPersonName || ""
                      }
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={handleAssignRider}
                      className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:bg-orange-600"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                {typeof showOrderDetailsModal.deliveryLatitude === "number" &&
                  typeof showOrderDetailsModal.deliveryLongitude ===
                    "number" && (
                    <div className="flex gap-2 pt-1">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${showOrderDetailsModal.deliveryLatitude},${showOrderDetailsModal.deliveryLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl bg-blue-500/15 py-2 text-center text-[11px] font-black uppercase tracking-wider text-blue-300 ring-1 ring-blue-500/30 transition hover:bg-blue-500/25"
                      >
                        Maps
                      </a>
                      <Link
                        href="/track"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl bg-orange-500/15 py-2 text-center text-[11px] font-black uppercase tracking-wider text-orange-300 ring-1 ring-orange-500/30 transition hover:bg-orange-500/25"
                      >
                        Track Map
                      </Link>
                    </div>
                  )}
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Items
              </p>
              <div className="space-y-1.5 rounded-xl border border-white/5 bg-slate-800/40 p-3">
                {(showOrderDetailsModal.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-mono font-black text-white">
                      ₹
                      {(
                        safeNumber(item.price) * (item.quantity || 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/5 pt-2 text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    ₹
                    {Math.round(
                      safeNumber(
                        showOrderDetailsModal.subtotal ??
                          showOrderDetailsModal.total
                      )
                    )}
                  </span>
                </div>
                {showOrderDetailsModal.deliveryFee ? (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Delivery Fee</span>
                    <span className="font-mono">
                      ₹{Math.round(showOrderDetailsModal.deliveryFee)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-white/5 pt-2 text-sm font-black">
                  <span className="text-white">Total</span>
                  <span className="font-mono text-emerald-400">
                    ₹{Math.round(safeNumber(showOrderDetailsModal.total))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-[11px] text-slate-400">Payment</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                        showOrderDetailsModal.paymentMethod === "online"
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                      }`}
                    >
                      {showOrderDetailsModal.paymentMethod === "online"
                        ? "📱 Online"
                        : "💵 Cash"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                        (showOrderDetailsModal.paymentStatus || "pending") ===
                        "paid"
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                      }`}
                    >
                      {(showOrderDetailsModal.paymentStatus || "pending") ===
                      "paid"
                        ? "✓ Paid"
                        : "⏳ Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {showOrderDetailsModal.instructions && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] font-bold italic text-amber-300">
                📝 {showOrderDetailsModal.instructions}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  printReceipt(showOrderDetailsModal);
                  setShowOrderDetailsModal(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs font-black text-white transition hover:bg-slate-700"
              >
                <Printer size={14} aria-hidden="true" /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setShowOrderDetailsModal(null)}
                className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-black text-slate-400 transition hover:bg-slate-700 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================= */
/* Order Card                                                    */
/* ============================================================= */

function OrderCard({
  order,
  onPrint,
  onView,
  onMarkPaid,
  onMarkReady,
  onComplete,
  onCancel,
}: {
  order: OrderRecord;
  onPrint: () => void;
  onView: () => void;
  onMarkPaid: () => void;
  onMarkReady: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const isDelivery = order.type === "delivery";
  const paid = (order.paymentStatus || "pending") === "paid";
  const status = getStatusKey(order);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111827] p-4 backdrop-blur-xl transition hover:border-white/10 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-black text-white">
              {order.orderNumber}
            </span>
            <StatusChip status={status} />
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                isDelivery
                  ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                  : "bg-slate-700/60 text-slate-300 ring-slate-600/40"
              }`}
            >
              {isDelivery ? (
                <>
                  <Truck size={10} aria-hidden="true" /> Delivery
                  {order.deliveryDistance
                    ? ` ~${order.deliveryDistance}km`
                    : ""}
                </>
              ) : (
                <>
                  <ShoppingBag size={10} aria-hidden="true" /> Pickup
                </>
              )}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                order.paymentMethod === "online"
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
              }`}
            >
              {order.paymentMethod === "online" ? "📱 Online" : "💵 Cash"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                paid
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
              }`}
            >
              {paid ? "✓ Paid" : "⏳ Pending"}
            </span>
            {isDelivery && order.deliveryStatus && (
              <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-500/30">
                Rider: {order.deliveryPersonName || "Unassigned"} ·{" "}
                {order.deliveryStatus}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-black text-white">
              👤 {order.customerName}
            </span>
            {order.phone && (
              <span className="font-semibold text-slate-400">
                📞 {order.phone}
              </span>
            )}
            <span className="font-semibold text-slate-400">
              {order.items?.length || 0} items
            </span>
            <span className="font-mono font-black text-emerald-400">
              ₹{Math.round(safeNumber(order.total))}
            </span>
          </div>

          {typeof order.deliveryAddress === "object" &&
            order.deliveryAddress?.fullAddress && (
              <p className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-400">
                <MapPin
                  size={12}
                  className="mt-0.5 shrink-0 text-orange-400"
                  aria-hidden="true"
                />
                <span className="line-clamp-1">
                  {order.deliveryAddress.fullAddress}
                </span>
              </p>
            )}

          {order.instructions && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-bold italic text-amber-300">
              📝 {order.instructions}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3 lg:border-0 lg:pt-0">
          <button
            type="button"
            onClick={onPrint}
            aria-label={`Print order ${order.orderNumber}`}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <Printer size={14} />
          </button>
          <button
            type="button"
            onClick={onView}
            aria-label={`View order ${order.orderNumber}`}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <Eye size={14} />
          </button>

          {!paid && status !== "completed" && (
            <button
              type="button"
              onClick={onMarkPaid}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/20"
            >
              Mark Paid
            </button>
          )}

          {status === "preparing" && (
            <button
              type="button"
              onClick={onMarkReady}
              className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-500"
            >
              Ready
            </button>
          )}
          {status === "ready" && (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-500"
            >
              Complete
            </button>
          )}
          {status !== "completed" && status !== "cancelled" && (
            <button
              type="button"
              onClick={onCancel}
              aria-label={`Cancel order ${order.orderNumber}`}
              className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
