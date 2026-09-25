import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Cart from "@/components/Cart";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aquaarogya.web.app"),
  title: {
    template: "%s | EL PRESTO Cafeteria",
    default: "EL PRESTO Cafeteria | 100% Whole Wheat & Zero Palm Oil",
  },
  description: "Experience modern, warm, and appetizing cafeteria ordering at EL PRESTO. We serve 100% whole wheat crusts with zero palm oil for a guilt-free indulgence.",
  keywords: ["cafeteria", "whole wheat pizza", "healthy food", "zero palm oil", "UCER hub", "online food ordering"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://aquaarogya.web.app",
    siteName: "EL PRESTO Cafeteria",
    title: "EL PRESTO Cafeteria",
    description: "Modern, warm, and appetizing cafeteria ordering at EL PRESTO. Guilt-free, healthy, and delicious.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EL PRESTO Cafeteria",
    description: "Modern, warm, and appetizing cafeteria ordering at EL PRESTO.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "https://i.postimg.cc/FzwvsB1x/dde.png" },
    ],
    shortcut: ["https://i.postimg.cc/FzwvsB1x/dde.png"],
    apple: [
      { url: "https://i.postimg.cc/FzwvsB1x/dde.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          <Cart />
        </AuthProvider>
      </body>
    </html>
  );
}
