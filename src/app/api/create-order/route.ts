import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { doc, getDocFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = "INR",
      receipt,
      items,
      subtotal,
    } = body as {
      amount?: number;
      currency?: string;
      receipt?: string;
      subtotal?: number;
      items?: Array<{ id?: string; quantity?: number }>;
    };

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return NextResponse.json(
        { error: "The cart is empty or contains too many products." },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item) => ({
      id: String(item?.id || ""),
      quantity: Number(item?.quantity),
    }));
    if (normalizedItems.some(({ id, quantity }) => !id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)) {
      return NextResponse.json(
        { error: "The cart contains an invalid product or quantity." },
        { status: 400 }
      );
    }

    const productSnapshots = await Promise.all(
      normalizedItems.map(({ id }) => getDocFromServer(doc(db, "menuItems", id)))
    );
    let currentSubtotal = 0;
    for (const [index, item] of normalizedItems.entries()) {
      const productSnapshot = productSnapshots[index];
      if (!productSnapshot.exists()) {
        return NextResponse.json(
          { error: "A product in your cart is no longer on the menu. Refresh your cart." },
          { status: 409 }
        );
      }

      const product = productSnapshot.data();
      const productPrice = Number(product.price);
      if (product.available === false || !Number.isFinite(productPrice) || productPrice < 0) {
        return NextResponse.json(
          { error: `${String(product.name || "A product")} is currently unavailable.` },
          { status: 409 }
        );
      }
      currentSubtotal += productPrice * item.quantity;
    }

    if (!Number.isFinite(Number(subtotal)) || Math.round(Number(subtotal) * 100) !== Math.round(currentSubtotal * 100)) {
      return NextResponse.json(
        { error: "Menu prices changed. Review the updated cart before paying." },
        { status: 409 }
      );
    }

    // Validate amount: minimum 100 paise (1 INR)
    const numericAmount = Math.round(Number(amount));
    if (!numericAmount || numericAmount < 100) {
      return NextResponse.json(
        { error: "Amount must be at least 100 paise (₹1)" },
        { status: 400 }
      );
    }

    const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.error("Razorpay credentials missing from environment");
      return NextResponse.json(
        { error: "Payment gateway configuration error" },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    const options = {
      amount: numericAmount,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: unknown) {
    console.error("Error creating Razorpay order:", error);
    const apiError = error && typeof error === "object"
      ? error as { statusCode?: number; error?: { description?: string }; message?: string }
      : {};
    const status = apiError.statusCode || 500;
    return NextResponse.json(
      { error: apiError.error?.description || apiError.message || "Failed to create order" },
      { status }
    );
  }
}
