import { NextResponse } from "next/server";
import crypto from "crypto";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret) {
      console.error("Razorpay webhook secret not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Invalid Razorpay webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // Handle payment captured / authorized
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        // Query order by razorpayOrderId and confirm paymentStatus to "paid"
        const q = query(collection(db, "orders"), where("razorpayOrderId", "==", orderId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const orderDoc = snap.docs[0];
          await updateDoc(doc(db, "orders", orderDoc.id), {
            paymentStatus: "paid",
            razorpayPaymentId: paymentId || orderDoc.data().razorpayPaymentId,
            paidAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const q = query(collection(db, "orders"), where("razorpayOrderId", "==", orderId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const orderDoc = snap.docs[0];
          await updateDoc(doc(db, "orders", orderDoc.id), {
            paymentStatus: "failed",
            paymentFailureReason: paymentEntity?.error_description || "Payment failed",
            updatedAt: Timestamp.now(),
          });
        }
      }
    }

    return NextResponse.json({ status: "ok", received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error?.message || error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
