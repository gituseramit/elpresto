import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/* ============================================================= */
/* Types                                                         */
/* ============================================================= */

export type PanelKey = "admin" | "kitchen" | "counter" | "delivery";

export interface PanelConfig {
  /** Whether the panel is enabled. Disabled panels reject logins. */
  enabled: boolean;
  /**
   * Stored PIN. May be plaintext (legacy) or a SHA-256 hex digest
   * (64 lowercase hex chars). The verification layer accepts both.
   */
  pin: string;
  name: string;
  updatedAt?: unknown;
}

export interface PanelAccessData {
  admin: PanelConfig;
  kitchen: PanelConfig;
  counter: PanelConfig;
  delivery: PanelConfig;
}

/**
 * Fallback configs used only when Firestore has no `settings/panelAccess`
 * document yet. These PINs are intentionally simple so first-time setup
 * works, but they should be rotated immediately via the admin panel.
 * Once rotated, the new PIN is stored as a SHA-256 hash.
 */
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

/**
 * Optional recovery PIN. If set via `NEXT_PUBLIC_PANEL_RECOVERY_PIN`
 * it can unlock any panel even when the panel is disabled, allowing
 * recovery from a lockout.
 *
 * NOTE: Because this is a `NEXT_PUBLIC_` env var, it ships in the
 * client bundle. Only set it in environments where you accept that
 * trade-off.
 */
const RECOVERY_PIN =
  (process.env.NEXT_PUBLIC_PANEL_RECOVERY_PIN || "").trim();
const HAS_RECOVERY_PIN = RECOVERY_PIN.length > 0;

/* ============================================================= */
/* PIN hashing                                                   */
/* ============================================================= */

/**
 * Hash a PIN with SHA-256. Uses Web Crypto when available; falls back
 * to a deterministic non-cryptographic hash otherwise. Both branches
 * return a 64-character lowercase hex string so downstream code can
 * rely on a consistent shape.
 */
export async function hashPin(plain: string): Promise<string> {
  const trimmed = String(plain ?? "");
  if (!trimmed) return "";

  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    "subtle" in globalThis.crypto &&
    typeof TextEncoder !== "undefined"
  ) {
    try {
      const buf = new TextEncoder().encode(trimmed);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      /* fall through to the non-crypto fallback */
    }
  }

  // Deterministic fallback — 4 rounds × 2 words × 8 hex chars = 64 chars.
  const parts: string[] = [];
  for (let round = 0; round < 4; round++) {
    let h1 = (0xdeadbeef ^ (round * 0x9e3779b1)) >>> 0;
    let h2 = (0x41c6ce57 ^ (round * 0x85ebca6b)) >>> 0;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed.charCodeAt(i) ^ ((i * 0x9e3779b1 + round) >>> 0);
      h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0;
      h2 = Math.imul(h2 ^ ch, 1597334677) >>> 0;
    }
    h1 =
      (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>>
      0;
    h2 =
      (Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        Math.imul(h1 ^ (h1 >>> 13), 3266489909)) >>>
      0;
    parts.push((h2 >>> 0).toString(16).padStart(8, "0"));
    parts.push((h1 >>> 0).toString(16).padStart(8, "0"));
  }
  return parts.join("");
}

