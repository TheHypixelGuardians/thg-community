declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_TOKEN: string;

      // Channel IDs
      /** Where unhandled errors are reported. Errors go to the console only without it. */
      ERROR_LOG_CHANNEL_ID?: string;
      /**
       * Fallback general log channel — account links, link-role sync, repost
       * warnings. A server that sets `logChannelId` through the database wins
       * over this.
       */
      LOG_CHANNEL_ID?: string;

      // Database Configuration
      DATABASE_URL: string;

      // External APIs
      /** Hypixel public API key. `/skyblock` and `/networth` refuse without it. */
      HYPIXEL_API_KEY?: string;
      SHEETDB_API_URL?: string;
      SHEETDB_API_KEY?: string;

      // Environment
      NODE_ENV?: 'development' | 'production' | 'test';

      // Add other environment variables as needed
      [key: string]: string | undefined;
    }
  }
}

export {};
