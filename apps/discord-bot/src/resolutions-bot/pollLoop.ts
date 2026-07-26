import { Client, type TextChannel } from "discord.js";
import { resolutionsEnv } from "./env.js";
import { getTextChannel } from "../discordChannel.js";
import { listUnnotifiedResolutions, markResolutionNotified } from "./apiClient.js";
import { buildResolvedEmbed } from "./embeds.js";

async function announceOne(channel: TextChannel, market: Awaited<ReturnType<typeof listUnnotifiedResolutions>>[number]) {
  await channel.send({ embeds: [buildResolvedEmbed(market)] });
  await markResolutionNotified(market.id);
}

async function announceUnnotified(client: Client): Promise<void> {
  const markets = await listUnnotifiedResolutions();
  if (markets.length === 0) return;

  const channel = await getTextChannel(client, resolutionsEnv.discordChannelId);
  const results = await Promise.allSettled(markets.map((market) => announceOne(channel, market)));
  for (const result of results) {
    if (result.status === "rejected") console.error("Could not announce a market resolution:", result.reason);
  }
}

export function startPolling(client: Client): void {
  setInterval(() => {
    announceUnnotified(client).catch((err) => console.error("Resolutions feed poll failed:", err));
  }, resolutionsEnv.pollIntervalMs);
}
