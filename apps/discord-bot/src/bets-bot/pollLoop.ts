import { Client, type TextChannel } from "discord.js";
import { betsEnv } from "./env.js";
import { getTextChannel } from "../discordChannel.js";
import { listUnnotifiedBets, markBetNotified, type BetFeedEntry } from "./apiClient.js";
import { buildPlacedEmbed, buildWithdrawnEmbed } from "./embeds.js";

async function announceOne(channel: TextChannel, bet: BetFeedEntry, event: "placed" | "withdrawn") {
  await channel.send({ embeds: [event === "placed" ? buildPlacedEmbed(bet) : buildWithdrawnEmbed(bet)] });
  await markBetNotified(bet.id, event);
}

async function announceUnnotified(client: Client): Promise<void> {
  const { placed, withdrawn } = await listUnnotifiedBets();
  if (placed.length === 0 && withdrawn.length === 0) return;

  const channel = await getTextChannel(client, betsEnv.discordChannelId);
  const results = await Promise.allSettled([
    ...placed.map((bet) => announceOne(channel, bet, "placed")),
    ...withdrawn.map((bet) => announceOne(channel, bet, "withdrawn")),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("Could not announce a bet:", result.reason);
  }
}

export function startPolling(client: Client): void {
  setInterval(() => {
    announceUnnotified(client).catch((err) => console.error("Bets feed poll failed:", err));
  }, betsEnv.pollIntervalMs);
}
