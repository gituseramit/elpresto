import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Cart from "@/components/Cart";
import { AuthProvider } from "@/contexts/AuthContext";
import RouteAwareChrome from "@/components/RouteAwareChrome";

/* ============================================================= */
/* Fonts                                                         */
/* ============================================================= */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* ============================================================= */
/* Metadata                                                      */
/* ============================================================= */

export const metadata: Metadata = {
  metadataBase: new URL("https://elpresto.co.in"),
  title: {
    template: "%s | EL PRESTO Cafeteria",
    default: "EL PRESTO Cafeteria | 100% Whole Wheat & Zero Palm Oil",
  },
  description:
    "Experience modern, warm, and appetizing cafeteria ordering at EL PRESTO. We serve 100% whole wheat crusts with zero palm oil for a guilt-free indulgence.",
  keywords: [
    "cafeteria",
    "whole wheat pizza",
    "healthy food",
    "zero palm oil",
    "UCER hub",
    "online food ordering",
  ],
  applicationName: "EL PRESTO",
  authors: [{ name: "EL PRESTO Cafeteria" }],
  creator: "EL PRESTO",
  publisher: "EL PRESTO",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://elpresto.co.in",
    siteName: "EL PRESTO Cafeteria",
    title: "EL PRESTO Cafeteria",
    description:
      "Modern, warm, and appetizing cafeteria ordering at EL PRESTO. Guilt-free, healthy, and delicious.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EL PRESTO Cafeteria",
    description:
      "Modern, warm, and appetizing cafeteria ordering at EL PRESTO.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F59E0B" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  colorScheme: "light",
};

/* ============================================================= */
/* Layout                                                        */
/* ============================================================= */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-amber-50 font-sans antialiased`}
      >
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            <RouteAwareChrome>
              <Header />
            </RouteAwareChrome>

            <main id="main-content" className="flex flex-1 flex-col">
              {children}
            </main>

            <RouteAwareChrome>
              <Cart />
            </RouteAwareChrome>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}