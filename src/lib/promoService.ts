import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  increment,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PromoCode, PromoValidationResult } from "@/lib/types";

// In-memory rate limiting map for promo validation
const validationRateMap = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 10; // Max 10 promo checks per minute

export function checkValidationRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = validationRateMap.get(identifier);
  if (!record) {
    validationRateMap.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    validationRateMap.set(identifier, { count: 1, firstAttempt: now });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }
  record.count += 1;
  return true;
}

/**
 * Validate promo code against all business rules strictly
 */
export async function validatePromoCode(
  code: string,
  subtotal: number,
  userId?: string
): Promise<PromoValidationResult> {
  const cleanCode = (code || "").trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: "Please enter a valid promo code.", discountAmount: 0, finalTotal: subtotal };
  }

  // Rate limiting check
  const rateLimitKey = userId || "anonymous_client";
  if (!checkValidationRateLimit(rateLimitKey)) {
    return {
      valid: false,
      error: "Too many promo code attempts. Please wait a minute before trying again.",
      discountAmount: 0,
      finalTotal: subtotal,
    };
  }

  try {
    const q = query(collection(db, "promoCodes"), where("code", "==", cleanCode));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, error: `Promo code "${cleanCode}" is invalid.`, discountAmount: 0, finalTotal: subtotal };
    }

    const promoDoc = snap.docs[0];
    const promo = { id: promoDoc.id, ...promoDoc.data() } as PromoCode;

    // 1. Check active status
    if (!promo.active) {
      return { valid: false, error: `Promo code "${cleanCode}" is no longer active.`, discountAmount: 0, finalTotal: subtotal };
    }

    // 2. Check expiry date
    if (promo.expiryDate) {
      const expiry = new Date(promo.expiryDate).getTime();
      if (!isNaN(expiry) && Date.now() > expiry) {
        return { valid: false, error: `Promo code "${cleanCode}" has expired.`, discountAmount: 0, finalTotal: subtotal };
      }
    }

    // 3. Check min order value
    if (promo.minOrderValue && subtotal < promo.minOrderValue) {
      return {
        valid: false,
        error: `Minimum order amount of ₹${promo.minOrderValue} required for this promo code.`,
        discountAmount: 0,
        finalTotal: subtotal,
      };
    }

    // 4. Check total usage limit
    if (promo.usageLimitTotal && promo.usageCount >= promo.usageLimitTotal) {
      return {
        valid: false,
        error: `Promo code "${cleanCode}" has reached its maximum total usage limit.`,
        discountAmount: 0,
        finalTotal: subtotal,
      };
    }

    // 5. Check per-user usage limit if user is authenticated
    if (userId && promo.usageLimitPerUser) {
      const usageQ = query(
        collection(db, "promoUsage"),
        where("promoId", "==", promo.id),
        where("userId", "==", userId)
      );
      const usageSnap = await getDocs(usageQ);
      if (usageSnap.size >= promo.usageLimitPerUser) {
        return {
          valid: false,
          error: `You have already used promo code "${cleanCode}" the maximum allowed times (${promo.usageLimitPerUser}).`,
          discountAmount: 0,
          finalTotal: subtotal,
        };
      }
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === "percentage") {
      discount = (subtotal * promo.discountValue) / 100;
      if (promo.maxDiscountCap && promo.maxDiscountCap > 0) {
        discount = Math.min(discount, promo.maxDiscountCap);
      }
    } else {
      discount = promo.discountValue;
    }

    // Ensure discount does not exceed subtotal
    discount = Math.min(discount, subtotal);
    discount = Math.round(discount);

    return {
      valid: true,
      promo,
      discountAmount: discount,
      finalTotal: Math.max(0, subtotal - discount),
    };
  } catch (err: any) {
    console.error("Error validating promo code:", err);
    return { valid: false, error: "Failed to validate promo code. Please try again.", discountAmount: 0, finalTotal: subtotal };
  }
}

/**
 * Record promo usage when order is placed
 */
export async function recordPromoUsage(
  promo: PromoCode,
  orderNumber: string,
  userId?: string,
  discountApplied?: number
) {
  try {
    // 1. Increment usage count on promo code
    const promoRef = doc(db, "promoCodes", promo.id);
    await updateDoc(promoRef, {
      usageCount: increment(1),
      updatedAt: Timestamp.now(),
    });

    // 2. Add audit record to promoUsage collection
    await addDoc(collection(db, "promoUsage"), {
      promoId: promo.id,
      code: promo.code,
      orderNumber,
      userId: userId || "guest",
      discountApplied: discountApplied || 0,
      usedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error("Failed to record promo usage:", err);
  }
}