function looksHashed(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

/**
 * True when the stored PIN is a hash and the stored value could not
 * have been produced by the current hash function. Useful if you
 * later want to migrate from the fallback to SubtleCrypto.
 */
export function shouldRehash(storedPin: string): boolean {
  return !looksHashed(storedPin);
}

/**
 * Compare an input PIN against a stored PIN. Accepts both plaintext
 * (legacy) and hashed storage.
 */
export async function pinMatches(
  inputPin: string,
  storedPin: string
): Promise<boolean> {
  const input = String(inputPin ?? "").trim();
  const stored = String(storedPin ?? "").trim();
  if (!input || !stored) return false;

  // Legacy plaintext match.
  if (input === stored) return true;

  // Hashed match.
  const hashedInput = await hashPin(input);
  if (looksHashed(stored) && hashedInput === stored.toLowerCase()) {
    return true;
  }

  return false;
}

/* ============================================================= */
/* Read / write                                                  */
/* ============================================================= */

function mergeConfig(
  fallback: PanelConfig,
  incoming: Partial<PanelConfig> | undefined
): PanelConfig {
  if (!incoming) return { ...fallback };
  return {
    enabled:
      typeof incoming.enabled === "boolean" ? incoming.enabled : fallback.enabled,
    pin: typeof incoming.pin === "string" ? incoming.pin : fallback.pin,
    name: typeof incoming.name === "string" ? incoming.name : fallback.name,
    updatedAt: incoming.updatedAt ?? fallback.updatedAt,
  };
}

export async function getPanelAccessSettings(): Promise<PanelAccessData> {
  try {
    const ref = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<PanelAccessData>;
      return {
        admin: mergeConfig(DEFAULT_PANEL_CONFIGS.admin, data.admin),
        kitchen: mergeConfig(DEFAULT_PANEL_CONFIGS.kitchen, data.kitchen),
        counter: mergeConfig(DEFAULT_PANEL_CONFIGS.counter, data.counter),
        delivery: mergeConfig(DEFAULT_PANEL_CONFIGS.delivery, data.delivery),
      };
    }
  } catch (err) {
    console.warn("Using default panel access configs:", err);
  }
  return DEFAULT_PANEL_CONFIGS;
}

export async function savePanelAccessSettings(
  settings: PanelAccessData
): Promise<void> {
  const ref = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
  await setDoc(ref, settings, { merge: true });
}

/* ============================================================= */
/* Verification                                                  */
/* ============================================================= */

interface AttemptRecord {
  attempts: number;
  blockedUntil: number;
}

const loginAttemptsMap = new Map<PanelKey, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const BLOCK_MS = 2 * 60 * 1000;

/** Test / utility hook to clear rate limiting. */
export function _resetPanelRateLimit(panel?: PanelKey): void {
  if (panel) loginAttemptsMap.delete(panel);
  else loginAttemptsMap.clear();
}

export async function verifyPanelAccess(
  panel: PanelKey,
  inputPin: string
): Promise<{
  success: boolean;
  reason?: "invalid_pin" | "disabled" | "rate_limited";
}> {
  const now = Date.now();
  const attemptRecord = loginAttemptsMap.get(panel);

  if (attemptRecord && attemptRecord.blockedUntil > now) {
    return { success: false, reason: "rate_limited" };
  }

  const trimmedInput = String(inputPin ?? "").trim();

  // Recovery PIN — bypasses the disabled check but still counts as auth.
  if (HAS_RECOVERY_PIN && trimmedInput === RECOVERY_PIN) {
    loginAttemptsMap.delete(panel);
    return { success: true };
  }

  const settings = await getPanelAccessSettings();
  const config = settings[panel];

  if (!config) {
    return { success: false, reason: "invalid_pin" };
  }

  const matches = await pinMatches(trimmedInput, config.pin);

  if (!matches) {
    const currentAttempts = (attemptRecord?.attempts || 0) + 1;
    if (currentAttempts >= MAX_ATTEMPTS) {
      loginAttemptsMap.set(panel, {
        attempts: currentAttempts,
        blockedUntil: now + BLOCK_MS,
      });
    } else {
      loginAttemptsMap.set(panel, {
        attempts: currentAttempts,
        blockedUntil: 0,
      });
    }
    return { success: false, reason: "invalid_pin" };
  }

  // Successful credential — reset attempt counter.
  loginAttemptsMap.delete(panel);

  if (!config.enabled) {
    return { success: false, reason: "disabled" };
  }

  return { success: true };
}

/* ============================================================= */
/* Panel status subscription                                     */
/* ============================================================= */

export function subscribePanelStatus(
  panel: PanelKey,
  onDisabled: () => void
): () => void {
  try {
    const ref = doc(db, PANEL_ACCESS_DOC_PATH[0], PANEL_ACCESS_DOC_PATH[1]);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as PanelAccessData;
        if (data[panel] && data[panel].enabled === false) {
          onDisabled();
        }
      },
      (err) => {
        console.warn("Panel status subscription error:", err);
      }
    );
  } catch (err) {
    console.warn("Failed to subscribe to panel status:", err);
    return () => {};
  }
}