"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MarketForm, type MarketFormValues } from "@/components/market-form";
import type { Market } from "@/lib/types";

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditMarketPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ market: Market }>(`/markets/${params.id}`)
      .then((data) => setMarket(data.market))
      .catch((err) => setError(errorMessage(err)));
  }, [params.id]);

  async function handleSubmit(values: MarketFormValues) {
    await apiFetch(`/markets/${params.id}`, {
      method: "PATCH",
      token,
      body: {
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      },
    });
    router.push("/admin/marches");
  }

  if (error) return <p className="text-sm text-no">{error}</p>;
  if (!market) return <p className="text-sm text-muted">Chargement…</p>;

  if (market.status === "RESOLVED") {
    return (
      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">
          Ce marché est résolu ({market.resolvedOutcome === "YES" ? "OUI" : "NON"}) et ne peut plus être modifié.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-semibold tracking-tight">Éditer le marché</h2>
      <MarketForm
        initialValues={{
          title: market.title,
          description: market.description,
          yesDescription: market.yesDescription,
          noDescription: market.noDescription,
          category: market.category,
          startDate: toDatetimeLocal(market.startDate),
          endDate: toDatetimeLocal(market.endDate),
        }}
        submitLabel="Enregistrer"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
