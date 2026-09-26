import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.STAFF_JWT_SECRET || "elpresto_staff_jwt_secret_change_in_production_32chars"
);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ valid: false, reason: "no_token" }, { status: 400 });
    }
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return NextResponse.json({
      valid: true,
      profile: {
        staffId: payload.staffId,
        name: payload.name,
        role: payload.role,
        branchId: payload.branchId,
        panel: payload.panel,
      },
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, reason: err.code === "ERR_JWT_EXPIRED" ? "token_expired" : "invalid_token" },
      { status: 401 }
    );
  }
}
