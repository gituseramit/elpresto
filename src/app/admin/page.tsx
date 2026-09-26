"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Percent,
  AlertTriangle,
  Check,
  Printer,
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
  Star,
  Shield,
  Coffee,
  Crown,
  Activity,
  BarChart4,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DUMMY_MENU } from "@/data/menu";
import {
  DEFAULT_CATEGORIES,
  initializeCategoriesIfEmpty,
  resolveItemCategoryHierarchy,
} from "@/lib/categories";
import Modern3DBarChart from "@/components/Admin/Charts/Modern3DBarChart";
import Modern3DDonutChart from "@/components/Admin/Charts/Modern3DDonutChart";
import Modern3DCategoryChart from "@/components/Admin/Charts/Modern3DCategoryChart";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import { Category, Subcategory, PromoCode } from "@/lib/types";
import { executeTransactionalReset } from "@/lib/dbResetService";

import { db } from "@/lib/firebase";
import {
  savePanelAccessSettings,
  PanelAccessData,
  DEFAULT_PANEL_CONFIGS,
  verifyPanelAccess,
  subscribePanelStatus,
} from "@/lib/panelAuth";
import {
  saveTrendingSettings,
  TrendingSettings,
  DEFAULT_TRENDING_SETTINGS,
} from "@/lib/trendingService";

import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  addDoc,
  writeBatch,
} from "firebase/firestore";

const docToData = (docSnap: any) => ({ id: docSnap.id, ...docSnap.data() });

/* ============================================================= */
/* Shared UI primitives                                          */
/* ============================================================= */

const inputCls =
  "w-full rounded-xl border border-white/5 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

