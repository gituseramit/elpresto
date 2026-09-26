import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;

// Default staff accounts to seed
const DEFAULT_ACCOUNTS = [
  {
    staffId: "admin_elpresto",
    name: "Admin — EL PRESTO",
    email: "admin@elpresto.com",
    role: "ADMIN",
    branchId: "ALL",
    defaultPassword: "Admin@2024",
  },
  {
    staffId: "kitchen_main",
    name: "Kitchen Manager — Main",
    email: "kitchen@elpresto.com",
    role: "KITCHEN_MANAGER",
    branchId: "branch-main",
    defaultPassword: "Kitchen@2024",
  },
  {
    staffId: "counter_main",
    name: "Counter Manager — Main",
    email: "counter@elpresto.com",
    role: "COUNTER_MANAGER",
    branchId: "branch-main",
    defaultPassword: "Counter@2024",
  },
  {
    staffId: "delivery_main",
    name: "Delivery Manager — Main",
    email: "delivery@elpresto.com",
    role: "DELIVERY_MANAGER",
    branchId: "branch-main",
    defaultPassword: "Delivery@2024",
  },
  {
    staffId: "developer_root",
    name: "Developer — Root Access",
    email: "dev@elpresto.com",
    role: "DEVELOPER",
    branchId: "ALL",
    defaultPassword: "Dev@Presto2024",
  },
];

export async function GET(req: NextRequest) {
  try {
    // Security: require seed key
    const url = new URL(req.url);
    const seedKey = url.searchParams.get("seed_key");
    const expectedKey = process.env.STAFF_SEED_KEY || "elpresto_seed_2024";

    if (seedKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: any[] = [];

    for (const account of DEFAULT_ACCOUNTS) {
      const docRef = doc(db, "staffProfiles", account.staffId);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        results.push({ staffId: account.staffId, status: "skipped — already exists" });
        continue;
      }

      const passwordHash = await hash(account.defaultPassword, BCRYPT_ROUNDS);

      await setDoc(docRef, {
        id: account.staffId,
        staffId: account.staffId,
        name: account.name,
        email: account.email,
        role: account.role,
        branchId: account.branchId,
        active: true,
        passwordHash,
        mustChangePassword: true, // Force change on first login
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      results.push({ staffId: account.staffId, status: "created", role: account.role });
    }

    return NextResponse.json({
      success: true,
      message: "Staff accounts seeded. All accounts have mustChangePassword=true.",
      accounts: results,
      warning: "CHANGE DEFAULT PASSWORDS IMMEDIATELY after first login!",
    });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
