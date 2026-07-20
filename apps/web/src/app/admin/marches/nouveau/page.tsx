"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { MarketForm, type MarketFormValues } from "@/components/market-form";

export default function NewMarketPage() {
  const { token } = useAuth();
  const router = useRouter();

  async function handleSubmit(values: MarketFormValues) {
    await apiFetch("/markets", {
      method: "POST",
      token,
      body: {
        ...values,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
      },
    });
    router.push("/admin/marches");
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-semibold tracking-tight">Nouveau marché</h2>
      <MarketForm
        initialValues={{
          title: "",
          description: "",
          type: "BINARY",
          yesDescription: "",
          noDescription: "",
          options: ["", "", "", "Autre"],
          category: "OTHER",
          startDate: "",
          endDate: "",
        }}
        submitLabel="Créer le marché"
        onSubmit={handleSubmit}
        allowTypeChange
        allowOptionCountChange
      />
    </div>
  );
}
