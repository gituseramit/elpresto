"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  ChefHat,
  Users,
  Utensils,
  CreditCard,
  Server,
  Activity,
  Compass,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  RefreshCw,
  ExternalLink,
  Plus,
  Bike,
  Printer,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  Sparkles,
  Radio,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
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

/* ============== THEME HELPERS ============== */
type ThemeMode = "light" | "dark" | "system";

function ThemeToggle({
  themeMode,
  setThemeMode,
}: {
  themeMode: ThemeMode;
  setThemeMode: (t: ThemeMode) => void;
}) {
  const cycle: Record<ThemeMode, ThemeMode> = {
    light: "dark",
    dark: "system",
    system: "light",
  };
  const Icon =
    themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;
  const label =
    themeMode === "light"
      ? "Light theme"
      : themeMode === "dark"
      ? "Dark theme"
      : "System theme";

  return (
    <button
      onClick={() => setThemeMode(cycle[themeMode])}
      title={`${label} (click to cycle)`}
      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
    >
      <Icon size={15} />
    </button>
  );
}

/* ============== STATUS STYLES ============== */
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

/* ============== MAIN PAGE ============== */
export default function DeveloperDashboardPage() {
  const [activeSection, setActiveSection] = useState<
    | "dashboard"
    | "branches"
    | "operations"
    | "users"
    | "menu"
    | "fleet"
    | "payments"
    | "infrastructure"
    | "audit"
  >("dashboard");

  // Global state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [isDelegationOpen, setIsDelegationOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<DelegationSession | null>(
    null
  );
  const [developerPin, setDeveloperPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [staffSession, setStaffSession] = useState<any>(null);

  // Layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  /* ---- Init session ---- */
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@/lib/staffAuth").then(({ getStaffSession, isSessionValid }) => {
        const session = getStaffSession("developer");
        if (session && isSessionValid(session)) {
          setStaffSession(session);
          setIsUnlocked(true);
        }
      });
    }
  }, []);

  /* ---- Theme persistence ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("elpestro_dev_theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setThemeMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;

    const apply = () => {
      let resolved: "light" | "dark";
      if (themeMode === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        resolved = themeMode;
      }
      setResolvedTheme(resolved);
      if (resolved === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };

    apply();
    localStorage.setItem("elpestro_dev_theme", themeMode);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themeMode === "system") apply();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  /* ---- Realtime data ---- */
  const refreshData = async () => {
    await initDefaultBranchIfMissing();
    const allB = await getAllBranches();
    setBranches(allB);
  };

  useEffect(() => {
    refreshData();
    setActiveSession(getActiveDelegationSession());

    const unsubBranches = onSnapshot(collection(db, "branches"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Branch[];
      if (list.length > 0) setBranches(list);
    });

    const unsubKitchens = onSnapshot(collection(db, "kitchens"), (snap) => {
      setKitchens(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Kitchen[]);
    });

    const unsubCounters = onSnapshot(collection(db, "counters"), (snap) => {
      setCounters(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Counter[]);
    });

    const unsubPartners = onSnapshot(collection(db, "deliveryPartners"), (snap) => {
      setDeliveryPartners(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DeliveryPartner[]
      );
    });

    const unsubStaff = onSnapshot(collection(db, "staffProfiles"), (snap) => {
      setStaffProfiles(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StaffProfile[]
      );
    });

    const qOrders = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]);
      },
      () => {
        onSnapshot(collection(db, "orders"), (snap) => {
          setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]);
        });
      }
    );

    return () => {
      unsubBranches();
      unsubKitchens();
      unsubCounters();
      unsubPartners();
      unsubStaff();
      unsubOrders();
    };
  }, []);

  const filteredOrders =
    selectedBranchId === "ALL"
      ? orders
      : orders.filter(
          (o) => (o.branchId || DEFAULT_MAIN_BRANCH_ID) === selectedBranchId
        );

  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + (o.paymentStatus === "paid" ? o.total || 0 : 0),
    0
  );

  const activeBranchObj = branches.find((b) => b.id === selectedBranchId);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (developerPin === "admin9090" || developerPin === "dev2026") {
      setIsUnlocked(true);
    } else {
      alert("Invalid Developer Master PIN.");
    }
  };

  /* ---- Auth gate ---- */
  if (!isUnlocked) {
    return (
      <StaffLoginForm
        panel="developer"
        panelDisplayName="Developer Operations Hub"
        panelIcon={<Server size={28} />}
        onSuccess={(session) => {
          setStaffSession(session);
          setIsUnlocked(true);
        }}
      />
    );
  }

  /* ---- Nav config ---- */
  const navGroups = [
    {
      label: "Core Modules",
      items: [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard, accent: "indigo" },
        { id: "branches", label: "Outlets & Branches", icon: Building2, accent: "indigo" },
        { id: "operations", label: "Kitchens & Ops", icon: ChefHat, accent: "orange" },
        { id: "users", label: "Staff & RBAC", icon: Users, accent: "violet" },
        { id: "menu", label: "Menu & Availability", icon: Utensils, accent: "emerald" },
        { id: "fleet", label: "Fleet Telemetry", icon: Bike, accent: "cyan" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "payments", label: "Payments & Revenue", icon: CreditCard, accent: "emerald" },
        { id: "infrastructure", label: "Printers & Hardware", icon: Printer, accent: "indigo" },
        { id: "audit", label: "Security & Audit Logs", icon: FileText, accent: "rose" },
      ],
    },
  ] as const;

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
                onClick={() => {
                  setActiveSection(item.id as any);
                  setIsSidebarOpen(false);
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-white" : "text-slate-400 group-hover:text-indigo-500 dark:text-slate-500"}
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

  /* ============================================ */
  /* MAIN DASHBOARD                                */
  /* ============================================ */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-200/60 dark:bg-slate-950 dark:text-white dark:selection:bg-indigo-500/30">
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
            onClick={async () => {
              await stopDelegationSession();
              setActiveSession(null);
            }}
            className="shrink-0 rounded-lg bg-black/25 px-3 py-1 text-[11px] font-black backdrop-blur transition hover:bg-black/40"
          >
            End Delegation
          </button>
        </div>
      )}

      {/* ---- Header ---- */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: brand + mobile menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 md:hidden dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Menu size={16} />
            </button>

            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <Server size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  El Presto <span className="text-indigo-500 dark:text-indigo-400">//</span> Dev Platform
                </h1>
                <span className="hidden items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-700 sm:inline-flex dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Sparkles size={9} /> v2.0 Multi-Outlet
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500 lg:inline-flex dark:border-white/10 dark:bg-slate-800 dark:text-slate-400">
                  <Radio size={9} className="animate-pulse text-emerald-500" />
                  Live
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Cross-branch orchestration, RBAC & real-time operations
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch filter */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-slate-950/80 dark:shadow-none">
              <Building2 size={13} className="text-indigo-500 dark:text-indigo-400" />
              <select
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
              onClick={() => setIsDelegationOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-black text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-md dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-none dark:hover:bg-amber-500/20"
            >
              <KeyRound size={13} />
              <span className="hidden sm:inline">Delegated Access</span>
            </button>

            {/* Theme */}
            <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />

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
        <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white/70 p-3 backdrop-blur-xl md:block dark:border-white/10 dark:bg-slate-900/40">
          {renderNav()}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 dark:border-white/5 dark:from-indigo-500/10 dark:to-violet-500/10">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                <Activity size={14} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-slate-900 dark:text-white">
                  System Healthy
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {branches.length} outlets online
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
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
                  onClick={() => setIsSidebarOpen(false)}
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
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {/* ===================== 1. DASHBOARD ===================== */}
            {activeSection === "dashboard" && (
              <div className="space-y-6">
                {/* Metric Hero Cards */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {/* Revenue */}
                  <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none dark:hover:border-emerald-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Live Revenue
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <IndianRupee size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      ₹{Math.round(totalRevenue).toLocaleString()}
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={10} /> Verified paid orders
                    </span>
                  </div>

                  {/* Outlets */}
                  <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none dark:hover:border-indigo-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Active Outlets
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                        <Building2 size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {branches.filter((b) => b.active).length}
                      <span className="text-sm font-normal text-slate-400">
                        {" "}
                        / {branches.length}
                      </span>
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedBranchId === "ALL"
                        ? "Platform total"
                        : activeBranchObj?.code || "—"}
                    </span>
                  </div>

                  {/* Orders */}
                  <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none dark:hover:border-orange-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Total Orders
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
                        <ShoppingBag size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {filteredOrders.length}
                    </p>
                    <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                      Across selected scope
                    </span>
                  </div>

                  {/* Riders */}
                  <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none dark:hover:border-cyan-500/30">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Active Riders
                      </span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
                        <Bike size={15} />
                      </div>
                    </div>
                    <p className="relative mt-3 font-mono text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                      {deliveryPartners.filter((p) => p.availability !== "OFFLINE").length}
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
                      color: "indigo",
                    },
                    {
                      id: "operations" as const,
                      icon: ChefHat,
                      title: "Kitchen & Counters",
                      desc: "KOT stations & POS registers",
                      color: "orange",
                    },
                    {
                      id: "menu" as const,
                      icon: Utensils,
                      title: "Menu Availability",
                      desc: "Outlet-specific item toggles",
                      color: "emerald",
                    },
                  ].map((card) => {
                    const Icon = card.icon;
                    const colorMap: Record<string, string> = {
                      indigo:
                        "bg-indigo-100 text-indigo-600 group-hover:border-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-400 dark:group-hover:border-indigo-500/30",
                      orange:
                        "bg-orange-100 text-orange-600 group-hover:border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:group-hover:border-orange-500/30",
                      emerald:
                        "bg-emerald-100 text-emerald-600 group-hover:border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:group-hover:border-emerald-500/30",
                    };
                    return (
                      <button
                        key={card.id}
                        onClick={() => setActiveSection(card.id)}
                        className={`group flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5 dark:border-white/5 dark:bg-slate-900/60 dark:shadow-none ${colorMap[card.color]}`}
                      >
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${colorMap[card.color]}`}
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
                          Latest orders placed across branches
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSection("operations")}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md dark:border-white/5 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-700"
                    >
                      View Operations <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    {filteredOrders.length === 0 ? (
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
                                  {branches.find((b) => b.id === o.branchId)?.code ||
                                    "BR-01"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                                ₹{Math.round(o.total || 0)}
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
                developerEmail="developer@elpresto.co.in"
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
                developerEmail="developer@elpresto.co.in"
              />
            )}

            {/* ===================== 4. USERS ===================== */}
            {activeSection === "users" && (
              <UserManager
                staffProfiles={staffProfiles}
                branches={branches}
                onRefresh={refreshData}
                developerEmail="developer@elpresto.co.in"
              />
            )}

            {/* ===================== 5. MENU ===================== */}
            {activeSection === "menu" && (
              <MenuAvailabilityManager
                branches={branches}
                developerEmail="developer@elpresto.co.in"
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
                        Razorpay live transaction reconciliation & branch volume
                        breakdown
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
                    {[
                      {
                        label: "Gateway Mode",
                        value: "Razorpay Live Active",
                        ok: true,
                      },
                      { label: "Settlement Currency", value: "INR (₹)", ok: true },
                      {
                        label: "Webhook Status",
                        value: "/api/razorpay-webhook",
                        ok: true,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-slate-950"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {s.label}
                        </span>
                        <p
                          className={`mt-1.5 flex items-center gap-1.5 text-sm font-black ${
                            s.ok
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {s.ok && <CheckCircle2 size={14} />} {s.value}
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
                    {branches.map((b) => (
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
                              {b.printerConfig?.cafeName || b.name} •{" "}
                              {b.printerConfig?.paperWidth || "58mm"}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400">
                          <CheckCircle2 size={10} /> Configured
                        </span>
                      </div>
                    ))}
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
            {activeSection === "audit" && <AuditLogViewer branches={branches} />}
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
        developerEmail="developer@elpresto.co.in"
      />
    </div>
  );
}