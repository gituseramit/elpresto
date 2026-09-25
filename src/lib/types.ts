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
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistance?: number;
  deliveryPersonName?: string;
  deliveryPersonId?: string;
  deliveryPersonLatitude?: number;
  deliveryPersonLongitude?: number;
  deliveryLocationUpdatedAt?: any;
  cancelReason?: string;
  customerId?: string;
  customerEmail?: string;
  deliveryOtp?: string;
  otpVerified?: boolean;
  promoCode?: string;
  discountAmount?: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
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

