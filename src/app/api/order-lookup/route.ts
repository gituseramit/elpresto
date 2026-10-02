import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const { orderNumber, phone } = await request.json();
    const normalizedNumber = String(orderNumber || "").trim().toUpperCase();
    const normalizedPhone = String(phone || "").replace(/\D/g, "").slice(-10);
    if (normalizedNumber.length < 4 || normalizedPhone.length < 10) {
      return NextResponse.json({ error: "Enter a valid order number and the phone number used at checkout." }, { status: 400 });
    }
    const snapshot = await getDocs(query(collection(db, "orders"), where("orderNumber", "==", normalizedNumber), limit(5)));
    const match = snapshot.docs.find((order) => {
      const data = order.data();
      return String(data.customerPhone || data.phone || "").replace(/\D/g, "").slice(-10) === normalizedPhone;
    });
    if (!match) return NextResponse.json({ error: "We could not find an order matching those details." }, { status: 404 });
    return NextResponse.json({ orderId: match.id });
  } catch (error) {
    console.error("Order lookup failed:", error);
    return NextResponse.json({ error: "Order lookup is temporarily unavailable." }, { status: 500 });
  }
}
