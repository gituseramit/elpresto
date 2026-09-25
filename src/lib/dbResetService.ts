import {
  collection,
  getDocs,
  writeBatch,
  doc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ResetResult {
  success: boolean;
  message: string;
  backupData?: any;
  recordsDeleted?: {
    orders: number;
    promoUsage: number;
  };
}

const REQUIRED_CONFIRMATION_PHRASE = "CONFIRM-RESET-TRANSACTIONS-ZERO";

/**
 * Resets all transactional data to zero/empty:
 * - orders collection
 * - promoUsage collection
 * 
 * Safeguards:
 * 1. Requires exact confirmation phrase: "CONFIRM-RESET-TRANSACTIONS-ZERO"
 * 2. Takes a complete JSON snapshot/backup before wiping
 * 3. Does NOT touch product catalog (menuItems), categories, admin panelAccess, or settings
 * 4. Saves an audit record in "resetLogs" collection with timestamp and operator info
 */
export async function executeTransactionalReset(
  confirmationInput: string,
  operatorName: string
): Promise<ResetResult> {
  // Safeguard 1: Confirm typed phrase
  if (confirmationInput.trim() !== REQUIRED_CONFIRMATION_PHRASE) {
    return {
      success: false,
      message: `Invalid confirmation phrase. Please type "${REQUIRED_CONFIRMATION_PHRASE}" exactly.`,
    };
  }

  try {
    // 1. Fetch current transactional records for automatic backup
    const ordersSnap = await getDocs(collection(db, "orders"));
    const promoUsageSnap = await getDocs(collection(db, "promoUsage"));

    const backedUpOrders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const backedUpPromoUsage = promoUsageSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backupSnapshot = {
      timestamp: new Date().toISOString(),
      operator: operatorName || "admin",
      counts: {
        orders: backedUpOrders.length,
        promoUsage: backedUpPromoUsage.length,
      },
      orders: backedUpOrders,
      promoUsage: backedUpPromoUsage,
    };

    // 2. Save backup record in Firestore "backups" collection for recovery
    await addDoc(collection(db, "backups"), {
      type: "pre_reset_backup",
      createdAt: Timestamp.now(),
      operator: operatorName || "admin",
      summary: backupSnapshot.counts,
      dataJson: JSON.stringify(backupSnapshot),
    });

    // 3. Batch delete orders in chunks of 450 (Firestore limit is 500)
    const allOrderDocs = ordersSnap.docs;
    for (let i = 0; i < allOrderDocs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = allOrderDocs.slice(i, i + 450);
      chunk.forEach((docSnap) => batch.delete(doc(db, "orders", docSnap.id)));
      await batch.commit();
    }

    // 4. Batch delete promoUsage in chunks
    const allPromoDocs = promoUsageSnap.docs;
    for (let i = 0; i < allPromoDocs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = allPromoDocs.slice(i, i + 450);
      chunk.forEach((docSnap) => batch.delete(doc(db, "promoUsage", docSnap.id)));
      await batch.commit();
    }

    // 5. Reset promo codes usageCount back to 0
    const promoCodesSnap = await getDocs(collection(db, "promoCodes"));
    if (!promoCodesSnap.empty) {
      const promoBatch = writeBatch(db);
      promoCodesSnap.docs.forEach((d) => {
        promoBatch.update(doc(db, "promoCodes", d.id), {
          usageCount: 0,
          updatedAt: Timestamp.now(),
        });
      });
      await promoBatch.commit();
    }

    // 6. Audit logging
    await addDoc(collection(db, "resetLogs"), {
      action: "TRANSACTIONAL_DATA_RESET_TO_ZERO",
      operator: operatorName || "admin",
      timestamp: Timestamp.now(),
      ordersDeleted: backedUpOrders.length,
      promoUsageDeleted: backedUpPromoUsage.length,
      status: "SUCCESS",
    });

    return {
      success: true,
      message: `Database successfully reset to zero! Backed up and deleted ${backedUpOrders.length} orders and ${backedUpPromoUsage.length} promo records.`,
      backupData: backupSnapshot,
      recordsDeleted: {
        orders: backedUpOrders.length,
        promoUsage: backedUpPromoUsage.length,
      },
    };
  } catch (err: any) {
    console.error("Database reset error:", err);
    return {
      success: false,
      message: "Database reset failed: " + (err?.message || "Unknown error"),
    };
  }
}
