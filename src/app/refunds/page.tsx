import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Refunds and cancellation | EL PRESTO" };

export default function RefundsPage() {
  return (
    <InfoPage
      eyebrow="Order support"
      title="Refunds and cancellation"
      intro="If something is wrong with an order or payment, contact the kitchen promptly so the team can review it."
      sections={[
        { title: "Changing or cancelling an order", paragraphs: ["Food preparation can begin soon after an order is accepted, so a change or cancellation may not be possible once preparation has started. Call +91 63925 12314 as soon as possible and share your order number.", "The team will confirm what can be done for your specific order. A request is not considered cancelled until EL PRESTO confirms it."] },
        { title: "Missing items or quality concerns", paragraphs: ["Contact us promptly with your order number and a clear description of the issue. The team will review the order details and discuss an appropriate resolution.", "If an online payment was debited but the order was not created, contact us with the payment reference. Bank or payment-provider processing times may apply to any reversal."] },
        { title: "Contact", paragraphs: ["Call EL PRESTO at +91 63925 12314. Please keep your order number and payment reference handy when available.", "This page describes how to request help; the outcome depends on the circumstances of the order and applicable consumer rights."] },
      ]}
    />
  );
}
