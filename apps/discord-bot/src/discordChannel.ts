import { ChannelType, type Client, type TextChannel } from "discord.js";

export async function getTextChannel(client: Client, channelId: string): Promise<TextChannel> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Channel ${channelId} is not a text channel the bot can post in`);
  }
  return channel;
}
