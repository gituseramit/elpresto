"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ShoppingCart, Clock, CheckCircle, AlertCircle, Search, Plus, Minus,
  Trash2, Printer, Utensils, LogOut, Lock, Bike, Coffee, ShoppingBag,
  DollarSign, Receipt, CreditCard, Menu as MenuIcon, X, Store,
  Bell, BellOff, Loader2, Maximize2, Minimize2, Undo2, Pencil,
  Copy, Star, Keyboard, Zap, Wifi, WifiOff, Percent,
  StickyNote, RotateCcw, History, Hash, Info, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection, onSnapshot, query, orderBy, where, getDocs,
  doc, updateDoc, addDoc, Timestamp,
} from "firebase/firestore";
import { DUMMY_MENU } from "@/data/menu";
import { Order, MenuItem, Category } from "@/lib/types";
import { printThermalReceipt, printKOT } from "@/lib/printer";
import { initializeCategoriesIfEmpty } from "@/lib/categories";
import { verifyPanelAccess, subscribePanelStatus } from "@/lib/panelAuth";
import { subscribeDayOrders, getISTDateString, formatISTDisplayDate } from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";

/* ============================================================ */
/* Constants                                                    */
/* ============================================================ */
const CART_STORAGE_KEY = "elpestro_counter_cart_v1";
const DELIVERY_FEE = 30;
const FREQUENT_ITEMS_LIMIT = 8;
const DISCOUNT_PRESETS = [
  { label: "5%", mode: "percent" as const, value: 5 },
  { label: "10%", mode: "percent" as const, value: 10 },
  { label: "₹20", mode: "flat" as const, value: 20 },
  { label: "₹50", mode: "flat" as const, value: 50 },
];

