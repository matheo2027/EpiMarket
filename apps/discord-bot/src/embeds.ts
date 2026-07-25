import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { MarketProposal } from "./apiClient.js";

function describeMarket(proposal: MarketProposal): string {
  if (proposal.type === "MULTI") {
    return `Options : ${proposal.optionLabels.join(", ")}`;
  }
  return `OUI : ${proposal.yesDescription}\nNON : ${proposal.noDescription}`;
}

export function buildProposalEmbed(proposal: MarketProposal): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(proposal.title)
    .setDescription(proposal.description)
    .setColor(0xf5a623)
    .addFields(
      { name: "Catégorie", value: proposal.category, inline: true },
      { name: "Type", value: proposal.type, inline: true },
      { name: "Proposé par", value: proposal.proposer?.username ?? proposal.id, inline: true },
      { name: "Détails", value: describeMarket(proposal) },
      { name: "Fenêtre", value: `${new Date(proposal.startDate).toLocaleString("fr-FR")} → ${new Date(proposal.endDate).toLocaleString("fr-FR")}` },
    )
    .setFooter({ text: `Proposition ${proposal.id}` })
    .setTimestamp(new Date(proposal.createdAt));
}

export function buildProposalButtons(proposal: MarketProposal): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`approve:${proposal.id}`).setLabel("Approuver").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${proposal.id}`).setLabel("Rejeter").setStyle(ButtonStyle.Danger),
  );
}

export function buildDecidedEmbed(proposal: MarketProposal): EmbedBuilder {
  const approved = proposal.status === "APPROVED";
  return buildProposalEmbed(proposal)
    .setColor(approved ? 0x1abc7a : 0xe3444a)
    .addFields({ name: approved ? "Approuvée" : "Rejetée", value: proposal.decidedBy ?? "—" });
}
