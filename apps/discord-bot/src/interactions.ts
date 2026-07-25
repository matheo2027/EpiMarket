import { Events, PermissionFlagsBits, type Client } from "discord.js";
import { approveProposal, markSynced, rejectProposal } from "./apiClient.js";
import { buildDecidedEmbed } from "./embeds.js";

export function registerInteractionHandlers(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, proposalId] = interaction.customId.split(":");
    if (action !== "approve" && action !== "reject") return;

    // Defense-in-depth on top of "only admins are in this server": Discord
    // permissions are re-checked here rather than trusted purely from server
    // membership, in case a non-admin ever ends up with access to the channel.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Seuls les administrateurs du serveur peuvent approuver ou rejeter une proposition.",
        ephemeral: true,
      });
      return;
    }

    try {
      const discordUser = interaction.user.tag;
      const { proposal } =
        action === "approve" ? await approveProposal(proposalId, discordUser) : await rejectProposal(proposalId, discordUser);
      // Doesn't reuse pollLoop.ts's syncOne() here: this already has the message
      // via the interaction itself (interaction.update()), so there's no channel/message
      // to fetch — the two sync paths only share the embed builder and markSynced call.
      await interaction.update({ embeds: [buildDecidedEmbed(proposal)], components: [] });
      await markSynced(proposal.id);
    } catch (err) {
      await interaction.reply({ content: `Erreur : ${(err as Error).message}`, ephemeral: true });
    }
  });
}
