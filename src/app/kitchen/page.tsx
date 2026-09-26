"use client";

import { useEffect, useState, useRef } from "react";
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
  Lock,
  Printer,
  RotateCcw,
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
  Sparkles,
  TrendingUp,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Loader2,
  Store,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { CATEGORIES, DUMMY_MENU } from "@/data/menu";
import { verifyPanelAccess, subscribePanelStatus } from "@/lib/panelAuth";
import StaffLoginForm from "@/components/Auth/StaffLoginForm";
import { subscribeDayOrders, getISTDateString, formatISTDisplayDate } from "@/lib/orderQueries";
import DateNavigator from "@/components/DateNavigator";

/* ============== TYPES ============== */
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
}

interface KitchenSettings {
  stationName: string;
  soundEnabled: boolean;
  warningThresholdMins: number;
  defaultSort: "oldest" | "newest";
}

/* ============== Reusable ============== */
function StatusBadge({
  status,
  isDelivery,
  isLate,
}: {
  status: string;
  isDelivery: boolean;
  isLate?: boolean;
}) {
  let label = status;
  let cls = "bg-amber-500/20 text-amber-300 ring-amber-500/30";

  if (status === "preparing") {
    label = "Preparing";
    cls = "bg-orange-500/20 text-orange-300 ring-orange-500/30";
  } else if (status === "ready") {
    label = isDelivery ? "Ready · Awaiting Rider" : "Ready to Serve";
    cls = "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30";
  } else if (status === "completed") {
    label = "Completed";
    cls = "bg-slate-700/60 text-slate-300 ring-slate-600/40";
  } else if (status === "cancelled") {
    label = "Cancelled";
    cls = "bg-red-500/20 text-red-300 ring-red-500/30";
  } else if (status === "pending") {
    label = isLate ? "New · Delayed" : "New";
    cls = isLate
      ? "bg-red-500/25 text-red-200 ring-red-500/40"
      : "bg-amber-500/20 text-amber-300 ring-amber-500/30";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

/* ============== Page ============== */
export default function KitchenSystem() {
  /* ---- Auth ---- */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [staffSession, setStaffSession] = useState<any>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(true);

  /* ---- Layout ---- */
  const [activeTab, setActiveTab] = useState<"new" | "preparing" | "completed" | "settings">(
    "new"
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  /* ---- Data ---- */
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getISTDateString(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "takeaway" | "delivery">("all");
  const [sortBy, setSortBy] = useState<"oldest" | "newest">("oldest");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  /* ---- Kitchen notes ---- */
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);
  const [noteInput, setNoteInput] = useState("");

  /* ---- Notifications ---- */
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  /* ---- POS create order ---- */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableMenuItems, setAvailableMenuItems] = useState<any[]>(DUMMY_MENU);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [menuSearchFilter, setMenuSearchFilter] = useState<string>("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>("All");

  const [newOrderCustomer, setNewOrderCustomer] = useState("Walk-in Customer");
  const [newOrderPhone, setNewOrderPhone] = useState("");
  const [newOrderType, setNewOrderType] = useState<"takeaway" | "delivery">("takeaway");
  const [newOrderInstructions, setNewOrderInstructions] = useState("");
  const [newOrderPaymentMethod, setNewOrderPaymentMethod] = useState<"cash" | "online">("cash");
  const [newOrderSource, setNewOrderSource] = useState<"kitchen" | "swiggy" | "zomato" | "website">("kitchen");
  const [newOrderDiscount, setNewOrderDiscount] = useState<number>(0);
  const [newOrderItems, setNewOrderItems] = useState<
    { id: string; name: string; quantity: number; price: number }[]
  >([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [createOrderSuccessMsg, setCreateOrderSuccessMsg] = useState<string | null>(null);

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
  const [kitchenSettings, setKitchenSettings] = useState<KitchenSettings>({
    stationName: "Main Kitchen Station",
    soundEnabled: true,
    warningThresholdMins: 15,
    defaultSort: "oldest",
  });

  /* ---- Init session ---- */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("elpestro_kitchen_auth");
      if (auth === "true") setIsAuthenticated(true);

      const savedSettings = localStorage.getItem("elpestro_kitchen_settings");
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setKitchenSettings(parsed);
          setSortBy(parsed.defaultSort || "oldest");
        } catch (e) {}
      }
    }

    const unsub = subscribePanelStatus("kitchen", () => {
      setPanelDisabled(true);
      setIsAuthenticated(false);
      sessionStorage.removeItem("elpestro_kitchen_auth");
      setAuthError(true);
      setAuthErrorMessage("The Kitchen Panel has been disabled by the administrator.");
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(false);
    setAuthErrorMessage("");
    setIsVerifyingAuth(true);

    try {
      const res = await verifyPanelAccess("kitchen", pinInput);
      if (res.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem("elpestro_kitchen_auth", "true");
        setAuthError(false);
      } else if (res.reason === "disabled") {
        setAuthError(true);
        setAuthErrorMessage("Access Denied: The Kitchen Panel is currently disabled by Admin.");
      } else {
        setAuthError(true);
        setAuthErrorMessage("Invalid Kitchen Staff PIN. (Default: kitchen1234)");
      }
    } catch (err: any) {
      if (pinInput === "kitchen1234" || pinInput === "admin9090") {
        setIsAuthenticated(true);
        sessionStorage.setItem("elpestro_kitchen_auth", "true");
        setAuthError(false);
      } else {
        setAuthError(true);
        setAuthErrorMessage("Invalid PIN or connection error.");
      }
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("elpestro_kitchen_auth");
  };

  /* ---- Realtime listener ---- */
  useEffect(() => {
    if (!isAuthenticated) return;

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
          if (kitchenSettings.soundEnabled) playNotificationSound();
          setNewOrderAlert(newlyAdded[0]);
          setTimeout(() => setNewOrderAlert(null), 6000);
        }
        fetched.forEach((o) => seenOrderIdsRef.current.add(o.id));

        setOrders(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Kitchen orders error:", err);
        setError("Unable to load orders. Please try again.");
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, selectedDate, kitchenSettings.soundEnabled]);

  /* ---- Live menu ---- */
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchLiveMenu = async () => {
      try {
        const { getDocs } = await import("firebase/firestore");
        const snap = await getDocs(collection(db, "menuItems"));
        if (!snap.empty) {
          const map = new Map();
          DUMMY_MENU.forEach((item) => map.set(item.id, item));
          snap.docs.forEach((d) => {
            const data = d.data();
            map.set(d.id, { id: d.id, ...data });
          });
          setAvailableMenuItems(Array.from(map.values()));
        }
      } catch (e) {
        console.warn("Using default menu items:", e);
      }
    };
    fetchLiveMenu();
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
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1174.66;
        gain2.gain.setValueAtTime(0.35, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 150);
    } catch (e) {}
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  /* ---- Status update ---- */
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: string,
    extraData: any = {}
  ) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
        ...extraData,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, ...extraData } : o))
      );
    } catch (err: any) {
      alert("Error updating order: " + err.message);
    }
  };

  const handleSaveKitchenNote = async () => {
    if (!noteOrder) return;
    try {
      await updateDoc(doc(db, "orders", noteOrder.id), { kitchenNotes: noteInput });
      setOrders((prev) =>
        prev.map((o) => (o.id === noteOrder.id ? { ...o, kitchenNotes: noteInput } : o))
      );
      setNoteOrder(null);
      setNoteInput("");
    } catch (err: any) {
      alert("Error saving note: " + err.message);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    const reason = window.prompt(
      `Enter rejection/cancellation reason for Order ${order.orderNumber}:`,
      "Item out of stock"
    );
    if (reason !== null) {
      await handleUpdateStatus(order.id, "cancelled", { cancelReason: reason });
    }
  };

  /* ---- Print KOT ---- */
  const handlePrintReceipt = (order: Order) => {
    const orderDate = order.createdAt?.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt || Date.now());

    const itemsHtml = order.items
      ?.map(
        (item) => `
        <tr>
          <td style="font-size:14px;font-weight:bold;">${item.quantity}x ${item.name}</td>
        </tr>`
      )
      .join("");

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KOT - ${order.orderNumber}</title>
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
        </div>
        <div class="meta">
          <p style="font-size:18px;font-weight:bold;">ORDER: ${order.orderNumber}</p>
          <p>TYPE: ${(order.type || order.orderType || "takeaway").toUpperCase()}</p>
          <p>TIME: ${orderDate.toLocaleTimeString()}</p>
          <p>CUSTOMER: ${order.customerName}</p>
          <p style="font-weight:bold;">PAYMENT: ${(order.paymentMethod === "online" ? "ONLINE (PAID)" : "CASH").toUpperCase()}</p>
          <p>TOTAL: ₹${Math.round(order.total || 0)} ${order.deliveryFee ? `(Inc. ₹${Math.round(order.deliveryFee)} Delivery)` : ""}</p>
        </div>
        <table><tbody>${itemsHtml}</tbody></table>
        ${order.instructions ? `<div class="instructions">CUSTOMER NOTE: ${order.instructions}</div>` : ""}
        ${order.kitchenNotes ? `<div class="notes">KITCHEN NOTE: ${order.kitchenNotes}</div>` : ""}
      </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=380,height=550");
    if (printWin) {
      printWin.document.write(receiptHtml);
      printWin.document.close();
      printWin.focus();
      printWin.print();
    }
  };

  /* ---- Filters ---- */
  const filteredDropdownMenuItems = availableMenuItems.filter((item) => {
    const matchesCategory =
      menuCategoryFilter === "All" || item.category === menuCategoryFilter;
    const matchesSearch =
      !menuSearchFilter.trim() ||
      item.name.toLowerCase().includes(menuSearchFilter.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(menuSearchFilter.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  /* ---- POS Add item ---- */
  const handleAddItemToOrder = () => {
    if (!selectedMenuItemId) return;
    const menuItem = availableMenuItems.find((i) => i.id === selectedMenuItemId);
    if (!menuItem) return;
    setNewOrderItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === menuItem.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += selectedQuantity;
        return updated;
      }
      return [
        ...prev,
        {
          id: menuItem.id,
          name: menuItem.name,
          quantity: selectedQuantity,
          price: menuItem.price || 0,
        },
      ];
    });
    setSelectedQuantity(1);
  };

  const handleAddItemDirect = (item: any) => {
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
        { id: item.id, name: item.name, quantity: 1, price: item.price || 0 },
      ];
    });
  };

  const handleUpdateItemQuantity = (id: string, delta: number) => {
    setNewOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as any
    );
  };

  const handleRemoveItemFromOrder = (id: string) => {
    setNewOrderItems((prev) => prev.filter((i) => i.id !== id));
  };

  /* ---- Create order ---- */
  const handleCreateKitchenOrder = async (e?: React.FormEvent, printKOT: boolean = false) => {
    if (e) e.preventDefault();
    if (newOrderItems.length === 0) {
      alert("Please add at least one item from the menu to the bill.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const newOrderNum = `#ELP-K${Math.floor(100 + Math.random() * 900)}`;
      const subtotal = newOrderItems.reduce(
        (acc, item) => acc + (item.price || 0) * item.quantity,
        0
      );
      const discount = Number(newOrderDiscount) || 0;
      const finalTotal = Math.max(0, subtotal - discount);

      const orderData: any = {
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
          price: item.price,
        })),
        subtotal,
        discount,
        deliveryFee: 0,
        total: finalTotal,
        paymentMethod: newOrderPaymentMethod,
        paymentStatus: newOrderPaymentMethod === "online" ? "paid" : "pending",
        status: "pending",
        source: newOrderSource,
        createdAt: Timestamp.now(),
        location:
          newOrderType === "takeaway"
            ? "Kitchen Counter Pickup"
            : "Direct Dine-in / Order",
      };

      const docRef = await addDoc(collection(db, "orders"), orderData);
      if (kitchenSettings.soundEnabled) playNotificationSound();

      setCreateOrderSuccessMsg(`Ticket ${newOrderNum} created and sent to New Orders!`);
      setTimeout(() => setCreateOrderSuccessMsg(null), 5000);

      if (printKOT) handlePrintReceipt({ id: docRef.id, ...orderData });

      setNewOrderCustomer("Walk-in Customer");
      setNewOrderPhone("");
      setNewOrderInstructions("");
      setNewOrderItems([]);
      setNewOrderDiscount(0);
      setSelectedMenuItemId("");
      setSelectedQuantity(1);
      setShowCreateModal(false);
      setActiveTab("new");
    } catch (err: any) {
      console.error("Failed to create order:", err);
      alert("Failed to create order: " + (err.message || err));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  /* ---- Editable check ---- */
  const isOrderEditable = (order: Order) => {
    if (order.status === "completed" || order.status === "cancelled") return false;
    const src = (order.source || "").toLowerCase().trim();
    if (src === "kitchen" || src === "on_spot" || src === "on spot" || src === "walk-in")
      return true;
    if (
      !order.source &&
      order.kitchenNotes &&
      order.kitchenNotes.toLowerCase().includes("kitchen")
    )
      return true;
    return false;
  };

  /* ---- Edit order handlers ---- */
  const handleStartEditOrder = (order: Order) => {
    if (!isOrderEditable(order)) {
      alert(
        "External orders (Website, Swiggy, Zomato) are locked and cannot be edited by the kitchen."
      );
      return;
    }
    setEditingOrder(order);
    setEditOrderItems(
      (order.items || []).map((i) => ({
        id: i.id || String(Math.random()),
        name: i.name,
        quantity: i.quantity || 1,
        price: i.price || 0,
      }))
    );
    setEditOrderInstructions(order.instructions || "");
    setEditOrderDiscount(order.discount || 0);
    setEditSelectedMenuItemId("");
  };

  const handleAddItemToEditOrder = (itemToAdd: any) => {
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
          price: itemToAdd.price || 0,
        },
      ];
    });
  };

  const handleUpdateEditItemQty = (id: string, delta: number) => {
    setEditOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as any[]
    );
  };

  const handleRemoveEditItem = (id: string) => {
    setEditOrderItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;
    if (editOrderItems.length === 0) {
      alert("Order must contain at least one item.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const subtotal = editOrderItems.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0);
      const deliveryFee = editingOrder.deliveryFee || 0;
      const discount = editOrderDiscount || 0;
      const total = Math.max(0, subtotal + deliveryFee - discount);

      await updateDoc(doc(db, "orders", editingOrder.id), {
        items: editOrderItems,
        subtotal,
        discount,
        total,
        instructions: editOrderInstructions,
        updatedAt: Timestamp.now(),
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id
            ? { ...o, items: editOrderItems, subtotal, discount, total, instructions: editOrderInstructions }
            : o
        )
      );

      setEditingOrder(null);
      alert(`Order ${editingOrder.orderNumber} successfully updated!`);
    } catch (err: any) {
      alert("Failed to update order: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  /* ---- Helpers ---- */
  const getElapsedMinutes = (createdAt: any) => {
    if (!createdAt) return 0;
    const orderDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
    const diffMs = Date.now() - orderDate.getTime();
    return Math.floor(diffMs / 60000);
  };

  const getFilteredOrders = () => {
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
        if (typeFilter === "takeaway") {
          const t = o.type || o.orderType || "takeaway";
          return t === "takeaway" || t === "counter";
        }
        return (o.type || o.orderType || "takeaway") === typeFilter;
      })
      .filter((o) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.items?.some((i) => i.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt || 0).getTime();
        return sortBy === "oldest" ? timeA - timeB : timeB - timeA;
      });
  };

  const counts = {
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
  };

  /* ============================================ */
  /* LOGIN GATE                                    */
  /* ============================================ */
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
        panel="kitchen"
        panelDisplayName="Kitchen Display & KOT System"
        panelIcon={<ChefHat size={28} />}
        onSuccess={(session) => {
          setStaffSession(session);
          setIsAuthenticated(true);
        }}
      />
    );
  }
  const filteredOrders = getFilteredOrders();

  /* ============================================ */
  /* MAIN DASHBOARD                                */
  /* ============================================ */
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100 select-none lg:flex-row">
      {/* ===================================================== */}
      {/* SIDEBAR                                                */}
      {/* ===================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-white/5 bg-slate-900/95 p-4 backdrop-blur-xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 ring-1 ring-white/10">
                <ChefHat size={20} />
              </div>
              <div>
                <h1 className="text-sm font-black leading-tight text-white">EL PRESTO</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                  {kitchenSettings.stationName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>

          {/* Create order button */}
          <button
            onClick={() => {
              setShowCreateModal(true);
              setIsSidebarOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-95"
          >
            <PlusCircle size={16} strokeWidth={2.5} /> Create Order
          </button>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/5 bg-slate-800/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                New
              </p>
              <p className="mt-0.5 font-mono text-lg font-black text-amber-400">
                {counts.pending}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-800/60 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Cooking
              </p>
              <p className="mt-0.5 font-mono text-lg font-black text-orange-400">
                {counts.preparing}
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1">
            {[
              { id: "new", label: "New Orders", icon: Bell, badge: counts.pending, color: "text-amber-400" },
              { id: "preparing", label: "Preparing", icon: Flame, badge: counts.preparing, color: "text-orange-400" },
              { id: "completed", label: "Ready / Done", icon: CheckCircle, badge: counts.completedToday, color: "text-emerald-400" },
              { id: "settings", label: "Settings", icon: SettingsIcon, color: "text-slate-400" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-black transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? "text-white" : tab.color} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        isActive ? "bg-white/25 text-white" : "bg-slate-800 text-slate-300"
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

        {/* Sidebar footer */}
        <div className="space-y-3 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-800/60 px-3 py-2 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live Kitchen
            </span>
            <span className="font-mono text-slate-500">UCER</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-black text-red-400 transition hover:bg-red-500/20"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ===================================================== */}
      {/* MAIN AREA                                              */}
      {/* ===================================================== */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-auto shrink-0 flex-col gap-2 border-b border-white/5 bg-slate-900/90 px-3 py-3 backdrop-blur-xl sm:px-4 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
          {/* Row 1: mobile menu + tabs + create */}
          <div className="flex items-center justify-between gap-2 lg:justify-start">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-xl bg-slate-800 p-2 text-slate-400 transition hover:text-white lg:hidden"
              >
                <MenuIcon size={16} />
              </button>

              {/* Tabs (icons only on mobile, labeled on sm+) */}
              <div className="flex items-center gap-1 rounded-2xl border border-white/5 bg-slate-950 p-1">
                {[
                  { id: "new", label: "New", icon: Bell, count: counts.pending, activeCls: "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30", countActive: "bg-slate-950 text-amber-400" },
                  { id: "preparing", label: "Preparing", icon: Flame, count: counts.preparing, activeCls: "bg-orange-500 text-white shadow-md shadow-orange-500/30", countActive: "bg-white/25 text-white" },
                  { id: "completed", label: "Ready", icon: CheckCircle, count: counts.completedToday, activeCls: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30", countActive: "bg-white/25 text-white" },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-black transition sm:px-3.5 sm:text-xs ${
                        active ? tab.activeCls : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon size={13} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 text-[9px] font-black ${
                          active ? tab.countActive : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <button
                onClick={() => {
                  const next = !kitchenSettings.soundEnabled;
                  setKitchenSettings((prev) => ({ ...prev, soundEnabled: next }));
                  if (next) playNotificationSound();
                }}
                className={`rounded-xl border p-2 text-xs font-bold transition ${
                  kitchenSettings.soundEnabled
                    ? "border-orange-500/40 bg-orange-500/20 text-orange-400"
                    : "border-white/5 bg-slate-800 text-slate-500"
                }`}
              >
                {kitchenSettings.soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
              <button
                onClick={toggleFullScreen}
                className="rounded-xl border border-white/5 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700"
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* Row 2 on mobile / inline on desktop */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 transition hover:scale-[1.03] active:scale-95 lg:flex"
            >
              <Plus size={15} strokeWidth={3} />
              <span>Create Order</span>
            </button>

            <div className="relative flex-1 sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={13}
              />
              <input
                type="text"
                placeholder="Search ticket or item…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-slate-800/80 py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 transition focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:w-48"
              />
            </div>

            <button
              onClick={() => setSortBy(sortBy === "oldest" ? "newest" : "oldest")}
              className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-700"
              title="Toggle sort order"
            >
              <ArrowUpDown size={13} className="text-orange-400" />
              <span className="hidden sm:inline">
                {sortBy === "oldest" ? "Oldest" : "Newest"}
              </span>
            </button>

            <DateNavigator
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
              variant="dark"
              orderCount={orders.length}
              isLoading={loading}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-xl border border-white/5 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="takeaway">Takeaway / Counter</option>
              <option value="delivery">Delivery</option>
            </select>

            <div className="hidden items-center gap-1.5 lg:flex">
              <button
                onClick={() => {
                  const next = !kitchenSettings.soundEnabled;
                  setKitchenSettings((prev) => ({ ...prev, soundEnabled: next }));
                  if (next) playNotificationSound();
                }}
                className={`rounded-xl border p-2 text-xs font-bold transition ${
                  kitchenSettings.soundEnabled
                    ? "border-orange-500/40 bg-orange-500/20 text-orange-400"
                    : "border-white/5 bg-slate-800 text-slate-500"
                }`}
                title="Kitchen audio chime"
              >
                {kitchenSettings.soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              </button>

              <button
                onClick={toggleFullScreen}
                className="rounded-xl border border-white/5 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700"
                title="Toggle fullscreen"
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>
        </header>

        {/* New order alert */}
        {newOrderAlert && (
          <div className="flex items-center justify-between gap-3 border-b border-orange-400/30 bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <span className="truncate">
                NEW ORDER — {newOrderAlert.orderNumber} · {newOrderAlert.items?.length} items
              </span>
            </div>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="shrink-0 rounded-md bg-black/20 px-2 py-0.5 transition hover:bg-black/40"
            >
              Dismiss
            </button>
          </div>
        )}

        {createOrderSuccessMsg && (
          <div className="flex items-center justify-between gap-3 border-b border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-lg">
            <span className="flex items-center gap-2">
              <CheckCircle size={15} /> {createOrderSuccessMsg}
            </span>
            <button
              onClick={() => setCreateOrderSuccessMsg(null)}
              className="rounded-md bg-black/20 px-2 py-0.5 transition hover:bg-black/40"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ===================================================== */}
        {/* TAB CONTENT                                            */}
        {/* ===================================================== */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-3 md:p-5">
          {activeTab === "settings" ? (
            /* ==================== SETTINGS ==================== */
            <div className="mx-auto max-w-xl space-y-5">
              <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur-xl sm:p-6">
                <div className="mb-5 flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                    <SettingsIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Station Preferences</h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Sound, identity, and display thresholds
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="mb-1.5 block font-black uppercase tracking-widest text-slate-400">
                      Kitchen / Station Name
                    </label>
                    <input
                      type="text"
                      value={kitchenSettings.stationName}
                      onChange={(e) =>
                        setKitchenSettings({ ...kitchenSettings, stationName: e.target.value })
                      }
                      className={inputCls}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-3.5">
                    <div className="min-w-0">
                      <p className="font-black text-white">Audio Alert</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        Chime on new orders
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !kitchenSettings.soundEnabled;
                        setKitchenSettings({ ...kitchenSettings, soundEnabled: next });
                        if (next) playNotificationSound();
                      }}
                      className={`shrink-0 rounded-xl px-3 py-1.5 font-black transition ${
                        kitchenSettings.soundEnabled
                          ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {kitchenSettings.soundEnabled ? "Enabled" : "Muted"}
                    </button>
                  </div>

                  <div>
                    <label className="mb-1.5 block font-black uppercase tracking-widest text-slate-400">
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
                          warningThresholdMins: parseInt(e.target.value) || 15,
                        })
                      }
                      className={inputCls}
                    />
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
                      Tickets open longer than this pulse red as a delay alert.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block font-black uppercase tracking-widest text-slate-400">
                      Default Sort Order
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setKitchenSettings({ ...kitchenSettings, defaultSort: "oldest" })
                        }
                        className={`rounded-xl border py-2.5 text-xs font-black transition ${
                          kitchenSettings.defaultSort === "oldest"
                            ? "border-orange-500 bg-orange-500/15 text-orange-300"
                            : "border-white/5 bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Oldest First (FIFO)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setKitchenSettings({ ...kitchenSettings, defaultSort: "newest" })
                        }
                        className={`rounded-xl border py-2.5 text-xs font-black transition ${
                          kitchenSettings.defaultSort === "newest"
                            ? "border-orange-500 bg-orange-500/15 text-orange-300"
                            : "border-white/5 bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Newest First
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(
                        "elpestro_kitchen_settings",
                        JSON.stringify(kitchenSettings)
                      );
                      setSortBy(kitchenSettings.defaultSort);
                      alert("Kitchen settings saved!");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
                  >
                    <Check size={15} /> Save Preferences
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== TICKETS ==================== */
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center py-24 text-center">
                  <Loader2 size={36} className="animate-spin text-orange-500 mx-auto" />
                  <p className="mt-4 text-sm font-black text-slate-300">Loading orders...</p>
                  <p className="mt-1 text-xs text-slate-500">Fetching live orders for {selectedDate}</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center py-24 text-center text-red-400">
                  <AlertTriangle size={36} className="text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-black text-red-300">Unable to load orders. Please try again.</p>
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
                  <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-900">
                    <ChefHat size={38} className="text-slate-700" />
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-400">
                    No orders found for this date.
                  </p>
                  <p className="mt-1 max-w-xs text-xs font-semibold text-slate-600">
                    No orders recorded for {formatISTDisplayDate(selectedDate)} under this filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95"
                  >
                    <PlusCircle size={15} /> Create New Order
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      order.items
                        ?.slice(0, 3)
                        .map((i: any) => `${i.quantity}× ${i.name}`)
                        .join(" • ") + (itemCount > 3 ? ` +${itemCount - 3} more` : "");
                    const src = (order.source || "").toLowerCase().trim();
                    const isExternal = src === "swiggy" || src === "zomato" || src === "website";

                    // Card background based on status
                    let cardBg = "bg-slate-900 border-white/5 hover:border-white/15";
                    if (isLate) {
                      cardBg = "bg-gradient-to-br from-red-950/40 to-slate-900 border-red-500/50 ring-1 ring-red-500/30";
                    } else if (order.status === "preparing") {
                      cardBg = "bg-gradient-to-br from-blue-950/30 to-slate-900 border-blue-500/30 hover:border-blue-500/50";
                    } else if (order.status === "ready") {
                      cardBg = "bg-gradient-to-br from-emerald-950/25 to-slate-900 border-emerald-500/30 hover:border-emerald-500/50";
                    } else if (order.status === "pending") {
                      cardBg = "bg-gradient-to-br from-amber-950/25 to-slate-900 border-amber-500/30 hover:border-amber-500/50";
                    } else if (
                      order.status === "completed" ||
                      order.deliveryStatus === "delivered"
                    ) {
                      cardBg = "bg-slate-900/60 border-white/5";
                    }

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${cardBg}`}
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
                          <div className="min-w-0">
                            <p className="font-mono text-base font-black tracking-tight text-white">
                              {order.orderNumber}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">
                              {order.customerName}
                            </p>
                          </div>

                          <span
                            className={`flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 font-mono text-[10px] font-black ${
                              isLate
                                ? "animate-pulse bg-red-500 text-white shadow-md shadow-red-500/40"
                                : elapsed >= 10
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            <Clock size={9} />
                            {elapsed}m
                          </span>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ring-1 ${
                              isDelivery
                                ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                                : "bg-slate-700/60 text-slate-300 ring-slate-600/40"
                            }`}
                          >
                            {isDelivery ? <Truck size={9} /> : <ShoppingBag size={9} />}
                            {isDelivery ? "Delivery" : "Pickup"}
                          </span>

                          <StatusBadge
                            status={order.status}
                            isDelivery={isDelivery}
                            isLate={isLate}
                          />

                          {isExternal && (
                            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-300 ring-1 ring-purple-500/30">
                              {src}
                            </span>
                          )}
                        </div>

                        {/* Items preview */}
                        <div className="mt-3 flex-1 border-t border-white/5 px-3.5 py-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Items
                            </p>
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-300">
                              {itemCount}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-200">
                            {itemSummary || "No items"}
                          </p>
                          {order.instructions && (
                            <p className="mt-2 line-clamp-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/20">
                              ⚠️ {order.instructions}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-1.5 border-t border-white/5 bg-slate-950/40 px-2.5 py-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.status === "pending" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "preparing")}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
                            >
                              <Flame size={11} /> Start
                            </button>
                          )}
                          {order.status === "preparing" && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(order.id, "ready", {
                                  kitchenCompletedAt: new Date().toISOString(),
                                  ...(isDelivery ? { deliveryStatus: "pending" } : {}),
                                })
                              }
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:scale-[1.02] hover:bg-emerald-500 active:scale-95"
                            >
                              <CheckCircle size={11} /> Ready
                            </button>
                          )}
                          {order.status === "ready" && !isDelivery && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(order.id, "completed", {
                                  completedAt: new Date().toISOString(),
                                })
                              }
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
                            >
                              <Check size={11} /> Served
                            </button>
                          )}
                          {order.status === "ready" && isDelivery && (
                            <span className="flex flex-1 items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
                              <Truck size={11} /> Awaiting Rider
                            </span>
                          )}
                          {(order.status === "completed" ||
                            order.deliveryStatus === "delivered") && (
                            <span className="flex flex-1 items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                              <CheckCircle size={11} /> Done
                            </span>
                          )}
                          {order.status === "cancelled" && (
                            <span className="flex flex-1 items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-400">
                              <X size={11} /> Cancelled
                            </span>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/5 bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                            title="View details"
                          >
                            <Eye size={13} />
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

      {/* ===================================================== */}
      {/* ORDER DETAILS MODAL                                    */}
      {/* ===================================================== */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 p-4 sm:p-5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-black text-orange-400">
                  {selectedOrder.orderNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${
                    (selectedOrder.type || selectedOrder.orderType) === "delivery"
                      ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                      : "bg-slate-700/60 text-slate-300 ring-slate-600/40"
                  }`}
                >
                  {(selectedOrder.type || selectedOrder.orderType) === "delivery" ? (
                    <>
                      <Truck size={9} /> Delivery
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={9} /> Pickup
                    </>
                  )}
                </span>
                <StatusBadge
                  status={selectedOrder.status}
                  isDelivery={
                    (selectedOrder.type || selectedOrder.orderType) === "delivery"
                  }
                />
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Customer
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    {selectedOrder.customerName}
                  </p>
                  {selectedOrder.phone && selectedOrder.phone !== "Counter" && (
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                      {selectedOrder.phone}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Time Elapsed
                  </p>
                  <p className="mt-1 font-mono text-sm font-black text-white">
                    {getElapsedMinutes(selectedOrder.createdAt)} min
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    {selectedOrder.createdAt?.toDate
                      ? selectedOrder.createdAt
                          .toDate()
                          .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Order Items
                  </p>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-300">
                    {selectedOrder.items?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500/15 font-mono text-sm font-black text-orange-400 ring-1 ring-orange-500/30">
                          {item.quantity}×
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {item.name}
                          </p>
                          {item.notes && (
                            <p className="mt-0.5 truncate text-[10px] font-bold text-amber-300">
                              📝 {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {(selectedOrder.instructions || selectedOrder.kitchenNotes) && (
                <div className="space-y-2">
                  {selectedOrder.instructions && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <AlertTriangle
                        size={15}
                        className="mt-0.5 shrink-0 text-amber-400"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                          Customer Note
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-amber-200">
                          {selectedOrder.instructions}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedOrder.kitchenNotes && (
                    <div className="flex items-start gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3">
                      <ChefHat
                        size={15}
                        className="mt-0.5 shrink-0 text-purple-400"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">
                          Kitchen Note
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-purple-200">
                          {selectedOrder.kitchenNotes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-3 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span className="font-bold">Total Amount</span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    ₹{Math.round(selectedOrder.total || 0)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="font-bold text-slate-400">Payment</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${
                      selectedOrder.paymentStatus === "paid"
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                    }`}
                  >
                    {selectedOrder.paymentStatus === "paid"
                      ? "✓ Paid"
                      : "⏳ Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 bg-slate-950/60 p-4">
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setNoteOrder(selectedOrder);
                  setNoteInput(selectedOrder.kitchenNotes || "");
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-slate-700"
              >
                <FileText size={13} /> Add Note
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  handlePrintReceipt(selectedOrder);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-slate-700"
              >
                <Printer size={13} /> Print
              </button>
              {isOrderEditable(selectedOrder) &&
                selectedOrder.status !== "completed" &&
                selectedOrder.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      handleStartEditOrder(selectedOrder);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <Edit size={13} /> Edit
                  </button>
                )}
              {selectedOrder.status !== "completed" &&
                selectedOrder.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      handleCancelOrder(selectedOrder);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/20"
                  >
                    <X size={13} /> Cancel
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* KITCHEN NOTE MODAL                                     */}
      {/* ===================================================== */}
      {noteOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">Add Kitchen Note</h3>
                <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-orange-400">
                  {noteOrder.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setNoteOrder(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-400 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="e.g. Extra sauce, 2 min delay on fries…"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/5 bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="flex gap-2 border-t border-white/5 bg-slate-950/60 p-4">
              <button
                onClick={() => setNoteOrder(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKitchenNote}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* CREATE ORDER MODAL (POS)                               */}
      {/* ===================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-4">
          <div className="flex h-full w-full flex-col overflow-hidden border border-white/10 bg-slate-900/95 backdrop-blur-2xl sm:h-[92vh] sm:max-w-6xl sm:rounded-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-slate-900/90 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                  <ChefHat size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-white sm:text-base">
                    POS Order Entry
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400 ring-1 ring-orange-500/30">
                      Live
                    </span>
                  </h3>
                  <p className="truncate text-[11px] font-semibold text-slate-500">
                    Select items left, review live bill right
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body: 2 column on lg */}
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/5 overflow-hidden lg:flex-row lg:divide-y-0 lg:divide-x lg:divide-white/5">
              {/* LEFT: Menu */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950/40 p-3 sm:p-4">
                {/* Quick dropdown */}
                <div className="mb-3 shrink-0 space-y-3">
                  <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Utensils size={12} className="text-orange-400" />
                        Quick Dropdown Selector
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selectedMenuItemId}
                        onChange={(e) => setSelectedMenuItemId(e.target.value)}
                        className="flex-1 rounded-xl border border-white/5 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="">— Choose item —</option>
                        {availableMenuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} • ₹{item.price} ({item.category})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center overflow-hidden rounded-xl border border-white/5 bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                            className="px-2.5 py-2 text-slate-400 transition hover:text-white"
                          >
                            −
                          </button>
                          <span className="min-w-[24px] px-2 text-center font-mono text-xs font-black text-white">
                            {selectedQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => q + 1)}
                            className="px-2.5 py-2 text-slate-400 transition hover:text-white"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={!selectedMenuItemId}
                          onClick={handleAddItemToOrder}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                        >
                          <Plus size={13} strokeWidth={3} /> Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                      size={14}
                    />
                    <input
                      type="text"
                      placeholder="Search menu item or category…"
                      value={menuSearchFilter}
                      onChange={(e) => setMenuSearchFilter(e.target.value)}
                      className="w-full rounded-2xl border border-white/5 bg-slate-900 px-4 py-2.5 pl-10 text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  {/* Categories */}
                  <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-1">
                    {["All", ...CATEGORIES].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMenuCategoryFilter(cat)}
                        className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                          menuCategoryFilter === cat
                            ? "border-orange-500/30 bg-orange-500 text-white shadow-md shadow-orange-500/25"
                            : "border-white/5 bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items grid */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {filteredDropdownMenuItems.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <Utensils size={32} className="text-slate-700" />
                      <p className="mt-2 text-xs font-black text-slate-500">
                        No items match
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                        Try another category or clear your search
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                      {filteredDropdownMenuItems.map((item) => {
                        const inBill = newOrderItems.find((i) => i.id === item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => !inBill && handleAddItemDirect(item)}
                            className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-3 transition-all ${
                              inBill
                                ? "border-orange-500/50 bg-orange-950/25 ring-1 ring-orange-500/30"
                                : "border-white/5 bg-slate-900 hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-slate-900/80"
                            }`}
                          >
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-1">
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20"
                                  title="Veg"
                                />
                                <span className="truncate text-[10px] font-black uppercase tracking-widest text-orange-400">
                                  {item.category || "Menu"}
                                </span>
                              </div>
                              <p className="line-clamp-2 text-xs font-bold leading-snug text-white">
                                {item.name}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                              <span className="font-mono text-sm font-black text-emerald-400">
                                ₹{item.price}
                              </span>

                              {inBill ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center overflow-hidden rounded-lg border border-orange-500/50 bg-orange-500/20"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, -1)}
                                    className="px-2 py-0.5 text-xs text-orange-300 transition hover:bg-orange-500/40"
                                  >
                                    −
                                  </button>
                                  <span className="px-1.5 font-mono text-xs font-black text-white">
                                    {inBill.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, 1)}
                                    className="px-2 py-0.5 text-xs text-orange-300 transition hover:bg-orange-500/40"
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
                                  className="flex items-center gap-1 rounded-lg border border-white/5 bg-slate-800 px-2.5 py-1 text-xs font-black text-slate-300 transition group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-white"
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

              {/* RIGHT: Live bill */}
              <div className="flex w-full flex-col overflow-hidden bg-slate-900/60 lg:w-[420px]">
                <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                      <Receipt size={13} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">
                      Live Bill
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-300">
                      {newOrderItems.reduce((acc, i) => acc + i.quantity, 0)}
                    </span>
                  </div>
                  {newOrderItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNewOrderItems([])}
                      className="text-[10px] font-black uppercase tracking-wider text-red-400 transition hover:text-red-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
                  {/* Order source */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Order Source
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "kitchen", label: "On Spot", icon: "🏪", sub: "Editable", color: "emerald" },
                        { id: "swiggy", label: "Swiggy", icon: "🟠", sub: "Locked", color: "orange" },
                        { id: "zomato", label: "Zomato", icon: "🔴", sub: "Locked", color: "red" },
                        { id: "website", label: "Website", icon: "🌐", sub: "Locked", color: "blue" },
                      ].map((s) => {
                        const active = newOrderSource === s.id;
                        const activeCls =
                          s.color === "emerald"
                            ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300"
                            : s.color === "orange"
                            ? "bg-orange-500/15 border-orange-500/60 text-orange-300"
                            : s.color === "red"
                            ? "bg-red-500/15 border-red-500/60 text-red-300"
                            : "bg-blue-500/15 border-blue-500/60 text-blue-300";
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setNewOrderSource(s.id as any)}
                            className={`flex flex-col rounded-xl border p-2 text-left transition ${
                              active
                                ? activeCls
                                : "border-white/5 bg-slate-800/50 text-slate-400 hover:text-white"
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

                  {/* Customer */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Customer
                      </label>
                      <input
                        type="text"
                        value={newOrderCustomer}
                        onChange={(e) => setNewOrderCustomer(e.target.value)}
                        placeholder="Name / Table"
                        className="w-full rounded-xl border border-white/5 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={newOrderPhone}
                        onChange={(e) => setNewOrderPhone(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-white/5 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Type + Payment */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Order Type
                      </label>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => setNewOrderType("takeaway")}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderType === "takeaway"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-400"
                          }`}
                        >
                          Pickup
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOrderType("delivery")}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderType === "delivery"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-400"
                          }`}
                        >
                          Dine-in
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Payment
                      </label>
                      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => setNewOrderPaymentMethod("cash")}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderPaymentMethod === "cash"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-400"
                          }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewOrderPaymentMethod("online")}
                          className={`rounded-lg py-1.5 text-[10px] font-black transition ${
                            newOrderPaymentMethod === "online"
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-slate-400"
                          }`}
                        >
                          📱 Online
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Cooking Notes
                    </label>
                    <input
                      type="text"
                      value={newOrderInstructions}
                      onChange={(e) => setNewOrderInstructions(e.target.value)}
                      placeholder="e.g. Extra cheese…"
                      className="w-full rounded-xl border border-white/5 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:border-orange-500/40 focus:outline-none"
                    />
                  </div>

                  {/* Items list */}
                  <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/60">
                    <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Item</span>
                      <span>Qty × Price</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {newOrderItems.length === 0 ? (
                        <div className="flex flex-col items-center py-8">
                          <ShoppingBag size={24} className="text-slate-700" />
                          <p className="mt-2 text-[11px] font-black text-slate-500">
                            Cart is empty
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-600">
                            Tap items on the left to add
                          </p>
                        </div>
                      ) : (
                        newOrderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-slate-800/30"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-white">
                                {item.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-500">
                                ₹{item.price} each
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <div className="flex items-center overflow-hidden rounded-lg border border-white/5 bg-slate-900">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, -1)}
                                  className="px-1.5 py-0.5 text-slate-400 transition hover:text-white"
                                >
                                  −
                                </button>
                                <span className="px-1.5 font-mono text-xs font-black text-orange-400">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, 1)}
                                  className="px-1.5 py-0.5 text-slate-400 transition hover:text-white"
                                >
                                  +
                                </button>
                              </div>

                              <span className="min-w-[46px] text-right font-mono text-xs font-black text-white">
                                ₹{item.price * item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromOrder(item.id)}
                                className="p-0.5 text-slate-500 transition hover:text-red-400"
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

                {/* Bill footer */}
                <div className="shrink-0 space-y-2.5 border-t border-white/5 px-4 py-3">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span className="font-bold">Subtotal</span>
                      <span className="font-mono font-black text-white">
                        ₹{newOrderItems.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-bold">Discount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        value={newOrderDiscount || ""}
                        onChange={(e) => setNewOrderDiscount(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-20 rounded-lg border border-white/5 bg-slate-800 px-2 py-1 text-right font-mono text-xs font-black text-white focus:border-orange-500/40 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <span className="text-sm font-black text-white">Grand Total</span>
                      <span className="font-mono text-lg font-black text-emerald-400">
                        ₹
                        {Math.max(
                          0,
                          newOrderItems.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0) -
                            (newOrderDiscount || 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingOrder || newOrderItems.length === 0}
                      onClick={() => handleCreateKitchenOrder(undefined, true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-slate-800 px-3 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                      title="Create + print KOT"
                    >
                      <Printer size={14} /> Print
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingOrder || newOrderItems.length === 0}
                      onClick={() => handleCreateKitchenOrder(undefined, false)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Placing…
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

      {/* ===================================================== */}
      {/* EDIT ORDER MODAL                                       */}
      {/* ===================================================== */}
      {editingOrder && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl sm:rounded-3xl">
            <div className="flex justify-center pt-3 sm:hidden">
              <span className="h-1.5 w-12 rounded-full bg-slate-700" />
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-white/5 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-white sm:text-base">
                    Edit Order
                  </h3>
                  <span className="font-mono text-sm font-black text-orange-400">
                    {editingOrder.orderNumber}
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                    Editable
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                  {editingOrder.customerName}
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400 transition hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Quick add */}
              <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-3">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Add Item From Menu
                </span>
                <div className="flex gap-2">
                  <select
                    value={editSelectedMenuItemId}
                    onChange={(e) => setEditSelectedMenuItemId(e.target.value)}
                    className="flex-1 rounded-xl border border-white/5 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500/40 focus:outline-none"
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

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Items in order
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-300">
                    {editOrderItems.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/60">
                  <div className="divide-y divide-white/5">
                    {editOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">
                            {item.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-500">
                            ₹{item.price} each
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex items-center overflow-hidden rounded-lg border border-white/5 bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateEditItemQty(item.id, -1)}
                              className="px-2 py-1 text-slate-400 transition hover:text-white"
                            >
                              −
                            </button>
                            <span className="px-2 font-mono text-xs font-black text-orange-400">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateEditItemQty(item.id, 1)}
                              className="px-2 py-1 text-slate-400 transition hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <span className="min-w-[50px] text-right font-mono text-xs font-black text-white">
                            ₹{item.price * item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditItem(item.id)}
                            className="p-1 text-slate-500 transition hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Special Instructions
                </label>
                <input
                  type="text"
                  value={editOrderInstructions}
                  onChange={(e) => setEditOrderInstructions(e.target.value)}
                  className="w-full rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-white focus:border-orange-500/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/5 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs">
                <span className="font-bold text-slate-400">Recalculated Total:</span>
                <span className="ml-2 font-mono text-base font-black text-emerald-400">
                  ₹{editOrderItems.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 rounded-xl border border-white/5 bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-slate-700 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit || editOrderItems.length === 0}
                  onClick={handleSaveEditedOrder}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/25 transition hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100 sm:flex-none"
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
