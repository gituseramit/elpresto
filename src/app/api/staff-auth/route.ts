import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { logAuditEvent } from "@/lib/rbac";

const PANEL_ROLE_ACCESS: Record<string, string[]> = {
  DEVELOPER: ["admin", "kitchen", "counter", "delivery", "developer", "attendance"],
  SUPER_ADMIN: ["admin", "kitchen", "counter", "delivery", "developer", "attendance"],
  ADMIN: ["admin", "kitchen", "counter", "delivery", "attendance"],
  BRANCH_MANAGER: ["admin", "kitchen", "counter", "delivery", "attendance"],
  KITCHEN_MANAGER: ["kitchen", "attendance"],
  KITCHEN_STAFF: ["kitchen", "attendance"],
  COUNTER_MANAGER: ["counter", "attendance"],
  COUNTER_STAFF: ["counter", "attendance"],
  DELIVERY_MANAGER: ["delivery", "attendance"],
  DELIVERY_PARTNER: ["delivery", "attendance"],
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.STAFF_JWT_SECRET || "elpresto_staff_jwt_secret_change_in_production_32chars"
);

const SESSION_HOURS = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { staffId, password, panel } = body as {
      staffId: string;
      password: string;
      panel: string;
    };

    if (!staffId?.trim() || !password || !panel) {
      return NextResponse.json({ success: false, reason: "invalid_input" }, { status: 400 });
    }

    const cleanStaffId = staffId.trim().toLowerCase();

    const staffQuery = query(
      collection(db, "staffProfiles"),
      where("staffId", "==", cleanStaffId)
    );
    const snap = await getDocs(staffQuery);

    if (snap.empty) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
      return NextResponse.json({ success: false, reason: "invalid_credentials" }, { status: 401 });
    }

    const profileDoc = snap.docs[0];
    const profile = profileDoc.data() as any;

    if (!profile.active) {
      return NextResponse.json({ success: false, reason: "account_inactive" }, { status: 401 });
    }

    const now = new Date();
    if (profile.lockedUntil) {
      const lockedUntilDate = profile.lockedUntil?.toDate?.() ?? new Date(profile.lockedUntil);
      if (lockedUntilDate > now) {
        const minutesLeft = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 60000);
        return NextResponse.json(
          { success: false, reason: "rate_limited", minutesLeft },
          { status: 429 }
        );
      }
    }

    if (!profile.passwordHash) {
      return NextResponse.json({ success: false, reason: "no_password_set" }, { status: 401 });
    }

    const passwordMatch = await compare(password, profile.passwordHash);

    if (!passwordMatch) {
      const newAttempts = (profile.failedLoginAttempts || 0) + 1;
      const updateData: any = { failedLoginAttempts: newAttempts };
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
        updateData.lockedUntil = Timestamp.fromDate(lockUntil);
      }
      await updateDoc(doc(db, "staffProfiles", profileDoc.id), updateData);
      return NextResponse.json({ success: false, reason: "invalid_credentials" }, { status: 401 });
    }

    const allowedPanels = PANEL_ROLE_ACCESS[profile.role] || [];
    if (!allowedPanels.includes(panel)) {
      await logAuditEvent({
        actorId: cleanStaffId,
        actorName: profile.name,
        actorRole: profile.role,
        branchId: profile.branchId,
        action: "UNAUTHORIZED_PANEL_ACCESS_ATTEMPT",
        targetType: "system",
        metadata: { attemptedPanel: panel, allowedPanels },
      });
      return NextResponse.json({ success: false, reason: "panel_access_denied" }, { status: 403 });
    }

    await updateDoc(doc(db, "staffProfiles", profileDoc.id), {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: serverTimestamp(),
    });

    const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
    const token = await new SignJWT({
      staffId: cleanStaffId,
      role: profile.role,
      branchId: profile.branchId,
      name: profile.name,
      panel,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(JWT_SECRET);

    await logAuditEvent({
      actorId: cleanStaffId,
      actorName: profile.name,
      actorRole: profile.role,
      branchId: profile.branchId,
      action: "STAFF_LOGIN",
      targetType: "system",
      metadata: { panel },
    });

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      mustChangePassword: profile.mustChangePassword || false,
      profile: {
        staffId: cleanStaffId,
        name: profile.name,
        role: profile.role,
        branchId: profile.branchId,
        email: profile.email,
      },
    });
  } catch (err: any) {
    console.error("Staff auth error:", err);
    return NextResponse.json({ success: false, reason: "server_error" }, { status: 500 });
  }
}
