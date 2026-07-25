import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { betsEnv } from "./env.js";
import { startPolling } from "./pollLoop.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);
  startPolling(client);
});

client.login(betsEnv.discordBotToken);
