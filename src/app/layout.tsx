import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Cart from "@/components/Cart";
import { AuthProvider } from "@/contexts/AuthContext";
import RouteAwareChrome from "@/components/RouteAwareChrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://elpresto.co.in"),
  title: {
    template: "%s | EL PRESTO",
    default: "EL PRESTO | 100% Whole Wheat Pizza & Zero Palm Oil",
  },
  description:
    "100% whole wheat pizzas, zero palm oil, real mozzarella. Pickup at UCER or live GPS delivery in Naini, Prayagraj.",
  keywords: [
    "whole wheat pizza Prayagraj",
    "healthy pizza Naini",
    "EL PRESTO",
    "pizza delivery UCER",
    "zero palm oil food",
  ],
  applicationName: "EL PRESTO",
  authors: [{ name: "EL PRESTO" }],
  creator: "EL PRESTO",
  publisher: "EL PRESTO",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://elpresto.co.in",
    siteName: "EL PRESTO",
    title: "EL PRESTO | 100% Whole Wheat & Zero Palm Oil",
    description:
      "Hot, guilt-free pizzas baked on 100% whole wheat atta with real mozzarella and zero palm oil.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "EL PRESTO — whole-wheat pizza with melted mozzarella",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EL PRESTO | 100% Whole Wheat & Zero Palm Oil",
    description:
      "Hot, guilt-free pizzas baked on 100% whole wheat atta with real mozzarella.",
    images: ["/og-image.jpg"],
  },
  appleWebApp: {
    capable: true,
    title: "EL PRESTO",
    statusBarStyle: "default",
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
  themeColor: "#F59E0B",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className="scroll-smooth motion-reduce:scroll-auto"
      suppressHydrationWarning
    >
      <head>
        <script
          id="el-presto-intro-bootstrap"
          dangerouslySetInnerHTML={{
            __html: `(() => {
              const root = document.documentElement;
              const key = "elpresto:brand-intro:v1";
              const isHome = window.location.pathname === "/";
              const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

              if (!isHome || reduceMotion) {
                if (isHome && reduceMotion) {
                  try { window.sessionStorage.setItem(key, "done"); } catch {}
                }
                root.setAttribute("data-ep-intro", "skip");
                return;
              }

              try {
                if (window.sessionStorage.getItem(key)) {
                  root.setAttribute("data-ep-intro", "skip");
                  return;
                }
                window.sessionStorage.setItem(key, "playing");
              } catch {}

              root.setAttribute("data-ep-intro", "play");
            })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-amber-50 font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gray-900 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>

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
