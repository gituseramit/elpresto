// Role-Based Access Control (RBAC), Permission Matrix & Audit Logging
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { UserRole, Permission, StaffProfile, AuditLog } from "@/lib/types";

// Default permission mapping per role
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  DEVELOPER: [
    "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.assign", "orders.deliver",
    "menu.view", "menu.create", "menu.edit", "menu.delete",
    "kitchen.view", "kitchen.manage",
    "counter.view", "counter.manage",
    "delivery.view", "delivery.assign", "delivery.track",
    "users.view", "users.manage",
    "branches.view", "branches.manage",
    "promos.manage",
    "payments.view", "payments.manage",
    "reports.view", "attendance.view", "attendance.mark",
    "system.manage",
  ],
  SUPER_ADMIN: [
    "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.assign", "orders.deliver",
    "menu.view", "menu.create", "menu.edit", "menu.delete",
    "kitchen.view", "kitchen.manage",
    "counter.view", "counter.manage",
    "delivery.view", "delivery.assign", "delivery.track",
    "users.view", "users.manage",
    "branches.view", "branches.manage",
    "promos.manage",
    "payments.view", "payments.manage",
    "reports.view", "attendance.view", "attendance.mark",
  ],
  ADMIN: [
    "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.assign",
    "menu.view", "menu.create", "menu.edit", "menu.delete",
    "kitchen.view", "kitchen.manage",
    "counter.view", "counter.manage",
    "delivery.view", "delivery.assign", "delivery.track",
    "users.view",
    "branches.view",
    "promos.manage",
    "payments.view",
    "reports.view", "attendance.view", "attendance.mark",
  ],
  BRANCH_MANAGER: [
    "orders.view", "orders.create", "orders.edit", "orders.cancel", "orders.assign",
    "menu.view",
    "kitchen.view", "kitchen.manage",
    "counter.view", "counter.manage",
    "delivery.view", "delivery.assign", "delivery.track",
    "branches.view",
    "reports.view", "attendance.view", "attendance.mark",
  ],
  KITCHEN_MANAGER: [
    "orders.view", "orders.edit",
    "kitchen.view", "kitchen.manage",
    "menu.view", "attendance.mark",
  ],
  KITCHEN_STAFF: [
    "orders.view", "orders.edit",
    "kitchen.view", "attendance.mark",
  ],
  COUNTER_MANAGER: [
    "orders.view", "orders.create", "orders.edit",
    "counter.view", "counter.manage",
    "menu.view", "attendance.mark",
  ],
  COUNTER_STAFF: [
    "orders.view", "orders.create",
    "counter.view", "attendance.mark",
  ],
  DELIVERY_MANAGER: [
    "orders.view", "orders.assign",
    "delivery.view", "delivery.assign", "delivery.track", "attendance.mark",
  ],
  DELIVERY_PARTNER: [
    "orders.view", "orders.deliver",
    "delivery.track", "attendance.mark",
  ],
  CUSTOMER: [
    "orders.create", "orders.view",
    "menu.view",
  ],
};

/**
 * Checks if a staff profile possesses a required permission,
 * taking into account custom overrides and branch isolation.
 */
export function hasPermission(
  profile: StaffProfile | null | undefined,
  permission: Permission,
  targetBranchId?: string
): boolean {
  if (!profile || !profile.active) return false;

  // DEVELOPER & SUPER_ADMIN bypass all checks globally
  if (profile.role === "DEVELOPER" || profile.role === "SUPER_ADMIN") {
    return true;
  }

  // Branch isolation enforcement
  if (targetBranchId && profile.branchId !== "ALL" && profile.branchId !== targetBranchId) {
    return false;
  }

  // Check custom individual permission overrides first
  if (profile.customPermissions && profile.customPermissions.includes(permission)) {
    return true;
  }

  // Check standard role permissions
  const rolePerms = ROLE_DEFAULT_PERMISSIONS[profile.role] || [];
  return rolePerms.includes(permission);
}

/**
 * Audit Logger: Persists security, configuration, and operational actions to Firestore
 */
export async function logAuditEvent(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  branchId?: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const cleanMetadata = { ...params.metadata };
    // Security guarantee: Strip any potential password or secret keys
    delete cleanMetadata.password;
    delete cleanMetadata.pin;
    delete cleanMetadata.secret;
    delete cleanMetadata.key_secret;

    await addDoc(collection(db, "auditLogs"), {
      actorId: params.actorId || "anonymous",
      actorName: params.actorName || "System Actor",
      actorRole: params.actorRole || "SYSTEM",
      branchId: params.branchId || null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId || null,
      metadata: cleanMetadata,
      timestamp: serverTimestamp(),
      createdAtISO: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err);
  }
}

/**
 * Developer Delegation Engine:
 * Allows authorized developer accounts to inspect and manage a branch
 * acting as an Admin, Kitchen Manager, Counter Manager, or Delivery Manager.
 */
export interface DelegationSession {
  active: boolean;
  delegatedRole: UserRole;
  targetBranchId: string;
  targetBranchName: string;
  developerUid: string;
  developerEmail: string;
  startedAt: string;
}

const DELEGATION_STORAGE_KEY = "elpresto_dev_delegation_v1";

export function getActiveDelegationSession(): DelegationSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DELEGATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function startDelegationSession(session: Omit<DelegationSession, "active" | "startedAt">): Promise<void> {
  if (typeof window === "undefined") return;
  const fullSession: DelegationSession = {
    ...session,
    active: true,
    startedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(DELEGATION_STORAGE_KEY, JSON.stringify(fullSession));

  await logAuditEvent({
    actorId: session.developerUid,
    actorName: session.developerEmail,
    actorRole: "DEVELOPER",
    branchId: session.targetBranchId,
    action: "DELEGATED_ACCESS_START",
    targetType: "branch",
    targetId: session.targetBranchId,
    metadata: {
      delegatedRole: session.delegatedRole,
      targetBranchName: session.targetBranchName,
    },
  });
}

export async function stopDelegationSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = getActiveDelegationSession();
  if (existing) {
    await logAuditEvent({
      actorId: existing.developerUid,
      actorName: existing.developerEmail,
      actorRole: "DEVELOPER",
      branchId: existing.targetBranchId,
      action: "DELEGATED_ACCESS_END",
      targetType: "branch",
      targetId: existing.targetBranchId,
      metadata: {
        delegatedRole: existing.delegatedRole,
      },
    });
  }
  sessionStorage.removeItem(DELEGATION_STORAGE_KEY);
}
