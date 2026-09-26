import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Governance & Multi-Outlet Platform | EL PRESTO",
  description: "Centralized multi-outlet architecture, RBAC, and operations command center.",
};

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
