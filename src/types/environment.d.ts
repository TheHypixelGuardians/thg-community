declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_TOKEN: string;
      DISCORD_CLIENT_ID?: string;
      DISCORD_GUILD_ID?: string;
      DATABASE_URL: string;
      ERROR_LOG_CHANNEL_ID?: string;
      HYPIXEL_API_KEY?: string;
      SHEETDB_API_URL?: string;
      SHEETDB_API_KEY?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      [key: string]: string | undefined;
    }
  }
}

export {};
