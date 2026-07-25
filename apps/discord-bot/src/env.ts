import { createBotEnv } from "./botEnv.js";

export const env = createBotEnv("DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID", "INTERNAL_API_SECRET_MODERATION");
