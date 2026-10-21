declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_TOKEN: string;

      // Channel IDs
      /** Where unhandled errors are reported. Errors go to the console only without it. */
      ERROR_LOG_CHANNEL_ID?: string;
      /**
       * Fallback general log channel — account links and warnings. A server
       * that sets `logChannelId` through the database wins over this.
       */
      LOG_CHANNEL_ID?: string;

      // Database Configuration
      DATABASE_URL: string;

      // External APIs
      /** Hypixel public API key. `/skyblock` and `/networth` refuse without it. */
      HYPIXEL_API_KEY?: string;

      /** The Discord user id `/pingdiamond` pings. */
      PINGDIAMOND_USER_ID?: string;

      // Link verification
      /** Port the `/link` verification Minecraft server listens on. */
      VERIFY_SERVER_PORT?: string;
      /** Address members join to get a link code. Verification is off without both. */
      VERIFY_SERVER_ADDRESS?: string;

      // Environment
      NODE_ENV?: 'development' | 'production' | 'test';

      // Add other environment variables as needed
      [key: string]: string | undefined;
    }
  }
}

export {};
