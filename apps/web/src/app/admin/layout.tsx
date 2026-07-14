"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

const TABS = [
  { href: "/admin/marches", label: "Marchés" },
  { href: "/admin/paris", label: "Paris" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return null;

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">Accès réservé aux administrateurs.</p>
        <Link href="/" className="mt-4 inline-block text-brand hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Administration</h1>
      <nav className="mt-6 flex gap-2 border-b border-line pb-4">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              pathname.startsWith(tab.href)
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:text-paper"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
