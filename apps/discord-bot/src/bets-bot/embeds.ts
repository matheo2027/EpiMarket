import { EmbedBuilder, escapeMarkdown } from "discord.js";
import type { BetFeedEntry } from "./apiClient.js";

// Usernames are only length-checked at signup (see apps/api/src/routes/auth.ts),
// so an ordinary user could pick one containing markdown — e.g. a masked link
// (`[text](url)`) — and have it posted, unreviewed, into the admin channel on
// every bet. escapeMarkdown neutralizes that before it ever reaches the embed.
function safeUsername(bet: BetFeedEntry): string {
  // maskedLink defaults to false in escapeMarkdown — without it, a username
  // like "[Vérifiez votre wallet ici](http://attacker.example)" would still
  // render as a clickable link, which is exactly the injection this guards against.
  return escapeMarkdown(bet.user.username, { maskedLink: true });
}

function marketLabel(bet: BetFeedEntry): string {
  if (bet.option) return `${bet.market.title} — ${bet.option.label}`;
  return `${bet.market.title} (${bet.side})`;
}

export function buildPlacedEmbed(bet: BetFeedEntry): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setDescription(`**${safeUsername(bet)}** a misé **${bet.amount} €** sur *${marketLabel(bet)}*`)
    .setTimestamp(new Date(bet.createdAt));
}

export function buildWithdrawnEmbed(bet: BetFeedEntry): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9ca3af)
    .setDescription(`**${safeUsername(bet)}** a retiré son pari de **${bet.amount} €** sur *${marketLabel(bet)}*`)
    .setTimestamp(new Date(bet.withdrawnAt ?? bet.createdAt));
}
