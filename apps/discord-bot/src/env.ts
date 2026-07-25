function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  get discordBotToken() {
    return required("DISCORD_BOT_TOKEN");
  },
  get discordChannelId() {
    return required("DISCORD_CHANNEL_ID");
  },
  get apiBaseUrl() {
    return process.env.API_BASE_URL ?? "http://host.docker.internal:4000";
  },
  get internalApiSecret() {
    return required("INTERNAL_API_SECRET");
  },
  get pollIntervalMs() {
    return Number(process.env.POLL_INTERVAL_MS ?? 5000);
  },
};
