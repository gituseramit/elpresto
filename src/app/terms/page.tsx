import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Terms of service | EL PRESTO" };

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Customer information"
      title="Terms of service"
      intro="These terms explain the basics of using the EL PRESTO website to browse and place food orders."
      sections={[
        { title: "Orders and availability", paragraphs: ["Menu items, prices, and availability may change. An order request is subject to confirmation by the kitchen. Please check the item details, order type, address, and total before submitting.", "Preparation begins after an order is accepted. If we cannot fulfil an item or order, contact from the kitchen will be used to discuss the next step."] },
        { title: "Pickup and delivery", paragraphs: ["Delivery options, coverage, fees, and estimates depend on the address and order details shown at checkout. Enter a reachable phone number and accurate delivery information.", "Keep your order tracking details available. Do not share a delivery verification code except with the assigned delivery partner when receiving your order."] },
        { title: "Payments and help", paragraphs: ["Online payments are handled through the payment service presented during checkout. For a payment or order issue, call EL PRESTO at +91 63925 12314 and provide the order number if available.", "These customer terms are a plain-language guide and do not replace rights provided by applicable law."] },
      ]}
    />
  );
}
