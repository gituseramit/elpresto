// Multi-Outlet Branch Service & Safe Zero-Downtime Migration
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  Branch,
  Kitchen,
  Counter,
  DeliveryPartner,
  BranchMenuAvailability,
} from "@/lib/types";
import { calculateDistance } from "@/lib/delivery";

export const DEFAULT_MAIN_BRANCH_ID = "branch-main";

export const DEFAULT_MAIN_BRANCH: Branch = {
  id: DEFAULT_MAIN_BRANCH_ID,
  name: "EL PRESTO - UCER Naini Hub",
  code: "BR-01",
  address: "United College of Engineering & Research, Naini, Prayagraj - 211010",
  lat: 25.3409769,
  lng: 81.9116436,
  contactPhone: "+91 6392512314",
  contactEmail: "elprestopizza@gmail.com",
  operatingHours: {
    openTime: "10:00",
    closeTime: "23:00",
    isOpen: true,
  },
  active: true,
  deliveryRadiusKm: 7,
  baseDeliveryFee: 30,
  freeDeliveryThreshold: 499,
  printerConfig: {
    cafeName: "EL PRESTO PIZZA",
    phone: "+91 6392512314",
    address: "UCER Campus, Naini, Prayagraj",
    paperWidth: "58mm",
    footerText: "*** THANK YOU! VISIT AGAIN ***",
  },
  taxSettings: {
    gstNumber: "09AABCE1234F1Z5",
    vatPercent: 5,
  },
  isDefault: true,
};

/**
 * Safe Zero-Downtime Migration:
 * Ensures the existing single-outlet setup is registered as "Branch 1" (branch-main)
 * along with its initial kitchen and counter, WITHOUT modifying or deleting any existing orders or menu items.
 */
export async function initDefaultBranchIfMissing(): Promise<Branch> {
  try {
    const branchRef = doc(db, "branches", DEFAULT_MAIN_BRANCH_ID);
    const snap = await getDoc(branchRef);

    if (!snap.exists()) {
      await setDoc(branchRef, {
        ...DEFAULT_MAIN_BRANCH,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Initialize default kitchen station for Branch 1
      const kitchenRef = doc(db, "kitchens", "kitchen-main");
      const kitchenSnap = await getDoc(kitchenRef);
      if (!kitchenSnap.exists()) {
        await setDoc(kitchenRef, {
          id: "kitchen-main",
          branchId: DEFAULT_MAIN_BRANCH_ID,
          name: "Main Hot Kitchen & KOT",
          active: true,
          supportedCategories: [], // All categories
          orderQueueCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Initialize default counter register for Branch 1
      const counterRef = doc(db, "counters", "counter-1");
      const counterSnap = await getDoc(counterRef);
      if (!counterSnap.exists()) {
        await setDoc(counterRef, {
          id: "counter-1",
          branchId: DEFAULT_MAIN_BRANCH_ID,
          name: "Express POS Register 1",
          counterNumber: "C-01",
          active: true,
          printerConfig: DEFAULT_MAIN_BRANCH.printerConfig,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return DEFAULT_MAIN_BRANCH;
    }

    return { id: snap.id, ...(snap.data() as Branch) };
  } catch (err) {
    console.warn("Could not check/initialize default branch:", err);
    return DEFAULT_MAIN_BRANCH;
  }
}

/**
 * Fetches all active outlets
 */
export async function getActiveBranches(): Promise<Branch[]> {
  try {
    const q = query(collection(db, "branches"), where("active", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) {
      // Auto-migrate if empty
      const defaultBranch = await initDefaultBranchIfMissing();
      return [defaultBranch];
    }
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Branch) }));
  } catch (err) {
    console.warn("Error getting active branches, fallback to default:", err);
    return [DEFAULT_MAIN_BRANCH];
  }
}

/**
 * Fetches all branches (including inactive) for developer administration
 */
export async function getAllBranches(): Promise<Branch[]> {
  try {
    const snap = await getDocs(collection(db, "branches"));
    if (snap.empty) {
      const defaultBranch = await initDefaultBranchIfMissing();
      return [defaultBranch];
    }
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Branch) }));
  } catch (err) {
    console.warn("Error getting all branches:", err);
    return [DEFAULT_MAIN_BRANCH];
  }
}

/**
 * Fetch branch by ID with fallback to default main branch
 */
export async function getBranchById(branchId: string): Promise<Branch> {
  if (!branchId || branchId === DEFAULT_MAIN_BRANCH_ID) {
    return DEFAULT_MAIN_BRANCH;
  }
  try {
    const snap = await getDoc(doc(db, "branches", branchId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Branch) };
    }
  } catch (err) {
    console.warn(`Error getting branch ${branchId}:`, err);
  }
  return DEFAULT_MAIN_BRANCH;
}

