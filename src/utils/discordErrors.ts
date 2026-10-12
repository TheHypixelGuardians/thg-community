/**
 * Discord REST throws DiscordAPIError from `@discordjs/rest`, which is a
 * *different class* than the one re-exported by `discord.js`. `instanceof`
 * against the discord.js export always fails — match on `code` instead.
 */
export function getDiscordErrorCode(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === 'object' && current !== null && 'code' in current) {
      const code = Number((current as { code: unknown }).code);
      if (Number.isFinite(code)) return code;
    }
    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return undefined;
}

export function isStaleInteractionError(error: unknown): boolean {
  const code = getDiscordErrorCode(error);
  return code === 10062 || code === 40060;
}
