function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Builds a bot's env accessor: the three vars specific to that bot (token,
 * channel, internal secret), plus the poll interval shared by every bot in
 * this package. `secretVar` is per-bot (not shared) so a compromised bot's
 * secret only unlocks its own routes on the API — see requireInternalSecret /
 * requireAdminOrInternalSecret in apps/api/src/middleware/auth.ts.
 */
export function createBotEnv(tokenVar: string, channelVar: string, secretVar: string) {
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
      return required(secretVar);
    },
    get pollIntervalMs() {
      return Number(process.env.POLL_INTERVAL_MS ?? 5000);
    },
  };
}
