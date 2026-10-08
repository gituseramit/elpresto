import { doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "assigned"
  | "out_for_delivery"
  | "completed"
  | "delivered"
  | "cancelled"
  | "rejected";

export interface OrderStatusActor {
  id: string;
  name?: string;
  role?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: unknown;
  by: string;
  byName?: string;
  byRole?: string;
}

export type OrderStatusPatch = Record<string, unknown>;

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "preparing", "ready", "cancelled", "rejected"],
  confirmed: ["preparing", "ready", "cancelled", "rejected"],
  preparing: ["ready", "cancelled", "rejected"],
  ready: ["assigned", "out_for_delivery", "completed", "delivered", "cancelled", "rejected"],
  assigned: ["out_for_delivery", "delivered", "cancelled", "rejected"],
  out_for_delivery: ["delivered", "completed", "cancelled", "rejected"],
  completed: [],
  delivered: [],
  cancelled: [],
  rejected: [],
};

const STATUS_ALIASES: Record<string, OrderStatus> = {
  placed: "pending",
  received: "pending",
  pending: "pending",
  confirmed: "confirmed",
  cooking: "preparing",
  preparing: "preparing",
  ready: "ready",
  assigned: "assigned",
  out_for_delivery: "out_for_delivery",
  completed: "completed",
  delivered: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  rejected: "rejected",
};

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const key = String(value || "pending").trim().toLowerCase().replace(/[ -]+/g, "_");
  return STATUS_ALIASES[key] || "pending";
}

/**
 * Resolve legacy orders that still have a separate deliveryStatus field into
 * the same status used by new writes and customer-facing views.
 */
export function getOrderStatus(order: {
  status?: unknown;
  deliveryStatus?: unknown;
} | null | undefined): OrderStatus {
  if (!order) return "pending";
  const status = normalizeOrderStatus(order.status);
  const deliveryStatus = normalizeOrderStatus(order.deliveryStatus);

  if (status === "cancelled" || status === "rejected") return status;
  if (deliveryStatus === "delivered" || status === "delivered") return "delivered";
  if (deliveryStatus === "out_for_delivery" || status === "out_for_delivery") return "out_for_delivery";
  if (deliveryStatus === "assigned" || status === "assigned") return "assigned";
  if (status !== "pending") return status;
  return deliveryStatus === "pending" ? "pending" : deliveryStatus;
}

export function isTerminalOrderStatus(status: unknown): boolean {
  const normalized = normalizeOrderStatus(status);
  return ["completed", "delivered", "cancelled", "rejected"].includes(normalized);
}

export function isActiveOrder(order: {
  status?: unknown;
  deliveryStatus?: unknown;
} | null | undefined): boolean {
  return !isTerminalOrderStatus(getOrderStatus(order));
}

export function createInitialOrderStatusFields(
  actor: OrderStatusActor,
  status: OrderStatus = "pending"
) {
  const at = Timestamp.now();
  return {
    status,
    statusHistory: [{
      status,
      at,
      by: actor.id,
      ...(actor.name ? { byName: actor.name } : {}),
      ...(actor.role ? { byRole: actor.role } : {}),
    } satisfies OrderStatusEvent],
    updatedAt: at,
    updatedBy: actor.id,
  };
}

/** Atomically validates and records every order status transition. */
export async function updateOrderStatus(
  orderId: string,
  requestedStatus: OrderStatus,
  actor: OrderStatusActor,
  patch: OrderStatusPatch = {}
): Promise<OrderStatus> {
  const orderRef = doc(db, "orders", orderId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists()) throw new Error("Order not found.");

    const order = snapshot.data();
    const currentStatus = getOrderStatus(order);
    const isDeliveryOrder = (order.orderType || order.type) === "delivery";
    const nextStatus =
      isDeliveryOrder && requestedStatus === "completed"
        ? "delivered"
        : requestedStatus;

    if (currentStatus !== nextStatus) {
      const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
      if (!allowed.includes(nextStatus)) {
        throw new Error(`Order cannot move from ${currentStatus} to ${nextStatus}.`);
      }
      if (
        !isDeliveryOrder &&
        ["assigned", "out_for_delivery", "delivered"].includes(nextStatus)
      ) {
        throw new Error("Delivery-only status cannot be used for a pickup order.");
      }
    }

    const at = Timestamp.now();
    const history = Array.isArray(order.statusHistory)
      ? order.statusHistory as OrderStatusEvent[]
      : [];
    const historyEntry: OrderStatusEvent = {
      status: nextStatus,
      at,
      by: actor.id,
      ...(actor.name ? { byName: actor.name } : {}),
      ...(actor.role ? { byRole: actor.role } : {}),
    };
    const nextDeliveryStatus =
      isDeliveryOrder && ["assigned", "out_for_delivery", "delivered"].includes(nextStatus)
        ? nextStatus
        : undefined;

    transaction.update(orderRef, {
      ...patch,
      status: nextStatus,
      ...(nextDeliveryStatus ? { deliveryStatus: nextDeliveryStatus } : {}),
      ...(currentStatus !== nextStatus
        ? { statusHistory: [...history, historyEntry] }
        : {}),
      updatedAt: serverTimestamp(),
      updatedBy: actor.id,
    });

    return nextStatus;
  });
}
