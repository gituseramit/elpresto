import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "About EL PRESTO" };

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="About EL PRESTO"
      title="Good food, close to campus"
      intro="EL PRESTO is a campus kitchen at UCER in Naini, Prayagraj, serving food for pickup and nearby delivery."
      sections={[
        { title: "A menu for every craving", paragraphs: ["Explore pizzas, burgers, sides, desserts, and drinks. Current prices and availability are shown on the menu before you place an order."] },
        { title: "Made for easy ordering", paragraphs: ["Place an order online, choose pickup or delivery at checkout, and use the order tracker for updates after your order is accepted.", "For ingredient or allergen questions, contact us before ordering so our team can help."] },
        { title: "Find us", paragraphs: ["United College of Engineering and Research (UCER), Naini, Prayagraj, Uttar Pradesh 211010.", "The kitchen is listed as open daily from 10:00 AM to 11:00 PM. Hours can change; please call if you are making a special trip."] },
      ]}
    />
  );
}
