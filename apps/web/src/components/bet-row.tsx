"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/lib/confirm-context";
import { useLanguage } from "@/lib/language-context";
import { apiFetch, errorMessage } from "@/lib/api";
import { localeFor } from "@/lib/i18n";
import type { Bet } from "@/lib/types";
import { CategoryBadge } from "@/components/category-badge";
import { truncateHash } from "@/lib/format";
import { optionTone } from "@/lib/option-tones";

// Mirrors the API's WITHDRAWAL_CUTOFF_MS (apps/api/src/routes/bets.ts) — kept
// as a plain top-level function (not inline in the component) since it calls
// the impure Date.now(), which the React Compiler lint forbids directly
// inside a component's own render body.
const WITHDRAWAL_CUTOFF_MS = 5 * 60 * 60 * 1000;
export function canWithdraw(bet: Bet): boolean {
  const market = bet.market;
  if (market?.status !== "OPEN" || bet.payout !== null || bet.withdrawnAt) return false;
  return new Date(market.endDate).getTime() - Date.now() >= WITHDRAWAL_CUTOFF_MS;
}

export function BetRow({
  bet,
  onWithdrawn,
  linkToMarket = true,
}: {
  bet: Bet;
  onWithdrawn: (updated: Bet) => void;
  linkToMarket?: boolean;
}) {
  const { token, refreshUser } = useAuth();
  const { language, t } = useLanguage();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const market = bet.market;
  const payout = bet.payout !== null ? Number(bet.payout) : null;
  const isMulti = bet.side === null;
  const sideColor = isMulti ? optionTone(bet.option?.sortOrder ?? 0).text : bet.side === "YES" ? "text-yes" : "text-no";
  const sideLabel = isMulti ? (bet.option?.label ?? "—") : bet.side === "YES" ? t("betForm.yes") : t("betForm.no");
  const withdrawable = canWithdraw(bet);
  const formattedDate = new Date(bet.createdAt).toLocaleDateString(localeFor(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  async function handleWithdraw(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: t("profile.withdrawConfirmTitle"),
      message: t("profile.withdrawConfirmMessage", {
        amount: `${Number(bet.amount).toFixed(2)} €`,
        title: market?.title ?? "",
      }),
      confirmLabel: t("profile.withdrawConfirmLabel"),
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ bet: Bet }>(`/bets/${bet.id}/withdraw`, { method: "POST", token });
      onWithdrawn(data.bet);
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {market && linkToMarket && <CategoryBadge category={market.category} />}
          <span className={`font-mono text-xs font-semibold ${sideColor}`}>{sideLabel}</span>
        </div>
        {linkToMarket && <p className="text-sm text-paper">{market?.title ?? "—"}</p>}
        <p className="font-mono text-xs text-muted">{formattedDate}</p>
        {bet.txHash && (
          <p className="font-mono text-[11px] text-muted" title={bet.txHash}>
            tx {truncateHash(bet.txHash)}
          </p>
        )}
        {error && <p className="text-xs text-no">{error}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-6 font-mono text-sm tabular-nums">
          <div>
            <p className="text-xs text-muted">{t("profile.stake")}</p>
            <p className="text-paper">{Number(bet.amount).toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-xs text-muted">
              {bet.withdrawnAt ? t("profile.withdrawn") : payout === null ? t("profile.status") : t("profile.gain")}
            </p>
            <p className={bet.withdrawnAt || payout === null ? "text-muted" : payout > 0 ? "text-yes" : "text-no"}>
              {bet.withdrawnAt
                ? `${Number(bet.amount).toFixed(2)} €`
                : payout === null
                  ? t("profile.pending")
                  : `${payout.toFixed(2)} €`}
            </p>
          </div>
        </div>
        {withdrawable && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={busy}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-no hover:text-no disabled:opacity-50"
          >
            {busy ? t("profile.withdrawing") : t("profile.withdraw")}
          </button>
        )}
      </div>
    </>
  );

  const className =
    "flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand sm:flex-row sm:items-center sm:justify-between";

  if (!linkToMarket || !market) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={`/marches/${market.id}`} className={className}>
      {content}
    </Link>
  );
}
