"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
          <span className="flex h-6 w-6 overflow-hidden rounded-full border border-line">
            <span className="w-1/2 bg-yes" />
            <span className="w-1/2 bg-no" />
          </span>
          Epi<span className="text-brand">Market</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex">
          <Link href="/marches" className="transition-colors hover:text-paper">
            Marchés
          </Link>
          {user && (
            <Link href="/portefeuille" className="transition-colors hover:text-paper">
              Portefeuille
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-brand transition-colors hover:text-paper">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden font-mono text-sm tabular-nums text-muted sm:inline">
                {Number(user.walletBalance).toFixed(2)} €
              </span>
              <button
                onClick={logout}
                className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:border-brand"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/connexion" className="text-sm font-medium text-muted transition-colors hover:text-paper">
                Connexion
              </Link>
              <Link
                href="/inscription"
                className="rounded-full bg-paper px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-brand"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
