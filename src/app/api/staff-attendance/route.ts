import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const JWT_SECRET = new TextEncoder().encode(process.env.STAFF_JWT_SECRET || "elpresto_staff_jwt_secret_change_in_production_32chars");
const VIEW_ROLES = new Set(["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]);
const MARK_ROLES = new Set(["DEVELOPER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "KITCHEN_MANAGER", "KITCHEN_STAFF", "COUNTER_MANAGER", "COUNTER_STAFF", "DELIVERY_MANAGER", "DELIVERY_PARTNER"]);

async function getStaff(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.staffId || !payload.role) return null;
    const snap = await getDocs(query(collection(db, "staffProfiles"), where("staffId", "==", payload.staffId), limit(1)));
    if (snap.empty || !snap.docs[0].data().active) return null;
    return { ...payload, profile: snap.docs[0].data() } as typeof payload & { profile: Record<string, any> };
  } catch { return null; }
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (deg: number) => deg * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getISTDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(req: NextRequest) {
  const staff = await getStaff(req);
  if (!staff) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const role = String(staff.profile.role || staff.role);
  if (!MARK_ROLES.has(role)) return NextResponse.json({ error: "Your role cannot mark attendance." }, { status: 403 });
  try {
    const body = await req.json();
    const { latitude, longitude, accuracy, action } = body;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !["CHECK_IN", "CHECK_OUT"].includes(action)) {
      return NextResponse.json({ error: "A valid device location and attendance action are required." }, { status: 400 });
    }
    const assignedBranch = String(staff.profile.branchId || "");
    if (assignedBranch === "ALL" && role !== "DEVELOPER" && role !== "SUPER_ADMIN") return NextResponse.json({ error: "Your account is not authorized to select a branch for attendance." }, { status: 403 });
    const branchId = assignedBranch === "ALL" ? String(body.branchId || "") : assignedBranch;
    if (!branchId || (assignedBranch !== "ALL" && body.branchId && body.branchId !== assignedBranch)) return NextResponse.json({ error: "This branch is not assigned to your staff account." }, { status: 403 });
    const branchSnap = await getDoc(doc(db, "branches", branchId));
    if (!branchSnap.exists()) return NextResponse.json({ error: "The assigned branch could not be found." }, { status: 404 });
    const branch = branchSnap.data();
    if (!Number.isFinite(branch.lat) || !Number.isFinite(branch.lng)) return NextResponse.json({ error: "This branch needs valid map coordinates before attendance can be marked." }, { status: 409 });
    const radius = Number.isFinite(branch.attendanceRadiusMeters) && branch.attendanceRadiusMeters > 0 ? branch.attendanceRadiusMeters : 1000;
    const distance = distanceMeters(latitude, longitude, branch.lat, branch.lng);
    const status = distance <= radius ? "SUCCESS" : "REJECTED_OUT_OF_RANGE";
    const attendanceDate = getISTDateKey();
    const record = {
      staffId: String(staff.staffId), staffName: String(staff.profile.name || staff.name || staff.staffId), role,
      branchId, branchName: String(branch.name || branchId), action, timestamp: serverTimestamp(),
      createdAtISO: new Date().toISOString(), attendanceDate, latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null,
      distanceMeters: Math.round(distance), radiusMeters: radius, status,
    };
    if (status !== "SUCCESS") {
      await addDoc(collection(db, "staffAttendance"), record);
      return NextResponse.json({ error: `You must be within ${radius >= 1000 ? `${(radius / 1000).toFixed(radius % 1000 ? 1 : 0)} km` : `${radius} m`} of ${branch.name || "your branch"} to mark attendance. You are currently ${(distance / 1000).toFixed(2)} km away.`, status, distanceMeters: Math.round(distance), radiusMeters: radius }, { status: 403 });
    }

    const todaysRecords = await getDocs(
      query(
        collection(db, "staffAttendance"),
        where("attendanceDate", "==", attendanceDate),
        limit(1000)
      )
    );
    const alreadyMarked = todaysRecords.docs.some((item) => {
      const saved = item.data();
      return saved.staffId === String(staff.staffId) && saved.action === action && saved.status === "SUCCESS";
    });
    if (alreadyMarked) {
      return NextResponse.json(
        { error: `You have already marked ${action === "CHECK_IN" ? "check-in" : "check-out"} today.` },
        { status: 409 }
      );
    }

    const recordId = `${encodeURIComponent(String(staff.staffId))}_${attendanceDate}_${String(action).toLowerCase()}`;
    const attendanceRef = doc(db, "staffAttendance", recordId);
    const wasRecorded = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(attendanceRef);
      if (existing.exists()) return false;
      transaction.set(attendanceRef, record);
      return true;
    });
    if (!wasRecorded) {
      return NextResponse.json(
        { error: `You have already marked ${action === "CHECK_IN" ? "check-in" : "check-out"} today.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, action, branchName: branch.name, distanceMeters: Math.round(distance), radiusMeters: radius, lowConfidence: Number.isFinite(accuracy) && accuracy > 100 });
  } catch (error) {
    console.error("Attendance marking failed:", error);
    return NextResponse.json({ error: "Attendance could not be recorded. Please try again." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const staff = await getStaff(req);
  if (!staff) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const role = String(staff.profile.role || staff.role);
  const hasCustomPermission = Array.isArray(staff.profile.customPermissions) && staff.profile.customPermissions.includes("attendance.view");
  const canViewAll = VIEW_ROLES.has(role) || hasCustomPermission;
  if (!canViewAll && !MARK_ROLES.has(role)) return NextResponse.json({ error: "You do not have permission to view attendance." }, { status: 403 });
  const ownBranch = String(staff.profile.branchId || "");
  const requestedBranch = req.nextUrl.searchParams.get("branchId") || "";
  const mineOnly = req.nextUrl.searchParams.get("mine") === "true";
  const isGlobal = role === "DEVELOPER" || role === "SUPER_ADMIN";
  const branchId = isGlobal ? requestedBranch : ownBranch;
  if (!isGlobal && ownBranch === "ALL") return NextResponse.json({ error: "Your staff account is missing a branch assignment." }, { status: 403 });
  if (!isGlobal && requestedBranch && requestedBranch !== ownBranch) return NextResponse.json({ error: "You can only view attendance for your assigned branch." }, { status: 403 });
  const fallbackDate = req.nextUrl.searchParams.get("date") || getISTDateKey();
  const startDate = req.nextUrl.searchParams.get("startDate") || fallbackDate;
  const endDate = req.nextUrl.searchParams.get("endDate") || fallbackDate;
  if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Choose a valid date range with the start date on or before the end date." }, { status: 400 });
  }
  try {
    const attendanceQuery = startDate === endDate
      ? query(collection(db, "staffAttendance"), where("attendanceDate", "==", startDate))
      : query(
          collection(db, "staffAttendance"),
          where("attendanceDate", ">=", startDate),
          where("attendanceDate", "<=", endDate)
        );
    const result = await getDocs(attendanceQuery);
    const records = result.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row: any) => (mineOnly ? row.staffId === String(staff.staffId) : canViewAll || row.staffId === String(staff.staffId)) && (mineOnly || !branchId || row.branchId === branchId)).sort((a: any, b: any) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));
    return NextResponse.json({ records, canChooseBranch: isGlobal });
  } catch (error) {
    console.error("Attendance read failed:", error);
    return NextResponse.json({ error: "Attendance records could not be loaded." }, { status: 500 });
  }
}
