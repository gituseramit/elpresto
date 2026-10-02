import {
  collection,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MenuItem } from "@/store/useCartStore";

function normalizeMenuItem(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): MenuItem {
  const data = snapshot.data();
  const price = Number(data.price);

  return {
    ...data,
    // Firestore document IDs are the canonical IDs used by every portal.
    id: snapshot.id,
    name: String(data.name || "Unnamed item"),
    description: String(data.description || ""),
    price: Number.isFinite(price) ? price : 0,
    category: String(data.category || "Specials & Combos"),
    imageUrl: String(data.imageUrl || ""),
    available: data.available !== false,
    isVeg: data.isVeg === true,
  } as MenuItem;
}

export function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const orderA = Number(a.order);
    const orderB = Number(b.order);
    const normalizedA = Number.isFinite(orderA) ? orderA : Number.MAX_SAFE_INTEGER;
    const normalizedB = Number.isFinite(orderB) ? orderB : Number.MAX_SAFE_INTEGER;
    return normalizedA - normalizedB || a.name.localeCompare(b.name);
  });
}

export function subscribeMenuCatalog(
  onItems: (items: MenuItem[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, "menuItems"),
    (snapshot) => onItems(sortMenuItems(snapshot.docs.map(normalizeMenuItem))),
    onError,
  );
}
