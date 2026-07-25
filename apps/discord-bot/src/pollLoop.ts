import { ChannelType, Client, type TextChannel } from "discord.js";
import { env } from "./env.js";
import { listDecidedUnsynced, listPendingUnnotified, markNotified, markSynced, type MarketProposal } from "./apiClient.js";
import { buildDecidedEmbed, buildProposalButtons, buildProposalEmbed } from "./embeds.js";

async function getTargetChannel(client: Client): Promise<TextChannel> {
  const channel = await client.channels.fetch(env.discordChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Channel ${env.discordChannelId} is not a text channel the bot can post in`);
  }
  return channel;
}

async function notifyOne(channel: TextChannel, proposal: MarketProposal) {
  const message = await channel.send({ embeds: [buildProposalEmbed(proposal)], components: [buildProposalButtons(proposal)] });
  await markNotified(proposal.id, message.id, channel.id);
}

async function notifyPending(client: Client): Promise<void> {
  const { proposals } = await listPendingUnnotified();
  if (proposals.length === 0) return;

  const channel = await getTargetChannel(client);
  const results = await Promise.allSettled(proposals.map((proposal) => notifyOne(channel, proposal)));
  for (const result of results) {
    if (result.status === "rejected") console.error("Could not notify a pending proposal:", result.reason);
  }
}

async function syncOne(client: Client, proposal: MarketProposal) {
  try {
    const channel = await client.channels.fetch(proposal.discordChannelId!);
    if (channel?.type === ChannelType.GuildText) {
      const message = await channel.messages.fetch(proposal.discordMessageId!);
      await message.edit({ embeds: [buildDecidedEmbed(proposal)], components: [] });
    }
  } catch (err) {
    console.warn(`Could not edit Discord message for proposal ${proposal.id}:`, (err as Error).message);
  }
  // Marked synced even on edit failure (e.g. message deleted) — the decision is
  // already final in the DB, so retrying forever would just spam this log line.
  await markSynced(proposal.id);
}

async function syncDecided(client: Client): Promise<void> {
  const { proposals } = await listDecidedUnsynced();
  if (proposals.length === 0) return;

  await Promise.allSettled(proposals.map((proposal) => syncOne(client, proposal)));
}

export function startPolling(client: Client): void {
  setInterval(() => {
    notifyPending(client).catch((err) => console.error("Poll (pending-unnotified) failed:", err));
    syncDecided(client).catch((err) => console.error("Poll (decided-unsynced) failed:", err));
  }, env.pollIntervalMs);
}
