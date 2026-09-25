// Delivery configuration and helper utilities

export interface DeliverySettings {
  cafeName: string;
  cafeLat: number;
  cafeLng: number;
  deliveryRadiusKm: number;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryEnabled: boolean;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  cafeName: "EL PRESTO PIZZA",
  cafeLat: 25.3409769,
  cafeLng: 81.9116436,
  deliveryRadiusKm: 7, // 7 km radius around UCER
  baseDeliveryFee: 30, // ₹30 base fee
  freeDeliveryThreshold: 499, // Free delivery above ₹499
  deliveryEnabled: true,
};

/**
 * Calculates Haversine distance in kilometers between two coordinates
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate delivery fee based on distance and cart subtotal
 * - Within 1 km: Cart >= ₹199 -> Free, else ₹10/km (min ₹10)
 * - > 1 km up to 5 km: Cart >= ₹299 -> Free, else ₹10/km
 * - > 5 km: Cart >= ₹499 -> Free, else ₹10/km
 */
export function calculateDeliveryFee(
  subtotal: number,
  distanceKm: number,
  _settings: Partial<DeliverySettings> = {}
): number {
  const dist = Math.max(0.1, distanceKm || 0);

  if (dist <= 1) {
    if (subtotal >= 199) return 0;
    return Math.max(10, Math.round(dist * 10));
  } else if (dist <= 5) {
    if (subtotal >= 299) return 0;
    return Math.round(dist * 10);
  } else {
    if (subtotal >= 499) return 0;
    return Math.round(dist * 10);
  }
}
