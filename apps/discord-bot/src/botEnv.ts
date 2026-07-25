function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Builds a bot's env accessor: the two vars specific to that bot (token/channel), plus the vars shared by every bot in this package. */
export function createBotEnv(tokenVar: string, channelVar: string) {
  return {
    get discordBotToken() {
      return required(tokenVar);
    },
    get discordChannelId() {
      return required(channelVar);
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
}
