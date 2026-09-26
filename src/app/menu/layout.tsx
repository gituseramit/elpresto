import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Full Menu",
  description: "Browse our delicious menu of 100% whole wheat pizzas, healthy burgers, and refreshing beverages.",
  alternates: {
    canonical: "https://elpresto.co.in/menu",
  },
  openGraph: {
    title: "Full Menu | EL PRESTO Cafeteria",
    description: "Browse our delicious menu of 100% whole wheat pizzas, healthy burgers, and refreshing beverages.",
    url: "https://elpresto.co.in/menu",
  },
};

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
