export const ACTIVE_ORDER_CHANGED_EVENT = "elpresto:active-order-changed";

export function announceActiveOrderChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVE_ORDER_CHANGED_EVENT));
  }
}
