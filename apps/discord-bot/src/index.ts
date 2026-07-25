import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "./env.js";
import { registerInteractionHandlers } from "./interactions.js";
import { startPolling } from "./pollLoop.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

registerInteractionHandlers(client);

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);
  startPolling(client);
});

client.login(env.discordBotToken);
