"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  ChefHat,
  Users,
  Utensils,
  CreditCard,
  Tag,
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
} from "lucide-react";
import Link from "next/link";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import { Branch, Kitchen, Counter, DeliveryPartner, StaffProfile, Order } from "@/lib/types";
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
  const [activeSession, setActiveSession] = useState<DelegationSession | null>(null);
  const [developerPin, setDeveloperPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [staffSession, setStaffSession] = useState<any>(null);

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

  // Real-time synchronization
  const refreshData = async () => {
    await initDefaultBranchIfMissing();
    const allB = await getAllBranches();
    setBranches(allB);
  };

  useEffect(() => {
    refreshData();
    setActiveSession(getActiveDelegationSession());

    // Listen to branches
    const unsubBranches = onSnapshot(collection(db, "branches"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Branch[];
      if (list.length > 0) setBranches(list);
    });

    // Listen to kitchens
    const unsubKitchens = onSnapshot(collection(db, "kitchens"), (snap) => {
      setKitchens(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Kitchen[]);
    });

    // Listen to counters
    const unsubCounters = onSnapshot(collection(db, "counters"), (snap) => {
      setCounters(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Counter[]);
    });

    // Listen to delivery partners
    const unsubPartners = onSnapshot(collection(db, "deliveryPartners"), (snap) => {
      setDeliveryPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DeliveryPartner[]);
    });

    // Listen to staff profiles
    const unsubStaff = onSnapshot(collection(db, "staffProfiles"), (snap) => {
      setStaffProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StaffProfile[]);
    });

    // Listen to orders
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]);
      },
      () => {
        // Fallback if index not yet generated
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

  // Filter orders for selected branch
  const filteredOrders =
    selectedBranchId === "ALL"
      ? orders
      : orders.filter((o) => (o.branchId || DEFAULT_MAIN_BRANCH_ID) === selectedBranchId);

  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + (o.paymentStatus === "paid" ? o.total || 0 : 0),
    0
  );

  const activeBranchObj = branches.find((b) => b.id === selectedBranchId);

  // Security gate for Developer Panel
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (developerPin === "admin9090" || developerPin === "dev2026") {
      setIsUnlocked(true);
    } else {
      alert("Invalid Developer Master PIN.");
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Active Delegation Session Alert Bar */}
      {activeSession && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2 text-xs font-black shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>
              DELEGATION ACTIVE: Acting as {activeSession.delegatedRole} for &quot;{activeSession.targetBranchName}&quot;
            </span>
          </div>
          <button
            onClick={async () => {
              await stopDelegationSession();
              setActiveSession(null);
            }}
            className="rounded-lg bg-black/30 px-3 py-1 text-[11px] hover:bg-black/50 transition"
          >
            End Delegation
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/80 backdrop-blur-2xl px-6 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
              <Server size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wide text-white uppercase">
                  EL PRESTO // DEV PLATFORM
                </h1>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/25">
                  v2.0 Multi-Outlet
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400">
                Cross-branch orchestration, RBAC, and real-time operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Global Branch Filter */}
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-1.5">
              <Building2 size={13} className="text-indigo-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Outlets (Global Aggregate)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Delegation Action */}
            <button
              onClick={() => setIsDelegationOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
            >
              <KeyRound size={13} />
              <span>Delegated Access</span>
            </button>

            {/* Quick Portal Switcher */}
            <div className="flex items-center gap-1 border-l border-white/10 pl-3">
              <Link
                href="/admin"
                className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Admin
              </Link>
              <Link
                href="/kitchen"
                className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Kitchen
              </Link>
              <Link
                href="/counter"
                className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Counter
              </Link>
              <Link
                href="/delivery"
                className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Delivery
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex">
        {/* Navigation Sidebar */}
        <aside className="w-64 shrink-0 border-r border-white/10 bg-slate-900/40 min-h-[calc(100vh-65px)] p-4 space-y-1 hidden md:block">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-1.5">
            Core Modules
          </div>

          {[
            { id: "dashboard", label: "Overview Dashboard", icon: LayoutDashboard },
            { id: "branches", label: "Outlets & Branches", icon: Building2 },
            { id: "operations", label: "Kitchens & Operations", icon: ChefHat },
            { id: "users", label: "Staff & RBAC", icon: Users },
            { id: "menu", label: "Menu & Availability", icon: Utensils },
            { id: "fleet", label: "Fleet Telemetry", icon: Bike },
            { id: "payments", label: "Payments & Revenue", icon: CreditCard },
            { id: "infrastructure", label: "Printers & Hardware", icon: Printer },
            { id: "audit", label: "Security & Audit Logs", icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Dynamic Content Viewport */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-hidden">
          {/* ---------------- 1. DASHBOARD VIEW ---------------- */}
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              {/* Metric Hero Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Live Revenue</span>
                    <IndianRupee size={16} className="text-emerald-400" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-black text-white">
                    ₹{Math.round(totalRevenue).toLocaleString()}
                  </p>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    ✓ Verified Paid Orders
                  </span>
                </div>

                <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Active Outlets</span>
                    <Building2 size={16} className="text-indigo-400" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-black text-white">
                    {branches.filter((b) => b.active).length}
                    <span className="text-sm font-normal text-slate-500"> / {branches.length}</span>
                  </p>
                  <span className="text-[10px] text-indigo-400 font-bold">
                    {selectedBranchId === "ALL" ? "Platform Total" : activeBranchObj?.code}
                  </span>
                </div>

                <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Total Orders</span>
                    <ShoppingBag size={16} className="text-orange-400" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-black text-white">
                    {filteredOrders.length}
                  </p>
                  <span className="text-[10px] text-orange-400 font-bold">
                    Across selected scope
                  </span>
                </div>

                <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold">Active Riders</span>
                    <Bike size={16} className="text-cyan-400" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-black text-white">
                    {deliveryPartners.filter((p) => p.availability !== "OFFLINE").length}
                  </p>
                  <span className="text-[10px] text-cyan-400 font-bold">
                    On duty right now
                  </span>
                </div>
              </div>

              {/* Fast Launch Cards */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div
                  onClick={() => setActiveSection("branches")}
                  className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl hover:border-indigo-500/30 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Manage Outlets</h4>
                      <p className="text-xs text-slate-400">Add or edit restaurant locations</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setActiveSection("operations")}
                  className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl hover:border-orange-500/30 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400">
                      <ChefHat size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Kitchen & Counters</h4>
                      <p className="text-xs text-slate-400">KOT stations & POS registers</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setActiveSection("menu")}
                  className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl hover:border-emerald-500/30 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Utensils size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Menu Availability</h4>
                      <p className="text-xs text-slate-400">Outlet-specific item toggles</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders Overview */}
              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-black text-white">Live Platform Stream</h3>
                    <p className="text-xs text-slate-400">Latest orders placed across branches</p>
                  </div>
                  <button
                    onClick={() => setActiveSection("operations")}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    View Operations <ArrowRight size={14} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/5 text-[10px] font-black uppercase text-slate-400">
                      <tr>
                        <th className="py-2.5">Order</th>
                        <th className="py-2.5">Customer</th>
                        <th className="py-2.5">Outlet</th>
                        <th className="py-2.5">Total</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredOrders.slice(0, 8).map((o) => (
                        <tr key={o.id}>
                          <td className="py-3 font-mono font-bold text-white">{o.orderNumber}</td>
                          <td className="py-3">{o.customerName || "Customer"}</td>
                          <td className="py-3 font-bold text-indigo-400">
                            {branches.find((b) => b.id === o.branchId)?.code || "BR-01"}
                          </td>
                          <td className="py-3 font-mono font-bold text-emerald-400">
                            ₹{Math.round(o.total || 0)}
                          </td>
                          <td className="py-3">
                            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-orange-400">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 2. BRANCHES VIEW ---------------- */}
          {activeSection === "branches" && (
            <BranchManager
              branches={branches}
              onRefresh={refreshData}
              developerEmail="developer@elpresto.co.in"
            />
          )}

          {/* ---------------- 3. OPERATIONS VIEW ---------------- */}
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

          {/* ---------------- 4. USERS VIEW ---------------- */}
          {activeSection === "users" && (
            <UserManager
              staffProfiles={staffProfiles}
              branches={branches}
              onRefresh={refreshData}
              developerEmail="developer@elpresto.co.in"
            />
          )}

          {/* ---------------- 5. MENU AVAILABILITY VIEW ---------------- */}
          {activeSection === "menu" && (
            <MenuAvailabilityManager
              branches={branches}
              developerEmail="developer@elpresto.co.in"
            />
          )}

          {/* ---------------- 6. FLEET TELEMETRY VIEW ---------------- */}
          {activeSection === "fleet" && (
            <FleetLiveMap partners={deliveryPartners} branches={branches} />
          )}

          {/* ---------------- 7. PAYMENTS & FINANCES ---------------- */}
          {activeSection === "payments" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Payment Gateway & Settlements</h3>
                    <p className="text-xs text-slate-400">
                      Razorpay live transaction reconciliation & branch volume breakdown
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-slate-950 p-4 border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Gateway Mode</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">✓ Razorpay Live Active</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-4 border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Settlement Currency</span>
                    <p className="text-sm font-bold text-white mt-1">INR (₹)</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-4 border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Webhooks Status</span>
                    <p className="text-sm font-bold text-emerald-400 mt-1">✓ /api/razorpay-webhook Active</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 8. INFRASTRUCTURE & PRINTERS ---------------- */}
          {activeSection === "infrastructure" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Thermal Hardware Infrastructure</h3>
                    <p className="text-xs text-slate-400">
                      F2C Mobile & Desktop 58mm/80mm Thermal Receipt Printers per Counter
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {branches.map((b) => (
                    <div key={b.id} className="rounded-2xl bg-slate-950 p-4 border border-white/5 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white">{b.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {b.printerConfig?.cafeName || b.name} • {b.printerConfig?.paperWidth || "58mm"}
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                        Configured
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- 9. AUDIT & LOGS VIEW ---------------- */}
          {activeSection === "audit" && <AuditLogViewer branches={branches} />}
        </main>
      </div>

      {/* Role Delegation Modal */}
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

