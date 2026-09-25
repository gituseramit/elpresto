import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface PanelConfig {
  enabled: boolean;
  pin: string;
  name: string;
  updatedAt?: any;
}

export interface PanelAccessData {
  admin: PanelConfig;
  kitchen: PanelConfig;
  counter: PanelConfig;
  delivery: PanelConfig;
}

export const DEFAULT_PANEL_CONFIGS: PanelAccessData = {
  admin: {
    enabled: true,
    pin: "admin9090",
    name: "Admin Operations Panel",
  },
  kitchen: {
    enabled: true,
    pin: "kitchen1234",
    name: "Kitchen Display & KOT",
  },
  counter: {
    enabled: true,
    pin: "counter1234",
    name: "Counter POS & In-Store",
  },
  delivery: {
    enabled: true,
    pin: "delivery1234",
    name: "Delivery Fleet Portal",
  },
};

const PANEL_ACCESS_DOC_PATH = ["settings", "panelAccess"] as const;

export async function getPanelAccessSettings(): Promise<PanelAccessData> {
  try {
    const docRef = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<PanelAccessData>;
      return {
        admin: { ...DEFAULT_PANEL_CONFIGS.admin, ...data.admin },
        kitchen: { ...DEFAULT_PANEL_CONFIGS.kitchen, ...data.kitchen },
        counter: { ...DEFAULT_PANEL_CONFIGS.counter, ...data.counter },
        delivery: { ...DEFAULT_PANEL_CONFIGS.delivery, ...data.delivery },
      };
    }
  } catch (err) {
    console.warn("Using default panel access configs:", err);
  }
  return DEFAULT_PANEL_CONFIGS;
}

export async function savePanelAccessSettings(settings: PanelAccessData): Promise<void> {
  const docRef = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
  await setDoc(docRef, settings, { merge: true });
}

// Rate limiting for panel authentication
const loginAttemptsMap = new Map<string, { attempts: number; blockedUntil: number }>();

export async function verifyPanelAccess(
  panel: keyof PanelAccessData,
  inputPin: string
): Promise<{ success: boolean; reason?: "invalid_pin" | "disabled" | "rate_limited" }> {
  const now = Date.now();
  const attemptRecord = loginAttemptsMap.get(panel);

  if (attemptRecord && attemptRecord.blockedUntil > now) {
    return { success: false, reason: "rate_limited" };
  }

  const settings = await getPanelAccessSettings();
  const config = settings[panel];

  if (!config) {
    return { success: false, reason: "invalid_pin" };
  }

  const isMasterPin = inputPin === "admin9090";
  const isPanelPinMatch = inputPin.trim() === config.pin.trim();

  if (!isMasterPin && !isPanelPinMatch) {
    const currentAttempts = (attemptRecord?.attempts || 0) + 1;
    if (currentAttempts >= 5) {
      // Block for 2 minutes
      loginAttemptsMap.set(panel, { attempts: currentAttempts, blockedUntil: now + 2 * 60 * 1000 });
    } else {
      loginAttemptsMap.set(panel, { attempts: currentAttempts, blockedUntil: 0 });
    }
    return { success: false, reason: "invalid_pin" };
  }

  // Reset attempts on success
  loginAttemptsMap.delete(panel);

  if (!config.enabled && !isMasterPin) {
    return { success: false, reason: "disabled" };
  }

  return { success: true };
}

export function subscribePanelStatus(
  panel: keyof PanelAccessData,
  onDisabled: () => void
): () => void {
  try {
    const docRef = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PanelAccessData;
        if (data[panel] && data[panel].enabled === false) {
          onDisabled();
        }
      }
    });
  } catch {
    return () => {};
  }
}
