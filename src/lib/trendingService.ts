import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface TrendingSettings {
  enabled: boolean;
  mode: "auto" | "manual";
  maxItems: number;
  manualItemIds: string[];
  updatedAt?: any;
}

export const DEFAULT_TRENDING_SETTINGS: TrendingSettings = {
  enabled: true,
  mode: "auto",
  maxItems: 6,
  manualItemIds: ["hm1", "itp1", "itp6", "bg4", "bv1", "sd2"],
};

export async function getTrendingSettings(): Promise<TrendingSettings> {
  try {
    const snap = await getDoc(doc(db, "settings", "trending"));
    if (snap.exists()) {
      return { ...DEFAULT_TRENDING_SETTINGS, ...(snap.data() as Partial<TrendingSettings>) };
    }
  } catch (err) {
    console.warn("Using default trending settings:", err);
  }
  return DEFAULT_TRENDING_SETTINGS;
}

export async function saveTrendingSettings(settings: TrendingSettings): Promise<void> {
  await setDoc(doc(db, "settings", "trending"), settings, { merge: true });
}

export function subscribeTrendingSettings(
  onUpdate: (settings: TrendingSettings) => void
): () => void {
  try {
    return onSnapshot(doc(db, "settings", "trending"), (snap) => {
      if (snap.exists()) {
        onUpdate({ ...DEFAULT_TRENDING_SETTINGS, ...(snap.data() as Partial<TrendingSettings>) });
      } else {
        onUpdate(DEFAULT_TRENDING_SETTINGS);
      }
    });
  } catch {
    onUpdate(DEFAULT_TRENDING_SETTINGS);
    return () => {};
  }
}
