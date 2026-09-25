// Categories & Subcategories Helper for El Presto Platform

import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { Category, Subcategory } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat_food",
    name: "Food",
    order: 1,
    enabled: true,
    subcategories: [
      { id: "sub_healthy_mania", name: "Healthy Mania", order: 1, enabled: true },
      { id: "sub_double_healthy_mania", name: "Double Healthy Mania", order: 2, enabled: true },
      { id: "sub_indian_tadka", name: "Indian Tadka Pizza", order: 3, enabled: true },
      { id: "sub_large_pizzas", name: "Large Pizzas", order: 4, enabled: true },
      { id: "sub_burgers", name: "Burgers", order: 5, enabled: true },
      { id: "sub_subs", name: "Subs", order: 6, enabled: true },
      { id: "sub_fries", name: "Fries", order: 7, enabled: true },
      { id: "sub_bowls", name: "Bowls", order: 8, enabled: true },
      { id: "sub_sides", name: "Sides", order: 9, enabled: true },
      { id: "sub_pizza", name: "Pizza", order: 10, enabled: true },
      { id: "sub_pasta", name: "Pasta", order: 11, enabled: true },
    ],
  },
  {
    id: "cat_beverages",
    name: "Beverages",
    order: 2,
    enabled: true,
    subcategories: [
      { id: "sub_cold_coffee", name: "Desi Cold Coffee", order: 1, enabled: true },
      { id: "sub_cold_drinks", name: "Cold Drinks", order: 2, enabled: true },
      { id: "sub_shakes", name: "Shakes", order: 3, enabled: true },
      { id: "sub_coffee", name: "Coffee & Tea", order: 4, enabled: true },
    ],
  },
  {
    id: "cat_desserts",
    name: "Desserts",
    order: 3,
    enabled: true,
    subcategories: [
      { id: "sub_choco_lava", name: "Choco Lava & Brownies", order: 1, enabled: true },
      { id: "sub_icecream", name: "Ice Creams", order: 2, enabled: true },
      { id: "sub_cakes", name: "Cakes & Pastries", order: 3, enabled: true },
    ],
  },
  {
    id: "cat_toppings",
    name: "Extra Toppings",
    order: 4,
    enabled: true,
    subcategories: [
      { id: "sub_veggie_toppings", name: "Veggie Toppings", order: 1, enabled: true },
      { id: "sub_cheese_toppings", name: "Cheese & Premium Toppings", order: 2, enabled: true },
    ],
  },
];

/**
 * Initializes default category & subcategory records if collection is empty
 */
export async function initializeCategoriesIfEmpty(): Promise<Category[]> {
  try {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Category[];
    }

    // Seed defaults
    for (const cat of DEFAULT_CATEGORIES) {
      await setDoc(doc(db, "categories", cat.id), cat);
    }
    return DEFAULT_CATEGORIES;
  } catch (error) {
    console.warn("Categories initialization fallback:", error);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Resolves an item's Category and Subcategory with intelligent backward compatibility.
 * Supports legacy single-category strings (e.g. category: "Healthy Mania") as well as
 * two-tier hierarchical categories (category: "Food", subcategory: "Healthy Mania").
 */
export function resolveItemCategoryHierarchy(
  item: any,
  categories: Category[] = DEFAULT_CATEGORIES
): {
  parentCategory: string;
  subcategory: string;
  categoryId?: string;
  subcategoryId?: string;
} {
  const catList = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const rawCat = (item.category || "").trim();
  const rawSub = (item.subcategory || "").trim();

  // 1. If parent category exists in list
  const parentMatch = catList.find(
    (c) => c.name.toLowerCase() === rawCat.toLowerCase() || c.id === item.categoryId
  );

  if (parentMatch) {
    const subMatch = parentMatch.subcategories?.find(
      (s) =>
        s.name.toLowerCase() === rawSub.toLowerCase() ||
        s.id === item.subcategoryId ||
        s.name.toLowerCase() === rawCat.toLowerCase()
    );

    return {
      parentCategory: parentMatch.name,
      subcategory: subMatch ? subMatch.name : (rawSub || parentMatch.subcategories?.[0]?.name || "General"),
      categoryId: parentMatch.id,
      subcategoryId: subMatch?.id,
    };
  }

  // 2. Check if rawCat actually matches a known subcategory (e.g. "Healthy Mania", "Subs", "Burgers")
  for (const cat of catList) {
    const foundSub = cat.subcategories?.find(
      (s) => s.name.toLowerCase() === rawCat.toLowerCase() || s.name.toLowerCase() === rawSub.toLowerCase()
    );
    if (foundSub) {
      return {
        parentCategory: cat.name,
        subcategory: foundSub.name,
        categoryId: cat.id,
        subcategoryId: foundSub.id,
      };
    }
  }

  // 3. Fallback for custom or unmapped categories
  return {
    parentCategory: rawCat || "Food",
    subcategory: rawSub || rawCat || "General",
    categoryId: undefined,
    subcategoryId: undefined,
  };
}
