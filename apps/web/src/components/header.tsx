"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-soft text-brand" : "text-muted hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-4 z-40 mt-4 px-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full border border-line bg-surface py-2 pl-4 pr-2 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-base font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size static mark */}
          <img src="/epimarket-mark.png" alt="" style={{ height: "26px", width: "26px" }} />
          <span>
            Epi<span className="text-brand">Market</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface-raised p-1 sm:flex">
          <NavLink href="/marches" label="Marchés" active={pathname.startsWith("/marches")} />
          {user && user.role !== "ADMIN" && (
            <NavLink href="/portefeuille" label="Profil" active={pathname.startsWith("/portefeuille")} />
          )}
          {user && user.role !== "ADMIN" && (
            <NavLink href="/support" label="Support" active={pathname.startsWith("/support")} />
          )}
          {user?.role === "ADMIN" && (
            <NavLink href="/admin" label="Admin" active={pathname.startsWith("/admin")} />
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {loading ? null : user ? (
            <>
              {user.role !== "ADMIN" && (
                <span className="hidden font-mono text-sm tabular-nums text-muted md:inline">
                  {Number(user.walletBalance).toFixed(2)} €
                </span>
              )}
              <button
                onClick={logout}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-paper transition-colors hover:border-brand"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden text-sm font-medium text-muted transition-colors hover:text-paper sm:inline"
              >
                Connexion
              </Link>
              <Link
                href="/inscription"
                className="rounded-full bg-paper px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-brand"
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
