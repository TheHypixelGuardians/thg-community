declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Discord Bot Configuration
      DISCORD_TOKEN: string;
      CLIENT_ID: string;
      
      // Channel IDs
      BUG_REPORT_CHANNEL_ID: string;
      
      // Database Configuration
      DATABASE_URL: string;
      
      // Environment
      NODE_ENV: 'development' | 'production' | 'test';
      
      // Add other environment variables as needed
      [key: string]: string | undefined;
    }
  }
}

export {};
