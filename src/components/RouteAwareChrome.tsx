"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Routes that own their own full-screen chrome (sidebar, header, cart)
 * and must not render the customer Header or Cart. Prefix-matched so
 * nested routes like /admin/orders are covered.
 */
const DASHBOARD_PREFIXES = [
  "/admin",
  "/kitchen",
  "/counter",
  "/delivery",
  "/developer",
] as const;

function isDashboardRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function RouteAwareChrome({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (isDashboardRoute(pathname)) return null;

  return <>{children}</>;
}