"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { categoryKey } from "@/lib/i18n";
import type { MarketCategory } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { HelpModal } from "@/components/help-modal";

const CATEGORIES: MarketCategory[] = ["POLITICS", "SPORTS", "CRYPTO", "ECONOMY", "SCIENCE_TECH", "POP_CULTURE", "OTHER"];

function ColumnLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block text-sm text-muted transition-colors hover:text-paper">
      {children}
    </Link>
  );
}

export function Footer() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line px-3 pb-8 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size static mark */}
          <img src="/epimarket-mark.png" alt="" style={{ height: "22px", width: "22px" }} />
          <span>
            Epi<span className="text-brand">Market</span>
          </span>
        </div>
        <p className="mt-2 max-w-sm text-sm text-muted">{t("footer.tagline")}</p>

        <div className={`mt-8 grid grid-cols-2 gap-8 ${user ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("footer.categoriesHeading")}</p>
            <div className="mt-3 flex flex-col gap-2">
              {CATEGORIES.map((cat) => (
                <ColumnLink key={cat} href={`/marches?category=${cat}`}>
                  {t(categoryKey(cat))}
                </ColumnLink>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("footer.linksHeading")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <ColumnLink href="/marches">{t("footer.markets")}</ColumnLink>
              <ColumnLink href="/classement">{t("footer.leaderboard")}</ColumnLink>
              <ColumnLink href="/support">{t("footer.support")}</ColumnLink>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="text-left text-sm text-muted transition-colors hover:text-paper"
              >
                {t("footer.howItWorks")}
              </button>
            </div>
          </div>

          {!user && (
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">{t("footer.projectHeading")}</p>
              <div className="mt-3 flex flex-col gap-2">
                <ColumnLink href="/connexion">{t("footer.login")}</ColumnLink>
                <ColumnLink href="/inscription">{t("footer.createAccount")}</ColumnLink>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            EpiMarket © {year} · {t("footer.rights")} · {t("footer.author")}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">{t("footer.language")}</span>
            <LanguageSwitcher variant="full" />
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">{t("footer.legal")}</p>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} variant="user" />
    </footer>
  );
}
