import type { Metadata } from "next";
import BrandIntro from "@/components/BrandIntro";
import ItalianArtisanalPizzeria from "@/components/ItalianArtisanalPizzeria";

/* ============================================================= */
/* Site constants                                                */
/* ============================================================= */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elpresto.co.in";
const PHONE_TEL = "+916392512314";
const INSTAGRAM_URL = "https://instagram.com/elprestopizza";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&q=75&auto=format";

/* ============================================================= */
/* Metadata                                                      */
/* ============================================================= */

const OG_TITLE = "EL PRESTO | 100% Whole Wheat & Zero Palm Oil";
const OG_DESC =
  "Fresh pizzas and more, with whole-wheat bases, real mozzarella and clear ingredient notes.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: "EL PRESTO | 100% Whole Wheat Pizza & Zero Palm Oil" },
  description:
    "Order fresh pizzas, burgers, and cold coffee from EL PRESTO. Explore ingredient notes for whole-wheat bases, real mozzarella and more. Pickup at UCER or live GPS delivery in Naini, Prayagraj.",
  keywords: [
    "whole wheat pizza Prayagraj",
    "healthy pizza Naini",
    "EL PRESTO",
    "pizza delivery UCER",
    "zero palm oil food",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: "/",
    siteName: "EL PRESTO",
    type: "website",
    locale: "en_IN",
    images: [{ url: HERO_IMAGE, width: 1000, height: 1000, alt: "EL PRESTO whole wheat pizza" }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: [HERO_IMAGE],
  },
};

/* ============================================================= */
/* Page                                                          */
/* ============================================================= */

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "EL PRESTO",
    description:
      "100% whole wheat pizzas, zero palm oil, real mozzarella. Fast pickup or live GPS delivery in Naini, Prayagraj.",
    url: `${SITE_URL}/`,
    image: HERO_IMAGE,
    hasMenu: `${SITE_URL}/menu`,
    telephone: PHONE_TEL,
    priceRange: "₹",
    servesCuisine: ["Pizza", "Italian", "Healthy Fast Food"],
    sameAs: [INSTAGRAM_URL],
    address: {
      "@type": "PostalAddress",
      streetAddress: "United College of Engineering and Research, Naini",
      addressLocality: "Prayagraj",
      addressRegion: "UP",
      postalCode: "211010",
      addressCountry: "IN",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "10:00",
      closes: "23:00",
    },
  };

  return (
    <div className="storefront-theme ep-luxe-home">
      <BrandIntro />
      <ItalianArtisanalPizzeria />
      {/* Structured data (escape "<" so the JSON can never close the script tag) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}