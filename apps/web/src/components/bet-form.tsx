"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { truncateHash } from "@/lib/format";
import { optionTone } from "@/lib/option-tones";
import type { Bet, BetSide, Market } from "@/lib/types";

const SEED_POOL_LIQUIDITY = 50;

function estimatePayout(market: Market, side: BetSide, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const realYesPool = Math.max(0, Number(market.yesPool) - SEED_POOL_LIQUIDITY);
  const realNoPool = Math.max(0, Number(market.noPool) - SEED_POOL_LIQUIDITY);
  const realSidePool = side === "YES" ? realYesPool : realNoPool;

  const newWinningPool = realSidePool + amount;
  const newTotalPool = realYesPool + realNoPool + amount;
  return (amount / newWinningPool) * newTotalPool;
}

function estimateOptionPayout(market: Market, optionId: string | null, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || !optionId) return 0;
  const options = market.options ?? [];
  const realPools = options.map((o) => Math.max(0, Number(o.pool) - SEED_POOL_LIQUIDITY));
  const idx = options.findIndex((o) => o.id === optionId);
  if (idx === -1) return 0;

  const newWinningPool = realPools[idx] + amount;
  const newTotalPool = realPools.reduce((sum, p) => sum + p, 0) + amount;
  return (amount / newWinningPool) * newTotalPool;
}

export function BetForm({ market }: { market: Market }) {
  const { user, token, refreshUser } = useAuth();
  const router = useRouter();
  const sortedOptions = [...(market.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const [side, setSide] = useState<BetSide>("YES");
  const [optionId, setOptionId] = useState<string | null>(sortedOptions[0]?.id ?? null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (market.status !== "OPEN") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Ce marché est résolu, les paris sont fermés.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">
          <Link href="/connexion" className="text-brand hover:underline">
            Connectez-vous
          </Link>{" "}
          pour placer un pari sur ce marché.
        </p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Les administrateurs ne peuvent pas placer de paris.</p>
      </div>
    );
  }

  const isMulti = market.type === "MULTI";
  const numericAmount = Number(amount);
  const estimatedPayout = isMulti
    ? estimateOptionPayout(market, optionId, numericAmount)
    : estimatePayout(market, side, numericAmount);
  const selectedOption = sortedOptions.find((o) => o.id === optionId);
  const failedTxHash = error?.match(/tx (0x[a-fA-F0-9]+)/)?.[1] ?? null;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!numericAmount || numericAmount <= 0) {
      setError("Entrez un montant valide.");
      return;
    }
    if (isMulti && !optionId) {
      setError("Choisissez une option.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{ bet: Bet }>("/bets", {
        method: "POST",
        token,
        body: isMulti ? { marketId: market.id, optionId, amount: numericAmount } : { marketId: market.id, side, amount: numericAmount },
      });
      const txSuffix = data.bet.txHash ? ` (tx ${truncateHash(data.bet.txHash)})` : "";
      const targetLabel = isMulti ? selectedOption?.label : side === "YES" ? "OUI" : "NON";
      setSuccess(`Pari placé : ${numericAmount} € sur ${targetLabel}.${txSuffix}`);
      setAmount("");
      await refreshUser();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      {isMulti ? (
        <div className="flex flex-col gap-2">
          {sortedOptions.map((option) => {
            const tone = optionTone(option.sortOrder);
            const selected = optionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setOptionId(option.id)}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  selected ? `border-current ${tone.text} bg-surface-raised` : "border-line text-muted hover:text-paper"
                }`}
              >
                <span className="truncate text-left">{option.label}</span>
                <span className="shrink-0 font-mono tabular-nums">{Math.round(option.price * 100)}%</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("YES")}
            className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
              side === "YES" ? "border-yes bg-yes-soft text-yes" : "border-line text-muted hover:text-paper"
            }`}
          >
            OUI · {Math.round(market.yesPrice * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setSide("NO")}
            className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
              side === "NO" ? "border-no bg-no-soft text-no" : "border-line text-muted hover:text-paper"
            }`}
          >
            NON · {Math.round(market.noPrice * 100)}%
          </button>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Montant (€)</span>
        <input
          type="number"
          min={1}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-line bg-ink px-3.5 py-2.5 font-mono text-paper outline-none focus-visible:border-brand"
        />
      </label>

      <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3.5 py-2.5 text-sm">
        <span className="text-muted">Gain estimé si {isMulti ? (selectedOption?.label ?? "—") : side === "YES" ? "OUI" : "NON"}</span>
        <span className="font-mono tabular-nums text-paper">{estimatedPayout.toFixed(2)} €</span>
      </div>
      <p className="text-xs text-muted">
        Estimation au prix actuel — le montant réel dépend des paris placés avant la clôture du marché.
      </p>

      {error && (
        <div className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">
          <p>{error}</p>
          {failedTxHash && (
            <Link
              href={`/support?txHash=${failedTxHash}&marketId=${market.id}`}
              className="mt-1.5 inline-block font-medium underline"
            >
              Créer un ticket →
            </Link>
          )}
        </div>
      )}
      {success && (
        <p className="rounded-lg border border-yes/30 bg-yes-soft px-3.5 py-2.5 text-sm text-yes">{success}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
      >
        {submitting ? "Envoi…" : "Placer le pari"}
      </button>

      <p className="text-center font-mono text-xs tabular-nums text-muted">
        Solde : {Number(user.walletBalance).toFixed(2)} €
      </p>
    </form>
  );
}
