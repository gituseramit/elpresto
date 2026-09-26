import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { compare, hash } from "bcryptjs";
import { jwtVerify } from "jose";
import { logAuditEvent } from "@/lib/rbac";

const JWT_SECRET = new TextEncoder().encode(
  process.env.STAFF_JWT_SECRET || "elpresto_staff_jwt_secret_change_in_production_32chars"
);
const BCRYPT_ROUNDS = 12;

// Staff changes own password (requires current password or mustChangePassword bypass with valid token)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, staffId, currentPassword, newPassword } = body as {
      token: string;
      staffId: string;
      currentPassword?: string;
      newPassword: string;
    };

    if (!token || !staffId || !newPassword) {
      return NextResponse.json({ success: false, reason: "invalid_input" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, reason: "password_too_short", message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Verify the JWT token
    let payload: any;
    try {
      const result = await jwtVerify(token, JWT_SECRET);
      payload = result.payload;
    } catch {
      return NextResponse.json({ success: false, reason: "invalid_token" }, { status: 401 });
    }

    // Ensure token belongs to the same staffId
    if (payload.staffId !== staffId.toLowerCase()) {
      return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 403 });
    }

    // Fetch staff profile
    const staffQuery = query(
      collection(db, "staffProfiles"),
      where("staffId", "==", staffId.toLowerCase())
    );
    const snap = await getDocs(staffQuery);
    if (snap.empty) {
      return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
    }

    const profileDoc = snap.docs[0];
    const profile = profileDoc.data() as any;

    // If not mustChangePassword, verify current password
    if (!profile.mustChangePassword && currentPassword) {
      const matches = await compare(currentPassword, profile.passwordHash || "");
      if (!matches) {
        return NextResponse.json(
          { success: false, reason: "invalid_credentials" },
          { status: 401 }
        );
      }
    }

    // Hash new password and update
    const newHash = await hash(newPassword, BCRYPT_ROUNDS);
    await updateDoc(doc(db, "staffProfiles", profileDoc.id), {
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      actorId: staffId,
      actorName: profile.name,
      actorRole: profile.role,
      branchId: profile.branchId,
      action: "PASSWORD_CHANGED",
      targetType: "user",
      targetId: staffId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Password setup error:", err);
    return NextResponse.json({ success: false, reason: "server_error" }, { status: 500 });
  }
}

// Admin resets another staff member password (requires admin JWT with ADMIN/DEVELOPER role)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminToken, targetStaffId, newPassword } = body as {
      adminToken: string;
      targetStaffId: string;
      newPassword: string;
    };

    if (!adminToken || !targetStaffId || !newPassword) {
      return NextResponse.json({ success: false, reason: "invalid_input" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, reason: "password_too_short" }, { status: 400 });
    }

    // Verify admin JWT
    let adminPayload: any;
    try {
      const result = await jwtVerify(adminToken, JWT_SECRET);
      adminPayload = result.payload;
    } catch {
      return NextResponse.json({ success: false, reason: "invalid_token" }, { status: 401 });
    }

    const allowedRoles = ["DEVELOPER", "SUPER_ADMIN", "ADMIN"];
    if (!allowedRoles.includes(adminPayload.role)) {
      return NextResponse.json({ success: false, reason: "insufficient_role" }, { status: 403 });
    }

    // Fetch target staff
    const staffQuery = query(
      collection(db, "staffProfiles"),
      where("staffId", "==", targetStaffId.toLowerCase())
    );
    const snap = await getDocs(staffQuery);
    if (snap.empty) {
      return NextResponse.json({ success: false, reason: "not_found" }, { status: 404 });
    }

    const profileDoc = snap.docs[0];
    const profile = profileDoc.data() as any;
    const newHash = await hash(newPassword, BCRYPT_ROUNDS);

    await updateDoc(doc(db, "staffProfiles", profileDoc.id), {
      passwordHash: newHash,
      mustChangePassword: true, // Force target to change on next login
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      actorId: adminPayload.staffId,
      actorName: adminPayload.name,
      actorRole: adminPayload.role,
      branchId: adminPayload.branchId,
      action: "ADMIN_PASSWORD_RESET",
      targetType: "user",
      targetId: targetStaffId,
      metadata: { targetName: profile.name, targetRole: profile.role },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin password reset error:", err);
    return NextResponse.json({ success: false, reason: "server_error" }, { status: 500 });
  }
}
