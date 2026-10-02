import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Privacy policy | EL PRESTO" };

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Customer information"
      title="Privacy policy"
      intro="This page describes the customer information the ordering experience may use to run your account and fulfil an order."
      sections={[
        { title: "Information used", paragraphs: ["Depending on how you use the site, this can include account details such as your name, email address, and phone number; order contents; delivery address and location; and instructions you provide.", "The site uses this information to sign you in, prepare and deliver orders, show order status, and help resolve support requests. Location is used when you choose delivery and provide or select a drop-off point."] },
        { title: "Service providers", paragraphs: ["The ordering experience uses Firebase services for account and order functions and a payment service provider for online payments. Those services handle information as needed to provide their part of the service under their own terms and privacy information.", "Do not enter payment card or account credentials into free-text order instructions or support messages."] },
        { title: "Your choices and requests", paragraphs: ["You can choose whether to create an account and whether to provide a delivery location. Some information is needed to place or fulfil an order.", "For a question or a request about your account information, call +91 63925 12314. We may need to verify that the request relates to you before acting on it."] },
      ]}
    />
  );
}