const labelCls =
  "mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400";

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/5 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-white sm:text-base">{title}</h3>
          {subtitle && (
            <p className="truncate text-[11px] font-semibold text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ============================================================= */
/* Page                                                          */
/* ============================================================= */
export default function AdminPage() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<any>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);

  /* ---- Panel access ---- */
  const [panelAccess, setPanelAccess] = useState<PanelAccessData>(DEFAULT_PANEL_CONFIGS);
  const [panelPinInputs, setPanelPinInputs] = useState<Record<string, string>>({
    admin: "",
    kitchen: "",
    counter: "",
    delivery: "",
  });
  const [showPinMap, setShowPinMap] = useState<Record<string, boolean>>({});
  const [panelSaveMsg, setPanelSaveMsg] = useState<string | null>(null);

  /* ---- Trending ---- */
  const [trendingSettings, setTrendingSettings] = useState<TrendingSettings>(
    DEFAULT_TRENDING_SETTINGS
  );
  const [trendingSaveMsg, setTrendingSaveMsg] = useState<string | null>(null);

  /* ---- Data ---- */
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState({ menu: true, categories: true, orders: true });
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoUsageLogs, setPromoUsageLogs] = useState<any[]>([]);
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [showEditPromoModal, setShowEditPromoModal] = useState<PromoCode | null>(null);
  const [promoForm, setPromoForm] = useState<Partial<PromoCode>>({
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
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<any>(null);
  const [showAddMenuItemModal, setShowAddMenuItemModal] = useState(false);
  const [showEditMenuItemModal, setShowEditMenuItemModal] = useState<any>(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState<any>(null);
  const [searchOrders, setSearchOrders] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [searchMenu, setSearchMenu] = useState("");
  const [adminSelectedCategory, setAdminSelectedCategory] = useState("all");
  const [adminSelectedSubcategory, setAdminSelectedSubcategory] = useState("all");
  const [modalCategory, setModalCategory] = useState<string>("Food");
  const [modalSubcategory, setModalSubcategory] = useState<string>("Healthy Mania");
  const [isCustomSubcategory, setIsCustomSubcategory] = useState<boolean>(false);
  const [customSubcategoryText, setCustomSubcategoryText] = useState<string>("");
  const [showAddSubModal, setShowAddSubModal] = useState<any>(null);
  const [newSubNameInput, setNewSubNameInput] = useState<string>("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [reportPeriod, setReportPeriod] = useState("daily");
  const [newOrderNotification, setNewOrderNotification] = useState(false);

  /* ---- Kitchen filters ---- */
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState("all");
  const [kitchenSourceFilter, setKitchenSourceFilter] = useState("all");
  const [kitchenSearchQuery, setKitchenSearchQuery] = useState("");

  /* ---- Settings ---- */
  const [settings, setSettings] = useState({
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
  });

  const audioContextRef = useRef<any>(null);
  const soundEnabledRef = useRef(settings.soundEnabled);

  /* =============================================== */
  /* Effects                                         */
  /* =============================================== */
  useEffect(() => {
    // Check for existing valid v2 staff session
    if (typeof window !== "undefined") {
      import("@/lib/staffAuth").then(({ getStaffSession, isSessionValid }) => {
        const session = getStaffSession("admin");
        if (session && isSessionValid(session)) {
          setStaffSession(session);
          setIsAuthenticated(true);
        }
        setIsVerifyingAuth(false);
      });
    }
    // Keep legacy panel disable listener for backwards compat
    const unsub = subscribePanelStatus("admin", () => {
      setIsAuthenticated(false);
      import("@/lib/staffAuth").then(({ clearStaffSession }) => clearStaffSession("admin"));
    });
    return () => unsub();
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setStaffSession(null);
    import("@/lib/staffAuth").then(({ clearStaffSession }) => clearStaffSession("admin"));
    // Also clear old-style session key for full cleanup
    sessionStorage.removeItem("elpestro_admin_auth");
  };

  /* ---- Realtime ---- */
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
          setCategories(snap.docs.map(docToData));
        }
        setLoading((prev) => ({ ...prev, categories: false }));
      },
      (err) => {
        console.warn("Using default categories fallback:", err);
        setCategories(DEFAULT_CATEGORIES);
        setLoading((prev) => ({ ...prev, categories: false }));
      }
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "menuItems"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMenuItems(snap.docs.map(docToData));
        setLoading((prev) => ({ ...prev, menu: false }));
      },
      () => setLoading((prev) => ({ ...prev, menu: false }))
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(docToData);
        setOrders(data);
        setLoading((prev) => ({ ...prev, orders: false }));
        const newPreparing = data.filter((o: any) => o.status === "preparing" && !o._seen);
        if (newPreparing.length > 0 && soundEnabledRef.current) {
          playNotificationSound();
          setNewOrderNotification(true);
          setTimeout(() => setNewOrderNotification(false), 3000);
        }
      },
      () => setLoading((prev) => ({ ...prev, orders: false }))
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(doc(db, "settings", "panelAccess"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PanelAccessData;
        setPanelAccess((prev) => ({
          admin: { ...DEFAULT_PANEL_CONFIGS.admin, ...data.admin },
          kitchen: { ...DEFAULT_PANEL_CONFIGS.kitchen, ...data.kitchen },
          counter: { ...DEFAULT_PANEL_CONFIGS.counter, ...data.counter },
          delivery: { ...DEFAULT_PANEL_CONFIGS.delivery, ...data.delivery },
        }));
      }
    });
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(doc(db, "settings", "trending"), (snap) => {
      if (snap.exists()) {
        setTrendingSettings((prev) => ({
          ...DEFAULT_TRENDING_SETTINGS,
          ...(snap.data() as Partial<TrendingSettings>),
        }));
      }
    });
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(doc(db, "settings", "general"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSettings((prev) => ({ ...prev, ...data }));
        soundEnabledRef.current =
          data.soundEnabled !== undefined ? data.soundEnabled : true;
      }
    });
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      query(collection(db, "promoCodes"), orderBy("createdAt", "desc")),
      (snap) => setPromoCodes(snap.docs.map(docToData)),
      () => {}
    );
    return unsub;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(
      query(collection(db, "promoUsage"), orderBy("usedAt", "desc")),
      (snap) => setPromoUsageLogs(snap.docs.map(docToData)),
      () => {}
    );
    return unsub;
  }, [isAuthenticated]);

  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
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
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = "sine";
        gain2.gain.setValueAtTime(0.25, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 150);
    } catch (e) {}
  };

  /* =============================================== */
  /* CRUD                                            */
  /* =============================================== */
  const savePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.code?.trim()) return alert("Please enter a promo code");
    const payload = {
      code: promoForm.code.trim().toUpperCase(),
      description: promoForm.description || "",
      discountType: promoForm.discountType || "percentage",
      discountValue: Number(promoForm.discountValue) || 0,
      minOrderValue: Number(promoForm.minOrderValue) || 0,
      maxDiscountCap: Number(promoForm.maxDiscountCap) || 0,
      usageLimitTotal: Number(promoForm.usageLimitTotal) || 0,
      usageLimitPerUser: Number(promoForm.usageLimitPerUser) || 1,
      active: promoForm.active !== undefined ? promoForm.active : true,
      expiryDate: promoForm.expiryDate || "",
      updatedAt: Timestamp.now(),
    };
    try {
      if (showEditPromoModal) {
        await updateDoc(doc(db, "promoCodes", showEditPromoModal.id), payload);
      } else {
        await addDoc(collection(db, "promoCodes"), {
          ...payload,
          usageCount: 0,
          createdAt: Timestamp.now(),
        });
      }
      setShowAddPromoModal(false);
      setShowEditPromoModal(null);
      setPromoForm({
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
    } catch (err: any) {
      alert("Error saving promo code: " + err.message);
    }
  };

  const deletePromoCode = async (id: string, codeName: string) => {
    if (!window.confirm(`Delete promo code "${codeName}"?`)) return;
    try {
      await deleteDoc(doc(db, "promoCodes", id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const togglePromoActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "promoCodes", id), {
        active: !current,
        updatedAt: Timestamp.now(),
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleExecuteDatabaseReset = async () => {
    if (resetConfirmText !== "CONFIRM-RESET-TRANSACTIONS-ZERO") {
      alert("Please type the exact confirmation phrase: CONFIRM-RESET-TRANSACTIONS-ZERO");
      return;
    }
    setIsResettingDb(true);
    setResetMessage(null);
    try {
      const res = await executeTransactionalReset(resetConfirmText, "Admin Terminal");
      if (res.success) {
        setResetMessage({ type: "success", text: res.message });
        setResetConfirmText("");
      } else {
        setResetMessage({ type: "error", text: res.message });
      }
    } catch (err: any) {
      setResetMessage({ type: "error", text: err.message || "Reset failed" });
    } finally {
      setIsResettingDb(false);
    }
  };

  const addCategory = async (name: string) => {
    try {
      await addDoc(collection(db, "categories"), {
        name,
        order: categories.length + 1,
        enabled: true,
        createdAt: Timestamp.now(),
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const editCategory = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, "categories", id), { name });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const deleteCategory = async (id: string) => {
    if (menuItems.some((item) => item.category === id)) {
      alert("Cannot delete category with menu items. Move items first.");
      return;
    }
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const toggleCategoryEnabled = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    try {
      await updateDoc(doc(db, "categories", id), { enabled: !cat.enabled });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const addSubcategoryToCategory = async (categoryId: string, subName: string) => {
    if (!subName.trim()) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const existingSubs: Subcategory[] = cat.subcategories || [];
    const newSub: Subcategory = {
      id:
        "sub_" +
        subName.toLowerCase().replace(/[^a-z0-9]/g, "_") +
        "_" +
        Date.now().toString().slice(-4),
      name: subName.trim(),
      order: existingSubs.length + 1,
      enabled: true,
    };
    try {
      await updateDoc(doc(db, "categories", categoryId), {
        subcategories: [...existingSubs, newSub],
      });
      alert(`Subcategory "${subName}" added to ${cat.name}!`);
    } catch (err: any) {
      alert("Error adding subcategory: " + err.message);
    }
  };

  const deleteSubcategoryFromCategory = async (categoryId: string, subId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    if (!window.confirm(`Remove this subcategory from ${cat.name}?`)) return;
    const updatedSubs = (cat.subcategories || []).filter((s: any) => s.id !== subId);
    try {
      await updateDoc(doc(db, "categories", categoryId), {
        subcategories: updatedSubs,
      });
    } catch (err: any) {
      alert("Error removing subcategory: " + err.message);
    }
  };

  const addMenuItem = async (item: any) => {
    try {
      await addDoc(collection(db, "menuItems"), {
        ...item,
        order: menuItems.length + 1,
        available: true,
        createdAt: Timestamp.now(),
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const editMenuItem = async (id: string, updated: any) => {
    try {
      await updateDoc(doc(db, "menuItems", id), updated);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (orders.some((o) => o.items?.some((i: any) => i.id === id))) {
      if (!window.confirm("This item is linked to past orders. Delete anyway?")) return;
    }
    try {
      await deleteDoc(doc(db, "menuItems", id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const toggleMenuItemAvailable = async (id: string) => {
    const item = menuItems.find((i) => i.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, "menuItems", id), { available: !item.available });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const cancelOrder = async (id: string, reason: string) => {
    if (window.confirm(`Cancel order ${orders.find((o) => o.id === id)?.orderNumber}?`)) {
      try {
        await updateDoc(doc(db, "orders", id), {
          status: "cancelled",
          updatedAt: Timestamp.now(),
          cancelReason: reason,
        });
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    }
  };

  const assignDeliveryPartner = async (id: string, partnerName: string) => {
    try {
      await updateDoc(doc(db, "orders", id), {
        deliveryPersonName: partnerName || "El Presto Delivery Partner",
        deliveryStatus: "assigned",
        updatedAt: Timestamp.now(),
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const updateDeliveryStatus = async (id: string, deliveryStatus: string) => {
    try {
      const updates: any = { deliveryStatus, updatedAt: Timestamp.now() };
      if (deliveryStatus === "delivered") updates.status = "completed";
      else if (deliveryStatus === "out_for_delivery") updates.status = "ready";
      await updateDoc(doc(db, "orders", id), updates);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const updateSettings = async (newSettings: any) => {
    try {
      await setDoc(doc(db, "settings", "general"), newSettings, { merge: true });
      alert("Settings saved successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  /* ---- Print ---- */
  const printReceipt = (order: any) => {
    const cafeName = settings.cafeName || "EL PRESTO PIZZA";
    const phone = settings.phone || "+91 6392512314";
    const address =
      settings.address || "United College of Engineering and Research, Naini";
    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt || Date.now());
    const dateStr = orderDate.toLocaleString();

    const itemsHtml = order.items
      ?.map(
        (item: any) =>
          `<tr><td>${item.quantity}x ${item.name}</td><td style="text-align:right;">₹${(item.price * item.quantity).toFixed(2)}</td></tr>`
      )
      .join("");

    const total =
      order.total ||
      order.items?.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0) ||
      0;

    const receiptHtml = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
      <style>* { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; width: 58mm; margin: 0 auto; padding: 8px; background: white; color: black; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
      .header h1 { font-size: 16px; font-weight: bold; } .header p { font-size: 10px; margin: 2px 0; }
      .order-info { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; } th, td { padding: 2px 0; border-bottom: 1px dotted #ccc; text-align: left; } th { font-weight: bold; border-bottom: 1px solid #000; }
      .total { font-weight: bold; font-size: 14px; text-align: right; border-top: 1px solid #000; padding-top: 6px; margin-top: 4px; }
      .footer { text-align: center; font-size: 10px; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
      .instructions { font-style: italic; color: #555; margin: 4px 0; }
      </style></head><body>
      <div class="header"><h1>${cafeName}</h1><p>${address}</p><p>${phone}</p></div>
      <div class="order-info"><span><strong>Order #${order.orderNumber}</strong></span><span>${dateStr}</span></div>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Type:</strong> ${order.type === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}</p>
      <table><thead><tr><th>Item</th><th style="text-align:right;">Price</th></tr></thead><tbody>${itemsHtml}</tbody></table>
      <div class="total">Total: ₹${Number(total).toFixed(2)}</div>
      ${order.instructions ? `<div class="instructions">📝 ${order.instructions}</div>` : ""}
      <div class="footer">Eat Without Guilt! 🍕 Visit Again.</div>
      </body></html>`;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      alert("Please allow popups to print receipt.");
    }
  };

  /* =============================================== */
  /* Derived                                         */
  /* =============================================== */
  const getOrderCountByStatus = (status: string) =>
    orders.filter((o) => o.status === status).length;

  const getTotalSalesToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders
      .filter((o) => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && o.status !== "cancelled";
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
  };

  const getTotalOrdersToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.filter((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime() && o.status !== "cancelled";
    }).length;
  };

  const getDeliveryOrdersCount = () =>
    orders.filter((o) => o.type === "delivery" && o.status !== "cancelled").length;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== "all" && o.status !== orderFilter) return false;
    if (searchOrders) {
      const q = searchOrders.toLowerCase();
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCategoriesList: Category[] = useMemo(() => {
    return categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  }, [categories]);

  const enrichedMenuItems = useMemo(() => {
    const active = activeCategoriesList;
    return menuItems.map((item) => {
      const h = resolveItemCategoryHierarchy(item, active);
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
    const cat = activeCategoriesList.find((c) => c.name === adminSelectedCategory);
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
  }, [enrichedMenuItems, adminSelectedCategory, adminSelectedSubcategory, searchMenu]);

  const groupedMenuItems = useMemo(() => {
    const map = new Map<
      string,
      { category: string; subcategory: string; items: any[] }
    >();
    filteredMenuItems.forEach((item) => {
      const key = item.resolvedCategory + ":::" + item.resolvedSubcategory;
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

  const openAddModalForGroup = (catName: string, subName?: string) => {
    setModalCategory(catName);
    const cat = activeCategoriesList.find((c) => c.name === catName);
    const defaultSub = subName || cat?.subcategories?.[0]?.name || "General";
    setModalSubcategory(defaultSub);
    setIsCustomSubcategory(false);
    setCustomSubcategoryText("");
    setShowAddMenuItemModal(true);
  };

  const completedOrders = orders.filter((o) => o.status === "completed");
  const filteredHistory = completedOrders.filter((o) => {
    if (historySearch) {
      const q = historySearch.toLowerCase();
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q)
      );
    }
    if (historyDateFilter) {
      const d = new Date(historyDateFilter);
      d.setHours(0, 0, 0, 0);
      const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      od.setHours(0, 0, 0, 0);
      return od.getTime() === d.getTime();
    }
    return true;
  });

  const exportHistory = () => {
    const headers = ["Order #", "Customer", "Phone", "Type", "Total", "Items", "Date"];
    const rows = filteredHistory.map((o) => [
      o.orderNumber,
      o.customerName,
      o.phone || o.customerPhone,
      o.type,
      o.total,
      o.items?.map((i: any) => `${i.name} x${i.quantity}`).join("; "),
      o.createdAt?.toDate
        ? o.createdAt.toDate().toLocaleString()
        : new Date(o.createdAt).toLocaleString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elpresto_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const toDate = (val: any) => (val?.toDate ? val.toDate() : new Date(val));

  const getFilteredOrdersForReport = () => {
    let filtered = orders.filter((o) => o.status !== "cancelled");
    const now = new Date();
    if (reportPeriod === "daily") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter((o) => toDate(o.createdAt) >= today);
    } else if (reportPeriod === "weekly") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      filtered = filtered.filter((o) => toDate(o.createdAt) >= weekStart);
    } else if (reportPeriod === "monthly") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((o) => toDate(o.createdAt) >= monthStart);
    }
    return filtered;
  };

  const computeBarData = (filteredOrders: any[]) => {
    if (filteredOrders.length === 0) return [];
    const groups = new Map();
    const formatKey = (d: Date) =>
      d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    filteredOrders.forEach((o) => {
      const d = toDate(o.createdAt);
      const key = d.toDateString();
      if (!groups.has(key)) groups.set(key, { name: formatKey(d), revenue: 0, orders: 0 });
      const entry = groups.get(key);
      entry.revenue += o.total || 0;
      entry.orders += 1;
    });
    return Array.from(groups.values()).slice(-7);
  };

  const computePieData = (filteredOrders: any[]) => {
    const takeaway = filteredOrders.filter((o) => o.type === "takeaway").length;
    const delivery = filteredOrders.filter((o) => o.type === "delivery").length;
    return [
      { name: "Takeaway", value: takeaway || 1 },
      { name: "Delivery", value: delivery || 0 },
    ];
  };

  const computeTopItems = (filteredOrders: any[]) => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      o.items?.forEach((i: any) => {
        counts[i.name] = (counts[i.name] || 0) + (i.quantity || 1);
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const CHART_COLORS = ["#f97316", "#06b6d4", "#10b981", "#8b5cf6", "#f43f5e"];

  const computeCategoryAnalytics = () => {
    const itemCategoryMap = new Map<string, string>();
    menuItems.forEach((m) => {
      if (m.name && m.category) {
        itemCategoryMap.set(m.name.toLowerCase().trim(), m.category);
      }
    });
    DUMMY_MENU.forEach((m) => {
      if (m.name && m.category && !itemCategoryMap.has(m.name.toLowerCase().trim())) {
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
        itemBreakdown: Record<string, { name: string; quantity: number; revenue: number }>;
      }
    > = {};

    let grandTotalRevenue = 0;
    let grandTotalItemsSold = 0;

    const validOrders = orders.filter((o) => o.status !== "cancelled");

    validOrders.forEach((order) => {
      order.items?.forEach((item: any) => {
        const itemName = item.name || "Unknown Item";
        const itemKey = itemName.toLowerCase().trim();
        let cat = item.category || itemCategoryMap.get(itemKey) || "Specialties";
        const matchedCat = categories.find((c) => c.id === cat || c.name === cat);
        if (matchedCat) cat = matchedCat.name;
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
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
          stat.itemBreakdown[itemKey] = { name: itemName, quantity: 0, revenue: 0 };
        }
        stat.itemBreakdown[itemKey].quantity += qty;
        stat.itemBreakdown[itemKey].revenue += itemRevenue;
      });
    });

    const categoryList = Object.values(categoryStats).map((stat) => {
      const contributionPercent =
        grandTotalRevenue > 0 ? (stat.totalRevenue / grandTotalRevenue) * 100 : 0;
      const topItems = Object.values(stat.itemBreakdown)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      return { ...stat, contributionPercent, topItems };
    });
    categoryList.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const bestSellingCategory = categoryList.length > 0 ? categoryList[0] : null;
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
  };

  /* =============================================== */
  /* LOGIN GATE                                      */
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
        panel="admin"
        panelDisplayName="Admin Operations Panel"
        panelIcon={<Shield size={28} />}
        onSuccess={(session) => {
          setStaffSession(session);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  /* =============================================== */
  /* Tabs                                            */
  /* =============================================== */
  const activeOrdersCount = orders.filter(
    (o) => o.status === "preparing" || o.status === "ready"
  ).length;
  const kitchenActiveCount = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  ).length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "kitchen", label: "Kitchen Orders", icon: ChefHat, badge: kitchenActiveCount },
    { id: "liveOrders", label: "Live Orders", icon: ShoppingBag, badge: activeOrdersCount },
    { id: "menu", label: "Menu Items", icon: Utensils },
    { id: "categories", label: "Categories", icon: Layers },
    { id: "history", label: "Order History", icon: History },
    { id: "sales", label: "Sales Analytics", icon: BarChart3 },
    { id: "promoCodes", label: "Promo Codes", icon: Tag },
    { id: "panelAccess", label: "Panel Access", icon: ShieldCheck },
    { id: "dbReset", label: "Database Reset", icon: AlertTriangle },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const tabTitle: Record<string, string> = {
    dashboard: "Operations Overview",
    kitchen: "Kitchen Orders Management",
    liveOrders: "Live Orders Dispatch",
    menu: "Menu Management",
    categories: "Categories & Subcategories",
    history: "Order History Archive",
    sales: "Sales & Revenue Analytics",
    promoCodes: "Discounts & Promo Codes",
    panelAccess: "Panel Access & Security",
    dbReset: "Database Reset",
    settings: "Store Settings",
  };

  /* =============================================== */
  /* Renderers                                       */
  /* =============================================== */
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Today's Revenue"
          value={`₹${getTotalSalesToday().toFixed(0)}`}
          sub={`${getTotalOrdersToday()} orders today`}
          icon={<IndianRupee size={20} />}
          gradient="from-emerald-500/20 to-teal-500/5"
          border="border-emerald-500/30"
          iconGradient="from-emerald-500 to-teal-500"
        />
        <MetricCard
          label="Total Orders"
          value={getTotalOrdersToday()}
          sub={`${getDeliveryOrdersCount()} delivery`}
          icon={<ShoppingBag size={20} />}
          gradient="from-orange-500/20 to-amber-500/5"
          border="border-orange-500/30"
          iconGradient="from-orange-500 to-amber-500"
        />
        <MetricCard
          label="In Kitchen"
          value={getOrderCountByStatus("preparing")}
          sub="Actively preparing"
          icon={<Flame size={20} />}
          gradient="from-amber-500/20 to-yellow-500/5"
          border="border-amber-500/30"
          iconGradient="from-amber-500 to-yellow-500"
        />
        <MetricCard
          label="Ready / In Transit"
          value={getOrderCountByStatus("ready")}
          sub="Awaiting pickup"
          icon={<Truck size={20} />}
          gradient="from-blue-500/20 to-indigo-500/5"
          border="border-blue-500/30"
          iconGradient="from-blue-500 to-indigo-500"
        />
      </div>

      {/* Quick ops */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Live queue */}
        <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-slate-900/60 p-5 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Live Order Queue</h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  Real-time incoming orders
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("liveOrders")}
              className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-orange-400 transition hover:bg-white/10"
            >
              View all
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
            {orders.filter((o) => o.status !== "completed" && o.status !== "cancelled")
              .length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-800/60">
                  <Coffee size={26} className="text-slate-600" />
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
                .filter((o) => o.status !== "completed" && o.status !== "cancelled")
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
                        ₹{Math.round(o.total || 0)}
                      </span>
                      <button
                        onClick={() => updateOrderStatus(o.id, "ready")}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:scale-[1.03] active:scale-95"
                      >
                        Ready
                      </button>
                      <button
                        onClick={() => setShowOrderDetailsModal(o)}
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

        {/* Shortcuts */}
        <div className="space-y-4 rounded-3xl border border-white/5 bg-slate-900/60 p-5 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/25">
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
            <QuickLink href="/menu" emoji="🍕" label="Customer Menu" accent="amber" />
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-300">
              <Compass size={12} /> Hub Coordinates
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

  const renderLiveOrders = () => {
    const statusCounts = {
      all: orders.length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      ready: orders.filter((o) => o.status === "ready").length,
      completed: orders.filter((o) => o.status === "completed").length,
    };

    return (
      <div className="space-y-5">
        {/* Filter bar */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                size={15}
              />
              <input
                type="text"
                placeholder="Search order #, customer…"
                className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={searchOrders}
                onChange={(e) => setSearchOrders(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
                {(["all", "preparing", "ready", "completed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilter(status)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                      orderFilter === status
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {status} <span className="ml-0.5 opacity-80">({statusCounts[status]})</span>
                  </button>
                ))}
              </div>

              {newOrderNotification && (
                <span className="animate-pulse rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                  🔔 New Order!
                </span>
              )}

              <button
                onClick={() => setLoading((p) => ({ ...p, orders: true }))}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-400 transition hover:text-white"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Orders list */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
                <ShoppingBag size={36} className="text-slate-600" />
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
                onMarkPaid={() =>
                  updateDoc(doc(db, "orders", o.id), { paymentStatus: "paid" })
                }
                onMarkReady={() => updateOrderStatus(o.id, "ready")}
                onComplete={() => updateOrderStatus(o.id, "completed")}
                onCancel={() => cancelOrder(o.id, "Manager cancelled")}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const renderKitchenOrders = () => {
    const kitchenOrders = orders.filter((o) => {
      if (kitchenStatusFilter === "pending" && o.status !== "pending") return false;
      if (kitchenStatusFilter === "preparing" && o.status !== "preparing") return false;
      if (kitchenStatusFilter === "ready" && o.status !== "ready") return false;
      if (kitchenStatusFilter === "completed" && o.status !== "completed") return false;
      if (
        kitchenStatusFilter === "active" &&
        (o.status === "completed" || o.status === "cancelled")
      )
        return false;
      if (kitchenSourceFilter !== "all") {
        const src = (o.source || "").toLowerCase();
        if (
          kitchenSourceFilter === "kitchen" &&
          src !== "kitchen" &&
          src !== "on_spot" &&
          !(o.kitchenNotes && o.kitchenNotes.includes("kitchen"))
        )
          return false;
        if (
          kitchenSourceFilter === "website" &&
          src !== "website" &&
          (src === "kitchen" || src === "swiggy" || src === "zomato")
        )
          return false;
        if (kitchenSourceFilter === "swiggy" && src !== "swiggy") return false;
        if (kitchenSourceFilter === "zomato" && src !== "zomato") return false;
      }
      if (kitchenSearchQuery) {
        const q = kitchenSearchQuery.toLowerCase();
        return (
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.items?.some((i: any) => i.name?.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const counts = {
      pending: orders.filter((o) => o.status === "pending").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      ready: orders.filter((o) => o.status === "ready").length,
      completed: orders.filter((o) => o.status === "completed").length,
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/90 p-5 shadow-[0_15px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-6">
          <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-white/10">
                <ChefHat size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-black text-white sm:text-lg">
                  Kitchen Live Operations
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400 ring-1 ring-orange-500/30">
                    {counts.pending + counts.preparing + counts.ready} Active
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
              className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
            >
              Open Dedicated KDS <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniMetric
            label="New"
            value={counts.pending}
            color="amber"
            icon={<Bell size={18} />}
          />
          <MiniMetric
            label="Preparing"
            value={counts.preparing}
            color="orange"
            icon={<Flame size={18} />}
          />
          <MiniMetric
            label="Ready"
            value={counts.ready}
            color="blue"
            icon={<Truck size={18} />}
          />
          <MiniMetric
            label="Completed"
            value={counts.completed}
            color="emerald"
            icon={<CheckCircle size={18} />}
          />
        </div>

        {/* Filters */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                size={14}
              />
              <input
                type="text"
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
                    onClick={() => setKitchenStatusFilter(s.id)}
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

              <select
                value={kitchenSourceFilter}
                onChange={(e) => setKitchenSourceFilter(e.target.value)}
                className="rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black text-white focus:outline-none"
              >
                <option value="all">All Channels</option>
                <option value="kitchen">🏪 On Spot</option>
                <option value="website">🌐 Website</option>
                <option value="swiggy">🟠 Swiggy</option>
                <option value="zomato">🔴 Zomato</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets grid */}
        {kitchenOrders.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
              <ChefHat size={36} className="text-slate-600" />
            </div>
            <p className="mt-4 text-sm font-black text-slate-400">
              No kitchen orders matching filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kitchenOrders.map((order: any) => {
              const src = (order.source || "").toLowerCase();
              const isEditable =
                src === "kitchen" ||
                src === "on_spot" ||
                (order.kitchenNotes && order.kitchenNotes.includes("kitchen"));
              const orderDate = order.createdAt?.toDate
                ? order.createdAt.toDate()
                : new Date(order.createdAt || Date.now());
              const elapsedMins = Math.floor((Date.now() - orderDate.getTime()) / 60000);
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
                  {/* header */}
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
                        <Clock size={9} /> {elapsedMins}m
                      </span>
                    </div>

                    {/* status row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip status={order.status} />
                      {isEditable ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <Edit size={10} /> Editable
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Lock size={10} /> Locked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* items */}
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-slate-800/40 p-2.5 text-xs">
                    {order.items?.map((item: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-slate-200"
                      >
                        <span className="truncate">
                          <strong className="mr-1.5 font-mono text-orange-400">
                            {item.quantity}×
                          </strong>
                          {item.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-400">
                          ₹{((item.price || 0) * item.quantity).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.instructions && (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] font-bold text-amber-300">
                      📝 {order.instructions}
                    </p>
                  )}

                  {/* footer */}
                  <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <span className="font-mono text-base font-black text-emerald-400">
                      ₹{Math.round(order.total || 0)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {order.status === "pending" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "preparing")}
                          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                        >
                          Start Prep
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "ready")}
                          className="rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-500 hover:scale-[1.03] active:scale-95"
                        >
                          Mark Ready
                        </button>
                      )}
                      {order.status === "ready" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "completed")}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-500 hover:scale-[1.03] active:scale-95"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => printReceipt(order)}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        onClick={() => setShowOrderDetailsModal(order)}
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
  };

  const renderMenuManagement = () => (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={15}
            />
            <input
              type="text"
              placeholder="Search items by name, category, or description…"
              className="w-full rounded-2xl border border-white/5 bg-slate-800/80 py-3 pl-11 pr-9 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              value={searchMenu}
              onChange={(e) => setSearchMenu(e.target.value)}
            />
            {searchMenu && (
              <button
                onClick={() => setSearchMenu("")}
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
              onClick={() => {
                setModalCategory(
                  adminSelectedCategory !== "all" ? adminSelectedCategory : "Food"
                );
                const cat = activeCategoriesList.find(
                  (c) =>
                    c.name ===
                    (adminSelectedCategory !== "all" ? adminSelectedCategory : "Food")
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
              <Plus size={15} strokeWidth={3} /> Add Product
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="mt-4 border-t border-white/5 pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Folder size={12} className="text-orange-400" />
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

          {/* Subcategories */}
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

      {/* Grouped items */}
      {groupedMenuItems.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
            <Utensils size={36} className="text-slate-600" />
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
            onClick={() => {
              setModalCategory(
                adminSelectedCategory !== "all" ? adminSelectedCategory : "Food"
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
            <Plus size={14} strokeWidth={3} /> Add Item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMenuItems.map((group) => (
            <div
              key={group.category + "-" + group.subcategory}
              className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                    <Utensils size={16} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {group.category}
                      </span>
                      <ChevronRight size={12} className="text-slate-600" />
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
                  onClick={() =>
                    openAddModalForGroup(group.category, group.subcategory)
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-orange-300 transition hover:bg-orange-500/20"
                >
                  <Plus size={12} strokeWidth={3} /> Add
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
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          {item.isVeg !== false ? "Veg" : "Non-Veg"}
                        </span>
                        <div className="flex items-center gap-1">
                          <IconAction
                            onClick={() => toggleMenuItemAvailable(item.id)}
                            title={item.available !== false ? "Mark sold out" : "Restore"}
                            variant={item.available !== false ? "success" : "danger"}
                          >
                            {item.available !== false ? (
                              <CheckCircle size={13} />
                            ) : (
                              <CircleOff size={13} />
                            )}
                          </IconAction>
                          <IconAction
                            onClick={() => {
                              setModalCategory(item.resolvedCategory || "Food");
                              setModalSubcategory(item.resolvedSubcategory || "General");
                              setIsCustomSubcategory(false);
                              setCustomSubcategoryText("");
                              setShowEditMenuItemModal(item);
                            }}
                            title="Edit"
                          >
                            <Edit size={13} />
                          </IconAction>
                          <IconAction
                            onClick={() => deleteMenuItem(item.id)}
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
                          ₹{item.price}
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
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
        <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 ring-1 ring-white/10">
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
            onClick={() => setShowAddCategoryModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
          >
            <Plus size={15} strokeWidth={3} /> Add Category
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
              className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                    <Folder size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">{cat.name}</span>
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
                    onClick={() => setShowEditCategoryModal(cat)}
                    title="Rename"
                  >
                    <Edit size={14} />
                  </IconAction>
                  <IconAction
                    onClick={() => deleteCategory(cat.id)}
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
                    <Tag size={11} className="text-amber-400" />
                    {subs.length} Subcategories
                  </span>
                  <button
                    onClick={() => {
                      setShowAddSubModal(cat);
                      setNewSubNameInput("");
                    }}
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-orange-400 transition hover:text-orange-300"
                  >
                    <Plus size={12} strokeWidth={3} /> Add
                  </button>
                </div>

                {subs.length === 0 ? (
                  <p className="py-2 text-[11px] font-semibold italic text-slate-500">
                    No subcategories yet. Add one above.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {subs.map((sub: any) => {
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
                            onClick={() =>
                              deleteSubcategoryFromCategory(cat.id, sub.id)
                            }
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
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                size={15}
              />
              <input
                type="text"
                placeholder="Search history…"
                className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <input
              type="date"
              className="rounded-xl border border-white/5 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-white focus:border-orange-500/40 focus:outline-none"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
            />
          </div>

          <button
            onClick={exportHistory}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-200 transition hover:bg-slate-700"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <History size={36} className="text-slate-700" />
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
                    <td className="px-4 py-3 font-semibold">{o.customerName}</td>
                    <td className="px-4 py-3">
                      {o.type === "delivery" ? "🛵 Delivery" : "🛍️ Pickup"}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-emerald-400">
                      ₹{Math.round(o.total || 0)}
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
                          ? "✓ Paid"
                          : "⏳ Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {o.createdAt?.toDate
                        ? o.createdAt.toDate().toLocaleDateString()
                        : new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-400">
                      {o.items?.map((i: any) => `${i.name} x${i.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => printReceipt(o)}
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
    const filteredOrdersForReport = getFilteredOrdersForReport();
    const barData = computeBarData(filteredOrdersForReport);
    const pieData = computePieData(filteredOrdersForReport);
    const topItems = computeTopItems(filteredOrdersForReport);

    const totalRevenue = filteredOrdersForReport.reduce(
      (sum, o) => sum + (o.total || 0),
      0
    );
    const totalOrders = filteredOrdersForReport.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const catAnalytics = computeCategoryAnalytics();
    const { categoryList, bestSellingCategory, categoryBarData, categoryPieData } =
      catAnalytics;

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/10">
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

            <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-slate-950 p-1">
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <button
                  key={period}
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

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Period Revenue"
            value={`₹${totalRevenue.toFixed(0)}`}
            icon={<IndianRupee size={18} />}
            color="emerald"
          />
          <KpiCard
            label="Total Orders"
            value={totalOrders}
            icon={<ShoppingBag size={18} />}
            color="orange"
          />
          <KpiCard
            label="Avg Ticket"
            value={`₹${avgOrderValue.toFixed(0)}`}
            icon={<TrendingUp size={18} />}
            color="blue"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Modern3DBarChart
              data={barData}
              title="3D Revenue Trend"
              theme="orange"
            />
          </div>

          <div className="flex flex-col justify-between gap-4">
            <Modern3DDonutChart
              data={pieData}
              title="3D Order Split"
            />

            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Top Sellers
              </p>
              <div className="space-y-1.5 text-xs">
                {topItems.map(([name, qty], idx) => (
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
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category analytics */}
        <div className="space-y-5 border-t border-white/5 pt-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25">
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
                <Award size={13} className="text-amber-400" />
                <span className="text-amber-300">Best: {bestSellingCategory.category}</span>
                <span className="font-mono text-emerald-400">
                  ₹{Math.round(bestSellingCategory.totalRevenue)}
                </span>
                <span className="text-amber-400">
                  ({bestSellingCategory.contributionPercent.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {/* 3D Category Performance Pillars */}
          <Modern3DCategoryChart
            data={categoryBarData}
            title="3D Category Revenue & Volume"
            subtitle="Multi-dimensional sales performance by menu section"
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Modern3DBarChart
                data={categoryBarData}
                title="3D Category Revenue Comparison"
                theme="emerald"
              />
            </div>

            <div>
              <Modern3DDonutChart
                data={categoryPieData}
                title="3D Category Share"
                totalLabel="Category Sales"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryList.map((cat, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl transition hover:border-white/10"
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
                      {cat.topItems.slice(0, 3).map((item: any, i: number) => (
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
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
        <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25 ring-1 ring-white/10">
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
            <Plus size={15} strokeWidth={3} /> Create Promo
          </button>
        </div>
      </div>

      {/* Promo grid */}
      {promoCodes.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/50 py-20">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800/60">
            <Tag size={36} className="text-slate-600" />
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
              p.expiryDate && new Date(p.expiryDate).getTime() < Date.now();
            const isExhausted = p.usageLimitTotal
              ? (p.usageCount || 0) >= p.usageLimitTotal
              : false;
            const isLive = p.active && !isExpired && !isExhausted;

            return (
              <div
                key={p.id}
                className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl transition hover:border-white/10"
              >
                <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />

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
                        {isLive ? "Live" : isExpired ? "Expired" : isExhausted ? "Limit hit" : "Inactive"}
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
                        setPromoForm(p);
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
                      ? new Date(p.expiryDate).toLocaleDateString()
                      : "Never"}
                  </span>
                  <button
                    onClick={() => togglePromoActive(p.id, p.active)}
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

      {/* Audit log */}
      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <History size={15} className="text-orange-400" />
          <h3 className="text-sm font-black text-white">Redemption Audit Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="py-2.5 pr-3">Promo</th>
                <th className="py-2.5 pr-3">Order</th>
                <th className="py-2.5 pr-3">User</th>
                <th className="py-2.5 pr-3">Discount</th>
                <th className="py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {promoUsageLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No redemption records yet.
                  </td>
                </tr>
              ) : (
                promoUsageLogs.slice(0, 15).map((log, idx) => (
                  <tr key={idx} className="text-slate-300 transition hover:bg-white/5">
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
                      {log.usedAt?.toDate
                        ? log.usedAt.toDate().toLocaleString()
                        : "Recently"}
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
        <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-white sm:text-lg">
              Database Reset to Zero
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-red-200/80">
              Purges all transactional data (past orders, invoices, promo
              redemption logs) back to zero. Product catalog, categories, store
              settings, and passwords are preserved.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
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
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <Check size={11} strokeWidth={3} />
              </span>
              <span className="text-slate-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 backdrop-blur-xl">
        <SectionHeader
          icon={<Key size={18} />}
          title="Execute Reset"
          subtitle="Type the exact phrase to unlock"
        />

        <div className="mb-4">
          <p className="mb-2 select-all rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[11px] font-black text-amber-300">
            CONFIRM-RESET-TRANSACTIONS-ZERO
          </p>
          <input
            type="text"
            placeholder="Type the phrase above…"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            className="w-full rounded-xl border border-white/5 bg-slate-800/70 px-4 py-3 font-mono text-xs font-semibold text-white placeholder-slate-500 transition focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {resetMessage && (
          <div
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
            resetConfirmText !== "CONFIRM-RESET-TRANSACTIONS-ZERO" || isResettingDb
          }
          onClick={handleExecuteDatabaseReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3.5 text-xs font-black text-white shadow-lg shadow-red-600/30 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isResettingDb ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Executing Reset…
            </>
          ) : (
            <>
              <AlertTriangle size={15} /> Execute Reset to Zero
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSettings = () => {
    const handleChange = (key: string, value: any) =>
      setSettings((prev) => ({ ...prev, [key]: value }));

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Store profile */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Store size={18} />}
            title="Store Profile"
            subtitle="Brand info and operating hours"
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Brand Name</label>
              <input
                type="text"
                className={inputCls}
                value={settings.cafeName}
                onChange={(e) => handleChange("cafeName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Order Hotline</label>
              <input
                type="text"
                className={inputCls}
                value={settings.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Address</label>
              <input
                type="text"
                className={inputCls}
                value={settings.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Opening Time</label>
              <input
                type="time"
                className={inputCls}
                value={settings.openTime}
                onChange={(e) => handleChange("openTime", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Closing Time</label>
              <input
                type="time"
                className={inputCls}
                value={settings.closeTime}
                onChange={(e) => handleChange("closeTime", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Truck size={18} />}
            title="Delivery Hub & Radius"
            subtitle="Configure logistics and coverage"
          />

          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-white">Enable Home Delivery</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Show delivery option at customer checkout
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleChange("deliveryEnabled", !settings.deliveryEnabled)
              }
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
              <label className={labelCls}>Hub Latitude</label>
              <input
                type="number"
                step="0.0000001"
                className={inputCls}
                value={settings.cafeLat}
                onChange={(e) => handleChange("cafeLat", parseFloat(e.target.value))}
              />
              <p className="mt-1.5 font-mono text-[10px] font-bold text-slate-500">
                UCER: 25.3409769
              </p>
            </div>
            <div>
              <label className={labelCls}>Hub Longitude</label>
              <input
                type="number"
                step="0.0000001"
                className={inputCls}
                value={settings.cafeLng}
                onChange={(e) => handleChange("cafeLng", parseFloat(e.target.value))}
              />
              <p className="mt-1.5 font-mono text-[10px] font-bold text-slate-500">
                UCER: 81.9116436
              </p>
            </div>
            <div>
              <label className={labelCls}>Delivery Radius (km)</label>
              <input
                type="number"
                step="0.5"
                className={inputCls}
                value={settings.deliveryRadiusKm}
                onChange={(e) =>
                  handleChange("deliveryRadiusKm", parseFloat(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelCls}>Base Fee (₹)</label>
              <input
                type="number"
                className={inputCls}
                value={settings.baseDeliveryFee}
                onChange={(e) =>
                  handleChange("baseDeliveryFee", parseFloat(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelCls}>Free Delivery Above (₹)</label>
              <input
                type="number"
                className={inputCls}
                value={settings.freeDeliveryThreshold}
                onChange={(e) =>
                  handleChange("freeDeliveryThreshold", parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        </div>

        {/* Trending */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
          <SectionHeader
            icon={<Flame size={18} />}
            title="Trending Section"
            subtitle="Control customer menu trending carousel"
            action={
              trendingSaveMsg ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  ✓ Saved
                </span>
              ) : undefined
            }
          />

          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-white">Enable Trending Now</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                Show carousel at top of customer menu
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const updated = { ...trendingSettings, enabled: !trendingSettings.enabled };
                setTrendingSettings(updated);
                await saveTrendingSettings(updated);
                setTrendingSaveMsg("Saved!");
                setTimeout(() => setTrendingSaveMsg(null), 2500);
              }}
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
              <label className={labelCls}>Calculation Mode</label>
              <select
                className={inputCls}
                value={trendingSettings.mode}
                onChange={async (e) => {
                  const mode = e.target.value as "auto" | "manual";
                  const updated = { ...trendingSettings, mode };
                  setTrendingSettings(updated);
                  await saveTrendingSettings(updated);
                }}
              >
                <option value="auto">Automatic (from real orders)</option>
                <option value="manual">Manual (curated)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Max Items</label>
              <input
                type="number"
                min="2"
                max="12"
                className={inputCls}
                value={trendingSettings.maxItems || 6}
                onChange={async (e) => {
                  const maxItems = parseInt(e.target.value) || 6;
                  const updated = { ...trendingSettings, maxItems };
                  setTrendingSettings(updated);
                  await saveTrendingSettings(updated);
                }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => updateSettings(settings)}
          className="mx-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
        >
          <Save size={16} /> Save All Settings
        </button>
      </div>
    );
  };

  const handleTogglePanel = async (panelKey: keyof PanelAccessData) => {
    const current = panelAccess[panelKey];
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
      setPanelSaveMsg(`Successfully updated ${current.name} status.`);
      setTimeout(() => setPanelSaveMsg(null), 3000);
    } catch (err: any) {
      alert("Failed to update panel status: " + err.message);
    }
  };

  const handleUpdatePanelPin = async (panelKey: keyof PanelAccessData) => {
    const newPin = panelPinInputs[panelKey]?.trim();
    if (!newPin) return alert("Please enter a valid non-empty PIN.");
    if (newPin.length < 4) return alert("PIN must be at least 4 characters.");

    const current = panelAccess[panelKey];
    const updated: PanelAccessData = {
      ...panelAccess,
      [panelKey]: { ...current, pin: newPin, updatedAt: Timestamp.now() },
    };

    try {
      await savePanelAccessSettings(updated);
      setPanelAccess(updated);
      setPanelPinInputs((prev) => ({ ...prev, [panelKey]: "" }));
      setPanelSaveMsg(`Updated password for ${current.name}!`);
      setTimeout(() => setPanelSaveMsg(null), 3500);
    } catch (err: any) {
      alert("Failed to save password: " + err.message);
    }
  };

  const renderPanelAccess = () => {
    const panelConfigs = [
      {
        key: "admin" as const,
        title: "Admin Management Portal",
        route: "/admin",
        icon: ShieldCheck,
        defaultPin: "admin9090",
        desc: "Main operations, revenue analytics, menu, and settings.",
        gradient: "from-orange-500 to-amber-500",
      },
      {
        key: "kitchen" as const,
        title: "Kitchen Station Display",
        route: "/kitchen",
        icon: ChefHat,
        defaultPin: "kitchen1234",
        desc: "Live order queue, KOT receipts, prep timers, and dispatch.",
        gradient: "from-amber-500 to-yellow-500",
      },
      {
        key: "counter" as const,
        title: "Counter POS & Cashier",
        route: "/counter",
        icon: Store,
        defaultPin: "counter1234",
        desc: "Quick billing, thermal receipt printing, customer linking.",
        gradient: "from-blue-500 to-indigo-500",
      },
      {
        key: "delivery" as const,
        title: "Delivery Fleet Portal",
        route: "/delivery",
        icon: Truck,
        defaultPin: "delivery1234",
        desc: "GPS rider tracking, OTP verification, and order completion.",
        gradient: "from-emerald-500 to-teal-500",
      },
    ];

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
          <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/10">
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

        {/* Centralized Multi-Outlet Developer Platform Hub */}
        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 p-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Centralized Developer &amp; Multi-Outlet Platform</h3>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-indigo-300 border border-indigo-500/30">
                    Cross-Branch
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage multiple restaurant outlets, kitchens, counters, delivery fleets, RBAC roles, and audit trails.
                </p>
              </div>
            </div>

            <Link
              href="/developer"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.02] active:scale-95 shrink-0"
            >
              Open Developer Hub &rarr;
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {panelConfigs.map((item) => {
            const config = panelAccess[item.key] || DEFAULT_PANEL_CONFIGS[item.key];
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
                      className={`h-1.5 w-1.5 rounded-full ${
                        isEnabled ? "animate-pulse bg-emerald-400" : "bg-red-500"
                      }`}
                    />
                    {isEnabled ? "Active" : "Disabled"}
                  </span>
                </div>

                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  {item.desc}
                </p>

                <button
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
                      <Key size={11} className="text-orange-400" /> Current PIN
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="max-w-[140px] truncate rounded-lg border border-white/5 bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-black text-amber-300">
                        {showPin ? config.pin : "••••••••"}
                      </span>
                      <button
                        onClick={() =>
                          setShowPinMap((prev) => ({ ...prev, [item.key]: !showPin }))
                        }
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 transition hover:text-white"
                      >
                        {showPin ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`New PIN (min 4 chars)…`}
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

  /* =============================================== */
  /* MAIN LAYOUT                                     */
  /* =============================================== */
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 lg:flex-row">
      {/* ============================================= */}
      {/* SIDEBAR                                        */}
      {/* ============================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-white/5 bg-slate-900/95 p-4 backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-500 text-2xl shadow-lg shadow-orange-500/30 ring-1 ring-white/10">
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
              onClick={() => setIsSidebarOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 transition hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick stats */}
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

          {/* Nav */}
          <nav className="space-y-1">
            {navItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-800/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
            <span className="font-mono">UCER</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-black text-red-400 transition hover:bg-red-500/20"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ============================================= */}
      {/* MAIN                                          */}
      {/* ============================================= */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-slate-900/70 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400 transition hover:text-white lg:hidden"
            >
              <MenuIcon size={16} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-white sm:text-base">
                {tabTitle[activeTab] || activeTab}
              </h2>
              <p className="hidden truncate text-[10px] font-black uppercase tracking-widest text-slate-500 sm:block">
                Live Store Operations
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !settings.soundEnabled;
                setSettings((p) => ({ ...p, soundEnabled: next }));
                soundEnabledRef.current = next;
                if (next) playNotificationSound();
              }}
              className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                settings.soundEnabled
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/5 bg-slate-800 text-slate-500"
              }`}
              title="Sound notifications"
            >
              {settings.soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </button>

            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-200 transition hover:bg-slate-700 sm:flex"
            >
              View Site <ExternalLink size={11} />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "kitchen" && renderKitchenOrders()}
          {activeTab === "liveOrders" && renderLiveOrders()}
          {activeTab === "menu" && renderMenuManagement()}
          {activeTab === "categories" && renderCategoryManagement()}
          {activeTab === "history" && renderOrderHistory()}
          {activeTab === "sales" && renderSalesReports()}
          {activeTab === "panelAccess" && renderPanelAccess()}
          {activeTab === "promoCodes" && renderPromoCodes()}
          {activeTab === "dbReset" && renderDbReset()}
          {activeTab === "settings" && renderSettings()}
        </main>
      </div>

      {/* ============================================= */}
      {/* MODALS                                        */}
      {/* ============================================= */}

      {/* Promo modal */}
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
            <label className={labelCls}>Promo Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. PRESTO50"
              value={promoForm.code || ""}
              onChange={(e) =>
                setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })
              }
              className={`${inputCls} font-mono font-black`}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <input
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
              <label className={labelCls}>Type *</label>
              <select
                value={promoForm.discountType || "percentage"}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, discountType: e.target.value as any })
                }
                className={inputCls}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Value *</label>
              <input
                type="number"
                required
                min="1"
                value={promoForm.discountValue || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    discountValue: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Min Order (₹)</label>
              <input
                type="number"
                min="0"
                value={promoForm.minOrderValue || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    minOrderValue: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Max Cap (₹)</label>
              <input
                type="number"
                min="0"
                value={promoForm.maxDiscountCap || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    maxDiscountCap: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Total Uses</label>
              <input
                type="number"
                min="1"
                value={promoForm.usageLimitTotal || ""}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    usageLimitTotal: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Per User</label>
              <input
                type="number"
                min="1"
                value={promoForm.usageLimitPerUser || 1}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    usageLimitPerUser: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input
                type="date"
                value={promoForm.expiryDate || ""}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, expiryDate: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={promoForm.active ? "true" : "false"}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, active: e.target.value === "true" })
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

      {/* Category add */}
      <Modal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        title="Add Category"
      >
        <form
          onSubmit={async (e: any) => {
            e.preventDefault();
            const name = e.target.name.value;
            if (name) {
              await addCategory(name);
              setShowAddCategoryModal(false);
            }
          }}
          className="space-y-4"
        >
          <input name="name" className={inputCls} placeholder="Category name" required />
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white transition hover:scale-[1.01] active:scale-95"
          >
            Create Category
          </button>
        </form>
      </Modal>

      {/* Category edit */}
      <Modal
        isOpen={!!showEditCategoryModal}
        onClose={() => setShowEditCategoryModal(null)}
        title="Edit Category"
      >
        <form
          onSubmit={async (e: any) => {
            e.preventDefault();
            const name = e.target.name.value;
            if (name && showEditCategoryModal) {
              await editCategory(showEditCategoryModal.id, name);
              setShowEditCategoryModal(null);
            }
          }}
          className="space-y-4"
        >
          <input
            name="name"
            defaultValue={showEditCategoryModal?.name || ""}
            className={inputCls}
            required
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white transition hover:scale-[1.01] active:scale-95"
          >
            Update Category
          </button>
        </form>
      </Modal>

      {/* Menu item add */}
      <Modal
        isOpen={showAddMenuItemModal}
        onClose={() => setShowAddMenuItemModal(false)}
        title="Add Menu Product"
      >
        <form
          onSubmit={async (e: any) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const name = (fd.get("name") as string)?.trim();
            const price = parseFloat(fd.get("price") as string);
            const category = modalCategory;
            const subcategory = isCustomSubcategory
              ? customSubcategoryText.trim()
              : modalSubcategory;
            if (!name) return alert("Product name is required.");
            if (isNaN(price) || price < 0) return alert("Enter valid price.");
            if (!category || !subcategory) return alert("Select category & subcategory.");

            await addMenuItem({
              name,
              category,
              subcategory,
              price,
              description: (fd.get("description") as string)?.trim() || "",
              imageUrl:
                (fd.get("image") as string)?.trim() ||
                "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
              available: true,
              isVeg: fd.get("isVeg") === "on",
            });
            setShowAddMenuItemModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Product Name *</label>
            <input
              name="name"
              placeholder="e.g. Farmhouse Pizza"
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Category *</label>
              <select
                value={modalCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setModalCategory(newCat);
                  const found = activeCategoriesList.find((c) => c.name === newCat);
                  setModalSubcategory(found?.subcategories?.[0]?.name || "General");
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
              <label className={labelCls}>Subcategory *</label>
              <select
                value={isCustomSubcategory ? "__custom__" : modalSubcategory}
                onChange={(e) => {
                  if (e.target.value === "__custom__") setIsCustomSubcategory(true);
                  else {
                    setIsCustomSubcategory(false);
                    setModalSubcategory(e.target.value);
                  }
                }}
                className={inputCls}
                required
              >
                {(activeCategoriesList.find((c) => c.name === modalCategory)
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
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-amber-400">
                New Subcategory Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Waffles"
                value={customSubcategoryText}
                onChange={(e) => setCustomSubcategoryText(e.target.value)}
                className="w-full rounded-xl border border-amber-500/60 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Price (₹) *</label>
              <input
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
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Pure Veg
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              name="description"
              placeholder="Ingredients, toppings, base…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Image URL</label>
            <input
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
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
            >
              Save Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Menu item edit */}
      <Modal
        isOpen={!!showEditMenuItemModal}
        onClose={() => setShowEditMenuItemModal(null)}
        title="Edit Menu Product"
      >
        {showEditMenuItemModal && (
          <form
            onSubmit={async (e: any) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const name = (fd.get("name") as string)?.trim();
              const price = parseFloat(fd.get("price") as string);
              const category = modalCategory;
              const subcategory = isCustomSubcategory
                ? customSubcategoryText.trim()
                : modalSubcategory;
              if (!name) return alert("Product name is required.");
              if (isNaN(price) || price < 0) return alert("Enter valid price.");
              await editMenuItem(showEditMenuItemModal.id, {
                name,
                category,
                subcategory,
                price,
                description: (fd.get("description") as string)?.trim() || "",
                imageUrl:
                  (fd.get("image") as string)?.trim() ||
                  showEditMenuItemModal.imageUrl ||
                  "",
                available: fd.get("available") === "on",
                isVeg: fd.get("isVeg") === "on",
              });
              setShowEditMenuItemModal(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className={labelCls}>Product Name *</label>
              <input
                name="name"
                defaultValue={showEditMenuItemModal.name}
                className={inputCls}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Category *</label>
                <select
                  value={modalCategory}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setModalCategory(newCat);
                    const found = activeCategoriesList.find((c) => c.name === newCat);
                    setModalSubcategory(found?.subcategories?.[0]?.name || "General");
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
                <label className={labelCls}>Subcategory *</label>
                <select
                  value={isCustomSubcategory ? "__custom__" : modalSubcategory}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") setIsCustomSubcategory(true);
                    else {
                      setIsCustomSubcategory(false);
                      setModalSubcategory(e.target.value);
                    }
                  }}
                  className={inputCls}
                  required
                >
                  {(activeCategoriesList.find((c) => c.name === modalCategory)
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
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-amber-400">
                  New Subcategory Name *
                </label>
                <input
                  type="text"
                  value={customSubcategoryText}
                  onChange={(e) => setCustomSubcategoryText(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/60 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Price (₹) *</label>
                <input
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
                  <span className="text-xs font-black text-white">In Stock</span>
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
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Veg
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                name="description"
                defaultValue={showEditMenuItemModal.description || ""}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className={labelCls}>Image URL</label>
              <input
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
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
              >
                Update Product
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add subcategory */}
      <Modal
        isOpen={!!showAddSubModal}
        onClose={() => setShowAddSubModal(null)}
        title={`Add Subcategory to ${showAddSubModal?.name || "Category"}`}
      >
        {showAddSubModal && (
          <form
            onSubmit={async (e: any) => {
              e.preventDefault();
              if (newSubNameInput.trim()) {
                await addSubcategoryToCategory(showAddSubModal.id, newSubNameInput);
                setShowAddSubModal(null);
                setNewSubNameInput("");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className={labelCls}>Subcategory Name</label>
              <input
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

      {/* Order details */}
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
              <StatusChip status={showOrderDetailsModal.status} />
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
                    <Truck size={14} /> Delivery Info
                  </span>
                  {showOrderDetailsModal.deliveryDistance && (
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      ~{showOrderDetailsModal.deliveryDistance} km
                    </span>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300">
                  {showOrderDetailsModal.deliveryAddress?.fullAddress ||
                    (typeof showOrderDetailsModal.location === "string"
                      ? showOrderDetailsModal.location
                      : showOrderDetailsModal.location?.address) ||
                    "Address not specified"}
                </p>

                <div>
                  <label className={labelCls}>Delivery Status</label>
                  <select
                    className={inputCls}
                    value={showOrderDetailsModal.deliveryStatus || "pending"}
                    onChange={(e) =>
                      updateDeliveryStatus(showOrderDetailsModal.id, e.target.value)
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Assign Delivery Partner</label>
                  <div className="flex gap-2">
                    <input
                      id="assign-rider-input"
                      type="text"
                      placeholder="e.g. Rahul Kumar"
                      defaultValue={showOrderDetailsModal.deliveryPersonName || ""}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        assignDeliveryPartner(
                          showOrderDetailsModal.id,
                          (document.getElementById("assign-rider-input") as HTMLInputElement)
                            ?.value
                        )
                      }
                      className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:bg-orange-600"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                {showOrderDetailsModal.deliveryLatitude && (
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
                {showOrderDetailsModal.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-mono font-black text-white">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-white/5 pt-2 text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    ₹
                    {Math.round(
                      showOrderDetailsModal.subtotal ||
                        showOrderDetailsModal.total ||
                        0
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
                    ₹{Math.round(showOrderDetailsModal.total || 0)}
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
                        (showOrderDetailsModal.paymentStatus || "pending") === "paid"
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                      }`}
                    >
                      {(showOrderDetailsModal.paymentStatus || "pending") === "paid"
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
                onClick={() => {
                  printReceipt(showOrderDetailsModal);
                  setShowOrderDetailsModal(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs font-black text-white transition hover:bg-slate-700"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button
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
/* Reusable components                                           */
/* ============================================================= */

function MetricCard({
  label,
  value,
  sub,
  icon,
  gradient,
  border,
  iconGradient,
}: {
  label: string;
  value: any;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  iconGradient: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${border} bg-gradient-to-br ${gradient} bg-slate-900/60 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 font-mono text-2xl font-black leading-none text-white lg:text-3xl">
            {value}
          </p>
          {sub && (
            <p className="mt-1.5 truncate text-[11px] font-semibold text-slate-500">
              {sub}
            </p>
          )}
        </div>
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${iconGradient} text-white shadow-lg ring-1 ring-white/10`}
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
  icon: React.ReactNode;
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
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/20">
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
  value: any;
  icon: React.ReactNode;
  color: "emerald" | "orange" | "blue";
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-500",
    orange: "from-orange-500 to-amber-500",
    blue: "from-blue-500 to-indigo-500",
  };
  return (
    <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div
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
      className={`flex items-center justify-between rounded-2xl border border-white/5 bg-slate-800/40 px-4 py-3 text-xs font-black text-slate-200 transition ${tones[accent]}`}
    >
      <span className="flex items-center gap-2.5">
        <span className="text-base">{emoji}</span>
        {label}
      </span>
      <ExternalLink size={13} className="text-slate-500" />
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
      onClick={onClick}
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
      onClick={onClick}
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
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: "success" | "danger";
}) {
  let cls =
    "border-white/5 bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white";
  if (variant === "success")
    cls = "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25";
  if (variant === "danger")
    cls = "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
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
      <p className={`mt-0.5 truncate font-mono text-xs font-black ${tones[accent]}`}>
        {value}
      </p>
    </div>
  );
}

function OrderCard({
  order,
  onPrint,
  onView,
  onMarkPaid,
  onMarkReady,
  onComplete,
  onCancel,
}: {
  order: any;
  onPrint: () => void;
  onView: () => void;
  onMarkPaid: () => void;
  onMarkReady: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const isDelivery = order.type === "delivery";
  const paid = (order.paymentStatus || "pending") === "paid";

  return (
    <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-4 backdrop-blur-xl transition hover:border-white/10 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-black text-white">
              {order.orderNumber}
            </span>
            <StatusChip status={order.status} />
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                isDelivery
                  ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                  : "bg-slate-700/60 text-slate-300 ring-slate-600/40"
              }`}
            >
              {isDelivery ? (
                <>
                  <Truck size={10} /> Delivery
                  {order.deliveryDistance ? ` ~${order.deliveryDistance}km` : ""}
                </>
              ) : (
                <>
                  <ShoppingBag size={10} /> Pickup
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
              ₹{Math.round(order.total || 0)}
            </span>
          </div>

          {order.deliveryAddress?.fullAddress && (
            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-400">
              <MapPin size={12} className="mt-0.5 shrink-0 text-orange-400" />
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
            onClick={onPrint}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="Print"
          >
            <Printer size={14} />
          </button>
          <button
            onClick={onView}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="View"
          >
            <Eye size={14} />
          </button>

          {!paid && order.status !== "completed" && (
            <button
              onClick={onMarkPaid}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/20"
            >
              Mark Paid
            </button>
          )}

          {order.status === "preparing" && (
            <button
              onClick={onMarkReady}
              className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-500"
            >
              Ready
            </button>
          )}
          {order.status === "ready" && (
            <button
              onClick={onComplete}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-500"
            >
              Complete
            </button>
          )}
          {order.status !== "completed" && order.status !== "cancelled" && (
            <button
              onClick={onCancel}
              className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20"
              title="Cancel"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl sm:rounded-3xl">
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-slate-700" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 p-4">
          <h3 className="truncate text-sm font-black text-white">{title}</h3>
          <button
            onClick={onClose}
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