/**
 * Save or update branch details
 */
export async function saveBranch(branchData: Partial<Branch> & { id?: string }): Promise<string> {
  const branchId = branchData.id || `branch-${Date.now()}`;
  const ref = doc(db, "branches", branchId);
  const payload = {
    ...branchData,
    id: branchId,
    updatedAt: serverTimestamp(),
  };

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
  return branchId;
}

/**
 * Multi-Branch Order Routing:
 * Matches customer coordinates to the nearest eligible active branch within delivery radius.
 */
export function resolveNearestBranch(
  customerLat: number,
  customerLng: number,
  branches: Branch[]
): {
  branch: Branch;
  distanceKm: number;
  isWithinRadius: boolean;
} {
  const activeBranches = branches.filter((b) => b.active);
  if (activeBranches.length === 0) {
    const fallback = DEFAULT_MAIN_BRANCH;
    const dist = calculateDistance(customerLat, customerLng, fallback.lat, fallback.lng);
    return {
      branch: fallback,
      distanceKm: dist,
      isWithinRadius: dist <= fallback.deliveryRadiusKm,
    };
  }

  let bestBranch = activeBranches[0];
  let minDistance = calculateDistance(customerLat, customerLng, bestBranch.lat, bestBranch.lng);

  for (let i = 1; i < activeBranches.length; i++) {
    const candidate = activeBranches[i];
    const dist = calculateDistance(customerLat, customerLng, candidate.lat, candidate.lng);
    if (dist < minDistance) {
      minDistance = dist;
      bestBranch = candidate;
    }
  }

  return {
    branch: bestBranch,
    distanceKm: minDistance,
    isWithinRadius: minDistance <= bestBranch.deliveryRadiusKm,
  };
}

/* ============================================================ */
/* KITCHENS & COUNTERS SUB-RESOURCES                            */
/* ============================================================ */

export async function getKitchensForBranch(branchId: string): Promise<Kitchen[]> {
  try {
    const q = query(collection(db, "kitchens"), where("branchId", "==", branchId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Kitchen) }));
  } catch (err) {
    console.warn(`Error getting kitchens for branch ${branchId}:`, err);
    return [];
  }
}

export async function getCountersForBranch(branchId: string): Promise<Counter[]> {
  try {
    const q = query(collection(db, "counters"), where("branchId", "==", branchId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Counter) }));
  } catch (err) {
    console.warn(`Error getting counters for branch ${branchId}:`, err);
    return [];
  }
}

/* ============================================================ */
/* CENTRALIZED MENU: PER-BRANCH AVAILABILITY                    */
/* ============================================================ */

/**
 * Returns a mapping of { [menuItemId]: { available: boolean, priceOverride?: number } }
 * for a specific branch.
 */
export async function getBranchMenuAvailabilityMap(
  branchId: string
): Promise<Record<string, { available: boolean; priceOverride?: number | null }>> {
  try {
    const q = query(
      collection(db, "branchMenuAvailability"),
      where("branchId", "==", branchId)
    );
    const snap = await getDocs(q);
    const result: Record<string, { available: boolean; priceOverride?: number | null }> = {};
    snap.docs.forEach((doc) => {
      const data = doc.data() as BranchMenuAvailability;
      result[data.menuItemId] = {
        available: data.available !== false,
        priceOverride: data.priceOverride ?? null,
      };
    });
    return result;
  } catch (err) {
    console.warn("Could not get branch menu availability:", err);
    return {};
  }
}

/**
 * Toggles or overrides a menu item's availability/price at a specific branch
 */
export async function setBranchItemAvailability(
  branchId: string,
  menuItemId: string,
  available: boolean,
  priceOverride?: number | null
): Promise<void> {
  const docId = `${branchId}_${menuItemId}`;
  const ref = doc(db, "branchMenuAvailability", docId);
  await setDoc(
    ref,
    {
      id: docId,
      branchId,
      menuItemId,
      available,
      priceOverride: priceOverride !== undefined ? priceOverride : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ============================================================ */
/* DELIVERY PARTNERS & FLEET MANAGEMENT                         */
/* ============================================================ */

export async function getDeliveryPartners(branchId?: string): Promise<DeliveryPartner[]> {
  try {
    let q = query(collection(db, "deliveryPartners"));
    if (branchId && branchId !== "ALL") {
      q = query(collection(db, "deliveryPartners"), where("assignedBranchId", "==", branchId));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryPartner) }));
  } catch (err) {
    console.warn("Could not get delivery partners:", err);
    return [];
  }
}
