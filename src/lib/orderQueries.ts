import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

/**
 * Parses any order's createdAt value safely into a JavaScript Date.
 * Handles Firestore Timestamps, ISO strings, number epochs, and legacy objects.
 */
export function parseOrderDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Returns date string in YYYY-MM-DD format for Asia/Kolkata (IST).
 */
export function getISTDateString(dateOrOffset: Date | number | string = 0): string {
  let target = new Date();
  if (typeof dateOrOffset === "number") {
    target.setDate(target.getDate() + dateOrOffset);
  } else if (typeof dateOrOffset === "string") {
    if (dateOrOffset.includes("-") && dateOrOffset.length === 10) {
      return dateOrOffset;
    }
    target = new Date(dateOrOffset);
  } else if (dateOrOffset instanceof Date) {
    target = dateOrOffset;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(target);
}

/**
 * Returns exact startOfDay and endOfDay in Asia/Kolkata (IST) for a given date.
 */
export function getISTDayBounds(dateOrOffset: Date | number | string = 0) {
  const dateStr = getISTDateString(dateOrOffset);
  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+05:30`);

  const todayStr = getISTDateString(0);
  const isToday = dateStr === todayStr;

  return { dateStr, startOfDay, endOfDay, isToday };
}

/**
 * Formats a YYYY-MM-DD date into human-readable label:
 * e.g., "Today (Wed, 23 Sep 2026)", "Yesterday (Tue, 22 Sep 2026)", or "Mon, 21 Sep 2026".
 */
export function formatISTDisplayDate(dateStr: string): string {
  const todayStr = getISTDateString(0);
  const yesterdayStr = getISTDateString(-1);

  const [y, m, d] = dateStr.split("-").map(Number);
  const dObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const formattedDate = dObj.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (dateStr === todayStr) {
    return `Today (${formattedDate})`;
  }
  if (dateStr === yesterdayStr) {
    return `Yesterday (${formattedDate})`;
  }
  return formattedDate;
}

/**
 * Real-time subscription to orders for a given date (Asia/Kolkata IST) and optional branch scope.
 * 
 * STRICT PER-BRANCH ISOLATION:
 * When branchId is provided (and not "ALL"), orders are scoped at the Firestore query level.
 * Handles both Timestamp and ISO string createdAt representations.
 * Includes indexed query fallback if a composite index (branchId + createdAt) is pending in Firestore.
 */
export function subscribeDayOrders(
  dateStr: string,
  onUpdate: (orders: any[]) => void,
  onError?: (err: any) => void,
  branchId?: string
): () => void {
  const { startOfDay, endOfDay } = getISTDayBounds(dateStr);
  const isBranchScoped = Boolean(branchId && branchId !== "ALL");

  // Primary composite queries
  const qTimestamp = isBranchScoped
    ? query(
        collection(db, "orders"),
        where("branchId", "==", branchId),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      )
    : query(
        collection(db, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      );

  const qString = isBranchScoped
    ? query(
        collection(db, "orders"),
        where("branchId", "==", branchId),
        where("createdAt", ">=", startOfDay.toISOString()),
        where("createdAt", "<=", endOfDay.toISOString())
      )
    : query(
        collection(db, "orders"),
        where("createdAt", ">=", startOfDay.toISOString()),
        where("createdAt", "<=", endOfDay.toISOString())
      );

  const mapT = new Map<string, any>();
  const mapS = new Map<string, any>();
  const mapFallback = new Map<string, any>();
  let fallbackActive = false;
  let unsubFallback: (() => void) | null = null;

  const emit = () => {
    let list: any[];
    if (fallbackActive) {
      list = Array.from(mapFallback.values());
    } else {
      const combined = new Map<string, any>([...mapT, ...mapS]);
      list = Array.from(combined.values());
    }

    // Secondary safety verification filter
    if (isBranchScoped) {
      list = list.filter((o) => {
        const orderBranch = o.branchId || "branch-main";
        return orderBranch === branchId;
      });
    }

    // Sort newest orders first within the day
    list.sort((a, b) => {
      const timeA = parseOrderDate(a.createdAt).getTime();
      const timeB = parseOrderDate(b.createdAt).getTime();
      return timeB - timeA;
    });

    onUpdate(list);
  };

  // Graceful fallback listener using single-field index if composite index is missing in Firestore
  const activateFallback = () => {
    if (fallbackActive) return;
    fallbackActive = true;
    console.warn(`[orderQueries] Activating single-field indexed fallback query for branch: ${branchId}`);
    try {
      const qBranchOnly = isBranchScoped
        ? query(collection(db, "orders"), where("branchId", "==", branchId))
        : collection(db, "orders");

      unsubFallback = onSnapshot(
        qBranchOnly,
        (snap) => {
          mapFallback.clear();
          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            const orderDate = parseOrderDate(data.createdAt);
            if (orderDate >= startOfDay && orderDate <= endOfDay) {
              mapFallback.set(d.id, data);
            }
          });
          emit();
        },
        (fbErr) => {
          console.error("Fallback query error:", fbErr);
          if (onError) onError(fbErr);
        }
      );
    } catch (fbInitErr) {
      console.error("Could not initialize fallback query:", fbInitErr);
    }
  };

  const unsubT = onSnapshot(
    qTimestamp,
    (snap) => {
      mapT.clear();
      snap.docs.forEach((d) => mapT.set(d.id, { id: d.id, ...d.data() }));
      emit();
    },
    (err) => {
      console.warn("subscribeDayOrders Timestamp error (activating branch-scoped fallback):", err);
      activateFallback();
      if (onError) onError(err);
    }
  );

  const unsubS = onSnapshot(
    qString,
    (snap) => {
      mapS.clear();
      snap.docs.forEach((d) => mapS.set(d.id, { id: d.id, ...d.data() }));
      emit();
    },
    (err) => {
      console.warn("subscribeDayOrders String error (activating branch-scoped fallback):", err);
      activateFallback();
      if (onError) onError(err);
    }
  );

  return () => {
    unsubT();
    unsubS();
    if (unsubFallback) unsubFallback();
  };
}
