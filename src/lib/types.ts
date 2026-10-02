// Centralized TypeScript Interfaces and Enums for El Presto Platform

export interface SavedAddress {
  id: string;
  label: string;
  houseFlat: string;
  streetArea: string;
  landmark?: string;
  city: string;
  pincode: string;
  fullAddress: string;
}

export interface CustomerProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  createdAt: any;
  updatedAt: any;
  savedAddresses?: SavedAddress[];
  loyaltyPoints?: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  type: "discount" | "item";
  pointsCost: number;
  discountAmount?: number;
  discountType?: "flat" | "percentage";
  itemName?: string;
  itemId?: string;
  active: boolean;
  createdAt?: any;
}

export interface Subcategory {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  subcategories?: Subcategory[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  categoryId?: string;
  subcategory?: string;
  subcategoryId?: string;
  imageUrl?: string;
  available: boolean;
  order?: number;
  isVeg?: boolean;
}

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export type OrderType = "takeaway" | "counter" | "delivery" | "dine_in";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "assigned"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "out_for_delivery"
  | "delivered";

export interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  type: OrderType;
  orderType?: OrderType;
  status: OrderStatus;
  deliveryStatus?: DeliveryStatus;
  items: OrderItem[];
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: "cash" | "online" | string;
  paymentStatus: "paid" | "pending" | string;
  source: "website" | "counter" | "kitchen" | "swiggy" | "zomato" | string;
  instructions?: string;
  kitchenNotes?: string;
  tableNumber?: string;
  createdAt: any;
  readyAt?: any;
  completedAt?: any;
  deliveredAt?: any;
  updatedAt?: any;
  deliveryAddress?: {
    houseFlat?: string;
    streetArea?: string;
    landmark?: string;
    city?: string;
    pincode?: string;
    fullAddress?: string;
  };
  location?: any;
  orderLocation?: { lat: number; lng: number; address?: string; branchId?: string; kind?: "delivery" | "pickup" };
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistance?: number;
  deliveryPersonName?: string;
  deliveryPersonId?: string;
  deliveryPersonLatitude?: number;
  deliveryPersonLongitude?: number;
  deliveryPersonLocation?: { lat: number; lng: number; updatedAt?: any };
  deliveryLocationUpdatedAt?: any;
  cancelReason?: string;
  customerId?: string;
  customerEmail?: string;
  deliveryOtp?: string;
  otpVerified?: boolean;
  promoCode?: string;
  discountAmount?: number;
  packingCharge?: number;
  packingChargeBreakdown?: Record<string, number>;
  loyaltyDiscount?: number;
  loyaltyRewardId?: string | null;
  loyaltyRewardName?: string | null;
  loyaltyPointsRedeemed?: number;
  loyaltyPointsEarned?: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  // Multi-outlet platform extensions
  branchId?: string;
  kitchenId?: string | null;
  counterId?: string | null;
  deliveryPartnerId?: string | null;
  createdBy?: string | null;
  orderSource?: "website" | "counter" | "kitchen" | "swiggy" | "zomato" | string;
  customerLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  assignedAt?: any;
  assignedBy?: string;
  acceptedAt?: any;
  pickedUpAt?: any;
}

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxDiscountCap?: number;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  usageCount: number;
  active: boolean;
  expiryDate?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  promo?: PromoCode;
  discountAmount: number;
  finalTotal: number;
}

/* ============================================================ */
/* MULTI-OUTLET HIERARCHY & ROLES DATA MODEL                   */
/* ============================================================ */

export interface BranchPrinterConfig {
  cafeName: string;
  phone: string;
  address: string;
  paperWidth?: "58mm" | "80mm";
  footerText?: string;
  gstNumber?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string; // e.g. "BR-01", "main"
  address: string;
  lat: number;
  lng: number;
  contactPhone: string;
  contactEmail: string;
  operatingHours: {
    openTime: string; // "10:00"
    closeTime: string; // "23:00"
    isOpen: boolean;
  };
  active: boolean;
  deliveryRadiusKm: number;
  attendanceRadiusMeters?: number;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  printerConfig?: BranchPrinterConfig;
  taxSettings?: {
    gstNumber?: string;
    vatPercent?: number;
  };
  isDefault?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Kitchen {
  id: string;
  branchId: string;
  name: string;
  active: boolean;
  assignedStaff?: string[]; // Array of User IDs
  supportedCategories?: string[]; // Empty means all categories
  orderQueueCount?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Counter {
  id: string;
  branchId: string;
  name: string;
  counterNumber: string;
  assignedStaff?: string[]; // Array of User IDs
  active: boolean;
  printerConfig?: BranchPrinterConfig;
  createdAt?: any;
  updatedAt?: any;
}

export type DeliveryPartnerAvailability = "AVAILABLE" | "BUSY" | "OFFLINE";

export interface DeliveryPartner {
  id: string;
  userId?: string; // Firebase Auth UID if user account linked
  name: string;
  mobile: string;
  email?: string;
  assignedBranchId: string;
  active: boolean;
  availability: DeliveryPartnerAvailability;
  liveLocation?: {
    lat: number;
    lng: number;
    updatedAt: any;
  };
  currentOrderId?: string | null;
  completedDeliveriesCount: number;
  rating?: number;
  vehicleType?: "scooter" | "bike" | "bicycle";
  vehicleNumber?: string;
  permissions?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export type UserRole =
  | "SUPER_ADMIN"
  | "DEVELOPER"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "KITCHEN_MANAGER"
  | "KITCHEN_STAFF"
  | "COUNTER_MANAGER"
  | "COUNTER_STAFF"
  | "DELIVERY_MANAGER"
  | "DELIVERY_PARTNER"
  | "CUSTOMER";

export type Permission =
  | "orders.view"
  | "orders.create"
  | "orders.edit"
  | "orders.cancel"
  | "orders.assign"
  | "orders.deliver"
  | "menu.view"
  | "menu.create"
  | "menu.edit"
  | "menu.delete"
  | "kitchen.view"
  | "kitchen.manage"
  | "counter.view"
  | "counter.manage"
  | "delivery.view"
  | "delivery.assign"
  | "delivery.track"
  | "users.view"
  | "users.manage"
  | "branches.view"
  | "branches.manage"
  | "promos.manage"
  | "payments.view"
  | "payments.manage"
  | "reports.view"
  | "attendance.view"
  | "attendance.mark"
  | "system.manage";

export interface StaffProfile {
  id: string; // Firestore doc ID (same as staffId)
  staffId: string; // Login username e.g. "kitchen_amit", "admin_root"
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId: string; // Specific branchId or "ALL" for super_admin/developer
  assignedKitchenIds?: string[];
  assignedCounterIds?: string[];
  customPermissions?: Permission[];
  active: boolean;
  avatarUrl?: string;
  // Authentication fields
  passwordHash?: string; // bcrypt hash — NEVER returned to client
  mustChangePassword?: boolean; // Force password reset on first login
  lastLoginAt?: any;
  lastLoginIP?: string;
  failedLoginAttempts?: number;
  lockedUntil?: any; // Firestore Timestamp — null when not locked
  createdAt?: any;
  updatedAt?: any;
}

export interface BranchMenuAvailability {
  id: string; // `${branchId}_${menuItemId}`
  branchId: string;
  menuItemId: string;
  available: boolean;
  priceOverride?: number | null;
  updatedAt?: any;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  branchId?: string | null;
  action: string;
  targetType: "branch" | "kitchen" | "counter" | "order" | "user" | "menu" | "delivery" | "system" | string;
  targetId?: string;
  metadata?: Record<string, any>;
  timestamp: any;
}
