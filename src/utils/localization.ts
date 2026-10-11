/**
 * English user-facing strings. Dotted keys with `{placeholder}` substitution.
 */
export const strings = {
  bot: {
    ready: 'Bot is ready and online!',
    shutdown: 'Bot is shutting down...',
    error: 'An error has occurred',
    permission:
      'You do not have the correct permissions to use this command. (Permission(s): {permission})',
    status: {
      thgcommunity: 'THG Community',
      madeby: 'Made by Vapor',
      invite: 'https://discord.gg/d7jktW3eQC',
    },
  },

  commands: {
    sendmessage: {
      description: 'Send a message to a channel.',
      channel: 'The channel where the message should be sent.',
      message: 'The message to be sent.',
      success: 'Message sent to {channel}.',
    },
    ban: {
      description: 'Ban a member from the server.',
      member: 'The member to ban.',
      reason: 'The reason for the ban.',
      success: 'User {user} has been banned from the server.',
      userMessage: 'You have been banned from {guild} by {moderator}.',
      noReason: 'No reason provided',
    },
    kick: {
      description: 'Kick a member from the server.',
      member: 'The member to kick.',
      reason: 'The reason for the kick.',
      success: 'User {user} has been kicked from the server.',
      userMessage: 'You have been kicked from {guild} by {moderator}.',
      noReason: 'No reason provided',
    },
    timeout: {
      description: 'Give a member a timeout.',
      member: 'The member to give a timeout to.',
      duration: 'The duration of the timeout (e.g. 1h, 30m, 1d).',
      reason: 'The reason for the timeout.',
      success: 'User {user} has been timed out for {duration}.',
      removed: 'Timeout for {user} has been successfully removed.',
      userMessage: 'You have been timed out for {duration} in {guild} by {moderator}.',
      noReason: 'No reason provided',
    },
    warn: {
      description: 'Warn a member.',
      member: 'The member to warn.',
      reason: 'The reason for the warning.',
      success: 'User {user} has been warned.',
      userMessage: 'You have been warned by {moderator} in {guild}.',
      noReason: 'No reason provided',
    },
    help: {
      description: 'Show all available commands.',
      title: 'THG Community Bot Commands',
      category: 'Category',
      usage: 'Usage',
    },
    info: {
      description: 'Show information about the bot.',
      title: 'Bot Information',
      version: 'Version',
      uptime: 'Uptime',
      serverCount: 'Server Count',
    },
    ping: {
      description: 'Test the bot latency.',
      response: 'Pong! Latency: {latency}ms',
    },
    profile: {
      description: "Show a user's profile.",
      user: 'The user to show information about.',
      title: 'Profile of {username}',
      joined: 'Member since',
      roles: 'Roles',
      infractions: 'Infractions',
      action: 'What do you want to do with your profile',
    },
    skyblock: {
      description: "Look up a player's SkyBlock profile.",
      username: 'Minecraft username',
      title: 'SkyBlock — {username}',
      profile: 'Profile',
      mode: 'Mode',
      level: 'SkyBlock level',
      skillAverage: 'Skill average',
      purse: 'Purse',
      bank: 'Bank',
      guild: 'Guild',
      noKey: '❌ The Hypixel API key is not configured. Ask an admin to set `HYPIXEL_API_KEY`.',
      noPlayer: '❌ No Minecraft account named `{username}` exists.',
      mojangError: '❌ Could not reach Mojang. Please try again shortly.',
      noProfiles: '❌ **{username}** has no SkyBlock profiles.',
      rateLimit: '⚠️ Hypixel rate limit. Please try again shortly.',
      invalidKey: '❌ The Hypixel API key is invalid. Ask an admin to check it.',
      apiError: '❌ Hypixel API is unreachable right now. Please try again shortly.',
      hidden: 'Hidden (API settings)',
      normal: 'Normal',
    },
    networth: {
      description: "Look up a player's SkyBlock networth.",
      username: 'Minecraft username',
      title: 'Networth — {username}',
      networth: 'Networth',
      unsoulbound: 'Unsoulbound',
      profile: 'Profile',
      purse: 'Purse',
      bank: 'Bank',
      personalBank: 'Personal bank',
      breakdown: 'Breakdown',
      allProfiles: 'All profiles',
      apiOff: '(API off)',
      footer: 'Calculated with skyhelper-networth · Hypixel API',
      noKey: '❌ The Hypixel API key is not configured. Ask an admin to set `HYPIXEL_API_KEY`.',
      noPlayer: '❌ No Minecraft account named `{username}` exists.',
      mojangError: '❌ Could not reach Mojang. Please try again shortly.',
      noProfiles: '❌ **{username}** has no SkyBlock profiles.',
      noNetworth: '❌ No networth found for **{username}**.',
      rateLimit: '⚠️ Hypixel rate limit. Please try again shortly.',
      invalidKey: '❌ The Hypixel API key is invalid. Ask an admin to check it.',
      apiError: '❌ Hypixel API is unreachable right now. Please try again shortly.',
      calcError: '❌ Could not calculate networth. Please try again shortly.',
      cooldown: '⚠️ Slow down — try again in {seconds}s.',
    },
    setup: {
      description: 'Set up the bot for this server.',
      title: 'Admin Setup Center',
      alreadySetup: 'This server is already set up.',
      success: 'The bot has been set up for this server.',
      ticketChannelTitle: 'Ticket Channel',
      ticketChannelDescription: 'Choose a channel for the ticket systems',
      ticketChannelPlaceholder: 'Choose a channel for the ticket systems',
      ticketButtonLabel: 'Ticket System',
      automodButtonLabel: 'Automod System',
      ticketCategoryTitle: 'Ticket Category',
      ticketCategoryDescription: 'Choose a category for the ticket systems',
      ticketCategoryPlaceholder: 'Choose a category for the ticket systems',
    },
    fetchData: {
      description: 'Fetch all data from the SheetDB API.',
      success: 'Fetched {count} rows of data',
    },
  },

  categories: {
    admin: 'Administration',
    moderation: 'Moderation',
    utility: 'Utilities',
  },

  errors: {
    userNotFound: 'User not found.',
    invalidDuration: 'Invalid duration provided.',
    alreadyBanned: 'This user is already banned.',
    alreadyKicked: 'This user is already kicked.',
    alreadyTimedOut: 'This user already has a timeout.',
    cannotBanSelf: 'You cannot ban yourself.',
    cannotKickSelf: 'You cannot kick yourself.',
    cannotTimeoutSelf: 'You cannot timeout yourself.',
    botMissingPermission: 'I do not have the correct permissions to perform this action.',
  },
};

/**
 * Looks up an English string by dotted key and substitutes `{placeholders}`.
 * Missing keys return the key itself.
 */
export function t(key: string, params?: Record<string, string>): string {
  const keys = key.split('.');
  let value: unknown = strings;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof value === 'string' && params) {
    return value.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
  }

  return (value as string) || key;
}
