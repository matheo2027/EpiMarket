"use client";

import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";

export function FavoriteButton({ marketId }: { marketId: string }) {
  const { user } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();

  if (!user || user.role === "ADMIN") return null;

  const favorited = isFavorited(marketId);

  return (
    <button
      type="button"
      aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(marketId);
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition-colors ${
        favorited ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-paper"
      }`}
    >
      {favorited ? "★" : "☆"}
    </button>
  );
}
