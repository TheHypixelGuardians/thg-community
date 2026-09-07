declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Discord Bot Configuration
      DISCORD_TOKEN: string;
      CLIENT_ID: string;

      // Channel IDs
      BUG_REPORT_CHANNEL_ID: string;
      /** Where unhandled errors are reported. Errors go to the console only without it. */
      ERROR_LOG_CHANNEL_ID: string;
      /**
       * Fallback general log channel — account links, link-role sync, repost
       * warnings. A server that sets `logChannelId` through the database wins
       * over this.
       */
      LOG_CHANNEL_ID: string;

      // Database Configuration
      DATABASE_URL: string;

      // External APIs
      SHEETDB_API_URL: string;
      SHEETDB_API_KEY: string;

      // Environment
      NODE_ENV: 'development' | 'production' | 'test';

      // Add other environment variables as needed
      [key: string]: string | undefined;
    }
  }
}

export {};
