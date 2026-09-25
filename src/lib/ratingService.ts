import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

export interface ProductRating {
  id?: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  orderId: string;
  orderNumber?: string;
  rating: number; // 1 to 5
  review?: string;
  createdAt: any;
}

export interface ProductRatingSummary {
  productId: string;
  averageRating: number;
  totalRatings: number;
  ratingDistribution?: Record<number, number>;
}

let ratingCache: Record<string, ProductRatingSummary> = {};

export async function submitProductRating(ratingData: {
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  orderId: string;
  orderNumber?: string;
  rating: number;
  review?: string;
}): Promise<void> {
  const ratingDoc = {
    ...ratingData,
    rating: Math.max(1, Math.min(5, Math.round(ratingData.rating))),
    createdAt: Timestamp.now(),
  };

  await addDoc(collection(db, "ratings"), ratingDoc);

  const q = query(
    collection(db, "ratings"),
    where("productId", "==", ratingData.productId)
  );
  const snap = await getDocs(q);

  let sum = 0;
  const count = snap.size;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  snap.forEach((d) => {
    const data = d.data();
    const r = Math.round(Number(data.rating) || 5);
    sum += r;
    dist[r] = (dist[r] || 0) + 1;
  });

  const avg = count > 0 ? Number((sum / count).toFixed(1)) : 5.0;

  const summaryDoc: ProductRatingSummary = {
    productId: ratingData.productId,
    averageRating: avg,
    totalRatings: count,
    ratingDistribution: dist,
  };

  await setDoc(doc(db, "productRatings", ratingData.productId), summaryDoc, {
    merge: true,
  });

  ratingCache[ratingData.productId] = summaryDoc;
}

export function subscribeAllProductRatings(
  onUpdate: (summaries: Record<string, ProductRatingSummary>) => void
): () => void {
  try {
    const q = collection(db, "productRatings");
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, ProductRatingSummary> = {};
        snap.forEach((d) => {
          map[d.id] = d.data() as ProductRatingSummary;
        });
        ratingCache = map;
        onUpdate(map);
      },
      (err) => {
        console.warn("Product ratings subscription fallback:", err);
      }
    );
  } catch {
    return () => {};
  }
}

export async function hasUserRatedItem(
  userId: string,
  orderId: string,
  productId: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, "ratings"),
      where("userId", "==", userId),
      where("orderId", "==", orderId),
      where("productId", "==", productId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}
