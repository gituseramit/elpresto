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
 * Auto-provisions dedicated Kitchen and Counter records for a branch if they do not exist.
 */
export async function provisionStationsForBranch(
  branchId: string,
  branchName: string
): Promise<{ kitchenId: string; counterId: string }> {
  const kitchenId = `kitchen-${branchId}`;
  const counterId = `counter-${branchId}`;

  try {
    const kRef = doc(db, "kitchens", kitchenId);
    const kSnap = await getDoc(kRef);
    if (!kSnap.exists()) {
      await setDoc(kRef, {
        id: kitchenId,
        branchId,
        name: `${branchName} Kitchen Station`,
        active: true,
        supportedCategories: [],
        orderQueueCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const cRef = doc(db, "counters", counterId);
    const cSnap = await getDoc(cRef);
    if (!cSnap.exists()) {
      await setDoc(cRef, {
        id: counterId,
        branchId,
        name: `${branchName} Main Counter`,
        counterNumber: "1",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn(`Could not auto-provision stations for branch ${branchId}:`, err);
  }

  return { kitchenId, counterId };
}

/**
 * Save or update branch details. Auto-provisions dedicated kitchen and counter for new branches.
 */
export async function saveBranch(branchData: Partial<Branch> & { id?: string }): Promise<string> {
  const branchId = branchData.id || `branch-${Date.now()}`;
  const ref = doc(db, "branches", branchId);
  const payload: any = {
    ...branchData,
    id: branchId,
    updatedAt: serverTimestamp(),
  };

  const snap = await getDoc(ref);
  const isNew = !snap.exists();
  if (isNew) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });

  // Auto-provision kitchen and counter records for every new branch
  if (isNew) {
    await provisionStationsForBranch(branchId, branchData.name || "New Outlet");
  }

  return branchId;
}

/**
 * Evaluates whether a branch is open right now based on its operatingHours.
 */
export function isBranchOpen(branch: Branch): boolean {
  if (!branch.active) return false;
  if (!branch.operatingHours) return true;
  if (branch.operatingHours.isOpen === false) return false;

  const { openTime, closeTime } = branch.operatingHours;
  if (!openTime || !closeTime) return true;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const currentMins = h * 60 + m;

    const [openH, openM] = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;

    if (closeMins >= openMins) {
      return currentMins >= openMins && currentMins <= closeMins;
    } else {
      // Midnight crossover (e.g. 11:00 to 02:00)
      return currentMins >= openMins || currentMins <= closeMins;
    }
  } catch {
    return true;
  }
}

export interface BranchEvaluation {
  branch: Branch;
  distanceKm: number;
  isWithinRadius: boolean;
  isOpen: boolean;
}

export interface ResolveNearestBranchResult {
  branch: Branch;
  distanceKm: number;
  isWithinRadius: boolean;
  isOpen: boolean;
  canDeliver: boolean;
  allBranches: BranchEvaluation[];
}

/**
 * Multi-Branch Order Routing:
 * Matches customer coordinates to the nearest eligible active branch within delivery radius.
 * Handles operating hours, delivery radius serviceability, and distance tie-breakers.
 */
export function resolveNearestBranch(
  customerLat: number,
  customerLng: number,
  branches: Branch[],
  options?: { isDelivery?: boolean }
): ResolveNearestBranchResult {
  const isDelivery = options?.isDelivery ?? true;
  const activeBranches = branches.filter((b) => b.active);

  if (activeBranches.length === 0) {
    const fallback = DEFAULT_MAIN_BRANCH;
    const dist = calculateDistance(customerLat, customerLng, fallback.lat, fallback.lng);
    const open = isBranchOpen(fallback);
    const within = dist <= fallback.deliveryRadiusKm;
    return {
      branch: fallback,
      distanceKm: Math.round(dist * 100) / 100,
      isWithinRadius: within,
      isOpen: open,
      canDeliver: isDelivery ? within && open : open,
      allBranches: [{ branch: fallback, distanceKm: Math.round(dist * 100) / 100, isWithinRadius: within, isOpen: open }],
    };
  }

  // Evaluate every active branch
  const evaluated: BranchEvaluation[] = activeBranches.map((b) => {
    const dist = calculateDistance(customerLat, customerLng, b.lat, b.lng);
    const within = dist <= b.deliveryRadiusKm;
    const open = isBranchOpen(b);
    return {
      branch: b,
      distanceKm: Math.round(dist * 100) / 100,
      isWithinRadius: within,
      isOpen: open,
    };
  });

  // Sort candidates
  const sorted = [...evaluated].sort((a, b) => {
    if (isDelivery) {
      // Priority 1: Serviceable (within radius & open)
      const aServiceable = a.isWithinRadius && a.isOpen;
      const bServiceable = b.isWithinRadius && b.isOpen;
      if (aServiceable && !bServiceable) return -1;
      if (!aServiceable && bServiceable) return 1;

      // Priority 2: Within radius
      if (a.isWithinRadius && !b.isWithinRadius) return -1;
      if (!a.isWithinRadius && b.isWithinRadius) return 1;
    } else {
      // For takeaway, priority is Open
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
    }

    // Distance tie-breaker (tolerance 0.1km = 100m)
    if (Math.abs(a.distanceKm - b.distanceKm) < 0.1) {
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      if (a.branch.isDefault) return -1;
      if (b.branch.isDefault) return 1;
    }

    return a.distanceKm - b.distanceKm;
  });

  const best = sorted[0];
  const canDeliver = isDelivery ? best.isWithinRadius && best.isOpen : best.isOpen;

  return {
    branch: best.branch,
    distanceKm: best.distanceKm,
    isWithinRadius: best.isWithinRadius,
    isOpen: best.isOpen,
    canDeliver,
    allBranches: sorted,
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

/**
 * Reassigns an order to another branch with an explicit audit log entry.
 */
export async function reassignOrderBranch(
  orderId: string,
  targetBranchId: string,
  actor: { id: string; name: string; role: string },
  reason?: string
): Promise<void> {
  const branchRef = doc(db, "branches", targetBranchId);
  const branchSnap = await getDoc(branchRef);
  const branchData = branchSnap.exists() ? (branchSnap.data() as Branch) : null;

  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  const oldBranchId = orderSnap.exists() ? orderSnap.data()?.branchId : null;

  await updateDoc(orderRef, {
    branchId: targetBranchId,
    branchName: branchData?.name || targetBranchId,
    branchCode: branchData?.code || "",
    updatedAt: serverTimestamp(),
  });

  const { logAuditEvent } = await import("@/lib/rbac");
  await logAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    branchId: targetBranchId,
    action: "ORDER_REASSIGNED_BRANCH",
    targetType: "order",
    targetId: orderId,
    metadata: {
      fromBranchId: oldBranchId,
      toBranchId: targetBranchId,
      reason: reason || "Manual Staff Reassignment",
    },
  });
}
