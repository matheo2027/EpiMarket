import { EmbedBuilder, escapeMarkdown } from "discord.js";
import type { ResolvedMarketFeedEntry } from "./apiClient.js";

function outcomeLabel(market: ResolvedMarketFeedEntry): string {
  if (market.type === "MULTI") {
    const winner = market.options.find((o) => o.id === market.resolvedOptionId);
    return winner ? escapeMarkdown(winner.label) : "?";
  }
  return market.resolvedOutcome === "YES" ? "OUI" : "NON";
}

export function buildResolvedEmbed(market: ResolvedMarketFeedEntry): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setDescription(`Marché conclu : *${escapeMarkdown(market.title)}* → **${outcomeLabel(market)}**`)
    .setTimestamp();
}
