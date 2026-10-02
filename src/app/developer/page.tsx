"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutDashboard,
  Building2,
  ChefHat,
  Users,
  Utensils,
  CreditCard,
  Server,
  Activity,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  ShoppingBag,
  IndianRupee,
  Bike,
  Printer,
  FileText,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
  Radio,
  ChevronRight,
  LogOut,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import ThemeControl from "@/components/ThemeControl";
import {
  Branch,
  Kitchen,
  Counter,
  DeliveryPartner,
  StaffProfile,
  Order,
} from "@/lib/types";
import {
  initDefaultBranchIfMissing,
  getAllBranches,
  DEFAULT_MAIN_BRANCH_ID,
} from "@/lib/branchService";
import {
  getActiveDelegationSession,
  stopDelegationSession,
  DelegationSession,
} from "@/lib/rbac";
import BranchManager from "@/components/Developer/BranchManager";
import OperationsManager from "@/components/Developer/OperationsManager";
import UserManager from "@/components/Developer/UserManager";
import MenuAvailabilityManager from "@/components/Developer/MenuAvailabilityManager";
import AuditLogViewer from "@/components/Developer/AuditLogViewer";
import DelegationModal from "@/components/Developer/DelegationModal";
import FleetLiveMap from "@/components/Developer/FleetLiveMap";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

/* ============================================================
   TYPES
   ============================================================ */

type StaffSessionLike = {
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
} | null;

type SectionId =
  | "dashboard"
  | "branches"
  | "operations"
  | "users"
  | "menu"
  | "fleet"
  | "payments"
  | "infrastructure"
  | "audit";

const DEFAULT_DEVELOPER_EMAIL = "developer@elpresto.co.in";
const ORDERS_LIMIT = 100;

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* ============================================================
   HELPERS
   ============================================================ */

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isPaid(order: Order): boolean {
  return String(order.paymentStatus || "").toLowerCase() === "paid";
}

function isBranchActive(branch: Branch): boolean {
  // Treat undefined as active for legacy records; only explicit false disables.
  return branch.active !== false;
}

function isRiderActive(partner: DeliveryPartner): boolean {
  return String(partner.availability || "").toUpperCase() !== "OFFLINE";
}

/**
 * Best-effort expiry check for a delegation session, tolerant of multiple
 * possible field shapes without changing the upstream type.
 */
function isDelegationSessionActive(session: DelegationSession | null): boolean {
  if (!session) return false;
  const raw = session as unknown as Record<string, unknown>;
  const candidate =
    raw.expiresAt ?? raw.expiry ?? raw.endTime ?? raw.endsAt ?? null;
  if (candidate == null) return true;

  let ts: number | null = null;
  if (typeof candidate === "number") ts = candidate;
  else if (typeof candidate === "string") {
    const parsed = Date.parse(candidate);
    ts = Number.isNaN(parsed) ? null : parsed;
  } else if (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { toMillis?: () => number }).toMillis === "function"
  ) {
    ts = (candidate as { toMillis: () => number }).toMillis();
  } else if (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { seconds?: number }).seconds === "number"
  ) {
    ts = (candidate as { seconds: number }).seconds * 1000;
  }

  if (ts == null) return true;
  // Normalize seconds-based epoch to ms.
  if (ts > 0 && ts < 1e12) ts *= 1000;
  return ts > Date.now();
}

/* ============================================================
   STATUS STYLES
   ============================================================ */

