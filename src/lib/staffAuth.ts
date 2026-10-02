// Client-side Staff Authentication Utilities
// Handles session storage, JWT management, and API calls for staff panel login.

export interface StaffSession {
  staffId: string;
  name: string;
  role: string;
  branchId: string;
  token: string;
  expiresAt: string; // ISO string
  panel: string;
  mustChangePassword?: boolean;
}

// Panel name → allowed roles
export const PANEL_ROLE_MAP: Record<string, string[]> = {
  admin: ["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
  kitchen: ["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "KITCHEN_MANAGER", "KITCHEN_STAFF"],
  counter: ["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "COUNTER_MANAGER", "COUNTER_STAFF"],
  delivery: ["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "DELIVERY_MANAGER", "DELIVERY_PARTNER"],
  attendance: ["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "KITCHEN_MANAGER", "KITCHEN_STAFF", "COUNTER_MANAGER", "COUNTER_STAFF", "DELIVERY_MANAGER", "DELIVERY_PARTNER"],
  developer: ["DEVELOPER", "SUPER_ADMIN"],
};

// Session storage keys per panel (v2 keys — old PIN keys are left to expire naturally)
const SESSION_KEYS: Record<string, string> = {
  admin: "elpestro_admin_auth_v2",
  kitchen: "elpestro_kitchen_auth_v2",
  counter: "elpestro_counter_auth_v2",
  delivery: "elpestro_delivery_auth_v2",
  attendance: "elpestro_attendance_auth_v1",
  developer: "elpestro_developer_auth_v2",
};

// Rate limit tracking (in-memory per tab, prevents spam before server locks)
const loginAttemptMap = new Map<string, { count: number; blockedUntil: number }>();

export function getStaffSession(panel: string): StaffSession | null {
  if (typeof window === "undefined") return null;
  try {
    const key = SESSION_KEYS[panel];
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const session = JSON.parse(raw) as StaffSession;
    // Check expiry
    if (new Date(session.expiresAt) <= new Date()) {
      sessionStorage.removeItem(key);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setStaffSession(panel: string, session: StaffSession): void {
  if (typeof window === "undefined") return;
  const key = SESSION_KEYS[panel];
  if (!key) return;
  sessionStorage.setItem(key, JSON.stringify(session));
}

export function clearStaffSession(panel: string): void {
  if (typeof window === "undefined") return;
  const key = SESSION_KEYS[panel];
  if (key) sessionStorage.removeItem(key);
}

export function isSessionValid(session: StaffSession | null): boolean {
  if (!session) return false;
  return new Date(session.expiresAt) > new Date();
}

export interface LoginResult {
  success: boolean;
  session?: StaffSession;
  reason?: string;
  minutesLeft?: number;
}

export async function verifyStaffLogin(
  staffId: string,
  password: string,
  panel: string
): Promise<LoginResult> {
  // Client-side pre-check rate limit
  const key = `${panel}:${staffId.toLowerCase()}`;
  const record = loginAttemptMap.get(key);
  if (record && record.blockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((record.blockedUntil - Date.now()) / 60000);
    return { success: false, reason: "rate_limited", minutesLeft };
  }

  try {
    const res = await fetch("/api/staff-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: staffId.trim(), password, panel }),
    });

    const data = await res.json();

    if (data.success) {
      // Reset client-side rate limit on success
      loginAttemptMap.delete(key);

      const session: StaffSession = {
        staffId: data.profile.staffId,
        name: data.profile.name,
        role: data.profile.role,
        branchId: data.profile.branchId,
        token: data.token,
        expiresAt: data.expiresAt,
        panel,
        mustChangePassword: data.mustChangePassword || false,
      };

      setStaffSession(panel, session);
      return { success: true, session };
    }

    // Track failed attempts client-side
    if (data.reason === "invalid_credentials") {
      const current = loginAttemptMap.get(key);
      const newCount = (current?.count || 0) + 1;
      if (newCount >= 5) {
        loginAttemptMap.set(key, { count: newCount, blockedUntil: Date.now() + 2 * 60 * 1000 });
      } else {
        loginAttemptMap.set(key, { count: newCount, blockedUntil: 0 });
      }
    }

    return {
      success: false,
      reason: data.reason,
      minutesLeft: data.minutesLeft,
    };
  } catch (err) {
    console.error("Staff login error:", err);
    return { success: false, reason: "network_error" };
  }
}

export async function verifySessionToken(token: string): Promise<{
  valid: boolean;
  profile?: any;
}> {
  try {
    const res = await fetch("/api/staff-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return await res.json();
  } catch {
    return { valid: false };
  }
}

export async function changePassword(
  token: string,
  staffId: string,
  currentPassword: string | undefined,
  newPassword: string
): Promise<{ success: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/staff-setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, staffId, currentPassword, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, reason: "network_error" };
  }
}

export async function adminResetPassword(
  adminToken: string,
  targetStaffId: string,
  newPassword: string
): Promise<{ success: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/staff-setup-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken, targetStaffId, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, reason: "network_error" };
  }
}

export function getFriendlyError(reason: string, minutesLeft?: number): string {
  switch (reason) {
    case "invalid_credentials":
      return "Invalid staff ID or password. Please try again.";
    case "account_inactive":
      return "Your account has been deactivated. Contact your administrator.";
    case "rate_limited":
      return `Too many failed attempts. Try again in ${minutesLeft ?? "a few"} minute${(minutesLeft ?? 2) !== 1 ? "s" : ""}.`;
    case "panel_access_denied":
      return "Your account does not have access to this panel.";
    case "no_password_set":
      return "No password configured for this account. Contact your administrator.";
    case "network_error":
      return "Connection error. Please check your network and try again.";
    case "server_error":
      return "Server error. Please try again in a moment.";
    default:
      return "Login failed. Please try again or contact your administrator.";
  }
}