/* ============================================================ */
/* Helpers                                                      */
/* ============================================================ */
function getElapsed(createdAt: any): number {
  if (!createdAt) return 0;
  const d = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

function urgencyOf(elapsed: number, status: string) {
  if (status === "ready") return "ready";
  if (elapsed >= 20) return "critical";
  if (elapsed >= 12) return "warn";
  return "ok";
}

/* ============================================================ */
/* Main                                                         */
/* ============================================================ */
export default function CounterPOSPage() {
  /* Auth */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState("");
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);

  /* View */
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [isMobileOrdersOpen, setIsMobileOrdersOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* Data */
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [firestoreCategories, setFirestoreCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getISTDateString(0));
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  /* Menu filters */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");

  /* Cart */
  const [cartItems, setCartItems] = useState<
    { item: MenuItem; quantity: number; notes?: string }[]
  >([]);
  const [orderType, setOrderType] = useState<"counter" | "delivery">("counter");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  /* Discount — supports percent OR flat */
  const [discountMode, setDiscountMode] = useState<"percent" | "flat">("flat");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [counterPaymentStatus, setCounterPaymentStatus] = useState<"paid" | "pending">(
    "pending"
  );
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  /* Customer linking */
  const [linkedCustomer, setLinkedCustomer] = useState<{
    uid: string;
    name: string;
    phone: string;
  } | null>(null);

  /* Per-item notes */
  const [noteEditingItem, setNoteEditingItem] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  /* Print */
  const [printStatus, setPrintStatus] = useState<
    "idle" | "printing" | "success" | "error"
  >("idle");
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Toast / feedback */
  const [toast, setToast] = useState<{
    type: "success" | "info" | "error";
    message: string;
    undo?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<any>(null);

  /* Alerts */
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);

  /* Refs */
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartSnapshotRef = useRef<any>(null);
  const [nowTick, setNowTick] = useState(0);

  /* ============================================================ */
  /* Effects                                                      */
  /* ============================================================ */
  useEffect(() => {
    const t = setInterval(() => setNowTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* Restore session + saved cart */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const auth = sessionStorage.getItem("elpestro_counter_auth");
    if (auth === "true") setIsAuthenticated(true);
    const snd = localStorage.getItem("elpestro_counter_sound");
    if (snd === "false") setSoundEnabled(false);

    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.cartItems?.length) {
          setCartItems(saved.cartItems);
          setOrderType(saved.orderType || "counter");
          setCustomerName(saved.customerName || "");
          setCustomerPhone(saved.customerPhone || "");
          setPaymentMethod(saved.paymentMethod || "cash");
          setCounterPaymentStatus(saved.counterPaymentStatus || "pending");

          // Discount restore (new schema) + migration from old discountAmount
          if (saved.discountMode === "percent" || saved.discountMode === "flat") {
            setDiscountMode(saved.discountMode);
            setDiscountValue(Number(saved.discountValue) || 0);
          } else if (typeof saved.discountAmount === "number") {
            setDiscountMode("flat");
            setDiscountValue(saved.discountAmount);
          }
        }
      }
    } catch (e) {
      console.warn("Cart restore failed:", e);
    }
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
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
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

  /* Panel disable watcher */
  useEffect(() => {
    const unsub = subscribePanelStatus("counter", () => {
      setIsAuthenticated(false);
      sessionStorage.removeItem("elpestro_counter_auth");
      setPinError(true);
      setPinErrorMessage("The Counter POS Panel has been disabled by the administrator.");
    });
    return () => unsub();
  }, []);

  /* Toast helper */
  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "success", undo?: () => void) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ message, type, undo });
      toastTimerRef.current = setTimeout(() => setToast(null), 4500);
    },
    []
  );

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (cartItems.length > 0 && !isSubmitting) handlePlaceOrder(true);
      }
      if (e.key === "F6") {
        e.preventDefault();
        if (cartItems.length > 0 && !isSubmitting) handlePlaceOrder(false);
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (cartItems.length > 0) confirmClearCart();
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setIsMobileCartOpen(false);
        setIsMobileOrdersOpen(false);
        setNoteEditingItem(null);
      }
      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartItems, isSubmitting, discountMode, discountValue, orderType]);

  /* Sound */
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
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
    } catch {}
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("elpestro_counter_sound", String(next));
    if (next) playChime();
  };

  /* Login */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(false);
    setPinErrorMessage("");
    setIsVerifyingAuth(true);
    try {
      const res = await verifyPanelAccess("counter", pinInput);
      if (res.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem("elpestro_counter_auth", "true");
      } else if (res.reason === "disabled") {
        setPinError(true);
        setPinErrorMessage("The Counter Panel is currently disabled by Admin.");
      } else {
        setPinError(true);
        setPinErrorMessage("Invalid Counter PIN. (Default: counter1234 or 1234)");
      }
    } catch {
      if (pinInput === "counter1234" || pinInput === "1234" || pinInput === "admin9090") {
        setIsAuthenticated(true);
        sessionStorage.setItem("elpestro_counter_auth", "true");
      } else {
        setPinError(true);
        setPinErrorMessage("Invalid PIN or connection error.");
      }
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleLogout = () => {
    if (cartItems.length > 0 && !confirm("You have items in cart. Sign out anyway?")) return;
    setIsAuthenticated(false);
    sessionStorage.removeItem("elpestro_counter_auth");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  /* ============================================================ */
  /* Data subscriptions                                           */
  /* ============================================================ */
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchCats = async () => {
      try {
        const cats = await initializeCategoriesIfEmpty();
        setFirestoreCategories(cats);
      } catch (e) {
        console.warn("Firestore categories unavailable:", e);
      }
    };
    fetchCats();

    const unsubMenu = onSnapshot(collection(db, "menuItems"), (snap) => {
      const map = new Map<string, MenuItem>();
      DUMMY_MENU.forEach((item) => map.set(item.id, item as any));
      snap.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...(d.data() as any) });
      });
      setMenuItems(Array.from(map.values()));
    });

    setOrdersLoading(true);
    setOrdersError(null);
    const unsubOrders = subscribeDayOrders(
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
        setOrders(fetched);
        setOrdersLoading(false);
        setOrdersError(null);
      },
      (err) => {
        console.error("Orders error:", err);
        setOrdersError("Unable to load orders. Please try again.");
        setOrdersLoading(false);
      }
    );

    return () => {
      unsubMenu();
      unsubOrders();
    };
  }, [isAuthenticated, selectedDate, soundEnabled]);

  /* ============================================================ */
  /* Derived                                                      */
  /* ============================================================ */
  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      const cat = (item.category || "").trim();
      if (cat && cat !== "Food" && cat !== "General") {
        set.add(cat);
      }
    });
    const ordered: string[] = [];
    const seen = new Set<string>();
    menuItems.forEach((item) => {
      const cat = (item.category || "").trim();
      if (cat && !seen.has(cat) && set.has(cat)) {
        ordered.push(cat);
        seen.add(cat);
      }
    });
    Array.from(set).forEach((cat) => {
      if (!seen.has(cat)) {
        ordered.push(cat);
        seen.add(cat);
      }
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
    return menuItems.filter((item) => {
      if (selectedCategory !== "all") {
        if ((item.category || "").trim() !== selectedCategory) return false;
      }
      if (selectedSubcategory !== "all") {
        if ((item.subcategory || "").trim() !== selectedSubcategory) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          item.price.toString().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, selectedCategory, selectedSubcategory, searchQuery]);

  const groupedMenu = useMemo(() => {
    const groups: { title: string; items: MenuItem[] }[] = [];
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

    map.forEach((items, title) => {
      groups.push({ title, items });
    });

    return groups;
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
    orders.slice(0, 100).forEach((o) => {
      o.items?.forEach((it: any) => {
        if (!counts[it.id]) {
          const found = menuItems.find((m) => m.id === it.id);
          if (found) counts[it.id] = { item: found, count: 0 };
        }
        if (counts[it.id]) counts[it.id].count += it.quantity || 1;
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

  /* Discount computed — handles both % and flat */
  const computedDiscount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountMode === "percent") {
      const pct = Math.max(0, Math.min(100, v));
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(Math.max(0, v), subtotal);
  }, [discountMode, discountValue, subtotal]);

  const finalTotal = Math.max(0, subtotal - computedDiscount);
  const cartCount = cartItems.reduce((s, ci) => s + ci.quantity, 0);
  const grandTotal = finalTotal + (orderType === "delivery" ? DELIVERY_FEE : 0);

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
    if (ordersSearch.trim()) {
      const q = ordersSearch.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          (o.phone || o.customerPhone || "").includes(q)
      );
    }
    if (!showAllOrders) {
      list = list.slice(0, 15);
    }
    return list.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return ta - tb;
    });
  }, [activeOrders, ordersSearch, showAllOrders]);

  /* ============================================================ */
  /* Cart actions                                                 */
  /* ============================================================ */
  const addToCart = (item: MenuItem) => {
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
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const next = ci.quantity + delta;
            return next > 0 ? { ...ci, quantity: next } : null;
          }
          return ci;
        })
        .filter(Boolean) as any
    );
  };

  const removeFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  const saveItemNote = () => {
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
  };

  const confirmClearCart = () => {
    if (cartItems.length === 0) return;
    if (!confirm(`Clear ${cartCount} items from cart?`)) return;
    cartSnapshotRef.current = [...cartItems];
    setCartItems([]);
    setDiscountMode("flat");
    setDiscountValue(0);
    showToast("Cart cleared", "info", () => {
      if (cartSnapshotRef.current) {
        setCartItems(cartSnapshotRef.current);
        showToast("Cart restored", "success");
      }
    });
  };

  const clearAllFields = () => {
    setCartItems([]);
    setDiscountMode("flat");
    setDiscountValue(0);
    setCustomerName("");
    setCustomerPhone("");
    setCounterPaymentStatus("pending");
    setLinkedCustomer(null);
    setEditingOrderId(null);
  };

  const recallOrder = (order: Order) => {
    if (cartItems.length > 0) {
      if (!confirm("Current cart will be replaced with this order. Continue?")) return;
    }
    const mapped = (order.items || [])
      .map((it: any) => {
        const menu = menuItems.find((m) => m.id === it.id);
        if (!menu) return null;
        return { item: menu, quantity: it.quantity, notes: it.notes };
      })
      .filter(Boolean) as any[];
    setCartItems(mapped);
    setOrderType((order.type as any) || "counter");
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.phone || order.customerPhone || "");
    setPaymentMethod((order.paymentMethod as any) || "cash");
    setCounterPaymentStatus((order.paymentStatus as any) || "pending");

    // Discount recall — support both new & legacy
    const anyOrder = order as any;
    if (anyOrder.discountMode === "percent" || anyOrder.discountMode === "flat") {
      setDiscountMode(anyOrder.discountMode);
      setDiscountValue(Number(anyOrder.discountValue) || 0);
    } else if (typeof order.discount === "number" && order.discount > 0) {
      setDiscountMode("flat");
      setDiscountValue(order.discount);
    } else {
      setDiscountMode("flat");
      setDiscountValue(0);
    }

    setEditingOrderId(order.id);
    setIsMobileOrdersOpen(false);
    showToast(`Editing ${order.orderNumber}`, "info");
  };

  const duplicateOrder = (order: Order) => {
    const mapped = (order.items || [])
      .map((it: any) => {
        const menu = menuItems.find((m) => m.id === it.id);
        if (!menu) return null;
        return { item: menu, quantity: it.quantity };
      })
      .filter(Boolean) as any[];
    if (mapped.length === 0) {
      showToast("Original items unavailable", "error");
      return;
    }
    setCartItems(mapped);
    setOrderType((order.type as any) || "counter");
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.phone || order.customerPhone || "");
    setEditingOrderId(null);
    setIsMobileCartOpen(false);
    showToast("Duplicated into cart", "success");
  };

  const applyDiscountPreset = (preset: typeof DISCOUNT_PRESETS[number]) => {
    setDiscountMode(preset.mode);
    setDiscountValue(preset.value);
    showToast(`${preset.label} discount applied`, "info");
  };

  const handleSearchCustomer = async () => {
    const phone = customerPhone.trim();
    if (!phone) return;
    try {
      const q = query(collection(db, "customers"), where("phone", "==", phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setLinkedCustomer({ uid: snap.docs[0].id, name: d.name || "Customer", phone });
        if (!customerName) setCustomerName(d.name || "");
        showToast(`Linked: ${d.name}`, "success");
      } else {
        setLinkedCustomer(null);
        showToast("New customer", "info");
      }
    } catch {
      showToast("Search failed", "error");
    }
  };

  /* ============================================================ */
  /* Place order                                                  */
  /* ============================================================ */
  const handlePlaceOrder = async (printAfter: boolean = true) => {
    if (cartItems.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const orderPrefix = orderType === "delivery" ? "D" : "C";
      const newOrderNumber = `#ELP-${orderPrefix}${Math.floor(100 + Math.random() * 900)}`;

      const orderPayload: any = {
        orderNumber: newOrderNumber,
        customerName:
          customerName.trim() ||
          (orderType === "delivery" ? "Delivery Customer" : "Walk-in Customer"),
        customerPhone: customerPhone.trim() || "Counter",
        phone: customerPhone.trim() || "Counter",
        type: orderType,
        orderType: orderType,
        kitchenNotes: editingOrderId
          ? "Updated at Counter POS"
          : `Created at Counter POS (${orderType.toUpperCase()})`,
        items: cartItems.map((ci) => ({
          id: ci.item.id,
          name: ci.item.name,
          quantity: ci.quantity,
          price: ci.item.price,
          ...(ci.notes ? { notes: ci.notes } : {}),
        })),
        subtotal: subtotal,
        discount: computedDiscount,
        discountMode: discountMode,
        discountValue: discountValue,
        deliveryFee: orderType === "delivery" ? DELIVERY_FEE : 0,
        total: grandTotal,
        paymentMethod: paymentMethod,
        paymentStatus: counterPaymentStatus,
        source: "counter",
        updatedAt: Timestamp.now(),
        ...(linkedCustomer ? { customerId: linkedCustomer.uid } : {}),
      };

      if (orderType === "delivery") {
        orderPayload.deliveryAddress = {
          fullAddress: "Campus Delivery",
        };
        orderPayload.location = "Campus Delivery";
      } else {
        orderPayload.location = "Counter";
      }

      if (editingOrderId) {
        await updateDoc(doc(db, "orders", editingOrderId), orderPayload);
        const updated: Order = { id: editingOrderId, ...orderPayload };
        setLastPlacedOrder(updated);
        showToast(`Order ${newOrderNumber} updated`, "success");
        if (printAfter) handlePrintReceipt(updated);
      } else {
        orderPayload.status = "pending";
        orderPayload.createdAt = Timestamp.now();
        if (orderType === "delivery") orderPayload.deliveryStatus = "pending";
        const docRef = await addDoc(collection(db, "orders"), orderPayload);
        const placed: Order = { id: docRef.id, ...orderPayload };
        setLastPlacedOrder(placed);
        showToast(`Order ${newOrderNumber} placed`, "success");
        if (printAfter) handlePrintReceipt(placed);
      }

      clearAllFields();
      setIsMobileCartOpen(false);
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = async (order: Order) => {
    setPrintStatus("printing");
    try {
      const res = await printThermalReceipt(order, {
        paperWidth: "58mm",
        copyCount: 1,
      });
      setPrintStatus(res.success ? "success" : "error");
      setTimeout(() => setPrintStatus("idle"), 3000);
    } catch {
      setPrintStatus("error");
      setTimeout(() => setPrintStatus("idle"), 3000);
    }
  };

  const handlePrintKOT = async (order: Order) => {
    try {
      await printKOT(order);
      showToast("KOT sent to kitchen", "success");
    } catch {
      showToast("KOT print failed", "error");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
        ...(newStatus === "completed"
          ? { completedAt: new Date().toISOString() }
          : {}),
      });
      showToast(`Order marked ${newStatus}`, "success");
    } catch (err: any) {
      showToast("Error: " + err.message, "error");
    }
  };

  const handleUpdatePaymentStatus = async (
    orderId: string,
    newStatus: "paid" | "pending"
  ) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        paymentStatus: newStatus,
        updatedAt: Timestamp.now(),
      });
      showToast(`Payment ${newStatus}`, "success");
    } catch (err: any) {
      showToast("Error updating payment", "error");
    }
  };

  /* ============================================================ */
  /* LOGIN                                                        */
  /* ============================================================ */
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col items-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#D92312] text-white shadow-sm">
                <Store size={28} />
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-900">Counter Manager</h1>
              <p className="mt-1 text-xs text-slate-500">POS Billing & Order Management</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Staff PIN
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter PIN"
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-sm tracking-widest text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
                    required
                  />
                  <Lock size={15} className="absolute right-3.5 top-3.5 text-slate-400" />
                </div>
              </div>

              {pinError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-xs font-medium text-red-700">{pinErrorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingAuth}
                className="w-full rounded-xl bg-[#D92312] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#B8190B] active:scale-[0.98] disabled:opacity-50"
              >
                {isVerifyingAuth ? "Verifying…" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs">
              <Link href="/" className="text-slate-400 hover:text-slate-700">
                ← Return to Storefront
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================ */
  /* LEFT — Orders List                                           */
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
          <input
            type="text"
            placeholder="Search orders..."
            value={ordersSearch}
            onChange={(e) => setOrdersSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none"
          />
          {ordersSearch && (
            <button
              onClick={() => setOrdersSearch("")}
              className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <button
          onClick={() => {
            if (cartItems.length > 0 && !editingOrderId) {
              if (!confirm("Current cart will be lost. Start a new order?")) return;
            }
            clearAllFields();
            setIsMobileOrdersOpen(false);
            setActiveTab("pos");
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
              {editingOrderId ? "Discard changes and reset" : "Start a new prepaid order"}
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-slate-900">
                            {order.orderNumber}
                          </span>
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
                          .map((it: any) => `${it.quantity}× ${it.name}`)
                          .join(", ")}
                        {order.items.length > 2 && ` +${order.items.length - 2}`}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1.5">
                      {!paid && (
                        <button
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
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "preparing")
                          }
                          className="flex-1 rounded-lg border border-orange-200 bg-orange-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 transition hover:bg-orange-100"
                        >
                          Start
                        </button>
                      )}
                      {isPreparing && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, "ready")}
                          className="flex-1 rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition hover:bg-blue-100"
                        >
                          Ready
                        </button>
                      )}
                      {isReady && order.type !== "delivery" && (
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "completed")
                          }
                          className="flex-1 rounded-lg bg-[#D92312] py-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-[#B8190B]"
                        >
                          Done
                        </button>
                      )}
                      <button
                        onClick={() => recallOrder(order)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        title="Edit / Recall"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handlePrintReceipt(order)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        title="Print bill"
                      >
                        <Printer size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {!showAllOrders && activeOrders.length > 15 && (
            <button
              onClick={() => setShowAllOrders(true)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronRight size={11} />
              Show {activeOrders.length - 15} more
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={toggleSound}
            className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
              soundEnabled
                ? "border-red-200 bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-400"
            }`}
            title={soundEnabled ? "Sound on (F1 for help)" : "Sound off"}
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
  /* RIGHT — Cart                                                  */
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
                Update mode · saving will overwrite
              </p>
            )}
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={confirmClearCart}
              className="text-xs font-bold text-slate-400 hover:text-red-500"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { id: "counter", label: "Counter / Takeaway", icon: Store },
            { id: "delivery", label: "Delivery", icon: Bike },
          ].map((t) => {
            const Icon = t.icon;
            const active = orderType === (t.id as any);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOrderType(t.id as any)}
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
            <p className="mt-3 text-sm font-bold text-slate-500">No items added</p>
            <p className="mt-1 text-xs text-slate-400">Select items from the menu</p>
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
                      onClick={() => updateQuantity(ci.item.id, -1)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-90"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-slate-900">
                      {ci.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(ci.item.id, 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 active:scale-90"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeFromCart(ci.item.id)}
                      className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 active:scale-90"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {noteEditingItem === ci.item.id ? (
                    <div className="flex flex-1 gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveItemNote();
                          if (e.key === "Escape") setNoteEditingItem(null);
                        }}
                        placeholder="Special instructions..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-[#D92312] focus:outline-none"
                      />
                      <button
                        onClick={saveItemNote}
                        className="rounded-lg bg-[#D92312] px-2 py-1 text-[10px] font-bold text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : ci.notes ? (
                    <button
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
        {/* Only Customer Name + Phone — no other detail inputs */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
          />
          <div className="relative">
            <input
              type="tel"
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              onKeyDown={(e) => e.key === "Enter" && handleSearchCustomer()}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            {customerPhone.length === 10 && !linkedCustomer && (
              <button
                onClick={handleSearchCustomer}
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

          {/* Discount: % or ₹ toggle + value + presets */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setDiscountMode("flat")}
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
              <input
                type="number"
                min="0"
                max={discountMode === "percent" ? 100 : undefined}
                value={discountValue || ""}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  if (discountMode === "percent") {
                    setDiscountValue(Math.max(0, Math.min(100, v)));
                  } else {
                    setDiscountValue(Math.max(0, v));
                  }
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
            <span className="text-base font-black text-slate-900">Grand Total</span>
            <span className="text-xl font-black text-[#D92312]">
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
              paymentMethod === "cash"
                ? "border-[#D92312] bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <DollarSign size={13} /> Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("online")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
              paymentMethod === "online"
                ? "border-[#D92312] bg-red-50 text-[#D92312]"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <CreditCard size={13} /> UPI
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCounterPaymentStatus("paid")}
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
            onClick={() => handlePlaceOrder(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D92312] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#B8190B] active:scale-[0.98] disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />{" "}
                {editingOrderId ? "Updating…" : "Placing…"}
              </>
            ) : (
              <>
                <Receipt size={13} />{" "}
                {editingOrderId ? "Update Order" : "Generate Bill"}
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
  /* MAIN LAYOUT                                                  */
  /* ============================================================ */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setIsMobileOrdersOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 lg:hidden"
          >
            <MenuIcon size={16} />
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
                {activeOrders.length} active · {cartCount} in cart
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              onClick={() => handlePrintReceipt(lastPlacedOrder)}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 sm:flex"
              title="Reprint last receipt"
            >
              <Printer size={11} /> {lastPlacedOrder.orderNumber}
            </button>
          )}

          <button
            onClick={() => setShowShortcuts(true)}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 md:flex"
            title="Keyboard shortcuts (F1)"
          >
            <Keyboard size={11} /> F1
          </button>

          <button
            onClick={toggleFullscreen}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 md:flex"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "pos" ? "history" : "pos")}
            className="hidden rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:block"
          >
            {activeTab === "pos" ? "History" : "POS"}
          </button>

          <button
            onClick={() => setIsMobileCartOpen(true)}
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
                <button
                  onClick={() => searchInputRef.current?.focus()}
                  className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 sm:flex"
                >
                  <Keyboard size={11} /> F2
                </button>
              </div>

              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:border-[#D92312] focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="scrollbar-none mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedSubcategory("all");
                  }}
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
                      onClick={() => {
                        setSelectedCategory(catName);
                        setSelectedSubcategory("all");
                      }}
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
                    onClick={() => setSelectedSubcategory("all")}
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
                      onClick={() => setSelectedSubcategory(subName)}
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
                      const inCart = cartItems.find((ci) => ci.item.id === item.id);
                      return (
                        <button
                          key={item.id}
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
                                unavailable ? "opacity-40" : "hover:bg-slate-50"
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
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-slate-100 active:scale-90"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="w-5 text-center font-mono text-xs font-bold text-slate-900">
                                        {inCart.quantity}
                                      </span>
                                      <button
                                        onClick={() => updateQuantity(item.id, 1)}
                                        className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-slate-100 active:scale-90"
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => addToCart(item)}
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
                <h2 className="text-lg font-black text-slate-900">Order History</h2>
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
                <Loader2 size={32} className="mx-auto animate-spin text-[#D92312]" />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Loading orders...
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Fetching order history for {selectedDate}
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
                <Receipt size={36} className="mx-auto text-slate-300" />
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
                            {o.type}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            ₹{o.total}
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
                            {o.createdAt?.toDate
                              ? o.createdAt.toDate().toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handlePrintReceipt(o)}
                                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50"
                                title="Print receipt"
                              >
                                <Printer size={12} />
                              </button>
                              <button
                                onClick={() => duplicateOrder(o)}
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
        <div className="fixed inset-0 z-50 lg:hidden">
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
        <div className="fixed inset-0 z-50 lg:hidden">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
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
                onClick={() => setShowShortcuts(false)}
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

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2"
          style={{ animation: "slideUp 0.2s ease-out" }}
        >
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translate(-50%, 8px); }
              to { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          <div
            className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-xl ${
              toast.type === "success"
                ? "border-emerald-200"
                : toast.type === "error"
                ? "border-red-200"
                : "border-slate-200"
            }`}
          >
            <div
              className={`grid h-8 w-8 place-items-center rounded-lg text-white ${
                toast.type === "success"
                  ? "bg-emerald-500"
                  : toast.type === "error"
                  ? "bg-red-500"
                  : "bg-slate-700"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle size={15} />
              ) : toast.type === "error" ? (
                <AlertCircle size={15} />
              ) : (
                <Info size={15} />
              )}
            </div>
            <p className="text-sm font-bold text-slate-800">{toast.message}</p>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"
              >
                <Undo2 size={10} /> Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}