const statusStyles = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "delivered")
    return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/25";
  if (s === "cancelled")
    return "bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/25";
  if (s === "ready" || s === "assigned")
    return "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/25";
  if (s === "preparing")
    return "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/25";
  return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/25";
};

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function DeveloperDashboardPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");

  /* ---- Data ---- */
  const [branches, setBranches] = useState<Branch[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");

  /* ---- Loading / errors ---- */
  const [isBooting, setIsBooting] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /* ---- Delegation ---- */
  const [isDelegationOpen, setIsDelegationOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<DelegationSession | null>(
    null
  );
  const [isStoppingDelegation, setIsStoppingDelegation] = useState(false);

  /* ---- Auth ---- */
  const [staffSession, setStaffSession] = useState<StaffSessionLike>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  /* ---- Layout ---- */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(73);

  /* ============================================================
     DERIVED
     ============================================================ */

  const developerEmail = useMemo(() => {
    const e = staffSession?.email;
    if (typeof e === "string" && e.includes("@")) return e;
    return DEFAULT_DEVELOPER_EMAIL;
  }, [staffSession]);

  const branchMap = useMemo(() => {
    const m = new Map<string, Branch>();
    for (const b of branches) m.set(b.id, b);
    return m;
  }, [branches]);

  const filteredOrders = useMemo(() => {
    if (selectedBranchId === "ALL") return orders;
    return orders.filter(
      (o) => (o.branchId || DEFAULT_MAIN_BRANCH_ID) === selectedBranchId
    );
  }, [orders, selectedBranchId]);

  const totalRevenue = useMemo(
    () =>
      filteredOrders.reduce((sum, o) => {
        if (!isPaid(o)) return sum;
        return sum + safeNumber(o.total);
      }, 0),
    [filteredOrders]
  );

  const paidOrdersCount = useMemo(
    () => filteredOrders.filter(isPaid).length,
    [filteredOrders]
  );

  const activeOutletsCount = useMemo(
    () => branches.filter(isBranchActive).length,
    [branches]
  );

  const activeBranchObj = useMemo(
    () =>
      selectedBranchId === "ALL" ? undefined : branchMap.get(selectedBranchId),
    [branchMap, selectedBranchId]
  );

  const scopedActiveOutletsCount = useMemo(
    () =>
      selectedBranchId === "ALL"
        ? activeOutletsCount
        : Number(Boolean(activeBranchObj && isBranchActive(activeBranchObj))),
    [activeBranchObj, activeOutletsCount, selectedBranchId]
  );

  const scopedActiveRidersCount = useMemo(
    () =>
      deliveryPartners.filter(
        (partner) =>
          partner.active &&
          isRiderActive(partner) &&
          (selectedBranchId === "ALL" ||
            partner.assignedBranchId === selectedBranchId)
      ).length,
    [deliveryPartners, selectedBranchId]
  );

  /* ============================================================
     SESSION BOOTSTRAP
     ============================================================ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    import("@/lib/staffAuth")
      .then(({ getStaffSession, isSessionValid }) => {
        if (cancelled) return;
        const session = getStaffSession("developer") as StaffSessionLike;
        if (session && isSessionValid(session as never)) {
          setStaffSession(session);
          setIsUnlocked(true);
        }
      })
      .catch((err) => {
        console.warn("Failed to load staff session:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      import("@/lib/staffAuth")
        .then((mod: Record<string, unknown>) => {
          const clear =
            (mod.clearStaffSession as ((p: string) => void) | undefined) ||
            (mod.logoutStaff as ((p: string) => void) | undefined) ||
            (mod.signOutStaff as ((p: string) => void) | undefined) ||
            (mod.clearSession as ((p: string) => void) | undefined);
          try {
            if (typeof clear === "function") clear("developer");
          } catch (err) {
            console.warn("Failed to clear staff session:", err);
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
    setStaffSession(null);
    setIsUnlocked(false);
    setActiveSection("dashboard");
  }, []);

  /* Session expiry watchdog */
  useEffect(() => {
    if (!staffSession) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const check = () => {
      import("@/lib/staffAuth")
        .then(({ isSessionValid }) => {
          if (cancelled) return;
          if (!isSessionValid(staffSession as never)) {
            handleLogout();
          }
        })
        .catch(() => {
          /* ignore check failures */
        });
    };

    const id = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [staffSession, handleLogout]);

  /* ============================================================
     HEADER HEIGHT MEASUREMENT (robust sidebar offset)
     ============================================================ */

  useIsoLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight || 73);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /* ============================================================
     REALTIME DATA
     ============================================================ */

  const refreshData = useCallback(async () => {
    try {
      await initDefaultBranchIfMissing();
      const allB = await getAllBranches();
      setBranches(allB);
      setDataError(null);
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setDataError("Failed to refresh branch data.");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setActiveSession(getActiveDelegationSession());

    // Only seed default branch; do not overwrite realtime data afterwards.
    initDefaultBranchIfMissing().catch((err) =>
      console.warn("initDefaultBranchIfMissing failed:", err)
    );

    let fallbackOrdersUnsub: (() => void) | null = null;

    const onSnapshotError =
      (label: string) =>
      (err: unknown): void => {
        console.error(`[Firestore] ${label} subscription error:`, err);
        setDataError((prev) => prev ?? `Live ${label} sync unavailable.`);
      };

    const unsubBranches = onSnapshot(
      collection(db, "branches"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Branch[];
        setBranches(list);
        setIsBooting(false);
      },
      onSnapshotError("branches")
    );

    const unsubKitchens = onSnapshot(
      collection(db, "kitchens"),
      (snap) => {
        setKitchens(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Kitchen[]
        );
      },
      onSnapshotError("kitchens")
    );

    const unsubCounters = onSnapshot(
      collection(db, "counters"),
      (snap) => {
        setCounters(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Counter[]
        );
      },
      onSnapshotError("counters")
    );

    const unsubPartners = onSnapshot(
      collection(db, "deliveryPartners"),
      (snap) => {
        setDeliveryPartners(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as DeliveryPartner[]
        );
      },
      onSnapshotError("delivery partners")
    );

    const unsubStaff = onSnapshot(
      collection(db, "staffProfiles"),
      (snap) => {
        setStaffProfiles(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as StaffProfile[]
        );
      },
      onSnapshotError("staff")
    );

    const qOrders = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(ORDERS_LIMIT)
    );

    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        setOrders(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
        );
        setIsBooting(false);
      },
      (err) => {
        console.warn(
          "[Firestore] Ordered orders query failed, falling back:",
          err
        );
        // Avoid double-subscription if the error callback fires twice.
        if (fallbackOrdersUnsub) return;
        fallbackOrdersUnsub = onSnapshot(
          query(collection(db, "orders"), limit(ORDERS_LIMIT)),
          (snap) => {
            setOrders(
              snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
            );
            setIsBooting(false);
          },
          (fallbackErr) => {
            console.error(
              "[Firestore] Fallback orders subscription error:",
              fallbackErr
            );
            setOrders([]);
            setIsBooting(false);
            setDataError("Unable to load orders.");
          }
        );
      }
    );

    // Safety: don't spin forever if nothing resolves.
    const bootTimer = window.setTimeout(() => setIsBooting(false), 4000);

    return () => {
      window.clearTimeout(bootTimer);
      unsubBranches();
      unsubKitchens();
      unsubCounters();
      unsubPartners();
      unsubStaff();
      unsubOrders();
      if (fallbackOrdersUnsub) fallbackOrdersUnsub();
    };
  }, []);

  /* ============================================================
     RESET INVALID SELECTED BRANCH
     ============================================================ */

  useEffect(() => {
    if (selectedBranchId === "ALL") return;
    if (branches.length === 0) return;
    if (!branches.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId("ALL");
    }
  }, [branches, selectedBranchId]);

  /* ============================================================
     DELEGATION EXPIRY WATCHDOG
     ============================================================ */

  useEffect(() => {
    if (!activeSession) return;
    if (typeof window === "undefined") return;

    const validate = () => {
      if (!isDelegationSessionActive(activeSession)) {
        stopDelegationSession()
          .catch(() => {
            /* ignore */
          })
          .finally(() => setActiveSession(null));
      }
    };

    validate();
    const id = window.setInterval(validate, 30_000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  /* ============================================================
     MOBILE DRAWER: escape + scroll lock
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
     HANDLERS
     ============================================================ */

  const handleStopDelegation = useCallback(async () => {
    if (isStoppingDelegation) return;
    setIsStoppingDelegation(true);
    try {
      await stopDelegationSession();
      setActiveSession(null);
    } catch (err) {
      console.error("Failed to stop delegation:", err);
      setDataError("Failed to end delegation session. Please retry.");
    } finally {
      setIsStoppingDelegation(false);
    }
  }, [isStoppingDelegation]);

  const handleLoginSuccess = useCallback((session: unknown) => {
    setStaffSession((session as StaffSessionLike) ?? null);
    setIsUnlocked(true);
  }, []);

  /* ============================================================
     AUTH GATE
     ============================================================ */

  if (!isUnlocked) {
    return (
      <StaffLoginForm
        panel="developer"
        panelDisplayName="Developer Operations Hub"
        panelIcon={<Server size={28} />}
        onSuccess={handleLoginSuccess}
      />
    );
  }

  /* ============================================================
     NAV CONFIG
     ============================================================ */

  const navGroups = [
    {
      label: "Core Modules",
      items: [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard },
        { id: "branches", label: "Outlets & Branches", icon: Building2 },
        { id: "operations", label: "Kitchens & Ops", icon: ChefHat },
        { id: "users", label: "Staff & RBAC", icon: Users },
        { id: "menu", label: "Menu & Availability", icon: Utensils },
        { id: "fleet", label: "Fleet Telemetry", icon: Bike },
      ],
    },
    {
      label: "System",
      items: [
        { id: "payments", label: "Payments & Revenue", icon: CreditCard },
        { id: "infrastructure", label: "Printers & Hardware", icon: Printer },
        { id: "audit", label: "Security & Audit Logs", icon: FileText },
      ],
    },
  ] as const;

  const sectionDetails: Record<SectionId, { title: string; description: string }> = {
    dashboard: {
      title: "Platform overview",
      description: "A live view of revenue, outlets, incoming orders, and delivery capacity.",
    },
    branches: {
      title: "Outlets & branches",
      description: "Configure locations, service areas, and branch-level settings.",
    },
    operations: {
      title: "Kitchens & operations",
      description: "Manage kitchen stations, counter registers, and order flow by outlet.",
    },
    users: {
      title: "Staff & access control",
      description: "Manage staff accounts, roles, and permissions across the platform.",
    },
    menu: {
      title: "Menu availability",
      description: "Control which items are available at each outlet.",
    },
    fleet: {
      title: "Fleet telemetry",
      description: "Review delivery partner availability and location signals.",
    },
    payments: {
      title: "Payments & revenue",
      description: "Review recent paid orders and revenue across your selected scope.",
    },
    infrastructure: {
      title: "Printers & hardware",
      description: "Check receipt printer setup for every configured outlet.",
    },
    audit: {
      title: "Security & audit logs",
      description: "Review administrative events and changes across the platform.",
    },
  };
  const activeSectionDetails = sectionDetails[activeSection];

  const renderNav = () => (
    <>
      {navGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="px-3 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id as SectionId);
                  setIsSidebarOpen(false);
                }}
                aria-current={active ? "page" : undefined}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-indigo-500/10 text-indigo-700 ring-1 ring-inset ring-indigo-500/15 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <Icon
                  size={16}
                  className={
                    active
                      ? "text-indigo-700 dark:text-indigo-200"
                      : "text-slate-400 group-hover:text-indigo-500 dark:text-slate-500"
                  }
                />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight size={13} className="text-white/70" />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 selection:bg-indigo-200/60 dark:bg-[#090d15] dark:text-white dark:selection:bg-indigo-500/30">
      {/* ---- Delegation Banner ---- */}
      {activeSession && (
        <div className="relative z-40 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-[11px] font-black text-white shadow-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span className="truncate">
              DELEGATION ACTIVE — Acting as{" "}
              <span className="underline decoration-white/50 decoration-2 underline-offset-2">
                {activeSession.delegatedRole}
              </span>{" "}
              for &ldquo;{activeSession.targetBranchName}&rdquo;
            </span>
          </div>
          <button
            type="button"
            onClick={handleStopDelegation}
            disabled={isStoppingDelegation}
            className="shrink-0 rounded-lg bg-black/25 px-3 py-1 text-[11px] font-black backdrop-blur transition hover:bg-black/40 disabled:opacity-60"
          >
            {isStoppingDelegation ? "Ending…" : "End Delegation"}
          </button>
        </div>
      )}

      {/* ---- Data error banner ---- */}
      {dataError && (
        <div className="relative z-40 flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[11px] font-bold text-red-700 sm:px-6 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{dataError}</span>
          <button
            type="button"
            onClick={() => setDataError(null)}
            className="rounded-md px-2 py-0.5 text-[11px] font-black hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---- Header ---- */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-[#0c111b]/90"
      >
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 md:hidden dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Menu size={16} />
            </button>

            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/25 ring-1 ring-white/20">
              <Server size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  El Presto{" "}
                  <span className="text-indigo-500 dark:text-indigo-400">
                    //
                  </span>{" "}
                  Dev Platform
                </h1>
                <span className="hidden items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-700 sm:inline-flex dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Sparkles size={9} /> v2.0 Multi-Outlet
                </span>
                <span className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold lg:inline-flex ${dataError ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300" : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>
                  <Radio size={9} className={isBooting ? "animate-pulse text-amber-500" : "animate-pulse text-emerald-500"} />
                  {isBooting ? "Syncing" : dataError ? "Sync issue" : "Live sync"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Cross-branch orchestration, RBAC & real-time operations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Branch filter */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-slate-950/80 dark:shadow-none">
              <Building2
                size={13}
                className="text-indigo-500 dark:text-indigo-400"
              />
              <label htmlFor="branch-filter" className="sr-only">
                Filter by branch
              </label>
              <select
                id="branch-filter"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="max-w-[180px] cursor-pointer bg-transparent text-xs font-bold text-slate-900 focus:outline-none dark:text-white"
              >
                <option value="ALL">All Outlets (Global)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Delegation */}
            <button
              type="button"
              onClick={() => setIsDelegationOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-black text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-md dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-none dark:hover:bg-amber-500/20"
            >
              <KeyRound size={13} />
              <span className="hidden sm:inline">Delegated Access</span>
            </button>

            {/* Theme */}
            <ThemeControl />

            <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 2xl:flex dark:border-white/10">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-black uppercase text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">{staffSession?.name?.trim().charAt(0) || "D"}</span>
              <div className="max-w-36 min-w-0"><p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">{staffSession?.name || "Developer"}</p><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">Platform access</p></div>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 hover:shadow-md dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut size={15} />
            </button>

            {/* Portal links */}
            <div className="hidden items-center gap-1 border-l border-slate-200 pl-2 xl:flex dark:border-white/10">
              {[
                { href: "/admin", label: "Admin" },
                { href: "/kitchen", label: "Kitchen" },
                { href: "/counter", label: "Counter" },
                { href: "/delivery", label: "Delivery" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg border border-transparent px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Developer platform navigation"
          className="sticky hidden w-[17rem] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white/75 p-4 backdrop-blur-2xl md:block dark:border-white/[0.07] dark:bg-[#0d131e]/80"
          style={{
            top: headerHeight,
            height: `calc(100vh - ${headerHeight}px)`,
          }}
        >
          {renderNav()}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 dark:border-white/5 dark:from-indigo-500/10 dark:to-violet-500/10">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                <Activity size={14} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-slate-900 dark:text-white">
                  {branches.length} outlets tracked
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {activeOutletsCount} active
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/70"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Navigation
                </span>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Close navigation"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              {renderNav()}
            </aside>
          </div>
        )}

        {/* Content viewport */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">
          <div className="mx-auto max-w-7xl">
            <section className="mb-6 flex flex-col gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.4)] sm:flex-row sm:items-end sm:justify-between sm:p-6 dark:border-white/[0.07] dark:bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.14),_transparent_45%),linear-gradient(120deg,#141c2b_0%,#101621_70%,#141723_100%)] dark:shadow-[0_22px_60px_-38px_rgba(0,0,0,0.9)]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Developer control plane <span className="mx-1 text-slate-300 dark:text-slate-600">/</span> {activeSection}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{activeSectionDetails.title}</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{activeSectionDetails.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:self-auto dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
                <Building2 size={14} className="text-indigo-500 dark:text-indigo-300" />
                <span className="max-w-[180px] truncate">{selectedBranchId === "ALL" ? "All outlets" : activeBranchObj?.name || "Selected outlet"}</span>
              </div>
            </section>
            {/* ===================== 1. DASHBOARD ===================== */}
            {activeSection === "dashboard" && (
              <div className="space-y-6">
                {/* Metric Hero Cards */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {/* Revenue */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg sm:p-5 dark:border-white/[0.07] dark:bg-[#111827] dark:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.9)] dark:hover:border-emerald-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Paid revenue · recent
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <IndianRupee size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      ₹{Math.round(totalRevenue).toLocaleString("en-IN")}
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={10} /> From latest {filteredOrders.length} orders in scope
                    </span>
                  </div>

                  {/* Outlets */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg sm:p-5 dark:border-white/[0.07] dark:bg-[#111827] dark:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.9)] dark:hover:border-indigo-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Outlets online
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                        <Building2 size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {scopedActiveOutletsCount}
                      <span className="text-sm font-normal text-slate-400">
                        {selectedBranchId === "ALL" ? ` / ${branches.length}` : " / 1"}
                      </span>
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedBranchId === "ALL"
                        ? "Across all locations"
                        : activeBranchObj?.name || "Selected outlet"}
                    </span>
                  </div>

                  {/* Orders */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg sm:p-5 dark:border-white/[0.07] dark:bg-[#111827] dark:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.9)] dark:hover:border-orange-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Recent orders
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
                        <ShoppingBag size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {isBooting && orders.length === 0 ? (
                        <Loader2
                          size={18}
                          className="animate-spin text-slate-400"
                        />
                      ) : (
                        filteredOrders.length
                      )}
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                      Within the latest {ORDERS_LIMIT} platform orders
                    </span>
                  </div>

                  {/* Riders */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg sm:p-5 dark:border-white/[0.07] dark:bg-[#111827] dark:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.9)] dark:hover:border-cyan-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        On-duty riders
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
                        <Bike size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {scopedActiveRidersCount}
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                      On duty right now
                    </span>
                  </div>
                </div>

                {/* Fast Launch */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      id: "branches" as const,
                      icon: Building2,
                      title: "Manage Outlets",
                      desc: "Add or edit restaurant locations",
                      tone: {
                        outer:
                          "hover:border-indigo-300 dark:hover:border-indigo-500/30",
                        icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
                      },
                    },
                    {
                      id: "operations" as const,
                      icon: ChefHat,
                      title: "Kitchen & Counters",
                      desc: "KOT stations & POS registers",
                      tone: {
                        outer:
                          "hover:border-orange-300 dark:hover:border-orange-500/30",
                        icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
                      },
                    },
                    {
                      id: "menu" as const,
                      icon: Utensils,
                      title: "Menu Availability",
                      desc: "Outlet-specific item toggles",
                      tone: {
                        outer:
                          "hover:border-emerald-300 dark:hover:border-emerald-500/30",
                        icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                      },
                    },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setActiveSection(card.id)}
                        className={`group flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none ${card.tone.outer}`}
                      >
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${card.tone.icon}`}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {card.title}
                          </h4>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {card.desc}
                          </p>
                        </div>
                        <ArrowRight
                          size={15}
                          className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900 dark:group-hover:text-white"
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Live Order Stream */}
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                        <Activity size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                          Live Platform Stream
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Latest {ORDERS_LIMIT} orders placed across branches
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection("operations")}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-700"
                    >
                      View Operations <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    {isBooting && filteredOrders.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-14 text-slate-400">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-xs font-black">
                          Loading orders…
                        </span>
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-14">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                          <ShoppingBag
                            size={24}
                            className="text-slate-400 dark:text-slate-600"
                          />
                        </div>
                        <p className="text-sm font-black text-slate-500 dark:text-slate-400">
                          No orders yet
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-600">
                          New orders will appear here in real time
                        </p>
                      </div>
                    ) : (
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-white/5 dark:text-slate-400">
                            <th className="px-5 py-3">Order</th>
                            <th className="px-5 py-3">Customer</th>
                            <th className="px-5 py-3">Outlet</th>
                            <th className="px-5 py-3">Total</th>
                            <th className="px-5 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {filteredOrders.slice(0, 8).map((o) => (
                            <tr
                              key={o.id}
                              className="transition hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                            >
                              <td className="px-5 py-3.5 font-mono font-black text-slate-900 dark:text-white">
                                {o.orderNumber}
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                                {o.customerName || "Customer"}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="rounded-lg bg-indigo-100 px-2 py-0.5 font-mono text-[10px] font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400">
                                  {o.branchId
                                    ? branchMap.get(o.branchId)?.code || "—"
                                    : "—"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                                ₹{Math.round(safeNumber(o.total))}
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${statusStyles(
                                    o.status
                                  )}`}
                                >
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===================== 2. BRANCHES ===================== */}
            {activeSection === "branches" && (
              <BranchManager
                branches={branches}
                onRefresh={refreshData}
                developerEmail={developerEmail}
              />
            )}

            {/* ===================== 3. OPERATIONS ===================== */}
            {activeSection === "operations" && (
              <OperationsManager
                branches={branches}
                kitchens={kitchens}
                counters={counters}
                deliveryPartners={deliveryPartners}
                orders={orders}
                selectedBranchId={selectedBranchId}
                onRefresh={refreshData}
                developerEmail={developerEmail}
              />
            )}

            {/* ===================== 4. USERS ===================== */}
            {activeSection === "users" && (
              <UserManager
                staffProfiles={staffProfiles}
                branches={branches}
                onRefresh={refreshData}
                developerEmail={developerEmail}
              />
            )}

            {/* ===================== 5. MENU ===================== */}
            {activeSection === "menu" && (
              <MenuAvailabilityManager
                branches={branches}
                developerEmail={developerEmail}
              />
            )}

            {/* ===================== 6. FLEET ===================== */}
            {activeSection === "fleet" && (
              <FleetLiveMap partners={deliveryPartners} branches={branches} />
            )}

            {/* ===================== 7. PAYMENTS ===================== */}
            {activeSection === "payments" && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/5">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Payment Gateway & Settlements
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Razorpay transaction reconciliation & branch volume
                        breakdown
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                    {[
                      {
                        label: "Paid Orders (recent)",
                        value: String(paidOrdersCount),
                      },
                      {
                        label: "Settlement Currency",
                        value: "INR (₹)",
                      },
                      {
                        label: "Paid Revenue (recent)",
                        value: `₹${Math.round(totalRevenue).toLocaleString(
                          "en-IN"
                        )}`,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {s.label}
                        </span>
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-black text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} /> {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===================== 8. INFRASTRUCTURE ===================== */}
            {activeSection === "infrastructure" && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/5">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                      <Printer size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        Thermal Hardware Infrastructure
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        F2C Mobile & Desktop 58mm/80mm Thermal Receipt Printers
                        per Counter
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 p-5">
                    {branches.map((b) => {
                      const pc = b.printerConfig;
                      const configured = Boolean(pc);
                      return (
                        <div
                          key={b.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 dark:border-white/5 dark:bg-slate-950 dark:hover:border-indigo-500/30"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/5">
                              <Building2 size={16} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate text-xs font-black text-slate-900 dark:text-white">
                                {b.name}
                              </h4>
                              <p className="truncate font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                {pc?.cafeName || b.name} •{" "}
                                {pc?.paperWidth || "58mm"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              configured
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400"
                                : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400"
                            }`}
                          >
                            {configured ? (
                              <>
                                <CheckCircle2 size={10} /> Configured
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} /> Not configured
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {branches.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <Printer
                          size={28}
                          className="text-slate-300 dark:text-slate-700"
                        />
                        <p className="text-xs font-black text-slate-500 dark:text-slate-400">
                          No outlets configured yet
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===================== 9. AUDIT ===================== */}
            {activeSection === "audit" && (
              <AuditLogViewer branches={branches} />
            )}
          </div>
        </main>
      </div>

      {/* Delegation Modal */}
      <DelegationModal
        branches={branches}
        isOpen={isDelegationOpen}
        onClose={() => {
          setIsDelegationOpen(false);
          setActiveSession(getActiveDelegationSession());
        }}
        developerEmail={developerEmail}
      />
    </div>
  );
}
