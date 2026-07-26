import { createBotEnv } from "../botEnv.js";

export const resolutionsEnv = createBotEnv(
  "RESOLUTIONS_DISCORD_BOT_TOKEN",
  "RESOLUTIONS_DISCORD_CHANNEL_ID",
  "INTERNAL_API_SECRET_RESOLUTIONS",
);
