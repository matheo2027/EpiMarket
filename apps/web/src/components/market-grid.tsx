"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";
import { useLanguage } from "@/lib/language-context";
import type { Market } from "@/lib/types";
import { MarketCard } from "./market-card";

export function MarketGrid({ markets }: { markets: Market[] }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isFavorited } = useFavorites();
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const showFavoritesToggle = !!user && user.role !== "ADMIN";
  const visible = favoritesOnly ? markets.filter((m) => isFavorited(m.id)) : markets;

  return (
    <div>
      {showFavoritesToggle && (
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`mt-4 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            favoritesOnly ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-paper"
          }`}
        >
          {t("marches.favoritesOnly")}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="mt-16 text-center text-muted">
          {favoritesOnly ? t("marches.noFavorites") : t("marches.noResults")}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
