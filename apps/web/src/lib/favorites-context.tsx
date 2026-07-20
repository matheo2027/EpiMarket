"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";

type FavoritesContextValue = {
  isFavorited: (marketId: string) => boolean;
  toggleFavorite: (marketId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = token
      ? apiFetch<{ marketIds: string[] }>("/users/me/favorites", { token })
          .then((data) => new Set(data.marketIds))
          .catch(() => new Set<string>())
      : Promise.resolve(new Set<string>());
    load.then(setFavoriteIds);
  }, [token]);

  async function toggleFavorite(marketId: string) {
    if (!token) return;
    const wasFavorited = favoriteIds.has(marketId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
    try {
      await apiFetch(`/markets/${marketId}/favorite`, { method: wasFavorited ? "DELETE" : "POST", token });
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(marketId);
        else next.delete(marketId);
        return next;
      });
    }
  }

  return (
    <FavoritesContext.Provider value={{ isFavorited: (id) => favoriteIds.has(id), toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
